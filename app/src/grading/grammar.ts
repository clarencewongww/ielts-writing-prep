/**
 * Grammar checks for Task 2 grading (dossier §9.5, §12.2 mistakes 24/26).
 *
 * The estimator is deliberately heuristic: high-precision patterns only, because
 * these feed the Grammatical Range & Accuracy band and the deterministic caps.
 * Agreement / preposition / article patterns mirror the error types the bank's
 * band-6 reference answers exhibit ("governments controls", "wages have not grew",
 * "should improves", "focus only in").
 */

import { detectContractions, detectPunctuation, type LexicalHit } from "./lexical";

/* ------------------------------------------------------------------ */
/* Text segmentation                                                   */
/* ------------------------------------------------------------------ */

export interface TextSpan {
  text: string;
  startChar: number;
  endChar: number;
}

/** Splits on one or more newlines; offsets point into the original text. */
export function splitParagraphs(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\n+/g)) {
    if (match.index === undefined) continue;
    const chunk = text.slice(cursor, match.index);
    if (chunk.trim()) spans.push({ text: chunk, startChar: cursor, endChar: match.index });
    cursor = match.index + match[0].length;
  }
  const tail = text.slice(cursor);
  if (tail.trim()) spans.push({ text: tail, startChar: cursor, endChar: text.length });
  return spans;
}

const ABBREVIATION_END = /\b(?:e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|Prof|St|Fig)\.$/i;

/**
 * Sentence splitter that keeps character offsets and survives common
 * abbreviations and decimals.
 */
export function splitSentences(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const boundary = /[.!?]+(?=\s|$)/g;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = boundary.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const candidate = text.slice(start, end);
    const beforeBoundary = text.slice(Math.max(0, match.index - 1), match.index);
    const afterBoundary = text[end] ?? "";

    if (ABBREVIATION_END.test(candidate.trim())) continue;
    // decimal number: `3.5` / `12.7%`
    if (match[0].length === 1 && /\d/.test(beforeBoundary) && /\d/.test(afterBoundary)) continue;
    // initials (A. Smith) — single capital before the dot
    if (match[0].length === 1 && /\b[A-Z]$/.test(candidate.trim())) continue;

    if (candidate.trim()) spans.push({ text: candidate, startChar: start, endChar: end });
    start = end;
    while (start < text.length && /\s/.test(text[start])) start += 1;
    boundary.lastIndex = start;
  }

  const rest = text.slice(start);
  if (rest.trim()) spans.push({ text: rest, startChar: start, endChar: text.length });
  return spans;
}

function sentenceIndexFor(sentences: readonly TextSpan[], startChar: number): number {
  for (let i = 0; i < sentences.length; i += 1) {
    if (startChar >= sentences[i].startChar && startChar < sentences[i].endChar) return i;
  }
  return sentences.length - 1;
}

/* ------------------------------------------------------------------ */
/* Grammar error patterns                                              */
/* ------------------------------------------------------------------ */

export type GrammarErrorKind =
  | "agreement"
  | "preposition"
  | "article"
  | "verb-form"
  | "word-order"
  | "punctuation"
  | "capitalisation";

export interface GrammarHit {
  kind: GrammarErrorKind;
  label: string;
  match: string;
  startChar: number;
  endChar: number;
  sentenceIndex: number;
  suggestion: string;
  severity: "error" | "upgrade";
}

const PLURAL_SUBJECTS =
  "governments|countries|workers|people|pupils|students|children|applications|companies|families|individuals|cities|nations|researchers|universities|employers|employees|parents|teachers|teenagers|adults|tourists|customers|consumers|voters|citizens|firms|schools|hospitals|technologies|solutions|measures|benefits|drawbacks|factors|habits|resources|skills|jobs|parents|politicians|scientists|journalists|readers|viewers|users|drivers|passengers|farmers|artists|athletes|criminals|prisoners";

const THIRD_PERSON_VERBS =
  "is|was|has|does|controls|agrees|argues|believes|needs|wants|makes|takes|gives|shows|thinks|comes|goes|leads|helps|provides|creates|causes|requires|offers|appears|remains|seems|judges|exists|plays|lives|works|studies|teaches|affects|prevents|improves|reduces|increases";

const PAST_FORMS_ONLY =
  "went|came|saw|gave|knew|wrote|spoke|broke|chose|drove|ate|fell|forgot|hid|rode|rose|ran|sang|sat|shook|stole|swam|threw|woke|wore|won|began|drank|drew|flew|froze|grew|rang|swore|took|tore|bit|blew";

/** Base verbs used to build the "modal + -s verb" pattern (`should improves`). */
const BASE_VERB_STEMS =
  "improve|increase|reduce|provide|create|help|make|lead|allow|offer|require|need|argue|believe|judge|control|agree|invest|build|show|give|take|come|go|focus|exist|solve|address|support|protect";

interface PatternRule {
  kind: GrammarErrorKind;
  pattern: RegExp;
  label: string;
  suggestion: string;
  severity?: "error" | "upgrade";
  /** Extra precision filter; the rule fires only when this returns true. */
  filter?: (match: RegExpExecArray) => boolean;
}

const ERROR_RULES: readonly PatternRule[] = [
  {
    kind: "agreement",
    pattern: new RegExp(`\\b(?:${PLURAL_SUBJECTS})\\s+(?:${THIRD_PERSON_VERBS})\\b`, "gi"),
    label: "subject–verb agreement",
    suggestion: "The subject is plural — use the plural verb form (`governments control`, `countries agree`).",
  },
  {
    kind: "agreement",
    pattern: /\b(?:every|each|neither)\s+[a-z]+\s+(?:are|were|have|do)\b/gi,
    label: "subject–verb agreement after quantifier",
    suggestion: "`Every / each / neither + noun` takes a singular verb (`every application is judged`).",
  },
  {
    kind: "agreement",
    pattern: /\bthere\s+is\s+(?:many|several|numerous|two|three|four|lots|a number of)\b/gi,
    label: "there is + plural",
    suggestion: "Use `there are` before a plural noun.",
  },
  {
    kind: "agreement",
    pattern: /\bthere\s+are\s+(?:a|an|one|much|little)\b/gi,
    label: "there are + singular",
    suggestion: "Use `there is` before a singular noun.",
  },
  {
    kind: "agreement",
    pattern: /\b(?:he|she|it)\s+(?:are|were|have|do)\b/gi,
    label: "subject–verb agreement",
    suggestion: "Use the singular verb with `he / she / it`.",
  },
  {
    kind: "agreement",
    pattern: /\bone of the [a-z]+s?\s+(?:are|were|have)\b/gi,
    label: "one of the … are",
    suggestion: "`One of the + plural noun` takes a singular verb (`one of the reasons is`).",
  },
  {
    kind: "agreement",
    pattern: /\bthe number of [a-z]+s?\s+(?:are|were)\b/gi,
    label: "the number of … are",
    suggestion: "Use `the number of … is` (the number is singular).",
  },
  {
    kind: "agreement",
    pattern: /\ba number of [a-z]+s?\s+(?:is|was)\b/gi,
    label: "a number of … is",
    suggestion: "Use `a number of … are` (a number of = several).",
  },
  {
    kind: "agreement",
    pattern: /\b(?:a|an|the)\s+([a-z]+)\s+(?:that|which)\s+(?:already\s+)?(?:exist|remain|seem|come|include|suggest|show|need|make|have)\b/gi,
    label: "relative-clause agreement",
    suggestion: "The relative clause describes one singular noun — use the singular verb (`the bias that already exists`).",
    filter: (m) => isSingularNoun(m[1] ?? ""),
  },
  {
    kind: "agreement",
    pattern: /\bno\s+[a-z]+(?:\s+[a-z]+)?\s+ever\s+(?:read|wrote|took|made|did|went|came|gave|knew|saw|spoke)\b/gi,
    label: "agreement in `no … ever` clause",
    suggestion: "With `no + singular noun` use the singular form (`no human being ever reads`).",
  },
  {
    kind: "verb-form",
    pattern: new RegExp(`\\b(?:should|must|can|could|will|would|may|might)\\s+(?:${BASE_VERB_STEMS})e?s\\b`, "gi"),
    label: "modal + -s verb",
    suggestion: "After a modal use the base verb (`should improve`, never `should improves`).",
  },
  {
    kind: "verb-form",
    pattern: new RegExp(`\\b(?:have|has|had)\\s+(?:not\\s+)?(?:${PAST_FORMS_ONLY})\\b`, "gi"),
    label: "perfect tense uses past simple",
    suggestion: "Use the past participle after have/has/had (`have not grown`, `have not improved`).",
  },
  {
    kind: "verb-form",
    pattern: new RegExp(`\\b(?:did|does|do)\\s+(?:not\\s+)?(?:${PAST_FORMS_ONLY})\\b`, "gi"),
    label: "auxiliary do + past simple",
    suggestion: "After do/does/did use the base verb (`did not go`).",
  },
  {
    kind: "verb-form",
    pattern: /\b(?:i|we|they|you)\s+(?:is|was|am)\b/gi,
    label: "subject–verb agreement",
    suggestion: "Use `I am / we are / they are`.",
  },
  {
    kind: "verb-form",
    pattern: /\b(?:i am|is|are|was|were)\s+(?:agree|disagree|totally agree|completely agree)\b/gi,
    label: "‘be’ + agree",
    suggestion: "`Agree` is a verb — write `I agree` / `I disagree`.",
  },
  {
    kind: "verb-form",
    pattern: /\bmore\s+(?:happy|easy|fast|cheap|simple|quick|clear|strong|healthy|big|hard|early|busy|noisy|dirty|safe|close|young|old|long|short|deep|high|low|rich|poor|heavy|light|slow)\b/gi,
    label: "double comparative",
    suggestion: "Use the -er form (`happier`) or `more + long adjective`, never both.",
  },
  {
    kind: "preposition",
    pattern: /\b(?:discuss about|depend(?:s|ed|ing)? of|depend(?:s|ed|ing)? from|married with|interested on|in the other hand|according with|capable to|access of|arrive to|composed by|consists in|focus(?:es|ed|ing)? (?:only )?in|despite of|lack in|increase of|decrease of|similar with|aware about|based of|responsible of|suffer of|prevent to|prefer than|superior than|in contrast of|with regards of|reply of)\b/gi,
    label: "wrong preposition / collocation",
    suggestion: "Fix the prepositional collocation — these are stored under Lexical Resource and Grammar.",
  },
  {
    kind: "article",
    pattern: /\ba\s+([a-z]+)/gi,
    label: "‘a’ before a vowel sound",
    suggestion: "Use `an` before a vowel sound (`an advantage`, `an increase`).",
    filter: (m) => needsAn(m[1] ?? ""),
  },
  {
    kind: "article",
    pattern: /\ban\s+([a-z]+)/gi,
    label: "‘an’ before a consonant sound",
    suggestion: "Use `a` before a consonant sound (`a person`, `a problem`).",
    filter: (m) => needsA(m[1] ?? ""),
  },
  {
    kind: "article",
    pattern: /\b(?:a|an|the)\s+(?:my|your|his|her|its|our|their)\b/gi,
    label: "double determiner",
    suggestion: "Use one determiner only (`my view`, not `the my view`).",
  },
  {
    kind: "word-order",
    pattern: /\b(?:explain|say|suggest|describe)\s+me\b/gi,
    label: "indirect object word order",
    suggestion: "Write `tell me` or `explain to me` — `explain me` is not English.",
  },
  {
    kind: "word-order",
    pattern: /\btell\s+to\s+me\b/gi,
    label: "indirect object word order",
    suggestion: "Write `tell me` (no `to`).",
  },
  {
    kind: "word-order",
    pattern: /\bi\s+(?:like|enjoy|prefer)\s+very much\b/gi,
    label: "adverb placement",
    suggestion: "Put the adverb before the verb (`I very much like`) or use `really` — though `really` is also informal.",
  },
];

const PLURAL_NOUN_EXCEPTIONS = new Set([
  "data",
  "media",
  "criteria",
  "phenomena",
  "people",
  "children",
  "police",
  "staff",
  "series",
  "species",
]);

function isSingularNoun(word: string): boolean {
  return !word.toLowerCase().endsWith("s") && !PLURAL_NOUN_EXCEPTIONS.has(word.toLowerCase());
}

/** Words starting with a vowel letter but a consonant sound ("university"). */
const A_EXCEPTION_PREFIXES = ["uni", "use", "user", "usu", "eu", "one", "once", "ubiq", "uro", "ufo", "utens"];
/** Words starting with a consonant letter but a vowel sound ("hour"). */
const AN_EXCEPTION_PREFIXES = ["hour", "honest", "honour", "honor", "heir", "herb"];

function needsAn(word: string): boolean {
  const lower = word.toLowerCase();
  return /^[aeiou]/.test(lower) && !A_EXCEPTION_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function needsA(word: string): boolean {
  const lower = word.toLowerCase();
  return /^[bcdfghjklmnpqrstvwxyz]/.test(lower) && !AN_EXCEPTION_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** High-precision agreement / preposition / article / word-order errors. */
export function detectGrammarErrors(text: string): GrammarHit[] {
  const sentences = splitSentences(text);
  const hits: GrammarHit[] = [];
  for (const rule of ERROR_RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      if (match.index === undefined) continue;
      if (rule.filter && !rule.filter(match as RegExpExecArray)) continue;
      hits.push({
        kind: rule.kind,
        label: rule.label,
        match: match[0],
        startChar: match.index,
        endChar: match.index + match[0].length,
        sentenceIndex: sentenceIndexFor(sentences, match.index),
        suggestion: rule.suggestion,
        severity: rule.severity ?? "error",
      });
    }
  }
  return dedupeHits(hits);
}

function dedupeHits(hits: GrammarHit[]): GrammarHit[] {
  const seen = new Set<string>();
  const out: GrammarHit[] = [];
  for (const hit of hits.sort((a, b) => a.startChar - b.startChar)) {
    const key = `${hit.kind}:${hit.startChar}:${hit.endChar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Punctuation + capitalisation                                        */
/* ------------------------------------------------------------------ */

function detectCapitalisation(text: string, sentences: readonly TextSpan[]): GrammarHit[] {
  const hits: GrammarHit[] = [];

  // lowercase pronoun `i`
  for (const match of text.matchAll(/\bi\b/g)) {
    if (match.index === undefined) continue;
    hits.push({
      kind: "capitalisation",
      label: "lowercase pronoun `i`",
      match: match[0],
      startChar: match.index,
      endChar: match.index + 1,
      sentenceIndex: sentenceIndexFor(sentences, match.index),
      suggestion: "The pronoun `I` is always capitalised.",
      severity: "error",
    });
  }

  // sentence starts with a lowercase letter
  for (const sentence of sentences) {
    const first = /[a-zA-Z]/.exec(sentence.text);
    if (!first) continue;
    if (first[0] === first[0].toLowerCase()) {
      const start = sentence.startChar + (first.index ?? 0);
      hits.push({
        kind: "capitalisation",
        label: "sentence starts lowercase",
        match: first[0],
        startChar: start,
        endChar: start + 1,
        sentenceIndex: sentenceIndexFor(sentences, start),
        suggestion: "Start every sentence with a capital letter.",
        severity: "error",
      });
    }
  }

  return hits;
}

/** Semicolon/colon + contraction + capitalisation issues (one combined list). */
export function detectPunctuationIssues(text: string): GrammarHit[] {
  const sentences = splitSentences(text);
  const hits: GrammarHit[] = [];

  const lexicalToGrammar = (hit: LexicalHit): GrammarHit => ({
    kind: "punctuation",
    label: hit.label,
    match: hit.match,
    startChar: hit.startChar,
    endChar: hit.endChar,
    sentenceIndex: sentenceIndexFor(sentences, hit.startChar),
    suggestion: hit.suggestion,
    severity: "error",
  });

  for (const hit of detectPunctuation(text)) hits.push(lexicalToGrammar(hit));
  for (const hit of detectContractions(text)) hits.push(lexicalToGrammar(hit));
  hits.push(...detectCapitalisation(text, sentences));

  return dedupeHits(hits);
}

/* ------------------------------------------------------------------ */
/* Complex sentences                                                   */
/* ------------------------------------------------------------------ */

const SUBORDINATORS = [
  "although",
  "though",
  "even though",
  "while",
  "whereas",
  "because",
  "since",
  "unless",
  "when",
  "whenever",
  "after",
  "before",
  "until",
  "once",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "so that",
  "such that",
  "whether",
  "if",
  "in order to",
  "despite",
  "in spite of",
  "as long as",
  "provided that",
];

const SUBORDINATOR_PATTERN = new RegExp(`\\b(?:${SUBORDINATORS.map((s) => s.replace(/ /g, "\\s+")).join("|")})\\b`, "gi");

/** Participle clauses count as complex structures too ("Faced with …", "Having …"). */
const PARTICIPLE_CLAUSE = /(?:^|[,;]\s*)(?:[A-Z][a-z]+ing|[A-Z][a-z]+ed)\b/;

export interface ComplexStats {
  sentences: number;
  complex: number;
  pct: number;
  subordinators: string[];
}

/** Share of sentences containing a subordinator or a participle clause. */
export function complexSentenceStats(text: string): ComplexStats {
  const sentences = splitSentences(text);
  let complex = 0;
  const used = new Set<string>();

  for (const sentence of sentences) {
    const found = sentence.text.match(SUBORDINATOR_PATTERN) ?? [];
    for (const item of found) used.add(item.toLowerCase());
    if (found.length > 0 || PARTICIPLE_CLAUSE.test(sentence.text.trim())) complex += 1;
  }

  const total = sentences.length;
  return {
    sentences: total,
    complex,
    pct: total === 0 ? 0 : complex / total,
    subordinators: Array.from(used),
  };
}

/* ------------------------------------------------------------------ */
/* Error-free estimator                                                */
/* ------------------------------------------------------------------ */

export interface ErrorFreeStats {
  sentences: number;
  sentencesWithErrors: number;
  errorFreeRatio: number;
  errorsPer100Words: number;
  errorCount: number;
}

export function errorFreeStats(
  text: string,
  hits: readonly Pick<GrammarHit, "startChar">[],
  words: number,
): ErrorFreeStats {
  const sentences = splitSentences(text);
  const flagged = new Set<number>();
  for (const hit of hits) flagged.add(sentenceIndexFor(sentences, hit.startChar));
  const sentencesWithErrors = flagged.size;
  const total = sentences.length;
  return {
    sentences: total,
    sentencesWithErrors,
    errorFreeRatio: total === 0 ? 0 : Math.max(0, (total - sentencesWithErrors) / total),
    errorsPer100Words: words === 0 ? 0 : (hits.length / words) * 100,
    errorCount: hits.length,
  };
}
