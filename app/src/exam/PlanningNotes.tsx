/**
 * Optional planning area — kept on this device, not part of the submission.
 *
 * Collapsed by default: the summary is the only thing visible until the learner expands
 * it, so it can never be mistaken for answer text. The live word counter reads the answer
 * draft only, so expanding or collapsing these notes leaves the counter unchanged.
 */

import { useSession } from "./useSession";

export function PlanningNotes() {
  const { state, actions } = useSession();

  return (
    <details
      data-testid="planning-notes"
      className="group rounded-card border border-line bg-content shadow-card"
    >
      <summary className="flex min-h-[44px] cursor-pointer select-none items-center gap-2 rounded-card px-4 py-3 text-headline font-semibold text-ink focus-visible:outline-tint marker:content-none">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 text-ink-3 transition-transform ease-apple group-open:rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Planning notes
        <span className="ml-auto text-caption font-normal text-ink-2">
          saved locally · not submitted
        </span>
      </summary>
      <div className="border-t border-line-soft p-3">
        <label htmlFor="planning-notes" className="sr-only">
          Planning notes
        </label>
        <textarea
          id="planning-notes"
          data-testid="planning-notes-input"
          value={state.planningNotes}
          onChange={(event) => actions.setPlanningNotes(event.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          rows={6}
          placeholder={"Plan here: position, main ideas, data groupings…"}
          className="w-full resize-y rounded-control bg-surface px-3.5 py-2.5 font-sans text-subhead leading-6 text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-inset focus:ring-tint/40 focus-visible:outline-none"
        />
      </div>
    </details>
  );
}
