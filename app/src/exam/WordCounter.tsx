/**
 * Live word counter.
 *
 * Colour contract: amber below the minimum, green inside the recommended target,
 * neutral between the target and the ceiling, red above the ceiling. Status only —
 * the accent blue means "interactive" and is never used here
 * (color.md › Best practices: one colour, one meaning).
 */

import { TASK1_WORDS, TASK1_WORD_WARN, TASK2_WORDS, TASK2_WORD_WARN } from "../constants";
import {
  classifyWordCount,
  countWords,
  type WordCountInput,
  type WordCountLevel,
  type WordCountStatus,
} from "../data/wordCount";
import type { TaskNumber } from "../types/session";

const LEVEL_STYLES: Record<
  WordCountLevel,
  { text: string; bar: string; track: string; badge: string }
> = {
  under: {
    text: "text-warn",
    bar: "bg-warn",
    track: "bg-warn/15",
    badge: "bg-warn-soft text-warn",
  },
  target: {
    text: "text-ok",
    bar: "bg-ok",
    track: "bg-ok/15",
    badge: "bg-ok-soft text-ok",
  },
  over: {
    text: "text-ink-2",
    bar: "bg-ink-3",
    track: "bg-ink/10",
    badge: "bg-content text-ink-2 ring-1 ring-inset ring-line",
  },
  "over-ceiling": {
    text: "text-danger",
    bar: "bg-danger",
    track: "bg-danger/15",
    badge: "bg-danger-soft text-danger",
  },
};

export interface WordCounterProps {
  task: TaskNumber;
  text: string;
  className?: string;
}

/**
 * Learner-facing wording for the live counter. The grader's own messages stay
 * numeric and neutral; this layer adds the encouragement while keeping the same
 * levels (`classifyWordCount` still drives the colour contract).
 */
function friendlyMessage(status: WordCountStatus, config: WordCountInput): string {
  const [targetMin, targetMax] = config.target;
  const { count, level, overWarn } = status;

  if (count === 0) return `0 words — aim ${targetMin}-${targetMax}, you're warming up`;
  if (level === "under") {
    const short = config.min - count;
    return `${count} words — ${short} to go before the ${config.min} minimum. Keep going.`;
  }
  if (level === "target") return `${count} words — right in the ${targetMin}-${targetMax} sweet spot.`;
  if (level === "over-ceiling") {
    return `${count} words — over the ${config.ceiling} ceiling; trim a little rather than add detail.`;
  }
  return overWarn
    ? `${count} words — nudging the ${config.warn} warning line, still under the ${config.ceiling} ceiling.`
    : `${count} words — past the ${targetMax} target, comfortably under the ${config.ceiling} ceiling.`;
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
        <span className="text-caption font-medium text-ink-2">words</span>
        <span className={`rounded-full px-2.5 py-0.5 text-caption font-medium ${styles.badge}`}>
          min {config.min} · aim {config.target[0]}-{config.target[1]} · ceiling {config.ceiling}
        </span>
        {status.overWarn && (
          <span className="text-caption font-semibold text-warn">
            nudging the {config.warn}-word warning line
          </span>
        )}
      </div>
      <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${styles.track}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-apple ${styles.bar}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`mt-1.5 text-footnote ${styles.text}`}>{friendlyMessage(status, config)}</p>
    </div>
  );
}
