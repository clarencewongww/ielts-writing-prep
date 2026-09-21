/**
 * Task 1 grader — deterministic band estimate plus cap overrides.
 *
 * Pipeline:
 *  1. word maths (bank-compatible count, copied-question runs, net words),
 *  2. cohesion analysis (paragraphs, linkers, mechanical listing),
 *  3. deterministic analysis (overview, features, data, tense, number/grammar rules),
 *  4. hard caps from `caps.ts` + GRA range/tense caps,
 *  5. base bands from descriptor-shaped heuristics, then `min(base, cap)`,
 *  6. rich feedback items whose `evidenceSpan` points into the submitted text.
 *
 * The grader never calls a backend: every check here is reproducible.
 */

import { COPY_RUN_MIN_WORDS } from "../constants";
import { checkBannedPhrases, countNetWords, countWords } from "../data/wordCount";
import type { Task1FeedbackStarter, Task1Item } from "../types/bank";
import type { Criterion, DeterministicCheck, FeedbackItem } from "../types/grading";
import { evaluateTask1Caps, type GradeCap, type Task1CapInput } from "./caps";
import { analyzeCohesion, splitParagraphs } from "./cohesion";
import { detectMisspellings, spellingDensityBand, task1SpellingAllowlist } from "./lexical";
import {
  analyzeDataPerSentence,
  analyzeGrammar,
  analyzeIntro,
  analyzeNumberRules,
  analyzeOpinion,
  analyzeOverview,
  analyzeRange,
  analyzeTense,
  collectKeyFeatures,
  locateKeyFeatures,
  matchKeyFeatures,
} from "./deterministic";

/* ------------------------------------------------------------------ */
/* Public result shape                                                 */
/* ------------------------------------------------------------------ */

export interface Task1Scores {
  TA: number;
  CC: number;
  LR: number;
  GRA: number;
}

export interface Task1GradeResult {
  task: 1;
  itemId: string;
  words: number;
  netWords: number;
  paragraphCount: number;
  overview: {
    present: boolean;
    coverage: number;
    totalFeatures: number;
    paragraphIndex: number;
  };
  scores: Task1Scores;
  /** Mean of the four criteria, rounded to the nearest half band. */
  overallBand: number;
  caps: GradeCap[];
  checks: DeterministicCheck[];
  feedback: FeedbackItem[];
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function clampBand(value: number): number {
  return Math.max(4, Math.min(9, value));
}

function spanOf(text: string, start: number, end: number): FeedbackItem["evidenceSpan"] {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  return { startChar: safeStart, endChar: safeEnd, text: text.slice(safeStart, safeEnd) };
}

function wholeSpan(text: string): FeedbackItem["evidenceSpan"] {
  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  return spanOf(text, start, Math.max(start, end));
}

/** Converts a bank feedback starter (string span) into offset-based evidence. */
export function evidenceSpanFromString(text: string, needle: string): FeedbackItem["evidenceSpan"] {
  const target = (needle ?? "").trim();
  if (!target) return { startChar: 0, endChar: 0, text: "" };
  const at = text.indexOf(target);
  if (at === -1) return { startChar: 0, endChar: 0, text: "" };
  return { startChar: at, endChar: at + target.length, text: target };
}

function normalizeCriterion(raw: string): Criterion {
  const value = (raw ?? "").toUpperCase();
  if (value === "TA" || value === "TR" || value === "CC" || value === "LR" || value === "GRA") {
    return value;
  }
  return "TA";
}

/** Normalises the bank's Task 1 `feedbackStarter` shape into the rich contract. */
export function normalizeTask1FeedbackStarter(
  starter: Task1FeedbackStarter,
  answerText: string,
  band = 0,
  checkId = "t1.bank.starter",
): FeedbackItem {
  return {
    criterion: normalizeCriterion(starter.criterion),
    band,
    checkId,
    severity: "upgrade",
    evidenceSpan: evidenceSpanFromString(answerText, starter.evidenceSpan),
    feedbackStarter: starter.text,
  };
}

/* ------------------------------------------------------------------ */
/* Base band heuristics                                                */
/* ------------------------------------------------------------------ */

function baseTa(input: Task1CapInput): number {
  let ta = 5;
  if (input.overview.present) ta += 1;
  if (input.overview.coverage >= 2) ta += 1;
  if (input.overview.coverage >= 3) ta += 1;
  if (
    input.data.applicable &&
    input.data.total > 0 &&
    input.data.ratio < 0.8 &&
    input.data.ratio >= 0.5
  ) {
    ta -= 0.5;
  }
  return ta;
}

function baseCc(input: Task1CapInput): number {
  let cc = 6;
  const count = input.paragraphs.length;
  if (count === 4) cc += 1;
  else if (count === 5) cc += 0.5;

  const functions = input.cohesion.functions.filter(
    (fn) => fn !== "opinion" && fn !== "conclusion",
  ).length;
  if (functions >= 4) cc += 1;
  else if (functions >= 2) cc += 0.5;

  const clean = !input.cohesion.mechanical.mechanical && input.cohesion.initialRatio <= 0.5;
  cc += clean ? 0.5 : -0.5;
  return cc;
}

/**
 * Error-density mapping from the dossier §9.4/§9.5 descriptors:
 * frequent → 5, some → 6, few → 7, mostly error-free → 8.
 */
function densityBand(errors: number, words: number): number {
  if (errors === 0) return 8;
  const scaled = words > 0 ? (errors * 200) / words : errors;
  if (scaled <= 1.5) return 7;
  if (scaled <= 3) return 6;
  return 5;
}

/* ------------------------------------------------------------------ */
/* Grade                                                               */
/* ------------------------------------------------------------------ */

export function gradeTask1(item: Task1Item, text: string): Task1GradeResult {
  const raw = typeof text === "string" ? text : "";
  const words = countWords(raw);
  const netWords = countNetWords(raw, item.statement ?? "", COPY_RUN_MIN_WORDS);

  const paragraphs = splitParagraphs(raw);
  const cohesion = analyzeCohesion(raw);
  const overview = analyzeOverview(item, raw, paragraphs);
  const intro = analyzeIntro(item, raw, paragraphs);
  const data = analyzeDataPerSentence(item, paragraphs, overview);
  const tense = analyzeTense(item, paragraphs, overview);
  const numberHits = analyzeNumberRules(raw);
  const grammarHits = analyzeGrammar(raw);
  const opinionHits = analyzeOpinion(raw);
  const range = analyzeRange(item, raw);
  const conclusionHits = cohesion.linkers.filter((hit) => hit.fn === "conclusion");
  const featurePlacements = locateKeyFeatures(item, raw, paragraphs);
  const features = collectKeyFeatures(item);
  const wholeTextMatches = matchKeyFeatures(features, raw);
  const missingFeatures = wholeTextMatches.filter((match) => !match.matched);
  const bannedHits = checkBannedPhrases(raw);
  const bannedBlocking = bannedHits.filter((hit) => !hit.advisory);
  const spellingHits = detectMisspellings(raw, task1SpellingAllowlist(item));
  // Distance-3 advisory suggestions weigh half so a rare word cannot cap LR alone.
  const spellingErrors = spellingHits.filter((hit) => hit.severity === "error").length;
  const spellingWeight = spellingErrors + (spellingHits.length - spellingErrors) * 0.5;

  /* --- caps (caps.ts + GRA range/tense overrides) --- */
  const capInput: Task1CapInput = {
    item,
    text: raw,
    words,
    netWords,
    paragraphs,
    cohesion,
    overview,
    intro,
    data,
    opinionHits,
    conclusionHits,
    featurePlacements,
  };
  const capResult = evaluateTask1Caps(capInput);
  const caps: GradeCap[] = [...capResult.caps];
  const capChecks: DeterministicCheck[] = [...capResult.checks];
  const capFeedback: FeedbackItem[] = [...capResult.feedback];

  if (words >= 60 && range.complexCount < 2) {
    const maxBand = range.complexCount === 0 ? 6 : 7;
    const firstSentence = paragraphs[0]?.sentences[0];
    caps.push({
      criterion: "GRA",
      cap: maxBand,
      checkId: "t1.gra.range",
      reason:
        range.complexCount === 0
          ? "No complex structures detected (although / while / which / because)."
          : "Only one complex structure detected; band 7 needs a variety.",
      evidence: firstSentence
        ? spanOf(raw, firstSentence.start, firstSentence.end)
        : wholeSpan(raw),
    });
    capFeedback.push({
      criterion: "GRA",
      band: maxBand,
      checkId: "t1.gra.range",
      severity: "cap",
      evidenceSpan: firstSentence
        ? spanOf(raw, firstSentence.start, firstSentence.end)
        : wholeSpan(raw),
      feedbackStarter:
        range.complexCount === 0
          ? "Every sentence is simple, so grammatical range cannot reach band 7."
          : "Only one complex structure appears; band 7 needs a variety of complex sentences.",
      fixSuggestion:
        "Join two data points with \"while / whereas\" and add a \"which\" clause for the highest figure.",
    });
  }

  if (tense.issues.length > 0) {
    const maxBand = tense.issues.length >= 2 ? 6 : 7;
    const first = tense.issues[0];
    caps.push({
      criterion: "GRA",
      cap: maxBand,
      checkId: "t1.gra.tense",
      reason: first.message,
      evidence: spanOf(raw, first.span.start, first.span.end),
    });
    capFeedback.push({
      criterion: "GRA",
      band: maxBand,
      checkId: "t1.gra.tense",
      severity: "cap",
      evidenceSpan: spanOf(raw, first.span.start, first.span.end),
      feedbackStarter: first.message,
      fixSuggestion: `Match the chart's dates: ${tense.rule || "past simple for completed years, future forms for projected years"}.`,
    });
  }

  if (spellingHits.length > 0) {
    const spellingBand = spellingDensityBand(spellingWeight, words);
    const firstSpelling = spellingHits[0];
    const spellingEvidence = spanOf(raw, firstSpelling.startChar, firstSpelling.endChar);
    caps.push({
      criterion: "LR",
      cap: spellingBand,
      checkId: "t1.lr.spelling",
      reason: `${spellingHits.length} spelling slip(s): ${spellingHits
        .slice(0, 3)
        .map((hit) => `"${hit.match}" → "${hit.correction}"`)
        .join(", ")}${spellingHits.length > 3 ? ", …" : ""}.`,
      evidence: spellingEvidence,
    });
    capFeedback.push({
      criterion: "LR",
      band: spellingBand,
      checkId: "t1.lr.spelling",
      severity: firstSpelling.severity === "upgrade" ? "upgrade" : "error",
      evidenceSpan: spellingEvidence,
      feedbackStarter: `Spelling: "${firstSpelling.match}" → did you mean "${firstSpelling.correction}"?`,
      fixSuggestion: `Replace "${firstSpelling.match}" with "${firstSpelling.correction}" — spelling errors count under Lexical Resource.`,
    });
  }

  /* --- base bands --- */
  const taBase = baseTa(capInput);
  const ccBase = baseCc(capInput);
  const lrBase = densityBand(numberHits.length + bannedBlocking.length + spellingWeight, words);
  const graErrors = grammarHits.length + tense.issues.length;
  let graBase = densityBand(graErrors, words);
  if (range.complexCount === 0) graBase = Math.min(graBase, 6);
  else if (range.complexCount === 1) graBase = Math.min(graBase, 7);
  let lrAdjusted = lrBase;
  if (words < 40) {
    lrAdjusted = Math.min(lrAdjusted, 5);
    graBase = Math.min(graBase, 5);
  } else if (words < 80) {
    lrAdjusted = Math.min(lrAdjusted, 6);
    graBase = Math.min(graBase, 6);
  }

  const applyCaps = (criterion: Criterion, base: number): number => {
    let value = base;
    for (const cap of caps) {
      if (cap.criterion === criterion) value = Math.min(value, cap.cap);
    }
    return clampBand(roundToHalf(value));
  };

  const scores: Task1Scores = {
    TA: applyCaps("TA", taBase),
    CC: applyCaps("CC", ccBase),
    LR: applyCaps("LR", lrAdjusted),
    GRA: applyCaps("GRA", graBase),
  };
  const overallBand = roundToHalf(
    clampBand((scores.TA + scores.CC + scores.LR + scores.GRA) / 4),
  );

  /* --- analytic checks --- */
  const analyticChecks: DeterministicCheck[] = [
    {
      id: "t1.ta.features",
      label: "All key features mentioned",
      task: 1,
      passed: missingFeatures.length === 0,
      observed: `${wholeTextMatches.filter((match) => match.matched).length}/${features.length} key features named`,
      severity: "upgrade",
      detail:
        missingFeatures.length > 0
          ? `Missing: ${missingFeatures.map((match) => match.description).join("; ")}`
          : undefined,
    },
    {
      id: "t1.intro.copy",
      label: "Introduction paraphrases (no long copied runs)",
      task: 1,
      passed: intro.copiedRatio <= 0.25,
      observed: `${intro.copiedWords} copied word(s) in the introduction (${Math.round(intro.copiedRatio * 100)}%)`,
      severity: "error",
    },
    {
      id: "t1.ta.dataDetail",
      label: data.applicable ? "Body data support" : "Body data support (process exempt)",
      task: 1,
      passed: !data.applicable || data.ratio >= 0.8,
      observed: data.applicable
        ? `${data.withData}/${data.total} body sentences carry data`
        : (data.exemptReason ?? "not applicable"),
      severity: data.applicable ? "error" : "upgrade",
    },
    {
      id: "t1.gra.tense",
      label: "Tense matches the chart's dates",
      task: 1,
      passed: tense.issues.length === 0,
      observed: tense.issues.length === 0
        ? `Expected: ${tense.expected} (${tense.rule || "no dates"})`
        : `${tense.issues.length} tense issue(s) for a ${tense.expected} chart`,
      cap: "GRA",
      severity: "error",
    },
    {
      id: "t1.lr.numberRules",
      label: "Number / amount / ratio rules",
      task: 1,
      passed: numberHits.length === 0,
      observed: numberHits.length === 0
        ? "No number-rule violations"
        : numberHits.map((hit) => hit.match).join(" | "),
      severity: "error",
    },
    {
      id: "t1.gra.grammar",
      label: "Grammar heuristics (plurals, articles, agreement)",
      task: 1,
      passed: grammarHits.length === 0,
      observed: grammarHits.length === 0
        ? "No deterministic grammar faults"
        : grammarHits.map((hit) => hit.match).join(" | "),
      severity: "error",
    },
    {
      id: "t1.gra.rangeComplexity",
      label: "Variety of complex structures",
      task: 1,
      passed: range.complexCount >= 2,
      observed: range.complexCount === 0
        ? "No complex structures detected"
        : range.complexMarkers.join(", "),
      cap: "GRA",
      severity: "error",
    },
    {
      id: "t1.cc.linkerFunctions",
      label: "Linkers cover at least two functions (T1 comparison-led)",
      task: 1,
      passed: cohesion.functions.length >= 2,
      observed:
        cohesion.functions.length === 0
          ? "No linkers detected"
          : cohesion.functions.join(", "),
      severity: "upgrade",
    },
    {
      id: "t1.lr.repetition",
      label: "Lexical repetition under control",
      task: 1,
      passed: range.repeatedTerms.length === 0,
      observed:
        range.repeatedTerms.length === 0
          ? "No term repeats five or more times"
          : range.repeatedTerms.map((entry) => `${entry.term} ×${entry.count}`).join(", "),
      severity: "upgrade",
    },
    {
      id: "t1.lr.spelling",
      label: "Spelling accuracy",
      task: 1,
      passed: spellingHits.length === 0,
      observed:
        spellingHits.length === 0
          ? "No flagged misspellings"
          : spellingHits.map((hit) => `"${hit.match}" → "${hit.correction}"`).join(", "),
      cap: "LR",
      severity: "error",
    },
  ];

  /* --- analytic feedback --- */
  const feedback: FeedbackItem[] = [...capFeedback];
  const pushFeedback = (item_: FeedbackItem) => feedback.push(item_);

  if (data.applicable && data.ratio < 0.5) {
    // already covered by the t1.ta.data cap feedback
  } else {
    for (const entry of data.dataFree.slice(0, 2)) {
      pushFeedback({
        criterion: "TA",
        band: scores.TA,
        checkId: "t1.ta.dataSentence",
        severity: "error",
        evidenceSpan: spanOf(raw, entry.span.start, entry.span.end),
        feedbackStarter:
          "This body sentence carries no figure or date — every body sentence should support the description with data.",
        fixSuggestion: "Add the exact number, percentage or year the sentence describes.",
      });
    }
  }

  for (const issue of tense.issues) {
    pushFeedback({
      criterion: "GRA",
      band: scores.GRA,
      checkId: "t1.gra.tense",
      severity: "error",
      evidenceSpan: spanOf(raw, issue.span.start, issue.span.end),
      feedbackStarter: issue.message,
      fixSuggestion: `Use the tense rule from the chart: ${tense.rule || "past simple for completed years"}.`,
    });
  }

  for (const hit of numberHits) {
    pushFeedback({
      criterion: "LR",
      band: scores.LR,
      checkId: `t1.lr.${hit.kind}`,
      severity: "error",
      evidenceSpan: spanOf(raw, hit.start, hit.end),
      feedbackStarter: hit.message,
      fixSuggestion: hit.suggestion,
    });
  }

  for (const hit of spellingHits.slice(0, 3)) {
    pushFeedback({
      criterion: "LR",
      band: scores.LR,
      checkId: "t1.lr.spelling",
      severity: hit.severity,
      evidenceSpan: spanOf(raw, hit.startChar, hit.endChar),
      feedbackStarter: `Spelling: "${hit.match}" → did you mean "${hit.correction}"?`,
      fixSuggestion: `Replace "${hit.match}" with "${hit.correction}" — spelling errors count under Lexical Resource.`,
    });
  }

  for (const hit of grammarHits) {
    pushFeedback({
      criterion: "GRA",
      band: scores.GRA,
      checkId: `t1.gra.${hit.kind}`,
      severity: "error",
      evidenceSpan: spanOf(raw, hit.start, hit.end),
      feedbackStarter: hit.message,
      fixSuggestion: hit.suggestion,
    });
  }

  for (const hit of bannedHits) {
    pushFeedback({
      criterion: "LR",
      band: scores.LR,
      checkId: `t1.lr.banned${hit.ruleIndex}`,
      severity: hit.advisory ? "upgrade" : "error",
      evidenceSpan: spanOf(raw, hit.start, hit.end),
      feedbackStarter: hit.advisory
        ? `"${hit.match}" is an idiom/quote — informal language lowers Lexical Resource.`
        : `"${hit.match}" is a memorised phrase from the banned list; examiners spot it immediately.`,
      fixSuggestion: "Replace it with a precise, task-specific phrase from the language bank.",
    });
  }

  if (intro.copiedRatio > 0.25 && intro.copiedWords > 0) {
    const run = intro.copiedRuns[0];
    pushFeedback({
      criterion: "TA",
      band: scores.TA,
      checkId: "t1.intro.copy",
      severity: "error",
      evidenceSpan: run ? spanOf(raw, run.start, run.end) : wholeSpan(raw),
      feedbackStarter: `${intro.copiedWords} words of the introduction are copied from the question; copied text is not counted and does not demonstrate paraphrase.`,
      fixSuggestion:
        "Restructure the statement: change the subject/verb order and substitute chart nouns with precise synonyms (keep the chart's own name).",
    });
  }

  if (overview.present) {
    const missingInOverview = overview.matches.filter((match) => !match.matched).slice(0, 2);
    for (const match of missingInOverview) {
      pushFeedback({
        criterion: "TA",
        band: scores.TA,
        checkId: "t1.ta.overview.coverage",
        severity: "upgrade",
        evidenceSpan: spanOf(raw, overview.start, overview.end),
        feedbackStarter: `Your overview does not yet mention this key feature: ${match.description}.`,
        fixSuggestion:
          "Add it to the \"Overall,\" sentence without quoting figures — name the pattern, not the data.",
      });
    }
  }

  if (cohesion.functions.length < 2 && words >= 100) {
    pushFeedback({
      criterion: "CC",
      band: scores.CC,
      checkId: "t1.cc.linkerUnderuse",
      severity: "upgrade",
      evidenceSpan: wholeSpan(raw),
      feedbackStarter:
        "The report uses almost no linking devices, so the progression between sentences is left to the reader.",
      fixSuggestion:
        "Add contrast/similarity links (\"while\", \"compared with\", \"similarly\") between the two bodies.",
    });
  } else if (cohesion.functions.length < 4 && words >= 120) {
    pushFeedback({
      criterion: "CC",
      band: scores.CC,
      checkId: "t1.cc.linkerRange",
      severity: "upgrade",
      evidenceSpan: wholeSpan(raw),
      feedbackStarter: `Cohesive devices cluster on ${cohesion.functions.join(" and ")} — band 8+ varies the function, not just the word.`,
      fixSuggestion:
        "Add a result link (\"as a result\", \"therefore\") or a stress link (\"in particular\") where it is genuinely needed.",
    });
  }

  if (range.repeatedTerms.length > 0) {
    const top = range.repeatedTerms[0];
    pushFeedback({
      criterion: "LR",
      band: scores.LR,
      checkId: "t1.lr.repetition",
      severity: "upgrade",
      evidenceSpan: wholeSpan(raw),
      feedbackStarter: `"${top.term}" appears ${top.count} times, which limits lexical flexibility at band 8+.`,
      fixSuggestion:
        "Vary referring expressions: \"the figure for X\", \"X's share\", \"the number of X\", or a trend synonym.",
    });
  }

  /* --- dedupe + order feedback --- */
  const seen = new Set<string>();
  const deduped: FeedbackItem[] = [];
  for (const entry of feedback) {
    const key = `${entry.checkId}:${entry.evidenceSpan.startChar}:${entry.evidenceSpan.endChar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }
  const severityRank: Record<FeedbackItem["severity"], number> = {
    cap: 0,
    error: 1,
    upgrade: 2,
  };
  const criterionRank: Record<string, number> = { TA: 0, TR: 1, CC: 2, LR: 3, GRA: 4 };
  deduped.sort(
    (a, b) =>
      (criterionRank[a.criterion] ?? 9) - (criterionRank[b.criterion] ?? 9) ||
      severityRank[a.severity] - severityRank[b.severity] ||
      a.evidenceSpan.startChar - b.evidenceSpan.startChar,
  );

  return {
    task: 1,
    itemId: item.specId,
    words,
    netWords,
    paragraphCount: paragraphs.length,
    overview: {
      present: overview.present,
      coverage: overview.coverage,
      totalFeatures: features.length,
      paragraphIndex: overview.paragraphIndex,
    },
    scores,
    overallBand,
    caps,
    checks: [...capChecks, ...analyticChecks],
    feedback: deduped,
  };
}
