/**
 * Checkable rubric tables for Task 2 (dossier §9.2–§9.5).
 *
 * Each criterion has rows for bands 8, 7 and 6 that paraphrase the public IELTS
 * descriptors Liz cites. The grader evaluates every row against measured signals
 * (`tr.parts`, `cc.cohesion`, …) and takes the **highest band whose rows all
 * pass**, falling back to band 5. Deterministic caps from `scorer.ts` are applied
 * afterwards, so the rubric shows the qualitative picture and the caps show the
 * hard penalties.
 */

import type { Criterion } from "../types/grading";

/** Task 2 owns four criteria; `TA` belongs to Task 1. */
export type Task2Criterion = Exclude<Criterion, "TA">;

export type RubricBand = 6 | 7 | 8;

export interface RubricRowDef {
  key: string;
  criterion: Task2Criterion;
  band: RubricBand;
  /** Short row name, e.g. "All parts answered". */
  label: string;
  /** Descriptor sentence from the band table. */
  descriptor: string;
}

export interface RubricCheckRow extends RubricRowDef {
  passed: boolean;
}

export const RUBRIC: Record<Task2Criterion, RubricRowDef[]> = {
  TR: [
    {
      key: "tr.parts",
      criterion: "TR",
      band: 8,
      label: "All parts sufficiently addressed",
      descriptor: "All parts of the question are answered, and each main idea is explained further, not just mentioned.",
    },
    {
      key: "tr.position",
      criterion: "TR",
      band: 8,
      label: "Position clear and well developed",
      descriptor: "If an opinion is asked for, it is clear in the introduction and stays the same throughout; if not, the answer stays neutral and complete.",
    },
    {
      key: "tr.ideas",
      criterion: "TR",
      band: 8,
      label: "Ideas extended and supported",
      descriptor: "Every body paragraph backs its idea with a reason, a result or an example.",
    },
    {
      key: "tr.conclusion",
      criterion: "TR",
      band: 8,
      label: "Conclusion restates in fresh words",
      descriptor: "The essay ends with a short conclusion that restates the position in fresh words instead of copying the introduction.",
    },
    {
      key: "tr.parts7",
      criterion: "TR",
      band: 7,
      label: "All parts addressed",
      descriptor: "The answer covers every part of the task, even if some parts are developed more fully than others.",
    },
    {
      key: "tr.position7",
      criterion: "TR",
      band: 7,
      label: "Clear position throughout",
      descriptor: "The position is clear and does not change; you do not sit on the fence when an opinion is asked for.",
    },
    {
      key: "tr.ideas7",
      criterion: "TR",
      band: 7,
      label: "Main ideas extended",
      descriptor: "Each main idea is extended with at least one supporting reason or example.",
    },
    {
      key: "tr.conclusion7",
      criterion: "TR",
      band: 7,
      label: "Conclusion present",
      descriptor: "The essay ends with a conclusion that does not simply repeat the introduction word for word.",
    },
    {
      key: "tr.parts6",
      criterion: "TR",
      band: 6,
      label: "Task attempted",
      descriptor: "The response addresses the topic, though parts may be under-answered.",
    },
    {
      key: "tr.position6",
      criterion: "TR",
      band: 6,
      label: "Relevant position, conclusion present",
      descriptor: "A relevant position is visible and the essay ends with a conclusion, even if it is repetitive.",
    },
    {
      key: "tr.ideas6",
      criterion: "TR",
      band: 6,
      label: "Some development",
      descriptor: "At least one main idea is developed with a supporting point.",
    },
  ],
  CC: [
    {
      key: "cc.paragraphs",
      criterion: "CC",
      band: 8,
      label: "Paragraphing sufficient and appropriate",
      descriptor: "Four or five paragraphs — introduction, two or three bodies and a conclusion — each developing one central topic.",
    },
    {
      key: "cc.topics",
      criterion: "CC",
      band: 8,
      label: "Clear central topic in each paragraph",
      descriptor: "Every body paragraph opens with a topic sentence and stays on one idea.",
    },
    {
      key: "cc.cohesion",
      criterion: "CC",
      band: 8,
      label: "Cohesion managed well",
      descriptor: "Referencing words such as \"this\", \"these\" and \"such\" carry the argument, and linkers do not feel mechanical.",
    },
    {
      key: "cc.progression",
      criterion: "CC",
      band: 8,
      label: "Logically sequenced",
      descriptor: "Contrasts and results are signalled with a range of linking words, not just \"firstly\" and \"secondly\".",
    },
    {
      key: "cc.paragraphs7",
      criterion: "CC",
      band: 7,
      label: "Paragraphing adequate",
      descriptor: "Paragraphs follow the expected shape: a clear introduction, body paragraphs and a conclusion.",
    },
    {
      key: "cc.topics7",
      criterion: "CC",
      band: 7,
      label: "Topic signalled in each body",
      descriptor: "Each body paragraph announces its central topic in the opening sentence.",
    },
    {
      key: "cc.cohesion7",
      criterion: "CC",
      band: 7,
      label: "Cohesive devices used appropriately",
      descriptor: "Linking words are varied and mostly appropriate; some under- or over-use is acceptable.",
    },
    {
      key: "cc.paragraphs6",
      criterion: "CC",
      band: 6,
      label: "Basic paragraphing",
      descriptor: "At least three paragraphs; the order of ideas may feel mechanical, but the reader can follow it.",
    },
    {
      key: "cc.bodies6",
      criterion: "CC",
      band: 6,
      label: "At least two bodies",
      descriptor: "Two body paragraphs are present, so ideas can progress.",
    },
    {
      key: "cc.links6",
      criterion: "CC",
      band: 6,
      label: "Some cohesive devices",
      descriptor: "At least two different linking functions appear, such as contrast and result.",
    },
  ],
  LR: [
    {
      key: "lr.range",
      criterion: "LR",
      band: 8,
      label: "Wide range, minimal repetition",
      descriptor: "A wide vocabulary with little repetition — content words are rarely reused.",
    },
    {
      key: "lr.precision",
      criterion: "LR",
      band: 8,
      label: "Some uncommon items",
      descriptor: "Precise, less common word choices that stay accurate.",
    },
    {
      key: "lr.accuracy",
      criterion: "LR",
      band: 8,
      label: "Occasional slips only",
      descriptor: "No errors with uncountable nouns, spelling or formal register.",
    },
    {
      key: "lr.nonrestart",
      criterion: "LR",
      band: 8,
      label: "No intrusive repetition",
      descriptor: "No content word is over-used; the most frequent one appears about six times at most.",
    },
    {
      key: "lr.range7",
      criterion: "LR",
      band: 7,
      label: "Enough range for flexibility",
      descriptor: "Vocabulary is varied enough for the topic, with few repeats.",
    },
    {
      key: "lr.accuracy7",
      criterion: "LR",
      band: 7,
      label: "Few errors",
      descriptor: "At most one vocabulary error — spelling, uncountable nouns or register.",
    },
    {
      key: "lr.nonrestart7",
      criterion: "LR",
      band: 7,
      label: "Repetition controlled",
      descriptor: "No content word is used more than eight times.",
    },
    {
      key: "lr.range6",
      criterion: "LR",
      band: 6,
      label: "Adequate but repetitive",
      descriptor: "Vocabulary is adequate for the task, even if repetitive at times.",
    },
    {
      key: "lr.accuracy6",
      criterion: "LR",
      band: 6,
      label: "Noticeable errors",
      descriptor: "Vocabulary errors are noticeable but do not stop the reader understanding.",
    },
  ],
  GRA: [
    {
      key: "gra.complex",
      criterion: "GRA",
      band: 8,
      label: "Wide range of structures",
      descriptor: "At least 40% of sentences are complex — they join ideas with words like \"although\", \"while\" or \"which\".",
    },
    {
      key: "gra.variety",
      criterion: "GRA",
      band: 8,
      label: "Variety of complex structures",
      descriptor: "Three or more different joining words or complex structures are used.",
    },
    {
      key: "gra.errorfree",
      criterion: "GRA",
      band: 8,
      label: "Majority error-free",
      descriptor: "At least 80% of sentences are free from grammar, article, preposition and punctuation errors.",
    },
    {
      key: "gra.punctuation",
      criterion: "GRA",
      band: 8,
      label: "Punctuation fully controlled",
      descriptor: "No semicolons or colons, no contractions and no capitalisation slips.",
    },
    {
      key: "gra.complex7",
      criterion: "GRA",
      band: 7,
      label: "Variety of complex structures",
      descriptor: "At least 28% of sentences are complex.",
    },
    {
      key: "gra.errorfree7",
      criterion: "GRA",
      band: 7,
      label: "Frequent error-free sentences",
      descriptor: "At least 60% of sentences are error-free.",
    },
    {
      key: "gra.punctuation7",
      criterion: "GRA",
      band: 7,
      label: "Good control, few errors",
      descriptor: "At most one punctuation or capitalisation error.",
    },
    {
      key: "gra.complex6",
      criterion: "GRA",
      band: 6,
      label: "Mix of simple and complex",
      descriptor: "At least 15% of sentences are complex.",
    },
    {
      key: "gra.errorfree6",
      criterion: "GRA",
      band: 6,
      label: "Some error-free sentences",
      descriptor: "At least 40% of sentences are error-free.",
    },
  ],
};

/** Evaluates one criterion: highest band whose rows all pass, else band 5. */
export function bandFromRubric(criterion: Task2Criterion, pass: (key: string) => boolean): number {
  for (const band of [8, 7, 6] as const) {
    const rows = RUBRIC[criterion].filter((row) => row.band === band);
    if (rows.length > 0 && rows.every((row) => pass(row.key))) return band;
  }
  return 5;
}

/** All rows for a criterion with their pass/fail state (for the report UI). */
export function evaluateRubric(criterion: Task2Criterion, pass: (key: string) => boolean): RubricCheckRow[] {
  return RUBRIC[criterion].map((row) => ({ ...row, passed: pass(row.key) }));
}
