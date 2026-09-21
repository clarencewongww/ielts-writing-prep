/**
 * FigureFrame — shared chrome around a rendered figure: optional caption, the item's
 * `unitsNote` as a subtitle, the plot area with a fixed responsive height, and the
 * mandatory attribution label.
 */

import type { ReactNode } from 'react';
import { ChartAttribution } from './ChartAttribution';
import { cx } from './format';
import type { Task1Item } from './types';
import { UnitsNote } from './ui';

export interface FigureFrameProps {
  item: Task1Item;
  title?: ReactNode;
  children: ReactNode;
  /** Tailwind height classes for the plot area. Defaults to a chart-friendly box
   *  that never drops below 180 px, where Chart.js axis labels stop being readable. */
  heightClass?: string;
  footer?: ReactNode;
  className?: string;
  attributionDetail?: string;
}

export function FigureFrame({
  item,
  title,
  children,
  heightClass = 'h-64 min-h-[180px] md:h-80',
  footer,
  className,
  attributionDetail,
}: FigureFrameProps) {
  return (
    <figure className={cx('w-full', className)} data-spec-id={item.specId} data-figure="app-generated">
      {title ? (
        <figcaption className="mb-1 text-subhead font-semibold text-ink">{title}</figcaption>
      ) : null}
      <UnitsNote note={item.unitsNote} />
      {/* The plot sits on a fixed paper surface, not on the app material: the
          figure is recreated exam content, so the `.paper` scope pins the light
          tokens and keeps marks and axis labels legible in both appearances
          (charts.md › Best practices; materials.md › Liquid Glass — glass
          belongs to controls only). */}
      <div className="paper rounded-control p-2.5 ring-1 ring-inset ring-line/60">
        <div className={cx('relative w-full', heightClass)}>{children}</div>
      </div>
      {footer}
      <ChartAttribution detail={attributionDetail} policy={item.chartImagePolicy ?? undefined} />
    </figure>
  );
}

export default FigureFrame;
