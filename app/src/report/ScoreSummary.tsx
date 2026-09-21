/**
 * Top-of-report score summary: Task 1 / Task 2 criterion bands, the overall
 * writing band ((T1 + 2×T2) / 3, half-band rounded) and every applied cap.
 */

import { CriterionTip } from "./CriterionTip";
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
    <div className="rounded-control bg-surface px-3.5 py-3" data-testid={testId}>
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <p className="mt-0.5 text-title font-semibold tabular-nums text-ink">{band === null ? "–" : formatBand(band)}</p>
      <p className="text-caption text-ink-2">{words == null ? "not submitted yet" : `${words} words`}</p>
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
    <section data-testid="score-summary" className="rounded-card border border-line bg-content p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.22em] text-ink-2">Estimated band</p>
          <div className="mt-1.5 flex items-end gap-3">
            {/* The score moment: the largest numeral in the app, in the display
                role. This is content — the product's whole payoff — not the
                decorative "big number hero" the craft lens warns about. */}
            <span
              data-testid="overall-band"
              className="text-display font-semibold leading-none tabular-nums text-ink lg:text-display-lg"
            >
              {overallBand === null ? "–" : formatBand(overallBand)}
            </span>
            <span className="pb-1.5 text-footnote text-ink-2">
              overall writing{overallBand === null ? " (needs both tasks)" : ""}
            </span>
          </div>
          <p className="mt-2.5 max-w-md text-footnote text-ink-2">
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <CriterionStrip title="Task 1 criteria" grade={task1} testId="task1-criteria-strip" />
        <CriterionStrip title="Task 2 criteria" grade={task2} testId="task2-criteria-strip" />
      </div>

      <div className="mt-5">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-ink-2">
          Score limits {caps.length > 0 ? `(${caps.length})` : ""}
        </h2>
        <p className="mt-0.5 text-footnote text-ink-2">Why your band was limited</p>
        {caps.length === 0 ? (
          <p
            className="mt-2 rounded-control bg-ok-soft px-3.5 py-2 text-footnote text-ok"
            data-testid="caps-empty"
          >
            No score limits — every band above comes straight from the rubric.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="caps-list">
            {caps.map((cap) => (
              <li
                key={`${cap.checkId}-${cap.criterion}-${cap.cap}`}
                className="rounded-control bg-danger-soft px-3 py-2 text-caption leading-5 text-danger ring-1 ring-inset ring-danger/20"
                data-testid={`cap-${cap.checkId}`}
              >
                <span className="font-semibold">
                  <CriterionTip criterion={cap.criterion} /> — limited to {formatBand(cap.cap)}
                </span>
                <span className="block">{cap.reason}</span>
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
      <div className="rounded-control bg-surface p-3.5 text-footnote text-ink-2" data-testid={testId}>
        {title}: not graded yet.
      </div>
    );
  }
  return (
    <div className="rounded-control bg-surface p-3.5" data-testid={testId}>
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-2">{title}</p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {grade.criteria.map((entry, index) => (
          <li
            key={entry.criterion}
            className="flex items-center justify-between gap-2 rounded-lg bg-content px-2.5 py-1.5 text-caption ring-1 ring-inset ring-line"
          >
            <CriterionTip
              criterion={entry.criterion}
              align={index % 2 === 0 ? "left" : "right"}
              className="min-w-0 text-left text-ink-2"
            />
            <span className={cx("shrink-0 text-subhead font-semibold tabular-nums", entry.band < 6 ? "text-danger" : "text-ink")}>
              {formatBand(entry.band)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
