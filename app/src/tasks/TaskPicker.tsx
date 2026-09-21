/**
 * TaskPicker — browse and select a bank item.
 *
 * Task 1 items can be filtered by chart type; Task 2 prompts by family, variant and topic.
 * Both support free-text search, show their ids, and offer a random pick from the current
 * filtered set. The component is data-driven: pass the arrays from the bank loader (or let
 * a parent wire `onSelectTask1` / `onSelectTask2`).
 */

import { useMemo, useState } from 'react';
import { cx, distinct, formatWordTarget, humanizeToken, pluralize } from './format';
import { TASK1_TYPES, TASK2_FAMILIES, type Task1Item, type Task2Prompt } from './types';
import { Badge, EmptyNote } from './ui';

export type TaskPickerTab = 'task1' | 'task2';

export interface TaskPickerProps {
  task1?: Task1Item[];
  task2?: Task2Prompt[];
  onSelectTask1?: (item: Task1Item) => void;
  onSelectTask2?: (prompt: Task2Prompt) => void;
  selectedTask1Id?: string | null;
  selectedTask2Id?: string | null;
  initialTab?: TaskPickerTab;
  className?: string;
}

const ALL = '__all__';

function matchesQuery(haystack: Array<string | undefined | null>, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((value) => (value ?? '').toLowerCase().includes(needle));
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

export function TaskPicker({
  task1 = [],
  task2 = [],
  onSelectTask1,
  onSelectTask2,
  selectedTask1Id,
  selectedTask2Id,
  initialTab = 'task1',
  className,
}: TaskPickerProps) {
  const [tab, setTab] = useState<TaskPickerTab>(initialTab);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [familyFilter, setFamilyFilter] = useState<string>(ALL);
  const [variantFilter, setVariantFilter] = useState<string>(ALL);
  const [topicFilter, setTopicFilter] = useState<string>(ALL);
  const [query, setQuery] = useState('');

  const task1Types = useMemo(() => {
    const seen = distinct(task1.map((item) => (typeof item.type === 'string' ? item.type : '')).filter(Boolean));
    const ordered = TASK1_TYPES.filter((type) => seen.includes(type));
    const extra = seen.filter((type) => !TASK1_TYPES.includes(type as (typeof TASK1_TYPES)[number]));
    return [...ordered, ...extra];
  }, [task1]);

  const families = useMemo(() => {
    const seen = distinct(task2.map((prompt) => prompt.family ?? '').filter(Boolean));
    const ordered = TASK2_FAMILIES.filter((family) => seen.includes(family));
    const extra = seen.filter((family) => !TASK2_FAMILIES.includes(family as (typeof TASK2_FAMILIES)[number]));
    return [...ordered, ...extra];
  }, [task2]);

  const variants = useMemo(() => distinct(task2.map((prompt) => prompt.variant ?? '').filter(Boolean)).sort(), [task2]);
  const topics = useMemo(() => distinct(task2.map((prompt) => prompt.topic ?? '').filter(Boolean)).sort(), [task2]);

  const filteredTask1 = useMemo(
    () =>
      task1.filter((item) => {
        if (typeFilter !== ALL && item.type !== typeFilter) return false;
        return matchesQuery(
          [item.specId, item.topic, item.statement, item.type, item.modelPatternRef],
          query,
        );
      }),
    [task1, typeFilter, query],
  );

  const filteredTask2 = useMemo(
    () =>
      task2.filter((prompt) => {
        if (familyFilter !== ALL && prompt.family !== familyFilter) return false;
        if (variantFilter !== ALL && prompt.variant !== variantFilter) return false;
        if (topicFilter !== ALL && prompt.topic !== topicFilter) return false;
        return matchesQuery(
          [prompt.promptId, prompt.topic, prompt.statement, prompt.instruction, prompt.family, prompt.variant],
          query,
        );
      }),
    [task2, familyFilter, variantFilter, topicFilter, query],
  );

  const activeList = tab === 'task1' ? filteredTask1 : filteredTask2;
  const totalForTab = tab === 'task1' ? task1.length : task2.length;

  const pickRandom = () => {
    if (activeList.length === 0) return;
    const choice = activeList[randomIndex(activeList.length)];
    if (tab === 'task1') onSelectTask1?.(choice as Task1Item);
    else onSelectTask2?.(choice as Task2Prompt);
  };

  const selectClassName =
    'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';

  return (
    <section className={cx('w-full rounded-lg border border-slate-200 bg-white', className)} data-task-picker="true">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
        <div className="flex rounded-md bg-slate-100 p-0.5" role="tablist" aria-label="Task">
          {(['task1', 'task2'] as TaskPickerTab[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cx(
                'rounded px-3 py-1 text-xs font-semibold transition',
                tab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {value === 'task1' ? `Task 1 (${task1.length})` : `Task 2 (${task2.length})`}
            </button>
          ))}
        </div>

        <input
          id="task-picker-search"
          name="task-picker-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search id, topic, wording…"
          aria-label="Search tasks"
          className={cx(selectClassName, 'min-w-40 flex-1')}
        />

        <button
          type="button"
          onClick={pickRandom}
          disabled={activeList.length === 0}
          className="rounded-md bg-teal-700 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Random pick
        </button>
        <span className="text-[11px] text-slate-400">
          {activeList.length} of {totalForTab} shown
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 p-3">
        {tab === 'task1' ? (
          <>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="picker-type">
              Type
            </label>
            <select
              id="picker-type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All types</option>
              {task1Types.map((type) => (
                <option key={type} value={type}>
                  {humanizeToken(type)} ({task1.filter((item) => item.type === type).length})
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="picker-family">
              Family
            </label>
            <select
              id="picker-family"
              value={familyFilter}
              onChange={(event) => setFamilyFilter(event.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All families</option>
              {families.map((family) => (
                <option key={family} value={family}>
                  {humanizeToken(family)} ({task2.filter((prompt) => prompt.family === family).length})
                </option>
              ))}
            </select>

            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="picker-variant">
              Variant
            </label>
            <select
              id="picker-variant"
              value={variantFilter}
              onChange={(event) => setVariantFilter(event.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All variants</option>
              {variants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>

            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="picker-topic">
              Topic
            </label>
            <select
              id="picker-topic"
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All topics</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {humanizeToken(topic)}
                </option>
              ))}
            </select>
          </>
        )}

        {(typeFilter !== ALL || familyFilter !== ALL || variantFilter !== ALL || topicFilter !== ALL || query) && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter(ALL);
              setFamilyFilter(ALL);
              setVariantFilter(ALL);
              setTopicFilter(ALL);
              setQuery('');
            }}
            className="ml-auto text-[11px] font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto p-2">
        {activeList.length === 0 ? (
          <EmptyNote>No tasks match the current filters.</EmptyNote>
        ) : (
          <ul className="space-y-1.5">
            {tab === 'task1'
              ? filteredTask1.map((item) => {
                  const selected = selectedTask1Id === item.specId;
                  return (
                    <li key={item.specId}>
                      <button
                        type="button"
                        onClick={() => onSelectTask1?.(item)}
                        className={cx(
                          'w-full rounded-md border p-2 text-left transition',
                          selected
                            ? 'border-teal-500 bg-teal-50/70'
                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50',
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">{item.specId}</span>
                          <Badge tone="teal">{humanizeToken(item.type)}</Badge>
                          <Badge tone="slate">{pluralize(item.keyFeatures?.length ?? 0, 'key feature')}</Badge>
                        </span>
                        <span className="mt-1 block text-sm font-medium text-slate-800">{item.topic}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{item.statement}</span>
                      </button>
                    </li>
                  );
                })
              : filteredTask2.map((prompt) => {
                  const selected = selectedTask2Id === prompt.promptId;
                  return (
                    <li key={prompt.promptId}>
                      <button
                        type="button"
                        onClick={() => onSelectTask2?.(prompt)}
                        className={cx(
                          'w-full rounded-md border p-2 text-left transition',
                          selected
                            ? 'border-teal-500 bg-teal-50/70'
                            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50',
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">{prompt.promptId}</span>
                          <Badge tone="indigo">{humanizeToken(prompt.family)}</Badge>
                          <Badge tone="slate">{prompt.variant}</Badge>
                          <Badge tone={prompt.opinionRequired ? 'rose' : 'emerald'}>
                            {prompt.opinionRequired ? 'opinion' : 'no position'}
                          </Badge>
                          {typeof prompt.questionCount === 'number' ? (
                            <Badge tone="amber">{pluralize(prompt.questionCount, 'question')}</Badge>
                          ) : null}
                          {formatWordTarget(prompt.wordTarget) ? (
                            <Badge tone="slate">{formatWordTarget(prompt.wordTarget)}</Badge>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-sm font-medium text-slate-800">{prompt.topic}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{prompt.statement}</span>
                      </button>
                    </li>
                  );
                })}
          </ul>
        )}
      </div>
    </section>
  );
}

export default TaskPicker;
