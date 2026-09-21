/**
 * B6 / B7 / B8 reference-answer tabs for the bank item's `referenceAnswers`.
 * Works for both tasks: Task 2 answers carry `whyBand` and an object-span
 * feedback, Task 1 answers carry `defectProfile` and a string-span starter.
 * Selecting a tab shows the bank text with the reference answer's own coaching
 * span highlighted.
 */

import { useState } from "react";
import { EvidenceSpan } from "./EvidenceSpan";
import { formatBand } from "./ScoreSummary";
import { cx } from "../tasks/format";
import type { Task1Item, Task2Item } from "../types/bank";

export interface ReferenceTabsProps {
  item: Task1Item | Task2Item | null;
  /** Optional candidate text, offered as the first tab. */
  submission?: string | null;
  submissionLabel?: string;
  className?: string;
}

type Answer = Task1Item["referenceAnswers"][number] | Task2Item["referenceAnswers"][number];

function isTask2Item(item: Task1Item | Task2Item): item is Task2Item {
  return "promptId" in item;
}

function answerBand(answer: Answer): 6 | 7 | 8 {
  return answer.band;
}

export function ReferenceTabs({ item, submission, submissionLabel = "Your answer", className }: ReferenceTabsProps) {
  const [active, setActive] = useState<string>(submission != null ? "yours" : "b6");

  if (!item) {
    return (
      <section className={cx("rounded-card border border-dashed border-line bg-content p-4", className)} data-testid="reference-tabs-empty">
        <p className="text-subhead text-ink-2">No model answers for this task yet.</p>
      </section>
    );
  }

  const answers = item.referenceAnswers;
  const current = active === "yours" ? null : answers.find((answer) => `b${answerBand(answer)}` === active) ?? null;
  const task2 = isTask2Item(item);

  return (
    <section
      data-testid="reference-tabs"
      data-task={task2 ? 2 : 1}
      className={cx("rounded-card border border-line bg-content p-4 shadow-card", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-headline font-semibold text-ink">Model answers</h3>
          <p className="text-caption text-ink-2">
            {task2 ? item.statement : `${item.type.toUpperCase()} chart — ${item.statement}`}
          </p>
        </div>
        <span className="rounded-full bg-tint-soft px-2.5 py-1 text-caption font-medium text-tint-strong">
          model answers from the bank
        </span>
      </header>

      {/* Tabs navigate between bands; the selected tab carries the accent, and
          the band number is in the label so colour is never the only signal
          (tab-views.md; accessibility.md › Vision). */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" data-testid="reference-tablist">
        {submission != null && (
          <TabButton id="yours" active={active} onSelect={setActive} label={submissionLabel} tone="slate" />
        )}
        {answers.map((answer) => (
          <TabButton
            key={`b${answerBand(answer)}`}
            id={`b${answerBand(answer)}`}
            active={active}
            onSelect={setActive}
            label={`Band ${answerBand(answer)}`}
            tone={answerBand(answer) === 8 ? "emerald" : answerBand(answer) === 7 ? "sky" : "amber"}
            testId={`reference-tab-b${answerBand(answer)}`}
          />
        ))}
      </div>

      <div className="mt-3" data-testid="reference-panel">
        {active === "yours" ? (
          <p className="whitespace-pre-wrap rounded-control bg-surface p-3.5 text-footnote leading-6 text-ink">
            {submission?.trim() ? submission : "Nothing written for this task yet."}
          </p>
        ) : current ? (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-caption">
              <span className="rounded-full bg-tint-soft px-2.5 py-0.5 font-semibold text-tint-strong">
                Band {formatBand(current.band)}
              </span>
              <span className="text-ink-2">{current.wordCount} words</span>
              {"whyBand" in current && <span className="text-ink-2">why this band</span>}
            </div>
            <p className="mt-2 text-footnote leading-6 text-ink">
              <EvidenceSpan text={current.text} span={referenceSpan(current, task2)} block />
            </p>
            {task2 ? (
              <p className="mt-3 rounded-control bg-surface p-3.5 text-caption leading-5 text-ink-2">
                {(current as Task2Item["referenceAnswers"][number]).whyBand}
              </p>
            ) : (
              <ul className="mt-3 list-disc space-y-1 rounded-control bg-surface p-3.5 pl-7 text-caption leading-5 text-ink-2">
                {(current as Task1Item["referenceAnswers"][number]).defectProfile.map((defect) => (
                  <li key={defect}>{defect}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 rounded-control border-l-2 border-ink/15 bg-surface px-3.5 py-2 text-caption leading-5 text-ink">
              {task2
                ? (current as Task2Item["referenceAnswers"][number]).feedback.feedbackStarter
                : (current as Task1Item["referenceAnswers"][number]).feedbackStarter.text}
            </p>
          </div>
        ) : (
          <p className="text-subhead text-ink-2">This item doesn&rsquo;t include that band.</p>
        )}
      </div>
    </section>
  );
}

/** The span to highlight inside the model answer: T2 object span, T1 string quote. */
function referenceSpan(answer: Answer, task2: boolean): { startChar: number; endChar: number; text: string } | string | null {
  if (task2) return (answer as Task2Item["referenceAnswers"][number]).feedback.evidenceSpan;
  return (answer as Task1Item["referenceAnswers"][number]).feedbackStarter.evidenceSpan;
}

function TabButton({
  id,
  label,
  active,
  onSelect,
  tone,
  testId,
}: {
  id: string;
  label: string;
  active: string;
  onSelect: (id: string) => void;
  /** Kept for API compatibility; band identity lives in the label, not the hue. */
  tone: "slate" | "amber" | "sky" | "emerald";
  testId?: string;
}) {
  void tone;
  const isActive = active === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-testid={testId ?? `reference-tab-${id}`}
      onClick={() => onSelect(id)}
      className={cx(
        "min-h-[36px] rounded-full px-3.5 text-caption font-semibold transition-colors ease-apple focus-visible:outline-tint",
        isActive ? "bg-tint-fill text-white" : "bg-ink/[0.04] text-ink-2 hover:bg-ink/[0.08] hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
