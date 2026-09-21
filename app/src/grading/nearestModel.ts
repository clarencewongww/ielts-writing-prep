/**
 * Nearest-model proximity: how close is this submission to the bank's band 6/7/8
 * reference answers? (Dossier §10 goal: give the candidate a model to compare with.)
 *
 * Two signals are combined:
 *  1. **reference coverage** — the share of a model answer's content vocabulary the
 *     submission also uses (topic + lexis overlap);
 *  2. **idea coverage** — the share of the item's `keyFeatures` (T1) or `seedIdeas`
 *     (T2 pro/con, causes/solutions) the submission touches (≥ 40% content-word overlap).
 *
 * The result is advisory; bands still come from `task2.ts` + caps.
 */

import type { Band } from "../types/bank";
import { contentWords } from "./lexical";

export interface ModelReference {
  band: Band;
  text: string;
}

export interface IdeaGroup {
  label: string;
  ideas: readonly string[];
}

export interface NearestModelInput {
  text: string;
  references: readonly ModelReference[];
  /** Flat list of concept sentences (T2 seedIdeas / T1 keyFeatures). */
  ideas?: readonly string[];
  /** Optional grouped version for matched/missing reporting. */
  ideaGroups?: readonly IdeaGroup[];
}

export interface IdeaMatch {
  idea: string;
  /** Share of the idea's content words that appear in the submission (0–1). */
  ratio: number;
  matched: boolean;
  group?: string;
}

export interface NearestModelResult {
  band: Band;
  /** Combined score per band (reference coverage 60% + idea coverage 40%). */
  scores: Record<Band, number>;
  /** Vocabulary coverage of each band's model answer. */
  referenceCoverage: Record<Band, number>;
  ideaCoverage: number;
  matchedIdeas: IdeaMatch[];
  missingIdeas: IdeaMatch[];
  rationale: string;
}

const IDEA_MATCH_THRESHOLD = 0.4;

function wordSet(text: string): Set<string> {
  return new Set(contentWords(text));
}

function coverageOf(needle: ReadonlySet<string>, haystack: ReadonlySet<string>): number {
  if (needle.size === 0) return 0;
  let hit = 0;
  for (const word of needle) if (haystack.has(word)) hit += 1;
  return hit / needle.size;
}

function flattenIdeas(input: NearestModelInput): IdeaMatch[] {
  const words = wordSet(input.text);
  const groups: IdeaGroup[] =
    input.ideaGroups && input.ideaGroups.length > 0
      ? [...input.ideaGroups]
      : input.ideas && input.ideas.length > 0
        ? [{ label: "ideas", ideas: input.ideas }]
        : [];

  const matches: IdeaMatch[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const idea of group.ideas) {
      const key = idea.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const ratio = coverageOf(wordSet(idea), words);
      matches.push({ idea, ratio, matched: ratio >= IDEA_MATCH_THRESHOLD, group: group.label });
    }
  }
  return matches;
}

/** Scores the submission against each reference band and the item's seed ideas. */
export function nearestModel(input: NearestModelInput): NearestModelResult {
  const submission = wordSet(input.text);
  const ideaMatches = flattenIdeas(input);
  const ideaCoverage = ideaMatches.length === 0 ? 0 : ideaMatches.filter((match) => match.matched).length / ideaMatches.length;

  const referenceCoverage = {} as Record<Band, number>;
  const scores = {} as Record<Band, number>;
  let best: Band = 6;
  let bestCoverage = -1;

  for (const reference of input.references) {
    const coverage = coverageOf(wordSet(reference.text), submission);
    referenceCoverage[reference.band] = Number(coverage.toFixed(4));
    scores[reference.band] = Number((0.6 * coverage + 0.4 * ideaCoverage).toFixed(4));
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      best = reference.band;
    }
  }

  const matchedIdeas = ideaMatches.filter((match) => match.matched).sort((a, b) => b.ratio - a.ratio);
  const missingIdeas = ideaMatches.filter((match) => !match.matched).sort((a, b) => a.ratio - b.ratio);

  const rationale =
    `Closest to the band ${best} model: it covers ${(referenceCoverage[best] * 100).toFixed(0)}% of that model's ` +
    `content vocabulary and ${matchedIdeas.length} of ${ideaMatches.length} seed idea${ideaMatches.length === 1 ? "" : "s"}.`;

  return {
    band: best,
    scores,
    referenceCoverage,
    ideaCoverage: Number(ideaCoverage.toFixed(4)),
    matchedIdeas,
    missingIdeas,
    rationale,
  };
}
