/**
 * "Download PDF" button for the report header.
 *
 * The heavy PDF code is pulled in on demand: this module lazy-imports
 * `./pdf` on click, and `pdf.ts` in turn dynamic-imports `jspdf` and
 * `jspdf-autotable`, so neither the button nor the PDF libraries cost anything
 * until someone actually downloads. Failures are surfaced with an alert (and
 * logged) instead of leaving a stuck spinner — the report stays on screen.
 */

import { useCallback, useState } from "react";
import type { BankData } from "../data/bankLoader";
import type { GradingReport } from "../types/grading";
import type { SessionSelection, Submission } from "../types/session";

export interface DownloadButtonProps {
  /** Persisted report; the button is disabled until both tasks have been graded. */
  report: GradingReport | null;
  bank: BankData;
  submission: Submission;
  selection: SessionSelection;
  minutesUsed?: number;
}

export function DownloadButton({ report, bank, submission, selection, minutesUsed }: DownloadButtonProps) {
  const [building, setBuilding] = useState(false);
  const disabled = building || !report;

  const handleClick = useCallback(() => {
    if (!report || building) return;
    setBuilding(true);
    void (async () => {
      try {
        const { buildPdf, pdfFilename } = await import("./pdf");
        const doc = await buildPdf(report, bank, selection, { submission, minutesUsed });
        doc.save(pdfFilename(report.overallBand, report.generatedAt));
      } catch (error) {
        console.error("[pdf] report download failed:", error);
        window.alert(
          "Sorry — the PDF couldn't be generated. Your report is still on screen, so please try again.",
        );
      } finally {
        setBuilding(false);
      }
    })();
  }, [report, bank, submission, selection, minutesUsed, building]);

  return (
    <button
      type="button"
      data-testid="report-download"
      /* No aria-label: the visible label is the accessible name, so the two can
         never drift (accessibility.md › Vision; writing.md). */
      onClick={handleClick}
      disabled={disabled}
      title={report ? undefined : "Available once both tasks are graded"}
      className="min-h-[44px] rounded-full border border-line bg-content px-5 text-subhead font-semibold text-ink transition-colors ease-apple hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-tint"
    >
      {building ? "Preparing PDF…" : "Download PDF"}
    </button>
  );
}
