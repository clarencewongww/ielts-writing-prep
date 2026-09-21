/** Exam screen shell: sticky header (timer · task switcher · submit) + the active task workspace. */

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { countWords } from "../data/wordCount";
import { draftKey, taskKey, type TaskNumber } from "../types/session";
import { TaskPanel } from "./TaskPanel";
import { Timer } from "./Timer";
import { useSession } from "./useSession";
import { useTimer } from "./useTimer";

/** Shared by the desktop info bar and the phone-sized collapsed disclosure. */
const TIMING_GUIDE =
  "Timing is a guide: many people take Task 2 first (about 40 min), then Task 1 (about 20 min) — the only hard rule is the 60:00 stop. The live word count and clock are your helpers here; spellcheck and autocorrect stay off on purpose, and highlighting is disabled because the answer box is a plain textarea.";

export function ExamScreen() {
  const { state, session } = useSession();
  const timer = useTimer();
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  useEffect(() => {
    if (!timer.expired) setOverlayDismissed(false);
  }, [timer.expired]);

  return (
    <div className="min-h-screen bg-surface" data-testid="exam-screen">
      {/* Glass belongs to the functional layer only (materials.md › Liquid Glass):
          the header floats over scrolling content, cards below stay opaque.
          .glass falls back to an opaque fill under prefers-reduced-transparency. */}
      <header className="glass sticky top-0 z-30 border-b border-line/70">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:gap-x-4 sm:gap-y-3 sm:px-4 sm:py-3">
          <div className="min-w-0 leading-tight">
            <div className="text-headline font-semibold text-ink">IELTS Writing</div>
            {/* The mode/time summary would only repeat what the timer and tabs
                already show on a phone, so it waits for >=sm; this keeps the
                sticky header two rows tall at 390 instead of three
                (toolbars.md › Best practices: keep bars shallow). */}
            <div className="hidden text-caption text-ink-2 sm:block">
              {session.mode === "computer" ? "Computer-based" : "Paper practice"} · 60 minutes · 2 tasks
            </div>
          </div>

          <TaskTabs />

          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <Timer />
            <SubmitAllButton />
            <QuitButton />
          </div>
        </div>

        {/* Timing guide: the full sentence on >=sm, one collapsed line on phones so the
            sticky header stays shallow and the timer/editor keep the screen. */}
        <div className="border-t border-line-soft bg-content/60">
          <div className="mx-auto hidden max-w-[1400px] items-start gap-2 px-4 py-1.5 text-caption leading-5 text-ink-2 sm:flex">
            <InfoIcon />
            <p className="m-0">{TIMING_GUIDE}</p>
          </div>
          <details data-testid="timing-guide-details" className="group sm:hidden">
            <summary className="mx-auto flex max-w-[1400px] cursor-pointer list-none items-center gap-2 px-3 py-2 text-caption font-medium leading-5 text-ink-2 focus-visible:outline-tint">
              <InfoIcon />
              <span>Timing is a guide</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform ease-apple group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="mx-auto max-w-[1400px] px-3 pb-2 text-caption leading-5 text-ink-2">{TIMING_GUIDE}</p>
          </details>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-3 pb-10 sm:px-4">
        {timer.expired && !overlayDismissed && (
          <LockOverlay onReview={() => setOverlayDismissed(true)} />
        )}
        {timer.expired && overlayDismissed && (
          <div
            data-testid="expired-banner"
            role="status"
            aria-live="polite"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-control bg-danger-soft px-4 py-3 text-subhead text-danger"
          >
            <LockIcon />
            <span className="font-medium">
              Time&rsquo;s up — the editor is locked, and everything you wrote is safe. Submit all to see your
              report.
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
      {/* Segmented control over a system track; the selected segment carries the
          accent, so "where am I" needs no second colour. Tabs navigate and never
          act (tab-bars.md › Best practices; tab-views.md). */}
      <div
        role="tablist"
        aria-label="Practice tasks"
        onKeyDown={handleKeyDown}
        className="flex flex-wrap items-center gap-1 rounded-full bg-ink/[0.04] p-1"
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
              className={`flex min-h-[36px] items-center gap-2 rounded-full px-3 text-subhead font-semibold transition-colors ease-apple focus-visible:outline-tint sm:px-3.5 ${
                active ? "bg-tint-fill text-white" : "text-ink-2 hover:text-ink"
              }`}
            >
              Task {task}
              <span className={`text-caption font-medium tabular-nums ${active ? "text-white" : "text-ink-2"}`}>
                {words} w
              </span>
              {submitted && (
                <span className={active ? "text-white" : "text-ok"} title="Submitted">
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
        {/* Ends the session: destructive role, so it stays red and never the
            primary style (buttons.md › Role). */}
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            actions.submitAll();
          }}
          className="min-h-[44px] whitespace-nowrap rounded-full bg-danger-fill px-4 text-subhead font-semibold text-white shadow-sm transition-colors ease-apple hover:opacity-90 focus-visible:outline-danger"
        >
          Confirm submit all
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-[44px] rounded-full px-3 text-subhead font-medium text-ink-2 transition-colors ease-apple hover:bg-ink/5 hover:text-ink focus-visible:outline-tint"
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
      className={`min-h-[44px] whitespace-nowrap rounded-full bg-tint-fill font-semibold text-white shadow-sm transition-colors ease-apple hover:bg-tint-strong focus-visible:outline-tint ${
        compact ? "px-4 text-footnote" : "px-4 text-subhead"
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
        if (window.confirm("Quit this session? Your draft answers will be erased and you'll return to setup."))
          actions.reset();
      }}
      className="min-h-[44px] rounded-full px-3 text-subhead font-medium text-ink-2 transition-colors ease-apple hover:bg-ink/5 hover:text-ink focus-visible:outline-tint"
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
      className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-card bg-content p-6 shadow-pop outline-none"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-danger-soft text-danger">
            <LockIcon />
          </span>
          <h2 id="time-up-title" className="text-title font-semibold text-ink">
            Time&rsquo;s up — nice effort
          </h2>
        </div>
        <p id="time-up-desc" className="mt-3 text-subhead leading-6 text-ink-2">
          You reached the 60:00 mark, so the editor is locked. Submitting now records your answers exactly as
          they stand — nothing you wrote is lost.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {/* The exam is over: the one action left is to hand in, and the red fill
              matches the locked danger state the banner already uses. */}
          <button
            type="button"
            onClick={actions.submitAll}
            className="min-h-[44px] rounded-full bg-danger-fill px-5 text-subhead font-semibold text-white shadow-sm transition-colors ease-apple hover:opacity-90 focus-visible:outline-danger"
          >
            Submit answers
          </button>
          <button
            type="button"
            onClick={onReview}
            className="min-h-[44px] rounded-full border border-line px-5 text-subhead font-medium text-ink transition-colors ease-apple hover:bg-surface focus-visible:outline-tint"
          >
            Review my answers
          </button>
        </div>
      </div>
    </div>
  );
}

/* The header keeps no logo tile: branding defers to content and logos don't
   repeat through the app (branding.md). The timer pill is the one bold element. */

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
