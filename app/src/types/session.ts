/**
 * Session / submission contract — schemaVersion 1.
 *
 * Timing model (important for `useTimer`):
 *   `startedAt` anchors the current timing segment and `elapsedMs` banks every
 *   millisecond accumulated *before* that anchor. Live elapsed time is therefore
 *       elapsedMs + (now - startedAt)
 *   The provider re-anchors whenever it writes to storage (debounced writes,
 *   `visibilitychange`, `pagehide`, `beforeunload`), so reloading the page resumes
 *   from the banked total instead of double-counting or losing time.
 */

import type { GradingReport } from "./grading";

export type ExamMode = "computer" | "paper";

export type SessionStatus = "setup" | "in-progress" | "submitted" | "graded";

export type TaskNumber = 1 | 2;

/** Which task the candidate starts with. Task 2 first is the IELTS-recommended order. */
export type TaskOrder = "t1-first" | "t2-first";

export interface TaskSpec {
  task: TaskNumber;
  minutesRecommended: number;
  wordMinimum: number;
  wordTarget: [number, number];
}

export interface UiRules {
  plainTextBox: true;
  spellcheck: false;
  autocorrect: false;
  autocapitalise: false;
  liveWordCount: true;
  timerVisible: true;
  secondsHiddenLastMinute: true;
  hardStopAtZero: true;
  planningNotesArea: true;
  allowCopyPaste: true;
  allowHighlight: false;
}

export interface Session {
  mode: ExamMode;
  totalMinutes: 60;
  tasks: [TaskSpec, TaskSpec];
  uiRules: UiRules;
}

export interface SubmissionTask {
  text: string;
  /** ISO timestamp when the candidate first opened this task. */
  startedAt: string;
  /** ISO timestamp when the task was submitted. */
  submittedAt: string;
  words: number;
  /** Filled in by the grading step when a reference answer is attached. */
  refId?: string;
}

export interface Submission {
  task1: SubmissionTask | null;
  task2: SubmissionTask | null;
}

/** Chosen exam content for a session. `task2Order` records which task runs first. */
export interface SessionSelection {
  task1Id?: string;
  task2Id?: string;
  task2Order?: TaskOrder;
}

export interface SessionState {
  schemaVersion: 1;
  bankVersion: string;
  status: SessionStatus;
  activeTask: TaskNumber;
  /** Segment anchor — see the timing model note above. `null` until the session starts. */
  startedAt: string | null;
  /** ISO timestamp set when both tasks were submitted. */
  submittedAt?: string;
  /** Banked elapsed time in milliseconds; see the timing model note above. */
  elapsedMs: number;
  draft: { 1: string; 2: string };
  planningNotes: string;
  selection: SessionSelection;
  submission?: Submission;
  /** Deterministic grading report, persisted once the session reaches `graded`. */
  report?: GradingReport;
}

/** First-open timestamps per task, persisted separately from the session snapshot. */
export interface TaskTimings {
  task1StartedAt?: string;
  task2StartedAt?: string;
}

/** Pre-written answer pair used by the setup screen's demo samples. */
export interface SampleTexts {
  task1: string;
  task2: string;
}

/** Remembered setup-screen choices so a reload lands back on the same form state. */
export interface SetupPrefs extends SessionSelection {
  mode: ExamMode;
  task1Type?: string;
  task2Family?: string;
}

export const SESSION_SCHEMA_VERSION = 1 as const;

export function otherTask(task: TaskNumber): TaskNumber {
  return task === 1 ? 2 : 1;
}

export function taskKey(task: TaskNumber): "task1" | "task2" {
  return task === 1 ? "task1" : "task2";
}

export function isTaskNumber(value: unknown): value is TaskNumber {
  return value === 1 || value === 2;
}

export function emptySubmission(): Submission {
  return { task1: null, task2: null };
}

export function draftKey(task: TaskNumber): "1" | "2" {
  return task === 1 ? "1" : "2";
}
