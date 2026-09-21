import { useSession } from "./useSession";
import { useTimer } from "./useTimer";

/** Sticky exam clock: MM:SS, switching to minutes-only in the last minute, plus a progress sliver. */
export function Timer() {
  const { session } = useSession();
  const timer = useTimer();
  if (!session.uiRules.timerVisible) return null;

  const tone =
    timer.urgency === "expired"
      ? "border-red-300 bg-red-50 text-red-700"
      : timer.urgency === "final-minute"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-white text-slate-900";

  const barTone =
    timer.urgency === "expired"
      ? "bg-red-500"
      : timer.urgency === "final-minute"
        ? "bg-amber-500"
        : "bg-slate-800";

  const label =
    timer.urgency === "expired" ? "time up" : timer.urgency === "final-minute" ? "final minute" : "remaining";
  const progress = timer.totalMs > 0 ? Math.min(100, (timer.elapsedMs / timer.totalMs) * 100) : 0;

  return (
    <div
      role="timer"
      aria-label={`Time remaining: ${timer.display}`}
      aria-live={timer.expired ? "assertive" : "off"}
      data-testid="exam-timer"
      data-timer-display={timer.display}
      data-timer-urgency={timer.urgency}
      className={`relative flex min-w-[7.5rem] items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2 shadow-sm ${tone}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.2 2" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{timer.display}</div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200/70">
        <div className={`h-full ${barTone} transition-[width] duration-300`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
