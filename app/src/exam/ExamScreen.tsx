/** Exam screen shell: sticky header (timer · task switcher · submit) + the active task workspace. */

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { describeBank } from "../data/bankLoader";
import { countWords } from "../data/wordCount";
import { draftKey, taskKey, type TaskNumber } from "../types/session";
import { TaskPanel } from "./TaskPanel";
import { Timer } from "./Timer";
import { useSession } from "./useSession";
import { useTimer } from "./useTimer";

export function ExamScreen() {
  const { state, session, bank, actions } = useSession();
  const timer = useTimer();
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  useEffect(() => {
    if (!timer.expired) setOverlayDismissed(false);
  }, [timer.expired]);

  return (
    <div className="min-h-screen bg-slate-100" data-testid="exam-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white">
              <PenIcon />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">IELTS Writing</div>
              <div className="text-[11px] text-slate-500">
                {session.mode === "computer" ? "Computer-based" : "Paper practice"} · 60 min · bank v
                {bank.manifest.version}
              </div>
            </div>
          </div>

          <TaskTabs />

          <div className="ml-auto flex items-center gap-2.5">
            <Timer />
            <SubmitAllButton />
            <QuitButton />
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="mx-auto flex max-w-[1400px] items-start gap-2 px-4 py-1.5 text-[11px] leading-5 text-slate-500">
            <InfoIcon />
            <p className="m-0">
              Timing is advisory: Task 2 first (40 min) then Task 1 (20 min). The only hard rule is the
              60:00 stop. Word counts and the timer are the only live aids — no spellcheck, no autocorrect.
              Highlighting is disabled by design: the answer is a plain textarea, not a rich-text editor.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-10">
        {timer.expired && !overlayDismissed && (
          <LockOverlay onReview={() => setOverlayDismissed(true)} />
        )}
        {timer.expired && overlayDismissed && (
          <div
            data-testid="expired-banner"
            role="status"
            aria-live="polite"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <LockIcon />
            <span className="font-medium">
              Time is up — the editor is locked. Submit all to finish your session.
            </span>
            <span className="ml-auto">
              <SubmitAllButton compact />
            </span>
          </div>
        )}
        <TaskPanel task={state.activeTask} />
      </main>
    </div>
  );
}

/**
 * Task switcher — a WAI-ARIA tablist with roving `tabIndex`: Tab enters the
 * control, Left/Right/Home/End move between tasks, Enter/Space activates.
 */
function TaskTabs() {
  const { state, actions } = useSession();
  const buttonRefs = useRef<Partial<Record<TaskNumber, HTMLButtonElement | null>>>({});
  const taskOrder: readonly TaskNumber[] = [1, 2];

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const currentIndex = taskOrder.indexOf(state.activeTask);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % taskOrder.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + taskOrder.length) % taskOrder.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = taskOrder.length - 1;
    const next = taskOrder[nextIndex];
    actions.setActiveTask(next);
    buttonRefs.current[next]?.focus();
  };

  return (
    <nav aria-label="Task switcher" className="min-w-0">
      <div
        role="tablist"
        aria-label="Practice tasks"
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 rounded-xl bg-slate-100 p-1"
      >
        {taskOrder.map((task) => {
          const active = state.activeTask === task;
          const submitted = Boolean(state.submission?.[taskKey(task)]);
          const words = countWords(state.draft[draftKey(task)]);
          return (
            <button
              key={task}
              id={`task-tab-${task}`}
              ref={(node) => {
                buttonRefs.current[task] = node;
              }}
              type="button"
              role="tab"
              data-testid={`task-tab-${task}`}
              onClick={() => actions.setActiveTask(task)}
              aria-selected={active}
              aria-controls="task-panel"
              tabIndex={active ? 0 : -1}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Task {task}
              <span className={`text-[11px] font-medium tabular-nums ${active ? "text-slate-500" : "text-slate-600"}`}>
                {words} w
              </span>
              {submitted && (
                <span className="text-emerald-600" title="Submitted">
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function SubmitAllButton({ compact = false }: { compact?: boolean }) {
  const { actions, state } = useSession();
  const [confirming, setConfirming] = useState(false);
  const alreadySubmitted = Boolean(state.submission?.task1 && state.submission?.task2);

  if (alreadySubmitted) return null;

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            actions.submitAll();
          }}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Confirm submit all
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg px-2 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="submit-all"
      onClick={() => setConfirming(true)}
      className={`rounded-lg bg-slate-900 font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
        compact ? "px-3 py-2 text-xs" : "px-3.5 py-2 text-sm"
      }`}
    >
      Submit all
    </button>
  );
}

function QuitButton() {
  const { actions } = useSession();
  return (
    <button
      type="button"
      data-testid="quit-session"
      onClick={() => {
        if (window.confirm("Quit this session? Your draft answers will be erased.")) actions.reset();
      }}
      className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
    >
      Quit
    </button>
  );
}

function LockOverlay({ onReview }: { onReview: () => void }) {
  const { actions } = useSession();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  /* Move focus into the dialog so screen readers announce the alert immediately. */
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      data-testid="lock-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="time-up-title"
      aria-describedby="time-up-desc"
      className="fixed inset-0 z-40 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-600">
            <LockIcon />
          </span>
          <h2 id="time-up-title" className="text-lg font-semibold text-slate-900">
            Time is up
          </h2>
        </div>
        <p id="time-up-desc" className="mt-3 text-sm leading-6 text-slate-600">
          The 60-minute limit has been reached and the editor is locked. Submitting now records your answers
          exactly as they stand.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={actions.submitAll}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            Submit answers
          </button>
          <button
            type="button"
            onClick={onReview}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          >
            Review my answers
          </button>
        </div>
      </div>
    </div>
  );
}

function PenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20l4-1 10-10a2.1 2.1 0 0 0-3-3L5 16l-1 4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
