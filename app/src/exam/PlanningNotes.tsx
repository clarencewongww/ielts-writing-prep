/** Optional planning area — kept on this device, not part of the submission. */

import { useSession } from "./useSession";

export function PlanningNotes() {
  const { state, actions } = useSession();

  return (
    <details
      data-testid="planning-notes"
      className="group rounded-xl border border-slate-200 bg-white shadow-sm open:shadow"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 marker:content-none">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Planning notes
        <span className="ml-auto text-[11px] font-normal text-slate-500">
          saved locally · not submitted
        </span>
      </summary>
      <div className="border-t border-slate-200 p-3">
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
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-sans text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200"
        />
      </div>
    </details>
  );
}
