/**
 * App shell.
 *
 * Boots the bank (fetch from `public/bank`, dynamic-import fallback), then switches on
 * the session status: setup -> SessionSetup, in-progress -> ExamScreen,
 * submitted/graded -> ReportScreen. When the session reaches `submitted`, the report
 * is built once here (Task 1 grader injected, Task 2 graded by the report module),
 * persisted through `actions.markGraded(report)` and re-rendered from storage after
 * a reload — caps included.
 */

import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { BankLoadError, loadBank, type BankData } from "./data/bankLoader";
import { ExamScreen } from "./exam/ExamScreen";
import { SessionProvider } from "./exam/SessionProvider";
import { SessionSetup } from "./exam/SessionSetup";
import { useSession } from "./exam/useSession";
import { gradeTask1 } from "./grading/task1";
import { gradeTask2 } from "./grading/task2";
import { buildGradingReport, toTaskGrade } from "./grading/scorer";
import { ReportScreen } from "./report/ReportScreen";
import { clearSessionKeys } from "./store/persistence";
import { emptySubmission } from "./types/session";
import type { GradingReport } from "./types/grading";

type BankState =
  | { status: "loading" }
  | { status: "ready"; bank: BankData }
  | { status: "error"; message: string; details: string[] };

function useBankLoad(): { state: BankState; retry: () => void } {
  const [state, setState] = useState<BankState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadBank()
      .then((bank) => {
        if (cancelled) return;
        if (!bank.validation.ok) {
          setState({
            status: "error",
            message: "The question bank failed validation.",
            details: bank.validation.errors,
          });
          return;
        }
        setState({ status: "ready", bank });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
          details: error instanceof BankLoadError ? error.details : [],
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}

export default function App() {
  const { state, retry } = useBankLoad();

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "error") {
    return <BankErrorScreen message={state.message} details={state.details} onRetry={retry} />;
  }

  return (
    <SessionProvider bank={state.bank}>
      <ErrorBoundary>
        <AppShell />
      </ErrorBoundary>
    </SessionProvider>
  );
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Keeps a render crash from blanking the page; offers a clean-slate reload. */
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[app] render error:", error, info.componentStack);
  }

  private readonly handleReset = () => {
    clearSessionKeys();
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    /* Failures stay in the interface, in the interface's voice: what happened and
       how to recover (feedback.md › Best practices; writing.md). */
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-4" data-testid="app-crash">
        <div className="w-full max-w-lg rounded-card border border-line bg-content p-6 shadow-card">
          <h1 className="text-headline font-semibold text-danger">Something went wrong</h1>
          <p className="mt-1 text-subhead text-ink-2">
            The screen crashed unexpectedly. Resetting clears the saved session and returns to setup.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-control bg-danger-soft p-3 text-caption leading-5 text-danger">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 min-h-[44px] rounded-full bg-tint-fill px-5 text-subhead font-semibold text-white transition-colors ease-apple hover:bg-tint-strong focus-visible:outline-tint"
          >
            Reset and reload
          </button>
        </div>
      </div>
    );
  }
}

function AppShell() {
  const { state } = useSession();
  if (state.status === "setup") return <SessionSetup />;
  if (state.status === "in-progress") return <ExamScreen />;
  return <GradedReport />;
}

/**
 * `submitted` / `graded` view.
 *
 * Builds the report from the frozen submission (Task 1 via the injected grader,
 * Task 2 via `gradeTask2`), stores it on the session and then renders
 * `ReportScreen`. The stored report wins on later renders, so the bands the
 * candidate saw stay stable even if the grader changes mid-session.
 */
function GradedReport() {
  const { state, bank, task1Item, task2Item, actions } = useSession();

  const report = useMemo<GradingReport | null>(() => {
    if (state.report) return state.report;
    const submission = state.submission;
    if (!submission?.task1 || !submission?.task2) return null;
    if (!task1Item || !task2Item) return null;
    return buildGradingReport({
      bankVersion: bank.manifest.version,
      task1: toTaskGrade(gradeTask1(task1Item, submission.task1.text)),
      task2: toTaskGrade(gradeTask2(task2Item, submission.task2.text)),
    });
  }, [state.report, state.submission, task1Item, task2Item, bank.manifest.version]);

  useEffect(() => {
    if (state.status === "submitted") actions.markGraded(report ?? undefined);
  }, [state.status, report, actions]);

  return (
    <ReportScreen
      bank={bank}
      submission={state.submission ?? emptySubmission()}
      selection={state.selection}
      report={report}
      gradeTask1={gradeTask1}
      onRestart={actions.reset}
      minutesUsed={Math.round(state.elapsedMs / 60_000)}
    />
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface" data-testid="bank-loading">
      <div className="flex items-center gap-3 text-subhead text-ink-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" />
        Loading question bank…
      </div>
    </div>
  );
}

function BankErrorScreen({
  message,
  details,
  onRetry,
}: {
  message: string;
  details: string[];
  onRetry: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-4" data-testid="bank-error">
      <div className="w-full max-w-lg rounded-card border border-line bg-content p-6 shadow-card">
        <h1 className="text-headline font-semibold text-danger">Question bank unavailable</h1>
        <p className="mt-1 text-subhead text-ink-2">{message}</p>
        {details.length > 0 && (
          <ul className="mt-3 max-h-56 list-disc space-y-1 overflow-y-auto rounded-control bg-danger-soft p-3 pl-7 text-caption leading-5 text-danger">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-[44px] rounded-full bg-tint-fill px-5 text-subhead font-semibold text-white transition-colors ease-apple hover:bg-tint-strong focus-visible:outline-tint"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
