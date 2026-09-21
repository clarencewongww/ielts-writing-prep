/**
 * Small presentational primitives shared by the task views.
 * Tailwind utility classes only — no custom theme tokens required.
 */

import type { ReactNode } from 'react';
import { cx } from './format';

export type BadgeTone = 'slate' | 'teal' | 'amber' | 'rose' | 'indigo' | 'emerald';

const BADGE_TONES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
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
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
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
        'inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600',
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</h4>
      {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-slate-200 bg-white p-3 shadow-sm', className)}>
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
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cx('group rounded-lg border border-slate-200 bg-white', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-700 marker:content-none">
        <span className="flex items-center gap-2">
          <span className="text-slate-400 transition-transform group-open:rotate-90" aria-hidden="true">
            ▶
          </span>
          {summary}
        </span>
        {aside}
      </summary>
      <div className="border-t border-slate-100 px-3 py-2.5">{children}</div>
    </details>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
      {children}
    </p>
  );
}

/** Renders the item's `unitsNote` above a figure, as required for chart tasks. */
export function UnitsNote({ note }: { note?: string | null }) {
  if (!note) return null;
  return <p className="mb-2 text-xs italic leading-snug text-slate-500">{note}</p>;
}
