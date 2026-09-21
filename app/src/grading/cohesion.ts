/**
 * Cohesion analysis for grading: paragraph and sentence spans with character
 * offsets, linkers grouped by the nine dossier §8.3 functions, mechanical
 * "Firstly / Secondly" detection and the sentence-initial linker ratio.
 *
 * Everything is offset-preserving so a feedback item can quote the exact
 * sentence that fired a Coherence & Cohesion check.
 */

export type LinkerFunction =
  | "listing"
  | "addition"
  | "example"
  | "result"
  | "stress"
  | "contrast"
  | "cause"
  | "opinion"
  | "conclusion";

export const LINKER_FUNCTIONS: readonly LinkerFunction[] = [
  "listing",
  "addition",
  "example",
  "result",
  "stress",
  "contrast",
  "cause",
  "opinion",
  "conclusion",
];

/**
 * Dossier §8.3 linker bank. Bare "and" is kept (the dossier lists it under
 * adding) but ambiguous connectives ("as", "first", "then") are deliberately
 * excluded so the sentence-initial ratio is not inflated by ordinary grammar.
 */
export const LINKER_BANK: Readonly<Record<LinkerFunction, readonly string[]>> = {
  listing: [
    "firstly",
    "secondly",
    "thirdly",
    "finally",
    "lastly",
    "last but not least",
    "first of all",
    "to begin with",
    "another point to consider",
    "a further consideration",
    "another issue",
  ],
  addition: [
    "in addition",
    "additionally",
    "furthermore",
    "moreover",
    "also",
    "as well as",
    "not only",
    "but also",
    "and",
  ],
  example: [
    "for example",
    "for instance",
    "such as",
    "namely",
    "to illustrate",
    "in other words",
    "one clear example is",
  ],
  result: ["as a result", "consequently", "therefore", "thus", "hence", "for this reason", "so"],
  stress: [
    "particularly",
    "in particular",
    "specifically",
    "especially",
    "obviously",
    "of course",
    "clearly",
  ],
  contrast: [
    "admittedly",
    "however",
    "nevertheless",
    "even though",
    "although",
    "though",
    "despite",
    "in spite of",
    "whereas",
    "while",
    "on the other hand",
    "by contrast",
    "in contrast",
    "in comparison",
    "compared to",
    "compared with",
    "alternatively",
    "but",
    "still",
  ],
  cause: ["because", "owing to", "due to", "since"],
  opinion: [
    "in my opinion",
    "in my view",
    "i think",
    "i believe",
    "i feel",
    "i admit",
    "i concur",
    "i agree",
    "i disagree",
    "i cannot accept",
  ],
  conclusion: ["in conclusion", "to conclude"],
};

/* ------------------------------------------------------------------ */
/* Spans                                                               */
/* ------------------------------------------------------------------ */

export interface SentenceSpan {
  /** Sentence index across the whole text (0-based, document order). */
  index: number;
  paragraphIndex: number;
  /** First non-whitespace character. */
  start: number;
  /** Exclusive end, trailing whitespace removed. */
  end: number;
  trimmedStart: number;
  text: string;
}

export interface ParagraphSpan {
  index: number;
  /** First non-whitespace character. */
  start: number;
  /** Exclusive end, trailing whitespace removed. */
  end: number;
  text: string;
  sentences: SentenceSpan[];
}

export interface LinkerHit {
  fn: LinkerFunction;
  /** Matched text, original casing. */
  linker: string;
  start: number;
  end: number;
  paragraphIndex: number;
  sentenceIndex: number;
  /** True when the linker is the first token of its sentence. */
  sentenceInitial: boolean;
}

export interface MechanicalLinkers {
  mechanical: boolean;
  /** Paragraphs opened with a listing linker. */
  listingParagraphs: number[];
  evidence: LinkerHit[];
  note: string;
}

export interface CohesionAnalysis {
  paragraphs: ParagraphSpan[];
  sentences: SentenceSpan[];
  linkers: LinkerHit[];
  /** Distinct functions used, in bank order. */
  functions: LinkerFunction[];
  functionCounts: Record<LinkerFunction, number>;
  /** Sentences whose first token is a linker. */
  initialSentences: number;
  initialRatio: number;
  mechanical: MechanicalLinkers;
}

/* ------------------------------------------------------------------ */
/* Paragraph + sentence splitting                                      */
/* ------------------------------------------------------------------ */

const BLANK_LINE = /\n[ \t]*\r?\n/g;
const SINGLE_LINE = /\n+/g;

function isSpace(ch: string | undefined): boolean {
  return ch !== undefined && /\s/.test(ch);
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function skipForward(text: string, from: number, to: number): number {
  let i = from;
  while (i < to && isSpace(text[i])) i += 1;
  return i;
}

function skipBackward(text: string, from: number, to: number): number {
  let i = to;
  while (i > from && isSpace(text[i - 1])) i -= 1;
  return i;
}

function splitRanges(text: string, pattern: RegExp): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let last = 0;
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    ranges.push([last, match.index]);
    last = match.index + match[0].length;
  }
  ranges.push([last, text.length]);
  return ranges;
}

function paragraphRanges(text: string): Array<[number, number]> {
  const blankSplit = splitRanges(text, BLANK_LINE);
  if (blankSplit.length > 1) return blankSplit;
  return splitRanges(text, SINGLE_LINE);
}

function splitSentencesInRange(
  text: string,
  start: number,
  end: number,
  paragraphIndex: number,
  baseIndex: number,
  out: SentenceSpan[],
): void {
  const push = (from: number, to: number) => {
    const s = skipForward(text, from, to);
    const e = skipBackward(text, from, to);
    if (s >= e) return;
    out.push({
      index: baseIndex + out.length,
      paragraphIndex,
      start: s,
      end: e,
      trimmedStart: s,
      text: text.slice(s, e),
    });
  };

  let cursor = start;
  let i = start;
  while (i < end) {
    const ch = text[i];
    if (ch === "\n") {
      push(cursor, i);
      cursor = i + 1;
      i += 1;
      continue;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      const prev = text[i - 1];
      const next = text[i + 1];
      const decimal = ch === "." && isDigit(prev) && isDigit(next);
      if (!decimal && (next === undefined || isSpace(next))) {
        push(cursor, i + 1);
        i += 1;
        while (i < end && isSpace(text[i]) && text[i] !== "\n") i += 1;
        cursor = i;
        continue;
      }
    }
    i += 1;
  }
  push(cursor, end);
}

/** Splits text into paragraphs (blank-line first, then single newlines). */
export function splitParagraphs(text: string): ParagraphSpan[] {
  const paragraphs: ParagraphSpan[] = [];
  let sentenceCounter = 0;
  for (const [rawStart, rawEnd] of paragraphRanges(text)) {
    const start = skipForward(text, rawStart, rawEnd);
    const end = skipBackward(text, rawStart, rawEnd);
    if (start >= end) continue;
    const sentences: SentenceSpan[] = [];
    splitSentencesInRange(text, start, end, paragraphs.length, sentenceCounter, sentences);
    sentenceCounter += sentences.length;
    paragraphs.push({
      index: paragraphs.length,
      start,
      end,
      text: text.slice(start, end),
      sentences,
    });
  }
  return paragraphs;
}

/** Flattens every paragraph's sentences; useful when only spans are needed. */
export function splitAllSentences(paragraphs: readonly ParagraphSpan[]): SentenceSpan[] {
  return paragraphs.flatMap((paragraph) => paragraph.sentences);
}

/* ------------------------------------------------------------------ */
/* Linker detection                                                    */
/* ------------------------------------------------------------------ */

interface LinkerRule {
  fn: LinkerFunction;
  phrase: string;
  regex: RegExp;
}

function escapePhrase(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

const LINKER_RULES: readonly LinkerRule[] = LINKER_FUNCTIONS.flatMap((fn) =>
  LINKER_BANK[fn].map((phrase) => ({
    fn,
    phrase,
    regex: new RegExp(`\\b${escapePhrase(phrase)}\\b`, "gi"),
  })),
);

function sentenceAt(sentences: readonly SentenceSpan[], offset: number): SentenceSpan | null {
  let found: SentenceSpan | null = null;
  for (const sentence of sentences) {
    if (sentence.start <= offset) found = sentence;
    if (sentence.start > offset) break;
  }
  return found;
}

/** Deduplicates overlapping matches, keeping the longest phrase at each position. */
function dedupeHits(hits: LinkerHit[]): LinkerHit[] {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: LinkerHit[] = [];
  let lastEnd = -1;
  for (const hit of sorted) {
    if (hit.start < lastEnd) continue;
    kept.push(hit);
    lastEnd = hit.end;
  }
  return kept;
}

/** Finds every linker hit with offsets and sentence attribution. */
export function findLinkers(text: string, sentences: readonly SentenceSpan[]): LinkerHit[] {
  const hits: LinkerHit[] = [];
  for (const rule of LINKER_RULES) {
    for (const match of text.matchAll(rule.regex)) {
      if (match.index === undefined || !match[0]) continue;
      const start = match.index;
      const end = start + match[0].length;
      const sentence = sentenceAt(sentences, start);
      if (!sentence) continue;
      hits.push({
        fn: rule.fn,
        linker: match[0],
        start,
        end,
        paragraphIndex: sentence.paragraphIndex,
        sentenceIndex: sentence.index,
        sentenceInitial: start <= sentence.trimmedStart,
      });
    }
  }
  return dedupeHits(hits);
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

function emptyFunctionCounts(): Record<LinkerFunction, number> {
  return {
    listing: 0,
    addition: 0,
    example: 0,
    result: 0,
    stress: 0,
    contrast: 0,
    cause: 0,
    opinion: 0,
    conclusion: 0,
  };
}

/** Full cohesion read of a submitted answer. */
export function analyzeCohesion(text: string): CohesionAnalysis {
  const paragraphs = splitParagraphs(text);
  const sentences = splitAllSentences(paragraphs);
  const linkers = findLinkers(text, sentences);

  const functionCounts = emptyFunctionCounts();
  for (const hit of linkers) functionCounts[hit.fn] += 1;
  const functions = LINKER_FUNCTIONS.filter((fn) => functionCounts[fn] > 0);

  const initialIndexes = new Set<number>();
  for (const hit of linkers) {
    if (hit.sentenceInitial) initialIndexes.add(hit.sentenceIndex);
  }
  const initialSentences = initialIndexes.size;
  const initialRatio = sentences.length > 0 ? initialSentences / sentences.length : 0;

  const listingByParagraph = new Map<number, LinkerHit>();
  for (const hit of linkers) {
    if (hit.fn !== "listing" || !hit.sentenceInitial) continue;
    const paragraph = paragraphs[hit.paragraphIndex];
    const first = paragraph?.sentences[0];
    if (!first || hit.start > first.trimmedStart) continue;
    if (!listingByParagraph.has(hit.paragraphIndex)) listingByParagraph.set(hit.paragraphIndex, hit);
  }
  const listingParagraphs = [...listingByParagraph.keys()].sort((a, b) => a - b);
  const evidence = listingParagraphs.map((index) => listingByParagraph.get(index)!);
  const mechanical: MechanicalLinkers = {
    mechanical: listingParagraphs.length >= 2,
    listingParagraphs,
    evidence,
    note:
      listingParagraphs.length >= 2
        ? `Paragraphs ${listingParagraphs.map((i) => i + 1).join(" and ")} open with a listing linker; "Firstly / Secondly" for every paragraph is mechanical at band 7+.`
        : "No mechanical listing pattern detected.",
  };

  return {
    paragraphs,
    sentences,
    linkers,
    functions,
    functionCounts,
    initialSentences,
    initialRatio,
    mechanical,
  };
}
