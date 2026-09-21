/**
 * PDF export for the graded report — offline and lazy by design.
 *
 * `buildPdf` dynamically imports `jspdf` and `jspdf-autotable` when it runs, so the
 * app's initial bundle never carries them; `DownloadButton` in turn lazy-imports
 * this module on click. The document uses jsPDF's built-in Helvetica font (no font
 * files, no network access) and is organised into six sections:
 *
 *   1. header + score bands table (autoTable)
 *   2. the full Task 1 answer
 *   3. the full Task 2 answer
 *   4. the five highest-priority feedback items (criterion + coaching + quote)
 *   5. the bank's Band 8 model answers for both tasks
 *   6. footer disclaimer stamped on every page
 *
 * The bank stays read-only: prompt statements, model answers and the version string
 * are read straight from `BankData`. Nothing here fetches anything.
 */

import type { jsPDF } from "jspdf";
import type { BankData } from "../data/bankLoader";
import { prioritizeFeedback } from "../grading/feedback";
import type { Criterion, FeedbackItem, GradingReport, TaskGrade } from "../types/grading";
import type { Task1Item, Task2Item } from "../types/bank";
import type { SessionSelection, Submission } from "../types/session";

export interface BuildPdfOptions {
  /** Frozen submission; supplies the answer texts. */
  submission?: Submission | null;
  /** Wall-clock minutes used, mirrored from the report screen. */
  minutesUsed?: number;
}

const DISCLAIMER = "Deterministic rubric, not affiliated with IELTS.";

/* Layout constants (A4, points). */
const MARGIN = 48;
const FOOTER_RESERVE = 52;
const LINE_HEIGHT_FACTOR = 1.32;

const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_200: [number, number, number] = [226, 232, 240];
const SLATE_50: [number, number, number] = [248, 250, 252];
const HEAD_FILL: [number, number, number] = [30, 41, 59];

const CRITERIA: readonly Criterion[] = ["TA", "TR", "CC", "LR", "GRA"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------------ */
/* Small pure helpers (exported for tests / reuse)                     */
/* ------------------------------------------------------------------ */

/** `8` → `8.0`, `7.5` → `7.5`; non-finite values degrade to an en dash. */
export function formatBand(band: number): string {
  return Number.isFinite(band) ? band.toFixed(1) : "–";
}

/** `ielts-report-{YYYYMMDD}-{overall}band.pdf`. */
export function pdfFilename(overallBand: number, generatedAt?: string): string {
  const date = parseDate(generatedAt) ?? new Date();
  const stamp = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  return `ielts-report-${stamp}-${formatBand(overallBand)}band.pdf`;
}

/** Collapses whitespace and trims to `maxChars` on a word boundary, adding an ellipsis. */
export function trimText(text: string, maxChars: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed;
  const slice = collapsed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/** The five most useful feedback items: Task 2 first (double-weighted), Task 1 fills the rest. */
export function topFeedback(report: GradingReport): FeedbackItem[] {
  const task2 = prioritizeFeedback(report.task2.feedback ?? [], { maxPerGate: 1, limit: 3 });
  const task1 = prioritizeFeedback(report.task1.feedback ?? [], { maxPerGate: 1, limit: 2 });
  const picked = [...task2, ...task1];
  if (picked.length >= 5) return picked.slice(0, 5);

  const seen = new Set(picked.map(feedbackKey));
  const fallback = prioritizeFeedback([...(report.task2.feedback ?? []), ...(report.task1.feedback ?? [])], {
    maxPerGate: 1,
    limit: 5,
  });
  for (const item of fallback) {
    if (picked.length >= 5) break;
    const key = feedbackKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
  }
  return picked;
}

function feedbackKey(item: FeedbackItem): string {
  return `${item.checkId}:${item.criterion}:${item.evidenceSpan?.startChar ?? 0}:${item.evidenceSpan?.endChar ?? 0}`;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | undefined): string {
  const date = parseDate(value) ?? new Date();
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/* ------------------------------------------------------------------ */
/* Document builder                                                    */
/* ------------------------------------------------------------------ */

/**
 * Builds the report PDF and returns the jsPDF document; the caller decides how to
 * persist it (`doc.save(pdfFilename(...))` for the browser download).
 */
export async function buildPdf(
  report: GradingReport,
  bank: BankData,
  selection: SessionSelection,
  options: BuildPdfOptions = {},
): Promise<jsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: false });
  doc.setProperties({
    title: "IELTS Academic Writing — Report",
    subject: "Practice report produced by a deterministic rubric",
    creator: "IELTS Writing CBT",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let cursorY = MARGIN;

  const ensureSpace = (height: number): void => {
    if (cursorY + height > pageHeight - FOOTER_RESERVE) {
      doc.addPage();
      cursorY = MARGIN;
    }
  };

  const heading = (text: string): void => {
    ensureSpace(46);
    cursorY += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...SLATE_900);
    doc.text(text, MARGIN, cursorY);
    cursorY += 8;
    doc.setDrawColor(...SLATE_200);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, cursorY, pageWidth - MARGIN, cursorY);
    cursorY += 14;
  };

  const subHeading = (text: string): void => {
    ensureSpace(28);
    cursorY += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...SLATE_900);
    doc.text(text, MARGIN, cursorY);
    cursorY += 16;
  };

  const paragraph = (
    text: string,
    { size = 9.5, color = SLATE_700, style = "normal", gap = 10 }: ParagraphOptions = {},
  ): void => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lineHeight = size * LINE_HEIGHT_FACTOR;
    const blocks = text
      .split(/\n\s*\n/)
      .flatMap((block) => block.split("\n"))
      .map((block) => block.trim())
      .filter(Boolean);
    for (const block of blocks) {
      const lines = doc.splitTextToSize(block, contentWidth) as string[];
      const height = lines.length * lineHeight;
      ensureSpace(height + gap);
      doc.text(lines, MARGIN, cursorY);
      cursorY += height + gap;
    }
  };

  const tableEndY = (fallback: number): number =>
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;

  /* ---- 1. Header -------------------------------------------------- */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...SLATE_900);
  cursorY += 11;
  doc.text("IELTS Academic Writing — Report", MARGIN, cursorY);
  cursorY += 26;

  const task1Id = selection.task1Id ?? report.task1.itemId;
  const task2Id = selection.task2Id ?? report.task2.itemId;
  const task1Item: Task1Item | null = bank.index.task1ById.get(task1Id) ?? null;
  const task2Item: Task2Item | null = bank.index.task2ById.get(task2Id) ?? null;
  const task1Words = options.submission?.task1?.words ?? report.task1.words;
  const task2Words = options.submission?.task2?.words ?? report.task2.words;
  const bankVersion = report.bankVersion || bank.manifest.version;

  const meta = [
    `Generated ${formatDate(report.generatedAt)} · Bank v${bankVersion} · Overall band ${formatBand(report.overallBand)}`,
    `Task 1 ${task1Id} · ${task1Words} words      Task 2 ${task2Id} · ${task2Words} words`,
    options.minutesUsed === undefined
      ? `${task1Words + task2Words} words submitted in total`
      : `${options.minutesUsed} of 60 minutes used · ${task1Words + task2Words} words submitted in total`,
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  for (const line of meta) {
    doc.text(line, MARGIN, cursorY);
    cursorY += 12;
  }
  cursorY += 6;

  /* ---- 2. Score bands table --------------------------------------- */

  const bandsFor = (grade: TaskGrade): Map<Criterion, number> =>
    new Map(grade.criteria.map((entry) => [entry.criterion, entry.band]));
  const task1Bands = bandsFor(report.task1);
  const task2Bands = bandsFor(report.task2);
  const bandCell = (bands: Map<Criterion, number>, criterion: Criterion): string => {
    const band = bands.get(criterion);
    return band === undefined ? "—" : formatBand(band);
  };

  autoTable(doc, {
    startY: cursorY,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: FOOTER_RESERVE },
    theme: "grid",
    head: [["Task", ...CRITERIA, "Overall"]],
    body: [
      [
        "Task 1",
        ...CRITERIA.map((criterion) => bandCell(task1Bands, criterion)),
        formatBand(report.task1.overallBand),
      ],
      [
        "Task 2",
        ...CRITERIA.map((criterion) => bandCell(task2Bands, criterion)),
        formatBand(report.task2.overallBand),
      ],
      [
        { content: "Overall writing — (T1 + 2 × T2) ÷ 3", colSpan: 6, styles: { halign: "right", fontStyle: "bold" } },
        { content: formatBand(report.overallBand), styles: { fontStyle: "bold" } },
      ],
    ],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: SLATE_700,
      lineColor: SLATE_200,
      lineWidth: 0.5,
    },
    headStyles: { fillColor: HEAD_FILL, textColor: 255, halign: "center" },
    bodyStyles: { halign: "center" },
    columnStyles: { 0: { halign: "left", cellWidth: 150 }, 6: { cellWidth: 70 } },
  });
  cursorY = tableEndY(cursorY) + 4;

  /* ---- 3. Submitted answers --------------------------------------- */

  const answerParagraph = (taskNumber: 1 | 2, text: string | undefined): void => {
    const trimmed = text?.trim() ?? "";
    if (trimmed) {
      paragraph(trimmed);
      return;
    }
    paragraph(`No answer text was recorded for Task ${taskNumber}.`, {
      style: "italic",
      color: SLATE_500,
    });
  };

  heading("1. Your Task 1 answer");
  answerParagraph(1, options.submission?.task1?.text);

  heading("2. Your Task 2 answer");
  answerParagraph(2, options.submission?.task2?.text);

  /* ---- 4. Feedback highlights ------------------------------------- */

  heading("3. Feedback highlights (top 5)");
  const feedback = topFeedback(report);
  if (feedback.length === 0) {
    paragraph("No feedback items were produced — the rubric found nothing to flag.", {
      style: "italic",
      color: SLATE_500,
    });
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: FOOTER_RESERVE },
      theme: "grid",
      head: [["#", "Criterion", "Coaching note", "Quote from your answer"]],
      body: feedback.map((item, index) => [
        String(index + 1),
        `${item.criterion} · band ${formatBand(item.band)}`,
        item.fixSuggestion ? `${item.feedbackStarter} ${item.fixSuggestion}` : item.feedbackStarter,
        `“${trimText(item.evidenceSpan?.text ?? "", 120)}”`,
      ]),
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 5,
        textColor: SLATE_700,
        lineColor: SLATE_200,
        lineWidth: 0.5,
        valign: "top",
      },
      headStyles: { fillColor: HEAD_FILL, textColor: 255 },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" },
        1: { cellWidth: 66 },
        2: { cellWidth: 186 },
        3: { fontStyle: "italic", textColor: SLATE_500 },
      },
      alternateRowStyles: { fillColor: SLATE_50 },
    });
    cursorY = tableEndY(cursorY) + 4;
  }

  /* ---- 5. Band 8 model answers ------------------------------------ */

  heading("4. Band 8 model answers");

  const task1Model = task1Item?.referenceAnswers.find((answer) => answer.band === 8) ?? null;
  const task2Model = task2Item?.referenceAnswers.find((answer) => answer.band === 8) ?? null;

  subHeading("Task 1 — Band 8 model answer");
  if (!task1Model) {
    paragraph("The bank does not include a Band 8 answer for this Task 1 prompt.", {
      style: "italic",
      color: SLATE_500,
    });
  } else {
    if (task1Item) {
      paragraph(task1Item.statement, { size: 8.5, style: "italic", color: SLATE_500, gap: 10 });
    }
    paragraph(task1Model.text);
    const why =
      task1Model.defectProfile.length > 0 ? task1Model.defectProfile.join(" ") : task1Model.feedbackStarter.text;
    paragraph(`Why this is band 8: ${trimText(why, 210)}`, {
      size: 9,
      style: "italic",
      color: SLATE_500,
      gap: 16,
    });
  }

  subHeading("Task 2 — Band 8 model answer");
  if (!task2Model) {
    paragraph("The bank does not include a Band 8 answer for this Task 2 prompt.", {
      style: "italic",
      color: SLATE_500,
    });
  } else {
    if (task2Item) {
      paragraph(task2Item.statement, { size: 8.5, style: "italic", color: SLATE_500, gap: 10 });
    }
    paragraph(task2Model.text);
    paragraph(`Why this is band 8: ${trimText(task2Model.whyBand, 210)}`, {
      size: 9,
      style: "italic",
      color: SLATE_500,
      gap: 16,
    });
  }

  /* ---- 6. Footer on every page ------------------------------------ */

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_500);
    doc.text(DISCLAIMER, MARGIN, pageHeight - 30);
    doc.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, pageHeight - 30, { align: "right" });
  }

  return doc;
}

interface ParagraphOptions {
  size?: number;
  color?: [number, number, number];
  style?: "normal" | "bold" | "italic" | "bolditalic";
  gap?: number;
}
