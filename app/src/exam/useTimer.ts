/**
 * Timer maths + the 250 ms tick.
 *
 * The timed value is always recomputed from the provider's anchor (`startedAt` + banked
 * `elapsedMs`), never accumulated tick by tick, so background-tab throttling cannot drift.
 *
 * Display contract (`secondsHiddenLastMinute`):
 *   remaining > 60 s  -> "MM:SS"
 *   remaining <= 60 s -> "MM" (two digits)
 *   remaining <= 0    -> "00" plus the lock overlay while the session is running.
 */

import { useEffect, useMemo, useState } from "react";
import { FINAL_MINUTE_MS, TIMER_TICK_MS } from "../constants";
import { useSession } from "./useSession";

export type TimerUrgency = "normal" | "final-minute" | "expired";

export interface TimerSnapshot {
  elapsedMs: number;
  remainingMs: number;
  totalMs: number;
  expired: boolean;
  /** True when the hard stop applies and the editor must be read-only. */
  locked: boolean;
  running: boolean;
  urgency: TimerUrgency;
  display: string;
}

export interface TimerInput {
  elapsedMs: number;
  totalMs: number;
  running: boolean;
  hardStopAtZero: boolean;
  secondsHiddenLastMinute: boolean;
}

export function formatTimerDisplay(remainingMs: number, secondsHiddenLastMinute = true): string {
  const clamped = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!secondsHiddenLastMinute || clamped > FINAL_MINUTE_MS) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return String(Math.ceil(clamped / 60_000)).padStart(2, "0");
}

export function computeTimerSnapshot(input: TimerInput): TimerSnapshot {
  const elapsedMs = Math.max(0, Math.min(input.elapsedMs, input.totalMs));
  const remainingMs = Math.max(0, input.totalMs - elapsedMs);
  const expired = input.running && remainingMs <= 0;
  const urgency: TimerUrgency = expired
    ? "expired"
    : remainingMs <= FINAL_MINUTE_MS
      ? "final-minute"
      : "normal";

  return {
    elapsedMs,
    remainingMs,
    totalMs: input.totalMs,
    expired,
    locked: expired && input.hardStopAtZero,
    running: input.running,
    urgency,
    display: formatTimerDisplay(remainingMs, input.secondsHiddenLastMinute),
  };
}

/** Re-renders every `intervalMs` while the session runs; otherwise the value is frozen. */
export function useTimer(intervalMs: number = TIMER_TICK_MS): TimerSnapshot {
  const { session, state, getElapsedMs } = useSession();
  const [tick, setTick] = useState(0);
  const running = state.status === "in-progress";
  const totalMs = session.totalMinutes * 60_000;
  const { hardStopAtZero, secondsHiddenLastMinute } = session.uiRules;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [running, intervalMs]);

  return useMemo(
    () =>
      computeTimerSnapshot({
        elapsedMs: getElapsedMs(),
        totalMs,
        running,
        hardStopAtZero,
        secondsHiddenLastMinute,
      }),
    // `tick` is the render trigger; the snapshot itself is derived from the anchor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getElapsedMs, totalMs, running, hardStopAtZero, secondsHiddenLastMinute, tick],
  );
}
