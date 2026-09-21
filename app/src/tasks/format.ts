/**
 * Data helpers shared by the task renderers.
 * Everything here is derived from bank fields at render time; no task values are hardcoded.
 */

import type { CellValue, SeriesData, SliceData, Task1Item, WordTarget } from './types';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Format a bank cell for display. Non-numeric or missing values degrade to an em dash. */
export function formatCell(value: CellValue): string {
  if (value === null || value === undefined || value === '') return '—';
  if (isFiniteNumber(value)) {
    return Number.isInteger(value) ? numberFormatter.format(value) : decimalFormatter.format(value);
  }
  return String(value);
}

/** Format a numeric value with optional unit suffix. */
export function formatValue(value: unknown, unit?: string | null): string {
  const text = formatCell(value as CellValue);
  return unit ? `${text} ${unit}` : text;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** True when every entry of a list is a finite number (i.e. safe to sort numerically). */
export function allNumeric(values: Array<string | number | null | undefined>): boolean {
  return values.length > 0 && values.every((value) => isFiniteNumber(value));
}

/**
 * Returns the display order for x-axis values.
 * Numeric axes (years) are sorted ascending; categorical axes keep the bank order.
 */
export function axisOrder(xValues: Array<string | number>): number[] {
  const indices = xValues.map((_, index) => index);
  if (!allNumeric(xValues)) return indices;
  return indices.sort((a, b) => Number(xValues[a]) - Number(xValues[b]));
}

/** Reorder a series' values to match a display order, keeping nulls as gaps. */
export function reorderSeries(
  series: SeriesData,
  order: number[],
): Array<number | string | null> {
  const source = series.values ?? [];
  return order.map((index) => source[index] ?? null);
}

/** Group pie slices by year. Years sort ascending; slices without a year go under `null`. */
export function groupSlicesByYear(slices: SliceData[]): Array<{
  year: number | string | null;
  slices: SliceData[];
  total: number;
  reported: number;
}> {
  const groups = new Map<string, { year: number | string | null; slices: SliceData[] }>();
  for (const slice of slices) {
    if (!slice) continue;
    const year = slice.year ?? null;
    const key = year === null ? '__unknown__' : String(year);
    const bucket = groups.get(key) ?? { year, slices: [] };
    bucket.slices.push(slice);
    groups.set(key, bucket);
  }
  const list = Array.from(groups.values());
  list.sort((a, b) => {
    if (a.year === null && b.year === null) return 0;
    if (a.year === null) return 1;
    if (b.year === null) return -1;
    if (isFiniteNumber(a.year) && isFiniteNumber(b.year)) return a.year - b.year;
    return String(a.year).localeCompare(String(b.year));
  });
  return list.map((group) => {
    const total = group.slices.reduce((sum, slice) => sum + (isFiniteNumber(slice.percent) ? slice.percent : 0), 0);
    return { ...group, total: roundTo(total, 2), reported: group.slices.length };
  });
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((total, value) => total + (isFiniteNumber(value) ? value : 0), 0);
}

/** Word-target summary derived from `wordTarget`; returns null when the bank omits it. */
export function formatWordTarget(target?: WordTarget | null): string | null {
  if (!target) return null;
  const recommended = Array.isArray(target.recommended) ? target.recommended : [];
  if (recommended.length >= 2) {
    return `${recommended[0]}–${recommended[recommended.length - 1]} words`;
  }
  if (isFiniteNumber(target.min)) return `${target.min}+ words`;
  return null;
}

/** Lower-case, punctuation-free comparison key. */
export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

/** Percentage change between two numeric cells, or null when it cannot be computed. */
export function percentChange(from: unknown, to: unknown): number | null {
  if (!isFiniteNumber(from) || !isFiniteNumber(to) || from === 0) return null;
  return roundTo(((to - from) / Math.abs(from)) * 100, 1);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Human label for an item type, e.g. `adv-disadv` -> `Adv Disadv`. */
export function humanizeToken(token?: string | null): string {
  if (!token) return '';
  return token
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Distinct values in first-seen order. */
export function distinct<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Item fields reduced to printable rows for the fallback table. */
export function scalarRows(item: Task1Item): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (item.type) rows.push({ label: 'Type', value: humanizeToken(item.type) });
  if (item.topic) rows.push({ label: 'Topic', value: item.topic });
  const years = item.timeFrame?.values;
  if (Array.isArray(years) && years.length > 0) {
    rows.push({ label: 'Time frame', value: years.join(' – ') });
  }
  if (item.unitsNote) rows.push({ label: 'Units', value: item.unitsNote });
  return rows;
}
