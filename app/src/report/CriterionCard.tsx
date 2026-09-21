/**
 * One criterion card (TR / CC / LR / GRA): band, rubric rows, feedback items with
 * highlighted evidence spans, and the caps that lowered the band.
 */

import { EvidenceExcerpt, EvidenceText } from "./EvidenceSpan";
import { formatBand } from "./ScoreSummary";
import { cx } from "../tasks/format";
import type { CapRecord } from "../grading/scorer";
import type { RubricCheckRow } from "../grading/rubric";
import type { Criterion, FeedbackItem } from "../types/grading";

const CRITERION_NAMES: Record<Criterion, string> = {
  TA: "Task Achievement",
  TR: "Task Response",
  CC: "Coherence & Cohesion",
  LR: "Lexical Resource",
  GRA: "Grammatical Range & Accuracy",
};

const CRITERION_BLURB: Record<Criterion, string> = {
  TA: "Covers the requirements and selects key features.",
  TR: "Answers every part, holds a position and develops ideas.",
  CC: "Paragraphing, progression and cohesive devices.",
  LR: "Range, precision, collocation and spelling.",
  GRA: "Range of structures and grammatical accuracy.",
};

const SEVERITY_STYLES: Record<FeedbackItem["severity"], string> = {
  cap: "border-rose-200 bg-rose-50 text-rose-700",
  error: "border-amber-200 bg-amber-50 text-amber-800",
  upgrade: "border-sky-200 bg-sky-50 text-sky-800",
};

const SEVERITY_LABELS: Record<FeedbackItem["severity"], string> = {
  cap: "score cap",
  error: "accuracy",
  upgrade: "range",
};

export interface CriterionCardProps {
  criterion: Criterion;
  band: number;
  /** Rubric band before deterministic caps (shown when higher than `band`). */
  rawBand?: number;
  summary?: string;
  checks?: RubricCheckRow[];
  feedback: FeedbackItem[];
  submission: string;
  caps?: CapRecord[];
  defaultRubricOpen?: boolean;
}

export function CriterionCard({
  criterion,
  band,
  rawBand,
  summary,
  checks = [],
  feedback,
  submission,
  caps = [],
  defaultRubricOpen = false,
}: CriterionCardProps) {
  const failedRows = checks.filter((row) => !row.passed);
  const capped = rawBand !== undefined && rawBand > band;

  return (
    <section
      data-testid={`criterion-card-${criterion}`}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{criterion}</p>
          <h3 className="text-sm font-semibold text-slate-900">{CRITERION_NAMES[criterion]}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{summary ?? CRITERION_BLURB[criterion]}</p>
        </div>
        <div className="text-right">
          <span
            data-testid={`criterion-band-${criterion}`}
            className={cx(
              "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset",
              band >= 7 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : band >= 6 ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-rose-50 text-rose-700 ring-rose-200",
            )}
          >
            {formatBand(band)}
          </span>
          {capped && (
            <p className="mt-1 text-[11px] text-rose-600" data-testid={`criterion-capped-${criterion}`}>
              capped from {formatBand(rawBand)}
            </p>
          )}
        </div>
      </header>

      {caps.length > 0 && (
        <ul className="mt-3 space-y-1" data-testid={`criterion-caps-${criterion}`}>
          {caps.map((cap) => (
            <li key={cap.checkId} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] leading-5 text-rose-800">
              <span className="font-semibold">
                {cap.criterion} ≤ {formatBand(cap.cap)}
              </span>{" "}
              — {cap.reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2.5" data-testid={`criterion-feedback-${criterion}`}>
        {feedback.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No issues found for this criterion.
          </p>
        ) : (
          feedback.map((item, index) => (
            <article
              key={`${item.checkId}-${item.evidenceSpan.startChar}-${index}`}
              data-testid="feedback-item"
              data-check-id={item.checkId}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cx("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", SEVERITY_STYLES[item.severity])}>
                  {SEVERITY_LABELS[item.severity]}
                </span>
                <span className="font-mono text-[10px] text-slate-500">{item.checkId}</span>
                <span className="text-[10px] text-slate-500">band {formatBand(item.band)}</span>
              </div>
              <blockquote
                className="mt-2 border-l-2 border-amber-300 pl-2 text-[13px] leading-6 text-slate-700"
                data-testid="feedback-quote"
              >
                <EvidenceExcerpt text={submission} span={item.evidenceSpan} />
              </blockquote>
              <p className="mt-2 text-[13px] leading-6 text-slate-700">{item.feedbackStarter}</p>
              {item.fixSuggestion && (
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  <span className="font-semibold text-slate-700">Fix: </span>
                  {item.fixSuggestion}
                </p>
              )}
              <details className="mt-2 text-[11px] text-slate-500">
                <summary className="cursor-pointer select-none">Show in full answer</summary>
                <EvidenceText text={submission} span={item.evidenceSpan} className="mt-2" />
              </details>
            </article>
          ))
        )}
      </div>

      {checks.length > 0 && (
        <details className="mt-3 text-xs" open={defaultRubricOpen}>
          <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Rubric checks ({failedRows.length} not met)
          </summary>
          <ul className="mt-2 space-y-1" data-testid={`rubric-rows-${criterion}`}>
            {checks.map((row) => (
              <li key={row.key} className="flex items-start gap-2 leading-5">
                <span
                  className={cx(
                    "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    row.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                  )}
                  aria-label={row.passed ? "passed" : "not met"}
                >
                  {row.passed ? "✓" : "×"}
                </span>
                <span className="text-slate-600">
                  <span className="mr-1 rounded bg-slate-100 px-1 font-mono text-[10px] text-slate-500">b{row.band}</span>
                  <span className={row.passed ? "text-slate-600" : "font-medium text-slate-800"}>{row.label}</span>
                  <span className="block text-[11px] text-slate-500">{row.descriptor}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
