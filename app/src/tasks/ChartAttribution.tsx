/**
 * ChartAttribution — the mandatory provenance label for every rendered figure.
 *
 * Bank policy (chartImagePolicy / sourceConvention): figures are recreated inside the
 * app from reported task data and must never be presented as official IELTS material.
 */

import { cx } from './format';

export const ATTRIBUTION_TEXT = 'App-generated recreation, not official IELTS';

export interface ChartAttributionProps {
  /** Extra provenance line, e.g. the chart's own note. Kept short by design. */
  detail?: string;
  /**
   * Internal bank policy (e.g. `chartImagePolicy`). Developer-facing only: it is never
   * rendered as text, just exposed as a hover tooltip for maintainers.
   */
  policy?: string;
  /** Show the fuller policy wording (still well under 25 words). */
  verbose?: boolean;
  className?: string;
}

export function ChartAttribution({ detail, policy, verbose = false, className }: ChartAttributionProps) {
  return (
    <p
      className={cx('mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-2', className)}
      data-attribution="true"
      title={policy ? `App policy: ${policy}` : undefined}
    >
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true">ⓘ</span>
        <span>{ATTRIBUTION_TEXT}</span>
      </span>
      {verbose ? <span>Redrawn from reported exam tasks; no source image is embedded.</span> : null}
      {detail ? <span className="text-ink-2">{detail}</span> : null}
    </p>
  );
}

export default ChartAttribution;
