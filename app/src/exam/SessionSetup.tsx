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

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_TASK_ORDER,
  TASK1_TYPES,
  TASK1_TYPE_LABELS,
  TASK2_FAMILIES,
  TASK2_FAMILY_LABELS,
} from "../constants";
import { resolveSamples } from "../data/samples";
import { loadSetupPrefs, patchSetupPrefs } from "../store/persistence";
import type { Task1Type, Task2Family } from "../types/bank";
import type { TaskOrder } from "../types/session";
import { useSession } from "./useSession";

function pick<T>(list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

export function SessionSetup() {
  const { bank, actions } = useSession();
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

  return (
    <main className="min-h-screen bg-stone-100" data-testid="setup-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Hero: everything a learner needs to start. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/60 sm:p-6 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                IELTS Academic Writing
              </p>
              <span
                data-testid="mode-badge"
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900"
              >
                Computer-based • same editor, same clock
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              You've got this — 60 minutes, 2 tasks
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Pick a chart + essay, then write — the timer runs 60:00 as a hard stop, and 20/40 is just a guide.
              Take a breath first; the clock only starts when you&rsquo;re ready.
            </p>
            <p
              data-testid="order-tip"
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"
            >
              <span className="font-semibold">Tip:</span> many teachers start with Task 2 — it carries more marks.
              Either order works; the clock is 60:00 either way.
            </p>
          </div>

          <div className="mt-5 lg:mt-0">
            <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
              <SummaryRow
                label="Order"
                value={task2Order === "t2-first" ? "Task 2 → Task 1" : "Task 1 → Task 2"}
              />
              <SummaryRow label="Clock" value="60:00 hard stop · 20/40 just a guide" />
              <SummaryRow
                label="Task 1"
                value={task1Item ? `${TASK1_TYPE_LABELS[task1Type]} · ${task1Item.topic}` : "—"}
              />
              <SummaryRow
                label="Task 2"
                value={task2Item ? `${TASK2_FAMILY_LABELS[task2Family]} · ${task2Item.topic}` : "—"}
              />
            </dl>

            <button
              type="button"
              data-testid="start-session"
              onClick={handleStart}
              disabled={!task1Item || !task2Item}
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Start 60-minute session
            </button>
            <button
              type="button"
              data-testid="random-prompts"
              onClick={handleRandom}
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-amber-300 hover:bg-amber-50/60 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Random prompts
            </button>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">
              It saves as you go in this browser — reload and you'll land right back here, mid-session.
            </p>
          </div>
        </section>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-900">Want to swap in your own prompts?</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Optional — a solid pair is already loaded. Open a section to change the chart, the essay family or
            the order, and your choices are remembered next time.
          </p>

          <div className="mt-3 space-y-3">
            <Disclosure
              testId="setup-task1-details"
              title="Task 1 — chart report"
              hint={`${bank.validation.stats.perType[task1Type] ?? 0} prompts to pick from`}
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
              title="Task 2 — essay"
              hint={`${bank.validation.stats.perFamily[task2Family] ?? 0} essays in this family`}
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

            <Disclosure testId="setup-order-details" title="Task order" hint="either way works">
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
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                Either order works — the clock stays 60:00 total.
              </p>
            </Disclosure>

            <Disclosure
              testId="setup-demo-details"
              title="Demo samples"
              hint={`${demoSamples.length} ready-made submissions`}
            >
              <p className="text-xs leading-5 text-slate-500">
                In a hurry? Skip the clock and open a finished report. Each sample is built from the practice
                bank&rsquo;s own model answers, so you can see how caps, evidence spans and the B6/B7/B8 tabs read
                on a real submission.
              </p>
              {demoSamples.length === 0 ? (
                <p className="mt-2 text-xs text-amber-800">
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
                        className="h-full w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      >
                        <span className="block text-sm font-semibold text-slate-900">{sample.definition.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {sample.definition.summary}
                        </span>
                        <span className="mt-1.5 block text-[11px] leading-5 text-amber-800">
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

/** Collapsed-by-default disclosure used for every optional picker. */
function Disclosure({
  testId,
  title,
  hint,
  children,
}: {
  testId: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <details
      data-testid={testId}
      className="group rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold text-slate-900">{title}</span>
        <span className="ml-auto flex items-center gap-2">
          {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
          <ChevronIcon />
        </span>
      </summary>
      <div className="border-t border-slate-100 p-4">{children}</div>
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
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        id={inputId}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
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
    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm leading-6 text-slate-800">{statement}</p>
      {instruction && (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{instruction}</p>
      )}
      <p className="mt-2 text-[11px] text-slate-500">{meta.filter(Boolean).join(" · ")}</p>
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
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-slate-900 ${
        checked ? "border-amber-400 bg-amber-50/70" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        type="radio"
        name="task-order"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 accent-amber-600"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span>
      </span>
    </label>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180 group-open:text-amber-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-slate-800" title={value}>
        {value}
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
