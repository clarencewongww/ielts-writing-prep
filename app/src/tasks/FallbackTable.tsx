/**
 * FallbackTable — the safety net for the whole task renderer.
 *
 * Used when an item is missing the data a specialised view needs, when an unknown
 * `type` arrives, or when a child component throws (via ChartRenderer's error
 * boundary). It renders whatever the item does contain as plain HTML tables, so all
 * 28 Task 1 specs can still be shown even if a chart view cannot be.
 */

import { Fragment } from 'react';
import { ChartAttribution } from './ChartAttribution';
import { axisOrder, cx, formatCell, groupSlicesByYear, humanizeToken, scalarRows } from './format';
import type { Task1Item } from './types';
import { EmptyNote, SectionHeading } from './ui';

export interface FallbackTableProps {
  item: Task1Item;
  /** Why the specialised view was skipped; shown as a muted note. */
  reason?: string | null;
  className?: string;
  /** Recursion guard for mixed subCharts. */
  depth?: number;
}

const MAX_DEPTH = 2;

function SimpleTable({
  head,
  rows,
  className,
}: {
  head: string[];
  rows: Array<Array<string | number>>;
  className?: string;
}) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            {head.map((cell, index) => (
              <th key={index} scope="col" className="whitespace-nowrap border border-slate-200 px-2 py-1 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-slate-200 px-2 py-1 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FallbackTable({ item, reason, className, depth = 0 }: FallbackTableProps) {
  const series = (item.series ?? []).filter((entry) => entry && entry.name);
  const xValues = item.axes?.x?.values ?? [];
  const xOrder = axisOrder(xValues);
  const slices = item.slices ?? [];
  const sliceGroups = slices.length > 0 ? groupSlicesByYear(slices) : [];
  const columns = item.columns ?? [];
  const rows = item.rows ?? [];
  const cells = item.cells ?? [];
  const stages = (item.stages ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const changes = item.changes ?? [];
  const scalars = scalarRows(item);

  const hasSeries = series.length > 0;
  const seriesColumns = hasSeries
    ? xOrder.map((index) => (xValues.length > index ? xValues[index] : `#${index + 1}`))
    : [];

  return (
    <section
      className={cx('paper rounded-control p-3.5 ring-1 ring-inset ring-line/60', className)}
      data-spec-id={item.specId}
      data-fallback="true"
    >
      {item.statement ? <p className="mb-2 text-sm text-slate-700">{item.statement}</p> : null}
      {reason ? (
        <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Fallback table shown: {reason}
        </p>
      ) : null}

      {scalars.length > 0 ? (
        <dl className="mb-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {scalars.map((row) => (
            <div key={row.label} className="flex gap-2">
              <dt className="min-w-24 shrink-0 font-medium text-slate-500">{row.label}</dt>
              <dd className="text-slate-700">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasSeries ? (
        <div className="mb-3">
          <SectionHeading>Data series</SectionHeading>
          <SimpleTable
            head={['Series', ...seriesColumns.map(String)]}
            rows={series.map((entry) => [
              entry.name,
              ...xOrder.map((index) => formatCell(entry.values?.[index])),
            ])}
          />
        </div>
      ) : null}

      {sliceGroups.length > 0 ? (
        <div className="mb-3">
          <SectionHeading
            hint={
              sliceGroups.length > 1
                ? `totals: ${sliceGroups.map((group) => `${group.year ?? 'n/a'} ${group.total}`).join(' · ')}`
                : undefined
            }
          >
            Proportions
          </SectionHeading>
          <SimpleTable
            head={['Year', 'Slice', 'Percent']}
            rows={sliceGroups.flatMap((group) =>
              group.slices.map((slice) => [
                group.year === null ? '—' : String(group.year),
                slice.label ?? '—',
                formatCell(slice.percent),
              ]),
            )}
          />
        </div>
      ) : null}

      {columns.length > 0 && rows.length > 0 ? (
        <div className="mb-3">
          <SectionHeading>Table</SectionHeading>
          <SimpleTable
            head={['', ...columns.map(String)]}
            rows={rows.map((rowName, rowIndex) => [
              rowName,
              ...columns.map((_, columnIndex) => formatCell(cells[rowIndex]?.[columnIndex])),
            ])}
          />
        </div>
      ) : null}

      {stages.length > 0 ? (
        <div className="mb-3">
          <SectionHeading hint={item.isCycle ? 'cycle process' : 'linear process'}>Stages</SectionHeading>
          <SimpleTable
            head={['#', 'Stage', 'Input', 'Output', 'Equipment']}
            rows={stages.map((stage, index) => [
              String(stage.order ?? index + 1),
              stage.name ?? '—',
              stage.input ?? '—',
              stage.output ?? '—',
              stage.equipment ?? '—',
            ])}
          />
        </div>
      ) : null}

      {changes.length > 0 ? (
        <div className="mb-3">
          <SectionHeading
            hint={[item.beforeYear, item.afterYear].filter((year) => year !== null && year !== undefined).join(' → ')}
          >
            Changes
          </SectionHeading>
          <SimpleTable
            head={['Feature', 'Before', 'After', 'Year']}
            rows={changes.map((change) => [
              change.feature ?? '—',
              change.from ?? '—',
              change.to ?? '—',
              change.year === null || change.year === undefined ? '—' : String(change.year),
            ])}
          />
        </div>
      ) : null}

      {Array.isArray(item.features) && item.features.length > 0 ? (
        <div className="mb-3">
          <SectionHeading>Features</SectionHeading>
          <p className="text-xs text-slate-600">{item.features.join(' · ')}</p>
        </div>
      ) : null}

      {depth < MAX_DEPTH && Array.isArray(item.subCharts) && item.subCharts.length > 0 ? (
        <div className="space-y-3">
          {item.subCharts.map((child, index) => (
            <Fragment key={child?.specId ?? index}>
              <SectionHeading hint={child?.specId}>{child?.title ?? `Sub-chart ${index + 1}`}</SectionHeading>
              {child ? <FallbackTable item={child} depth={depth + 1} /> : <EmptyNote>Empty sub-chart</EmptyNote>}
            </Fragment>
          ))}
        </div>
      ) : null}

      {depth === 0 && Array.isArray(item.keyFeatures) && item.keyFeatures.length > 0 ? (
        <div className="mb-1">
          <SectionHeading>Key features</SectionHeading>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-700">
            {item.keyFeatures
              .filter((feature) => feature && feature.description)
              .map((feature, index) => (
                <li key={feature.id ?? index}>{feature.description}</li>
              ))}
          </ul>
        </div>
      ) : null}

      {!hasSeries &&
      sliceGroups.length === 0 &&
      columns.length === 0 &&
      stages.length === 0 &&
      changes.length === 0 &&
      (item.subCharts ?? []).length === 0 ? (
        <EmptyNote>
          No tabular data available for {item.specId}
          {item.type ? ` (type: ${humanizeToken(item.type)})` : ''}.
        </EmptyNote>
      ) : null}

      <ChartAttribution />
    </section>
  );
}

export default FallbackTable;
