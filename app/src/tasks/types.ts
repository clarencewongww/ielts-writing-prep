/**
 * Local bank types for the task renderers.
 *
 * These mirror the shapes in `bank/task1.json` and `bank/task2.json` (schema v1.0).
 * When the shared scaffold lands (`src/types/bank.ts` from Step 2), these declarations
 * remain structurally compatible: every field below is optional unless a renderer
 * genuinely requires it, so bank items typed elsewhere assign cleanly into these props.
 * Consumers can also re-export from `src/types/bank.ts` if they prefer a single source.
 */

export type Task1Type = 'line' | 'bar' | 'pie' | 'table' | 'map' | 'process' | 'mixed';

export type Task2Family =
  | 'opinion'
  | 'discussion'
  | 'adv-disadv'
  | 'outweigh-posneg'
  | 'solution-cause-effect-direct';

export const TASK1_TYPES: readonly Task1Type[] = [
  'line',
  'bar',
  'pie',
  'table',
  'map',
  'process',
  'mixed',
];

export const TASK2_FAMILIES: readonly Task2Family[] = [
  'opinion',
  'discussion',
  'adv-disadv',
  'outweigh-posneg',
  'solution-cause-effect-direct',
];

export interface TimeFrame {
  kind?: string;
  values?: Array<number | string>;
  tenseRule?: string;
}

export interface AxisSpec {
  label?: string;
  unit?: string;
  scale?: string;
  values?: Array<string | number>;
}

export interface Axes {
  x?: AxisSpec;
  y?: AxisSpec;
}

export interface SeriesData {
  name: string;
  values?: Array<number | string | null | undefined> | null;
  trend?: string;
}

export interface KeyFeature {
  id?: string;
  description?: string;
}

export interface SliceData {
  year?: number | string;
  label?: string;
  percent?: number;
}

export interface AreaData {
  name?: string;
  zone?: string;
}

export interface ChangeData {
  feature?: string;
  from?: string;
  to?: string;
  year?: number | string;
}

export interface StageData {
  order?: number;
  name?: string;
  input?: string;
  output?: string;
  equipment?: string;
}

export type CellValue = number | string | null | undefined;

export interface WordTarget {
  min?: number;
  recommended?: number[];
  hardCeiling?: number;
}

export interface ReferenceAnswer {
  id?: string;
  band?: number;
  text?: string;
  wordCount?: number;
  defectProfile?: unknown;
  feedbackStarter?: unknown;
  whyBand?: unknown;
  feedback?: unknown;
}

/** A Task 1 item. `type` is intentionally `string` so unknown future types degrade to the fallback table. */
export interface Task1Item {
  specId: string;
  type?: string;
  typeEnum?: string[];
  mixedWith?: string | null;
  topic?: string;
  /** Present on mixed sub-charts; the sub-figure caption. */
  title?: string;
  statement?: string;
  timeFrame?: TimeFrame | null;
  axes?: Axes | null;
  categories?: string[] | null;

  /* line / bar */
  series?: SeriesData[] | null;

  /* pie */
  slices?: SliceData[] | null;
  whole?: number | null;

  /* table */
  rows?: string[] | null;
  columns?: string[] | null;
  cells?: CellValue[][] | null;
  rowTotals?: number[] | null;
  changeColumn?: string | null;

  /* map */
  areas?: AreaData[] | null;
  features?: string[] | null;
  changes?: ChangeData[] | null;
  beforeYear?: number | string | null;
  afterYear?: number | string | null;

  /* process */
  stages?: StageData[] | null;
  isCycle?: boolean | null;

  /* mixed */
  subCharts?: Task1Item[] | null;

  /* shared annotations */
  keyFeatures?: KeyFeature[] | null;
  groupingStrategy?: string | null;
  unitsNote?: string | null;
  wordTarget?: WordTarget | null;
  recommendedMinutes?: number | null;
  modelPatternRef?: string | null;
  chartImagePolicy?: string | null;
  sourceConvention?: string | null;
  referenceAnswers?: ReferenceAnswer[] | null;
}

/**
 * Planning ideas for a Task 2 prompt. Discussion/opinion families use `pro`/`con`;
 * solution/cause-effect families use `causes`/`solutions`.
 */
export interface SeedIdeas {
  pro?: string[] | null;
  con?: string[] | null;
  causes?: string[] | null;
  solutions?: string[] | null;
}

/** A Task 2 prompt. */
export interface Task2Prompt {
  promptId: string;
  topic?: string;
  family?: string;
  familyEnum?: string[];
  variant?: string;
  opinionRequired?: boolean;
  statement?: string;
  instruction?: string;
  questionCount?: number;
  thesisRule?: string;
  structure?: string[] | null;
  seedIdeas?: SeedIdeas | null;
  bannedPhrases?: string[] | null;
  wordTarget?: WordTarget | null;
  recommendedMinutes?: number | null;
  rubricRef?: string | null;
  markingNotes?: string | null;
  referenceAnswers?: ReferenceAnswer[] | null;
}
