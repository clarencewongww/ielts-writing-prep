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
import { checkBannedPhrases } from "../data/wordCount";

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

/** Dictionary of high-frequency IELTS misspellings (Lexical Resource, §9.4). */
export function detectMisspellings(text: string): SpellingHit[] {
  const pattern = new RegExp(`\\b(${Object.keys(MISSPELLINGS).join("|")})\\b`, "gi");
  const hits: SpellingHit[] = [];
  pushHits(
    text,
    pattern,
    (m) => {
      const wrong = m[0].toLowerCase();
      const correction = MISSPELLINGS[wrong] ?? wrong;
      return {
        kind: "spelling",
        label: `misspelling: ${m[0]} → ${correction}`,
        match: m[0],
        startChar: m.index ?? 0,
        endChar: (m.index ?? 0) + m[0].length,
        severity: "error",
        suggestion: `Spell it \`${correction}\` — spelling errors are counted under Lexical Resource.`,
        correction,
      };
    },
    hits,
  );
  return hits;
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
