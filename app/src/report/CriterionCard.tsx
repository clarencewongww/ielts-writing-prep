/**
 * One criterion card (TR / CC / LR / GRA): band, rubric rows, feedback items with
 * highlighted evidence spans, and the caps that lowered the band.
 */

import { CriterionTip } from "./CriterionTip";
import { EvidenceExcerpt, EvidenceText } from "./EvidenceSpan";
import { formatBand } from "./ScoreSummary";
import { cx } from "../tasks/format";
import type { CapRecord } from "../grading/scorer";
import type { RubricCheckRow } from "../grading/rubric";
import type { Criterion, FeedbackItem } from "../types/grading";

const CRITERION_BLURB: Record<Criterion, string> = {
  TA: "Covers the requirements and selects key features.",
  TR: "Answers every part, holds a position and develops ideas.",
  CC: "Paragraphing, progression and cohesive devices.",
  LR: "Range, precision, collocation and spelling.",
  GRA: "Range of structures and grammatical accuracy.",
};

const SEVERITY_STYLES: Record<FeedbackItem["severity"], string> = {
  cap: "bg-danger-soft text-danger",
  error: "bg-warn-soft text-warn",
  upgrade: "bg-tint-soft text-tint-strong",
};

const SEVERITY_LABELS: Record<FeedbackItem["severity"], string> = {
  cap: "Limited to",
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
      className="rounded-card border border-line bg-content p-4 shadow-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-headline font-semibold text-ink">
            <CriterionTip criterion={criterion} />
          </h3>
          <p className="mt-0.5 text-footnote text-ink-2">{summary ?? CRITERION_BLURB[criterion]}</p>
        </div>
        <div className="text-right">
          <span
            data-testid={`criterion-band-${criterion}`}
            className={cx(
              "inline-flex items-center rounded-full px-2.5 py-1 text-subhead font-semibold tabular-nums ring-1 ring-inset",
              band >= 7
                ? "bg-ok-soft text-ok ring-ok/25"
                : band >= 6
                  ? "bg-tint-soft text-tint-strong ring-tint/25"
                  : "bg-danger-soft text-danger ring-danger/25",
            )}
          >
            {formatBand(band)}
          </span>
          {capped && (
            <p className="mt-1 text-caption text-danger" data-testid={`criterion-capped-${criterion}`}>
              limited from {formatBand(rawBand)}
            </p>
          )}
        </div>
      </header>

      {caps.length > 0 && (
        <div className="mt-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-2">Score limits</p>
          <ul className="mt-1.5 space-y-1.5" data-testid={`criterion-caps-${criterion}`}>
            {caps.map((cap) => (
              <li key={cap.checkId} className="rounded-control bg-danger-soft px-3 py-2 text-caption leading-5 text-danger">
                <span className="font-semibold">
                  <CriterionTip criterion={cap.criterion} /> — limited to {formatBand(cap.cap)}
                </span>{" "}
                {cap.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 space-y-2.5" data-testid={`criterion-feedback-${criterion}`}>
        {feedback.length === 0 ? (
          <p className="rounded-control bg-ok-soft px-3.5 py-2 text-footnote text-ok">
            Nothing flagged here — this criterion reads clean.
          </p>
        ) : (
          feedback.map((item, index) => (
            <article
              key={`${item.checkId}-${item.evidenceSpan.startChar}-${index}`}
              data-testid="feedback-item"
              data-check-id={item.checkId}
              className="rounded-control bg-surface p-3.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    item.severity === "cap" ? "normal-case" : "uppercase",
                    SEVERITY_STYLES[item.severity],
                  )}
                >
                  {item.severity === "cap" ? `${SEVERITY_LABELS.cap} ${formatBand(item.band)}` : SEVERITY_LABELS[item.severity]}
                </span>
                <span className="font-mono text-[10px] text-ink-2" title={item.feedbackStarter}>
                  {item.checkId}
                </span>
                <span className="text-[10px] text-ink-2">band {formatBand(item.band)}</span>
              </div>
              <blockquote
                className="mt-2 border-l-2 border-ink/15 pl-2 text-footnote leading-6 text-ink"
                data-testid="feedback-quote"
              >
                <EvidenceExcerpt text={submission} span={item.evidenceSpan} />
              </blockquote>
              <p className="mt-2 text-footnote leading-6 text-ink">{item.feedbackStarter}</p>
              {item.fixSuggestion && (
                <p className="mt-1 text-footnote leading-6 text-ink-2">
                  <span className="font-semibold text-ink">Fix: </span>
                  {item.fixSuggestion}
                </p>
              )}
              <details className="mt-2 text-caption text-ink-2">
                <summary className="cursor-pointer select-none">Show in full answer</summary>
                <EvidenceText text={submission} span={item.evidenceSpan} className="mt-2" />
              </details>
            </article>
          ))
        )}
      </div>

      {checks.length > 0 && (
        <details className="mt-3 text-footnote" open={defaultRubricOpen}>
          <summary className="cursor-pointer select-none text-caption font-semibold uppercase tracking-wide text-ink-2">
            Rubric checks ({failedRows.length} not met)
          </summary>
          <ul className="mt-2 space-y-1" data-testid={`rubric-rows-${criterion}`}>
            {checks.map((row) => (
              <li key={row.key} className="flex items-start gap-2 leading-5">
                <span
                  className={cx(
                    "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    row.passed ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
                  )}
                  aria-label={row.passed ? "passed" : "not met"}
                >
                  {row.passed ? "✓" : "×"}
                </span>
                <span className="text-ink-2">
                  <span className="mr-1 rounded bg-surface px-1 font-mono text-[10px] text-ink-2">b{row.band}</span>
                  <span className={row.passed ? "text-ink-2" : "font-medium text-ink"}>{row.label}</span>
                  <span className="block text-caption text-ink-2">{row.descriptor}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
