/**
 * Plain exam textarea.
 *
 * Honours the session UI rules: `spellcheck=false`, `autocorrect=off`,
 * `autocapitalize=off`, copy/paste allowed. Browser grammar extensions
 * (Grammarly etc.) are also discouraged via data attributes.
 *
 * Documented deviation — `allowHighlight: false`: this is a plain `<textarea>`,
 * not a `contenteditable` rich-text surface, so the browser cannot be stopped
 * from drawing a selection rectangle while dragging. The app instead renders the
 * selection in a low-contrast slate tone (`selection:bg-slate-300/60`) and offers
 * no highlight tool; the answer remains plain text with no formatting.
 */

import { useSession } from "./useSession";
import type { TaskNumber } from "../types/session";

export interface AnswerBoxProps {
  task: TaskNumber;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export function AnswerBox({ task, value, onChange, disabled, placeholder }: AnswerBoxProps) {
  const { session } = useSession();
  const { uiRules } = session;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <label htmlFor={`answer-task-${task}`} className="sr-only">
        Task {task} answer
      </label>
      <textarea
        id={`answer-task-${task}`}
        data-testid="answer-box"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck={uiRules.spellcheck}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        lang="en-GB"
        wrap="soft"
        placeholder={placeholder ?? "Type your answer here…"}
        className={`min-h-[420px] w-full flex-1 resize-y bg-white px-4 py-3 font-sans text-[15px] leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600 ${
          uiRules.allowHighlight ? "" : "selection:bg-slate-300/60"
        }`}
      />
      {disabled && (
        <div
          data-testid="answer-locked"
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-slate-200 bg-slate-50/90 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Read-only — this task is locked
        </div>
      )}
    </div>
  );
}
