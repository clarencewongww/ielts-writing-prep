/** One task workspace: prompt, planning notes, editor, live word count and submit. */

import { useState } from "react";
import { ChartRenderer, PromptViewer } from "../tasks";
import type { Task1Item, Task2Item } from "../types/bank";
import { draftKey, taskKey, type TaskNumber } from "../types/session";
import { AnswerBox } from "./AnswerBox";
import { PlanningNotes } from "./PlanningNotes";
import { PromptCard } from "./PromptCard";
import { WordCounter } from "./WordCounter";
import { useSession } from "./useSession";
import { useTimer } from "./useTimer";

export interface TaskPanelProps {
  task: TaskNumber;
}

export function TaskPanel({ task }: TaskPanelProps) {
  const { state, session, actions, task1Item, task2Item } = useSession();
  const timer = useTimer();

  const item = task === 1 ? task1Item : task2Item;
  const submission = state.submission?.[taskKey(task)] ?? null;
  const draft = state.draft[draftKey(task)];
  const locked = submission !== null || (timer.locked && session.uiRules.hardStopAtZero);
  const recommendedMinutes = session.tasks[task - 1].minutesRecommended;

  if (!item) {
    return (
      <section className="pt-6" data-testid="task-missing">
        <div className="rounded-card bg-warn-soft p-6 text-subhead text-warn">
          No prompt is selected for Task {task} yet —{" "}
          <button type="button" onClick={actions.reset} className="font-semibold underline underline-offset-2">
            head back to setup
          </button>{" "}
          and pick one.
        </div>
      </section>
    );
  }

  return (
    <section
      id="task-panel"
      role="tabpanel"
      aria-labelledby={`task-tab-${task}`}
      className="grid min-w-0 gap-4 pt-4 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]"
    >
      <div className="min-w-0 space-y-4 lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto lg:pr-1">
        {task === 1 ? (
          <PromptCard
            task={1}
            item={item as Task1Item}
            chartSlot={<ChartRenderer item={item as Task1Item} />}
          />
        ) : (
          /* Task 2 uses the richer prompt viewer: thesis rule, structure preview,
             seed-idea checklist and the banned-phrase list. */
          <PromptViewer prompt={item as Task2Item} />
        )}
        {session.uiRules.planningNotesArea && <PlanningNotes />}
      </div>

      {/* Opaque content card: the editor never uses the glass material
          (materials.md › Liquid Glass: glass belongs to the functional layer). */}
      <div className="flex min-h-[540px] flex-col overflow-hidden rounded-card border border-line bg-content shadow-card lg:max-h-[calc(100vh-8.5rem)]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line-soft px-4 py-2.5">
          <h2 className="text-headline font-semibold text-ink">
            Your answer — Task {task}
          </h2>
          <span className="text-caption text-ink-2">suggested {recommendedMinutes} min · take your time</span>
        </div>

        <AnswerBox
          task={task}
          value={draft}
          onChange={(value) => actions.setDraft(task, value)}
          disabled={locked}
          placeholder={
            task === 1
              ? "Start with the overview — what stands out overall? Then one clear paragraph for each group of data…"
              : "Open with your position in one sentence, then give each main idea its own paragraph…"
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-ink/[0.03] px-4 py-3">
          <WordCounter task={task} text={draft} />
          <SubmitControl task={task} />
        </div>
      </div>
    </section>
  );
}

function SubmitControl({ task }: { task: TaskNumber }) {
  const { state, actions } = useSession();
  const timer = useTimer();
  const [armed, setArmed] = useState(false);
  const submission = state.submission?.[taskKey(task)] ?? null;
  const draft = state.draft[draftKey(task)];

  if (submission) {
    return (
      <span
        data-testid={`task-submitted-${task}`}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-ok-soft px-3.5 text-caption font-semibold text-ok"
      >
        <CheckIcon />
        Submitted · {submission.words} words · {formatClock(submission.submittedAt)}
      </span>
    );
  }

  if (armed) {
    return (
      <span className="flex items-center gap-2">
        {/* Handing in the task ends editing for it — destructive role, red fill. */}
        <button
          type="button"
          onClick={() => {
            actions.submitTask(task);
            setArmed(false);
          }}
          className="min-h-[44px] whitespace-nowrap rounded-full bg-danger-fill px-4 text-subhead font-semibold text-white shadow-sm transition-colors ease-apple hover:opacity-90 focus-visible:outline-danger"
        >
          Confirm submit Task {task}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="min-h-[44px] rounded-full px-3 text-subhead font-medium text-ink-2 transition-colors ease-apple hover:bg-ink/5 hover:text-ink focus-visible:outline-tint"
        >
          Keep writing
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid={`submit-task-${task}`}
      onClick={() => setArmed(true)}
      disabled={draft.trim().length === 0 && !timer.locked}
      title={draft.trim().length === 0 ? "Even one sentence unlocks submit" : undefined}
      className="min-h-[44px] whitespace-nowrap rounded-full bg-tint-fill px-4 text-subhead font-semibold text-white shadow-sm transition-colors ease-apple hover:bg-tint-strong focus-visible:outline-tint disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink-3 disabled:shadow-none"
    >
      Submit Task {task}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
