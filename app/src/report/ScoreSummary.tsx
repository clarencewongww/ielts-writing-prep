/**
 * Top-of-report score summary: Task 1 / Task 2 criterion bands, the overall
 * writing band ((T1 + 2×T2) / 3, half-band rounded) and every applied cap.
 */

import { cx } from "../tasks/format";
import type { CapRecord } from "../grading/scorer";
import type { TaskGrade } from "../types/grading";

/** Bands always render with one decimal (`7` → `7.0`, `7.5` → `7.5`). */
export function formatBand(band: number): string {
  return band.toFixed(1);
}

/** Small band + word-count tile used by `ScoreSummary`. */
export function ScoreLabel({
  label,
  band,
  words,
  testId,
}: {
  label: string;
  band: number | null;
  words?: number | null;
  testId?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold text-slate-900">{band === null ? "–" : formatBand(band)}</p>
      <p className="text-[11px] text-slate-500">{words == null ? "no submission" : `${words} words`}</p>
    </div>
  );
}

export interface ScoreSummaryProps {
  task1: TaskGrade | null;
  task2: TaskGrade | null;
  /** Pre-computed overall (falls back to the weighted formula). */
  overallBand: number | null;
  /** Caps that actually lowered a criterion, across both tasks. */
  caps: CapRecord[];
  words?: { task1?: number | null; task2?: number | null };
  minutesUsed?: number;
}

export function ScoreSummary({ task1, task2, overallBand, caps, words, minutesUsed }: ScoreSummaryProps) {
  return (
    <section data-testid="score-summary" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Estimated band</p>
          <div className="mt-1 flex items-end gap-3">
            <span data-testid="overall-band" className="text-5xl font-semibold leading-none tracking-tight text-slate-900">
              {overallBand === null ? "–" : formatBand(overallBand)}
            </span>
            <span className="pb-1 text-xs text-slate-500">
              overall writing{overallBand === null ? " (needs both tasks)" : ""}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {minutesUsed !== undefined ? `${minutesUsed} min used of 60 · ` : ""}
            task band = mean of its four criteria · overall = (T1 + 2&times;T2) / 3, rounded to the nearest half band.
          </p>
        </div>
        <div className="grid min-w-[240px] grid-cols-2 gap-3">
          <ScoreLabel
            label="Task 1"
            band={task1?.overallBand ?? null}
            words={words?.task1 ?? null}
            testId="task1-band"
          />
          <ScoreLabel
            label="Task 2"
            band={task2?.overallBand ?? null}
            words={words?.task2 ?? null}
            testId="task2-band"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CriterionStrip title="Task 1 criteria" grade={task1} testId="task1-criteria-strip" />
        <CriterionStrip title="Task 2 criteria" grade={task2} testId="task2-criteria-strip" />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Caps applied {caps.length > 0 ? `(${caps.length})` : ""}
        </h2>
        {caps.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500" data-testid="caps-empty">
            No deterministic caps fired — the bands above come straight from the rubric.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="caps-list">
            {caps.map((cap) => (
              <li
                key={`${cap.checkId}-${cap.criterion}-${cap.cap}`}
                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] leading-5 text-rose-800"
                data-testid={`cap-${cap.checkId}`}
              >
                <span className="font-semibold">
                  {cap.criterion} ≤ {formatBand(cap.cap)}
                </span>{" "}
                <span className="font-mono text-[10px] text-rose-700">{cap.checkId}</span>
                <span className="block text-rose-700">{cap.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CriterionStrip({ title, grade, testId }: { title: string; grade: TaskGrade | null; testId: string }) {
  if (!grade) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500" data-testid={testId}>
        {title}: not graded yet.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-2 grid grid-cols-4 gap-1.5">
        {grade.criteria.map((entry) => (
          <li key={entry.criterion} className="rounded-lg bg-white px-2 py-1.5 text-center ring-1 ring-slate-200">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">{entry.criterion}</span>
            <span className={cx("text-sm font-semibold", entry.band < 6 ? "text-rose-600" : "text-slate-800")}>
              {formatBand(entry.band)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
