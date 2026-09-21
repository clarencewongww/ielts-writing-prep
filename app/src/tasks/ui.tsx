/**
 * Small presentational primitives shared by the task views.
 *
 * Step 4: tones are semantic tokens, not hues. Informational tones share the
 * accent-soft tint; amber/rose/emerald stay status-only (color.md › Best
 * practices: "Avoid using the same color to mean different things").
 */

import type { ReactNode } from 'react';
import { cx } from './format';

export type BadgeTone = 'slate' | 'teal' | 'amber' | 'rose' | 'indigo' | 'emerald';

const BADGE_TONES: Record<BadgeTone, string> = {
  slate: 'bg-content text-ink-2 ring-line',
  teal: 'bg-tint-soft text-tint-strong ring-tint/20',
  amber: 'bg-warn-soft text-warn ring-warn/25',
  rose: 'bg-danger-soft text-danger ring-danger/25',
  indigo: 'bg-tint-soft text-tint-strong ring-tint/20',
  emerald: 'bg-ok-soft text-ok ring-ok/25',
};

export function Badge({
  children,
  tone = 'slate',
  title,
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded bg-content px-1.5 py-0.5 text-caption text-ink-2 ring-1 ring-inset ring-line',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('mb-1.5 flex flex-wrap items-baseline justify-between gap-2', className)}>
      <h4 className="text-caption font-semibold uppercase tracking-wide text-ink-2">{children}</h4>
      {hint ? <span className="text-caption text-ink-2">{hint}</span> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-control border border-line bg-content p-3.5 shadow-card', className)}>
      {children}
    </div>
  );
}

export function Collapsible({
  summary,
  children,
  defaultOpen = false,
  className,
  aside,
  testId,
}: {
  summary: ReactNode;
  children: ReactNode;
  /** Open on first render. Every exam-side caller defaults to collapsed. */
  defaultOpen?: boolean;
  className?: string;
  aside?: ReactNode;
  /** Stable hook for collapsed-state assertions; the native <details> carries the state. */
  testId?: string;
}) {
  return (
    <details
      data-testid={testId}
      open={defaultOpen}
      className={cx('group rounded-control border border-line bg-content', className)}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-control px-3.5 py-2 text-subhead font-medium text-ink focus-visible:outline-tint marker:content-none">
        <span className="flex items-center gap-2">
          <span className="text-ink-3 transition-transform ease-apple group-open:rotate-90" aria-hidden="true">
            ▶
          </span>
          {summary}
        </span>
        {aside}
      </summary>
      <div className="border-t border-line-soft px-3.5 py-2.5">{children}</div>
    </details>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-control border border-dashed border-line bg-surface px-3 py-2 text-subhead text-ink-2">
      {children}
    </p>
  );
}

/** Renders the item's `unitsNote` above a figure, as required for chart tasks. */
export function UnitsNote({ note }: { note?: string | null }) {
  if (!note) return null;
  return <p className="mb-2 text-footnote italic leading-snug text-ink-2">{note}</p>;
}
