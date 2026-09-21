/**
 * Deterministic text maths shared by the word counter, the copy detector and the grader.
 *
 * `countWords` is deliberately a whitespace split so it matches the `wordCount`
 * values stored in the bank (verified for all 174 reference answers at boot).
 */

import {
  BANNED_PHRASE_RULES,
  COPY_RUN_MIN_WORDS,
  type BannedPhraseRule,
} from "../constants";
import type { SliceData } from "../types/bank";

/* ------------------------------------------------------------------ */
/* Word counting                                                       */
/* ------------------------------------------------------------------ */

/** Bank-compatible word count: whitespace-delimited tokens, trimmed. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export interface WordToken {
  /** Lower-cased, punctuation-stripped comparison form. */
  word: string;
  /** Original token as it appeared in the text. */
  raw: string;
  start: number;
  end: number;
}

const TOKEN_PATTERN = /\S+/g;

/** Whitespace tokens with offsets, used for copied-run detection. */
export function tokenizeWords(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    tokens.push({ word: cleanToken(raw), raw, start, end: start + raw.length });
  }
  return tokens;
}

function cleanToken(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9']/g, "");
  return cleaned || raw.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Copied prompt runs                                                  */
/* ------------------------------------------------------------------ */

export interface CopiedRun {
  /** Offset into the answer text. */
  start: number;
  /** Exclusive end offset into the answer text. */
  end: number;
  words: number;
  text: string;
}

/**
 * Finds contiguous runs of `minRun`+ words copied from the prompt.
 * Runs are matched on cleaned tokens so punctuation/case do not hide a copy.
 */
export function findCopiedRuns(
  text: string,
  promptText: string,
  minRun: number = COPY_RUN_MIN_WORDS,
): CopiedRun[] {
  if (!text || !promptText || minRun < 1) return [];
  const answer = tokenizeWords(text);
  const prompt = tokenizeWords(promptText);
  if (answer.length === 0 || prompt.length === 0) return [];

  const promptIndex = new Map<string, number[]>();
  prompt.forEach((token, i) => {
    const positions = promptIndex.get(token.word);
    if (positions) positions.push(i);
    else promptIndex.set(token.word, [i]);
  });

  const runs: CopiedRun[] = [];
  let i = 0;
  while (i < answer.length) {
    let bestLength = 0;
    for (const j of promptIndex.get(answer[i].word) ?? []) {
      let length = 0;
      while (
        i + length < answer.length &&
        j + length < prompt.length &&
        answer[i + length].word === prompt[j + length].word
      ) {
        length += 1;
      }
      if (length > bestLength) bestLength = length;
    }
    if (bestLength >= minRun) {
      const start = answer[i].start;
      const end = answer[i + bestLength - 1].end;
      runs.push({ start, end, words: bestLength, text: text.slice(start, end) });
      i += bestLength;
    } else {
      i += 1;
    }
  }
  return runs;
}

export function countCopiedWords(runs: readonly CopiedRun[]): number {
  return runs.reduce((total, run) => total + run.words, 0);
}

/**
 * Word count with question text excluded (IELTS counting rules).
 * Returns the net count; use `findCopiedRuns` when the spans are needed.
 */
export function countNetWords(
  text: string,
  promptText: string,
  minRun: number = COPY_RUN_MIN_WORDS,
): number {
  const runs = findCopiedRuns(text, promptText, minRun);
  return Math.max(0, countWords(text) - countCopiedWords(runs));
}

/* ------------------------------------------------------------------ */
/* Banned phrases                                                      */
/* ------------------------------------------------------------------ */

export interface BannedPhraseHit {
  /** 1-based index into the bank's 12-entry banned list. */
  ruleIndex: number;
  /** Canonical manifest entry. */
  phrase: string;
  /** The slash-expanded alternative that matched. */
  alternative: string;
  /** Exact text matched in the input (original casing). */
  match: string;
  start: number;
  end: number;
  /** Advisory hits never cap a band (entry 12: idioms, quotes, proverbs). */
  advisory: boolean;
}

interface NormalizedText {
  text: string;
  /** normalized char index -> original char index */
  map: number[];
}

/**
 * Lower-cases, collapses punctuation to single spaces and maps every normalized
 * character back to its original offset so evidence spans stay accurate.
 */
export function normalizeForMatch(input: string): NormalizedText {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i += 1) {
    const raw = input[i];
    const lower = raw.toLowerCase();
    if (/[a-z0-9]/.test(lower)) {
      if (pendingSpace && text.length > 0) {
        text += " ";
        map.push(i);
      }
      pendingSpace = false;
      text += lower;
      map.push(i);
    } else if (raw === "'" || raw === "\u2019" || raw === "\u2018" || raw === "\u02bc") {
      if (!pendingSpace && /[a-z0-9]$/.test(text)) {
        text += "'";
        map.push(i);
      }
    } else {
      pendingSpace = text.length > 0;
    }
  }
  return { text, map };
}

/**
 * Finds banned/memorised phrases. Entries 4, 7 and 9 hold slash-separated options and
 * are expanded first; entry 12 is advisory only and reported separately.
 */
export function checkBannedPhrases(
  text: string,
  rules: readonly BannedPhraseRule[] = BANNED_PHRASE_RULES,
): BannedPhraseHit[] {
  const hits: BannedPhraseHit[] = [];
  if (!text || !text.trim()) return hits;

  const normalized = normalizeForMatch(text);
  const seen = new Set<string>();

  const push = (hit: BannedPhraseHit) => {
    const key = `${hit.ruleIndex}:${hit.start}:${hit.end}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  for (const rule of rules) {
    for (const alternative of rule.alternatives) {
      const needle = normalizeForMatch(alternative).text;
      if (!needle) continue;
      let from = 0;
      for (;;) {
        const at = normalized.text.indexOf(needle, from);
        if (at === -1) break;
        const start = normalized.map[at] ?? 0;
        const end = (normalized.map[at + needle.length - 1] ?? start) + 1;
        push({
          ruleIndex: rule.index,
          phrase: rule.phrase,
          alternative,
          match: text.slice(start, end),
          start,
          end,
          advisory: rule.advisory,
        });
        from = at + needle.length;
      }
    }

    for (const pattern of rule.patterns ?? []) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined) continue;
        const start = match.index;
        const end = start + match[0].length;
        push({
          ruleIndex: rule.index,
          phrase: rule.phrase,
          alternative: match[0],
          match: match[0],
          start,
          end,
          advisory: rule.advisory,
        });
      }
    }
  }

  return hits.sort((a, b) => a.start - b.start || a.ruleIndex - b.ruleIndex);
}

/* ------------------------------------------------------------------ */
/* Pie validation                                                      */
/* ------------------------------------------------------------------ */

export interface PieSumGroup {
  year: number | string | null;
  sum: number;
}

export interface PieSumResult {
  ok: boolean;
  /** Expected total per pie (`item.whole`, defaults to 100). */
  whole: number;
  groups: PieSumGroup[];
  maxDeviation: number;
}

/**
 * Sums `slices.percent` per year and checks each pie against `whole`.
 * Used by the boot validator; renderers can reuse it for sanity checks.
 */
export function pieSums(item: { slices?: SliceData[] | null; whole?: number | null }): PieSumResult {
  const whole = typeof item.whole === "number" ? item.whole : 100;
  const byYear = new Map<string, PieSumGroup>();

  for (const slice of item.slices ?? []) {
    if (!slice) continue;
    const year = slice.year ?? null;
    const key = year === null ? "__unknown__" : String(year);
    const bucket = byYear.get(key) ?? { year, sum: 0 };
    bucket.sum += typeof slice.percent === "number" ? slice.percent : 0;
    byYear.set(key, bucket);
  }

  const groups = Array.from(byYear.values()).map((group) => ({
    year: group.year,
    sum: Math.round(group.sum * 1000) / 1000,
  }));
  const maxDeviation = groups.reduce((max, group) => Math.max(max, Math.abs(group.sum - whole)), 0);

  return {
    ok: groups.length > 0 && maxDeviation < 0.001,
    whole,
    groups,
    maxDeviation: Math.round(maxDeviation * 1000) / 1000,
  };
}

/* ------------------------------------------------------------------ */
/* Word-count classification (WordCounter styling + grader reuse)       */
/* ------------------------------------------------------------------ */

export type WordCountLevel = "under" | "target" | "over" | "over-ceiling";

export interface WordCountInput {
  min: number;
  target: [number, number];
  ceiling: number;
  /** Optional "writing too much" warning line (Task 1 uses 200, Task 2 uses the ceiling). */
  warn?: number;
}

export interface WordCountStatus {
  count: number;
  level: WordCountLevel;
  message: string;
  /** True once the count passes the optional warning line but is still under the ceiling. */
  overWarn: boolean;
}

/**
 * Visual contract: amber below `min`, green inside `target`, neutral between the
 * target and the ceiling, red above the ceiling.
 */
export function classifyWordCount(count: number, input: WordCountInput): WordCountStatus {
  const [targetMin, targetMax] = input.target;
  const warn = input.warn ?? input.ceiling;
  const overWarn = count > warn && count <= input.ceiling;

  if (count < input.min) {
    const short = input.min - count;
    return {
      count,
      level: "under",
      overWarn: false,
      message: `${count} words — ${short} below the ${input.min}-word minimum.`,
    };
  }
  if (count <= targetMax) {
    return {
      count,
      level: "target",
      overWarn: false,
      message: `${count} words — within the ${targetMin}–${targetMax} target band.`,
    };
  }
  if (count > input.ceiling) {
    return {
      count,
      level: "over-ceiling",
      overWarn: false,
      message: `${count} words — over the ${input.ceiling}-word ceiling; trim rather than add detail.`,
    };
  }
  return {
    count,
    level: "over",
    overWarn,
    message: overWarn
      ? `${count} words — past the ${warn}-word warning line and close to the ${input.ceiling} ceiling.`
      : `${count} words — above the ${targetMax} target but still under the ${input.ceiling} ceiling.`,
  };
}
