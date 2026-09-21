/**
 * Types for the read-only question bank (`bank/manifest.json`, `bank/task1.json`, `bank/task2.json`).
 *
 * The bank is validated at boot by `src/data/bankLoader.ts`; these types describe the
 * fields this app reads. Task renderers keep their own permissive prop types, so items
 * typed here assign into them cleanly.
 */

export type Task1Type = "line" | "bar" | "pie" | "table" | "map" | "process" | "mixed";

export type Task2Family =
  | "opinion"
  | "discussion"
  | "adv-disadv"
  | "outweigh-posneg"
  | "solution-cause-effect-direct";

export type Band = 6 | 7 | 8;

export type Trend = "up" | "down" | "stable" | "fluctuated" | "n/a";

export type TimeFrameKind = "range" | "single-year" | "multiple-years" | "before-after" | "no-date";

export interface WordTarget {
  min: number;
  recommended: [number, number];
  hardCeiling: number;
}

export interface TimeFrame {
  kind: TimeFrameKind;
  values: number[];
  tenseRule: string;
}

export interface AxisSpec {
  label: string;
  unit?: string;
  scale?: string;
  values?: Array<string | number>;
}

export interface Axes {
  x: AxisSpec;
  y: AxisSpec;
}

export interface SeriesData {
  name: string;
  values: number[];
  trend: Trend;
}

export interface KeyFeature {
  id: string;
  description: string;
}

export interface SliceData {
  year: number;
  label: string;
  percent: number;
}

export interface AreaData {
  name: string;
  zone: string;
}

export interface ChangeData {
  feature: string;
  from: string;
  to: string;
  year: number;
}

export interface StageData {
  order: number;
  name: string;
  input: string;
  output: string;
  equipment: string;
}

export type CellValue = number | string | null;

/* ------------------------------------------------------------------ */
/* Task 1                                                              */
/* ------------------------------------------------------------------ */

export interface Task1FeedbackStarter {
  criterion: string;
  evidenceSpan: string;
  text: string;
}

export interface Task1ReferenceAnswer {
  id: string;
  band: Band;
  text: string;
  wordCount: number;
  defectProfile: string[];
  feedbackStarter: Task1FeedbackStarter;
}

export interface Task1Item {
  specId: string;
  type: Task1Type;
  typeEnum: Task1Type[];
  mixedWith: Task1Type | null;
  topic: string;
  statement: string;
  timeFrame: TimeFrame;
  axes: Axes | null;
  categories: string[];
  /** line / bar / mixed sub-charts */
  series?: SeriesData[];
  keyFeatures: KeyFeature[];
  groupingStrategy: string;
  unitsNote: string;
  wordTarget: WordTarget;
  recommendedMinutes: number;
  modelPatternRef: string;
  chartImagePolicy: string;
  sourceConvention: string;
  referenceAnswers: Task1ReferenceAnswer[];
  /* pie */
  slices?: SliceData[];
  whole?: number;
  /* table */
  rows?: string[];
  columns?: string[];
  cells?: CellValue[][];
  rowTotals?: number[];
  changeColumn?: string | null;
  /* map */
  areas?: AreaData[];
  features?: string[];
  changes?: ChangeData[];
  beforeYear?: number;
  afterYear?: number;
  /* process */
  stages?: StageData[];
  isCycle?: boolean;
  /* mixed */
  subCharts?: Task1Item[];
}

/* ------------------------------------------------------------------ */
/* Task 2                                                              */
/* ------------------------------------------------------------------ */

export interface EvidenceSpan {
  startChar: number;
  endChar: number;
  text: string;
}

export interface Task2Feedback {
  criterion: string;
  band: number;
  checkId: string;
  severity: string;
  evidenceSpan: EvidenceSpan;
  feedbackStarter: string;
  fixSuggestion: string;
}

export interface Task2ReferenceAnswer {
  promptId: string;
  band: Band;
  text: string;
  wordCount: number;
  whyBand: string;
  feedback: Task2Feedback;
}

/**
 * Planning ideas attached to a Task 2 prompt. Families use one of two shapes:
 * discussion/opinion prompts carry `pro`/`con`; solution/cause-effect prompts
 * carry `causes`/`solutions`. All fields are optional so either shape validates.
 */
export interface SeedIdeas {
  pro?: string[];
  con?: string[];
  causes?: string[];
  solutions?: string[];
}

export interface Task2Item {
  promptId: string;
  topic: string;
  family: Task2Family;
  familyEnum: Task2Family[];
  variant: string;
  opinionRequired: boolean;
  statement: string;
  instruction: string;
  questionCount: number;
  thesisRule: string;
  structure: string[];
  seedIdeas: SeedIdeas;
  bannedPhrases: string[];
  wordTarget: WordTarget;
  recommendedMinutes: number;
  rubricRef: string;
  markingNotes: string;
  referenceAnswers: Task2ReferenceAnswer[];
}

/** Alias used by the task renderers (`src/tasks`) for a Task 2 prompt item. */
export type Task2Prompt = Task2Item;

/** Union over both tasks; consumers can narrow with `"promptId" in answer`. */
export type ReferenceAnswer = Task1ReferenceAnswer | Task2ReferenceAnswer;

/* ------------------------------------------------------------------ */
/* Bank files and manifest                                             */
/* ------------------------------------------------------------------ */

export interface BankFile<T> {
  schemaVersion: string;
  task: 1 | 2;
  items: T[];
}

export interface ManifestCounts {
  task1: number;
  task2: number;
  totalItems: number;
  referenceAnswers: number;
  task1Answers: number;
  task2Answers: number;
}

export interface ManifestWordWindows {
  min: number;
  max: number;
  window: [number, number];
  hardCeiling: number;
  allWithinWindow: boolean;
}

export interface BankManifest {
  version: string;
  generatedDate: string;
  counts: ManifestCounts;
  perType: Record<Task1Type, number>;
  perFamily: Record<Task2Family, number>;
  perVariant: Record<string, number>;
  perBand: Record<string, number>;
  topics: {
    task1: { count: number; unique: number; list: string[] };
    task2: { count: number; unique: number; list: string[] };
  };
  files: Record<string, string>;
  fileMeta?: Record<string, { bytes: number; lines: number; sha256: string }>;
  idRegexes: {
    task1Item: string;
    task1Answer: string;
    task2Item: string;
    task2AnswerKey: string;
  };
  wordTargets: {
    task1: ManifestWordWindows;
    task2: ManifestWordWindows;
  };
  timeTargets: {
    task1: { recommendedMinutes: number };
    task2: { recommendedMinutes: number };
    sessionTotalMinutes: number;
  };
  structures: { task1: string; task2: string };
  bannedPhrases: string[];
  chartImagePolicy: string;
  sourceConvention: string;
  validation: Record<string, unknown>;
}
