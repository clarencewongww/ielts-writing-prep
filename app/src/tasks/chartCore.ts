/**
 * Chart.js bootstrap shared by LineChart, BarChart and PieChart.
 *
 * The scaffold installs `chart.js`; this module registers only the controllers,
 * scales and plugins the renderers use, and provides a small `useChart` hook so the
 * components stay dependency-light (no react-chartjs-2 requirement).
 */

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { useEffect, useRef, useState, type DependencyList } from 'react';

/** Series colour cycle, applied by index so any number of series renders. */
export const CHART_COLORS = [
  '#0f766e',
  '#b45309',
  '#1d4ed8',
  '#be123c',
  '#4d7c0f',
  '#7e22ce',
  '#0369a1',
  '#a16207',
  '#155e75',
  '#9f1239',
] as const;

export const CHART_GRID = 'rgba(15, 23, 42, 0.08)';
export const CHART_TICK = '#475569';

let registered = false;

export function ensureChartsRegistered(): void {
  if (registered) return;
  Chart.register(
    LineController,
    BarController,
    PieController,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Filler,
    Tooltip,
    Legend,
  );
  Chart.defaults.font.family =
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  Chart.defaults.color = CHART_TICK;
  registered = true;
}

export interface UseChartResult {
  // React 18 types: `RefObject<T | null>` is not assignable to `ref`; `RefObject<T>` is
  // structurally identical here because `current` is already nullable.
  canvasRef: React.RefObject<HTMLCanvasElement>;
  error: string | null;
}

/**
 * Creates (and destroys) a Chart.js instance for the referenced canvas.
 * `deps` follow the usual hook contract; include everything the config closure reads.
 */
export function useChart(
  config: ChartConfiguration | null,
  deps: DependencyList,
): UseChartResult {
  ensureChartsRegistered();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config) return;

    let chart: Chart | null = null;
    try {
      chart = new Chart(canvas, config);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }

    return () => {
      try {
        chart?.destroy();
      } catch {
        /* chart already torn down */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { canvasRef, error };
}

/** Builds the shared tooltip label callback: "Forecast: 12 million". */
export function valueTooltip(unit?: string | null) {
  return (context: {
    dataset?: { label?: string } | null;
    parsed?: unknown;
    label?: string;
  }): string => {
    const parsed = (context.parsed ?? {}) as { y?: unknown; x?: unknown; r?: unknown };
    const raw = [parsed.y, parsed.x, parsed.r].find((value) => typeof value === 'number');
    const value =
      typeof raw === 'number' ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(raw) : '—';
    const name = context.dataset?.label ?? context.label ?? '';
    return unit ? `${name}: ${value} ${unit}` : `${name}: ${value}`;
  };
}
