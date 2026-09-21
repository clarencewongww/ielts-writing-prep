/**
 * Deterministic analysis used by the Task 1 grader (dossier §4.9–§4.10, §9–§10):
 *
 *  - overview detector: "Overall," marker, data-free paragraph 2, ≤2 sentences,
 *  - key-feature matching against `item.keyFeatures` (keyword overlap),
 *  - intro paraphrase vs copied question text,
 *  - data-per-sentence (figure/date) with the process exemption,
 *  - tense expectation from `timeFrame.kind` / `values` / `tenseRule`,
 *  - number rules: millions, amount vs number, ratio/rate, "a half of",
 *  - grammar heuristics that mirror the bank's own band-6 defect profiles,
 *  - range/repetition signals for LR and GRA.
 *
 * Every result carries character offsets so the caller can build evidence spans.
 */

import { COPY_RUN_MIN_WORDS } from "../constants";
import { countCopiedWords, countWords, findCopiedRuns } from "../data/wordCount";
import type { CopiedRun } from "../data/wordCount";
import type { KeyFeature, Task1Item } from "../types/bank";
import type { ParagraphSpan, SentenceSpan } from "./cohesion";
import { splitAllSentences } from "./cohesion";

/* ------------------------------------------------------------------ */
/* Shared span type                                                    */
/* ------------------------------------------------------------------ */

export interface TextSpan {
  start: number;
  end: number;
  text: string;
  paragraphIndex: number;
}

function spanOf(sentence: SentenceSpan): TextSpan {
  return {
    start: sentence.start,
    end: sentence.end,
    text: sentence.text,
    paragraphIndex: sentence.paragraphIndex,
  };
}

/* ------------------------------------------------------------------ */
/* Vocabulary helpers                                                  */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "over",
  "between", "during", "from", "by", "as", "is", "are", "was", "were", "be", "been", "being",
  "its", "their", "this", "that", "these", "those", "it", "they", "there", "than", "then",
  "when", "which", "who", "while", "also", "both", "some", "all", "each", "other", "others",
  "more", "most", "less", "least", "only", "very", "not", "no", "up", "down", "out", "into",
  "about", "around", "after", "before", "through", "across", "against", "per", "within",
  "without", "respectively", "whereas", "although", "though", "because", "since", "so",
  "saw", "seen", "recorded", "shows", "show", "shown", "gives", "gave", "given", "period",
  "during", "reached", "recorded", "overall", "same", "much", "many", "well", "just",
  "nearly", "almost", "slightly", "significantly", "considerably", "steadily", "gradually",
  "rapidly", "dramatically", "sharply", "slowly", "respectively", "however", "therefore",
]);

/** Trend/degree synonyms collapsed to a single comparison form. */
const TREND_CANON: Record<string, string> = {
  rise: "increase", rises: "increase", rose: "increase", risen: "increase", rising: "increase",
  increase: "increase", increases: "increase", increased: "increase", increasing: "increase",
  grow: "increase", grows: "increase", grew: "increase", grown: "increase", growing: "increase",
  growth: "increase", climb: "increase", climbs: "increase", climbed: "increase", climbing: "increase",
  surge: "increase", surges: "increase", surged: "increase", expand: "increase", expands: "increase",
  expanded: "increase", expansion: "increase", up: "increase", upturn: "increase",
  decrease: "decrease", decreases: "decrease", decreased: "decrease", decreasing: "decrease",
  decline: "decrease", declines: "decrease", declined: "decrease", declining: "decrease",
  drop: "decrease", drops: "decrease", dropped: "decrease", dropping: "decrease",
  fall: "decrease", falls: "decrease", fell: "decrease", fallen: "decrease", falling: "decrease",
  down: "decrease", dip: "decrease", dips: "decrease", dipped: "decrease", contract: "decrease",
  contracted: "decrease",
  remain: "stable", remains: "stable", remained: "stable", remaining: "stable",
  stay: "stable", stays: "stable", stayed: "stable", stable: "stable", steady: "stable",
  steadily: "stable", unchanged: "stable", constant: "stable", level: "stable", plateau: "stable",
  high: "high", higher: "high", highest: "high", peak: "high", peaks: "high", peaked: "high",
  lead: "high", leads: "high", led: "high", leading: "high", top: "high", largest: "high",
  biggest: "high", maximum: "high", most: "high",
  low: "low", lower: "low", lowest: "low", bottom: "low", least: "low", fewest: "low",
  smallest: "low", minimum: "low",
  fast: "fast", faster: "fast", fastest: "fast", rapid: "fast", rapidly: "fast", quick: "fast",
  quickly: "fast", sharp: "fast", sharply: "fast", steep: "fast", steepest: "fast",
  significant: "fast", dramatically: "fast",
  slow: "slow", slower: "slow", slowest: "slow", slowly: "slow", slight: "slow", slightly: "slow",
  gradual: "slow", gradually: "slow", marginal: "slow", marginally: "slow",
};

function canonicalWord(word: string): string {
  const canon = TREND_CANON[word];
  if (canon) return canon;
  let w = word;
  if (w.length > 4) {
    if (w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
    else if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
  }
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  return w;
}

interface TermRef {
  canonical: string;
  raw: string;
  start: number;
  end: number;
}

function scanContentTokens(text: string): TermRef[] {
  const refs: TermRef[] = [];
  for (const match of text.matchAll(/[A-Za-z][A-Za-z'-]*/g)) {
    const raw = match[0];
    const lower = raw.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    refs.push({
      canonical: canonicalWord(lower),
      raw,
      start: match.index ?? 0,
      end: (match.index ?? 0) + raw.length,
    });
  }
  return refs;
}

interface NumberRef {
  value: number;
  raw: string;
  start: number;
  end: number;
}

function scanNumbers(text: string): NumberRef[] {
  const refs: NumberRef[] = [];
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = match[0];
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    refs.push({ value, raw, start: match.index ?? 0, end: (match.index ?? 0) + raw.length });
  }
  return refs;
}

function numbersMatch(a: number, b: number): boolean {
  return a === b || Math.abs(a - b) <= 0.5;
}

/* ------------------------------------------------------------------ */
/* Key-feature matching                                                */
/* ------------------------------------------------------------------ */

export interface FeatureMatch {
  featureId: string;
  description: string;
  matched: boolean;
  /** Canonical words + numbers that overlapped, for feedback copy. */
  matchedTerms: string[];
  matchStart: number;
  matchEnd: number;
}

/** Canonical forms too generic to prove a key feature was covered. */
const GENERIC_TERMS = new Set([
  "increase", "decrease", "stable", "high", "low", "fast", "slow",
  "chart", "graph", "figure", "number", "data", "percentage", "percent", "proportion",
  "amount", "total", "category", "country", "nation", "region", "museum", "visit",
  "visitor", "household", "student", "person", "people", "population", "process",
  "stage", "step", "item", "sector", "branch", "area", "city", "town", "village",
  "world", "year", "month", "day", "period", "time", "spend", "spent", "cost",
  "price", "money", "euro", "dollar", "pound", "million", "billion", "thousand",
  "hundred", "part", "place", "thing", "way", "change", "difference", "level",
  "rate", "share", "half", "quarter", "third", "twice", "double", "new", "old",
  "same", "different", "large", "small", "big", "show", "give", "compare",
  "illustrate", "include", "involve", "start", "end", "finish", "begin", "group",
]);

/** Keyword-overlap matcher: a number, a distinctive term, or (generic-only features) 2+ shared words. */
export function matchFeature(feature: KeyFeature, text: string): FeatureMatch {
  const featureTerms = scanContentTokens(feature.description ?? "");
  const featureNumbers = scanNumbers(feature.description ?? "");
  const textTerms = scanContentTokens(text);
  const textNumbers = scanNumbers(text);

  const termIndex = new Map<string, TermRef>();
  for (const ref of textTerms) if (!termIndex.has(ref.canonical)) termIndex.set(ref.canonical, ref);

  const matchedTerms: string[] = [];
  const matchedCanon: string[] = [];
  let matchStart = -1;
  let matchEnd = -1;
  const note = (start: number, end: number) => {
    if (matchStart === -1 || start < matchStart) {
      matchStart = start;
      matchEnd = end;
    }
  };

  const seenTerms = new Set<string>();
  for (const ref of featureTerms) {
    if (seenTerms.has(ref.canonical)) continue;
    const hit = termIndex.get(ref.canonical);
    if (!hit) continue;
    seenTerms.add(ref.canonical);
    matchedTerms.push(ref.raw.toLowerCase());
    matchedCanon.push(ref.canonical);
    note(hit.start, hit.end);
  }

  const seenNumbers = new Set<string>();
  for (const number of featureNumbers) {
    if (seenNumbers.has(number.raw)) continue;
    const hit = textNumbers.find((candidate) => numbersMatch(candidate.value, number.value));
    if (!hit) continue;
    seenNumbers.add(number.raw);
    matchedTerms.push(number.raw);
    note(hit.start, hit.end);
  }

  const numberMatched = seenNumbers.size > 0;
  const specificMatched = matchedCanon.filter((canon) => !GENERIC_TERMS.has(canon)).length;
  const genericMatched = matchedCanon.length - specificMatched;
  const featureSpecific = new Set(
    featureTerms.filter((ref) => !GENERIC_TERMS.has(ref.canonical)).map((ref) => ref.canonical),
  ).size;
  const matched =
    numberMatched ||
    specificMatched >= 1 ||
    (featureSpecific === 0 && genericMatched >= 2);

  return {
    featureId: feature.id,
    description: feature.description ?? "",
    matched,
    matchedTerms,
    matchStart: matched ? matchStart : -1,
    matchEnd: matched ? matchEnd : -1,
  };
}

/** Parent key features, falling back to the sub-charts of a mixed task. */
export function collectKeyFeatures(item: Task1Item): KeyFeature[] {
  const own = item.keyFeatures ?? [];
  if (own.length > 0) return own;
  return (item.subCharts ?? []).flatMap((sub) => sub.keyFeatures ?? []);
}

export function matchKeyFeatures(features: readonly KeyFeature[], text: string): FeatureMatch[] {
  return features.map((feature) => matchFeature(feature, text));
}

export interface FeaturePlacement extends FeatureMatch {
  /** Paragraph where the feature is first named (-1 when unmatched). */
  paragraphIndex: number;
}

function paragraphIndexAt(paragraphs: readonly ParagraphSpan[], offset: number): number {
  for (const paragraph of paragraphs) {
    if (offset >= paragraph.start && offset <= paragraph.end) return paragraph.index;
  }
  return -1;
}

export function locateKeyFeatures(
  item: Task1Item,
  text: string,
  paragraphs: readonly ParagraphSpan[],
): FeaturePlacement[] {
  return collectKeyFeatures(item).map((feature) => {
    const match = matchFeature(feature, text);
    return {
      ...match,
      paragraphIndex: match.matched ? paragraphIndexAt(paragraphs, match.matchStart) : -1,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Overview detector                                                   */
/* ------------------------------------------------------------------ */

export const OVERVIEW_MARKERS: readonly string[] = [
  "overall",
  "in general",
  "on the whole",
  "generally",
  "broadly speaking",
];

function markerAtStart(sentenceText: string): string | null {
  const lower = sentenceText.trimStart().toLowerCase();
  for (const marker of OVERVIEW_MARKERS) {
    if (lower === marker) return marker;
    if (lower.startsWith(`${marker},`) || lower.startsWith(`${marker} `)) return marker;
  }
  return null;
}

export function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

export interface OverviewAnalysis {
  present: boolean;
  paragraphIndex: number;
  start: number;
  end: number;
  text: string;
  marker: string | null;
  /** `marker` = "Overall," style opener, `paragraph2` = data-free second paragraph. */
  detectedBy: "marker" | "paragraph2" | null;
  dataFree: boolean;
  sentenceCount: number;
  /** Paragraphs whose first sentence starts with an overview marker. */
  markerParagraphs: number[];
  coverage: number;
  matches: FeatureMatch[];
}

function buildOverview(
  item: Task1Item,
  paragraphIndex: number,
  start: number,
  end: number,
  text: string,
  marker: string | null,
  detectedBy: OverviewAnalysis["detectedBy"],
  sentenceCount: number,
  markerParagraphs: number[],
): OverviewAnalysis {
  const features = collectKeyFeatures(item);
  const matches = matchKeyFeatures(features, text);
  return {
    present: true,
    paragraphIndex,
    start,
    end,
    text,
    marker,
    detectedBy,
    dataFree: !hasNumber(text),
    sentenceCount,
    markerParagraphs,
    coverage: matches.filter((match) => match.matched).length,
    matches,
  };
}

/**
 * Overview = a paragraph (or sentence) opened by an overview marker, or the
 * data-free second paragraph of ≤2 sentences (dossier §3.0).
 */
export function analyzeOverview(
  item: Task1Item,
  text: string,
  paragraphs: readonly ParagraphSpan[],
): OverviewAnalysis {
  const markerParagraphs = paragraphs
    .filter((paragraph) => {
      const first = paragraph.sentences[0];
      return first ? markerAtStart(first.text) !== null : false;
    })
    .map((paragraph) => paragraph.index);

  for (const paragraph of paragraphs) {
    const first = paragraph.sentences[0];
    if (!first) continue;
    const marker = markerAtStart(first.text);
    if (marker) {
      const end = paragraph.end;
      return buildOverview(
        item,
        paragraph.index,
        paragraph.start,
        end,
        text.slice(paragraph.start, end),
        marker,
        "marker",
        paragraph.sentences.length,
        markerParagraphs,
      );
    }
  }

  for (const paragraph of paragraphs) {
    for (const sentence of paragraph.sentences) {
      const marker = markerAtStart(sentence.text);
      if (!marker) continue;
      return buildOverview(
        item,
        paragraph.index,
        sentence.start,
        sentence.end,
        sentence.text,
        marker,
        "marker",
        1,
        markerParagraphs,
      );
    }
  }

  const second = paragraphs[1];
  if (second && !hasNumber(second.text) && second.sentences.length <= 2) {
    return buildOverview(
      item,
      second.index,
      second.start,
      second.end,
      second.text,
      null,
      "paragraph2",
      second.sentences.length,
      markerParagraphs,
    );
  }

  const first = paragraphs[0];
  return {
    present: false,
    paragraphIndex: -1,
    start: first?.start ?? 0,
    end: first?.end ?? 0,
    text: "",
    marker: null,
    detectedBy: null,
    dataFree: false,
    sentenceCount: 0,
    markerParagraphs,
    coverage: 0,
    matches: collectKeyFeatures(item).map((feature) => matchFeature(feature, "")),
  };
}

/* ------------------------------------------------------------------ */
/* Intro: paraphrase vs copied question text                           */
/* ------------------------------------------------------------------ */

export interface IntroAnalysis {
  paragraphIndex: number;
  start: number;
  end: number;
  text: string;
  words: number;
  copiedWords: number;
  copiedRatio: number;
  copiedRuns: CopiedRun[];
}

export function analyzeIntro(
  item: Task1Item,
  text: string,
  paragraphs: readonly ParagraphSpan[],
): IntroAnalysis {
  const paragraph = paragraphs[0];
  if (!paragraph) {
    return {
      paragraphIndex: -1,
      start: 0,
      end: 0,
      text: "",
      words: 0,
      copiedWords: 0,
      copiedRatio: 0,
      copiedRuns: [],
    };
  }
  const runs = findCopiedRuns(text, item.statement ?? "", COPY_RUN_MIN_WORDS).filter(
    (run) => run.start < paragraph.end,
  );
  const words = countWords(paragraph.text);
  const copiedWords = countCopiedWords(runs);
  return {
    paragraphIndex: paragraph.index,
    start: paragraph.start,
    end: paragraph.end,
    text: paragraph.text,
    words,
    copiedWords,
    copiedRatio: words > 0 ? copiedWords / words : 0,
    copiedRuns: runs,
  };
}

/* ------------------------------------------------------------------ */
/* Data per sentence (process exempt)                                  */
/* ------------------------------------------------------------------ */

export interface DataSentence {
  span: SentenceSpan;
  hasData: boolean;
}

export interface DataPerSentenceResult {
  applicable: boolean;
  exemptReason: string | null;
  sentences: DataSentence[];
  withData: number;
  total: number;
  ratio: number;
  dataFree: DataSentence[];
}

const FIGURE_OR_DATE = /\d/;

export function analyzeDataPerSentence(
  item: Task1Item,
  paragraphs: readonly ParagraphSpan[],
  overview: OverviewAnalysis,
): DataPerSentenceResult {
  if (item.type === "process") {
    return {
      applicable: false,
      exemptReason:
        "Process/diagram tasks describe stages in order; the data-per-sentence rule does not apply.",
      sentences: [],
      withData: 0,
      total: 0,
      ratio: 1,
      dataFree: [],
    };
  }

  const bodies = paragraphs.filter(
    (paragraph) => paragraph.index !== 0 && paragraph.index !== overview.paragraphIndex,
  );
  const sentences: DataSentence[] = bodies
    .flatMap((paragraph) => paragraph.sentences)
    .map((span) => ({ span, hasData: FIGURE_OR_DATE.test(span.text) }));
  const withData = sentences.filter((entry) => entry.hasData).length;
  const total = sentences.length;

  return {
    applicable: true,
    exemptReason: null,
    sentences,
    withData,
    total,
    ratio: total > 0 ? withData / total : 1,
    dataFree: sentences.filter((entry) => !entry.hasData),
  };
}

/* ------------------------------------------------------------------ */
/* Tense checker                                                       */
/* ------------------------------------------------------------------ */

export type TenseExpectation =
  | "past"
  | "future"
  | "past+future"
  | "present"
  | "past-or-perfect"
  | "present-passive";

export interface TenseIssue {
  span: TextSpan;
  expected: TenseExpectation;
  message: string;
}

export interface TenseMarkers {
  past: number;
  future: number;
  present: number;
  perfect: number;
  passivePresent: number;
}

export interface TenseAnalysis {
  expected: TenseExpectation;
  rule: string;
  markers: TenseMarkers;
  issues: TenseIssue[];
}

const PAST_IRREGULAR = new Set([
  "rose", "fell", "grew", "stood", "reached", "peaked", "overtook", "had", "was", "were",
  "began", "went", "saw", "took", "made", "built", "became", "remained", "dropped", "declined",
  "increased", "decreased", "climbed", "doubled", "halved", "accounted", "produced", "used",
  "showed", "started", "ended", "arrived", "spent", "recovered", "collapsed", "expanded",
  "edged", "narrowed", "lost", "gained", "added", "replaced", "constructed", "demolished",
  "converted", "extended", "located", "situated", "comprised", "constituted", "represented",
  "witnessed", "followed", "dipped", "fluctuated", "plateaued", "levelled", "leveled", "held",
  "grew", "kept", "left", "paid", "sent", "spread", "spent", "arose", "shrank", "slid",
]);

const NON_PAST_ED = new Set([
  "indeed", "hundred", "thousand", "speed", "need", "feed", "seed", "weed", "breed", "greed",
  "shed", "embed", "exceed", "proceed", "succeed", "red", "bed", "wed", "used",
]);

const PRESENT_VERBS = new Set([
  "is", "are", "remains", "remain", "stays", "stay", "shows", "show", "illustrates",
  "illustrate", "gives", "give", "consists", "consist", "includes", "include", "begins",
  "begin", "starts", "start", "passes", "pass", "produces", "produce", "goes", "go",
  "travels", "travel", "accounts", "account", "stands", "stand", "holds", "hold",
  "continues", "continue", "has", "have", "flows", "flow", "enters", "enter", "leaves",
  "leave", "takes", "take", "makes", "make", "becomes", "become", "requires", "require",
]);

const PASSIVE_PRESENT =
  /\b(?:is|are)\s+(?:\w+(?:ed|en|wn|ne|lt|nt)|built|made|sent|kept|drawn|grown|shown|taken|given|produced|converted|stored|collected|filtered|treated|delivered|transferred|disposed|melted|crushed|sorted|filled|recycled|extracted|removed|added|mixed|heated|cooled|packed|transported|sold|used|found|left)\b/i;

const FUTURE_FORM =
  /\b(?:will|shall|going\s+to)\b|\b(?:is|are|was|were)\s+(?:expected|predicted|projected|forecast|planned|due|set|likely|anticipated|estimated)\s+to\b/i;

const PERFECT_FORM = /\b(?:has|have|had)\s+(?:\w+(?:ed|en|wn|ne|lt|nt))\b/i;

const AUXILIARIES = new Set(["is", "are", "was", "were", "has", "have", "had", "be", "been", "being"]);

function countTenseMarkers(text: string): TenseMarkers {
  const markers: TenseMarkers = { past: 0, future: 0, present: 0, perfect: 0, passivePresent: 0 };
  let previous = "";
  for (const match of text.matchAll(/[A-Za-z]+(?:'[a-z]+)?/g)) {
    const token = match[0].toLowerCase();
    // A participle after be/have is passive/perfect, not a finite past verb:
    // "is collected", "was built", "has grown" must not satisfy past-simple.
    const afterAuxiliary = AUXILIARIES.has(previous);
    if (PAST_IRREGULAR.has(token)) {
      if (!afterAuxiliary) markers.past += 1;
    } else if (token.length > 4 && token.endsWith("ed") && !NON_PAST_ED.has(token)) {
      if (!afterAuxiliary) markers.past += 1;
    }
    if (PRESENT_VERBS.has(token)) markers.present += 1;
    previous = token;
  }
  if (FUTURE_FORM.test(text)) markers.future += 1;
  if (PERFECT_FORM.test(text)) markers.perfect += 1;
  if (PASSIVE_PRESENT.test(text)) markers.passivePresent += 1;
  return markers;
}

function addMarkers(total: TenseMarkers, part: TenseMarkers): void {
  total.past += part.past;
  total.future += part.future;
  total.present += part.present;
  total.perfect += part.perfect;
  total.passivePresent += part.passivePresent;
}

/** Expected tense from the bank's `timeFrame` (dossier §4.9). */
export function expectedTense(item: Task1Item): TenseExpectation {
  const currentYear = new Date().getFullYear();
  const values = item.timeFrame?.values ?? [];
  const rule = item.timeFrame?.tenseRule ?? "";
  const hasFuture = values.some((value) => value > currentYear);
  const hasPast = values.some((value) => value < currentYear);

  if (item.type === "process") return "present-passive";
  if (item.type === "map") {
    if (hasFuture) return "past+future";
    return /present perfect/i.test(rule) ? "past-or-perfect" : "past";
  }
  if (item.timeFrame?.kind === "no-date") return "present";
  if (hasFuture && hasPast) return "past+future";
  if (hasFuture) return "future";
  return "past";
}

export function analyzeTense(
  item: Task1Item,
  paragraphs: readonly ParagraphSpan[],
  overview: OverviewAnalysis,
): TenseAnalysis {
  const expected = expectedTense(item);
  const sentences = splitAllSentences(paragraphs);
  const markers: TenseMarkers = { past: 0, future: 0, present: 0, perfect: 0, passivePresent: 0 };
  const perSentence = new Map<number, TenseMarkers>();
  for (const sentence of sentences) {
    const counted = countTenseMarkers(sentence.text);
    perSentence.set(sentence.index, counted);
    addMarkers(markers, counted);
  }

  const issues: TenseIssue[] = [];
  const pickEvidence = (preferred: keyof TenseMarkers): TextSpan | null => {
    const body = sentences.filter((sentence) => sentence.paragraphIndex > 0);
    const pool = body.length > 0 ? body : sentences;
    const scored = pool
      .map((sentence) => ({ sentence, markers: perSentence.get(sentence.index)! }))
      .sort((a, b) => b.markers[preferred] - a.markers[preferred]);
    const chosen = scored[0];
    return chosen ? spanOf(chosen.sentence) : null;
  };

  const needsPast = expected === "past" || expected === "past+future" || expected === "past-or-perfect";
  const needsFuture = expected === "future" || expected === "past+future";

  if (needsPast && markers.past + markers.perfect < 2) {
    const span = pickEvidence("present") ?? pickEvidence("past");
    issues.push({
      span: span ?? { start: 0, end: 0, text: "", paragraphIndex: 0 },
      expected,
      message: `The chart needs past forms (${item.timeFrame?.tenseRule ?? "past simple"}), but this sentence has almost no past-tense verb.`,
    });
  }
  if (needsFuture && markers.future < 1) {
    const span = pickEvidence("past") ?? pickEvidence("present");
    issues.push({
      span: span ?? { start: 0, end: 0, text: "", paragraphIndex: 0 },
      expected,
      message:
        "The dates are in the future, so use future forms (is projected to / is expected to / will) instead of the present or past.",
    });
  }
  if (expected === "present" && (markers.present < 2 || markers.past > markers.present)) {
    const span = pickEvidence("past");
    issues.push({
      span: span ?? { start: 0, end: 0, text: "", paragraphIndex: 0 },
      expected,
      message: "There are no dates, so the report needs present simple; this sentence uses past forms.",
    });
  }
  if (
    expected === "present-passive" &&
    (markers.present + markers.passivePresent < 2 || markers.past > markers.present + markers.passivePresent)
  ) {
    const span = pickEvidence("past");
    issues.push({
      span: span ?? { start: 0, end: 0, text: "", paragraphIndex: 0 },
      expected,
      message:
        "A process diagram needs present simple (passive where appropriate); avoid past-tense stage verbs.",
    });
  }

  if (needsPast && overview.present) {
    const overviewMarkers = countTenseMarkers(overview.text);
    if (overviewMarkers.present > 0 && overviewMarkers.past === 0 && overviewMarkers.future === 0) {
      issues.push({
        span: {
          start: overview.start,
          end: overview.end,
          text: overview.text,
          paragraphIndex: overview.paragraphIndex,
        },
        expected,
        message:
          "The overview uses present tense for completed data; use past simple (rose, stood at, reached).",
      });
    }
  }

  return { expected, rule: item.timeFrame?.tenseRule ?? "", markers, issues: issues.slice(0, 3) };
}

/* ------------------------------------------------------------------ */
/* Number, amount and ratio rules (§4.10)                              */
/* ------------------------------------------------------------------ */

export type NumberRuleKind =
  | "million-plural"
  | "amount-countable"
  | "number-uncountable"
  | "half-of"
  | "ratio-usage"
  | "percentage-rate";

export interface NumberRuleHit {
  kind: NumberRuleKind;
  match: string;
  start: number;
  end: number;
  message: string;
  suggestion: string;
}

const UNCOUNTABLE = new Set([
  "accommodation", "advertising", "advice", "aid", "art", "assistance", "cash", "chaos",
  "clothing", "corruption", "courage", "damage", "data", "education", "electricity",
  "employment", "energy", "entertainment", "equipment", "evidence", "furniture", "happiness",
  "health", "homework", "information", "intelligence", "knowledge", "labour", "labor",
  "leisure", "litter", "luggage", "money", "music", "news", "nutrition", "obesity",
  "pollution", "poverty", "progress", "research", "rubbish", "safety", "software", "traffic",
  "transportation", "travel", "unemployment", "violence", "wealth", "weather", "welfare",
  "wildlife", "work", "spending", "expenditure", "water", "waste", "glass", "plastic",
  "paper", "metal", "rainfall", "rain", "oil", "gas", "coal", "food", "crime", "tourism",
  "trade", "time", "electricity", "transport",
]);

const NUMBER_WORD =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";

function sentenceBounds(text: string, offset: number): [number, number] {
  let start = 0;
  for (let i = offset; i > 0; i -= 1) {
    if (/[.!?]/.test(text[i - 1]) && /\s/.test(text[i] ?? "")) {
      start = i;
      break;
    }
  }
  let end = text.length;
  for (let i = offset; i < text.length; i += 1) {
    if (/[.!?]/.test(text[i]) && (i + 1 >= text.length || /\s/.test(text[i + 1]))) {
      end = i + 1;
      break;
    }
  }
  return [start, end];
}

export function analyzeNumberRules(text: string): NumberRuleHit[] {
  const hits: NumberRuleHit[] = [];
  const push = (hit: NumberRuleHit) => hits.push(hit);

  for (const match of text.matchAll(
    new RegExp(`\\b(?:\\d[\\d,.]*|${NUMBER_WORD})\\s+(million|billion)s\\b`, "gi"),
  )) {
    if (match.index === undefined) continue;
    const number = match[0].slice(0, match[0].lastIndexOf(" ")).trim();
    push({
      kind: "million-plural",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"${match[0]}" is wrong — ${match[1]} stays singular after a number.`,
      suggestion: `Write "${number} ${match[1]}" (e.g. "six million", not "six millions").`,
    });
  }

  for (const match of text.matchAll(
    /\bamounts?\s+of\s+(?:the\s+|their\s+|its\s+|our\s+)?([a-z]+)/gi,
  )) {
    if (match.index === undefined) continue;
    const noun = match[1].toLowerCase();
    if (UNCOUNTABLE.has(noun)) continue;
    push({
      kind: "amount-countable",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"amount of ${noun}" is wrong because "${noun}" is countable.`,
      suggestion: `Use "the number of ${noun}".`,
    });
  }

  for (const match of text.matchAll(/\bnumbers?\s+of\s+([a-z]+)/gi)) {
    if (match.index === undefined) continue;
    const noun = match[1].toLowerCase();
    if (!UNCOUNTABLE.has(noun)) continue;
    push({
      kind: "number-uncountable",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"number of ${noun}" is wrong because "${noun}" is uncountable.`,
      suggestion: `Use "the amount of ${noun}".`,
    });
  }

  for (const match of text.matchAll(/\ba\s+half\s+of\b/gi)) {
    if (match.index === undefined) continue;
    push({
      kind: "half-of",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: '"a half of" is non-standard in data reporting.',
      suggestion: 'Write "half of" (or "a quarter / a third").',
    });
  }

  for (const match of text.matchAll(/\bratio\b/gi)) {
    if (match.index === undefined) continue;
    const [start, end] = sentenceBounds(text, match.index);
    const sentence = text.slice(start, end);
    if (/\bto\b|:/.test(sentence)) continue;
    push({
      kind: "ratio-usage",
      match: sentence.trim(),
      start,
      end,
      message: '"ratio" must name both quantities it compares.',
      suggestion: 'Write "the ratio of A to B" (or use a percentage).',
    });
  }

  for (const match of text.matchAll(/\bpercentage\s+rate\b/gi)) {
    if (match.index === undefined) continue;
    push({
      kind: "percentage-rate",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: '"percentage rate" is redundant.',
      suggestion: 'Use "percentage" or "rate".',
    });
  }

  return hits.sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------------------ */
/* Grammar heuristics (bank band-6 defect profiles)                    */
/* ------------------------------------------------------------------ */

export type GrammarRuleKind =
  | "plural-after-number"
  | "article"
  | "subject-verb"
  | "preposition"
  | "map-form";

export interface GrammarHit {
  kind: GrammarRuleKind;
  match: string;
  start: number;
  end: number;
  message: string;
  suggestion: string;
}

const SINGULAR_COUNTABLE = new Set([
  "country", "museum", "subject", "kind", "type", "region", "category", "university",
  "student", "household", "branch", "sector", "item", "material", "facility", "building",
  "area", "town", "village", "city", "road", "bridge", "factory", "shop", "store", "source",
  "stage", "step", "colour", "color", "group", "chart", "graph", "pie", "table", "map",
  "year", "month", "week", "day", "decade", "person", "visitor", "countryside", "field",
]);

function pluralize(noun: string): string {
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(?:s|x|ch|sh)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}

export function analyzeGrammar(text: string): GrammarHit[] {
  const hits: GrammarHit[] = [];
  const push = (hit: GrammarHit) => hits.push(hit);

  for (const match of text.matchAll(
    /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|both|several|many)\s+([a-z]+)\b/gi,
  )) {
    if (match.index === undefined) continue;
    const noun = match[2].toLowerCase();
    if (!SINGULAR_COUNTABLE.has(noun)) continue;
    push({
      kind: "plural-after-number",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"${match[0]}" needs a plural noun.`,
      suggestion: `Write "${match[1]} ${pluralize(noun)}".`,
    });
  }

  for (const match of text.matchAll(
    /\b(?:at|by|until|in)\s+(?:the\s+)?end\s+of\s+(?!the\b)(period|year|decade|graph|chart)\b/gi,
  )) {
    if (match.index === undefined) continue;
    push({
      kind: "article",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `The article is missing before "${match[1]}".`,
      suggestion: `Write "at the end of the ${match[1]}".`,
    });
  }

  for (const match of text.matchAll(
    /\b(?:a|an|the)\s+(?:\w+\s+){0,2}?(hall|building|centre|center|area|estate|beach|road|bridge|campus|library|population|figure|amount|proportion|percentage|town|village|city|country|university|museum|sector|category|region|student|visitor|household|branch|process|stage)\s+(?:in the [a-z]+\s+)?(have|were)\b/gi,
  )) {
    if (match.index === undefined) continue;
    push({
      kind: "subject-verb",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"${match[1]}" is singular but the verb "${match[2]}" is plural.`,
      suggestion: `Use "${match[2] === "were" ? "was" : "has"}", or make the subject plural.`,
    });
  }

  for (const match of text.matchAll(
    /\b(?:increased|decreased|rose|fell|grew|dropped|declined|climbed|expanded|doubled)\s+of\b/gi,
  )) {
    if (match.index === undefined) continue;
    push({
      kind: "preposition",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"${match[0]}" is the wrong preposition.`,
      suggestion: 'Use "increased by" (size of change) or "increased from … to …" (end points).',
    });
  }

  for (const match of text.matchAll(/\b(?:is|are|was|were)\s+locate\b/gi)) {
    if (match.index === undefined) continue;
    push({
      kind: "map-form",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: '"locate" needs its past participle in map descriptions.',
      suggestion: 'Write "is located / is situated".',
    });
  }

  for (const match of text.matchAll(
    /\b(?:was|were)\s+(constructing|building|extending|demolishing|converting|replacing)\b/gi,
  )) {
    if (match.index === undefined) continue;
    push({
      kind: "map-form",
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      message: `"${match[0]}" should be passive for a completed change.`,
      suggestion: `Use "was ${match[1].replace(/ing$/, "ed")}" (e.g. "was constructed").`,
    });
  }

  return hits.sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------------------ */
/* Range / repetition signals                                          */
/* ------------------------------------------------------------------ */

export interface RangeAnalysis {
  /** Distinct complex-structure markers found (although, while, which …). */
  complexMarkers: string[];
  complexCount: number;
  repeatedTerms: Array<{ term: string; count: number }>;
  contentWords: number;
  distinctContentWords: number;
}

const COMPLEX_MARKERS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  { label: "although", regex: /\b(?:although|even though|though)\b/i },
  { label: "while", regex: /\bwhile\b/i },
  { label: "whereas", regex: /\bwhereas\b/i },
  { label: "relative which", regex: /\bwhich\b/i },
  { label: "relative who", regex: /\bwho\b/i },
  { label: "relative whose", regex: /\bwhose\b/i },
  { label: "that-clause", regex: /\bthat\b/i },
  { label: "because", regex: /\bbecause\b/i },
  { label: "if", regex: /\bif\b/i },
  { label: "when", regex: /\bwhen\b/i },
  { label: "before/after", regex: /\b(?:before|after)\b/i },
  { label: "despite", regex: /\b(?:despite|in spite of)\b/i },
  { label: "compared with", regex: /\bcompared (?:with|to)\b/i },
  { label: "rather than", regex: /\brather than\b/i },
  { label: "not only", regex: /\bnot only\b/i },
  { label: "so that", regex: /\bso that\b/i },
  {
    label: "comparative than",
    regex: /\b(?:more|less|fewer|faster|slower|higher|lower|larger|smaller|greater)\s+than\b/i,
  },
  { label: "so-clause", regex: /\bso\s+(?:the|it|they|this|that|these|those|there|its|their)\b/i },
  { label: "participial clause", regex: /,\s*[a-z]+(?:ing|ed)\b/i },
  { label: "with-clause", regex: /\bwith\s+[a-z]+\s+[a-z]+(?:ed|ing)\b/i },
];

function itemVocabulary(item: Task1Item): Set<string> {
  const words = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    for (const token of scanContentTokens(value)) words.add(token.canonical);
  };
  add(item.statement);
  for (const category of item.categories ?? []) add(category);
  for (const series of item.series ?? []) add(series.name);
  for (const slice of item.slices ?? []) add(slice.label);
  for (const area of item.areas ?? []) add(area.name);
  for (const feature of item.features ?? []) add(feature);
  for (const stage of item.stages ?? []) add(stage.name);
  for (const row of item.rows ?? []) add(row);
  for (const column of item.columns ?? []) add(column);
  for (const sub of item.subCharts ?? []) {
    for (const token of itemVocabulary(sub)) words.add(token);
  }
  return words;
}

export function analyzeRange(item: Task1Item, text: string): RangeAnalysis {
  const complexMarkers = COMPLEX_MARKERS.filter((marker) => marker.regex.test(text)).map(
    (marker) => marker.label,
  );

  const excluded = itemVocabulary(item);
  const counts = new Map<string, { term: string; count: number }>();
  const tokens = scanContentTokens(text);
  for (const token of tokens) {
    if (excluded.has(token.canonical) || token.canonical.length < 4) continue;
    const entry = counts.get(token.canonical);
    if (entry) entry.count += 1;
    else counts.set(token.canonical, { term: token.raw.toLowerCase(), count: 1 });
  }
  const repeatedTerms = [...counts.values()]
    .filter((entry) => entry.count >= 5)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const distinct = new Set(tokens.map((token) => token.canonical));

  return {
    complexMarkers,
    complexCount: complexMarkers.length,
    repeatedTerms,
    contentWords: tokens.length,
    distinctContentWords: distinct.size,
  };
}

/* ------------------------------------------------------------------ */
/* Opinion detection (T1 is a factual report)                          */
/* ------------------------------------------------------------------ */

export interface OpinionHit {
  match: string;
  start: number;
  end: number;
}

const OPINION_PATTERNS: readonly RegExp[] = [
  /\bin my (?:opinion|view)\b/gi,
  /\b(?:i|we)\s+(?:think|believe|feel|agree|disagree|admit|concur)\b/gi,
  /\b(?:should|must|ought to)\b/gi,
  /\bthe best (?:way|option|choice)\b/gi,
  /\bit is (?:clear|obvious|better|best)\b/gi,
];

export function analyzeOpinion(text: string): OpinionHit[] {
  const hits: OpinionHit[] = [];
  for (const pattern of OPINION_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      hits.push({ match: match[0], start: match.index, end: match.index + match[0].length });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}
