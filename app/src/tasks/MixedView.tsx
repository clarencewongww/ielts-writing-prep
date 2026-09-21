/**
 * MixedView — a Task 1 item whose `subCharts[]` holds two (or more) figures.
 *
 * Children are dispatched one by one by `ChildTaskView`, which also serves as the shared
 * dispatcher for ChartRenderer. Nothing assumes a particular combination: pie, table, map
 * and process children all route to their own renderer, and anything unrecognised degrades
 * to FallbackTable.
 *
 * Step 1: the figures, the statement, the time frame and the units are task data and stay
 * visible; the item-level `keyFeatures` list and `groupingStrategy` are interpretation, so
 * they ship inside collapsed disclosures (counted summaries only). Child renderers never
 * inject their own key features, so there is nothing to collapse per sub-chart.
 */

import { useMemo, type ReactNode } from 'react';
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
import { Badge, Collapsible, EmptyNote, UnitsNote } from './ui';

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
  /* Sub-figures inherit the parent's bank policy when they carry none, so every
     attribution tooltip names a policy. Memoised on purpose: the exam timer
     re-renders this tree every tick, and a fresh object per render would rebuild
     each chart underneath. */
  const children = useMemo(
    () =>
      (item.subCharts ?? [])
        .filter((child): child is Task1Item => Boolean(child))
        .map((child) => ({
          ...child,
          chartImagePolicy: child.chartImagePolicy ?? item.chartImagePolicy,
        })),
    [item.subCharts, item.chartImagePolicy],
  );
  const childTypes = distinct(children.map((child) => humanizeToken(child.type ?? 'unknown')));
  const keyFeatures = (item.keyFeatures ?? []).filter((feature) => feature && feature.description);

  if (children.length === 0) {
    return (
      <section className={cx('paper rounded-control border border-dashed border-line p-3.5', className)}>
        <p className="text-sm text-slate-500">Mixed task {item.specId} has no sub-charts in the bank data.</p>
        <ChartAttribution policy={item.chartImagePolicy ?? undefined} />
      </section>
    );
  }

  return (
    <section className={cx('paper w-full min-w-0 rounded-control p-3 ring-1 ring-inset ring-line/60', className)} data-spec-id={item.specId} data-mixed-with={item.mixedWith ?? childTypes.join('+')}>
      <header className="mb-3 flex flex-wrap items-center gap-2">
        {title ? <h3 className="text-subhead font-semibold text-ink">{title}</h3> : null}
        <Badge tone="indigo" title="Chart types in this task">
          {pluralize(children.length, 'chart')}: {childTypes.join(' + ')}
        </Badge>
        {item.mixedWith ? <Badge tone="slate">declared pairing: {humanizeToken(item.mixedWith)}</Badge> : null}
        {aside}
      </header>

      {showStatement && item.statement ? (
        <p className="mb-3 rounded-control bg-surface px-3.5 py-2 text-subhead text-ink">{item.statement}</p>
      ) : null}

      {/* The combined units note is task data (like the statement), so it stays visible
          above the figures; each sub-chart still repeats its own note inside its frame. */}
      <UnitsNote note={item.unitsNote} />

      {/* Each sub-figure gets its own scroll container so a wide table or process
          diagram never widens the page; min-w-0 keeps it from forcing the panel. */}
      <div className="space-y-6">
        {children.map((child, index) => (
          <div
            key={child.specId ?? index}
            className="min-w-0 max-w-full overflow-x-auto rounded-control p-2 ring-1 ring-inset ring-line/60"
          >
            <h4 className="mb-2 flex flex-wrap items-center gap-2 text-subhead font-semibold text-ink">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-tint-soft text-[11px] font-semibold text-tint-strong">
                {index + 1}
              </span>
              {child.title ?? `${humanizeToken(child.type ?? '')} chart`}
              <span className="font-mono text-caption font-normal text-ink-2">{child.specId}</span>
            </h4>
            <ChildTaskView item={child} depth={depth} />
          </div>
        ))}
      </div>

      {keyFeatures.length > 0 ? (
        <div className="mt-4">
          {/* Interpretation, not task data: the overview checklist stays behind a
              closed disclosure so the learner reads both figures before seeing it. */}
          <Collapsible
            testId="mixed-key-features"
            summary={
              <>
                Key features ({keyFeatures.length}) —{' '}
                <span className="group-open:hidden">tap to expand</span>
                <span className="hidden group-open:inline">tap to collapse</span>
              </>
            }
          >
            <ol className="list-decimal space-y-1 pl-5 text-subhead text-ink">
              {keyFeatures.map((feature, index) => (
                <li key={feature.id ?? index}>{feature.description}</li>
              ))}
            </ol>
            <p className="mt-2 text-caption text-ink-2">Your overview must cover both charts, not one of them.</p>
          </Collapsible>
        </div>
      ) : (
        <EmptyNote>No combined key features recorded for this mixed task.</EmptyNote>
      )}

      {item.groupingStrategy ? (
        <div className="mt-3">
          <Collapsible
            testId="mixed-organisation"
            summary="Suggested organisation"
            aside={
              <span className="text-caption font-normal text-ink-2">
                <span className="group-open:hidden">tap to expand</span>
                <span className="hidden group-open:inline">tap to collapse</span>
              </span>
            }
          >
            <p className="text-subhead text-ink-2">{item.groupingStrategy}</p>
          </Collapsible>
        </div>
      ) : null}
    </section>
  );
}

export default MixedView;
