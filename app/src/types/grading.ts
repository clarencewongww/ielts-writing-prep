/**
 * Grading / report contract for the deterministic and rubric-based checks.
 *
 * The grader (owned by a later step) consumes the bank item plus a `Submission`
 * and produces a `GradingReport`. These types mirror the dossier schema:
 * evidence spans point into the submitted text so the UI can quote the exact
 * sentence that triggered a check.
 */

import type { Submission } from "./session";

export type Criterion = "TA" | "TR" | "CC" | "LR" | "GRA";

/** `cap` limits a criterion band, `error` is an accuracy fault, `upgrade` is a range/development hint. */
export type Severity = "cap" | "error" | "upgrade";

export interface FeedbackItem {
  criterion: Criterion;
  band: number;
  /** Which rubric row fired, e.g. `t1.overview.coverage`. */
  checkId: string;
  severity: Severity;
  evidenceSpan: {
    startChar: number;
    endChar: number;
    text: string;
  };
  feedbackStarter: string;
  fixSuggestion?: string;
}

export interface CriterionBand {
  criterion: Criterion;
  band: number;
  summary?: string;
}

/**
 * A deterministic cap that limits a criterion band. Shared by both task graders
 * (`grading/caps.ts` `GradeCap`, `grading/task2.ts` `appliedCaps`) so caps survive
 * the trip through `toTaskGrade` / `buildGradingReport` and can be persisted.
 */
export interface CapRecord {
  /** Rubric/check that fired, e.g. `t2.structure.conclusion`. */
  checkId: string;
  criterion: Criterion;
  /** The criterion can never exceed this band while the cap applies. */
  cap: number;
  reason: string;
  evidence?: { startChar: number; endChar: number; text: string };
}

export interface DeterministicCheck {
  id: string;
  label: string;
  task: 1 | 2 | "any";
  passed: boolean;
  /** Human-readable observed value, e.g. `"204 words (ceiling 210)"`. */
  observed?: string;
  /** Criterion this check caps when it fails. */
  cap?: Criterion;
  severity?: Severity;
  detail?: string;
}

export interface TaskGrade {
  task: 1 | 2;
  itemId: string;
  words: number;
  criteria: CriterionBand[];
  /** TA/TR/CC/LR/GRA rounded to the nearest half band. */
  overallBand: number;
  checks: DeterministicCheck[];
  feedback: FeedbackItem[];
  /**
   * Caps that actually lowered a criterion. Carried through `toTaskGrade` so a
   * persisted `GradingReport` still shows the cap list (the T1 grader stores
   * caps on its raw `Task1GradeResult`; without this field they were lost).
   */
  appliedCaps?: CapRecord[];
}

export interface GradingReport {
  schemaVersion: 1;
  bankVersion: string;
  generatedAt: string;
  overallBand: number;
  task1: TaskGrade;
  task2: TaskGrade;
  notes?: string[];
}

/** Report plus the exact submission it was produced from (for persistence and re-rendering). */
export interface GradeRecord {
  report: GradingReport;
  submission: Submission;
}
