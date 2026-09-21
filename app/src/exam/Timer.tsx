import { useSession } from "./useSession";
import { useTimer } from "./useTimer";

/**
 * SIGNATURE ELEMENT — the sticky exam clock.
 *
 * A frosted capsule with tabular mono numerals and a 3px progress sliver, sized
 * for a thumb (44px tall) and quiet until it matters: neutral while time is
 * fine, amber in the final minute, red when expired. The countdown is the one
 * moving part of the app, so nothing else claims this kind of attention
 * (SKILL.md › Design improvement mode step 2 › signature; motion.md).
 *
 * Urgency is never colour-only: the label switches text ("remaining" →
 * "final minute" → "time up") and the region announces expiry
 * (accessibility.md › Vision: convey information with more than colour).
 */
export function Timer() {
  const { session } = useSession();
  const timer = useTimer();
  if (!session.uiRules.timerVisible) return null;

  const tone =
    timer.urgency === "expired"
      ? "border-danger/40 bg-danger-soft text-danger"
      : timer.urgency === "final-minute"
        ? "border-warn/40 bg-warn-soft text-warn"
        : "border-line bg-content text-ink";

  /* The sliver is status, not interactivity, so it never uses the accent blue. */
  const barTone =
    timer.urgency === "expired" ? "bg-danger" : timer.urgency === "final-minute" ? "bg-warn" : "bg-ink/70";

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
      className={`relative flex min-h-[44px] min-w-[7.75rem] items-center gap-2.5 overflow-hidden rounded-full border px-3.5 py-2 shadow-card transition-colors ease-apple ${tone}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.2 2" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <div className="font-mono text-[22px] font-semibold tabular-nums tracking-tight">{timer.display}</div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-70">{label}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink/10">
        <div
          className={`h-full ${barTone} transition-[width] duration-300 ease-apple`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
