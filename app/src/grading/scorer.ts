/**
 * Score arithmetic for the writing grader (dossier §9.6).
 *
 * Rules implemented exactly as documented:
 *  - task score = mean of the four criteria, rounded to the nearest half band
 *    (6.25 → 6.5, 6.75 → 7.0);
 *  - overall writing score = (T1 + 2 × T2) / 3, rounded to the nearest half band;
 *  - deterministic caps are hard overrides applied *after* averaging: a criterion
 *    can never exceed its cap, whatever the rubric said.
 */

import type {
  CapRecord,
  Criterion,
  CriterionBand,
  DeterministicCheck,
  FeedbackItem,
  GradingReport,
  TaskGrade,
} from "../types/grading";

/**
 * The canonical cap shape now lives in `types/grading.ts` (so `TaskGrade` can
 * carry caps); re-exported here because every grading/report module imports
 * `CapRecord` from this module.
 */
export type { CapRecord } from "../types/grading";

/**
 * Structural shape shared by Task 1 (4a's `Task1GradeResult`: `scores` +
 * `caps: GradeCap[]`) and Task 2 (`Task2Grade`: `criteria` + `appliedCaps`).
 * The adapters below let the report and the persisted `GradingReport` treat
 * both tasks uniformly.
 */
export interface TaskGradeLike {
  task: 1 | 2;
  itemId: string;
  words: number;
  overallBand: number;
  checks: DeterministicCheck[];
  feedback: FeedbackItem[];
  criteria?: CriterionBand[];
  scores?: Partial<Record<Criterion, number>>;
  caps?: CapRecord[];
  appliedCaps?: CapRecord[];
}

const WRITING_CRITERIA: Criterion[] = ["TA", "TR", "CC", "LR", "GRA"];

/**
 * Converts either task-grade shape into the shared `TaskGrade` contract.
 *
 * The spread keeps the graders' richer fields (`scores`, `netWords`, `caps`,
 * `rubricRows`, `rawCriteria`, …) on the returned object. `GradingReport` is
 * persisted with the session, and `ReportScreen` reads `rubricRows` / `rawCriteria`
 * to draw Task 2's rubric cards — dropping them here would silently slim the
 * report down after a reload.
 */
export function toTaskGrade(input: TaskGradeLike): TaskGrade {
  const appliedCaps = input.appliedCaps ?? input.caps;
  const withCaps = appliedCaps && appliedCaps.length > 0 ? { appliedCaps } : {};
  if (Array.isArray(input.criteria) && input.criteria.length > 0) {
    return { ...input, ...withCaps, criteria: input.criteria };
  }
  const scores = input.scores ?? {};
  const criteria: CriterionBand[] = WRITING_CRITERIA.filter((criterion) => typeof scores[criterion] === "number").map(
    (criterion) => ({ criterion, band: scores[criterion] as number }),
  );
  return { ...input, ...withCaps, criteria };
}

/** Caps that actually limited a band, across both grade shapes. */
export function capsFromGrade(input: TaskGradeLike | null | undefined): CapRecord[] {
  if (!input) return [];
  return input.appliedCaps ?? input.caps ?? [];
}

/** Rounds to the nearest half band (IELTS rounds .25 up, .75 up). */
export function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Mean of the four criterion bands, rounded to the nearest half band. */
export function meanBand(bands: readonly number[]): number {
  if (bands.length === 0) return 0;
  const mean = bands.reduce((total, band) => total + band, 0) / bands.length;
  return roundHalf(mean);
}

/** Task score from a criterion list (uses `band`, i.e. post-cap values). */
export function scoreTask(criteria: readonly CriterionBand[]): number {
  return meanBand(criteria.map((entry) => entry.band));
}

/** Overall writing score: T2 carries twice the weight of T1 (§9.6). */
export function overallWritingBand(task1Band: number, task2Band: number): number {
  return roundHalf((task1Band + 2 * task2Band) / 3);
}

export interface CapResult {
  /** Capped value (never above the strictest cap). */
  band: number;
  /** Caps that actually lowered the band. */
  applied: CapRecord[];
}

/** Applies every cap for one criterion; returns the capped band and the applied caps. */
export function applyCaps(band: number, caps: readonly CapRecord[]): CapResult {
  let capped = band;
  const applied: CapRecord[] = [];
  for (const cap of caps) {
    if (capped > cap.cap) {
      capped = cap.cap;
      applied.push(cap);
    }
  }
  return { band: capped, applied };
}

export interface CappedCriteria {
  criteria: CriterionBand[];
  applied: CapRecord[];
}

/** Applies caps across all criteria, preserving criterion order. */
export function capCriteria(criteria: readonly CriterionBand[], caps: readonly CapRecord[]): CappedCriteria {
  const applied: CapRecord[] = [];
  const capped = criteria.map((entry) => {
    const result = applyCaps(entry.band, caps.filter((cap) => cap.criterion === entry.criterion));
    applied.push(...result.applied);
    return { ...entry, band: result.band };
  });
  return { criteria: capped, applied };
}

export interface GradingReportInput {
  bankVersion: string;
  task1: TaskGrade;
  task2: TaskGrade;
  generatedAt?: string;
  notes?: string[];
}

/** Assembles the two task grades into the persisted report shape. */
export function buildGradingReport(input: GradingReportInput): GradingReport {
  const overallBand = overallWritingBand(input.task1.overallBand, input.task2.overallBand);
  return {
    schemaVersion: 1,
    bankVersion: input.bankVersion,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    overallBand,
    task1: { ...input.task1, overallBand: scoreTask(input.task1.criteria) },
    task2: { ...input.task2, overallBand: scoreTask(input.task2.criteria) },
    notes: input.notes,
  };
}
