/**
 * Demo samples for the setup screen.
 *
 * Five pre-written submission pairs that exercise the graders end-to-end without
 * sitting the 60-minute clock: one clean band-8 pair and four defective ones
 * (no overview / no conclusion / memorised phrases / both defects together).
 *
 * Recipes are derived from bank reference answers rather than duplicating ~3,000
 * words of text:
 *   - `removeParagraph`: drops the first post-introduction paragraph matching the
 *     pattern (the overview for Task 1, the conclusion for Task 2);
 *   - `prependIntro`: adds memorised phrases to the introduction;
 *   - `conclusionOpener`: replaces `In conclusion,` with a weaker/banned opener.
 *
 * Every recipe below was verified against `gradeTask1` / `gradeTask2`; the
 * `expectation` string records the bands that should appear on the report. If a
 * bank update removes an item or band, `resolveSamples` skips the sample instead
 * of failing the screen.
 */

import type { Band, Task1Item, Task2Item } from "../types/bank";
import type { BankData } from "./bankLoader";
import { countWords } from "./wordCount";
import type { SampleTexts, SessionSelection } from "../types/session";

/** First `In conclusion` / `To sum up` / `In summary` / `Overall` paragraph. */
const OVERVIEW_OR_CONCLUSION = /^(overall|in conclusion|to conclude|to sum up|in summary)\b/i;
/** Strong conclusion opener used by the bank's task-2 answers. */
const CONCLUSION_OPENER = /^(in conclusion|to conclude|to sum up|in summary)\b/i;

const MEMORISED_INTRO = "This is a highly controversial issue. It can broaden a person's horizons.";

export interface SampleTask1Recipe {
  itemId: string;
  band: Band;
  /** Remove the first paragraph after the intro that matches this pattern. */
  removeParagraph?: RegExp;
  /** Prepend this memorised sentence to the introduction paragraph. */
  prependIntro?: string;
}

export interface SampleTask2Recipe extends SampleTask1Recipe {
  /** Replace the strong conclusion opener (`In conclusion,`) with this phrase. */
  conclusionOpener?: string;
}

export interface DemoSample {
  id: string;
  label: string;
  /** What the sample demonstrates, shown under the button. */
  summary: string;
  /** Verified expected outcome (recorded from the grading run for this recipe). */
  expectation: string;
  task1: SampleTask1Recipe;
  task2: SampleTask2Recipe;
}

export const DEMO_SAMPLES: readonly DemoSample[] = [
  {
    id: "b8-model-pair",
    label: "Band 8 model pair",
    summary: "Both bank band-8 answers, copied unchanged.",
    expectation: "Expect 8.0 / 8.0, overall 8.0 and no caps.",
    task1: { itemId: "t1-line-01-internet-access", band: 8 },
    task2: { itemId: "t2-opinion-education-01", band: 8 },
  },
  {
    id: "t1-no-overview",
    label: "Task 1 without an overview",
    summary: "Band-8 table report with the overview paragraph deleted.",
    expectation: "T1 TA/CC capped at 5 (task ~6.5); overall ~7.0.",
    task1: { itemId: "t1-table-04-urban-population", band: 8, removeParagraph: OVERVIEW_OR_CONCLUSION },
    task2: { itemId: "t2-opinion-education-01", band: 7 },
  },
  {
    id: "t2-no-conclusion",
    label: "Task 2 without a conclusion",
    summary: "Band-8 discussion essay with the conclusion paragraph deleted.",
    expectation: "T2 TR/CC capped at 5 (task ~6.5); overall ~7.0.",
    task1: { itemId: "t1-line-01-internet-access", band: 7 },
    task2: {
      itemId: "t2-solution-cause-effect-direct-crime-punishment-01",
      band: 8,
      removeParagraph: OVERVIEW_OR_CONCLUSION,
    },
  },
  {
    id: "banned-heavy",
    label: "Memorised-phrase heavy",
    summary: "Band-8 answers with banned phrases in the introduction and conclusion.",
    expectation: "T2 LR capped at 5; both tasks sit near 7.0.",
    task1: {
      itemId: "t1-line-01-internet-access",
      band: 8,
      prependIntro: MEMORISED_INTRO,
    },
    task2: {
      itemId: "t2-opinion-education-01",
      band: 8,
      prependIntro: MEMORISED_INTRO,
      conclusionOpener: "In a nutshell",
    },
  },
  {
    id: "double-defect",
    label: "No overview + no conclusion",
    summary: "Both structural defects at once, on slightly weaker model answers.",
    expectation: "T1 and T2 around 6.5, overall ~6.5, caps on both tasks.",
    task1: { itemId: "t1-table-04-urban-population", band: 7, removeParagraph: OVERVIEW_OR_CONCLUSION },
    task2: {
      itemId: "t2-opinion-education-01",
      band: 8,
      removeParagraph: OVERVIEW_OR_CONCLUSION,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Recipe application                                                  */
/* ------------------------------------------------------------------ */

function stripParagraph(text: string, pattern: RegExp): string {
  const paragraphs = text.split(/\n\s*\n/);
  const index = paragraphs.findIndex((paragraph, i) => i > 0 && pattern.test(paragraph.trim()));
  if (index === -1) return text;
  paragraphs.splice(index, 1);
  return paragraphs.join("\n\n");
}

function prependToIntro(text: string, sentence: string): string {
  const paragraphs = text.split(/\n\s*\n/);
  paragraphs[0] = `${sentence} ${paragraphs[0]}`;
  return paragraphs.join("\n\n");
}

function replaceConclusionOpener(text: string, opener: string): string {
  return text.replace(/(^|\n)(\s*)(in conclusion|to conclude|to sum up|in summary),?/i, `$1$2${opener},`);
}

function findAnswer(item: Task1Item | Task2Item, band: Band): string | null {
  const answer = (item.referenceAnswers ?? []).find((entry) => entry.band === band);
  return answer?.text ?? null;
}

function applyTask1Recipe(item: Task1Item, recipe: SampleTask1Recipe): string | null {
  let text = findAnswer(item, recipe.band);
  if (text === null) return null;
  if (recipe.removeParagraph) text = stripParagraph(text, recipe.removeParagraph);
  if (recipe.prependIntro) text = prependToIntro(text, recipe.prependIntro);
  return text;
}

function applyTask2Recipe(item: Task2Item, recipe: SampleTask2Recipe): string | null {
  let text = findAnswer(item, recipe.band);
  if (text === null) return null;
  if (recipe.removeParagraph) text = stripParagraph(text, recipe.removeParagraph);
  if (recipe.prependIntro) text = prependToIntro(text, recipe.prependIntro);
  if (recipe.conclusionOpener) text = replaceConclusionOpener(text, recipe.conclusionOpener);
  return text;
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

export interface ResolvedSample {
  definition: DemoSample;
  selection: SessionSelection;
  texts: SampleTexts;
  words: { task1: number; task2: number };
}

/**
 * Resolves one recipe against the loaded bank. Returns `null` (with a console
 * warning) when a referenced item, band or paragraph is no longer present, so a
 * future bank revision degrades to "fewer demo buttons" instead of a crash.
 */
export function resolveSample(bank: BankData, definition: DemoSample): ResolvedSample | null {
  const task1Item = bank.index.task1ById.get(definition.task1.itemId);
  const task2Item = bank.index.task2ById.get(definition.task2.itemId);
  if (!task1Item || !task2Item) {
    console.warn(`[samples] "${definition.id}" skipped: bank v${bank.manifest.version} is missing an item.`);
    return null;
  }
  const task1 = applyTask1Recipe(task1Item, definition.task1);
  const task2 = applyTask2Recipe(task2Item, definition.task2);
  if (task1 === null || task2 === null) {
    console.warn(`[samples] "${definition.id}" skipped: a referenced band answer is missing.`);
    return null;
  }
  if (task1 === task2 || task1.trim().length === 0 || task2.trim().length === 0) {
    console.warn(`[samples] "${definition.id}" skipped: the recipe produced an empty submission.`);
    return null;
  }
  return {
    definition,
    selection: { task1Id: task1Item.specId, task2Id: task2Item.promptId, task2Order: "t2-first" },
    texts: { task1, task2 },
    words: { task1: countWords(task1), task2: countWords(task2) },
  };
}

/** Resolves every demo sample the current bank can satisfy, in display order. */
export function resolveSamples(bank: BankData): ResolvedSample[] {
  return DEMO_SAMPLES.map((definition) => resolveSample(bank, definition)).filter(
    (sample): sample is ResolvedSample => sample !== null,
  );
}
