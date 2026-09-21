/**
 * Report screen: score summary, per-criterion feedback with highlighted evidence
 * spans, deterministic checks and the bank's B6/B7/B8 model answers.
 *
 * Integration contract (Step 5 wiring):
 *   <ReportScreen bank={bank} submission={state.submission ?? empty} selection={state.selection}
 *                 gradeTask1={gradeTask1} onRestart={actions.reset} />
 * `report` may be supplied when a persisted `GradingReport` already exists; when
 * it is absent the screen grades Task 2 on the fly with `gradeTask2`. Task 1 is
 * injected through `gradeTask1` so this module never imports 4a's grader directly.
 */

import { useMemo } from "react";
import { CriterionCard } from "./CriterionCard";
import { criterionLabel } from "./CriterionTip";
import { DownloadButton } from "./DownloadButton";
import { EvidenceExcerpt } from "./EvidenceSpan";
import { ReferenceTabs } from "./ReferenceTabs";
import { ScoreSummary, formatBand } from "./ScoreSummary";
import { getTask1Item, getTask2Item, type BankData } from "../data/bankLoader";
import { normalizeFeedbackList, prioritizeFeedback } from "../grading/feedback";
import { gradeTask2, type Task2Grade } from "../grading/task2";
import {
  capsFromGrade,
  overallWritingBand,
  toTaskGrade,
  type CapRecord,
  type TaskGradeLike,
} from "../grading/scorer";
import { cx } from "../tasks/format";
import type { Criterion, TaskGrade } from "../types/grading";
import type { Task1Item, Task2Item } from "../types/bank";
import type { SessionSelection, Submission } from "../types/session";

export interface ReportScreenProps {
  bank: BankData;
  submission: Submission;
  selection: SessionSelection;
  /** Pre-computed report (persisted grade). When absent Task 2 is graded here. */
  report?: import("../types/grading").GradingReport | null;
  /**
   * Task 1 grader injected by the integrator (4a owns `src/grading/task1.ts`).
   * Accepts either `Task1GradeResult` (`scores` + `caps`) or a `TaskGrade`.
   */
  gradeTask1?: (item: Task1Item, text: string) => TaskGradeLike;
  onRestart?: () => void;
  minutesUsed?: number;
}

const CRITERIA: Criterion[] = ["TA", "TR", "CC", "LR", "GRA"];
const TASK2_CRITERIA: Criterion[] = ["TR", "CC", "LR", "GRA"];

export function ReportScreen({
  bank,
  submission,
  selection,
  report = null,
  gradeTask1,
  onRestart,
  minutesUsed,
}: ReportScreenProps) {
  const task1Item = getTask1Item(bank, selection.task1Id);
  const task2Item = getTask2Item(bank, selection.task2Id);
  const text1 = submission.task1?.text ?? "";
  const text2 = submission.task2?.text ?? "";

  const task1Raw = useMemo<TaskGradeLike | null>(() => {
    if (report?.task1) return report.task1;
    if (!gradeTask1 || !task1Item || !submission.task1) return null;
    return gradeTask1(task1Item, text1);
  }, [report, gradeTask1, task1Item, submission.task1, text1]);

  const task2Raw = useMemo<TaskGradeLike | null>(() => {
    if (report?.task2) return report.task2;
    if (!task2Item || !submission.task2) return null;
    return gradeTask2(task2Item, text2);
  }, [report, task2Item, submission.task2, text2]);

  const task1Grade = useMemo<TaskGrade | null>(() => (task1Raw ? toTaskGrade(task1Raw) : null), [task1Raw]);
  const task2Grade = useMemo<TaskGrade | null>(() => (task2Raw ? toTaskGrade(task2Raw) : null), [task2Raw]);
  const task2Detail = task2Raw && task2Raw.task === 2 && "rubricRows" in task2Raw ? (task2Raw as Task2Grade) : null;

  const overallBand =
    report?.overallBand ?? (task1Grade && task2Grade ? overallWritingBand(task1Grade.overallBand, task2Grade.overallBand) : null);

  const caps = useMemo(() => {
    const combined = [...capsFromGrade(task1Raw), ...capsFromGrade(task2Raw)];
    const seen = new Set<string>();
    return combined.filter((cap) => {
      const key = `${cap.checkId}:${cap.criterion}:${cap.cap}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [task1Grade, task2Grade]);

  const task1Feedback = useMemo(
    () => prioritizeFeedback(normalizeFeedbackList(task1Raw?.feedback, text1), { maxPerGate: 1, limit: 8 }),
    [task1Raw, text1],
  );
  const task2Feedback = useMemo(
    () => prioritizeFeedback(normalizeFeedbackList(task2Raw?.feedback, text2), { maxPerGate: 1, limit: 12 }),
    [task2Raw, text2],
  );

  const priorityCandidates = useMemo(() => {
    const list: Array<{ item: ReturnType<typeof prioritizeFeedback>[number]; text: string }> = [
      ...task2Feedback.map((entry) => ({ item: entry, text: text2 })),
      ...task1Feedback.map((entry) => ({ item: entry, text: text1 })),
    ];
    return list.sort((a, b) => severityRank(a.item.severity) - severityRank(b.item.severity));
  }, [task2Feedback, task1Feedback, text2, text1]);
  const priority = priorityCandidates[0] ?? null;

  return (
    <main className="min-h-screen bg-surface" data-testid="report-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:py-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.22em] text-ink-2">Session complete</p>
            <h1 className="mt-1 text-title font-semibold text-ink">
              Nice work — here&rsquo;s your breakdown
            </h1>
            <p className="mt-2 max-w-2xl text-body text-ink-2">
              Both tasks are marked against the band descriptors, and every note quotes the exact sentence it
              came from — the good bits and the fixable ones.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <DownloadButton
              report={report}
              bank={bank}
              submission={submission}
              selection={selection}
              minutesUsed={minutesUsed}
            />
            {onRestart && (
              <button
                type="button"
                data-testid="report-restart"
                onClick={onRestart}
                className="min-h-[44px] rounded-full bg-tint-fill px-5 text-subhead font-semibold text-white shadow-sm transition-colors ease-apple hover:bg-tint-strong focus-visible:outline-tint"
              >
                Start a new session
              </button>
            )}
          </div>
        </header>

        <ScoreSummary
          task1={task1Grade}
          task2={task2Grade}
          overallBand={overallBand}
          caps={caps}
          words={{ task1: submission.task1?.words ?? task1Grade?.words ?? null, task2: submission.task2?.words ?? task2Grade?.words ?? null }}
          minutesUsed={minutesUsed}
        />

        {priority && (
          /* The single "look here first" moment on the report: accent-soft, the
             same tint the evidence highlights use, so the page has one signal. */
          <section
            data-testid="priority-feedback"
            className="rounded-card bg-tint-soft p-5"
          >
            <p className="text-caption font-semibold uppercase tracking-wide text-tint-strong">
              Your quickest win
            </p>
            <p className="mt-1.5 text-subhead leading-6 text-ink">
              <span className="mr-2 rounded bg-tint-fill/10 px-1.5 py-0.5 text-[10px] font-semibold text-tint-strong">
                {criterionLabel(priority.item.criterion)}
              </span>
              {priority.item.feedbackStarter}
            </p>
            <p className="mt-2.5 border-l-2 border-tint/30 pl-2.5 text-footnote leading-6 text-ink-2">
              <EvidenceExcerpt text={priority.text} span={priority.item.evidenceSpan} />
            </p>
          </section>
        )}

        <TaskSection
          title="Task 2"
          subtitle={task2Item ? task2Item.instruction : undefined}
          statement={task2Item?.statement}
          item={task2Item}
          grade={task2Detail}
          text={text2}
          caps={capsFromGrade(task2Raw)}
          feedback={task2Feedback}
          submitted={Boolean(submission.task2)}
          criteria={TASK2_CRITERIA}
          note={
            task2Grade
              ? "Marked just now — rubric bands first, then any score limits."
              : "Submit Task 2 to unlock this half of the report."
          }
        />

        <TaskSection
          title="Task 1"
          subtitle={undefined}
          statement={task1Item?.statement}
          item={task1Item}
          grade={task1Grade}
          text={text1}
          caps={capsFromGrade(task1Raw)}
          feedback={task1Feedback}
          submitted={Boolean(submission.task1)}
          criteria={CRITERIA}
          note={
            task1Grade
              ? "Marked just now with the Task 1 rubric."
              : "Task 1 marking isn't available in this build."
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ReferenceTabs item={task2Item} submission={text2} submissionLabel="Your Task 2" />
          <ReferenceTabs item={task1Item} submission={text1} submissionLabel="Your Task 1" />
        </div>

        <p className="pb-6 text-center text-caption leading-5 text-ink-2">
          Bands come from a deterministic rubric and are indicative — usually within about half a band of an
          examiner. Reference answers recreate reported tasks; this app is not affiliated with IELTS.
        </p>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Task section                                                        */
/* ------------------------------------------------------------------ */

function TaskSection({
  title,
  subtitle,
  statement,
  item,
  grade,
  text,
  caps,
  feedback,
  submitted,
  criteria,
  note,
}: {
  title: string;
  subtitle?: string;
  statement?: string;
  item: Task1Item | Task2Item | null;
  grade: TaskGrade | null;
  text: string;
  caps: CapRecord[];
  feedback: ReturnType<typeof prioritizeFeedback>;
  submitted: boolean;
  criteria: Criterion[];
  note: string;
}) {
  const task2Grade = grade && grade.task === 2 ? (grade as Task2Grade) : null;
  const rawBands = task2Grade
    ? new Map(task2Grade.rawCriteria.map((entry) => [entry.criterion, entry.band]))
    : new Map<Criterion, number>();
  const rubricRows = task2Grade?.rubricRows ?? [];

  return (
    <section data-testid={`task-section-${grade?.task ?? (title.includes("2") ? 2 : 1)}`} className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-title2 font-semibold text-ink">{title}</h2>
          {statement && <p className="mt-1 max-w-3xl text-footnote leading-5 text-ink-2">{statement}</p>}
          {subtitle && <p className="mt-0.5 text-footnote font-medium text-ink">{subtitle}</p>}
        </div>
        <span className="text-footnote tabular-nums text-ink-2">
          {grade ? `band ${formatBand(grade.overallBand)} · ${grade.words} words` : note}
        </span>
      </header>

      {!submitted && (
        <p className="rounded-card border border-dashed border-line bg-content px-4 py-3 text-subhead text-ink-2">
          Nothing was submitted for this task — no marks to show for it this time.
        </p>
      )}

      {submitted && !grade && (
        <p className="rounded-card border border-dashed border-line bg-content px-4 py-3 text-subhead text-ink-2" data-testid="task-ungraded">
          {note}
        </p>
      )}

      {grade && (
        <div className="grid gap-4 lg:grid-cols-2">
          {criteria.map((criterion) => {
            const criterionFeedback = feedback.filter((entry) => entry.criterion === criterion);
            const rows = rubricRows.filter((row) => row.criterion === criterion);
            const raw = rawBands.get(criterion);
            const band = grade.criteria.find((entry) => entry.criterion === criterion)?.band;
            if (band === undefined) return null;
            return (
              <CriterionCard
                key={criterion}
                criterion={criterion}
                band={band}
                rawBand={raw}
                summary={grade.criteria.find((entry) => entry.criterion === criterion)?.summary}
                checks={rows}
                feedback={criterionFeedback}
                submission={text}
                caps={caps.filter((cap) => cap.criterion === criterion)}
              />
            );
          })}
        </div>
      )}

      {grade && grade.checks.length > 0 && (
        <details
          className="rounded-card border border-line bg-content p-4 shadow-card"
          data-testid={`checks-${grade.task}`}
        >
          <summary className="cursor-pointer select-none text-caption font-semibold uppercase tracking-wide text-ink-2 focus-visible:outline-tint">
            Deterministic checks ({grade.checks.filter((check) => !check.passed).length} failed of {grade.checks.length})
          </summary>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {grade.checks.map((check) => (
              <li
                key={check.id}
                className={cx(
                  "flex items-start gap-2 rounded-control px-2.5 py-1.5 text-[11px] leading-5",
                  check.passed ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
                )}
              >
                <span className="font-bold">{check.passed ? "✓" : "×"}</span>
                <span>
                  <span className="font-mono text-[10px] text-ink-2" title={check.label}>
                    {check.id}
                  </span>
                  <span className="block font-medium">{check.label}</span>
                  {check.observed && <span className="block text-ink-2">{check.observed}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!item && submitted && (
        <p className="text-caption text-ink-2">The bank item for this task is missing, so no prompt metadata is shown.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function severityRank(severity: string): number {
  if (severity === "cap") return 0;
  if (severity === "error") return 1;
  return 2;
}
