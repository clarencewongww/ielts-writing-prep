/**
 * Task 2 grader — dossier §9 (criteria + caps) and §10 (evidence-span feedback).
 *
 * `gradeTask2(item, text)` is deterministic: the same submission always produces
 * the same bands, checks and feedback. It layers three things:
 *
 *   1. `analyzeTask2` measures the text (paragraphing, position, coverage,
 *      lexical/grammar signals, nearest model answer);
 *   2. the rubric tables in `rubric.ts` pick a band per criterion (8 → 7 → 6 → 5);
 *   3. the deterministic caps in this file are applied afterwards via
 *      `scorer.capCriteria` — a no-conclusion essay can never show TR > 5,
 *      whatever the rubric said.
 *
 * Feedback items carry exact character offsets (dossier §10.2) and are reduced to
 * at most one per failed gate, ordered TR caps → paragraphing → density → range.
 */

import { findCopiedRuns } from "../data/wordCount";
import type { EvidenceSpan, Task2Family, Task2Item } from "../types/bank";
import type { Criterion, CriterionBand, DeterministicCheck, FeedbackItem, TaskGrade } from "../types/grading";
import { prioritizeFeedback } from "./feedback";
import {
  complexSentenceStats,
  detectGrammarErrors,
  detectPunctuationIssues,
  errorFreeStats,
  splitParagraphs,
  splitSentences,
  type GrammarHit,
} from "./grammar";
import {
  contentWords,
  detectBannedPhrases,
  detectContractions,
  detectInformal,
  detectMisspellings,
  detectPunctuation,
  detectUncountables,
  repetitionReport,
  type LexicalHit,
  type SpellingHit,
} from "./lexical";
import { nearestModel, type IdeaGroup, type NearestModelResult } from "./nearestModel";
import { bandFromRubric, evaluateRubric, type RubricCheckRow, type Task2Criterion } from "./rubric";
import { capCriteria, scoreTask, type CapRecord } from "./scorer";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ParagraphInfo {
  index: number;
  kind: "intro" | "body" | "conclusion" | "other";
  text: string;
  startChar: number;
  endChar: number;
  words: number;
  sentences: number;
  firstSentence: string;
  /** First sentence looks like a topic sentence (≥ 5 words). */
  topicSentence: boolean;
  supportMarkers: number;
}

export interface PositionAnalysis {
  required: boolean;
  explicit: boolean;
  /** Strong first-person marker appears only in the conclusion. */
  onlyInConclusion: boolean;
  fenceSitting: boolean;
  consistent: boolean;
  stance: "for" | "against" | "balanced" | "none";
  markersInIntro: string[];
  markersInBody: string[];
  markersInConclusion: string[];
  quantified: boolean;
}

export interface CoveragePart {
  id: string;
  label: string;
  covered: boolean;
  evidence?: string;
}

export interface QuestionCoverage {
  questionCount: number;
  parts: CoveragePart[];
  complete: boolean;
  halfAnswered: boolean;
}

export interface ConclusionAnalysis {
  present: boolean;
  /** Starts with a recognised conclusion signal. */
  linked: boolean;
  /** `In conclusion` / `To conclude` (strong) rather than `To sum up` (weak). */
  strongLink: boolean;
  /** Jaccard overlap between introduction and conclusion content words (0–1). */
  repetition: number;
  words: number;
}

export interface Task2Metrics {
  words: number;
  netWords: number;
  copiedWords: number;
  characters: number;
  paragraphs: number;
  bodyParagraphs: number;
  sentences: number;
  avgSentenceWords: number;
  avgBodyWords: number;
  paragraphWords: number[];
  complexSentencePct: number;
  subordinators: string[];
  errorFreeRatio: number;
  grammarErrorCount: number;
  errorsPer100Words: number;
  punctuationErrorCount: number;
  ttr: number;
  topRepeatedCount: number;
  avgContentWordLength: number;
  linkerFamilies: string[];
  mechanicalListingCount: number;
  referencingDensity: number;
  bannedHits: number;
  advisoryBannedHits: number;
  contractionHits: number;
  uncountableHits: number;
  informalHits: number;
  spellingHits: number;
  articleHits: number;
  prepositionHits: number;
  agreementHits: number;
  verbFormHits: number;
  supportMarkersTotal: number;
  statementTermOverlap: number;
  seedIdeasCovered: number;
  seedIdeasTotal: number;
}

export interface Task2LexicalHits {
  banned: LexicalHit[];
  contractions: LexicalHit[];
  punctuation: LexicalHit[];
  uncountable: LexicalHit[];
  informal: LexicalHit[];
  spelling: SpellingHit[];
}

export interface Task2Analysis {
  paragraphs: ParagraphInfo[];
  position: PositionAnalysis;
  coverage: QuestionCoverage;
  conclusion: ConclusionAnalysis;
  metrics: Task2Metrics;
  nearest: NearestModelResult;
  ideaGroups: Array<{ label: string; covered: boolean; ideas: readonly string[] }>;
  bodySupport: number[];
  weighingLanguage: boolean;
  reasonLanguage: boolean;
  effectLanguage: boolean;
  lexical: Task2LexicalHits;
  grammarHits: GrammarHit[];
  punctuationHits: GrammarHit[];
}

export interface Task2Scores {
  TR: number;
  CC: number;
  LR: number;
  GRA: number;
}

export interface Task2Grade extends TaskGrade {
  task: 2;
  promptId: string;
  variant: string;
  family: Task2Family;
  opinionRequired: boolean;
  /** Words after excluding runs copied from the prompt (IELTS counting rule). */
  netWords: number;
  paragraphCount: number;
  /** Same values as `criteria`, keyed for parity with 4a's `Task1GradeResult`. */
  scores: Task2Scores;
  /** Caps that fired (even when the rubric band was already below them). */
  caps: CapRecord[];
  /** Caps that actually lowered a criterion. */
  appliedCaps: CapRecord[];
  /** Rubric band before deterministic caps. */
  rawCriteria: CriterionBand[];
  rubricRows: RubricCheckRow[];
  analysis: Task2Analysis;
  nearest: NearestModelResult;
}

/* ------------------------------------------------------------------ */
/* Patterns                                                            */
/* ------------------------------------------------------------------ */

const CONCLUDING_SENTENCE = /^\s*(in conclusion|to conclude|to sum up|in summary|in short|on balance|overall)\b/i;
const STRONG_CONCLUSION = /^\s*(in conclusion|to conclude)\b/i;

const STRONG_POSITION =
  /\b(?:i\s+(?:strongly\s+|firmly\s+|largely\s+|mostly\s+|partly\s+|partially\s+|somewhat\s+|generally\s+|broadly\s+|completely\s+|totally\s+|wholeheartedly\s+)?(?:agree|disagree|believe|think|feel|argue|contend|support|oppose|am\s+convinced)|in\s+my\s+(?:opinion|view)|my\s+(?:opinion|view|position)|from\s+my\s+perspective|personally,?\s+i|i\s+would\s+(?:argue|say|suggest|maintain)|to\s+my\s+mind|i\s+am\s+convinced|i\s+take\s+the\s+view|i\s+am\s+of\s+the\s+opinion)\b/gi;

const FOR_STANCE = /\b(?:agree|agrees|support|supports|in favour|beneficial|positive|advantage|worthwhile|good idea)\b/gi;
const AGAINST_STANCE = /\b(?:disagree|disagrees|oppose|opposes|against|detrimental|negative|drawback|harmful|bad idea)\b/gi;

/** First-person opinion verbs only — used for stance polarity and consistency. */
const OPINION_FOR =
  /\bi\s+(?:strongly\s+|firmly\s+|largely\s+|mostly\s+|partly\s+|partially\s+|somewhat\s+|fully\s+|generally\s+|broadly\s+|also\s+)?(?:agree|support|endorse|favour|favor|accept)\b|\bi\s+am\s+in\s+favour\b|\bmy\s+(?:position|view|opinion)\s+is\s+that\b/gi;
const OPINION_AGAINST =
  /\bi\s+(?:strongly\s+|firmly\s+|largely\s+|mostly\s+|partly\s+|partially\s+|somewhat\s+|generally\s+|broadly\s+|also\s+)?(?:disagree|oppose|reject)\b|\bi\s+cannot\s+(?:support|accept)\b|\bi\s+do\s+not\s+(?:agree|support)\b|\bi\s+am\s+against\b/gi;

const QUANTIFIED_VIEW =
  /\b(?:largely|mostly|partly|partially|somewhat|to\s+some\s+extent|to\s+a\s+(?:large|great|limited|certain)\s+extent|broadly|generally|in\s+most\s+cases|for\s+the\s+most\s+part|on\s+balance|overall)\b/i;

const FENCE_PATTERNS: readonly RegExp[] = [
  /\bi\s+agree\s+with\s+both\b/i,
  /\bagree\s+with\s+both\s+sides\b/i,
  /\bboth\s+sides\s+(?:are|have)\s+(?:valid|merit|equal|advantages)\b/i,
  /\bit\s+depends\b/i,
  /\bcannot\s+(?:fully|completely)\s+agree\b/i,
  /\bi\s+(?:agree|disagree)\s+(?:and|or)\s+disagree\b/i,
  /\bhave\s+both\s+advantages\s+and\s+disadvantages\b/i,
];

const WEIGHING_LANGUAGE =
  /\b(?:outweigh|outweighs|outweighed|outweighing|greater|more\s+significant|stronger|tips?\s+the\s+balance|this\s+matters\s+more|more\s+important\s+than|the\s+main\s+(?:reason|benefit|drawback)|judging\s+by\s+the\s+evidence)\b/i;

const REASON_LANGUAGE =
  /\b(?:because|due\s+to|owing\s+to|since|as\s+a\s+result\s+of|driven\s+by|one\s+(?:reason|factor|cause)|reasons?|factors?|thanks\s+to|stems?\s+from|arises?\s+from)\b/i;

const EFFECT_LANGUAGE =
  /\b(?:problems?|effects?|consequences?|impacts?|leads?\s+to|results?\s+in|creates?|gives?\s+rise\s+to|brings?\s+about)\b/i;

const SUPPORT_MARKERS =
  /\b(because|since|so\s+that|as\s+a\s+result|consequently|therefore|thus|for\s+example|for\s+instance|such\s+as|which\s+means|this\s+means|means\s+that|leads?\s+to|allow(?:s|ed)?|enable(?:s|d)?|thereby|hence|in\s+order\s+to|the\s+result\s+is|due\s+to|owing\s+to|explains?|ensures?|stems?\s+from|comes?\s+from|brings?\s+about|gives?\s+rise\s+to|rather\s+than|tends?\s+to|in\s+turn|because\s+of|where|if|when|while|although)\b/gi;

const REFERENCING = /\b(this|these|it|they|such|which|that)\b/gi;
const MECHANICAL_LISTING = /\b(firstly|secondly|thirdly|lastly)\b/gi;

const ADVANTAGE_PATTERN = /\b(advantage|advantageous|benefit|beneficial|positive|merit|upside|pros?)\b/i;
const DISADVANTAGE_PATTERN = /\b(disadvantage|drawback|negative|downside|demerit|cons?|problem|harmful|risk)\b/i;

const DISCUSSION_SIDE_1 =
  /\b(one\s+(?:view|argument|side|group)|on\s+the\s+one\s+hand|supporters|proponents|advocates|those\s+who\s+(?:support|believe|argue|think))\b/i;
const DISCUSSION_SIDE_2 =
  /\b(on\s+the\s+other\s+hand|opponents|critics|sceptics|skeptics|those\s+who\s+(?:oppose|believe|argue|think)|by\s+contrast|conversely)\b/i;

interface LinkerFamily {
  id: string;
  label: string;
  pattern: RegExp;
}

const LINKER_FAMILIES: readonly LinkerFamily[] = [
  { id: "listing", label: "listing", pattern: /\b(firstly|secondly|thirdly|first of all|lastly|last but not least)\b/gi },
  { id: "adding", label: "adding", pattern: /\b(in addition|additionally|furthermore|moreover|not only)\b/gi },
  { id: "example", label: "examples", pattern: /\b(for example|for instance|such as|namely|to illustrate|in other words|one clear example)\b/gi },
  { id: "result", label: "results", pattern: /\b(as a result|consequently|therefore|thus|hence|for this reason)\b/gi },
  {
    id: "contrast",
    label: "contrast",
    pattern: /\b(however|nevertheless|even though|although|despite|in spite of|on the other hand|by contrast|in comparison|alternatively|yet|admittedly|while|whereas)\b/gi,
  },
  { id: "highlight", label: "highlighting", pattern: /\b(particularly|in particular|specifically|especially|clearly|obviously)\b/gi },
  { id: "reason", label: "reasons", pattern: /\b(because|owing to|due to|since)\b/gi },
  { id: "opinion", label: "opinion", pattern: /\b(in my opinion|i think|i believe|i admit|in my view|i agree|i disagree|i cannot accept)\b/gi },
  { id: "conclusion", label: "conclusion", pattern: /\b(in conclusion|to conclude|to sum up|in summary)\b/gi },
];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function spanOf(text: string, start: number, end: number): EvidenceSpan {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  return { startChar: safeStart, endChar: safeEnd, text: text.slice(safeStart, safeEnd) };
}

function firstMatchSpan(text: string, pattern: RegExp): EvidenceSpan | null {
  const copy = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const match = copy.exec(text);
  if (!match || match.index === undefined) return null;
  return spanOf(text, match.index, match.index + match[0].length);
}

function matchCount(pattern: RegExp, text: string): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return text.match(new RegExp(pattern.source, flags))?.length ?? 0;
}

function countContentOverlap(needle: string, haystack: ReadonlySet<string>): number {
  const unique = new Set(contentWords(needle));
  if (unique.size === 0) return 0;
  let hit = 0;
  for (const word of unique) if (haystack.has(word)) hit += 1;
  return hit / unique.size;
}

/** Reads `seedIdeas` defensively: pro/con or causes/solutions depending on the family. */
export function seedIdeaGroups(item: Task2Item): IdeaGroup[] {
  const seed = item.seedIdeas as unknown as Record<string, string[] | undefined>;
  const groups: IdeaGroup[] = [];
  if (Array.isArray(seed.pro) && seed.pro.length > 0) {
    groups.push({ label: item.family === "discussion" ? "first side" : "arguments for the statement", ideas: seed.pro });
  }
  if (Array.isArray(seed.con) && seed.con.length > 0) {
    groups.push({ label: item.family === "discussion" ? "second side" : "arguments against the statement", ideas: seed.con });
  }
  if (Array.isArray(seed.causes) && seed.causes.length > 0) groups.push({ label: "causes / problems", ideas: seed.causes });
  if (Array.isArray(seed.solutions) && seed.solutions.length > 0) groups.push({ label: "solutions / measures", ideas: seed.solutions });
  return groups;
}

function referenceList(item: Task2Item): Array<{ band: 6 | 7 | 8; text: string }> {
  return item.referenceAnswers
    .filter((answer) => answer.band === 6 || answer.band === 7 || answer.band === 8)
    .map((answer) => ({ band: answer.band, text: answer.text }));
}

function countWords(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

/* ------------------------------------------------------------------ */
/* Paragraphs and structure                                            */
/* ------------------------------------------------------------------ */

function buildParagraphs(text: string): ParagraphInfo[] {
  const spans = splitParagraphs(text);
  const lastIndex = spans.length - 1;
  const lastIsConclusion =
    spans.length >= 2 && (CONCLUDING_SENTENCE.test(spans[lastIndex]?.text.trimStart() ?? "") || spans.length >= 4);

  return spans.map((span, index) => {
    const sentences = splitSentences(span.text);
    const firstSentence = sentences[0]?.text.trim() ?? "";
    return {
      index,
      kind:
        spans.length > 1 && index === 0
          ? "intro"
          : index === lastIndex && lastIsConclusion
            ? "conclusion"
            : spans.length > 1
              ? "body"
              : "other",
      text: span.text,
      startChar: span.startChar,
      endChar: span.endChar,
      words: countWords(span.text),
      sentences: sentences.length,
      firstSentence,
      topicSentence: firstSentence.split(/\s+/).filter(Boolean).length >= 4,
      supportMarkers: matchCount(SUPPORT_MARKERS, span.text),
    } satisfies ParagraphInfo;
  });
}

/* ------------------------------------------------------------------ */
/* Position                                                            */
/* ------------------------------------------------------------------ */

function analysePosition(item: Task2Item, paragraphs: readonly ParagraphInfo[], text: string): PositionAnalysis {
  const markersFor = (kind: ParagraphInfo["kind"]) =>
    paragraphs
      .filter((paragraph) => paragraph.kind === kind)
      .flatMap((paragraph) => paragraph.text.match(new RegExp(STRONG_POSITION.source, "gi")) ?? []);

  const markersInIntro = Array.from(new Set(markersFor("intro")));
  const markersInBody = Array.from(new Set(markersFor("body")));
  const markersInConclusion = Array.from(new Set(markersFor("conclusion")));
  const markerCount = markersInIntro.length + markersInBody.length + markersInConclusion.length;
  const explicit = markerCount > 0;
  const onlyInConclusion = explicit && markersInIntro.length === 0 && markersInBody.length === 0;

  const introText = paragraphs.find((paragraph) => paragraph.kind === "intro")?.text ?? paragraphs[0]?.text ?? text;
  const forCount = matchCount(FOR_STANCE, introText);
  const againstCount = matchCount(AGAINST_STANCE, introText);
  const quantified = QUANTIFIED_VIEW.test(introText);
  const opinionForIntro = matchCount(OPINION_FOR, introText);
  const opinionAgainstIntro = matchCount(OPINION_AGAINST, introText);

  let stance: PositionAnalysis["stance"] = "none";
  if (opinionForIntro > 0 && opinionAgainstIntro > 0) stance = "balanced";
  else if (opinionForIntro > 0) stance = "for";
  else if (opinionAgainstIntro > 0) stance = "against";
  else if (forCount > 0 && againstCount > 0) stance = quantified || WEIGHING_LANGUAGE.test(introText) ? "for" : "balanced";
  else if (forCount > 0) stance = "for";
  else if (againstCount > 0) stance = "against";

  const fenceExplicit = FENCE_PATTERNS.some((pattern) => pattern.test(text));
  const fenceSitting = fenceExplicit || (item.opinionRequired && stance === "balanced" && !quantified);

  const conclusionText = paragraphs.find((paragraph) => paragraph.kind === "conclusion")?.text ?? "";
  const opinionForConclusion = matchCount(OPINION_FOR, conclusionText);
  const opinionAgainstConclusion = matchCount(OPINION_AGAINST, conclusionText);
  let consistent = true;
  if (stance === "for" && opinionForConclusion === 0 && opinionAgainstConclusion > 0) consistent = false;
  if (stance === "against" && opinionAgainstConclusion === 0 && opinionForConclusion > 0) consistent = false;

  return {
    required: item.opinionRequired,
    explicit,
    onlyInConclusion,
    fenceSitting,
    consistent,
    stance,
    markersInIntro,
    markersInBody,
    markersInConclusion,
    quantified,
  };
}

function analyseConclusion(paragraphs: readonly ParagraphInfo[]): ConclusionAnalysis {
  const conclusion = paragraphs.find((paragraph) => paragraph.kind === "conclusion");
  const intro = paragraphs.find((paragraph) => paragraph.kind === "intro");
  const present = Boolean(conclusion) && (conclusion?.sentences ?? 0) >= 1;

  const introWords = new Set(contentWords(intro?.text ?? ""));
  const conclusionWords = new Set(contentWords(conclusion?.text ?? ""));
  let repetition = 0;
  if (introWords.size > 0 && conclusionWords.size > 0) {
    let intersection = 0;
    for (const word of conclusionWords) if (introWords.has(word)) intersection += 1;
    const union = introWords.size + conclusionWords.size - intersection;
    repetition = union === 0 ? 0 : intersection / union;
  }

  const text = conclusion?.text ?? "";
  return {
    present,
    linked: CONCLUDING_SENTENCE.test(text.trimStart()),
    strongLink: STRONG_CONCLUSION.test(text.trimStart()),
    repetition: Number(repetition.toFixed(4)),
    words: conclusion?.words ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Coverage                                                            */
/* ------------------------------------------------------------------ */

interface GroupMatch {
  label: string;
  covered: boolean;
  ideas: readonly string[];
}

function matchGroups(item: Task2Item, text: string): GroupMatch[] {
  const words = new Set(contentWords(text));
  return seedIdeaGroups(item).map((group) => ({
    label: group.label,
    covered: group.ideas.some((idea) => countContentOverlap(idea, words) >= 0.3),
    ideas: group.ideas,
  }));
}

function analyseCoverage(context: {
  item: Task2Item;
  text: string;
  paragraphs: readonly ParagraphInfo[];
  position: PositionAnalysis;
  groups: GroupMatch[];
  bodySupport: number[];
  weighing: boolean;
  reason: boolean;
  effect: boolean;
}): QuestionCoverage {
  const { item, text, paragraphs, position, groups, bodySupport } = context;
  const bodies = paragraphs.filter((paragraph) => paragraph.kind === "body");
  const parts: CoveragePart[] = [];
  const [first, second] = groups;

  if (item.family === "opinion") {
    parts.push({
      id: "position",
      label: "clear position",
      covered: !item.opinionRequired || position.explicit || position.onlyInConclusion,
      evidence: position.markersInIntro[0],
    });
    parts.push({
      id: "argument",
      label: "at least one developed argument",
      covered: bodySupport.some((count) => count >= 1) || groups.some((group) => group.covered),
    });
  } else if (item.family === "discussion") {
    const sideOne = (first?.covered ?? false) || bodies.some((body) => DISCUSSION_SIDE_1.test(body.text));
    const sideTwo = (second?.covered ?? false) || bodies.some((body) => DISCUSSION_SIDE_2.test(body.text));
    parts.push({ id: "side-1", label: first?.label ?? "first side", covered: sideOne });
    parts.push({ id: "side-2", label: second?.label ?? "second side", covered: sideTwo });
    if (item.opinionRequired) {
      parts.push({ id: "opinion", label: "opinion on the discussion", covered: position.explicit && !position.fenceSitting });
    }
  } else if (item.family === "adv-disadv") {
    parts.push({ id: "advantages", label: "advantages", covered: ADVANTAGE_PATTERN.test(text) || (first?.covered ?? false) });
    parts.push({ id: "disadvantages", label: "disadvantages", covered: DISADVANTAGE_PATTERN.test(text) || (second?.covered ?? false) });
    if (item.variant === "C2") parts.push({ id: "weighing", label: "explicit outweighing judgement", covered: context.weighing });
  } else if (item.family === "outweigh-posneg") {
    parts.push({
      id: "position",
      label: item.variant === "D2" ? "chosen evaluation" : "committed verdict",
      covered: item.opinionRequired ? position.explicit && !position.fenceSitting : true,
    });
    if (item.variant === "D2") {
      parts.push({
        id: "development",
        label: "development of the chosen evaluation",
        covered: bodySupport.some((count) => count >= 1) || groups.some((group) => group.covered),
      });
    } else {
      parts.push({ id: "advantages", label: "advantages", covered: (first?.covered ?? false) || ADVANTAGE_PATTERN.test(text) });
      parts.push({ id: "disadvantages", label: "disadvantages", covered: (second?.covered ?? false) || DISADVANTAGE_PATTERN.test(text) });
      parts.push({ id: "weighing", label: "explicit outweighing judgement", covered: context.weighing });
    }
  } else {
    const usesCausesSolutions = groups.some((group) => group.label.includes("causes"));
    if (!usesCausesSolutions) {
      // direct-question variant with pro/con ideas: reasons + evaluation
      parts.push({
        id: "q1",
        label: "reasons for the trend",
        covered: groups.some((group) => group.covered) || context.reason,
      });
      parts.push({ id: "q2", label: "evaluation of the effect", covered: position.explicit && !position.fenceSitting });
    } else {
      parts.push({ id: "q1", label: first?.label ?? "causes / problems", covered: first?.covered ?? context.reason });
      if (item.questionCount >= 3) {
        parts.push({ id: "q2", label: "problems / effects", covered: context.effect });
      }
      parts.push({ id: "q3", label: second?.label ?? "solutions / measures", covered: second?.covered ?? false });
    }
    if (item.opinionRequired && !parts.some((part) => part.id === "q2" && item.questionCount < 3)) {
      parts.push({ id: "opinion", label: "opinion", covered: position.explicit && !position.fenceSitting });
    }
  }

  const complete = parts.every((part) => part.covered);
  return {
    questionCount: item.questionCount,
    parts,
    complete,
    halfAnswered: parts.some((part) => !part.covered),
  };
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

function analyseMetrics(
  item: Task2Item,
  text: string,
  paragraphs: readonly ParagraphInfo[],
  lexical: Task2LexicalHits,
  grammarHits: readonly GrammarHit[],
  punctuationHits: readonly GrammarHit[],
  groups: GroupMatch[],
): Task2Metrics {
  const words = countWords(text);
  const copied = findCopiedRuns(text, `${item.statement} ${item.instruction}`);
  const copiedWords = copied.reduce((total, run) => total + run.words, 0);
  const sentences = splitSentences(text);
  const bodies = paragraphs.filter((paragraph) => paragraph.kind === "body");
  const complex = complexSentenceStats(text);
  const grammar = errorFreeStats(text, grammarHits, Math.max(1, words));
  const punctuation = errorFreeStats(text, punctuationHits, Math.max(1, words));
  const repetition = repetitionReport(text, 1);
  const content = contentWords(text);
  const avgContentWordLength =
    content.length === 0 ? 0 : content.reduce((total, word) => total + word.length, 0) / content.length;

  const statementWords = new Set(contentWords(`${item.statement} ${item.instruction}`));
  const submissionWords = new Set(content);
  let statementHits = 0;
  for (const word of statementWords) if (submissionWords.has(word)) statementHits += 1;

  const linkerFamilies = LINKER_FAMILIES.filter((family) => new RegExp(family.pattern.source, "gi").test(text)).map(
    (family) => family.id,
  );

  return {
    words,
    netWords: Math.max(0, words - copiedWords),
    copiedWords,
    characters: text.length,
    paragraphs: paragraphs.length,
    bodyParagraphs: bodies.length,
    sentences: sentences.length,
    avgSentenceWords: sentences.length === 0 ? 0 : Number((words / sentences.length).toFixed(2)),
    avgBodyWords:
      bodies.length === 0 ? 0 : Number((bodies.reduce((total, body) => total + body.words, 0) / bodies.length).toFixed(2)),
    paragraphWords: paragraphs.map((paragraph) => paragraph.words),
    complexSentencePct: Number(complex.pct.toFixed(4)),
    subordinators: complex.subordinators,
    errorFreeRatio: Number(grammar.errorFreeRatio.toFixed(4)),
    grammarErrorCount: grammarHits.length,
    errorsPer100Words: Number(grammar.errorsPer100Words.toFixed(2)),
    punctuationErrorCount: punctuationHits.length,
    ttr: Number(repetition.ttr.toFixed(4)),
    topRepeatedCount: repetition.topRepeated[0]?.count ?? 0,
    avgContentWordLength: Number(avgContentWordLength.toFixed(3)),
    linkerFamilies,
    mechanicalListingCount: matchCount(MECHANICAL_LISTING, text),
    referencingDensity: words === 0 ? 0 : Number((matchCount(REFERENCING, text) / words).toFixed(4)),
    bannedHits: lexical.banned.filter((hit) => !hit.advisory).length,
    advisoryBannedHits: lexical.banned.filter((hit) => hit.advisory).length,
    contractionHits: lexical.contractions.length,
    uncountableHits: lexical.uncountable.length,
    informalHits: lexical.informal.filter((hit) => hit.severity === "error").length,
    spellingHits: lexical.spelling.length,
    articleHits: grammarHits.filter((hit) => hit.kind === "article").length,
    prepositionHits: grammarHits.filter((hit) => hit.kind === "preposition").length,
    agreementHits: grammarHits.filter((hit) => hit.kind === "agreement").length,
    verbFormHits: grammarHits.filter((hit) => hit.kind === "verb-form" || hit.kind === "word-order").length,
    supportMarkersTotal: paragraphs.reduce((total, paragraph) => total + paragraph.supportMarkers, 0),
    statementTermOverlap: statementWords.size === 0 ? 1 : Number((statementHits / statementWords.size).toFixed(4)),
    seedIdeasCovered: groups.filter((group) => group.covered).length,
    seedIdeasTotal: groups.length,
  };
}

/* ------------------------------------------------------------------ */
/* Full analysis                                                       */
/* ------------------------------------------------------------------ */

/** Full deterministic analysis of a Task 2 submission (exported for tests/report). */
export function analyzeTask2(item: Task2Item, rawText: string): Task2Analysis {
  const text = rawText ?? "";
  const paragraphs = buildParagraphs(text);
  const position = analysePosition(item, paragraphs, text);
  const conclusion = analyseConclusion(paragraphs);
  const groups = matchGroups(item, text);
  const bodySupport = paragraphs.filter((paragraph) => paragraph.kind === "body").map((paragraph) => paragraph.supportMarkers);

  const lexical: Task2LexicalHits = {
    banned: detectBannedPhrases(text, item.bannedPhrases),
    contractions: detectContractions(text),
    punctuation: detectPunctuation(text),
    uncountable: detectUncountables(text),
    informal: detectInformal(text),
    spelling: detectMisspellings(text),
  };
  const grammarHits = detectGrammarErrors(text);
  const punctuationHits = detectPunctuationIssues(text);

  const coverage = analyseCoverage({
    item,
    text,
    paragraphs,
    position,
    groups,
    bodySupport,
    weighing: WEIGHING_LANGUAGE.test(text),
    reason: REASON_LANGUAGE.test(text),
    effect: EFFECT_LANGUAGE.test(text),
  });

  const metrics = analyseMetrics(item, text, paragraphs, lexical, grammarHits, punctuationHits, groups);

  const nearest = nearestModel({ text, references: referenceList(item), ideaGroups: seedIdeaGroups(item) });

  return {
    paragraphs,
    position,
    coverage,
    conclusion,
    metrics,
    nearest,
    ideaGroups: groups,
    bodySupport,
    weighingLanguage: WEIGHING_LANGUAGE.test(text),
    reasonLanguage: REASON_LANGUAGE.test(text),
    effectLanguage: EFFECT_LANGUAGE.test(text),
    lexical,
    grammarHits,
    punctuationHits,
  };
}

/* ------------------------------------------------------------------ */
/* Rubric signals                                                      */
/* ------------------------------------------------------------------ */

export interface RubricSignals {
  pass: Record<string, boolean>;
}

export function buildRubricSignals(analysis: Task2Analysis): RubricSignals {
  const { metrics, coverage, position, conclusion, paragraphs } = analysis;
  const bodies = paragraphs.filter((paragraph) => paragraph.kind === "body");
  const lexicalErrors = metrics.uncountableHits + metrics.spellingHits + metrics.informalHits + metrics.bannedHits;
  const heavyLexical = metrics.bannedHits >= 2 || metrics.uncountableHits >= 3;

  const pass: Record<string, boolean> = {
    // TR
    "tr.parts": coverage.complete && (!position.required || position.explicit),
    "tr.position": position.required ? position.explicit && !position.fenceSitting && position.consistent : true,
    "tr.ideas": bodies.length > 0 && bodies.every((body) => body.words >= 70 && body.supportMarkers >= 2 && body.sentences >= 4),
    "tr.conclusion": conclusion.present && conclusion.repetition < 0.16 && conclusion.strongLink,
    "tr.parts7": coverage.complete,
    "tr.position7": position.required ? position.explicit && !position.fenceSitting : true,
    "tr.ideas7": bodies.length > 0 && bodies.every((body) => body.words >= 50 && body.supportMarkers >= 1),
    "tr.conclusion7": conclusion.present && conclusion.repetition < 0.22,
    "tr.parts6": metrics.words >= 120 && coverage.parts.some((part) => part.covered),
    "tr.position6": !position.fenceSitting && (!position.required || position.explicit),
    "tr.ideas6": bodies.some((body) => body.supportMarkers >= 1),

    // CC
    "cc.paragraphs": (metrics.paragraphs === 4 || metrics.paragraphs === 5) && metrics.bodyParagraphs >= 2 && metrics.bodyParagraphs <= 3,
    "cc.topics": bodies.length > 0 && bodies.every((body) => body.topicSentence && body.words >= 50),
    "cc.cohesion": metrics.mechanicalListingCount < 2 && metrics.referencingDensity >= 0.02,
    "cc.progression":
      metrics.linkerFamilies.includes("contrast") &&
      (metrics.linkerFamilies.includes("result") || metrics.referencingDensity >= 0.035),
    "cc.paragraphs7": metrics.paragraphs >= 3 && metrics.paragraphs <= 6,
    "cc.topics7": bodies.length > 0 && bodies.every((body) => body.topicSentence),
    "cc.cohesion7": metrics.mechanicalListingCount < 3,
    "cc.paragraphs6": metrics.paragraphs >= 3,
    "cc.bodies6": metrics.bodyParagraphs >= 2,
    "cc.links6": metrics.linkerFamilies.length >= 2,

    // LR
    "lr.range": metrics.ttr >= 0.75 && metrics.avgContentWordLength >= 7,
    "lr.precision": metrics.avgContentWordLength >= 7,
    "lr.accuracy": lexicalErrors === 0,
    "lr.nonrestart": metrics.topRepeatedCount <= 6,
    "lr.range7": metrics.ttr >= 0.72,
    "lr.accuracy7": lexicalErrors <= 1 && !heavyLexical,
    "lr.nonrestart7": metrics.topRepeatedCount <= 8,
    "lr.range6": metrics.ttr >= 0.58,
    "lr.accuracy6": lexicalErrors <= 3,

    // GRA
    "gra.complex": metrics.complexSentencePct >= 0.4,
    "gra.variety": metrics.subordinators.length >= 3,
    "gra.errorfree": metrics.errorFreeRatio >= 0.8 && metrics.grammarErrorCount <= 1,
    "gra.punctuation": metrics.punctuationErrorCount === 0,
    "gra.complex7": metrics.complexSentencePct >= 0.28,
    "gra.errorfree7": metrics.errorFreeRatio >= 0.6,
    "gra.punctuation7": metrics.punctuationErrorCount <= 1,
    "gra.complex6": metrics.complexSentencePct >= 0.15,
    "gra.errorfree6": metrics.errorFreeRatio >= 0.4,
  };

  return { pass };
}

/* ------------------------------------------------------------------ */
/* Grade assembly                                                      */
/* ------------------------------------------------------------------ */

interface CapInput {
  checkId: string;
  criterion: Criterion;
  cap: number;
  label: string;
  observed: string;
  reason: string;
  severity: "cap" | "error" | "upgrade";
  evidence: EvidenceSpan;
  feedbackStarter: string;
  fixSuggestion: string;
  failed: boolean;
}

function firstWords(text: string, count = 6): string {
  return text.trim().split(/\s+/).slice(0, count).join(" ");
}

function rubricSummary(criterion: Task2Criterion, analysis: Task2Analysis): string {
  switch (criterion) {
    case "TR":
      return `${analysis.coverage.parts.filter((part) => part.covered).length}/${analysis.coverage.parts.length} parts · ${
        analysis.position.required ? (analysis.position.explicit ? "position explicit" : "position missing") : "no opinion required"
      }`;
    case "CC":
      return `${analysis.metrics.paragraphs} paragraphs · linkers: ${analysis.metrics.linkerFamilies.join(", ") || "none"}`;
    case "LR":
      return `TTR ${analysis.metrics.ttr} · ${analysis.metrics.bannedHits} banned · ${analysis.metrics.spellingHits} spelling`;
    case "GRA":
      return `${(analysis.metrics.complexSentencePct * 100).toFixed(0)}% complex · ${(analysis.metrics.errorFreeRatio * 100).toFixed(0)}% error-free`;
    default:
      return "";
  }
}

/** Deterministic grade for one Task 2 submission. */
export function gradeTask2(item: Task2Item, rawText: string): Task2Grade {
  const text = rawText ?? "";
  const analysis = analyzeTask2(item, text);
  const { metrics, coverage, position, conclusion, paragraphs, lexical } = analysis;
  const checks: DeterministicCheck[] = [];
  const caps: CapRecord[] = [];
  const rawFeedback: FeedbackItem[] = [];

  const addCheck = (check: {
    id: string;
    label: string;
    passed: boolean;
    observed?: string;
    cap?: Criterion;
    severity?: "cap" | "error" | "upgrade";
    detail?: string;
  }) => {
    checks.push({ task: 2, ...check });
  };

  const addCap = (input: CapInput) => {
    if (input.failed) {
      caps.push({
        checkId: input.checkId,
        criterion: input.criterion,
        cap: input.cap,
        reason: input.reason,
        evidence: input.evidence,
      });
      rawFeedback.push({
        criterion: input.criterion,
        band: input.cap,
        checkId: input.checkId,
        severity: input.severity === "upgrade" ? "upgrade" : "cap",
        evidenceSpan: input.evidence,
        feedbackStarter: input.feedbackStarter,
        fixSuggestion: input.fixSuggestion,
      });
    }
    addCheck({
      id: input.checkId,
      label: input.label,
      passed: !input.failed,
      observed: input.observed,
      cap: input.criterion,
      severity: input.severity,
      detail: input.failed ? input.reason : undefined,
    });
  };

  const addUpgrade = (
    checkId: string,
    criterion: Criterion,
    band: number,
    label: string,
    observed: string,
    evidence: EvidenceSpan,
    feedbackStarter: string,
    fixSuggestion: string,
  ) => {
    addCheck({ id: checkId, label, passed: false, observed, severity: "upgrade" });
    rawFeedback.push({ criterion, band, checkId, severity: "upgrade", evidenceSpan: evidence, feedbackStarter, fixSuggestion });
  };

  const lastParagraph = paragraphs[paragraphs.length - 1];
  const conclusionParagraph = paragraphs.find((paragraph) => paragraph.kind === "conclusion") ?? null;
  const bodies = paragraphs.filter((paragraph) => paragraph.kind === "body");

  const lastSentenceSpan = (): EvidenceSpan => {
    if (!lastParagraph) return spanOf(text, 0, Math.min(text.length, 1));
    const sentences = splitSentences(lastParagraph.text);
    const finalSentence = sentences[sentences.length - 1];
    return finalSentence
      ? spanOf(text, lastParagraph.startChar + finalSentence.startChar, lastParagraph.startChar + finalSentence.endChar)
      : spanOf(text, lastParagraph.startChar, lastParagraph.endChar);
  };

  const conclusionSpan = conclusionParagraph
    ? spanOf(text, conclusionParagraph.startChar, conclusionParagraph.endChar)
    : lastParagraph
      ? spanOf(text, lastParagraph.startChar, lastParagraph.endChar)
      : spanOf(text, 0, 0);
  const introSpan = paragraphs[0] ? spanOf(text, paragraphs[0].startChar, paragraphs[0].endChar) : spanOf(text, 0, 0);

  /* ---------------- 1. word count ---------------- */
  const minimum = item.wordTarget?.min ?? 250;
  const ceiling = item.wordTarget?.hardCeiling ?? 300;
  const tooShort = metrics.words < minimum;
  addCap({
    checkId: "t2.words.min",
    criterion: "TR",
    cap: 5,
    label: "Word-count minimum",
    observed: `${metrics.words} words (minimum ${minimum})${metrics.copiedWords > 0 ? `, ${metrics.copiedWords} copied from the prompt` : ""}`,
    reason: tooShort
      ? `Only ${metrics.words} words: under-length answers cannot develop ideas, so Task Response is capped at band 5.`
      : "Meets the 250-word minimum.",
    severity: "cap",
    evidence: spanOf(text, 0, Math.min(text.length, 120)),
    feedbackStarter: `Your response is ${metrics.words} words — ${Math.max(0, minimum - metrics.words)} below the ${minimum}-word minimum.`,
    fixSuggestion: "Develop one more supporting point (reason → consequence → example) instead of padding with general statements.",
    failed: tooShort,
  });

  addCap({
    checkId: "t2.words.ceiling",
    criterion: "TR",
    cap: 8,
    label: "Word-count ceiling",
    observed: `${metrics.words} words (ceiling ${ceiling})`,
    reason: metrics.words > ceiling ? `Over the ${ceiling}-word ceiling: trim unfocused sentences.` : "Within the ceiling.",
    severity: "upgrade",
    evidence: spanOf(text, 0, Math.min(text.length, 120)),
    feedbackStarter: `Your response is ${metrics.words} words — above the ${ceiling}-word ceiling, where extra length usually adds unfocused ideas and errors.`,
    fixSuggestion: "Cut any sentence that neither supports the position nor answers a question part.",
    failed: metrics.words > ceiling,
  });

  addCheck({
    id: "t2.words.copied",
    label: "No question text copied",
    passed: metrics.copiedWords === 0,
    observed: metrics.copiedWords === 0 ? "no copied runs" : `${metrics.copiedWords} copied words (excluded from the count)`,
    cap: "TR",
    severity: "upgrade",
    detail: "Copied question wording is not counted by the examiner; it can hide an under-length answer.",
  });

  /* ---------------- 2. structure ---------------- */
  addCap({
    checkId: "t2.structure.conclusion",
    criterion: "TR",
    cap: 5,
    label: "Conclusion present",
    observed: conclusion.present ? "conclusion paragraph found" : "no conclusion paragraph",
    reason: conclusion.present ? "Conclusion present." : "No conclusion: Task Response cannot exceed band 5.",
    severity: "cap",
    evidence: conclusionSpan,
    feedbackStarter: conclusion.present ? "Conclusion present." : "Your essay ends without a conclusion, so Task Response is capped at band 5.",
    fixSuggestion: "Add a one- or two-sentence conclusion that restates your position (start with `In conclusion,`).",
    failed: !conclusion.present,
  });

  const paragraphCountOk = metrics.paragraphs === 4 || metrics.paragraphs === 5;
  addCap({
    checkId: "t2.structure.paragraphs",
    criterion: "CC",
    cap: 5,
    label: "Paragraph count 4–5",
    observed: `${metrics.paragraphs} paragraph(s)`,
    reason: paragraphCountOk
      ? "Paragraph count within 4–5."
      : "Illegal paragraph count (fewer than 4, or 6+): Coherence & Cohesion capped at 5.",
    severity: "cap",
    evidence: paragraphs[1] ? spanOf(text, paragraphs[1].startChar, Math.min(paragraphs[1].endChar, paragraphs[1].startChar + 120)) : spanOf(text, 0, 0),
    feedbackStarter: `Your essay has ${metrics.paragraphs} paragraph(s); IELTS Task 2 expects four or five (introduction, 2–3 bodies, conclusion).`,
    fixSuggestion: "Restructure into the 4- or 5-paragraph skeleton before adding more content.",
    failed: !paragraphCountOk,
  });

  const bodyCountOk = metrics.bodyParagraphs >= 2 && metrics.bodyParagraphs <= 3;
  addCap({
    checkId: "t2.structure.bodies",
    criterion: "CC",
    cap: 5,
    label: "Two or three body paragraphs",
    observed: `${metrics.bodyParagraphs} body paragraph(s)`,
    reason: bodyCountOk ? "Body count within 2–3." : "One body paragraph (or four+) caps Coherence & Cohesion at band 5.",
    severity: "cap",
    evidence: paragraphs[1] ? spanOf(text, paragraphs[1].startChar, Math.min(paragraphs[1].endChar, paragraphs[1].startChar + 120)) : spanOf(text, 0, 0),
    feedbackStarter: `Your essay develops its argument in ${metrics.bodyParagraphs} body paragraph(s); two or three are required.`,
    fixSuggestion: "Develop a second body paragraph with its own topic sentence rather than stacking ideas in one block.",
    failed: !bodyCountOk,
  });

  addCap({
    checkId: "t2.structure.conclusion-link",
    criterion: "TR",
    cap: 8,
    label: "Conclusion signposted",
    observed: conclusion.strongLink ? "starts with In conclusion / To conclude" : "no strong conclusion linker",
    reason: conclusion.strongLink ? "Conclusion is signposted." : "Conclusion is not signposted with `In conclusion` / `To conclude`.",
    severity: "upgrade",
    evidence: conclusionParagraph ? spanOf(text, conclusionParagraph.startChar, Math.min(conclusionParagraph.endChar, conclusionParagraph.startChar + 90)) : spanOf(text, 0, 0),
    feedbackStarter: "Your final paragraph is not signposted as a conclusion.",
    fixSuggestion: "Start it with `In conclusion,` — `To sum up` is acceptable but weaker; `In a nutshell` is banned.",
    failed: conclusion.present && !conclusion.strongLink,
  });

  /* ---------------- 3. position ---------------- */
  if (position.required) {
    const missing = !position.explicit;
    addCap({
      checkId: "t2.tr.position.missing",
      criterion: "TR",
      cap: 5,
      label: "Position stated when required",
      observed: missing ? "no explicit position" : "explicit position found",
      reason: missing ? "The task asks for an opinion and no explicit position appears: TR capped at 5." : "Explicit position present.",
      severity: "cap",
      evidence: introSpan,
      feedbackStarter: "The prompt asks for your opinion, but no explicit position (`In my opinion`, `I largely agree`, …) appears anywhere in the essay.",
      fixSuggestion: "State your position in the introduction with a first-person marker and hold it through the bodies and conclusion.",
      failed: missing,
    });

    const late = !missing && position.onlyInConclusion;
    addCap({
      checkId: "t2.tr.position.late",
      criterion: "TR",
      cap: 6,
      label: "Position in the introduction",
      observed: late ? "position only in the conclusion" : "position appears before the conclusion",
      reason: late ? "Position is left to the conclusion: TR capped at 6." : "Position is not confined to the conclusion.",
      severity: "cap",
      evidence: conclusionSpan,
      feedbackStarter: "Your position only appears in the conclusion — the examiner needs it in the introduction and throughout.",
      fixSuggestion: "Move the thesis into the introduction: answer the question directly and preview the main reason.",
      failed: late,
    });
  }

  const fenceEvidence =
    firstMatchSpan(text, FENCE_PATTERNS[0]) ??
    firstMatchSpan(text, FENCE_PATTERNS[1]) ??
    firstMatchSpan(text, FENCE_PATTERNS[2]) ??
    firstMatchSpan(text, FENCE_PATTERNS[3]) ??
    firstMatchSpan(text, FENCE_PATTERNS[4]) ??
    introSpan;
  addCap({
    checkId: "t2.tr.position.fence",
    criterion: "TR",
    cap: 5,
    label: "No fence-sitting",
    observed: position.fenceSitting ? "sits on the fence" : "committed position",
    reason: position.fenceSitting ? "Fence-sitting (agreeing with both sides fully): TR capped at 5." : "Position is committed.",
    severity: "cap",
    evidence: fenceEvidence,
    feedbackStarter: "You agree with both sides equally, which is fence-sitting — a quantified partial view is allowed, a full both-sides answer is not.",
    fixSuggestion: "Commit to a side (a specific partial view is fine) and make the extent explicit: `I largely agree because …`.",
    failed: position.fenceSitting,
  });

  const opinionMarkers = position.markersInIntro.length + position.markersInBody.length + position.markersInConclusion.length;
  addCap({
    checkId: "t2.tr.position.forced",
    criterion: "TR",
    cap: 6,
    label: "Opinion only when asked",
    observed: `${opinionMarkers} opinion marker(s)`,
    reason: "This task does not ask for an opinion; giving one wastes relevance.",
    severity: "upgrade",
    evidence: introSpan,
    feedbackStarter: "This task does not ask for your opinion, yet the essay takes a personal stance.",
    fixSuggestion: "Keep the discussion/report neutral; reframe first-person opinion sentences as evidence.",
    failed: !position.required && opinionMarkers >= 3,
  });

  addCap({
    checkId: "t2.tr.position.consistency",
    criterion: "TR",
    cap: 6,
    label: "Position held consistently",
    observed: position.consistent ? "consistent" : "introduction and conclusion disagree",
    reason: position.consistent ? "Position consistent." : "The stance changes between introduction and conclusion: TR capped at 6.",
    severity: "cap",
    evidence: conclusionSpan,
    feedbackStarter: "Your stance in the conclusion does not match the position you stated in the introduction.",
    fixSuggestion: "Pick one side and keep it: restate the same position (in new words) in the conclusion.",
    failed: position.required && position.explicit && !position.consistent,
  });

  /* ---------------- 4. coverage / half-answer ---------------- */
  const missingParts = coverage.parts.filter((part) => !part.covered);
  const halfAnswered = coverage.halfAnswered && metrics.words >= 120;
  addCap({
    checkId: "t2.tr.half-answer",
    criterion: "TR",
    cap: 5,
    label: "All question parts answered",
    observed: halfAnswered
      ? `missing: ${missingParts.map((part) => part.label).join(", ")}`
      : coverage.parts.map((part) => `${part.label}: ${part.covered ? "yes" : "no"}`).join("; "),
    reason: halfAnswered ? "At least one question part is unanswered: TR capped at 5." : "All parts addressed.",
    severity: "cap",
    evidence: (() => {
      const thin = bodies.find((body) => body.supportMarkers === 0);
      const target = thin ?? lastParagraph;
      return target ? spanOf(text, target.startChar, target.endChar) : spanOf(text, 0, 0);
    })(),
    feedbackStarter: halfAnswered
      ? `Parts of the task are under-answered — no coverage of: ${missingParts.map((part) => part.label).join(", ")}.`
      : "All parts of the task are addressed.",
    fixSuggestion: "Give every question its own paragraph and mirror the question wording in the topic sentence.",
    failed: halfAnswered,
  });

  const needsWeighing = item.variant === "C2" || item.variant === "D1";
  addCap({
    checkId: "t2.tr.weighing",
    criterion: "TR",
    cap: 6,
    label: "Explicit weighing judgement",
    observed: analysis.weighingLanguage ? "weighing language found" : "no weighing language",
    reason:
      needsWeighing && !analysis.weighingLanguage
        ? "The task asks which side outweighs the other; the verdict is asserted without weighing: TR capped at 6."
        : "Weighting language present or not required.",
    severity: "cap",
    evidence: conclusionSpan,
    feedbackStarter: "The task asks you to weigh the two sides, but the verdict is not supported with weighing language.",
    fixSuggestion: "Compare the two sets of reasons explicitly: `The benefits matter more because …`, `This drawback is outweighed by …`.",
    failed: needsWeighing && !analysis.weighingLanguage,
  });

  const thinBody = bodies.find((body) => body.words < 70 || body.supportMarkers === 0) ?? null;
  addCap({
    checkId: "t2.tr.development",
    criterion: "TR",
    cap: 7,
    label: "Ideas developed, not listed",
    observed: bodies.length === 0 ? "no body paragraphs" : bodies.map((body) => `${body.words}w/${body.supportMarkers} support`).join(", "),
    reason: thinBody ? "At least one body paragraph is thin (under 70 words or without a supporting reason)." : "Every body develops its idea.",
    severity: "upgrade",
    evidence: thinBody ? spanOf(text, thinBody.startChar, thinBody.endChar) : lastSentenceSpan(),
    feedbackStarter: thinBody
      ? `The body paragraph starting "${firstWords(thinBody.text)}" is thin — the idea is stated but not extended.`
      : "Ideas are developed.",
    fixSuggestion: "Extend the point: reason → consequence → example, then tie it back to the question.",
    failed: thinBody !== null && bodies.length > 0,
  });

  const focusFail = metrics.statementTermOverlap < 0.12;
  addCap({
    checkId: "t2.tr.focus",
    criterion: "TR",
    cap: 6,
    label: "Response stays on topic",
    observed: `statement term overlap ${(metrics.statementTermOverlap * 100).toFixed(0)}%`,
    reason: focusFail ? "Very little of the prompt's key vocabulary appears: the essay may answer the general topic." : "Topic vocabulary present.",
    severity: "cap",
    evidence: introSpan,
    feedbackStarter: "The essay uses very little of the question's key vocabulary, so it may answer the general topic rather than the specific issue.",
    fixSuggestion: "Paraphrase the question statement in the introduction and keep its key terms (accurately) through the essay.",
    failed: focusFail && metrics.words >= 120,
  });

  /* ---------------- 5. coherence & cohesion ---------------- */
  const untopicBody = bodies.find((body) => !body.topicSentence || body.words < 50) ?? null;
  addCap({
    checkId: "t2.cc.topics",
    criterion: "CC",
    cap: 6,
    label: "One topic per body paragraph",
    observed: bodies.map((body) => `${body.topicSentence ? "topic sentence" : "no topic sentence"}/${body.words}w`).join(", ") || "no bodies",
    reason: untopicBody ? "A body paragraph has no clear topic sentence or mixes too many ideas." : "Each body has a central topic.",
    severity: "upgrade",
    evidence: untopicBody ? spanOf(text, untopicBody.startChar, untopicBody.endChar) : spanOf(text, 0, 0),
    feedbackStarter: untopicBody
      ? `The body paragraph starting "${firstWords(untopicBody.text)}" does not announce one central topic.`
      : "Paragraph topics are clear.",
    fixSuggestion: "Open each body with a topic sentence that names the single idea the paragraph will develop.",
    failed: untopicBody !== null,
  });

  const mechanical = metrics.mechanicalListingCount >= 2;
  addCap({
    checkId: "t2.cc.mechanical",
    criterion: "CC",
    cap: 6,
    label: "Linkers not mechanical",
    observed: `${metrics.mechanicalListingCount} listing linker(s)`,
    reason: mechanical ? "Firstly/Secondly paragraphing is mechanical and holds cohesion below band 7." : "Linkers varied.",
    severity: "upgrade",
    evidence: firstMatchSpan(text, MECHANICAL_LISTING) ?? spanOf(text, 0, 0),
    feedbackStarter: "Your paragraph openers rely on `Firstly` / `Secondly`, which examiners read as mechanical.",
    fixSuggestion: "Replace listing adverbs with content-based signposts (`The main reason …`, `A stronger objection …`).",
    failed: mechanical,
  });

  const linkerRange = metrics.linkerFamilies.filter((family) => family !== "listing" && family !== "conclusion").length;
  const linkerRangeBad = linkerRange < 2 && metrics.referencingDensity < 0.03;
  addCap({
    checkId: "t2.cc.linkers",
    criterion: "CC",
    cap: 6,
    label: "Range of cohesive devices",
    observed: `${linkerRange} linker family/families: ${metrics.linkerFamilies.join(", ") || "none"}`,
    reason: !linkerRangeBad
      ? "Linker range adequate (or cohesion carried by referencing)."
      : "Fewer than two linking functions and little referencing: cohesion capped at 6.",
    severity: "upgrade",
    evidence: paragraphs[1] ? spanOf(text, paragraphs[1].startChar, Math.min(paragraphs[1].endChar, paragraphs[1].startChar + 90)) : spanOf(text, 0, 0),
    feedbackStarter: "Linking is limited to a narrow set of devices.",
    fixSuggestion: "Add contrast (`however`, `by contrast`), result (`consequently`) and example (`for instance`) linkers where the logic calls for them.",
    failed: linkerRangeBad,
  });

  const referencingWeak = metrics.referencingDensity < 0.02;
  addCap({
    checkId: "t2.cc.referencing",
    criterion: "CC",
    cap: 7,
    label: "Referencing used",
    observed: `referencing density ${metrics.referencingDensity}`,
    reason: referencingWeak ? "Very little referencing (this/it/these/such): cohesion relies on linkers alone." : "Referencing present.",
    severity: "upgrade",
    evidence: paragraphs[1] ? spanOf(text, paragraphs[1].startChar, Math.min(paragraphs[1].endChar, paragraphs[1].startChar + 90)) : spanOf(text, 0, 0),
    feedbackStarter: "The essay makes little use of referencing words (this, it, these, such).",
    fixSuggestion: "Use `this`/`these` + noun to pick up the previous idea instead of repeating the same linker.",
    failed: referencingWeak,
  });

  /* ---------------- 6. lexical resource ---------------- */
  const banned = lexical.banned.filter((hit) => !hit.advisory);
  const bannedHeavy = banned.length >= 3;
  const firstBanned = banned[0];
  addCap({
    checkId: "t2.lr.banned",
    criterion: "LR",
    cap: bannedHeavy ? 5 : 6,
    label: "No memorised / banned phrases",
    observed: `${banned.length} banned phrase(s)`,
    reason:
      banned.length === 0
        ? "No banned phrases."
        : `${banned.length} memorised phrase(s) detected (${banned.map((hit) => `#${hit.ruleIndex}`).join(", ")}): LR capped at ${bannedHeavy ? 5 : 6}.`,
    severity: "cap",
    evidence: firstBanned
      ? { startChar: firstBanned.startChar, endChar: firstBanned.endChar, text: firstBanned.match }
      : spanOf(text, 0, 0),
    feedbackStarter: firstBanned ? `Memorised language detected: "${firstBanned.match}".` : "No memorised language.",
    fixSuggestion: "Replace scripted phrases with your own wording — examiners discount them and they damage both TR and LR.",
    failed: banned.length > 0,
  });

  if (banned.length > 0) {
    const thesisBan = banned.find((hit) => (hit.ruleIndex ?? 0) <= 2);
    addCap({
      checkId: "t2.tr.memorised-thesis",
      criterion: "TR",
      cap: 5,
      label: "No memorised thesis",
      observed: thesisBan ? `banned phrase #${thesisBan.ruleIndex}` : "no thesis announcement",
      reason: thesisBan
        ? "A memorised thesis announcement (`this essay will…`) replaces a real position: TR capped at 5."
        : "No memorised thesis announcement.",
      severity: "cap",
      evidence: thesisBan ? { startChar: thesisBan.startChar, endChar: thesisBan.endChar, text: thesisBan.match } : spanOf(text, 0, 0),
      feedbackStarter: thesisBan
        ? `The thesis is a memorised announcement ("${thesisBan.match}") rather than a direct answer.`
        : "Thesis is your own.",
      fixSuggestion: "Delete the announcement and answer the question directly in the introduction.",
      failed: thesisBan !== undefined,
    });
  }

  const advisory = lexical.banned.filter((hit) => hit.advisory);
  if (advisory.length > 0) {
    const hit = advisory[0];
    addUpgrade(
      "t2.lr.advisory-idiom",
      "LR",
      7,
      "Idioms / quotes advisory",
      `${advisory.length} advisory hit(s)`,
      { startChar: hit.startChar, endChar: hit.endChar, text: hit.match },
      `Idiomatic or quoted language detected ("${hit.match}") — idioms are informal and quotes do not demonstrate your own English.`,
      "Replace it with a plain statement or a phrasal verb (`bring about`, `give rise to`).",
    );
  }

  addCap({
    checkId: "t2.lr.contractions",
    criterion: "LR",
    cap: 6,
    label: "No contractions",
    observed: `${lexical.contractions.length} contraction(s)`,
    reason: lexical.contractions.length === 0 ? "No contractions." : "Contractions are informal: LR capped at 6.",
    severity: "error",
    evidence: lexical.contractions[0]
      ? { startChar: lexical.contractions[0].startChar, endChar: lexical.contractions[0].endChar, text: lexical.contractions[0].match }
      : spanOf(text, 0, 0),
    feedbackStarter: lexical.contractions[0] ? `The contraction "${lexical.contractions[0].match}" is informal in an essay.` : "No contractions.",
    fixSuggestion: "Write the two-word form (`do not`, `it is`).",
    failed: lexical.contractions.length >= 2,
  });

  const uncountableHeavy = lexical.uncountable.length >= 3;
  addCap({
    checkId: "t2.lr.uncountable",
    criterion: "LR",
    cap: uncountableHeavy ? 5 : 6,
    label: "Uncountable nouns used correctly",
    observed: `${lexical.uncountable.length} uncountable slip(s)`,
    reason:
      lexical.uncountable.length === 0
        ? "Uncountables used correctly."
        : `Uncountable slips (${lexical.uncountable.map((hit) => `"${hit.match}"`).join(", ")}).`,
    severity: "error",
    evidence: lexical.uncountable[0]
      ? { startChar: lexical.uncountable[0].startChar, endChar: lexical.uncountable[0].endChar, text: lexical.uncountable[0].match }
      : spanOf(text, 0, 0),
    feedbackStarter: lexical.uncountable[0] ? `Uncountable-noun slip: "${lexical.uncountable[0].match}".` : "Uncountables correct.",
    fixSuggestion: "Remove the article/plural (`advice`, `information`, `research`) or quantify with `a piece of …`.",
    failed: lexical.uncountable.length > 0,
  });

  const spellingRate = metrics.words === 0 ? 0 : (lexical.spelling.length / metrics.words) * 100;
  const spellingHeavy = lexical.spelling.length >= 4 || spellingRate > 1.5;
  addCap({
    checkId: "t2.lr.spelling",
    criterion: "LR",
    cap: spellingHeavy ? 5 : 6,
    label: "Spelling accuracy",
    observed: `${lexical.spelling.length} misspelling(s)`,
    reason:
      lexical.spelling.length === 0
        ? "No flagged misspellings."
        : `Misspellings: ${lexical.spelling.map((hit) => `"${hit.match}"`).join(", ")}.`,
    severity: "error",
    evidence: lexical.spelling[0]
      ? { startChar: lexical.spelling[0].startChar, endChar: lexical.spelling[0].endChar, text: lexical.spelling[0].match }
      : spanOf(text, 0, 0),
    feedbackStarter: lexical.spelling[0] ? `Spelling slip: "${lexical.spelling[0].match}".` : "No spelling slips.",
    fixSuggestion: lexical.spelling[0] ? `Correct it to "${lexical.spelling[0].correction}".` : "Proof-read key topic terms last.",
    failed: lexical.spelling.length > 0,
  });

  const informal = lexical.informal.filter((hit) => hit.severity === "error");
  const informalHeavy = informal.length >= 3;
  addCap({
    checkId: "t2.lr.informal",
    criterion: "LR",
    cap: informalHeavy ? 5 : 6,
    label: "Formal register",
    observed: `${informal.length} informal item(s)`,
    reason: informal.length === 0 ? "Register formal." : `Informal items: ${informal.map((hit) => `"${hit.match}"`).join(", ")}.`,
    severity: "error",
    evidence: informal[0]
      ? { startChar: informal[0].startChar, endChar: informal[0].endChar, text: informal[0].match }
      : spanOf(text, 0, 0),
    feedbackStarter: informal[0] ? `Informal language: "${informal[0].match}".` : "Register formal.",
    fixSuggestion: informal[0]?.suggestion ?? "Keep an academic register throughout.",
    failed: informal.length > 0,
  });

  const ttrWeak = metrics.ttr < 0.72;
  const ttrVeryWeak = metrics.ttr < 0.62;
  const repeated = repetitionReport(text, 1).topRepeated[0];
  addCap({
    checkId: "t2.lr.range",
    criterion: "LR",
    cap: ttrVeryWeak ? 5 : 6,
    label: "Lexical range",
    observed: `type–token ratio ${metrics.ttr}`,
    reason: ttrWeak ? `Repetitive vocabulary (TTR ${metrics.ttr}): LR capped at ${ttrVeryWeak ? 5 : 6}.` : "Vocabulary varied.",
    severity: "error",
    evidence: repeated
      ? spanOf(text, repeated.firstStartChar, repeated.firstEndChar)
      : spanOf(text, 0, Math.min(text.length, 80)),
    feedbackStarter: ttrWeak ? `Your vocabulary repeats itself (type–token ratio ${metrics.ttr}).` : "Vocabulary range adequate.",
    fixSuggestion: "Paraphrase the most repeated content word with a precise synonym from the topic's language bank.",
    failed: ttrWeak && metrics.words >= 120,
  });

  const repetitionProblem = metrics.topRepeatedCount > 8;
  addCap({
    checkId: "t2.lr.repetition",
    criterion: "LR",
    cap: 6,
    label: "No over-used content word",
    observed: `top content word used ${metrics.topRepeatedCount} time(s)`,
    reason: repetitionProblem ? "One content word dominates the essay." : "Repetition controlled.",
    severity: "upgrade",
    evidence: repeated ? spanOf(text, repeated.firstStartChar, repeated.firstEndChar) : spanOf(text, 0, 0),
    feedbackStarter: "One content word is repeated throughout the essay.",
    fixSuggestion: "Build a synonym set for the key term before writing and rotate the terms.",
    failed: repetitionProblem,
  });

  /* ---------------- 7. grammatical range & accuracy ---------------- */
  const complexWeak = metrics.complexSentencePct < 0.28;
  addCap({
    checkId: "t2.gra.complexity",
    criterion: "GRA",
    cap: 6,
    label: "Complex structures used",
    observed: `${(metrics.complexSentencePct * 100).toFixed(0)}% complex sentences`,
    reason: complexWeak ? "Too few complex sentences: GRA capped at 6." : "Mix of simple and complex structures.",
    severity: "error",
    evidence: (() => {
      const simple = splitSentences(text).find(
        (sentence) =>
          sentence.text.split(/\s+/).length >= 6 &&
          !/\b(although|though|while|whereas|because|since|which|who|where|if|when|after|before|despite)\b/i.test(sentence.text),
      );
      return simple ? spanOf(text, simple.startChar, simple.endChar) : spanOf(text, 0, 0);
    })(),
    feedbackStarter: complexWeak
      ? `Only ${(metrics.complexSentencePct * 100).toFixed(0)}% of your sentences are complex.`
      : "A mix of simple and complex sentences is present.",
    fixSuggestion: "Combine two short sentences with a subordinator (`although`, `while`, `which`) in each body paragraph.",
    failed: complexWeak && metrics.words >= 120,
  });

  const errorFreeWeak = metrics.errorFreeRatio < 0.6;
  const errorDensityBad = metrics.errorsPer100Words > 3;
  const firstGrammarHit = analysis.grammarHits[0];
  addCap({
    checkId: "t2.gra.errorfree",
    criterion: "GRA",
    cap: errorDensityBad ? 5 : 6,
    label: "Error-free sentence ratio",
    observed: `${(metrics.errorFreeRatio * 100).toFixed(0)}% error-free (${metrics.grammarErrorCount} hit(s))`,
    reason: errorFreeWeak ? "Too few error-free sentences: GRA capped." : "Frequent error-free sentences.",
    severity: "error",
    evidence: firstGrammarHit
      ? { startChar: firstGrammarHit.startChar, endChar: firstGrammarHit.endChar, text: firstGrammarHit.match }
      : spanOf(text, 0, 0),
    feedbackStarter: firstGrammarHit
      ? `Grammar slip: "${firstGrammarHit.match}" — ${firstGrammarHit.label}.`
      : "Sentence accuracy is good.",
    fixSuggestion: firstGrammarHit?.suggestion ?? "Check subject–verb agreement and articles in each body paragraph.",
    failed: errorFreeWeak || errorDensityBad,
  });

  const punctuationBad = metrics.punctuationErrorCount > 1;
  const punctuationHeavy = metrics.punctuationErrorCount >= 3;
  const firstPunctuation = analysis.punctuationHits[0];
  addCap({
    checkId: "t2.gra.punctuation",
    criterion: "GRA",
    cap: punctuationHeavy ? 5 : 6,
    label: "Punctuation control",
    observed: `${metrics.punctuationErrorCount} punctuation/capitalisation issue(s)`,
    reason:
      metrics.punctuationErrorCount === 0
        ? "Punctuation controlled."
        : `${metrics.punctuationErrorCount} issue(s) (semicolons/colons, contractions, capitalisation): GRA capped.`,
    severity: "error",
    evidence: firstPunctuation
      ? { startChar: firstPunctuation.startChar, endChar: firstPunctuation.endChar, text: firstPunctuation.match }
      : spanOf(text, 0, 0),
    feedbackStarter: firstPunctuation ? `Punctuation issue: ${firstPunctuation.label}.` : "Punctuation clean.",
    fixSuggestion: firstPunctuation?.suggestion ?? "Prefer commas and full stops; avoid `;` and `:`.",
    failed: punctuationBad || punctuationHeavy,
  });

  addCap({
    checkId: "t2.gra.contractions",
    criterion: "GRA",
    cap: 6,
    label: "No contractions (grammar)",
    observed: `${lexical.contractions.length} contraction(s)`,
    reason: lexical.contractions.length < 2 ? "At most one contraction." : "Two or more contractions: GRA capped at 6.",
    severity: "error",
    evidence: lexical.contractions[0]
      ? { startChar: lexical.contractions[0].startChar, endChar: lexical.contractions[0].endChar, text: lexical.contractions[0].match }
      : spanOf(text, 0, 0),
    feedbackStarter: "Contractions are informal and count against grammatical control.",
    fixSuggestion: "Expand every contraction (`don't` → `do not`).",
    failed: lexical.contractions.length >= 2,
  });

  const articleHeavy = metrics.articleHits >= 2;
  addCap({
    checkId: "t2.gra.articles",
    criterion: "GRA",
    cap: 6,
    label: "Article accuracy",
    observed: `${metrics.articleHits} article error(s)`,
    reason: articleHeavy ? "Repeated article errors: GRA capped at 6." : "Article use acceptable.",
    severity: "error",
    evidence: (() => {
      const hit = analysis.grammarHits.find((entry) => entry.kind === "article");
      return hit ? { startChar: hit.startChar, endChar: hit.endChar, text: hit.match } : spanOf(text, 0, 0);
    })(),
    feedbackStarter: "Article errors are noticeable.",
    fixSuggestion: "Check `a/an` before vowel sounds and drop articles before uncountable nouns.",
    failed: articleHeavy,
  });

  const prepositionHeavy = metrics.prepositionHits >= 2;
  addCap({
    checkId: "t2.gra.prepositions",
    criterion: "GRA",
    cap: 6,
    label: "Preposition accuracy",
    observed: `${metrics.prepositionHits} preposition error(s)`,
    reason: prepositionHeavy ? "Repeated preposition errors: GRA capped at 6." : "Preposition use acceptable.",
    severity: "error",
    evidence: (() => {
      const hit = analysis.grammarHits.find((entry) => entry.kind === "preposition");
      return hit ? { startChar: hit.startChar, endChar: hit.endChar, text: hit.match } : spanOf(text, 0, 0);
    })(),
    feedbackStarter: "Preposition collocations are wrong in places.",
    fixSuggestion: "Learn the fixed phrases: `discuss Ø`, `depend on`, `focus on`, `on the other hand`.",
    failed: prepositionHeavy,
  });

  /* ---------------- rubric + caps + feedback ---------------- */
  const signals = buildRubricSignals(analysis);
  const criteriaOrder: Task2Criterion[] = ["TR", "CC", "LR", "GRA"];
  const rawCriteria: CriterionBand[] = criteriaOrder.map((criterion) => ({
    criterion,
    band: bandFromRubric(criterion, (key) => signals.pass[key] ?? false),
    summary: rubricSummary(criterion, analysis),
  }));
  const { criteria, applied } = capCriteria(rawCriteria, caps);
  const overallBand = scoreTask(criteria);
  const feedback = prioritizeFeedback(rawFeedback, { maxPerGate: 1, limit: 12 });
  const scoreOf = (criterion: Criterion) => criteria.find((entry) => entry.criterion === criterion)?.band ?? 5;

  return {
    task: 2,
    itemId: item.promptId,
    words: metrics.words,
    criteria,
    overallBand,
    checks,
    feedback,
    promptId: item.promptId,
    variant: item.variant,
    family: item.family,
    opinionRequired: item.opinionRequired,
    netWords: metrics.netWords,
    paragraphCount: metrics.paragraphs,
    scores: { TR: scoreOf("TR"), CC: scoreOf("CC"), LR: scoreOf("LR"), GRA: scoreOf("GRA") },
    caps,
    appliedCaps: applied,
    rawCriteria,
    rubricRows: criteriaOrder.flatMap((criterion) => evaluateRubric(criterion, (key) => signals.pass[key] ?? false)),
    analysis,
    nearest: analysis.nearest,
  };
}

/** Convenience: the feedback item a candidate should read first, if any. */
export function topFeedback(grade: Task2Grade): FeedbackItem | null {
  return grade.feedback[0] ?? null;
}

/** Fallback criterion list for the report when a criterion is ungraded. */
export function emptyCriterionBands(): CriterionBand[] {
  return (["TR", "CC", "LR", "GRA"] as Criterion[]).map((criterion) => ({ criterion, band: 5 }));
}
