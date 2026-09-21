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
  /** Tailwind height classes for the plot area. Defaults to a chart-friendly box. */
  heightClass?: string;
  footer?: ReactNode;
  className?: string;
  attributionDetail?: string;
}

export function FigureFrame({
  item,
  title,
  children,
  heightClass = 'h-64 md:h-80',
  footer,
  className,
  attributionDetail,
}: FigureFrameProps) {
  return (
    <figure className={cx('w-full', className)} data-spec-id={item.specId} data-figure="app-generated">
      {title ? (
        <figcaption className="mb-1 text-sm font-semibold text-slate-700">{title}</figcaption>
      ) : null}
      <UnitsNote note={item.unitsNote} />
      <div className={cx('relative w-full', heightClass)}>{children}</div>
      {footer}
      <ChartAttribution detail={attributionDetail} policy={item.chartImagePolicy ?? undefined} />
    </figure>
  );
}

export default FigureFrame;
