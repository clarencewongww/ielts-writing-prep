/**
 * MapView — hand-drawn SVG for before/after map tasks.
 *
 * Both years are always drawn: a panel per year (`beforeYear` → `afterYear`), zones
 * placed from `areas[].zone` on a compass grid, then the full `changes[]` list
 * (feature / from / to / year) as an HTML table beneath the drawing. Nothing is
 * positioned by task-specific coordinates: unknown zones fall into free grid slots.
 */

import { ChartAttribution } from './ChartAttribution';
import { cx, normalizeLabel } from './format';
import type { AreaData, ChangeData } from './types';
import type { ChartViewProps } from './LineChart';
import { Badge, Collapsible } from './ui';

export interface MapViewProps extends ChartViewProps {
  /** Panel height in pixels for the SVG wrapper. */
  heightClass?: string;
}

type GridSlot = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se';

const SLOT_ORDER: GridSlot[] = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'];

const SLOT_COORDS: Record<GridSlot, { col: number; row: number }> = {
  nw: { col: 0, row: 0 },
  n: { col: 1, row: 0 },
  ne: { col: 2, row: 0 },
  w: { col: 0, row: 1 },
  c: { col: 1, row: 1 },
  e: { col: 2, row: 1 },
  sw: { col: 0, row: 2 },
  s: { col: 1, row: 2 },
  se: { col: 2, row: 2 },
};

function resolveSlot(zone?: string): GridSlot | null {
  const text = normalizeLabel(zone ?? '');
  if (!text) return null;
  if (/centre|center|central|middle/.test(text)) return 'c';
  const vertical = /north|northern/.test(text) ? 'n' : /south|southern/.test(text) ? 's' : '';
  const horizontal = /west|western/.test(text) ? 'w' : /east|eastern/.test(text) ? 'e' : '';
  if (vertical === 'n' && horizontal === 'w') return 'nw';
  if (vertical === 'n' && horizontal === 'e') return 'ne';
  if (vertical === 's' && horizontal === 'w') return 'sw';
  if (vertical === 's' && horizontal === 'e') return 'se';
  if (vertical) return vertical as GridSlot;
  if (horizontal) return horizontal as GridSlot;
  return null;
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) return [text];
  const last = lines[lines.length - 1];
  const consumed = lines.join(' ');
  if (consumed.length < text.length && last.length > maxChars - 1) {
    lines[lines.length - 1] = `${last.slice(0, Math.max(1, maxChars - 1))}…`;
  } else if (consumed.length < text.length) {
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

interface PlacedArea {
  area: AreaData;
  slot: GridSlot;
  change: ChangeData | null;
}

function placeAreas(areas: AreaData[]): PlacedArea[] {
  const used: GridSlot[] = [];
  const placed: PlacedArea[] = [];
  areas.forEach((area) => {
    const requested = resolveSlot(area.zone);
    const slot = requested && !used.includes(requested) ? requested : SLOT_ORDER.find((candidate) => !used.includes(candidate)) ?? 'c';
    used.push(slot);
    placed.push({ area, slot, change: null });
  });
  return placed;
}

function findChange(area: AreaData, changes: ChangeData[]): ChangeData | null {
  const areaKey = normalizeLabel(area.name ?? '');
  if (!areaKey) return null;
  return (
    changes.find((change) => {
      const featureKey = normalizeLabel(change.feature ?? '');
      if (!featureKey) return false;
      return featureKey.includes(areaKey) || areaKey.includes(featureKey);
    }) ?? null
  );
}

function isUnchanged(change: ChangeData | null): boolean {
  return normalizeLabel(change?.to ?? '') === 'unchanged';
}

function MapPanel({
  x,
  width,
  label,
  placed,
  changes,
  after,
}: {
  x: number;
  width: number;
  label: string;
  placed: PlacedArea[];
  changes: ChangeData[];
  after: boolean;
}) {
  const pad = 3;
  const innerX = x + pad;
  const innerY = 16 + pad;
  const innerW = width - pad * 2;
  const innerH = 86;
  const cellW = innerW / 3;
  const cellH = innerH / 3;

  const bySlot = new Map<GridSlot, PlacedArea[]>();
  placed.forEach((entry) => {
    const list = bySlot.get(entry.slot) ?? [];
    list.push(entry);
    bySlot.set(entry.slot, list);
  });

  return (
    <g>
      <text x={innerX} y={12} fontSize={6.4} fontWeight={700} fill="#1D1D1F">
        {label}
      </text>
      <rect x={innerX} y={innerY} width={innerW} height={innerH} rx={2} fill="#ffffff" stroke="#86868B" strokeWidth={0.5} />
      {Array.from(bySlot.entries()).map(([slot, entries]) => {
        const { col, row } = SLOT_COORDS[slot];
        const stackHeight = cellH / entries.length;
        return entries.map((entry, index) => {
          const change = findChange(entry.area, changes);
          const boxX = innerX + col * cellW + 1;
          const boxY = innerY + row * cellH + index * stackHeight + 1;
          const boxW = cellW - 2;
          const boxH = stackHeight - 2;
          const unchanged = isUnchanged(change);
          const fill = !change ? '#E8E8ED' : unchanged ? '#ECFDF5' : '#FFFBEB';
          const stroke = !change ? '#86868B' : unchanged ? '#047857' : '#B45309';
          const detail = change ? (after ? change.to ?? '' : change.from ?? '') : '';
          const detailLines = wrapText(detail, 17, 2);
          const boxTitle = change
            ? `${entry.area.name ?? '—'} — ${after ? 'after' : 'before'}: ${detail}`
            : entry.area.name ?? '—';
          return (
            <g key={`${entry.area.name ?? slot}-${index}`}>
              <title>{boxTitle}</title>
              <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={1.5} fill={fill} stroke={stroke} strokeWidth={0.6} />
              {wrapText(entry.area.name ?? '—', 15, 2).map((line, lineIndex) => (
                <text
                  key={`name-${lineIndex}`}
                  x={boxX + boxW / 2}
                  y={boxY + 5.2 + lineIndex * 4.6}
                  fontSize={4}
                  fontWeight={600}
                  textAnchor="middle"
                  fill="#1D1D1F"
                >
                  {line}
                </text>
              ))}
              {detailLines.map((line, lineIndex) => (
                <text
                  key={`detail-${lineIndex}`}
                  x={boxX + boxW / 2}
                  y={boxY + 14.6 + lineIndex * 3.9}
                  fontSize={3.3}
                  textAnchor="middle"
                  fill={unchanged ? '#047857' : '#B45309'}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        });
      })}
    </g>
  );
}

export function MapView({ item, className, heightClass = 'h-auto min-h-[180px]' }: MapViewProps) {
  const areas = (item.areas ?? []).filter((area): area is AreaData => Boolean(area && area.name));
  const changes = (item.changes ?? []).filter((change): change is ChangeData => Boolean(change));
  const beforeYear = item.beforeYear ?? 'before';
  const afterYear = item.afterYear ?? 'after';

  if (areas.length === 0 && changes.length === 0) {
    return (
      <section className={cx('paper rounded-control border border-dashed border-line p-3.5', className)}>
        <p className="text-sm text-slate-500">Map {item.specId} has no areas or changes in the bank data.</p>
        <ChartAttribution policy={item.chartImagePolicy ?? undefined} />
      </section>
    );
  }

  const placed = placeAreas(areas);
  const changedCount = changes.filter((change) => !isUnchanged(change)).length;

  return (
    <figure className={cx('paper w-full rounded-control p-2.5 ring-1 ring-inset ring-line/60', className)} data-spec-id={item.specId} data-figure="app-generated">
      {item.unitsNote ? <p className="mb-2 text-xs italic leading-snug text-slate-500">{item.unitsNote}</p> : null}

      <div className="overflow-hidden rounded-control p-1.5">
        <svg
          viewBox="0 0 240 116"
          className={cx('mx-auto w-full max-w-3xl', heightClass)}
          role="img"
          aria-label={`Map comparison, ${beforeYear} and ${afterYear}, for ${item.specId}`}
        >
          <MapPanel x={2} width={116} label={String(beforeYear)} placed={placed} changes={changes} after={false} />
          <MapPanel x={122} width={116} label={String(afterYear)} placed={placed} changes={changes} after />
          <text x={119} y={60} fontSize={7} textAnchor="middle" fill="#94a3b8" fontWeight={700}>
            →
          </text>
          <text x={234} y={12} fontSize={5} textAnchor="middle" fill="#94a3b8">
            N ↑
          </text>
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-warn/40 bg-warn-soft" aria-hidden="true" />
          changed by {String(afterYear)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-ok/40 bg-ok-soft" aria-hidden="true" />
          unchanged
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line bg-surface" aria-hidden="true" />
          no change reported
        </span>
        <Badge tone="amber">{changedCount} changes listed</Badge>
      </div>

      <div className="mt-3 overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                Feature
              </th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                {String(beforeYear)}
              </th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                {String(afterYear)}
              </th>
              <th scope="col" className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                Year
              </th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change, index) => {
              const unchanged = isUnchanged(change);
              return (
                <tr key={`${change.feature ?? index}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                  <th scope="row" className="border-b border-slate-100 px-3 py-2 text-left font-medium text-slate-800">
                    {change.feature ?? '—'}
                  </th>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-600">{change.from ?? '—'}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {unchanged ? <Badge tone="emerald">unchanged</Badge> : change.to ?? '—'}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-500">
                    {change.year === null || change.year === undefined ? '—' : String(change.year)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(item.features ?? []).length > 0 ? (
        <div className="mt-3">
          <Collapsible summary={`Site features (${(item.features ?? []).length})`}>
            <ul className="flex flex-wrap gap-1.5">
              {(item.features ?? []).map((feature) => (
                <li
                  key={feature}
                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600"
                >
                  {feature}
                </li>
              ))}
            </ul>
          </Collapsible>
        </div>
      ) : null}

      <ChartAttribution policy={item.chartImagePolicy ?? undefined} />
    </figure>
  );
}

export default MapView;
