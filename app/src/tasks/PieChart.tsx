/**
 * PieChart — one pie per year, from `slices` + `whole`.
 *
 * Layout rule: slices are grouped into years, years ascend, and each year is drawn as a
 * complete whole. The per-year total is printed next to the year label and flagged when
 * the bank data does not sum to `whole`, so a mis-summed pie is visible rather than silent.
 * `unitsNote` is rendered once, above the set of pies.
 */

import type { ChartConfiguration } from 'chart.js';
import { useMemo } from 'react';
import { CHART_COLORS, useChart } from './chartCore';
import { FallbackTable } from './FallbackTable';
import { FigureFrame } from './FigureFrame';
import { cx, groupSlicesByYear, isFiniteNumber } from './format';
import type { SliceData, Task1Item } from './types';
import type { ChartViewProps } from './LineChart';
import { Badge } from './ui';

interface YearGroup {
  year: number | string | null;
  slices: SliceData[];
  total: number;
  reported: number;
}

function totalSuffix(item: Task1Item): string {
  if (item.whole === 100) return '%';
  if (isFiniteNumber(item.whole)) return ` of ${item.whole}`;
  return '';
}

function PieForYear({
  item,
  group,
  title,
  showUnitsNote,
}: {
  item: Task1Item;
  group: YearGroup;
  title?: string;
  showUnitsNote: boolean;
}) {
  const labels = group.slices.map((slice) => slice.label ?? '—');
  const values = group.slices.map((slice) => (isFiniteNumber(slice.percent) ? slice.percent : 0));
  const suffix = totalSuffix(item);
  const slicesComplete = !isFiniteNumber(item.whole) || Math.abs(group.total - item.whole) < 0.01;

  const config = useMemo<ChartConfiguration<'pie'> | null>(() => {
    if (labels.length === 0) return null;
    return {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            label: item.topic ?? item.specId,
            data: values,
            backgroundColor: labels.map((_, index) => CHART_COLORS[index % CHART_COLORS.length]),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = typeof context.parsed === 'number' ? context.parsed : 0;
                return `${context.label}: ${value}${suffix}`;
              },
            },
          },
        },
      },
    };
  }, [item.specId, item.topic, labels.join('|'), values.join(','), suffix]);

  const { canvasRef, error } = useChart(config, [config]);

  if (!config || error) {
    return <FallbackTable item={item} reason={error ?? 'pie chart has no slices'} />;
  }

  return (
    <div data-spec-id={item.specId}>
      <FigureFrame
        item={showUnitsNote ? item : { ...item, unitsNote: undefined }}
        title={
          <span className="flex items-center gap-2">
            {title}
            <Badge tone={slicesComplete ? 'slate' : 'rose'} title="Sum of the slices for this year">
              total {group.total}
              {suffix}
            </Badge>
          </span>
        }
        heightClass="h-52 min-h-[180px]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Pie chart: ${title ?? item.topic ?? item.specId}`}
        />
      </FigureFrame>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {group.slices.map((slice, index) => (
          <li key={`${slice.label ?? index}-${index}`} className="flex items-baseline gap-2 text-xs text-slate-600">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate">{slice.label ?? '—'}</span>
            <span className="font-medium tabular-nums text-slate-800">
              {isFiniteNumber(slice.percent) ? `${slice.percent}${suffix}` : '—'}
            </span>
          </li>
        ))}
      </ul>
      {!slicesComplete ? (
        <p className={cx('mt-1 text-[11px] text-rose-600')}>
          Slice total is {group.total}
          {suffix} but the bank reports a whole of {item.whole}. Check the task data.
        </p>
      ) : null}
    </div>
  );
}

export function PieChart({ item, title, className }: ChartViewProps) {
  const slices = (item.slices ?? []).filter((slice): slice is SliceData => Boolean(slice));
  const groups = useMemo(() => groupSlicesByYear(slices), [JSON.stringify(slices)]);

  if (groups.length === 0) {
    return <FallbackTable item={item} reason="pie chart has no slice data" className={className} />;
  }

  const multiple = groups.length > 1;

  return (
    <div
      className={cx(multiple ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'w-full', className)}
      data-spec-id={item.specId}
      data-pies={groups.length}
    >
      {groups.map((group, index) => {
        const label = multiple
          ? String(group.year ?? '')
          : title ?? (group.year === null ? '' : String(group.year));
        return (
          <PieForYear
            key={`${group.year ?? 'na'}-${index}`}
            item={item}
            group={group}
            title={label || undefined}
            showUnitsNote={index === 0}
          />
        );
      })}
    </div>
  );
}

export default PieChart;
