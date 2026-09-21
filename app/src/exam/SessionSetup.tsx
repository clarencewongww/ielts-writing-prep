/**
 * Setup screen (CBT only).
 *
 * The hero card is the whole start flow: the mode is fixed to computer-based,
 * the chosen prompts and order are summarised and Start + Random prompts sit
 * above the fold on both desktop and mobile. The prompt pickers live in
 * collapsed <details> disclosures underneath, so the screen stays quiet until
 * the learner asks to customise it.
 *
 * No bank version line is rendered anywhere learner-facing: `bankLoader` still
 * logs the verified version to the console and fails loudly on a manifest
 * mismatch, which is where that bookkeeping belongs.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_TASK_ORDER,
  TASK1_TYPES,
  TASK1_TYPE_LABELS,
  TASK2_FAMILIES,
  TASK2_FAMILY_LABELS,
} from "../constants";
import { resolveSamples } from "../data/samples";
import { useInstallPrompt } from "../pwa";
import { loadSetupPrefs, patchSetupPrefs } from "../store/persistence";
import type { Task1Type, Task2Family } from "../types/bank";
import type { TaskOrder } from "../types/session";
import { ThemeToggle } from "./ThemeToggle";
import { useSession } from "./useSession";

function pick<T>(list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

/** The three optional disclosures the summary rail can jump to. */
type SetupSection = "task1" | "task2" | "order";

/** Each summary Edit button focuses the first real control of its section.
 *  Radio order is special-cased: the checked option is unique, but a combined
 *  selector list would return the first radio in DOM order (t1-first) instead. */
const SECTION_CONTROL_SELECTOR: Record<"task1" | "task2", string> = {
  task1: "#setup-task1-type",
  task2: "#setup-task2-family",
};

export function SessionSetup() {
  const { bank, actions } = useSession();
  /* Chrome/Edge deferred install event. Hidden when unavailable or already
     running standalone; `pwa.ts` keeps the browser mini-infobar suppressed, so
     this button is the discoverable install path. */
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt();
  const [initialPrefs] = useState(() => loadSetupPrefs());

  const [task1Type, setTask1Type] = useState<Task1Type>(() => {
    const stored = initialPrefs?.task1Type;
    return stored && (TASK1_TYPES as readonly string[]).includes(stored) ? (stored as Task1Type) : "line";
  });
  const [task1Id, setTask1Id] = useState<string | undefined>(initialPrefs?.task1Id);
  const [task2Family, setTask2Family] = useState<Task2Family>(() => {
    const stored = initialPrefs?.task2Family;
    return stored && (TASK2_FAMILIES as readonly string[]).includes(stored)
      ? (stored as Task2Family)
      : "opinion";
  });
  const [task2Id, setTask2Id] = useState<string | undefined>(initialPrefs?.task2Id);
  /* CBT-only default: Task 1 first, unless this browser already stored a preference. */
  const [task2Order, setTask2Order] = useState<TaskOrder>(() =>
    initialPrefs?.task2Order === "t2-first" ? "t2-first" : DEFAULT_TASK_ORDER,
  );

  const demoSamples = useMemo(() => resolveSamples(bank), [bank]);
  const task1Items = bank.index.task1ByType.get(task1Type) ?? [];
  const task2Items = bank.index.task2ByFamily.get(task2Family) ?? [];
  const task1Item = task1Items.find((item) => item.specId === task1Id) ?? task1Items[0] ?? null;
  const task2Item = task2Items.find((item) => item.promptId === task2Id) ?? task2Items[0] ?? null;

  /* Remember the form state so a reload lands back on the same choices. */
  useEffect(() => {
    patchSetupPrefs({
      mode: "computer",
      task1Type,
      task1Id: task1Item?.specId,
      task2Family,
      task2Id: task2Item?.promptId,
      task2Order,
    });
  }, [task1Type, task1Item?.specId, task2Family, task2Item?.promptId, task2Order]);

  const handleStart = () => {
    if (!task1Item || !task2Item) return;
    actions.start({ task1Id: task1Item.specId, task2Id: task2Item.promptId, task2Order });
  };

  const handleRandom = () => {
    const nextType = pick(TASK1_TYPES);
    if (nextType) {
      setTask1Type(nextType);
      setTask1Id(pick(bank.index.task1ByType.get(nextType) ?? [])?.specId);
    }
    const nextFamily = pick(TASK2_FAMILIES);
    if (nextFamily) {
      setTask2Family(nextFamily);
      setTask2Id(pick(bank.index.task2ByFamily.get(nextFamily) ?? [])?.promptId);
    }
  };

  /* Summary rail → disclosure jump. The <details> elements stay uncontrolled, so
     opening one from the rail is a direct DOM write; no state is persisted here. */
  const [highlightedSection, setHighlightedSection] = useState<SetupSection | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);

  const clearHighlight = () => {
    window.clearTimeout(highlightTimer.current);
    setHighlightedSection(null);
  };

  const editSection = (section: SetupSection) => {
    const details = document.querySelector<HTMLDetailsElement>(`details[data-section="${section}"]`);
    if (!details) return;

    details.open = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    details.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

    const control =
      section === "order"
        ? (details.querySelector<HTMLInputElement>('input[name="task-order"]:checked') ??
          details.querySelector<HTMLInputElement>('input[name="task-order"][value="t1-first"]'))
        : details.querySelector<HTMLElement>(SECTION_CONTROL_SELECTOR[section]);
    /* preventScroll keeps the smooth scroll running instead of snapping to the control. */
    control?.focus({ preventScroll: true });

    setHighlightedSection(section);
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightedSection(null), 1600);
  };

  return (
    <main className="min-h-screen bg-surface" data-testid="setup-screen">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
        {/* Hero: everything a learner needs to start.
            Phone source order is heading → summary + Start → tip, so the primary action
            stays above the fold; on lg the tip drops under the heading (col 1) while the
            summary rail stays in column 2. The header row spans both columns so the
            appearance toggle sits at the card's top-right corner on every width.
            Apple check (layout.md › Visual hierarchy): one prominent button in the view;
            style — not size — carries the preference (buttons.md › Style). */}
        <section className="grid min-w-0 gap-5 rounded-card border border-line bg-content p-5 shadow-card sm:p-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-x-12">
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:col-span-2 lg:row-start-1">
            <p className="text-caption font-semibold uppercase tracking-[0.22em] text-ink-2">
              IELTS Academic Writing
            </p>
            <span
              data-testid="mode-badge"
              className="rounded-full bg-tint-soft px-2.5 py-1 text-caption font-medium text-tint-strong"
            >
              Computer-based • same editor, same clock
            </span>
            <div className="ml-auto shrink-0">
              <ThemeToggle />
            </div>
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <h1 className="text-[1.75rem] font-semibold leading-8 tracking-[-0.02em] text-ink sm:text-display lg:text-display-lg">
              You&rsquo;ve got this — 60 minutes, 2&nbsp;tasks
            </h1>
            <p className="mt-3 max-w-xl text-body text-ink-2 [@media(max-width:359px)]:line-clamp-4">
              Pick a chart + essay, then write — the timer runs 60:00 as a hard stop, and 20/40 is just a guide.
              Take a breath first; the clock only starts when you&rsquo;re ready.
            </p>
          </div>

          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-2">
            <dl className="grid min-w-0 gap-2.5 text-footnote sm:grid-cols-2 lg:grid-cols-1">
              <SummaryRow
                label="Order"
                value={task2Order === "t2-first" ? "Task 2 → Task 1" : "Task 1 → Task 2"}
                onEdit={() => editSection("order")}
                editLabel="Edit task order"
              />
              <SummaryRow label="Clock" value="60:00 hard stop · 20/40 just a guide" caption="Fixed" />
              <SummaryRow
                label="Task 1"
                value={task1Item ? `${TASK1_TYPE_LABELS[task1Type]} · ${task1Item.topic}` : "—"}
                onEdit={() => editSection("task1")}
                editLabel="Edit Task 1"
              />
              <SummaryRow
                label="Task 2"
                value={task2Item ? `${TASK2_FAMILY_LABELS[task2Family]} · ${task2Item.topic}` : "—"}
                onEdit={() => editSection("task2")}
                editLabel="Edit Task 2"
              />
            </dl>

            {/* Hit region 44px (accessibility.md › Mobility: default 44x44 pt);
                full-width inside the card, never stretched across the layout. */}
            <button
              type="button"
              data-testid="start-session"
              onClick={handleStart}
              disabled={!task1Item || !task2Item}
              className="mt-5 min-h-[44px] w-full rounded-full bg-tint-fill px-5 text-headline font-semibold text-white shadow-sm transition-colors ease-apple hover:bg-tint-strong focus-visible:outline-tint disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink-3 disabled:shadow-none"
            >
              Start 60-minute session
            </button>
            {/* Random + Install share one wrapping row: at 320 px each falls onto
                its own line (grow), from 390 px they sit side by side. */}
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              <button
                type="button"
                data-testid="random-prompts"
                onClick={handleRandom}
                className="min-h-[44px] min-w-0 grow basis-40 rounded-full border border-line px-5 text-subhead font-medium text-ink transition-colors ease-apple hover:bg-surface focus-visible:outline-tint"
              >
                Random prompts
              </button>
              {canInstall && !isStandalone && (
                <button
                  type="button"
                  data-testid="install-app"
                  onClick={() => void promptInstall()}
                  className="min-h-[44px] min-w-0 grow basis-32 rounded-full border border-line px-5 text-subhead font-medium text-ink transition-colors ease-apple hover:bg-surface focus-visible:outline-tint"
                >
                  Install app
                </button>
              )}
            </div>
            <p className="mt-3 text-caption leading-5 text-ink-2">
              It saves as you go in this browser — reload and you&rsquo;ll land right back here, mid-session.
            </p>
          </div>

          <div className="min-w-0 lg:col-start-1 lg:row-start-3">
            {/* Advice, not a warning: neutral surface with an accent glyph, so amber
                stays reserved for warnings and score caps (color.md › Best practices). */}
            <p
              data-testid="order-tip"
              className="rounded-control bg-surface px-4 py-3 text-footnote leading-5 text-ink-2"
            >
              <span className="text-tint" aria-hidden="true">
                ⓘ{" "}
              </span>
              <span className="font-semibold text-ink">Tip:</span> many teachers start with Task 2 — it carries
              more marks. Either order works; the clock is 60:00 either way.
            </p>
          </div>
        </section>

        <div className="mt-8">
          <h2 className="text-headline font-semibold text-ink">Want to swap in your own prompts?</h2>
          <p className="mt-1 text-footnote leading-5 text-ink-2">
            Optional — a solid pair is already loaded. Open a section to change the chart, the essay family or
            the order, and your choices are remembered next time.
          </p>

          <div className="mt-3 space-y-3">
            <Disclosure
              testId="setup-task1-details"
              section="task1"
              title="Task 1 — chart report"
              hint={`${bank.validation.stats.perType[task1Type] ?? 0} prompts to pick from`}
              highlighted={highlightedSection === "task1"}
              onDismissHighlight={clearHighlight}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  name="task1-type"
                  label="Chart type"
                  value={task1Type}
                  onChange={(value) => {
                    setTask1Type(value as Task1Type);
                    setTask1Id(undefined);
                  }}
                  options={TASK1_TYPES.map((type) => ({ value: type, label: TASK1_TYPE_LABELS[type] }))}
                />
                <Select
                  name="task1-item"
                  label="Prompt"
                  value={task1Item?.specId ?? ""}
                  onChange={setTask1Id}
                  options={task1Items.map((item) => ({
                    value: item.specId,
                    label: `${item.specId} — ${item.topic}`,
                  }))}
                />
              </div>
              {task1Item && (
                <Preview
                  statement={task1Item.statement}
                  meta={[
                    formatYears(task1Item.timeFrame.values),
                    task1Item.categories.slice(0, 4).join(", ") + (task1Item.categories.length > 4 ? "…" : ""),
                  ]}
                />
              )}
            </Disclosure>

            <Disclosure
              testId="setup-task2-details"
              section="task2"
              title="Task 2 — essay"
              hint={`${bank.validation.stats.perFamily[task2Family] ?? 0} essays in this family`}
              highlighted={highlightedSection === "task2"}
              onDismissHighlight={clearHighlight}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  name="task2-family"
                  label="Family"
                  value={task2Family}
                  onChange={(value) => {
                    setTask2Family(value as Task2Family);
                    setTask2Id(undefined);
                  }}
                  options={TASK2_FAMILIES.map((family) => ({ value: family, label: TASK2_FAMILY_LABELS[family] }))}
                />
                <Select
                  name="task2-item"
                  label="Prompt"
                  value={task2Item?.promptId ?? ""}
                  onChange={setTask2Id}
                  options={task2Items.map((item) => ({
                    value: item.promptId,
                    label: `${item.promptId} — ${item.topic}`,
                  }))}
                />
              </div>
              {task2Item && (
                <Preview
                  statement={task2Item.statement}
                  instruction={task2Item.instruction}
                  meta={[task2Item.opinionRequired ? "your view is required" : "no verdict needed"]}
                />
              )}
            </Disclosure>

            <Disclosure
              testId="setup-order-details"
              section="order"
              title="Task order"
              hint="either way works"
              highlighted={highlightedSection === "order"}
              onDismissHighlight={clearHighlight}
            >
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Task order">
                <OrderOption
                  value="t1-first"
                  checked={task2Order === "t1-first"}
                  onChange={() => setTask2Order("t1-first")}
                  title="Task 1 first — 20 min"
                  detail="Warm up on the chart report, then settle into the essay."
                />
                <OrderOption
                  value="t2-first"
                  checked={task2Order === "t2-first"}
                  onChange={() => setTask2Order("t2-first")}
                  title="Task 2 first — 40 min"
                  detail="The essay carries more marks; many teachers start here."
                />
              </div>
              <p className="mt-2 text-caption leading-5 text-ink-2">
                Either order works — the clock stays 60:00 total.
              </p>
            </Disclosure>

            <Disclosure
              testId="setup-demo-details"
              section="demo"
              title="Demo samples"
              hint={`${demoSamples.length} ready-made submissions`}
            >
              <p className="text-footnote leading-5 text-ink-2">
                In a hurry? Skip the clock and open a finished report. Each sample is built from the practice
                bank&rsquo;s own model answers, so you can see how caps, evidence spans and the B6/B7/B8 tabs read
                on a real submission.
              </p>
              {demoSamples.length === 0 ? (
                <p className="mt-2 text-footnote text-warn">
                  Demo samples aren&rsquo;t available with the current question bank.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {demoSamples.map((sample) => (
                    <li key={sample.definition.id}>
                      <button
                        type="button"
                        data-testid={`demo-${sample.definition.id}`}
                        onClick={() => actions.loadSample(sample.selection, sample.texts)}
                        className="h-full w-full rounded-control border border-line p-3.5 text-left transition-colors ease-apple hover:border-tint/40 hover:bg-tint-soft/50 focus-visible:outline-tint"
                      >
                        <span className="block text-subhead font-semibold text-ink">{sample.definition.label}</span>
                        <span className="mt-0.5 block text-caption leading-5 text-ink-2">
                          {sample.definition.summary}
                        </span>
                        <span className="mt-1.5 block text-caption leading-5 text-tint-strong">
                          {humanizeExpectation(sample.definition.expectation)} ·{" "}
                          {sample.words.task1 + sample.words.task2} words together
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Disclosure>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Collapsed-by-default disclosure used for every optional picker.
 *  Progressive disclosure instead of density (layout.md › Best practices).
 *  When a section is jumped to from the summary rail, the card flashes a tint
 *  ring (timeout) and the ring clears as soon as focus leaves the card. */
function Disclosure({
  testId,
  title,
  hint,
  section,
  highlighted = false,
  onDismissHighlight,
  children,
}: {
  testId: string;
  title: string;
  hint?: string;
  /** Marker + jump target id ("demo" is marked for consistency only). */
  section?: string;
  highlighted?: boolean;
  onDismissHighlight?: () => void;
  children: ReactNode;
}) {
  return (
    <details
      data-testid={testId}
      data-section={section}
      onBlur={
        onDismissHighlight
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                onDismissHighlight();
              }
            }
          : undefined
      }
      className={`group scroll-mt-4 rounded-card border border-line bg-content shadow-card ${
        highlighted ? "ring-2 ring-tint" : ""
      }`}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-card p-4 transition-colors ease-apple hover:bg-surface focus-visible:outline-tint [&::-webkit-details-marker]:hidden">
        <span className="text-headline font-semibold text-ink">{title}</span>
        <span className="ml-auto flex min-w-0 items-center gap-2">
          {hint && <span className="text-caption text-ink-2">{hint}</span>}
          <ChevronIcon />
        </span>
      </summary>
      <div className="border-t border-line-soft p-4">{children}</div>
    </details>
  );
}

function Select({
  name,
  label,
  value,
  onChange,
  options,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const inputId = `setup-${name}`;
  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-footnote font-medium text-ink-2">{label}</span>
      {/* 44px tall on touch; 10px control radius matches the system feel
          (text-fields.md › Best practices: label + hint, sensible tab order). */}
      <select
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-[44px] w-full rounded-control border border-line bg-content px-3 text-subhead text-ink outline-none transition-colors ease-apple focus:border-tint focus:ring-4 focus:ring-tint/15 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Preview({
  statement,
  instruction,
  meta,
}: {
  statement: string;
  instruction?: string;
  meta: string[];
}) {
  return (
    <div className="mt-3 rounded-control bg-surface p-3.5">
      <p className="text-subhead leading-6 text-ink">{statement}</p>
      {instruction && (
        <p className="mt-2 text-subhead font-semibold leading-6 text-ink">{instruction}</p>
      )}
      <p className="mt-2 text-caption text-ink-2">{meta.filter(Boolean).join(" · ")}</p>
    </div>
  );
}

function OrderOption({
  value,
  checked,
  onChange,
  title,
  detail,
}: {
  value: TaskOrder;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors ease-apple has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tint ${
        checked ? "border-tint bg-tint-soft" : "border-line hover:bg-surface"
      }`}
    >
      <input
        type="radio"
        name="task-order"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-tint"
      />
      <span>
        <span className="block text-subhead font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-footnote leading-5 text-ink-2">{detail}</span>
      </span>
    </label>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-ink-3 transition-transform ease-apple group-open:rotate-180 group-open:text-tint"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummaryRow({
  label,
  value,
  caption,
  onEdit,
  editLabel,
}: {
  label: string;
  value: string;
  caption?: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    /* Phone: label stays inline with the value so long topics wrap instead of
       truncating; from sm the label becomes a w-16 column with an ellipsis value.
       The Edit button and Fixed caption sit *inside* the <dd>: a <dl> wrapper may
       only contain dt/dd children, and axe's definition-list rule flags any other
       element there. */
    <div className="flex min-w-0 items-baseline gap-2 border-b border-line-soft pb-2 last:border-0 last:pb-0 sm:gap-3">
      <dt className="shrink-0 font-medium text-ink-2 sm:w-16">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-baseline gap-2 text-ink sm:gap-3">
        <span className="min-w-0 flex-1 sm:truncate" title={value}>
          {value}
        </span>
        {onEdit && (
          /* Quiet text link. The after: pseudo-element lifts the touch target to
             44px (accessibility.md › Mobility) without growing the summary row. */
          <button
            type="button"
            onClick={onEdit}
            aria-label={editLabel}
            className="relative -my-1 shrink-0 rounded-control px-1.5 py-1.5 text-caption font-medium text-tint transition-colors ease-apple hover:text-tint-strong hover:underline focus-visible:outline-tint after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']"
          >
            Edit
          </button>
        )}
        {caption && (
          <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-caption font-medium text-ink-2">
            {caption}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Turns grader shorthand ("T1 TA/CC capped at 5") into learner wording ("Task 1 ..."). */
function humanizeExpectation(expectation: string): string {
  return expectation.replace(/\bT([12])\b/g, "Task $1");
}

function formatYears(values: number[] | undefined): string {
  if (!values || values.length === 0) return "no dates";
  if (values.length === 1) return String(values[0]);
  return `${values[0]}–${values[values.length - 1]}`;
}
