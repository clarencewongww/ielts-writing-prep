/**
 * TableView — plain HTML table from `columns` + `rows` + `cells`.
 *
 * - Numeric columns are right-aligned and thousand-separated.
 * - The change column (matched via `changeColumn` or a /change/i header) is annotated
 *   with a direction arrow and colour derived from the cell value.
 * - `rowTotals` is shown as a Total column when the bank does not already provide one.
 * - A quiet data note appears if `rowTotals` disagrees with the displayed cells.
 */

import { ChartAttribution } from './ChartAttribution';
import { cx, formatCell, isFiniteNumber } from './format';
import type { CellValue } from './types';
import type { ChartViewProps } from './LineChart';

export interface TableViewProps extends ChartViewProps {
  caption?: string;
}

function isPercentHeader(header?: string | null): boolean {
  return Boolean(header && /%|percent/i.test(header));
}

function ChangeCell({ value, header }: { value: CellValue; header?: string | null }) {
  if (!isFiniteNumber(value)) {
    return <span className="text-slate-400">{formatCell(value)}</span>;
  }
  const magnitude = Math.abs(value);
  const suffix = isPercentHeader(header) ? '%' : '';
  if (value > 0) {
    return (
      <span className="font-medium text-emerald-700" aria-label={`up ${magnitude}${suffix}`}>
        ▲ {magnitude}
        {suffix}
      </span>
    );
  }
  if (value < 0) {
    return (
      <span className="font-medium text-rose-700" aria-label={`down ${magnitude}${suffix}`}>
        ▼ {magnitude}
        {suffix}
      </span>
    );
  }
  return (
    <span className="text-slate-500" aria-label="no change">
      0{suffix}
    </span>
  );
}

export function TableView({ item, title, caption, className }: TableViewProps) {
  const columns = item.columns ?? [];
  const rows = item.rows ?? [];
  const cells = item.cells ?? [];

  if (columns.length === 0 || rows.length === 0) {
    return (
      <section className={cx('paper rounded-control border border-dashed border-line p-3', className)}>
        <p className="text-sm text-slate-500">Table {item.specId} has no rows or columns in the bank data.</p>
        <ChartAttribution policy={item.chartImagePolicy ?? undefined} />
      </section>
    );
  }

  const changeIndex = columns.findIndex(
    (column) => (item.changeColumn && column === item.changeColumn) || /change/i.test(column),
  );
  const totalIndex = columns.findIndex((column) => /total/i.test(column));
  const derivedTotals =
    totalIndex === -1 && Array.isArray(item.rowTotals) && item.rowTotals.length === rows.length
      ? item.rowTotals
      : null;

  const numericColumnIndices = columns
    .map((_, index) => index)
    .filter((index) => index !== changeIndex && index !== totalIndex);

  const mismatchNotes: string[] = [];
  if (derivedTotals) {
    rows.forEach((rowName, rowIndex) => {
      const values = numericColumnIndices.map((columnIndex) => cells[rowIndex]?.[columnIndex]);
      if (values.length === 0 || !values.every((value) => isFiniteNumber(value))) return;
      const rowSum = values.reduce<number>((sum, value) => sum + (isFiniteNumber(value) ? value : 0), 0);
      const reported = derivedTotals[rowIndex];
      if (isFiniteNumber(reported) && Math.abs(rowSum - reported) > 0.01) {
        mismatchNotes.push(
          `${rowName}: displayed columns total ${formatCell(rowSum)} but the bank reports ${formatCell(reported)}.`,
        );
      }
    });
  }

  const changeHeader = changeIndex >= 0 ? columns[changeIndex] : null;

  return (
    <figure className={cx('paper w-full rounded-control p-1 ring-1 ring-inset ring-line/60', className)} data-spec-id={item.specId} data-figure="app-generated">
      {title ? <figcaption className="mb-1 text-sm font-semibold text-slate-700">{title}</figcaption> : null}
      {caption ? <p className="mb-2 text-xs text-slate-500">{caption}</p> : null}
      {item.unitsNote ? <p className="mb-2 text-xs italic leading-snug text-slate-500">{item.unitsNote}</p> : null}

      {/* Scroll container: wide tables scroll inside the card instead of widening the page. */}
      <div className="max-w-full overflow-x-auto overscroll-x-contain rounded border border-slate-200">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                {item.topic ? item.topic : 'Item'}
              </th>
              {columns.map((column, columnIndex) => (
                <th
                  key={column}
                  scope="col"
                  className={cx(
                    'whitespace-nowrap border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide',
                    columnIndex === changeIndex ? 'text-right' : '',
                    columnIndex === totalIndex ? 'bg-slate-50 text-right' : '',
                  )}
                >
                  {column}
                </th>
              ))}
              {derivedTotals ? (
                <th
                  scope="col"
                  className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide"
                  title="Total reported in the bank data (rowTotals)"
                >
                  Total
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((rowName, rowIndex) => (
              <tr key={rowName} className="odd:bg-white even:bg-slate-50/60">
                <th scope="row" className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-left font-medium text-slate-800">
                  {rowName}
                </th>
                {columns.map((column, columnIndex) => {
                  const value = cells[rowIndex]?.[columnIndex];
                  if (columnIndex === changeIndex) {
                    return (
                      <td key={column} className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-right tabular-nums">
                        <ChangeCell value={value} header={changeHeader} />
                      </td>
                    );
                  }
                  if (columnIndex === totalIndex) {
                    return (
                      <td
                        key={column}
                        className="whitespace-nowrap border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-right font-medium tabular-nums text-slate-900"
                      >
                        {formatCell(value)}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={column}
                      className={cx(
                        'border-b border-slate-100 px-3 py-2 tabular-nums',
                        isFiniteNumber(value) ? 'text-right text-slate-700' : 'text-left text-slate-700',
                      )}
                    >
                      {formatCell(value)}
                    </td>
                  );
                })}
                {derivedTotals ? (
                  <td className="whitespace-nowrap border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                    {formatCell(derivedTotals[rowIndex])}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mismatchNotes.length > 0 ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Data note — {mismatchNotes.join(' ')}
        </p>
      ) : null}

      <ChartAttribution policy={item.chartImagePolicy ?? undefined} />
    </figure>
  );
}

export default TableView;
