/**
 * Task renderers — public surface.
 *
 * Step 3 deliverable: chart/table/map/process/mixed renderers plus the Task 1 chart
 * dispatcher, the Task 2 prompt viewer and the bank task picker.
 */

export { ChartRenderer, default as ChartRendererDefault } from './ChartRenderer';
export type { ChartRendererProps } from './ChartRenderer';

export { LineChart } from './LineChart';
export type { ChartViewProps } from './LineChart';

export { BarChart } from './BarChart';
export { PieChart } from './PieChart';
export { TableView } from './TableView';
export type { TableViewProps } from './TableView';
export { MapView } from './MapView';
export type { MapViewProps } from './MapView';
export { ProcessView } from './ProcessView';
export type { ProcessViewProps } from './ProcessView';
export { MixedView, ChildTaskView } from './MixedView';
export type { ChildTaskViewProps, MixedViewProps } from './MixedView';

export { ChartAttribution, ATTRIBUTION_TEXT } from './ChartAttribution';
export type { ChartAttributionProps } from './ChartAttribution';

export { FallbackTable } from './FallbackTable';
export type { FallbackTableProps } from './FallbackTable';

export { FigureFrame } from './FigureFrame';
export type { FigureFrameProps } from './FigureFrame';

export { PromptViewer } from './PromptViewer';
export type { PromptViewerProps } from './PromptViewer';

export { TaskPicker } from './TaskPicker';
export type { TaskPickerProps, TaskPickerTab } from './TaskPicker';

export { CHART_COLORS } from './chartCore';
export {
  axisOrder,
  allNumeric,
  cx,
  distinct,
  formatCell,
  formatValue,
  formatWordTarget,
  groupSlicesByYear,
  humanizeToken,
  normalizeLabel,
  percentChange,
  pluralize,
} from './format';
export { TASK1_TYPES, TASK2_FAMILIES } from './types';
export type {
  AreaData,
  Axes,
  AxisSpec,
  CellValue,
  ChangeData,
  KeyFeature,
  ReferenceAnswer,
  SeedIdeas,
  SeriesData,
  SliceData,
  StageData,
  Task1Item,
  Task1Type,
  Task2Family,
  Task2Prompt,
  TimeFrame,
  WordTarget,
} from './types';
