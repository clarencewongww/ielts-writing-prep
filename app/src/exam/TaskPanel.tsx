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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
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

      <div className="flex min-h-[540px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100vh-8.5rem)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700">
            Your answer — Task {task}
          </h2>
          <span className="text-xs text-slate-500">suggested {recommendedMinutes} min · take your time</span>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
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
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
      >
        <CheckIcon />
        Submitted · {submission.words} words · {formatClock(submission.submittedAt)}
      </span>
    );
  }

  if (armed) {
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            actions.submitTask(task);
            setArmed(false);
          }}
          className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          Confirm submit Task {task}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70"
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
      className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
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
