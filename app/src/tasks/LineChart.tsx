/**
 * LineChart — renders `axes.x` + `series` data with Chart.js.
 * X values are drawn in ascending order when they are numeric (years), otherwise in
 * bank order. Points with missing values are left as gaps rather than invented.
 */

import type { ChartConfiguration, ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { CHART_COLORS, CHART_GRID, useChart, valueTooltip } from './chartCore';
import { FallbackTable } from './FallbackTable';
import { FigureFrame } from './FigureFrame';
import { axisOrder } from './format';
import type { Task1Item } from './types';

export interface ChartViewProps {
  item: Task1Item;
  title?: string;
  className?: string;
}

export function LineChart({ item, title, className }: ChartViewProps) {
  const xValues = item.axes?.x?.values ?? [];
  const xOrder = useMemo(() => axisOrder(xValues), [xValues]);
  const labels = xOrder.map((index) => String(xValues[index] ?? ''));
  const series = (item.series ?? []).filter((entry) => entry && entry.name);

  const config = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (labels.length === 0 || series.length === 0) return null;
    const unit = item.axes?.y?.unit ?? '';
    const xLabel = item.axes?.x?.label ?? '';
    const yLabel = [item.axes?.y?.label, unit ? `(${unit})` : ''].filter(Boolean).join(' ');
    return {
      type: 'line',
      data: {
        labels,
        datasets: series.map((entry, index) => ({
          label: entry.name,
          data: xOrder.map((sourceIndex) => {
            const value = entry.values?.[sourceIndex];
            return typeof value === 'number' && Number.isFinite(value) ? value : null;
          }),
          borderColor: CHART_COLORS[index % CHART_COLORS.length],
          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
          pointBackgroundColor: CHART_COLORS[index % CHART_COLORS.length],
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.25,
          spanGaps: true,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } },
          tooltip: { callbacks: { label: valueTooltip(unit) } },
        },
        scales: {
          x: {
            title: { display: Boolean(xLabel), text: xLabel },
            grid: { color: CHART_GRID },
          },
          y: {
            beginAtZero: false,
            title: { display: Boolean(yLabel), text: yLabel },
            grid: { color: CHART_GRID },
          },
        },
      } satisfies ChartOptions<'line'>,
    };
  }, [item, labels.join('|'), series.map((entry) => `${entry.name}:${(entry.values ?? []).join(',')}`).join(';')]);

  const { canvasRef, error } = useChart(config, [config]);

  if (!config || error) {
    return (
      <FallbackTable
        item={item}
        reason={error ? `chart.js could not draw the line chart (${error})` : 'line chart is missing axis or series data'}
        className={className}
      />
    );
  }

  return (
    <FigureFrame item={item} title={title} className={className}>
      <canvas ref={canvasRef} role="img" aria-label={`Line chart: ${item.statement ?? item.specId}`} />
    </FigureFrame>
  );
}

export default LineChart;
