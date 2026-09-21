/**
 * Single source of truth for exam timing, word targets, ID validation and the
 * bank's 12 banned phrases. Values mirror `bank/manifest.json`; `bankLoader`
 * cross-checks the manifest at boot and warns when anything drifts.
 */

import type { Session, ExamMode } from "./types/session";
import type { Task1Type, Task2Family, WordTarget } from "./types/bank";

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

export const SESSION_TOTAL_MINUTES = 60;
export const TASK1_MINUTES = 20;
export const TASK2_MINUTES = 40;

export const SESSION_TOTAL_MS = SESSION_TOTAL_MINUTES * 60_000;
export const TIMER_TICK_MS = 250;
/** Under this remaining time the timer switches from MM:SS to minutes only. */
export const FINAL_MINUTE_MS = 60_000;

/* ------------------------------------------------------------------ */
/* Word targets                                                        */
/* ------------------------------------------------------------------ */

export const TASK1_WORD_MIN = 150;
export const TASK1_WORD_TARGET: [number, number] = [170, 190];
export const TASK1_WORD_WARN = 200;
export const TASK1_WORD_CEIL = 210;

export const TASK2_WORD_MIN = 250;
export const TASK2_WORD_TARGET: [number, number] = [270, 290];
export const TASK2_WORD_WARN = 300;
export const TASK2_WORD_CEIL = 300;

export const TASK1_WORDS: WordTarget = {
  min: TASK1_WORD_MIN,
  recommended: TASK1_WORD_TARGET,
  hardCeiling: TASK1_WORD_CEIL,
};

export const TASK2_WORDS: WordTarget = {
  min: TASK2_WORD_MIN,
  recommended: TASK2_WORD_TARGET,
  hardCeiling: TASK2_WORD_CEIL,
};

/** Minimum copied run (in words) before question text is treated as copied. */
export const COPY_RUN_MIN_WORDS = 5;

/* ------------------------------------------------------------------ */
/* Session contract                                                    */
/* ------------------------------------------------------------------ */

export function buildSession(mode: ExamMode = "computer"): Session {
  return {
    mode,
    totalMinutes: 60,
    tasks: [
      {
        task: 1,
        minutesRecommended: TASK1_MINUTES,
        wordMinimum: TASK1_WORD_MIN,
        wordTarget: [...TASK1_WORD_TARGET] as [number, number],
      },
      {
        task: 2,
        minutesRecommended: TASK2_MINUTES,
        wordMinimum: TASK2_WORD_MIN,
        wordTarget: [...TASK2_WORD_TARGET] as [number, number],
      },
    ],
    uiRules: {
      plainTextBox: true,
      spellcheck: false,
      autocorrect: false,
      autocapitalise: false,
      liveWordCount: true,
      timerVisible: true,
      secondsHiddenLastMinute: true,
      hardStopAtZero: true,
      planningNotesArea: true,
      allowCopyPaste: true,
      allowHighlight: false,
    },
  };
}

export const SESSION: Session = buildSession("computer");

export const EXAM_MODES: readonly ExamMode[] = ["computer", "paper"];

/* ------------------------------------------------------------------ */
/* Bank enums                                                          */
/* ------------------------------------------------------------------ */

export const TASK1_TYPES: readonly Task1Type[] = [
  "line",
  "bar",
  "pie",
  "table",
  "map",
  "process",
  "mixed",
];

export const TASK2_FAMILIES: readonly Task2Family[] = [
  "opinion",
  "discussion",
  "adv-disadv",
  "outweigh-posneg",
  "solution-cause-effect-direct",
];

export const TASK1_TYPE_LABELS: Record<Task1Type, string> = {
  line: "Line graph",
  bar: "Bar chart",
  pie: "Pie chart",
  table: "Table",
  map: "Map",
  process: "Process",
  mixed: "Mixed charts",
};

export const TASK2_FAMILY_LABELS: Record<Task2Family, string> = {
  opinion: "Opinion (agree/disagree)",
  discussion: "Discussion (both views)",
  "adv-disadv": "Advantages & disadvantages",
  "outweigh-posneg": "Outweigh (positives vs negatives)",
  "solution-cause-effect-direct": "Problem / cause / solution",
};

/* ------------------------------------------------------------------ */
/* ID validation (mirrors manifest.idRegexes)                          */
/* ------------------------------------------------------------------ */

export const ID_REGEX_SOURCE = {
  task1Item: "^t1-(line|bar|pie|table|map|process|mixed)-\\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$",
  task1Answer: "^t1-(line|bar|pie|table|map|process|mixed)-\\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*-b[678]$",
  task2Item:
    "^t2-(opinion|discussion|adv-disadv|outweigh-posneg|solution-cause-effect-direct)-[a-z0-9]+(?:-[a-z0-9]+)*-\\d{2}$",
  task2AnswerKey: "{promptId}-b{band}",
} as const;

export const ID_REGEXES = {
  task1Item: new RegExp(ID_REGEX_SOURCE.task1Item),
  task1Answer: new RegExp(ID_REGEX_SOURCE.task1Answer),
  task2Item: new RegExp(ID_REGEX_SOURCE.task2Item),
} as const;

export function task2AnswerId(promptId: string, band: number): string {
  return `${promptId}-b${band}`;
}

/* ------------------------------------------------------------------ */
/* Banned phrases                                                      */
/* ------------------------------------------------------------------ */

export const BANNED_PHRASES: readonly string[] = [
  "this essay will discuss both sides and give an opinion at the end",
  "i shall put forth my arguments to support my views in the following paragraphs",
  "with the development of science and modern technology",
  "nowadays / in the modern era / since the dawn of time",
  "this is a highly controversial issue",
  "the crux of the discussion is",
  "research indicates that / a recent study from the IMF showed that",
  "it can broaden a person's horizons",
  "there are good grounds to argue in favour of / it cannot be denied that",
  "in a nutshell",
  "the aforementioned arguments offer insights into vindications for the impression that",
  "idioms, quotes and proverbs (e.g., every coin has two sides)",
];

export interface BannedPhraseRule {
  /** 1-based index into the manifest's 12-entry list. */
  index: number;
  /** Canonical entry, exactly as it appears in the manifest. */
  phrase: string;
  /** Slash options expanded (entries 4, 7 and 9); otherwise the phrase itself. */
  alternatives: string[];
  /** Advisory rules never cap a band. Only entry 12 (idioms/quotes/proverbs). */
  advisory: boolean;
  /** Extra detection used for advisory rules (quoted proverbs). */
  patterns?: RegExp[];
}

/** Expands "a / b / c" entries into their alternatives; other entries pass through. */
export function expandBannedPhrase(phrase: string): string[] {
  return phrase
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
}

export const BANNED_PHRASE_RULES: readonly BannedPhraseRule[] = BANNED_PHRASES.map((phrase, i) => {
  const index = i + 1;
  return {
    index,
    phrase,
    // Entry 12 is a category label, not a literal phrase: detect its example proverb
    // (plus quoted spans of 12+ characters) and report it as advisory only.
    alternatives: index === 12 ? ["every coin has two sides"] : expandBannedPhrase(phrase),
    advisory: index === 12,
    patterns: index === 12 ? [/["“][^"”\n]{12,}["”]/g] : undefined,
  };
});
