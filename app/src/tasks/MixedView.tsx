/**
 * MixedView — a Task 1 item whose `subCharts[]` holds two (or more) figures.
 *
 * Children are dispatched one by one by `ChildTaskView`, which also serves as the shared
 * dispatcher for ChartRenderer. Nothing assumes a particular combination: pie, table, map
 * and process children all route to their own renderer, and anything unrecognised degrades
 * to FallbackTable. The item-level `keyFeatures` list is shown once, combined, as the
 * overview checklist for the whole task.
 */

import type { ReactNode } from 'react';
import { BarChart } from './BarChart';
import { ChartAttribution } from './ChartAttribution';
import { FallbackTable } from './FallbackTable';
import { cx, distinct, humanizeToken, pluralize } from './format';
import { LineChart, type ChartViewProps } from './LineChart';
import { MapView } from './MapView';
import { PieChart } from './PieChart';
import { ProcessView } from './ProcessView';
import { TableView } from './TableView';
import type { Task1Item } from './types';
import { Badge, Collapsible, EmptyNote } from './ui';

export interface ChildTaskViewProps extends ChartViewProps {
  /** Nesting guard for mixed-inside-mixed data. */
  depth?: number;
}

/** Dispatches a single Task 1 item to its specialised view, or to the fallback table. */
export function ChildTaskView({ item, title, className, depth = 0 }: ChildTaskViewProps) {
  const type = typeof item.type === 'string' ? item.type.toLowerCase() : '';
  switch (type) {
    case 'line':
      return <LineChart item={item} title={title} className={className} />;
    case 'bar':
      return <BarChart item={item} title={title} className={className} />;
    case 'pie':
      return <PieChart item={item} title={title} className={className} />;
    case 'table':
      return <TableView item={item} title={title} className={className} />;
    case 'map':
      return <MapView item={item} title={title} className={className} />;
    case 'process':
      return <ProcessView item={item} title={title} className={className} />;
    case 'mixed':
      return depth < 2 ? (
        <MixedView item={item} title={title} className={className} depth={depth + 1} />
      ) : (
        <FallbackTable item={item} reason="nested mixed charts are not drawn" className={className} depth={depth} />
      );
    default:
      return (
        <FallbackTable
          item={item}
          reason={type ? `unknown chart type "${item.type}"` : 'missing chart type'}
          className={className}
        />
      );
  }
}

export interface MixedViewProps extends ChartViewProps {
  /** Nesting guard for mixed-inside-mixed data. */
  depth?: number;
  /** Render the task statement above the figures (off by default; the exam panel owns it). */
  showStatement?: boolean;
  /** Optional extra controls rendered next to the heading. */
  aside?: ReactNode;
}

export function MixedView({ item, title, className, depth = 0, showStatement = false, aside }: MixedViewProps) {
  const children = (item.subCharts ?? []).filter((child): child is Task1Item => Boolean(child));
  const childTypes = distinct(children.map((child) => humanizeToken(child.type ?? 'unknown')));
  const keyFeatures = (item.keyFeatures ?? []).filter((feature) => feature && feature.description);

  if (children.length === 0) {
    return (
      <section className={cx('rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3', className)}>
        <p className="text-sm text-slate-500">Mixed task {item.specId} has no sub-charts in the bank data.</p>
        <ChartAttribution />
      </section>
    );
  }

  return (
    <section className={cx('w-full', className)} data-spec-id={item.specId} data-mixed-with={item.mixedWith ?? childTypes.join('+')}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        {title ? <h3 className="text-sm font-semibold text-slate-800">{title}</h3> : null}
        <Badge tone="indigo" title="Chart types in this task">
          {pluralize(children.length, 'chart')}: {childTypes.join(' + ')}
        </Badge>
        {item.mixedWith ? <Badge tone="slate">declared pairing: {humanizeToken(item.mixedWith)}</Badge> : null}
        {aside}
      </header>

      {showStatement && item.statement ? (
        <p className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{item.statement}</p>
      ) : null}

      <div className="space-y-6">
        {children.map((child, index) => (
          <div key={child.specId ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
                {index + 1}
              </span>
              {child.title ?? `${humanizeToken(child.type ?? '')} chart`}
              <span className="font-mono text-[11px] font-normal text-slate-400">{child.specId}</span>
            </h4>
            <ChildTaskView item={child} depth={depth} />
          </div>
        ))}
      </div>

      {keyFeatures.length > 0 ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-800">
            Combined key features ({keyFeatures.length})
          </h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {keyFeatures.map((feature, index) => (
              <li key={feature.id ?? index}>{feature.description}</li>
            ))}
          </ol>
          <p className="mt-1 text-[11px] text-teal-700">Your overview must cover both charts, not one of them.</p>
        </div>
      ) : (
        <EmptyNote>No combined key features recorded for this mixed task.</EmptyNote>
      )}

      {item.groupingStrategy ? (
        <div className="mt-3">
          <Collapsible summary="Suggested organisation">
            <p className="text-sm text-slate-600">{item.groupingStrategy}</p>
          </Collapsible>
        </div>
      ) : null}
    </section>
  );
}

export default MixedView;
