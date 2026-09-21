/**
 * localStorage persistence for the active session.
 *
 * Every value is wrapped in a schema-versioned envelope:
 *   `{ schemaVersion, savedAt, data }`
 * Reads discard and delete anything whose `schemaVersion` no longer matches, so a
 * future contract change can never hydrate the app with incompatible state.
 *
 * Writes are debounced by `createPersistenceScheduler` (500 ms trailing); the
 * provider additionally flushes on `visibilitychange`, `pagehide` and `beforeunload`.
 */

import {
  SESSION_SCHEMA_VERSION,
  type SessionState,
  type SetupPrefs,
  type TaskTimings,
} from "../types/session";

export const STORAGE_DEBOUNCE_MS = 500;

export const STORAGE_KEYS = {
  /** SessionState snapshot (contract schemaVersion 1). */
  session: "ielts.session.v1",
  /** Per-task first-open timestamps. */
  timings: "ielts.timings.v1",
  /** Remembered setup-screen choices. */
  setup: "ielts.setup.v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

interface StoredEnvelope<T> {
  schemaVersion: number;
  savedAt: string;
  data: T;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Safari private mode and hardened browsers can throw on storage access.
    return null;
  }
}

export function readStored<T>(key: string, schemaVersion: number = SESSION_SCHEMA_VERSION): T | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope<T>> | null;
    if (!parsed || typeof parsed !== "object") throw new Error("stored value is not an object");
    if (parsed.schemaVersion !== schemaVersion) {
      console.warn(
        `[persistence] discarding ${key}: schemaVersion ${String(parsed.schemaVersion)} != ${schemaVersion}`,
      );
      storage.removeItem(key);
      return null;
    }
    return (parsed.data ?? null) as T | null;
  } catch (error) {
    console.warn(`[persistence] discarding corrupt ${key}:`, error);
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeStored<T>(key: string, data: T, schemaVersion: number = SESSION_SCHEMA_VERSION): void {
  const storage = getStorage();
  if (!storage) return;
  const envelope: StoredEnvelope<T> = {
    schemaVersion,
    savedAt: new Date().toISOString(),
    data,
  };
  try {
    storage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    console.warn(`[persistence] could not write ${key}:`, error);
  }
}

export function removeStored(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Typed accessors                                                     */
/* ------------------------------------------------------------------ */

export function isSessionState(value: unknown): value is SessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SessionState>;
  if (state.schemaVersion !== SESSION_SCHEMA_VERSION) return false;
  if (typeof state.bankVersion !== "string") return false;
  if (state.status !== "setup" && state.status !== "in-progress" && state.status !== "submitted" && state.status !== "graded") {
    return false;
  }
  if (state.activeTask !== 1 && state.activeTask !== 2) return false;
  if (state.startedAt !== null && typeof state.startedAt !== "string") return false;
  if (typeof state.elapsedMs !== "number" || !Number.isFinite(state.elapsedMs)) return false;
  if (
    !state.draft ||
    typeof state.draft[1] !== "string" ||
    typeof state.draft[2] !== "string"
  ) {
    return false;
  }
  if (typeof state.planningNotes !== "string") return false;
  if (!state.selection || typeof state.selection !== "object") return false;
  if (state.report !== undefined) {
    if (!state.report || typeof state.report !== "object") return false;
    if (state.report.schemaVersion !== 1) return false;
    if (typeof state.report.overallBand !== "number") return false;
    if (!state.report.task1 || !state.report.task2) return false;
  }
  return true;
}

export function loadSessionState(): SessionState | null {
  const value = readStored<SessionState>(STORAGE_KEYS.session);
  if (!value) return null;
  if (!isSessionState(value)) {
    console.warn("[persistence] stored session failed the shape check; discarding.");
    removeStored(STORAGE_KEYS.session);
    return null;
  }
  return value;
}

export function saveSessionState(state: SessionState): void {
  writeStored(STORAGE_KEYS.session, state);
}

export function loadTaskTimings(): TaskTimings {
  const value = readStored<TaskTimings>(STORAGE_KEYS.timings);
  return value && typeof value === "object" ? value : {};
}

export function saveTaskTimings(timings: TaskTimings): void {
  writeStored(STORAGE_KEYS.timings, timings);
}

export function loadSetupPrefs(): SetupPrefs | null {
  const value = readStored<SetupPrefs>(STORAGE_KEYS.setup);
  return value && typeof value === "object" ? value : null;
}

export function saveSetupPrefs(prefs: SetupPrefs): void {
  writeStored(STORAGE_KEYS.setup, prefs);
}

/** Merges a patch into the stored setup preferences and returns the merged value. */
export function patchSetupPrefs(patch: Partial<SetupPrefs>): SetupPrefs {
  const merged: SetupPrefs = { ...(loadSetupPrefs() ?? { mode: "computer" }), ...patch };
  saveSetupPrefs(merged);
  return merged;
}

/** Clears the session snapshot and per-task timings; setup preferences survive a reset. */
export function clearSessionKeys(): void {
  removeStored(STORAGE_KEYS.session);
  removeStored(STORAGE_KEYS.timings);
}

/* ------------------------------------------------------------------ */
/* Debounced writer                                                    */
/* ------------------------------------------------------------------ */

export interface PersistenceScheduler {
  /** Queue a write, replacing any pending one; fires after `delayMs` of quiet. */
  schedule(save: () => void): void;
  /** Run the pending write immediately (visibilitychange / pagehide / beforeunload). */
  flush(): void;
  cancel(): void;
}

export function createPersistenceScheduler(delayMs: number = STORAGE_DEBOUNCE_MS): PersistenceScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    schedule(save: () => void) {
      pending = save;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        const run = pending;
        pending = null;
        run?.();
      }, delayMs);
    },
    flush() {
      clearTimer();
      const run = pending;
      pending = null;
      run?.();
    },
    cancel() {
      clearTimer();
      pending = null;
    },
  };
}
