/**
 * SessionProvider — owns the `SessionState` machine, the timer maths and persistence.
 *
 * State machine: setup -> in-progress -> submitted -> graded (reset returns to setup).
 * Both tasks can be submitted independently; the session moves to `submitted` once
 * both submissions exist. The timer is advisory per task (20/40) and hard-stops at 60.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SESSION_TOTAL_MS, buildSession } from "../constants";
import { getTask1Item, getTask2Item, type BankData } from "../data/bankLoader";
import { countWords } from "../data/wordCount";
import {
  STORAGE_DEBOUNCE_MS,
  clearSessionKeys,
  createPersistenceScheduler,
  loadSessionState,
  loadSetupPrefs,
  loadTaskTimings,
  patchSetupPrefs,
  saveSessionState,
  saveTaskTimings,
} from "../store/persistence";
import {
  SESSION_SCHEMA_VERSION,
  draftKey,
  emptySubmission,
  taskKey,
  type ExamMode,
  type SampleTexts,
  type Session,
  type SessionSelection,
  type SessionState,
  type Submission,
  type SubmissionTask,
  type TaskNumber,
  type TaskTimings,
} from "../types/session";
import type { Task1Item, Task2Item } from "../types/bank";
import type { GradingReport } from "../types/grading";

export interface SessionActions {
  /** Begins a fresh 60-minute session with the chosen task items. */
  start(selection: SessionSelection, mode: ExamMode): void;
  /**
   * Skips the exam clock: loads a pre-written submission pair, marks the session
   * `submitted` and lets the app grade it (setup-screen demo samples).
   */
  loadSample(selection: SessionSelection, texts: SampleTexts, mode: ExamMode): void;
  setActiveTask(task: TaskNumber): void;
  /** Records the first time a task was opened (idempotent). */
  markTaskStarted(task: TaskNumber): void;
  setDraft(task: TaskNumber, text: string): void;
  setPlanningNotes(text: string): void;
  submitTask(task: TaskNumber, refId?: string): void;
  submitAll(): void;
  /** Called by the grading step once a report exists; persists it with the session. */
  markGraded(report?: GradingReport): void;
  /** Clears storage and returns to the setup screen. */
  reset(): void;
}

export interface SessionContextValue {
  session: Session;
  state: SessionState;
  bank: BankData;
  mode: ExamMode;
  task1Item: Task1Item | null;
  task2Item: Task2Item | null;
  /** Live elapsed time in ms: banked elapsed + current segment (clamped at 60 min). */
  getElapsedMs(): number;
  actions: SessionActions;
}

/** Internal — consume through `useSession()` from `./useSession`. */
export const SessionContext = createContext<SessionContextValue | null>(null);

function nowIso(): string {
  return new Date().toISOString();
}

export function createInitialState(bankVersion: string): SessionState {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    bankVersion,
    status: "setup",
    activeTask: 1,
    startedAt: null,
    elapsedMs: 0,
    draft: { 1: "", 2: "" },
    planningNotes: "",
    selection: {},
    submission: undefined,
  };
}

/** Restores a stored session, re-anchoring so a reload never double-counts time. */
function restoreSession(bankVersion: string): SessionState {
  const stored = loadSessionState();
  if (!stored) return createInitialState(bankVersion);
  if (stored.bankVersion !== bankVersion) {
    console.warn(
      `[session] stored session targets bank ${stored.bankVersion} but ${bankVersion} is loaded; starting fresh.`,
    );
    clearSessionKeys();
    return createInitialState(bankVersion);
  }
  if (stored.status === "in-progress" && !stored.startedAt) {
    return { ...stored, startedAt: nowIso() };
  }
  return stored;
}

/** Persisted snapshot: bank the live elapsed value and re-anchor `startedAt` to now. */
function snapshotForStorage(state: SessionState, liveElapsedMs: number): SessionState {
  const elapsedMs = Math.max(0, Math.min(liveElapsedMs, SESSION_TOTAL_MS));
  if (state.status !== "in-progress" || !state.startedAt) {
    return { ...state, elapsedMs };
  }
  return { ...state, elapsedMs, startedAt: nowIso() };
}

function buildSubmissionTask(
  state: SessionState,
  timings: TaskTimings,
  task: TaskNumber,
  refId?: string,
): SubmissionTask {
  const text = state.draft[draftKey(task)];
  const startedAt =
    (task === 1 ? timings.task1StartedAt : timings.task2StartedAt) ?? state.startedAt ?? nowIso();
  const submission: SubmissionTask = {
    text,
    startedAt,
    submittedAt: nowIso(),
    words: countWords(text),
  };
  if (refId) submission.refId = refId;
  return submission;
}

export interface SessionProviderProps {
  bank: BankData;
  children: ReactNode;
}

export function SessionProvider({ bank, children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>(() => restoreSession(bank.manifest.version));
  const [mode, setMode] = useState<ExamMode>(() => loadSetupPrefs()?.mode ?? "computer");
  const [timings, setTimings] = useState<TaskTimings>(() => loadTaskTimings());
  const [scheduler] = useState(() => createPersistenceScheduler(STORAGE_DEBOUNCE_MS));

  const stateRef = useRef(state);
  const timingsRef = useRef(timings);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  useLayoutEffect(() => {
    timingsRef.current = timings;
  }, [timings]);

  const getElapsedMs = useCallback((): number => {
    const current = stateRef.current;
    if (current.status !== "in-progress" || !current.startedAt) {
      return Math.max(0, Math.min(current.elapsedMs, SESSION_TOTAL_MS));
    }
    const anchor = Date.parse(current.startedAt);
    const sinceAnchor = Number.isFinite(anchor) ? Math.max(0, Date.now() - anchor) : 0;
    return Math.max(0, Math.min(current.elapsedMs + sinceAnchor, SESSION_TOTAL_MS));
  }, []);

  const persistNow = useCallback(() => {
    saveSessionState(snapshotForStorage(stateRef.current, getElapsedMs()));
  }, [getElapsedMs]);

  /* Debounced write on every state change (drafts, status, elapsed banking). */
  useEffect(() => {
    scheduler.schedule(persistNow);
  }, [state, scheduler, persistNow]);

  /* Immediate flush when the page is hidden or unloaded. */
  useEffect(() => {
    const flush = () => scheduler.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      scheduler.flush();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [scheduler]);

  const replaceState = useCallback((next: SessionState, immediate = false) => {
    const previous = stateRef.current;
    // Bank the live value when leaving an active exam, but never inherit the previous
    // session's elapsed time on start/reset (those pass their own elapsedMs).
    const liveElapsed =
      previous.status === "in-progress" && next.status !== "setup" ? getElapsedMs() : next.elapsedMs;
    stateRef.current = next;
    setState(next);
    if (immediate) saveSessionState(snapshotForStorage(next, liveElapsed));
  }, [getElapsedMs]);

  /*
   * Hard stop: once the clock reaches 60:00, bank the full total so the frozen state is
   * persisted (a reload after time-up stays expired instead of restoring stale time).
   */
  const expiryBankedRef = useRef(false);
  useEffect(() => {
    if (state.status !== "in-progress") {
      expiryBankedRef.current = false;
      return;
    }
    expiryBankedRef.current = getElapsedMs() >= SESSION_TOTAL_MS;
    const id = window.setInterval(() => {
      if (expiryBankedRef.current) return;
      if (getElapsedMs() >= SESSION_TOTAL_MS) {
        expiryBankedRef.current = true;
        replaceState({ ...stateRef.current, elapsedMs: SESSION_TOTAL_MS, startedAt: nowIso() }, true);
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [state.status, getElapsedMs, replaceState]);

  const markTaskStarted = useCallback((task: TaskNumber) => {
    const key = task === 1 ? "task1StartedAt" : "task2StartedAt";
    const current = timingsRef.current;
    if (current[key]) return;
    const next: TaskTimings = { ...current, [key]: nowIso() };
    timingsRef.current = next;
    setTimings(next);
    saveTaskTimings(next);
  }, []);

  const start = useCallback(
    (selection: SessionSelection, selectedMode: ExamMode) => {
      const order = selection.task2Order ?? "t2-first";
      const startedAt = nowIso();
      const activeTask: TaskNumber = order === "t2-first" ? 2 : 1;
      const next: SessionState = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        bankVersion: bank.manifest.version,
        status: "in-progress",
        activeTask,
        startedAt,
        elapsedMs: 0,
        draft: { 1: "", 2: "" },
        planningNotes: "",
        selection: { ...selection, task2Order: order },
      };

      const nextTimings: TaskTimings = {
        [activeTask === 1 ? "task1StartedAt" : "task2StartedAt"]: startedAt,
      };
      timingsRef.current = nextTimings;
      setTimings(nextTimings);
      saveTaskTimings(nextTimings);

      setMode(selectedMode);
      patchSetupPrefs({ ...selection, task2Order: order, mode: selectedMode });
      replaceState(next, true);
    },
    [bank.manifest.version, replaceState],
  );

  const loadSample = useCallback(
    (selection: SessionSelection, texts: SampleTexts, selectedMode: ExamMode) => {
      const order = selection.task2Order ?? "t2-first";
      const now = nowIso();
      const submission: Submission = {
        task1: {
          text: texts.task1,
          startedAt: now,
          submittedAt: now,
          words: countWords(texts.task1),
        },
        task2: {
          text: texts.task2,
          startedAt: now,
          submittedAt: now,
          words: countWords(texts.task2),
        },
      };
      const next: SessionState = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        bankVersion: bank.manifest.version,
        status: "submitted",
        activeTask: order === "t2-first" ? 2 : 1,
        startedAt: now,
        submittedAt: now,
        elapsedMs: 0,
        draft: { 1: texts.task1, 2: texts.task2 },
        planningNotes: "",
        selection: { ...selection, task2Order: order },
        submission,
      };

      const nextTimings: TaskTimings = { task1StartedAt: now, task2StartedAt: now };
      timingsRef.current = nextTimings;
      setTimings(nextTimings);
      saveTaskTimings(nextTimings);

      setMode(selectedMode);
      patchSetupPrefs({ ...selection, task2Order: order, mode: selectedMode });
      replaceState(next, true);
    },
    [bank.manifest.version, replaceState],
  );

  const setActiveTask = useCallback(
    (task: TaskNumber) => {
      const current = stateRef.current;
      if (current.status !== "in-progress" || current.activeTask === task) return;
      markTaskStarted(task);
      replaceState({ ...current, activeTask: task });
    },
    [markTaskStarted, replaceState],
  );

  const setDraft = useCallback(
    (task: TaskNumber, text: string) => {
      markTaskStarted(task);
      setState((prev) => {
        if (prev.submission?.[taskKey(task)]) return prev;
        const key = draftKey(task);
        if (prev.draft[key] === text) return prev;
        return { ...prev, draft: { ...prev.draft, [key]: text } };
      });
    },
    [markTaskStarted],
  );

  const setPlanningNotes = useCallback((text: string) => {
    setState((prev) => (prev.planningNotes === text ? prev : { ...prev, planningNotes: text }));
  }, []);

  const submitTask = useCallback(
    (task: TaskNumber, refId?: string) => {
      const current = stateRef.current;
      if (current.status !== "in-progress") return;
      const submission: Submission = { ...(current.submission ?? emptySubmission()) };
      submission[taskKey(task)] = buildSubmissionTask(current, timingsRef.current, task, refId);
      const bothSubmitted = Boolean(submission.task1 && submission.task2);
      replaceState(
        {
          ...current,
          submission,
          status: bothSubmitted ? "submitted" : current.status,
          submittedAt: bothSubmitted ? nowIso() : current.submittedAt,
        },
        true,
      );
    },
    [replaceState],
  );

  const submitAll = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== "in-progress") return;
    const existing = current.submission ?? emptySubmission();
    const submission: Submission = {
      task1: existing.task1 ?? buildSubmissionTask(current, timingsRef.current, 1),
      task2: existing.task2 ?? buildSubmissionTask(current, timingsRef.current, 2),
    };
    replaceState({ ...current, submission, status: "submitted", submittedAt: nowIso() }, true);
  }, [replaceState]);

  const markGraded = useCallback(
    (report?: GradingReport) => {
      const current = stateRef.current;
      if (current.status !== "submitted") return;
      replaceState({ ...current, status: "graded", ...(report ? { report } : {}) }, true);
    },
    [replaceState],
  );

  const reset = useCallback(() => {
    clearSessionKeys();
    const next = createInitialState(bank.manifest.version);
    timingsRef.current = {};
    setTimings({});
    replaceState(next, true);
  }, [bank.manifest.version, replaceState]);

  const actions = useMemo<SessionActions>(
    () => ({
      start,
      loadSample,
      setActiveTask,
      markTaskStarted,
      setDraft,
      setPlanningNotes,
      submitTask,
      submitAll,
      markGraded,
      reset,
    }),
    [
      start,
      loadSample,
      setActiveTask,
      markTaskStarted,
      setDraft,
      setPlanningNotes,
      submitTask,
      submitAll,
      markGraded,
      reset,
    ],
  );

  const session = useMemo(() => buildSession(mode), [mode]);
  const task1Item = useMemo(() => getTask1Item(bank, state.selection.task1Id), [bank, state.selection.task1Id]);
  const task2Item = useMemo(() => getTask2Item(bank, state.selection.task2Id), [bank, state.selection.task2Id]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      state,
      bank,
      mode,
      task1Item,
      task2Item,
      getElapsedMs,
      actions,
    }),
    [session, state, bank, mode, task1Item, task2Item, getElapsedMs, actions],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
