/**
 * Live word counter.
 *
 * Colour contract: amber below the minimum, green inside the recommended target,
 * neutral between the target and the ceiling, red above the ceiling.
 */

import { TASK1_WORDS, TASK1_WORD_WARN, TASK2_WORDS, TASK2_WORD_WARN } from "../constants";
import { classifyWordCount, countWords, type WordCountLevel } from "../data/wordCount";
import type { TaskNumber } from "../types/session";

const LEVEL_STYLES: Record<
  WordCountLevel,
  { text: string; bar: string; track: string; badge: string }
> = {
  under: {
    text: "text-amber-700",
    bar: "bg-amber-500",
    track: "bg-amber-100",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
  },
  target: {
    text: "text-emerald-700",
    bar: "bg-emerald-500",
    track: "bg-emerald-100",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  over: {
    text: "text-slate-600",
    bar: "bg-slate-400",
    track: "bg-slate-200",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
  },
  "over-ceiling": {
    text: "text-red-700",
    bar: "bg-red-500",
    track: "bg-red-100",
    badge: "border-red-200 bg-red-50 text-red-800",
  },
};

export interface WordCounterProps {
  task: TaskNumber;
  text: string;
  className?: string;
}

export function WordCounter({ task, text, className = "" }: WordCounterProps) {
  const config =
    task === 1
      ? { min: TASK1_WORDS.min, target: TASK1_WORDS.recommended, ceiling: TASK1_WORDS.hardCeiling, warn: TASK1_WORD_WARN }
      : { min: TASK2_WORDS.min, target: TASK2_WORDS.recommended, ceiling: TASK2_WORDS.hardCeiling, warn: TASK2_WORD_WARN };
  const status = classifyWordCount(countWords(text), config);
  const styles = LEVEL_STYLES[status.level];
  const percent = Math.min(100, (status.count / config.ceiling) * 100);

  return (
    <div
      data-testid={`word-counter-${task}`}
      data-level={status.level}
      data-words={status.count}
      className={`min-w-[13rem] flex-1 ${className}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`font-mono text-xl font-semibold tabular-nums ${styles.text}`}>{status.count}</span>
        <span className="text-xs font-medium text-slate-500">words</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}>
          min {config.min} · target {config.target[0]}–{config.target[1]} · ceiling {config.ceiling}
        </span>
        {status.overWarn && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            over the {config.warn}-word warning line
          </span>
        )}
      </div>
      <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${styles.track}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${styles.bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${styles.text}`}>{status.message}</p>
    </div>
  );
}
