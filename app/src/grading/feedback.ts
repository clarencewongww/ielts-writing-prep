/**
 * Feedback normalisation, priority sorting and model-answer proximity.
 *
 * Two graders produce feedback in different shapes:
 *  - Task 1 (4a) attaches a **string** `evidenceSpan` (the quote only);
 *  - Task 2 emits `{startChar, endChar, text}` objects.
 * The adapters below turn both into the unified `FeedbackItem` (types/grading.ts)
 * with character offsets into the submission, so one UI component can highlight
 * either task. `prioritizeFeedback` implements the dossier rule "max one item per
 * failed gate, TR caps → paragraphing → density → range".
 */

import { normalizeForMatch } from "../data/wordCount";
import type { Criterion, FeedbackItem, Severity } from "../types/grading";
import type { Task1FeedbackStarter, Task2Feedback } from "../types/bank";

export { nearestModel } from "./nearestModel";
export type { NearestModelInput, NearestModelResult, IdeaMatch, ModelReference } from "./nearestModel";

export interface ResolvedSpan {
  startChar: number;
  endChar: number;
  text: string;
}

/* ------------------------------------------------------------------ */
/* Span normalisation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Finds `needle` in `text` and returns validated offsets. Tries exact match,
 * case-insensitive match, then a punctuation-insensitive normalised match.
 */
export function locateSpan(text: string, needle: string, from = 0): ResolvedSpan | null {
  if (!text || !needle) return null;
  const exact = text.indexOf(needle, from);
  if (exact >= 0) return { startChar: exact, endChar: exact + needle.length, text: needle };

  const lowered = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const insensitive = lowered.indexOf(lowerNeedle, from);
  if (insensitive >= 0) {
    return {
      startChar: insensitive,
      endChar: insensitive + needle.length,
      text: text.slice(insensitive, insensitive + needle.length),
    };
  }

  const haystack = normalizeForMatch(text);
  const target = normalizeForMatch(needle);
  if (!target.text) return null;
  const at = haystack.text.indexOf(target.text, from);
  if (at === -1) return null;
  const start = haystack.map[at] ?? 0;
  const end = (haystack.map[at + target.text.length - 1] ?? start) + 1;
  return { startChar: start, endChar: end, text: text.slice(start, end) };
}

function clampSpan(text: string, span: { startChar: number; endChar: number; text?: string }): ResolvedSpan {
  const start = Math.max(0, Math.min(span.startChar, text.length));
  const end = Math.max(start, Math.min(span.endChar, text.length));
  const sliced = text.slice(start, end);
  return { startChar: start, endChar: end, text: sliced || span.text || "" };
}

export type SpanInput = string | { startChar: number; endChar: number; text?: string } | null | undefined;

/** Normalises any span shape into validated offsets inside `submission`. */
export function normalizeSpan(submission: string, span: SpanInput): ResolvedSpan | null {
  if (span == null) return null;
  if (typeof span === "string") return locateSpan(submission, span);
  const clamped = clampSpan(submission, span);
  if (clamped.text) return clamped;
  return locateSpan(submission, span.text ?? "");
}

const CRITERIA: readonly Criterion[] = ["TA", "TR", "CC", "LR", "GRA"];

export function asCriterion(value: string | undefined, fallback: Criterion): Criterion {
  if (!value) return fallback;
  const upper = value.toUpperCase() as Criterion;
  return CRITERIA.includes(upper) ? upper : fallback;
}

export function asSeverity(value: string | undefined, fallback: Severity): Severity {
  if (value === "cap" || value === "error" || value === "upgrade") return value;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Task 1 adapter (string span)                                        */
/* ------------------------------------------------------------------ */

export interface T1FeedbackLike {
  criterion?: string;
  band?: number;
  checkId?: string;
  severity?: string;
  /** Reference answers store the quote; 4a's grader may store offsets. */
  evidenceSpan?: SpanInput;
  feedbackStarter?: string;
  /** Some shapes call the starter `text`. */
  text?: string;
  fixSuggestion?: string;
}

/**
 * Converts a Task 1 feedback object (string evidence span) into a `FeedbackItem`.
 * Returns `null` when the quote cannot be located in the submission.
 */
export function normalizeT1Feedback(
  feedback: T1FeedbackLike,
  submission: string,
  defaults: { band?: number; checkId?: string; criterion?: Criterion; severity?: Severity } = {},
): FeedbackItem | null {
  const span = normalizeSpan(submission, feedback.evidenceSpan);
  if (!span) return null;
  const criterion = asCriterion(feedback.criterion, defaults.criterion ?? "TA");
  return {
    criterion,
    band: feedback.band ?? defaults.band ?? 6,
    checkId: feedback.checkId ?? defaults.checkId ?? "t1.feedback",
    severity: asSeverity(feedback.severity, defaults.severity ?? "upgrade"),
    evidenceSpan: span,
    feedbackStarter: feedback.feedbackStarter ?? feedback.text ?? span.text,
    fixSuggestion: feedback.fixSuggestion,
  };
}

/** Adapts the bank's `Task1FeedbackStarter` from a reference answer. */
export function referenceStarterToItem(
  starter: Task1FeedbackStarter,
  submission: string,
  band: number,
): FeedbackItem | null {
  return normalizeT1Feedback(
    {
      criterion: starter.criterion,
      band,
      checkId: `t1.reference.b${band}`,
      severity: "upgrade",
      evidenceSpan: starter.evidenceSpan,
      feedbackStarter: starter.text,
    },
    submission,
  );
}

/* ------------------------------------------------------------------ */
/* Task 2 adapter (object span)                                        */
/* ------------------------------------------------------------------ */

/** Converts a bank Task 2 feedback object into a validated `FeedbackItem`. */
export function task2FeedbackToItem(feedback: Task2Feedback, submission: string): FeedbackItem | null {
  const span = normalizeSpan(submission, feedback.evidenceSpan);
  if (!span) return null;
  return {
    criterion: asCriterion(feedback.criterion, "TR"),
    band: feedback.band,
    checkId: feedback.checkId,
    severity: asSeverity(feedback.severity, "upgrade"),
    evidenceSpan: span,
    feedbackStarter: feedback.feedbackStarter,
    fixSuggestion: feedback.fixSuggestion,
  };
}

/* ------------------------------------------------------------------ */
/* List adapter (Task 1 string spans + Task 2 object spans)            */
/* ------------------------------------------------------------------ */

export interface LooseFeedback {
  criterion?: string;
  band?: number;
  checkId?: string;
  severity?: string;
  evidenceSpan?: SpanInput;
  feedbackStarter?: string;
  fixSuggestion?: string;
}

/**
 * Normalises a mixed feedback list (Task 1 string spans, Task 2 object spans or
 * already-unified items) and drops entries whose quote cannot be located.
 */
export function normalizeFeedbackList(
  items: readonly (FeedbackItem | LooseFeedback)[] | null | undefined,
  submission: string,
): FeedbackItem[] {
  if (!items || items.length === 0) return [];
  const out: FeedbackItem[] = [];
  for (const item of items) {
    const span = normalizeSpan(submission, item.evidenceSpan);
    if (!span) continue;
    out.push({
      criterion: asCriterion(item.criterion, "TR"),
      band: typeof item.band === "number" ? item.band : 6,
      checkId: item.checkId ?? "feedback",
      severity: asSeverity(item.severity, "upgrade"),
      evidenceSpan: span,
      feedbackStarter: item.feedbackStarter ?? span.text,
      fixSuggestion: item.fixSuggestion,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Priority sorting                                                    */
/* ------------------------------------------------------------------ */

/** Rank of the gate a feedback item belongs to (lower fires first). */
export function feedbackGateRank(checkId: string): number {
  const id = checkId.toLowerCase();
  if (id.startsWith("t2.words") || id.startsWith("t2.structure.conclusion") || id.startsWith("t2.tr.")) return 0;
  if (id.startsWith("t2.structure") || id.startsWith("t2.cc.paragraph") || id.startsWith("t2.cc.bodies") || id.startsWith("t2.cc.mechanical")) {
    return 1;
  }
  if (
    id.startsWith("t2.tr.development") ||
    id.startsWith("t2.tr.ideas") ||
    id.startsWith("t2.lr.repetition") ||
    id.startsWith("t2.lr.range") ||
    id.startsWith("t2.cc.links") ||
    id.startsWith("t2.cc.topics")
  ) {
    return 2;
  }
  if (id.startsWith("t2.lr.") || id.startsWith("t2.gra.")) return 3;
  return 4;
}

const SEVERITY_RANK: Record<Severity, number> = { cap: 0, error: 1, upgrade: 2 };

/** Lower is more urgent: gate first (TR caps → paragraph → density → range), then severity. */
export function feedbackPriority(item: FeedbackItem): number {
  return feedbackGateRank(item.checkId) * 10 + SEVERITY_RANK[item.severity];
}

export interface PrioritizeOptions {
  /** Keep at most this many items per `checkId` gate (dossier: one per failed gate). */
  maxPerGate?: number;
  /** Hard cap on the total number of items returned. */
  limit?: number;
}

/**
 * Sorts feedback by gate priority and keeps at most `maxPerGate` items per gate
 * (default 1). Ties break by position in the essay so the earliest evidence shows.
 */
export function prioritizeFeedback(
  items: readonly FeedbackItem[],
  options: PrioritizeOptions = {},
): FeedbackItem[] {
  const maxPerGate = options.maxPerGate ?? 1;
  const limit = options.limit ?? 12;
  const sorted = [...items].sort(
    (a, b) =>
      feedbackPriority(a) - feedbackPriority(b) ||
      a.evidenceSpan.startChar - b.evidenceSpan.startChar ||
      a.checkId.localeCompare(b.checkId),
  );

  const kept: FeedbackItem[] = [];
  const perGate = new Map<string, number>();
  const seen = new Set<string>();

  for (const item of sorted) {
    if (kept.length >= limit) break;
    const gate = item.checkId;
    const used = perGate.get(gate) ?? 0;
    if (used >= maxPerGate) continue;
    const key = `${gate}:${item.evidenceSpan.startChar}:${item.evidenceSpan.endChar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    perGate.set(gate, used + 1);
    kept.push(item);
  }
  return kept;
}
