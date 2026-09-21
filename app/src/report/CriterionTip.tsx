/**
 * Criterion tooltip: shows the full criterion name plus a one-line meaning on
 * hover, keyboard focus or tap. The trigger is a real <button> wired with
 * `aria-describedby`, so the explanation is announced to assistive tech as well
 * as shown visually (HIG writing: say what happens, no jargon, never a bare
 * code such as "TA").
 */

import { useId, useState } from "react";
import { cx } from "../tasks/format";
import type { Criterion } from "../types/grading";

export interface CriterionInfo {
  /** Apple-HIG style plain name, e.g. "Task Achievement". */
  name: string;
  /** One-line meaning, e.g. "Task 1: overview + key features + data, no opinion". */
  meaning: string;
}

export const CRITERION_INFO: Record<Criterion, CriterionInfo> = {
  TA: {
    name: "Task Achievement",
    meaning: "Task 1: overview + key features + data, no opinion",
  },
  TR: {
    name: "Task Response",
    meaning: "Task 2: answer all parts + clear position + developed ideas",
  },
  CC: {
    name: "Coherence & Cohesion",
    meaning: "paragraphing + logical flow + flexible linkers",
  },
  LR: {
    name: "Lexical Resource",
    meaning: "vocabulary range + collocation + spelling",
  },
  GRA: {
    name: "Grammatical Range & Accuracy",
    meaning: "sentence variety + error control",
  },
};

/** Visible label used everywhere a criterion is named: "Task Achievement (TA)". */
export function criterionLabel(criterion: Criterion): string {
  return `${CRITERION_INFO[criterion].name} (${criterion})`;
}

export interface CriterionTipProps {
  criterion: Criterion;
  /** Visible trigger text; defaults to `Full name (CODE)`. */
  label?: string;
  /** Extra classes for the inline wrapper (typography is inherited). */
  className?: string;
  /** Which edge the tooltip aligns to; use "right" in narrow right-hand tiles. */
  align?: "left" | "right";
}

export function CriterionTip({ criterion, label, className, align = "left" }: CriterionTipProps) {
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tipId = useId();
  const info = CRITERION_INFO[criterion];
  const open = !dismissed && (focused || pinned);

  return (
    <span className={cx("group relative inline-flex max-w-full", className)} data-testid={`criterion-tip-${criterion}`}>
      <button
        type="button"
        aria-describedby={tipId}
        data-state={open ? "open" : "closed"}
        onFocus={() => {
          setFocused(true);
          setDismissed(false);
        }}
        onBlur={() => {
          setFocused(false);
          setPinned(false);
          setDismissed(false);
        }}
        onClick={(event) => {
          const next = !pinned;
          setPinned(next);
          setDismissed(false);
          if (!next) event.currentTarget.blur();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDismissed(true);
            setPinned(false);
          }
        }}
        className="cursor-help rounded-sm text-left underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-tint"
      >
        {label ?? criterionLabel(criterion)}
      </button>
      <span
        role="tooltip"
        id={tipId}
        data-testid={`criterion-tip-text-${criterion}`}
        className={cx(
          "pointer-events-none absolute top-full z-30 mt-1.5 w-64 max-w-[80vw] rounded-control bg-ink px-3 py-2 text-left text-caption font-normal normal-case leading-4 tracking-normal text-surface shadow-pop transition-opacity ease-apple",
          align === "right" ? "right-0" : "left-0",
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <span className="font-semibold">{info.name}</span> — {info.meaning}
      </span>
    </span>
  );
}
