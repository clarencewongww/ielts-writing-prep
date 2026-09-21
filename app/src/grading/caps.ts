/**
 * Task 1 score caps (dossier §9.6 + §10.3). Each cap is a hard override applied
 * after the base bands are averaged:
 *
 *  - no overview → TA ≤ 5; overview attempted but vague / split → TA ≤ 6
 *  - fewer than 4 paragraphs or fewer than 2 bodies → CC ≤ 5
 *  - mechanical "Firstly / Secondly" paragraphing → CC ≤ 6
 *  - over-use of sentence-initial linkers → CC ≤ 6
 *  - under 150 net words → TA ≤ 5
 *  - opinion or conclusion detected in a factual report → TA ≤ 6
 *  - body sentences without figures (not process) → TA ≤ 5 when most lack data
 *
 * Every fired cap yields both a `DeterministicCheck` and a `FeedbackItem` whose
 * evidence span points into the submitted text.
 */

import type { Criterion, DeterministicCheck, FeedbackItem } from "../types/grading";
import type { Task1Item } from "../types/bank";
import type { CohesionAnalysis, LinkerHit, ParagraphSpan } from "./cohesion";
import type {
  DataPerSentenceResult,
  FeaturePlacement,
  IntroAnalysis,
  OpinionHit,
  OverviewAnalysis,
} from "./deterministic";

export interface GradeCap {
  criterion: Criterion;
  /** The band the criterion may not exceed. */
  cap: number;
  checkId: string;
  reason: string;
  /** Matches `scorer.CapRecord.evidence` so the report layer can reuse caps directly. */
  evidence: FeedbackItem["evidenceSpan"];
}

export interface ParagraphShape {
  paragraphCount: number;
  intro: ParagraphSpan | null;
  overview: ParagraphSpan | null;
  bodies: ParagraphSpan[];
  conclusion: ParagraphSpan | null;
  hasConclusion: boolean;
}

export function analyzeParagraphShape(
  paragraphs: readonly ParagraphSpan[],
  overview: OverviewAnalysis,
  conclusionHits: readonly LinkerHit[],
): ParagraphShape {
  const intro = paragraphs[0] ?? null;
  const overviewParagraph =
    overview.present && overview.paragraphIndex >= 0
      ? paragraphs[overview.paragraphIndex] ?? null
      : null;
  const bodies = paragraphs.filter(
    (paragraph) => paragraph !== intro && paragraph !== overviewParagraph,
  );
  const conclusion = conclusionHits.length > 0
    ? paragraphs[conclusionHits[0].paragraphIndex] ?? null
    : null;
  return {
    paragraphCount: paragraphs.length,
    intro,
    overview: overviewParagraph,
    bodies,
    conclusion,
    hasConclusion: conclusionHits.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Inputs / outputs                                                    */
/* ------------------------------------------------------------------ */

export interface Task1CapInput {
  item: Task1Item;
  text: string;
  words: number;
  netWords: number;
  paragraphs: readonly ParagraphSpan[];
  cohesion: CohesionAnalysis;
  overview: OverviewAnalysis;
  intro: IntroAnalysis;
  data: DataPerSentenceResult;
  opinionHits: readonly OpinionHit[];
  conclusionHits: readonly LinkerHit[];
  featurePlacements: readonly FeaturePlacement[];
}

export interface Task1CapResult {
  caps: GradeCap[];
  checks: DeterministicCheck[];
  feedback: FeedbackItem[];
}

interface CapEvaluation {
  cap: GradeCap | null;
  check: DeterministicCheck;
  feedback: FeedbackItem[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

function paragraphSpan(paragraph: ParagraphSpan | null, text: string): FeedbackItem["evidenceSpan"] {
  return paragraph ? spanOf(text, paragraph.start, paragraph.end) : wholeSpan(text);
}

function fixFromGrouping(item: Task1Item, prefix: string): string {
  const strategy = item.groupingStrategy?.trim();
  return strategy ? `${prefix} ${strategy}` : prefix;
}

function shortFeatureList(item: Task1Item, limit = 3): string {
  return (item.keyFeatures ?? [])
    .slice(0, limit)
    .map((feature) => feature.description)
    .join("; ");
}

/* ------------------------------------------------------------------ */
/* Individual caps                                                     */
/* ------------------------------------------------------------------ */

function evaluateUnderlength(input: Task1CapInput): CapEvaluation {
  const min = input.item.wordTarget?.min ?? 150;
  const fired = input.netWords < min;
  const cap: GradeCap | null = fired
    ? {
        criterion: "TA",
        cap: 5,
        checkId: "t1.ta.underlength",
        reason: `Fewer than ${min} words after copied question text is removed.`,
        evidence: wholeSpan(input.text),
      }
    : null;
  const check: DeterministicCheck = {
    id: "t1.ta.underlength",
    label: `Word count ≥ ${min} (IELTS counting rules)`,
    task: 1,
    passed: !fired,
    observed: `${input.netWords} net words (${input.words} gross; minimum ${min})`,
    cap: "TA",
    severity: "cap",
    detail: fired
      ? "Short responses are treated as underdeveloped: Task Achievement is capped at band 5."
      : "Word count is at or above the minimum.",
  };
  const feedback: FeedbackItem[] = fired
    ? [
        {
          criterion: "TA",
          band: 5,
          checkId: "t1.ta.underlength",
          severity: "cap",
          evidenceSpan: wholeSpan(input.text),
          feedbackStarter: `Your answer is ${input.netWords} words after copied question text is excluded — below the ${min}-word minimum, so Task Achievement is capped at band 5.`,
          fixSuggestion:
            "Aim for 170–190 words: add the missing key features to the overview and one extra figure per body sentence rather than padding existing sentences.",
        },
      ]
    : [];
  return { cap, check, feedback };
}

function evaluateOverview(input: Task1CapInput): CapEvaluation[] {
  const evaluations: CapEvaluation[] = [];
  const { overview, item, text } = input;
  const minFeatures = 2;

  /* no overview at all → TA ≤ 5 */
  {
    const fired = !overview.present;
    evaluations.push({
      cap: fired
        ? {
            criterion: "TA",
            cap: 5,
            checkId: "t1.ta.overview.missing",
            reason: "No overview paragraph was found.",
            evidence: paragraphSpan(input.paragraphs[0] ?? null, text),
          }
        : null,
      check: {
        id: "t1.ta.overview.missing",
        label: "Overview paragraph present",
        task: 1,
        passed: !fired,
        observed: fired
          ? "No paragraph or sentence opened with Overall / In general, and paragraph 2 was not data-free."
          : `Overview detected in paragraph ${overview.paragraphIndex + 1} (${overview.detectedBy}).`,
        cap: "TA",
        severity: "cap",
        detail: fired
          ? "No overview caps Task Achievement at band 5 (band 6 = attempted, 7 = clear)."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "TA",
              band: 5,
              checkId: "t1.ta.overview.missing",
              severity: "cap",
              evidenceSpan: paragraphSpan(input.paragraphs[0] ?? null, text),
              feedbackStarter:
                "There is no overview, so the main trends are never collected in one place — Task Achievement cannot exceed band 5.",
              fixSuggestion: fixFromGrouping(
                item,
                "Add a second paragraph starting \"Overall,\" that names the highest/lowest and biggest change:",
              ),
            },
          ]
        : [],
    });
  }

  /* vague overview (attempted but <2 key features) → TA ≤ 6 */
  {
    const fired = overview.present && overview.coverage < minFeatures;
    evaluations.push({
      cap: fired
        ? {
            criterion: "TA",
            cap: 6,
            checkId: "t1.ta.overview.vague",
            reason: `The overview names ${overview.coverage} key feature(s); a clear overview needs at least ${minFeatures}.`,
            evidence: spanOf(text, overview.start, overview.end),
          }
        : null,
      check: {
        id: "t1.ta.overview.vague",
        label: "Overview covers ≥ 2 key features",
        task: 1,
        passed: !fired,
        observed: `${overview.coverage} key feature(s) named in the overview`,
        cap: "TA",
        severity: "cap",
        detail: fired
          ? "An attempted but vague overview is a band 6 feature; band 7 needs a clear overview of the main trends."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "TA",
              band: 6,
              checkId: "t1.ta.overview.vague",
              severity: "cap",
              evidenceSpan: spanOf(text, overview.start, overview.end),
              feedbackStarter: `Your overview is attempted but vague — it names ${overview.coverage === 0 ? "no" : `only ${overview.coverage}`} of the key features, so it reads as band 6 rather than band 7.`,
              fixSuggestion: fixFromGrouping(
                item,
                `Add the missing features: ${shortFeatureList(item)}.`,
              ),
            },
          ]
        : [],
    });
  }

  /* features split across paragraphs → TA ≤ 6 */
  {
    const overviewIndex = overview.paragraphIndex;
    const bodyFeatureParagraphs = new Set(
      input.featurePlacements
        .filter(
          (placement) =>
            placement.matched &&
            placement.paragraphIndex > 0 &&
            placement.paragraphIndex !== overviewIndex,
        )
        .map((placement) => placement.paragraphIndex),
    );
    const fired =
      overview.present &&
      (overview.markerParagraphs.length >= 2 ||
        (overview.detectedBy === "paragraph2" &&
          overview.coverage < minFeatures &&
          bodyFeatureParagraphs.size >= 2));
    const reason = overview.markerParagraphs.length >= 2
      ? `Overview openers appear in paragraphs ${overview.markerParagraphs.map((i) => i + 1).join(" and ")}.`
      : "Key features are first named in separate body paragraphs instead of one overview.";
    evaluations.push({
      cap: fired
        ? {
            criterion: "TA",
            cap: 6,
            checkId: "t1.ta.overview.split",
            reason,
            evidence: spanOf(text, overview.start, overview.end),
          }
        : null,
      check: {
        id: "t1.ta.overview.split",
        label: "Key features collected in one overview",
        task: 1,
        passed: !fired,
        observed: fired
          ? reason
          : "Key features are collected in a single overview.",
        cap: "TA",
        severity: "cap",
        detail: fired
          ? "Splitting the key features across paragraphs caps Task Achievement at band 6."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "TA",
              band: 6,
              checkId: "t1.ta.overview.split",
              severity: "cap",
              evidenceSpan: spanOf(text, overview.start, overview.end),
              feedbackStarter:
                "The key features are spread across the report — collect them in one overview so the examiner sees them together.",
              fixSuggestion: fixFromGrouping(
                item,
                "Move every high/low/biggest-change statement into the \"Overall,\" paragraph:",
              ),
            },
          ]
        : [],
    });
  }

  return evaluations;
}

function evaluateParagraphing(input: Task1CapInput): CapEvaluation[] {
  const shape = analyzeParagraphShape(input.paragraphs, input.overview, input.conclusionHits);
  const evaluations: CapEvaluation[] = [];

  /* no-paras: fewer than 4 paragraphs → CC ≤ 5 */
  {
    const fired = shape.paragraphCount < 4;
    evaluations.push({
      cap: fired
        ? {
            criterion: "CC",
            cap: 5,
            checkId: "t1.cc.paragraphs",
            reason: `Only ${shape.paragraphCount} paragraph(s); Task 1 needs introduction + overview + 2 bodies.`,
            evidence: wholeSpan(input.text),
          }
        : null,
      check: {
        id: "t1.cc.paragraphs",
        label: "Four paragraphs (intro + overview + 2 bodies)",
        task: 1,
        passed: !fired,
        observed: `${shape.paragraphCount} paragraph(s)`,
        cap: "CC",
        severity: "cap",
        detail: fired
          ? "Fewer than four paragraphs is a paragraphing failure: Coherence & Cohesion is capped at band 5."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "CC",
              band: 5,
              checkId: "t1.cc.paragraphs",
              severity: "cap",
              evidenceSpan: wholeSpan(input.text),
              feedbackStarter: `Your report reads as ${shape.paragraphCount} paragraph(s); the required shape is introduction, overview and two body paragraphs.`,
              fixSuggestion:
                "Split the text with blank lines: paraphrase the prompt, then \"Overall, …\", then one body per grouping.",
            },
          ]
        : [],
    });
  }

  /* single-body: fewer than 2 bodies → CC ≤ 5 */
  {
    const fired = shape.bodies.length < 2;
    evaluations.push({
      cap: fired
        ? {
            criterion: "CC",
            cap: 5,
            checkId: "t1.cc.bodies",
            reason: `Only ${shape.bodies.length} body paragraph(s); Task 1 needs two (never one).`,
            evidence: paragraphSpan(shape.bodies[0] ?? null, input.text),
          }
        : null,
      check: {
        id: "t1.cc.bodies",
        label: "Two body paragraphs",
        task: 1,
        passed: !fired,
        observed: `${shape.bodies.length} body paragraph(s)`,
        cap: "CC",
        severity: "cap",
        detail: fired
          ? "One body paragraph (or none) caps Coherence & Cohesion at band 5."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "CC",
              band: 5,
              checkId: "t1.cc.bodies",
              severity: "cap",
              evidenceSpan: paragraphSpan(shape.bodies[0] ?? null, input.text),
              feedbackStarter:
                "There is only one body paragraph, so the detail has no logical second group.",
              fixSuggestion: fixFromGrouping(
                input.item,
                "Split the detail into two bodies:",
              ),
            },
          ]
        : [],
    });
  }

  /* mechanical Firstly/Secondly → CC ≤ 6 */
  {
    const mechanical = input.cohesion.mechanical;
    const fired = mechanical.mechanical;
    evaluations.push({
      cap: fired
        ? {
            criterion: "CC",
            cap: 6,
            checkId: "t1.cc.mechanical",
            reason: mechanical.note,
            evidence: mechanical.evidence[0]
              ? spanOf(input.text, mechanical.evidence[0].start, mechanical.evidence[0].end)
              : wholeSpan(input.text),
          }
        : null,
      check: {
        id: "t1.cc.mechanical",
        label: "Linkers not mechanical (Firstly / Secondly every paragraph)",
        task: 1,
        passed: !fired,
        observed: mechanical.note,
        cap: "CC",
        severity: "cap",
        detail: fired
          ? "Mechanical listing linkers hurt band 7+: cohesive devices must be used flexibly."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "CC",
              band: 6,
              checkId: "t1.cc.mechanical",
              severity: "cap",
              evidenceSpan: mechanical.evidence[0]
                ? spanOf(input.text, mechanical.evidence[0].start, mechanical.evidence[0].end)
                : wholeSpan(input.text),
              feedbackStarter: `Your paragraphs open with "${mechanical.evidence.map((hit) => hit.linker).join("\" / \"")}", which reads as mechanical at band 7+.`,
              fixSuggestion:
                "Replace the openers with content-based links: \"In contrast,\" / \"Similarly,\" / \"By 2020,\" — or start directly with the data.",
            },
          ]
        : [],
    });
  }

  /* initial-linker over-use → CC ≤ 6 */
  {
    const ratio = input.cohesion.initialRatio;
    const total = input.cohesion.sentences.length;
    const initial = input.cohesion.initialSentences;
    const fired = total >= 4 && ratio > 0.5;
    evaluations.push({
      cap: fired
        ? {
            criterion: "CC",
            cap: 6,
            checkId: "t1.cc.initialRatio",
            reason: `${initial} of ${total} sentences begin with a linker (${Math.round(ratio * 100)}%).`,
            evidence: wholeSpan(input.text),
          }
        : null,
      check: {
        id: "t1.cc.initialRatio",
        label: "Sentence-initial linkers ≤ 50% of sentences",
        task: 1,
        passed: !fired,
        observed: `${initial}/${total} sentences open with a linker (${Math.round(ratio * 100)}%)`,
        cap: "CC",
        severity: "cap",
        detail: fired
          ? "Over-use of cohesive devices is a band 6 feature."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "CC",
              band: 6,
              checkId: "t1.cc.initialRatio",
              severity: "cap",
              evidenceSpan: wholeSpan(input.text),
              feedbackStarter: `${initial} of ${total} sentences begin with a linker — the cohesion is over-signposted.`,
              fixSuggestion:
                "Let data sentences start with the subject (\"The UK figure…\") and keep linkers for genuine contrasts.",
            },
          ]
        : [],
    });
  }

  return evaluations;
}

function evaluateFormat(input: Task1CapInput): CapEvaluation[] {
  const evaluations: CapEvaluation[] = [];

  /* opinion detected → TA ≤ 6 */
  {
    const hit = input.opinionHits[0];
    const fired = Boolean(hit);
    evaluations.push({
      cap: fired
        ? {
            criterion: "TA",
            cap: 6,
            checkId: "t1.ta.opinion",
            reason: `Opinion language detected: "${hit!.match}".`,
            evidence: hit ? spanOf(input.text, hit.start, hit.end) : wholeSpan(input.text),
          }
        : null,
      check: {
        id: "t1.ta.opinion",
        label: "No opinion in a factual report",
        task: 1,
        passed: !fired,
        observed: fired ? `"${hit!.match}"` : "No opinion language detected.",
        cap: "TA",
        severity: "cap",
        detail: fired
          ? "Task 1 is a factual report; opinion costs Task Achievement marks."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "TA",
              band: 6,
              checkId: "t1.ta.opinion",
              severity: "cap",
              evidenceSpan: spanOf(input.text, hit!.start, hit!.end),
              feedbackStarter: `"${hit!.match}" adds an opinion, but Task 1 only reports the data — this holds Task Achievement at band 6.`,
              fixSuggestion:
                "Replace evaluative language with neutral description (\"the highest figure\", \"the sharpest rise\").",
            },
          ]
        : [],
    });
  }

  /* conclusion detected → TA ≤ 6 (+ CC note) */
  {
    const hit = input.conclusionHits[0];
    const fired = Boolean(hit);
    evaluations.push({
      cap: fired
        ? {
            criterion: "TA",
            cap: 6,
            checkId: "t1.ta.conclusion",
            reason: `Conclusion opener detected: "${hit!.linker}".`,
            evidence: hit ? spanOf(input.text, hit.start, hit.end) : wholeSpan(input.text),
          }
        : null,
      check: {
        id: "t1.ta.conclusion",
        label: "No conclusion in Task 1",
        task: 1,
        passed: !fired,
        observed: fired ? `"${hit!.linker}"` : "No conclusion opener detected.",
        cap: "TA",
        severity: "cap",
        detail: fired
          ? "Task 1 needs an overview, not a conclusion; a conclusion paragraph wastes words."
          : undefined,
      },
      feedback: fired
        ? [
            {
              criterion: "TA",
              band: 6,
              checkId: "t1.ta.conclusion",
              severity: "cap",
              evidenceSpan: spanOf(input.text, hit!.start, hit!.end),
              feedbackStarter: `Task 1 does not need a conclusion — "${hit!.linker}" repeats material already covered and holds Task Achievement at band 6.`,
              fixSuggestion:
                "Delete the conclusion paragraph and fold any new key feature into the overview.",
            },
            {
              criterion: "CC",
              band: 6,
              checkId: "t1.cc.conclusion",
              severity: "upgrade",
              evidenceSpan: spanOf(input.text, hit!.start, hit!.end),
              feedbackStarter:
                "The closing paragraph reads as an essay conclusion; a report ends with the second body.",
              fixSuggestion: "End the report after the second body paragraph.",
            },
          ]
        : [],
    });
  }

  return evaluations;
}

function evaluateDataSupport(input: Task1CapInput): CapEvaluation {
  const { data } = input;
  const fired = data.applicable && data.total > 0 && data.ratio < 0.5;
  const firstDataFree = data.dataFree[0];
  const cap: GradeCap | null = fired
    ? {
        criterion: "TA",
        cap: 5,
        checkId: "t1.ta.data",
        reason: `${data.total - data.withData} of ${data.total} body sentences carry no figure or date.`,
        evidence: firstDataFree
          ? spanOf(input.text, firstDataFree.span.start, firstDataFree.span.end)
          : wholeSpan(input.text),
      }
    : null;
  const check: DeterministicCheck = {
    id: "t1.ta.data",
    label: "Every body sentence carries a figure or date",
    task: 1,
    passed: !fired,
    observed: data.applicable
      ? `${data.withData}/${data.total} body sentences carry data`
      : (data.exemptReason ?? "not applicable"),
    cap: "TA",
    severity: "cap",
    detail: fired
      ? "When most body sentences lack data the report is underdeveloped: Task Achievement is capped at band 5."
      : undefined,
  };
  const feedback: FeedbackItem[] = fired
    ? [
        {
          criterion: "TA",
          band: 5,
          checkId: "t1.ta.data",
          severity: "cap",
          evidenceSpan: firstDataFree
            ? spanOf(input.text, firstDataFree.span.start, firstDataFree.span.end)
            : wholeSpan(input.text),
          feedbackStarter: `${data.total - data.withData} of your ${data.total} body sentences carry no number or date, so the data does not support the description.`,
          fixSuggestion: fixFromGrouping(
            input.item,
            "Add the exact figure or year to each body sentence:",
          ),
        },
      ]
    : [];
  return { cap, check, feedback };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function evaluateTask1Caps(input: Task1CapInput): Task1CapResult {
  const evaluations: CapEvaluation[] = [
    evaluateUnderlength(input),
    ...evaluateOverview(input),
    ...evaluateParagraphing(input),
    ...evaluateFormat(input),
    evaluateDataSupport(input),
  ];

  const caps: GradeCap[] = [];
  const checks: DeterministicCheck[] = [];
  const feedback: FeedbackItem[] = [];
  for (const evaluation of evaluations) {
    if (evaluation.cap) caps.push(evaluation.cap);
    checks.push(evaluation.check);
    feedback.push(...evaluation.feedback);
  }
  return { caps, checks, feedback };
}
