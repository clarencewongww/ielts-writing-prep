/**
 * ProcessView — hand-drawn SVG flow diagram for process tasks.
 *
 * Stages come from `stages[]`, sorted by `order`, and are laid out in a serpentine grid
 * (three boxes per row, alternating direction); every coordinate is computed from the box
 * count. When `isCycle` is true a return path is drawn from the final stage back to the
 * first. The viewBox uses near-pixel units (640 wide) and the wrapper scrolls horizontally
 * on narrow screens so diagram text stays legible. Full stage text is repeated in an
 * accessible table beneath the drawing, because the boxes necessarily abbreviate.
 */

import { useId, useMemo } from 'react';
import { ChartAttribution } from './ChartAttribution';
import { cx, isFiniteNumber } from './format';
import type { StageData } from './types';
import type { ChartViewProps } from './LineChart';
import { Collapsible } from './ui';

export type ProcessViewProps = ChartViewProps;

const W = 640;
const MARGIN_X = 12;
const MARGIN_TOP = 26;
const MARGIN_BOTTOM = 18;
const ARROW_GAP = 24;
const ROW_GAP = 44;
const BOX_H = 104;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function wrapWords(text: string, maxChars: number, maxLines: number): string[] {
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
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) return [text];
  const consumedLength = lines.join(' ').length;
  if (consumedLength < text.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
  }
  return lines;
}

interface Box {
  stage: StageData;
  index: number;
  x: number;
  y: number;
  row: number;
  col: number;
}

export function ProcessView({ item, title, className }: ProcessViewProps) {
  const rawStages = (item.stages ?? []).filter((stage): stage is StageData => Boolean(stage));
  const stages = useMemo(
    () => rawStages.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [JSON.stringify(rawStages)],
  );
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const arrowId = `process-arrow-${uid}`;

  if (stages.length === 0) {
    return (
      <section className={cx('rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3', className)}>
        <p className="text-sm text-slate-500">Process {item.specId} has no stages in the bank data.</p>
        <ChartAttribution />
      </section>
    );
  }

  const cols = stages.length <= 3 ? stages.length : 3;
  const rows = Math.ceil(stages.length / cols);
  const boxW = (W - MARGIN_X * 2 - (cols - 1) * ARROW_GAP) / cols;
  const height = MARGIN_TOP + rows * BOX_H + (rows - 1) * ROW_GAP + MARGIN_BOTTOM;

  const boxes: Box[] = stages.map((stage, index) => {
    const row = Math.floor(index / cols);
    const positionInRow = index % cols;
    const col = row % 2 === 0 ? positionInRow : cols - 1 - positionInRow;
    return {
      stage,
      index,
      row,
      col,
      x: MARGIN_X + col * (boxW + ARROW_GAP),
      y: MARGIN_TOP + row * (BOX_H + ROW_GAP),
    };
  });

  const nameChars = Math.max(12, Math.floor((boxW - 46) / 6.8));
  const bodyChars = Math.max(16, Math.floor((boxW - 18) / 5.6));
  const first = boxes[0];
  const last = boxes[boxes.length - 1];
  const cyclePath =
    last.col === 0
      ? `M ${last.x - 6} ${last.y + BOX_H / 2} H 4 V 14 H ${first.x + boxW / 2} V ${first.y - 6}`
      : `M ${last.x + boxW + 6} ${last.y + BOX_H / 2} H ${W - 4} V 14 H ${first.x + boxW / 2} V ${first.y - 6}`;

  return (
    <figure className={cx('w-full', className)} data-spec-id={item.specId} data-figure="app-generated">
      {title ? <figcaption className="mb-1 text-sm font-semibold text-slate-700">{title}</figcaption> : null}
      {item.unitsNote ? <p className="mb-2 text-xs italic leading-snug text-slate-500">{item.unitsNote}</p> : null}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white p-2">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="block h-auto w-full min-w-[560px]"
          role="img"
          aria-label={`Process diagram for ${item.specId}${item.isCycle ? ' (cyclical)' : ''}`}
        >
          <defs>
            <marker id={arrowId} viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
            </marker>
          </defs>

          {boxes.map((box) => {
            const next = boxes[box.index + 1];
            const sameRow = next && next.row === box.row;
            const rowEnd = !sameRow && next;
            const nameLines = wrapWords(box.stage.name ?? `Stage ${box.index + 1}`, nameChars, 2);
            return (
              <g key={`${box.stage.order ?? box.index}-${box.index}`}>
                <rect
                  x={box.x}
                  y={box.y}
                  width={boxW}
                  height={BOX_H}
                  rx={7}
                  fill={item.isCycle ? '#f0fdfa' : '#f8fafc'}
                  stroke="#0f766e"
                  strokeWidth={1.4}
                />
                <circle cx={box.x + 17} cy={box.y + 17} r={9} fill="#0f766e" />
                <text x={box.x + 17} y={box.y + 20.6} fontSize={10.5} textAnchor="middle" fill="#ffffff" fontWeight={600}>
                  {isFiniteNumber(box.stage.order) ? box.stage.order : box.index + 1}
                </text>
                {nameLines.map((line, lineIndex) => (
                  <text
                    key={`name-${lineIndex}`}
                    x={box.x + 33}
                    y={box.y + 21 + lineIndex * 16}
                    fontSize={13}
                    fontWeight={700}
                    fill="#0f172a"
                  >
                    {line}
                  </text>
                ))}
                <text x={box.x + 12} y={box.y + 60} fontSize={10.5} fill="#334155">
                  {truncate(`in: ${box.stage.input ?? '—'}`, bodyChars)}
                </text>
                <text x={box.x + 12} y={box.y + 77} fontSize={10.5} fill="#0f766e">
                  {truncate(`out: ${box.stage.output ?? '—'}`, bodyChars)}
                </text>
                <text x={box.x + 12} y={box.y + 94} fontSize={9.5} fontStyle="italic" fill="#64748b">
                  {truncate(box.stage.equipment ?? '', bodyChars + 6)}
                </text>

                {sameRow ? (
                  <line
                    x1={box.x + boxW + 5}
                    y1={box.y + BOX_H / 2}
                    x2={next.x - 4}
                    y2={next.y + BOX_H / 2}
                    stroke="#64748b"
                    strokeWidth={1.4}
                    markerEnd={`url(#${arrowId})`}
                  />
                ) : null}

                {rowEnd ? (
                  <path
                    d={`M ${box.x + boxW / 2} ${box.y + BOX_H} V ${box.y + BOX_H + ROW_GAP / 2} H ${
                      next.x + boxW / 2
                    } V ${next.y - 5}`}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={1.4}
                    markerEnd={`url(#${arrowId})`}
                  />
                ) : null}
              </g>
            );
          })}

          {item.isCycle ? (
            <>
              <path
                d={cyclePath}
                fill="none"
                stroke="#0f766e"
                strokeWidth={1.4}
                strokeDasharray="7 5"
                markerEnd={`url(#${arrowId})`}
              />
              <text
                x={last.col === 0 ? 8 : W - 8}
                y={9}
                fontSize={11}
                textAnchor={last.col === 0 ? 'start' : 'end'}
                fill="#0f766e"
                fontWeight={600}
              >
                the cycle repeats
              </text>
            </>
          ) : (
            <>
              <text x={first.x + boxW / 2} y={first.y - 8} fontSize={11} textAnchor="middle" fill="#94a3b8">
                start
              </text>
              <text x={last.x + boxW / 2} y={last.y + BOX_H + 15} fontSize={11} textAnchor="middle" fill="#94a3b8">
                end
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-[11px] text-slate-400 sm:hidden">Swipe the diagram sideways to see every stage.</p>
        <Collapsible summary={`Stage details (${stages.length})`} defaultOpen={stages.length <= 4}>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th scope="col" className="border border-slate-200 px-2 py-1 font-semibold">
                    #
                  </th>
                  <th scope="col" className="border border-slate-200 px-2 py-1 font-semibold">
                    Stage
                  </th>
                  <th scope="col" className="border border-slate-200 px-2 py-1 font-semibold">
                    Input
                  </th>
                  <th scope="col" className="border border-slate-200 px-2 py-1 font-semibold">
                    Output
                  </th>
                  <th scope="col" className="border border-slate-200 px-2 py-1 font-semibold">
                    Equipment
                  </th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, index) => (
                  <tr key={`${stage.order ?? index}-${index}`} className="odd:bg-white even:bg-slate-50/60">
                    <td className="border border-slate-200 px-2 py-1 text-slate-500">
                      {isFiniteNumber(stage.order) ? stage.order : index + 1}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800">{stage.name ?? '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-slate-600">{stage.input ?? '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-slate-600">{stage.output ?? '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-slate-500">{stage.equipment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {item.isCycle ? 'Cyclical process: the final output feeds back into stage 1.' : 'Linear process: stages run once, in order.'}
          </p>
        </Collapsible>
      </div>

      <ChartAttribution />
    </figure>
  );
}

export default ProcessView;
