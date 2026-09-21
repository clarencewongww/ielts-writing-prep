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
  const [active, setActive] = useState<string>(submission ? "yours" : "b6");

  if (!item) {
    return (
      <section className={cx("rounded-xl border border-dashed border-slate-300 bg-white p-4", className)} data-testid="reference-tabs-empty">
        <p className="text-sm text-slate-500">Reference answers unavailable for this task.</p>
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
      className={cx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Model answers</h3>
          <p className="text-[11px] text-slate-500">
            {task2 ? item.statement : `${item.type.toUpperCase()} chart — ${item.statement}`}
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          bank reference answers
        </span>
      </header>

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
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[13px] leading-6 text-slate-700">
            {submission?.trim() ? submission : "No answer recorded for this task."}
          </p>
        ) : current ? (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-slate-900 px-2 py-0.5 font-semibold text-white">Band {formatBand(current.band)}</span>
              <span className="text-slate-500">{current.wordCount} words</span>
              {"whyBand" in current && <span className="text-slate-500">why this band</span>}
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-700">
              <EvidenceSpan text={current.text} span={referenceSpan(current, task2)} block />
            </p>
            {task2 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                {(current as Task2Item["referenceAnswers"][number]).whyBand}
              </p>
            ) : (
              <ul className="mt-3 list-disc space-y-1 rounded-lg bg-slate-50 p-3 pl-7 text-xs leading-5 text-slate-600">
                {(current as Task1Item["referenceAnswers"][number]).defectProfile.map((defect) => (
                  <li key={defect}>{defect}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 rounded-lg border-l-2 border-amber-300 bg-amber-50/50 px-3 py-2 text-xs leading-5 text-slate-700">
              {task2
                ? (current as Task2Item["referenceAnswers"][number]).feedback.feedbackStarter
                : (current as Task1Item["referenceAnswers"][number]).feedbackStarter.text}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">That band is not in this item&rsquo;s reference set.</p>
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
  tone: "slate" | "amber" | "sky" | "emerald";
  testId?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-900 text-white",
    amber: "bg-amber-500 text-white",
    sky: "bg-sky-600 text-white",
    emerald: "bg-emerald-600 text-white",
  };
  const isActive = active === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-testid={testId ?? `reference-tab-${id}`}
      onClick={() => onSelect(id)}
      className={cx(
        "rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
        isActive ? tones[tone] : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {label}
    </button>
  );
}
