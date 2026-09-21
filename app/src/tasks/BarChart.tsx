/**
 * BarChart — renders `axes.x` + `series` data with Chart.js.
 * Numeric x values (years) are drawn ascending; categorical x values keep bank order.
 * Multiple series render as grouped bars; a single series renders as one series.
 */

import type { ChartConfiguration } from 'chart.js';
import { useMemo } from 'react';
import { CHART_COLORS, CHART_GRID, useChart, valueTooltip } from './chartCore';
import { FallbackTable } from './FallbackTable';
import { FigureFrame } from './FigureFrame';
import { axisOrder } from './format';

import type { ChartViewProps } from './LineChart';

export function BarChart({ item, title, className }: ChartViewProps) {
  const xValues = item.axes?.x?.values ?? [];
  const xOrder = useMemo(() => axisOrder(xValues), [xValues]);
  const labels = xOrder.map((index) => String(xValues[index] ?? ''));
  const series = (item.series ?? []).filter((entry) => entry && entry.name);

  const config = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (labels.length === 0 || series.length === 0) return null;
    const unit = item.axes?.y?.unit ?? '';
    const xLabel = item.axes?.x?.label ?? '';
    const yLabel = [item.axes?.y?.label, unit ? `(${unit})` : ''].filter(Boolean).join(' ');
    return {
      type: 'bar',
      data: {
        labels,
        datasets: series.map((entry, index) => ({
          label: entry.name,
          data: xOrder.map((sourceIndex) => {
            const value = entry.values?.[sourceIndex];
            return typeof value === 'number' && Number.isFinite(value) ? value : null;
          }),
          backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
          borderRadius: 3,
          maxBarThickness: 48,
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
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            title: { display: Boolean(yLabel), text: yLabel },
            grid: { color: CHART_GRID },
          },
        },
      },
    };
  }, [item, labels.join('|'), series.map((entry) => `${entry.name}:${(entry.values ?? []).join(',')}`).join(';')]);

  const { canvasRef, error } = useChart(config, [config]);

  if (!config || error) {
    return (
      <FallbackTable
        item={item}
        reason={error ? `chart.js could not draw the bar chart (${error})` : 'bar chart is missing axis or series data'}
        className={className}
      />
    );
  }

  return (
    <FigureFrame item={item} title={title} className={className}>
      <canvas ref={canvasRef} role="img" aria-label={`Bar chart: ${item.statement ?? item.specId}`} />
    </FigureFrame>
  );
}

export default BarChart;
