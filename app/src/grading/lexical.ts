/**
 * Lexical detectors for Task 2 grading (dossier §8.4, §8.5, §9.4, §12.2).
 *
 * Every detector returns `LexicalHit`s with exact character offsets into the
 * submission so the report can highlight the offending text. Nothing here changes
 * a band by itself: `task2.ts` maps the hits onto deterministic caps and feedback.
 *
 * Banned-phrase detection is delegated to `src/data/wordCount.ts` (which already
 * expands the slash entries 4/7/9 and marks entry 12 advisory) so the boot-time
 * bank validator and the grader share one implementation.
 */

import {
  BANNED_PHRASE_RULES,
  expandBannedPhrase,
  type BannedPhraseRule,
} from "../constants";
import { checkBannedPhrases, spellingDictionary, type SpellingDictionary } from "../data/wordCount";
import type { Task1Item, Task2Item } from "../types/bank";

export type LexicalHitKind =
  | "banned"
  | "contraction"
  | "punctuation"
  | "uncountable"
  | "informal"
  | "spelling"
  | "repetition";

export type LexicalSeverity = "cap" | "error" | "upgrade";

export interface LexicalHit {
  kind: LexicalHitKind;
  /** Short human-readable label, e.g. `banned phrase #1`. */
  label: string;
  /** Exact substring matched in the submission (original casing). */
  match: string;
  startChar: number;
  endChar: number;
  severity: LexicalSeverity;
  suggestion: string;
  /** 1-based banned-list index when `kind === "banned"`. */
  ruleIndex?: number;
  /** Advisory hits never cap a band (banned entry 12: idioms/quotes/proverbs). */
  advisory?: boolean;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function pushHits(
  text: string,
  pattern: RegExp,
  make: (match: RegExpExecArray) => LexicalHit,
  out: LexicalHit[],
): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) continue;
    out.push(make(match as RegExpExecArray));
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/* Banned / memorised phrases (bank's 12-entry list)                   */
/* ------------------------------------------------------------------ */

/**
 * Builds detector rules from a bank item's `bannedPhrases` (falls back to the
 * canonical 12). Slash entries ("a / b / c") are expanded; the idioms entry
 * (index 12) stays advisory.
 */
export function bannedRulesFrom(phrases?: readonly string[]): readonly BannedPhraseRule[] {
  if (!phrases || phrases.length === 0) return BANNED_PHRASE_RULES;
  return phrases.map((phrase, i) => {
    const index = i + 1;
    const advisory = index === 12;
    return {
      index,
      phrase,
      alternatives: advisory ? ["every coin has two sides"] : expandBannedPhrase(phrase),
      advisory,
      patterns: advisory ? [/["“][^"”\n]{12,}["”]/g] : undefined,
    };
  });
}

/** Detects the bank's 12 banned/memorised phrases (entry 12 advisory only). */
export function detectBannedPhrases(text: string, phrases?: readonly string[]): LexicalHit[] {
  if (!text.trim()) return [];
  return checkBannedPhrases(text, bannedRulesFrom(phrases)).map((hit) => {
    const advisory = hit.advisory || hit.ruleIndex === 12;
    return {
      kind: "banned",
      label: advisory ? `memorised-language advisory #${hit.ruleIndex}` : `banned phrase #${hit.ruleIndex}`,
      match: hit.match,
      startChar: hit.start,
      endChar: hit.end,
      severity: advisory ? "upgrade" : hit.ruleIndex <= 2 ? "cap" : "error",
      suggestion: advisory
        ? "Idioms, quotes and proverbs are informal and do not demonstrate your own English — replace with a plain statement or a phrasal verb."
        : "Cut the memorised phrase and state the idea in your own words; examiners discount scripted openers and they weaken Task Response.",
      ruleIndex: hit.ruleIndex,
      advisory,
    } satisfies LexicalHit;
  });
}

/* ------------------------------------------------------------------ */
/* Contractions (formal writing ban)                                   */
/* ------------------------------------------------------------------ */

const CONTRACTION_PATTERN =
  /\b(?:can['’]t|won['’]t|wouldn['’]t|shouldn['’]t|couldn['’]t|mustn['’]t|don['’]t|doesn['’]t|didn['’]t|isn['’]t|aren['’]t|wasn['’]t|weren['’]t|haven['’]t|hasn['’]t|hadn['’]t|it['’]s|that['’]s|there['’]s|they['’]re|we['’]re|you['’]re|i['’]m|i['’]ve|we['’]ve|they['’]ve|he['’]s|she['’]s|let['’]s|o['’]clock)\b/gi;

/** Finds contractions such as `don't`, `it's`, `can't` — banned in formal essays. */
export function detectContractions(text: string): LexicalHit[] {
  const hits: LexicalHit[] = [];
  pushHits(
    text,
    CONTRACTION_PATTERN,
    (m) => ({
      kind: "contraction",
      label: "contraction in formal writing",
      match: m[0],
      startChar: m.index ?? 0,
      endChar: (m.index ?? 0) + m[0].length,
      severity: "error",
      suggestion: "Write the two-word form (`do not`, `it is`) — contractions are informal and cost Grammatical Range marks.",
    }),
    hits,
  );
  return hits;
}

/* ------------------------------------------------------------------ */
/* Punctuation: semicolons / colons (prefer commas and full stops)     */
/* ------------------------------------------------------------------ */

/** Flags `;` and `:` (ratios like `3:1` and times like `8:30` are ignored). */
export function detectPunctuation(text: string): LexicalHit[] {
  const hits: LexicalHit[] = [];
  pushHits(
    text,
    /;/g,
    (m) => ({
      kind: "punctuation",
      label: "semicolon",
      match: m[0],
      startChar: m.index ?? 0,
      endChar: (m.index ?? 0) + 1,
      severity: "error",
      suggestion: "Replace the semicolon with a full stop (or a comma plus conjunction) — examiners prefer simple punctuation.",
    }),
    hits,
  );
  pushHits(
    text,
    /(?<!\d):(?!\d)/g,
    (m) => ({
      kind: "punctuation",
      label: "colon",
      match: m[0],
      startChar: m.index ?? 0,
      endChar: (m.index ?? 0) + 1,
      severity: "error",
      suggestion: "Replace the colon with a full stop and start a new sentence — colons are a punctuation risk in IELTS writing.",
    }),
    hits,
  );
  return hits.sort((a, b) => a.startChar - b.startChar);
}

/* ------------------------------------------------------------------ */
/* Uncountable nouns (§8.4)                                            */
/* ------------------------------------------------------------------ */

/** Core uncountable list from the dossier (dual nouns such as `business` excluded). */
export const UNCOUNTABLE_NOUNS: readonly string[] = [
  "accommodation",
  "advertising",
  "advice",
  "aid",
  "art",
  "assistance",
  "cash",
  "chaos",
  "clothing",
  "corruption",
  "courage",
  "damage",
  "education",
  "electricity",
  "employment",
  "energy",
  "entertainment",
  "equipment",
  "evidence",
  "furniture",
  "happiness",
  "health",
  "homework",
  "information",
  "intelligence",
  "knowledge",
  "labour",
  "leisure",
  "litter",
  "luggage",
  "money",
  "music",
  "nutrition",
  "obesity",
  "pollution",
  "poverty",
  "progress",
  "research",
  "rubbish",
  "safety",
  "software",
  "traffic",
  "transportation",
  "travel",
  "unemployment",
  "violence",
  "wealth",
  "weather",
  "welfare",
  "wildlife",
  "work",
];

/** Plural forms that are always wrong for uncountables in this list. */
const WRONG_PLURALS: Record<string, string> = {
  accommodations: "accommodation",
  advertisings: "advertising",
  advices: "advice",
  clothings: "clothing",
  corruptions: "corruption",
  courages: "courage",
  educations: "education",
  electricities: "electricity",
  employments: "employment",
  energies: "energy",
  entertainments: "entertainment",
  equipments: "equipment",
  evidences: "evidence",
  furnitures: "furniture",
  happinesses: "happiness",
  healths: "health",
  homeworks: "homework",
  informations: "information",
  intelligences: "intelligence",
  knowledges: "knowledge",
  labours: "labour",
  leisures: "leisure",
  litters: "litter",
  luggages: "luggage",
  moneys: "money",
  musics: "music",
  nutritions: "nutrition",
  pollutions: "pollution",
  poverties: "poverty",
  progresses: "progress",
  researches: "research",
  rubbishes: "rubbish",
  safeties: "safety",
  softwares: "software",
  traffics: "traffic",
  transportations: "transportation",
  violences: "violence",
  wealths: "wealth",
  weathers: "weather",
  welfares: "welfare",
  wildlifes: "wildlife",
};

/**
 * Singular verbs after an uncountable subject: `information are`, `research have`.
 * Dual nouns that also work as verbs/countables (work, art, education, damage, travel,
 * business) are excluded to keep precision high.
 */
const UNCOUNTABLE_AGREEMENT = /(?<!\b(?:for|of|with|about|on|in|to|from|by|at|over|under|between|among|into|towards|their|its|his|her|our|your|my)\s)\b(accommodation|advice|advertising|assistance|clothing|electricity|employment|energy|entertainment|equipment|evidence|furniture|happiness|health|homework|information|intelligence|knowledge|leisure|litter|luggage|money|music|nutrition|obesity|pollution|poverty|progress|research|rubbish|safety|software|traffic|transportation|unemployment|violence|wealth|weather|welfare|wildlife)\s+(are|were|have|do)\b/gi;

/**
 * Finds uncountable-noun slips: `a/an` + uncountable, wrong plurals,
 * `many/these` + uncountable and plural verbs after an uncountable subject.
 *
 * Attributive uses (`many education systems`, `a labour market`) are excluded:
 * the uncountable must be followed by a delimiter/preposition/verb, not by
 * another noun.
 */
export function detectUncountables(text: string): LexicalHit[] {
  const hits: LexicalHit[] = [];
  const list = UNCOUNTABLE_NOUNS.map(escapeRegExp).join("|");
  const standalone = `(?=\\s*(?:[.,;:!?"'”)]|$|\\b(?:is|are|was|were|has|have|had|does|do|did|will|would|can|could|should|must|of|that|which|to|for|in|on|with|and|or|but|from|by|at|as|than|because|if|when|while|although|about|into|over|under|between|among|during|without|within|upon|after|before|against|towards|toward|per|despite|through|across|around|beyond|since|until|via|per)\\b))`;

  pushHits(
    text,
    new RegExp(`\\b(?:a|an)\\s+(?:${list})\\b${standalone}`, "gi"),
    (m) => ({
      kind: "uncountable",
      label: "‘a/an’ with an uncountable noun",
      match: m[0].trim(),
      startChar: m.index ?? 0,
      endChar: (m.index ?? 0) + m[0].length,
      severity: "error",
      suggestion: "Uncountables take no article — write `advice`, or quantify with a partitive (`a piece of advice`).",
    }),
    hits,
  );

  pushHits(
    text,
    new RegExp(`\\b(?:many|few|several|these|those|both)\\s+(?:${list})\\b(?!\\s+and\\b)${standalone}`, "gi"),
    (m) => ({
      kind: "uncountable",
      label: "plural quantifier with an uncountable noun",
      match: m[0].trim(),
      startChar: m.index ?? 0,
      endChar: (m.index ?? 0) + m[0].length,
      severity: "error",
      suggestion: "Use `much` / `a lot of` / `this` with uncountables, never `many` or `these`.",
    }),
    hits,
  );

  const pluralPattern = new RegExp(`\\b(${Object.keys(WRONG_PLURALS).join("|")})\\b`, "gi");
  pushHits(
    text,
    pluralPattern,
    (m) => {
      const wrong = m[0].toLowerCase();
      const right = WRONG_PLURALS[wrong] ?? wrong.replace(/s$/, "");
      return {
        kind: "uncountable",
        label: "pluralised uncountable noun",
        match: m[0],
        startChar: m.index ?? 0,
        endChar: (m.index ?? 0) + m[0].length,
        severity: "error",
        suggestion: `Uncountables have no plural — write \`${right}\` and keep the verb singular.`,
      };
    },
    hits,
  );

  pushHits(
    text,
    UNCOUNTABLE_AGREEMENT,
    (m) => ({
      kind: "uncountable",
      label: "plural verb after an uncountable subject",
      match: m[0],
      startChar: m.index ?? 0,
      endChar: (m.index ?? 0) + m[0].length,
      severity: "error",
      suggestion: "The uncountable subject is singular — use `is` / `was` / `has` / `does`.",
    }),
    hits,
  );

  return hits.sort((a, b) => a.startChar - b.startChar);
}

/* ------------------------------------------------------------------ */
/* Informal register                                                   */
/* ------------------------------------------------------------------ */

interface InformalTerm {
  pattern: RegExp;
  severity: LexicalSeverity;
  suggestion: string;
}

/** `a lot of` and friends cap LR at 6; `really`-style intensifiers are advisory only. */
export const INFORMAL_TERMS: readonly InformalTerm[] = [
  {
    pattern: /\ba lot of\b/gi,
    severity: "error",
    suggestion: "Use a formal quantifier instead: `a great deal of`, `many`, `numerous` or `substantial`.",
  },
  {
    pattern: /\blots of\b/gi,
    severity: "error",
    suggestion: "Use `a great deal of` or `numerous` — `lots of` is conversational.",
  },
  {
    pattern: /\bkids\b/gi,
    severity: "error",
    suggestion: "Write `children` — `kids` is informal.",
  },
  {
    pattern: /\bstuff\b/gi,
    severity: "error",
    suggestion: "Name the thing precisely (e.g. `material`, `content`) — `stuff` is vague and informal.",
  },
  {
    pattern: /\bgonna\b|\bwanna\b|\bkinda\b|\bsorta\b/gi,
    severity: "error",
    suggestion: "Use the full formal form (`going to`, `want to`) — spoken forms are penalised.",
  },
  {
    pattern: /\breally\b/gi,
    severity: "upgrade",
    suggestion: "`really` is a weak intensifier — replace it with a precise adverb (`substantially`, `particularly`) or delete it.",
  },
  {
    pattern: /\bvery very\b/gi,
    severity: "upgrade",
    suggestion: "One strong adjective beats a repeated intensifier (`extremely important`).",
  },
  {
    pattern: /\bgood thing\b/gi,
    severity: "upgrade",
    suggestion: "Use a precise noun phrase (`a positive development`, `an advantage`).",
  },
];

/** Informal / weak-register hits (`a lot of` is an error, `really` is advisory). */
export function detectInformal(text: string): LexicalHit[] {
  const hits: LexicalHit[] = [];
  for (const term of INFORMAL_TERMS) {
    pushHits(
      text,
      term.pattern,
      (m) => ({
        kind: "informal",
        label: term.severity === "error" ? "informal language" : "weak intensifier",
        match: m[0],
        startChar: m.index ?? 0,
        endChar: (m.index ?? 0) + m[0].length,
        severity: term.severity,
        suggestion: term.suggestion,
      }),
      hits,
    );
  }
  return hits.sort((a, b) => a.startChar - b.startChar);
}

/* ------------------------------------------------------------------ */
/* Common misspellings                                                 */
/* ------------------------------------------------------------------ */

const MISSPELLINGS: Record<string, string> = {
  accomodation: "accommodation",
  acheive: "achieve",
  acheived: "achieved",
  alot: "a lot",
  arguement: "argument",
  becuase: "because",
  begining: "beginning",
  beleive: "believe",
  beleived: "believed",
  benifit: "benefit",
  benifits: "benefits",
  comittee: "committee",
  commited: "committed",
  concensus: "consensus",
  definately: "definitely",
  developement: "development",
  enviroment: "environment",
  enviromental: "environmental",
  existance: "existence",
  experiance: "experience",
  goverment: "government",
  goverments: "governments",
  independant: "independent",
  intresting: "interesting",
  knowlege: "knowledge",
  liesure: "leisure",
  neccessary: "necessary",
  occured: "occurred",
  ocassion: "occasion",
  oppurtunity: "opportunity",
  politicans: "politicians",
  posession: "possession",
  prefered: "preferred",
  recieve: "receive",
  recieved: "received",
  recomend: "recommend",
  responsability: "responsibility",
  seperate: "separate",
  socity: "society",
  succesful: "successful",
  sucess: "success",
  thier: "their",
  tommorow: "tomorrow",
  untill: "until",
  wich: "which",
  wierd: "weird",
};

export interface SpellingHit extends LexicalHit {
  correction: string;
}

/**
 * Offline spellcheck. Two layers:
 *
 *  1. the curated high-frequency misspellings above (exact correction);
 *  2. a dictionary lookup against `wordCount.ts`'s embedded word lists
 *     (common English + AWL + IELTS/bank vocabulary), with suggestions from the
 *     nearest known word.
 *
 * Tokens are skipped when they are numbers/dates (`regex` matches letters only),
 * all-caps acronyms (`IELTS`, `UK`), Capitalised proper nouns (except
 * sentence-initial words, which are checked lower-cased), internal-caps words
 * (`YouTube`), words shorter than 4 letters (`a`, `an`) and words supplied by the
 * task's own allowlist (`task1SpellingAllowlist` / `task2SpellingAllowlist` below).
 */

/** Distance at or below which a suggestion is treated as a definite error. */
const SPELLING_ERROR_DISTANCE = 2;
/** Widest search radius; distance-3 hits are advisory (`upgrade`) for long words. */
const SPELLING_MAX_DISTANCE = 3;
/** Possessive/contraction tails that never need checking (`student's`, `don't`). */
const CONTRACTION_SUFFIXES = new Set(["s", "t", "d", "re", "ve", "ll", "m"]);
const SPELLING_TOKEN = /[A-Za-z]+(?:['’\-][A-Za-z]+)*/g;

interface SpellingSuggestion {
  word: string | null;
  distance: number;
}

const suggestionCache = new Map<string, SpellingSuggestion>();

/** Productive prefixes that combine with a known word (`overfishing`, `telecommuting`). */
const COMPOUND_PREFIXES = new Set([
  "over",
  "under",
  "out",
  "up",
  "down",
  "re",
  "pre",
  "post",
  "mis",
  "non",
  "anti",
  "auto",
  "co",
  "de",
  "dis",
  "inter",
  "multi",
  "semi",
  "sub",
  "super",
  "trans",
  "ultra",
  "bio",
  "eco",
  "tele",
  "cyber",
  "micro",
  "macro",
  "nano",
  "neuro",
  "psycho",
  "socio",
  "techno",
  "geo",
  "hydro",
  "thermo",
  "photo",
  "electro",
  "crowd",
  "cross",
]);

/** Function words that must never be glued together into a compound (`eachother`). */
const NON_COMPOUND_LEFT = new Set(["each", "all"]);

/** Base dictionary words carry an integer rank; generated inflections carry base + 0.5. */
function isBaseWord(word: string, dictionary: SpellingDictionary): boolean {
  const rank = dictionary.rank.get(word);
  return rank !== undefined && Number.isInteger(rank);
}

/**
 * True when an unknown token is a compound of known words (`landfill` = land + fill,
 * `upskilling` = up + skilling, `coworking` = co + working). Both sides need at
 * least four letters and the prefix route needs a base word, so typos such as
 * `infact` / `comitted` are not waved through.
 */
function isKnownCompound(word: string, dictionary: SpellingDictionary): boolean {
  for (let i = 4; i <= word.length - 4; i += 1) {
    if (!dictionary.rank.has(word.slice(i))) continue;
    const left = word.slice(0, i);
    if (NON_COMPOUND_LEFT.has(left)) continue;
    if (dictionary.rank.has(left) || COMPOUND_PREFIXES.has(left)) return true;
  }
  for (const prefix of COMPOUND_PREFIXES) {
    if (!word.startsWith(prefix) || word.length - prefix.length < 4) continue;
    if (isBaseWord(word.slice(prefix.length), dictionary)) return true;
  }
  return false;
}

function collapseDoubleLetters(word: string): string {
  return word.replace(/(.)\1+/g, "$1");
}

/** Bounded Damerau–Levenshtein (optimal string alignment) with early exit. */
function editDistance(a: string, b: string, maxDistance: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;
  let previous2: number[] | null = null;
  let previous: number[] = Array.from({ length: lb + 1 }, (_, i) => i);

  for (let i = 1; i <= la; i += 1) {
    const current = new Array<number>(lb + 1);
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= lb; j += 1) {
      let value = Math.min(
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        previous[j] + 1,
        current[j - 1] + 1,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && previous2) {
        value = Math.min(value, previous2[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous2 = previous;
    previous = current;
  }
  return previous[lb];
}

/**
 * Nearest dictionary word. Ties prefer the candidate whose double letters match
 * (`biger → bigger`, `untill → until`), then the same first letter, then the more
 * common word. Distance-3 suggestions require a long word and the same first
 * letter so `nesscities → necessities` works without inviting noise.
 */
function nearestDictionaryWord(word: string, dictionary: SpellingDictionary): SpellingSuggestion {
  const cached = suggestionCache.get(word);
  if (cached) return cached;

  let best: string | null = null;
  let bestDistance = SPELLING_MAX_DISTANCE + 1;
  let bestRank = Number.POSITIVE_INFINITY;
  let bestCollapse = false;
  const collapsedWord = collapseDoubleLetters(word);
  const lengths = [
    word.length,
    word.length - 1,
    word.length + 1,
    word.length - 2,
    word.length + 2,
    word.length - 3,
    word.length + 3,
  ];

  for (const length of lengths) {
    if (length < 2 || Math.abs(length - word.length) > bestDistance) continue;
    const bucket = dictionary.byLength.get(length);
    if (!bucket) continue;
    for (const candidate of bucket) {
      if (candidate === word) continue;
      const distance = editDistance(word, candidate, SPELLING_MAX_DISTANCE);
      if (distance > SPELLING_MAX_DISTANCE) continue;
      if (distance === SPELLING_MAX_DISTANCE && (word.length < 8 || candidate[0] !== word[0])) continue;

      const collapse = collapseDoubleLetters(candidate) === collapsedWord;
      let better = distance < bestDistance;
      if (!better && distance === bestDistance && best !== null) {
        if (collapse !== bestCollapse) better = collapse && !bestCollapse;
        else {
          const starts = candidate[0] === word[0];
          const bestStarts = best[0] === word[0];
          if (starts !== bestStarts) better = starts;
          else if (starts === bestStarts) better = (dictionary.rank.get(candidate) ?? Number.POSITIVE_INFINITY) < bestRank;
        }
      }
      if (better) {
        best = candidate;
        bestDistance = distance;
        bestRank = dictionary.rank.get(candidate) ?? Number.POSITIVE_INFINITY;
        bestCollapse = collapse;
      }
    }
  }

  const result: SpellingSuggestion =
    best === null ? { word: null, distance: Number.POSITIVE_INFINITY } : { word: best, distance: bestDistance };
  suggestionCache.set(word, result);
  return result;
}

function isAllCapsAcronym(token: string): boolean {
  const letters = token.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase();
}

function hasInternalCapital(token: string): boolean {
  return /[A-Z]/.test(token.slice(1));
}

function isSentenceInitial(text: string, start: number): boolean {
  let i = start - 1;
  while (i >= 0 && (text[i] === " " || text[i] === "\t")) i -= 1;
  return i < 0 || ".!?\n;:".includes(text[i]);
}

/** Splits a multi-word allowlist entry into lower-cased lookup words. */
function allowlistSet(allowlist: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const entry of allowlist) {
    for (const word of entry.toLowerCase().match(/[a-z]+/g) ?? []) {
      if (word.length >= 2) out.add(word);
    }
  }
  return out;
}

/**
 * Spell-checks a submission. `allowlist` carries task-owned vocabulary (chart
 * labels, seed ideas, stage names) so it is never flagged; the static dictionary
 * already includes the whole bank, so the allowlist mainly covers new items.
 */
export function detectMisspellings(text: string, allowlist: Iterable<string> = []): SpellingHit[] {
  if (!text.trim()) return [];
  const allow = allowlistSet(allowlist);
  const dictionary = spellingDictionary();
  const hits: SpellingHit[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(SPELLING_TOKEN)) {
    const token = match[0];
    const tokenStart = match.index ?? 0;
    if (isAllCapsAcronym(token) || hasInternalCapital(token)) continue;
    if (/^[A-Z]/.test(token) && !isSentenceInitial(text, tokenStart)) continue;
    if (allow.has(token.toLowerCase())) continue;

    const parts = token.split(/['’\-]/);
    let cursor = 0;
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const part = parts[partIndex];
      if (!part) continue;
      const at = Math.max(0, token.indexOf(part, cursor));
      cursor = at + part.length;
      if (part.length < 4) continue;
      if (partIndex > 0 && CONTRACTION_SUFFIXES.has(part.toLowerCase())) continue;
      const lower = part.toLowerCase();
      if (allow.has(lower)) continue;

      let correction: string | null = MISSPELLINGS[lower] ?? null;
      let distance = correction ? 0 : Number.POSITIVE_INFINITY;
      if (!correction && !dictionary.rank.has(lower) && !isKnownCompound(lower, dictionary)) {
        const suggestion = nearestDictionaryWord(lower, dictionary);
        if (suggestion.word && Number.isFinite(suggestion.distance) && suggestion.distance <= SPELLING_MAX_DISTANCE) {
          correction = suggestion.word;
          distance = suggestion.distance;
        }
      }
      if (!correction) continue;

      const startChar = tokenStart + Math.max(0, at);
      const endChar = startChar + part.length;
      const key = `${startChar}:${endChar}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        kind: "spelling",
        label: `misspelling: ${part} → ${correction}`,
        match: part,
        startChar,
        endChar,
        severity: distance > SPELLING_ERROR_DISTANCE ? "upgrade" : "error",
        suggestion: `Did you mean \`${correction}\`? Spelling errors are counted under Lexical Resource.`,
        correction,
      });
    }
  }

  return hits.sort((a, b) => a.startChar - b.startChar);
}

/* ------------------------------------------------------------------ */
/* Spelling density (dossier §9.4)                                     */
/* ------------------------------------------------------------------ */

/**
 * Band from spelling density: mostly error-free → 8, few → 7, some → 6,
 * frequent → 5. Mirrors Task 1's number/banned `densityBand` so both graders
 * share one mapping (errors per 200 words).
 */
export function spellingDensityBand(errors: number, words: number): number {
  if (errors <= 0) return 8;
  const scaled = words > 0 ? (errors * 200) / words : errors;
  if (scaled <= 1.5) return 7;
  if (scaled <= 3) return 6;
  return 5;
}

/* ------------------------------------------------------------------ */
/* Task-owned allowlists (chart labels, seed ideas, stage names)       */
/* ------------------------------------------------------------------ */

function collectAllowlistWords(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    for (const word of value.match(/[A-Za-z]+/g) ?? []) {
      if (word.length >= 2) out.add(word.toLowerCase());
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAllowlistWords(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) collectAllowlistWords(child, out);
  }
}

/** Chart/category/series labels and stage names for a Task 1 item. */
export function task1SpellingAllowlist(item: Task1Item): string[] {
  const out = new Set<string>();
  collectAllowlistWords(
    [
      item.topic,
      item.statement,
      item.categories,
      item.axes,
      item.series,
      item.slices,
      item.rows,
      item.columns,
      item.cells,
      item.keyFeatures,
      item.stages,
      item.areas,
      item.features,
      item.changes,
      item.unitsNote,
    ],
    out,
  );
  for (const chart of item.subCharts ?? []) {
    for (const word of task1SpellingAllowlist(chart)) out.add(word);
  }
  return Array.from(out);
}

/** Seed ideas, prompt wording and structure labels for a Task 2 item. */
export function task2SpellingAllowlist(item: Task2Item): string[] {
  const out = new Set<string>();
  collectAllowlistWords(
    [item.topic, item.statement, item.instruction, item.seedIdeas, item.bannedPhrases, item.structure, item.thesisRule],
    out,
  );
  return Array.from(out);
}

/* ------------------------------------------------------------------ */
/* Repetition / type-token ratio                                       */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  (
    "a an the and or but if of to in on at for with by from as is are was were be been being " +
    "this that these those it its they them their there here we our you your i my me he she his her " +
    "not no nor so than then too very can could may might must shall should will would do does did done " +
    "have has had having about into over under again further once during before after above below up down " +
    "out off more most some such only own same other another each few both all any because while although " +
    "though when where which who whom whose what how why also just now new one two"
  ).split(" "),
);

export interface ContentWord {
  word: string;
  count: number;
  firstStartChar: number;
  firstEndChar: number;
}

export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter(
    (word) => word.length > 3 && !STOPWORDS.has(word),
  );
}

export interface RepetitionReport {
  ttr: number;
  unique: number;
  total: number;
  topRepeated: ContentWord[];
}

/**
 * Type–token ratio over content words (length > 3, stopwords removed) plus the
 * most repeated items. Empirically separates bank bands: B6 ≈ 0.69, B7 ≈ 0.78,
 * B8 ≈ 0.80.
 */
export function repetitionReport(text: string, topN = 3): RepetitionReport {
  const words = contentWords(text);
  const counts = new Map<string, ContentWord>();
  const lower = text.toLowerCase();

  for (const word of words) {
    const existing = counts.get(word);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const at = lower.indexOf(word);
    counts.set(word, {
      word,
      count: 1,
      firstStartChar: at >= 0 ? at : 0,
      firstEndChar: at >= 0 ? at + word.length : word.length,
    });
  }

  const total = words.length;
  const topRepeated = Array.from(counts.values())
    .filter((entry) => entry.count > 1)
    .sort((a, b) => b.count - a.count || a.firstStartChar - b.firstStartChar)
    .slice(0, topN);

  return {
    ttr: total === 0 ? 0 : counts.size / total,
    unique: counts.size,
    total,
    topRepeated,
  };
}
