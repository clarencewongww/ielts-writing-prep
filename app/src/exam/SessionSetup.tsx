/** Setup screen: pick the bank items, the mode and the task order, then start the clock. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  EXAM_MODES,
  TASK1_TYPES,
  TASK1_TYPE_LABELS,
  TASK2_FAMILIES,
  TASK2_FAMILY_LABELS,
} from "../constants";
import { describeBank } from "../data/bankLoader";
import { resolveSamples } from "../data/samples";
import { loadSetupPrefs, patchSetupPrefs } from "../store/persistence";
import type { Task1Type, Task2Family } from "../types/bank";
import type { ExamMode, TaskOrder } from "../types/session";
import { useSession } from "./useSession";

function pick<T>(list: readonly T[]): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
}

export function SessionSetup() {
  const { bank, actions, mode: providerMode } = useSession();
  const [initialPrefs] = useState(() => loadSetupPrefs());

  const [mode, setMode] = useState<ExamMode>(initialPrefs?.mode ?? providerMode ?? "computer");
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
  const [task2Order, setTask2Order] = useState<TaskOrder>(
    initialPrefs?.task2Order === "t1-first" ? "t1-first" : "t2-first",
  );

  const demoSamples = useMemo(() => resolveSamples(bank), [bank]);
  const task1Items = bank.index.task1ByType.get(task1Type) ?? [];
  const task2Items = bank.index.task2ByFamily.get(task2Family) ?? [];
  const task1Item = task1Items.find((item) => item.specId === task1Id) ?? task1Items[0] ?? null;
  const task2Item = task2Items.find((item) => item.promptId === task2Id) ?? task2Items[0] ?? null;

  /* Remember the form state so a reload lands back on the same choices. */
  useEffect(() => {
    patchSetupPrefs({
      mode,
      task1Type,
      task1Id: task1Item?.specId,
      task2Family,
      task2Id: task2Item?.promptId,
      task2Order,
    });
  }, [mode, task1Type, task1Item?.specId, task2Family, task2Item?.promptId, task2Order]);

  const handleStart = () => {
    if (!task1Item || !task2Item) return;
    actions.start(
      { task1Id: task1Item.specId, task2Id: task2Item.promptId, task2Order },
      mode,
    );
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
    <main className="min-h-screen bg-slate-100" data-testid="setup-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              IELTS Academic Writing
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              60-minute simulation
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              One sitting, two tasks, one clock. Pick your prompts, then the timer runs for 60 minutes with a
              hard stop — the 20/40 split is only a recommendation.
            </p>
          </div>
          <div
            data-testid="bank-badge"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-sm"
          >
            {describeBank(bank)}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <Section title="Exam mode" hint="same editor, same clock">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Exam mode">
                {EXAM_MODES.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      mode === option ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="exam-mode"
                      value={option}
                      checked={mode === option}
                      onChange={() => setMode(option)}
                      className="mt-1 accent-slate-900"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {option === "computer" ? "Computer-based" : "Paper practice"}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        {option === "computer"
                          ? "Type straight into the exam editor."
                          : "Same on-screen editor; plan on paper if you prefer."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Task 1 — chart report" hint={`${bank.validation.stats.perType[task1Type] ?? 0} items in this type`}>
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
            </Section>

            <Section title="Task 2 — essay" hint={`${bank.validation.stats.perFamily[task2Family] ?? 0} prompts in this family`}>
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
                  meta={[`opinion required: ${task2Item.opinionRequired ? "yes" : "no"}`]}
                />
              )}
            </Section>

            <Section title="Task order" hint="both orders are allowed">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Task order">
                <OrderOption
                  checked={task2Order === "t2-first"}
                  onChange={() => setTask2Order("t2-first")}
                  title="Task 2 first — 40 min"
                  detail="The IELTS-recommended order: the essay carries more marks."
                  badge="recommended"
                />
                <OrderOption
                  checked={task2Order === "t1-first"}
                  onChange={() => setTask2Order("t1-first")}
                  title="Task 1 first — 20 min"
                  detail="Warm up on the chart report, then write the essay."
                />
              </div>
            </Section>

            <Section
              title="Demo samples"
              hint={`${demoSamples.length} pre-written submissions`}
            >
              <p className="text-xs leading-5 text-slate-500">
                Skip the clock and open a graded report straight away. Each pair is a verified recipe against the
                bank&rsquo;s model answers, so you can inspect caps, evidence spans and the B6/B7/B8 tabs.
              </p>
              {demoSamples.length === 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  No demo samples are available for this bank version.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {demoSamples.map((sample) => (
                    <li key={sample.definition.id}>
                      <button
                        type="button"
                        data-testid={`demo-${sample.definition.id}`}
                        onClick={() => actions.loadSample(sample.selection, sample.texts, mode)}
                        className="h-full w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      >
                        <span className="block text-sm font-semibold text-slate-900">{sample.definition.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {sample.definition.summary}
                        </span>
                        <span className="mt-1.5 block text-[11px] leading-5 text-slate-500">
                          {sample.definition.expectation} · {sample.words.task1}+{sample.words.task2} words
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Ready to start</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <SummaryRow label="Mode" value={mode === "computer" ? "Computer-based" : "Paper practice"} />
                <SummaryRow
                  label="Task 1"
                  value={task1Item ? `${TASK1_TYPE_LABELS[task1Type]} · ${task1Item.topic}` : "—"}
                />
                <SummaryRow
                  label="Task 2"
                  value={task2Item ? `${TASK2_FAMILY_LABELS[task2Family]} · ${task2Item.topic}` : "—"}
                />
                <SummaryRow
                  label="Order"
                  value={task2Order === "t2-first" ? "Task 2 → Task 1" : "Task 1 → Task 2"}
                />
                <SummaryRow label="Clock" value="60:00 hard stop · 20/40 advisory" />
                <SummaryRow label="Editor" value="No spellcheck · no autocorrect · live word count" />
              </dl>

              <button
                type="button"
                data-testid="start-session"
                onClick={handleStart}
                disabled={!task1Item || !task2Item}
                className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Start 60-minute session
              </button>
              <button
                type="button"
                onClick={handleRandom}
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Random prompts
              </button>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                Progress is saved in this browser, so a reload resumes where you left off.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
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
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-sm leading-6 text-slate-800">{statement}</p>
      {instruction && (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{instruction}</p>
      )}
      <p className="mt-2 text-[11px] text-slate-500">{meta.filter(Boolean).join(" · ")}</p>
    </div>
  );
}

function OrderOption({
  checked,
  onChange,
  title,
  detail,
  badge,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
  badge?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        checked ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input type="radio" name="task-order" checked={checked} onChange={onChange} className="mt-1 accent-slate-900" />
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
          {title}
          {badge && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span>
      </span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function formatYears(values: number[] | undefined): string {
  if (!values || values.length === 0) return "no dates";
  if (values.length === 1) return String(values[0]);
  return `${values[0]}–${values[values.length - 1]}`;
}
