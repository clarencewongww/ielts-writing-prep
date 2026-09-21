/**
 * Evidence-span renderer for the report.
 *
 * Task 2 feedback carries `{startChar, endChar, text}`; Task 1 feedback carries a
 * plain string quote. `EvidenceSpan` accepts both, locates the passage and wraps
 * it in a `<mark>`; `EvidenceExcerpt` renders just the marked sentence with a
 * little context so the candidate sees exactly which words the feedback refers to.
 */

import { normalizeSpan } from "../grading/feedback";
import { cx } from "../tasks/format";

export interface SpanLike {
  startChar: number;
  endChar: number;
  text?: string;
}

export type EvidenceSpanInput = SpanLike | string | null | undefined;

/* Evidence highlighting is a selection, so it borrows the accent-soft tint
   rather than a one-off yellow: one colour, one meaning (color.md › Best
   practices). `box-decoration-clone` gives each line of a multi-line quote its
   own rounded tint instead of one box spanning the whole span. Text stays ink
   at 13.4:1 on the soft tint (dark) / 14.9:1 (light). */
const MARK_CLASS = "box-decoration-clone rounded-[3px] bg-tint-soft px-0.5 text-ink";

/** Renders `text` with the matched span highlighted. */
export function EvidenceSpan({
  text,
  span,
  className,
  markClassName,
  block = false,
}: {
  text: string;
  span?: EvidenceSpanInput;
  className?: string;
  markClassName?: string;
  /** Use `pre-wrap` block layout (for full-essay views). */
  block?: boolean;
}) {
  const resolved = normalizeSpan(text, span ?? null);
  if (!resolved) {
    return (
      <span className={cx(block && "whitespace-pre-wrap", className)} data-testid="evidence-span">
        {text}
      </span>
    );
  }
  const before = text.slice(0, resolved.startChar);
  const hit = text.slice(resolved.startChar, resolved.endChar);
  const after = text.slice(resolved.endChar);
  return (
    <span className={cx(block && "whitespace-pre-wrap", className)} data-testid="evidence-span">
      {before}
      <mark data-testid="evidence-mark" className={cx(MARK_CLASS, markClassName)}>
        {hit}
      </mark>
      {after}
    </span>
  );
}

/**
 * Compact quote: `…text before the span + [highlighted span] + text after…`.
 * Falls back to a hint when the span cannot be located in the submission.
 */
export function EvidenceExcerpt({
  text,
  span,
  context = 70,
  className,
  markClassName,
  emptyLabel = "no exact quote available",
}: {
  text: string;
  span?: EvidenceSpanInput;
  context?: number;
  className?: string;
  markClassName?: string;
  emptyLabel?: string;
}) {
  const resolved = normalizeSpan(text, span ?? null);
  if (!resolved) {
    return <span className={cx("italic text-ink-2", className)}>{emptyLabel}</span>;
  }
  const start = Math.max(0, resolved.startChar - context);
  const end = Math.min(text.length, resolved.endChar + context);
  const before = (start > 0 ? "… " : "") + text.slice(start, resolved.startChar);
  const hit = text.slice(resolved.startChar, resolved.endChar);
  const after = text.slice(resolved.endChar, end) + (end < text.length ? " …" : "");

  return (
    <span className={cx("whitespace-pre-wrap", className)} data-testid="evidence-excerpt">
      {before}
      <mark data-testid="evidence-mark" className={cx(MARK_CLASS, markClassName)}>
        {hit}
      </mark>
      {after}
    </span>
  );
}

/** Full highlightable essay used behind the "show in full answer" toggles. */
export function EvidenceText({
  text,
  span,
  className,
}: {
  text: string;
  span?: EvidenceSpanInput;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "max-h-72 overflow-y-auto whitespace-pre-wrap rounded-control bg-surface p-3.5 text-footnote leading-6 text-ink-2",
        className,
      )}
    >
      <EvidenceSpan text={text} span={span} block />
    </p>
  );
}
