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
      descriptor: "Every question part is answered and each main idea is extended, not merely stated.",
    },
    {
      key: "tr.position",
      criterion: "TR",
      band: 8,
      label: "Position clear and well developed",
      descriptor: "When an opinion is required it is explicit in the introduction and held throughout; otherwise the answer stays neutral and complete.",
    },
    {
      key: "tr.ideas",
      criterion: "TR",
      band: 8,
      label: "Ideas extended and supported",
      descriptor: "Every body develops its idea with support (reason, consequence or illustration).",
    },
    {
      key: "tr.conclusion",
      criterion: "TR",
      band: 8,
      label: "Conclusion restates in fresh words",
      descriptor: "A conclusion is present, signposted and adds a restatement rather than copying the introduction.",
    },
    {
      key: "tr.parts7",
      criterion: "TR",
      band: 7,
      label: "All parts addressed",
      descriptor: "The answer addresses all parts of the task, some more fully than others.",
    },
    {
      key: "tr.position7",
      criterion: "TR",
      band: 7,
      label: "Clear position throughout",
      descriptor: "The position is clear and consistent; no fence-sitting when an opinion is asked for.",
    },
    {
      key: "tr.ideas7",
      criterion: "TR",
      band: 7,
      label: "Main ideas extended",
      descriptor: "Main ideas are extended with at least one supporting reason or example.",
    },
    {
      key: "tr.conclusion7",
      criterion: "TR",
      band: 7,
      label: "Conclusion present",
      descriptor: "A conclusion is present and does not simply repeat the introduction word for word.",
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
      descriptor: "Four or five paragraphs with two or three body paragraphs, each with one central topic.",
    },
    {
      key: "cc.topics",
      criterion: "CC",
      band: 8,
      label: "Clear central topic in each paragraph",
      descriptor: "Every body opens with a topic sentence and stays on one idea.",
    },
    {
      key: "cc.cohesion",
      criterion: "CC",
      band: 8,
      label: "Cohesion managed well",
      descriptor: "Referencing (this/it/these/such) carries the argument and linkers are not mechanical.",
    },
    {
      key: "cc.progression",
      criterion: "CC",
      band: 8,
      label: "Logically sequenced",
      descriptor: "Contrast and result relations are signalled with a range of devices, not just firstly/secondly.",
    },
    {
      key: "cc.paragraphs7",
      criterion: "CC",
      band: 7,
      label: "Paragraphing adequate",
      descriptor: "Paragraphs follow the required skeleton with a clear introduction, bodies and conclusion.",
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
      descriptor: "Linkers are varied and mostly appropriate (some over/under-use is acceptable).",
    },
    {
      key: "cc.paragraphs6",
      criterion: "CC",
      band: 6,
      label: "Basic paragraphing",
      descriptor: "At least three paragraphs; progression may be mechanical but is followable.",
    },
    {
      key: "cc.bodies6",
      criterion: "CC",
      band: 6,
      label: "At least two bodies",
      descriptor: "Two body paragraphs are present so ideas can progress.",
    },
    {
      key: "cc.links6",
      criterion: "CC",
      band: 6,
      label: "Some cohesive devices",
      descriptor: "At least two different linking functions appear.",
    },
  ],
  LR: [
    {
      key: "lr.range",
      criterion: "LR",
      band: 8,
      label: "Wide range, minimal repetition",
      descriptor: "A wide vocabulary with little repetition (type–token ratio ≈ 0.75+ on content words).",
    },
    {
      key: "lr.precision",
      criterion: "LR",
      band: 8,
      label: "Some uncommon items",
      descriptor: "Precise, less common word choices (average content word length ≈ 5.1+ letters) without inaccuracy.",
    },
    {
      key: "lr.accuracy",
      criterion: "LR",
      band: 8,
      label: "Occasional slips only",
      descriptor: "No uncountable, spelling or informal-register errors.",
    },
    {
      key: "lr.nonrestart",
      criterion: "LR",
      band: 8,
      label: "No intrusive repetition",
      descriptor: "No content word is over-used (top item ≤ 6 uses).",
    },
    {
      key: "lr.range7",
      criterion: "LR",
      band: 7,
      label: "Enough range for flexibility",
      descriptor: "Vocabulary is varied enough for the topic (type–token ratio ≈ 0.70+).",
    },
    {
      key: "lr.accuracy7",
      criterion: "LR",
      band: 7,
      label: "Few errors",
      descriptor: "At most one lexical error (spelling / uncountable / register).",
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
      descriptor: "Errors are noticeable but do not prevent understanding.",
    },
  ],
  GRA: [
    {
      key: "gra.complex",
      criterion: "GRA",
      band: 8,
      label: "Wide range of structures",
      descriptor: "At least 40% of sentences are complex (subordinate or participle clauses).",
    },
    {
      key: "gra.variety",
      criterion: "GRA",
      band: 8,
      label: "Variety of complex structures",
      descriptor: "Three or more different subordinators/structures are used.",
    },
    {
      key: "gra.errorfree",
      criterion: "GRA",
      band: 8,
      label: "Majority error-free",
      descriptor: "At least 80% of sentences are free from agreement/preposition/article/punctuation errors.",
    },
    {
      key: "gra.punctuation",
      criterion: "GRA",
      band: 8,
      label: "Punctuation fully controlled",
      descriptor: "No semicolons/colons, contractions or capitalisation slips.",
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
      descriptor: "At most one punctuation/capitalisation error.",
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
