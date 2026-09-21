/**
 * The exam prompt card.
 *
 * Task 2 shows the statement + instruction. Task 1 shows the statement + time frame +
 * units and the chart: the tasks module (`src/tasks`) supplies a renderer through
 * `chartSlot`; when the caller omits it, the card mounts `ChartRenderer` itself.
 */

import type { ReactNode } from "react";
import { TASK1_TYPE_LABELS, TASK2_FAMILY_LABELS } from "../constants";
import { ATTRIBUTION_TEXT, ChartRenderer } from "../tasks";
import type { Task1Item, Task2Item } from "../types/bank";
import type { TaskNumber } from "../types/session";
import { useSession } from "./useSession";

export interface PromptCardProps {
  task: TaskNumber;
  item: Task1Item | Task2Item;
  /** Chart renderer supplied by the tasks module (Step 3); defaults to `ChartRenderer`. */
  chartSlot?: ReactNode;
}

export function PromptCard({ task, item, chartSlot }: PromptCardProps) {
  const { session } = useSession();
  const recommended = session.tasks[task - 1].minutesRecommended;

  if (task === 1) {
    const chart = item as Task1Item;
    return (
      <article
        data-testid="prompt-card"
        data-task={task}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <PromptHeader
          badge={`Task 1 · ${TASK1_TYPE_LABELS[chart.type] ?? chart.type}`}
          topic={chart.topic}
          recommendedMinutes={recommended}
        />
        <p className="mt-3 text-[15px] font-medium leading-7 text-slate-900">{chart.statement}</p>
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="font-medium text-slate-600">Time frame</dt>
            <dd>{formatYears(chart.timeFrame?.values)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-medium text-slate-600">Write about</dt>
            <dd>{chart.categories.slice(0, 4).join(", ")}{chart.categories.length > 4 ? "…" : ""}</dd>
          </div>
        </dl>
        {chartSlot ?? <ChartRenderer item={chart} />}
        {chart.type === "process" && (
          <p
            data-testid="process-exempt-hint"
            className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900"
          >
            Process diagrams are exempt from the &ldquo;one figure per body sentence&rdquo; rule — describe each
            stage in order, using time markers only where the task provides them.
          </p>
        )}
        {/* The chart's own attribution lives inside the figure; bank policy stays a tooltip. */}
      </article>
    );
  }

  const prompt = item as Task2Item;
  return (
    <article
      data-testid="prompt-card"
      data-task={task}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <PromptHeader
        badge={`Task 2 · ${TASK2_FAMILY_LABELS[prompt.family] ?? prompt.family}`}
        topic={prompt.topic}
        recommendedMinutes={recommended}
      />
      <p className="mt-3 text-[15px] font-medium leading-7 text-slate-900">{prompt.statement}</p>
      <p className="mt-3 rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-[15px] font-semibold leading-7 text-slate-900">
        {prompt.instruction}
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <div className="flex gap-1.5">
          <dt className="font-medium text-slate-600">Questions</dt>
          <dd>{prompt.questionCount}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium text-slate-600">Opinion required</dt>
          <dd>{prompt.opinionRequired ? "yes" : "no"}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="font-medium text-slate-600">Structure</dt>
          <dd>introduction · bodies · conclusion</dd>
        </div>
      </dl>
      <CardFooter policy="recreate reported tasks; label tasks as app-generated, not official IELTS" />
    </article>
  );
}

function PromptHeader({
  badge,
  topic,
  recommendedMinutes,
}: {
  badge: string;
  topic: string;
  recommendedMinutes: number;
}) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
        {badge}
      </span>
      <span className="text-xs text-slate-500">{topic}</span>
      <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
        suggested {recommendedMinutes} min
      </span>
    </header>
  );
}

/**
 * Learner-facing provenance for a Task 2 prompt. Only the standard attribution line is
 * shown; the internal bank policy is exposed as a hover tooltip for maintainers so it
 * never ships as learner-facing copy.
 */
function CardFooter({ policy }: { policy?: string }) {
  return (
    <p
      className="mt-4 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-500"
      title={policy ? `App policy: ${policy}` : undefined}
    >
      {ATTRIBUTION_TEXT}
    </p>
  );
}

function formatYears(values: number[] | undefined): string {
  if (!values || values.length === 0) return "no dates (present simple)";
  if (values.length === 1) return String(values[0]);
  return `${values[0]}–${values[values.length - 1]}`;
}
