/**
 * PromptViewer — Task 2 prompt card.
 *
 * The statement, instruction, live badges and word/time metadata stay visible. Every
 * planning aid is a native <details> disclosure that starts collapsed: thesis rule,
 * structure preview, seed-idea checklist, banned phrases and marking notes.
 *
 * The checklist is a planning aid only: ticking an idea never inserts any text into an
 * answer, and the selection never leaves this component except through `onChecklistChange`.
 */

import { useMemo, useState } from 'react';
import { cx, formatWordTarget, humanizeToken, pluralize } from './format';
import type { Task2Prompt } from './types';
import { Badge, Card, Collapsible } from './ui';

export interface PromptViewerProps {
  prompt: Task2Prompt;
  className?: string;
  /** Open the thesis-rule panel on first render. Defaults to closed, like every other hint. */
  thesisDefaultOpen?: boolean;
  /** Called whenever the checklist selection changes (planning state, never answer text). */
  onChecklistChange?: (selected: string[]) => void;
}

type IdeaGroupKey = 'pro' | 'con' | 'causes' | 'solutions';

/**
 * SeedIdeas carries one of two shapes: `pro`/`con` for discussion-style prompts and
 * `causes`/`solutions` for problem-style prompts. Labels are keyed by field so both
 * shapes render through the same checklist.
 */
const IDEA_GROUP_LABELS: Record<IdeaGroupKey, string> = {
  pro: 'Ideas for the argument',
  con: 'Ideas against / other side',
  causes: 'Causes / problems',
  solutions: 'Solutions / measures',
};

/** Group headings are labels, not status: one ink tone keeps the checklist calm. */
const IDEA_GROUP_HEADING: Record<IdeaGroupKey, string> = {
  pro: 'text-ink-2',
  con: 'text-ink-2',
  causes: 'text-ink-2',
  solutions: 'text-ink-2',
};

/**
 * Seed-idea checklist inside a collapsed disclosure. The live tick count sits in the
 * summary, so the header reads "0 of 6 ticked — planning only, tap to expand" until the
 * learner starts ticking; after that only the count changes.
 */
function SeedIdeasPanel({
  prompt,
  onChange,
}: {
  prompt: Task2Prompt;
  onChange?: (selected: string[]) => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const groups = (Object.keys(IDEA_GROUP_LABELS) as IdeaGroupKey[])
    .map((key) => ({ key, label: IDEA_GROUP_LABELS[key], items: prompt.seedIdeas?.[key] ?? [] }))
    .filter((group) => group.items.length > 0);
  const total = groups.reduce((count, group) => count + group.items.length, 0);

  if (total === 0) return null;

  const toggle = (id: string) => {
    setChecked((previous) => {
      const next = { ...previous, [id]: !previous[id] };
      onChange?.(Object.keys(next).filter((key) => next[key]));
      return next;
    });
  };

  const selectedCount = Object.values(checked).filter(Boolean).length;

  return (
    <Collapsible
      testId="seed-ideas"
      summary="Seed ideas"
      aside={
        <span className="text-caption font-normal text-ink-2">
          {selectedCount} of {total} ticked — planning only,{' '}
          <span className="group-open:hidden">tap to expand</span>
          <span className="hidden group-open:inline">tap to collapse</span>
        </span>
      }
    >
      <p className="mb-2 text-caption text-ink-2">
        Tick the ideas you plan to use. Nothing here is inserted into your essay automatically; the arguments must
        be written in your own words.
      </p>
      <div data-testid="seed-ideas-checklist" className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.key} className="rounded-control border border-line p-2.5">
            <p className={cx('mb-1 text-caption font-semibold uppercase tracking-wide', IDEA_GROUP_HEADING[group.key])}>
              {group.label}
            </p>
            <ul className="space-y-1.5">
              {group.items.map((idea, index) => {
                const id = `${group.key}-${index}`;
                return (
                  <li key={id} className="flex items-start gap-2">
                    <input
                      id={`${prompt.promptId}-${id}`}
                      data-testid="seed-idea-checkbox"
                      type="checkbox"
                      checked={Boolean(checked[id])}
                      onChange={() => toggle(id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-tint"
                    />
                    <label htmlFor={`${prompt.promptId}-${id}`} className="text-caption leading-snug text-ink">
                      {idea}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}

export function PromptViewer({ prompt, className, thesisDefaultOpen = false, onChecklistChange }: PromptViewerProps) {
  const target = useMemo(() => formatWordTarget(prompt.wordTarget), [prompt.wordTarget]);
  const structure = prompt.structure ?? [];
  const banned = prompt.bannedPhrases ?? [];

  return (
    <article className={cx('w-full space-y-3', className)} data-prompt-id={prompt.promptId}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-caption text-ink-2">{prompt.promptId}</span>
        {prompt.family ? <Badge tone="indigo">{humanizeToken(prompt.family)}</Badge> : null}
        {prompt.variant ? <Badge tone="slate">Variant {prompt.variant}</Badge> : null}
        {prompt.topic ? (
          <Badge tone="teal" title="Topic family">
            {humanizeToken(prompt.topic)}
          </Badge>
        ) : null}
        <Badge tone={prompt.opinionRequired ? 'amber' : 'slate'}>
          {prompt.opinionRequired ? 'Opinion required' : 'No position required'}
        </Badge>
        {typeof prompt.questionCount === 'number' ? (
          <Badge tone="slate">{pluralize(prompt.questionCount, 'question')}</Badge>
        ) : null}
        {typeof prompt.recommendedMinutes === 'number' ? <Badge tone="slate">{prompt.recommendedMinutes} min</Badge> : null}
        {target ? <Badge tone="slate">Target {target}</Badge> : null}
      </header>

      <Card>
        <p className="text-body text-ink">{prompt.statement}</p>
        <p className="mt-2 text-headline font-semibold text-ink">{prompt.instruction}</p>
        <p className="mt-2 text-caption text-ink-2">
          Write at least {prompt.wordTarget?.min ?? 250} words
          {target ? ` — aim for ${target}` : ''}
          {typeof prompt.wordTarget?.hardCeiling === 'number' ? `, ceiling ${prompt.wordTarget.hardCeiling}` : ''}
          {typeof prompt.recommendedMinutes === 'number' ? `. Suggested time: ${prompt.recommendedMinutes} minutes.` : '.'}
        </p>
      </Card>

      {prompt.thesisRule ? (
        <Collapsible
          testId="thesis-rule"
          summary="Thesis rule"
          defaultOpen={thesisDefaultOpen}
          aside={
            <Badge tone={prompt.opinionRequired ? 'amber' : 'slate'}>
              {prompt.opinionRequired ? 'state a position' : 'no verdict needed'}
            </Badge>
          }
        >
          <p className="text-subhead leading-relaxed text-ink-2">{prompt.thesisRule}</p>
        </Collapsible>
      ) : null}

      {structure.length > 0 ? (
        <Collapsible
          testId="structure-preview"
          summary="Structure preview"
          aside={
            <span className="text-caption font-normal text-ink-2">
              {pluralize(structure.length, 'paragraph')} total
            </span>
          }
        >
          <ol className="space-y-1">
            {structure.map((step, index) => (
              <li key={`${step}-${index}`} className="flex items-start gap-2 text-subhead text-ink">
                <span className="mt-0.5 inline-flex h-5 w-5 min-w-5 items-center justify-center rounded-full bg-tint-soft text-[10px] font-semibold text-tint-strong">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Collapsible>
      ) : null}

      <SeedIdeasPanel prompt={prompt} onChange={onChecklistChange} />

      {banned.length > 0 ? (
        <Collapsible testId="banned-phrases" summary={`Phrases to avoid (${banned.length})`}>
          <ul className="space-y-1">
            {banned.map((phrase, index) => (
              <li key={`${phrase}-${index}`} className="flex items-start gap-2 text-caption text-ink-2">
                <span className="mt-0.5 shrink-0 text-danger" aria-hidden="true">
                  ✕
                </span>
                <span>{phrase}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-ink-2">
            These are the clichés the marking notes flag; the list is the same for every prompt in the bank.
          </p>
        </Collapsible>
      ) : null}

      {(prompt.markingNotes || prompt.rubricRef) && (
        <Collapsible testId="marking-notes" summary="Marking notes">
          {prompt.markingNotes ? (
            <p className="whitespace-pre-line text-subhead text-ink">{prompt.markingNotes}</p>
          ) : null}
          {prompt.rubricRef ? <p className="mt-2 text-caption text-ink-2">Rubric reference: {prompt.rubricRef}</p> : null}
        </Collapsible>
      )}
    </article>
  );
}

export default PromptViewer;
