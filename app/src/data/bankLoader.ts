/**
 * Boot-time question-bank loader and validator.
 *
 * Primary source: `public/bank/*.json` (copied from the read-only `bank/` folder by
 * `scripts/sync-bank.mjs`, so the bundle stays small). Fallback: a lazy dynamic import
 * of the original JSON — used only when the public copy is unavailable (e.g. `file://`).
 *
 * Validation is strict about anything that would make grading unreliable:
 *  - manifest counts must match the item arrays (28 Task 1 / 30 Task 2),
 *  - IDs must be unique and match the manifest regexes,
 *  - every item must expose bands 6, 7 and 8,
 *  - `referenceAnswers[].wordCount` must equal the whitespace count of its text,
 *  - when loading from `public/bank/`, each file's SHA-256 must equal the hash
 *    recorded in `manifest.fileMeta` (a stale public copy fails loudly instead of
 *    silently grading against a different bank version).
 * Softer data properties (pie sums, banned phrases in model answers) are warnings.
 */

import {
  BANNED_PHRASES,
  ID_REGEX_SOURCE,
  ID_REGEXES,
  TASK1_MINUTES,
  TASK1_TYPES,
  TASK1_WORDS,
  TASK2_FAMILIES,
  TASK2_MINUTES,
  TASK2_WORDS,
  task2AnswerId,
} from "../constants";
import { checkBannedPhrases, countWords, pieSums } from "./wordCount";
import type {
  BankFile,
  BankManifest,
  Band,
  Task1Item,
  Task1Type,
  Task2Family,
  Task2Item,
} from "../types/bank";

export type BankFileName = "manifest.json" | "task1.json" | "task2.json";

export class BankLoadError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "BankLoadError";
    this.details = details;
  }
}

export interface BankStats {
  task1Items: number;
  task2Items: number;
  task1Answers: number;
  task2Answers: number;
  totalAnswers: number;
  task1WordRange: [number, number] | null;
  task2WordRange: [number, number] | null;
  perType: Record<string, number>;
  perFamily: Record<string, number>;
}

export interface BankValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: BankStats;
}

export interface BankIndex {
  task1ById: Map<string, Task1Item>;
  task2ById: Map<string, Task2Item>;
  task1ByType: Map<Task1Type, Task1Item[]>;
  task2ByFamily: Map<Task2Family, Task2Item[]>;
}

export interface BankData {
  manifest: BankManifest;
  task1: BankFile<Task1Item>;
  task2: BankFile<Task2Item>;
  index: BankIndex;
  validation: BankValidation;
  /** `public` = fetched from public/bank; `bundled` = dynamic-import fallback. */
  source: "public" | "bundled";
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

async function fetchJson(name: BankFileName): Promise<{ json: unknown; raw: string }> {
  const base = typeof document !== "undefined" ? document.baseURI : "http://localhost/";
  const url = new URL(`bank/${name}`, base).toString();
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
  const raw = await response.text();
  return { json: JSON.parse(raw) as unknown, raw };
}

/** Lazy import fallback: resolved relative to the repo root, never part of the initial bundle. */
async function importJson(name: BankFileName): Promise<unknown> {
  switch (name) {
    case "manifest.json":
      return (await import("../../../bank/manifest.json")).default;
    case "task1.json":
      return (await import("../../../bank/task1.json")).default;
    case "task2.json":
      return (await import("../../../bank/task2.json")).default;
  }
}

interface LoadedJson {
  json: unknown;
  source: "public" | "bundled";
  /** Raw file text, present only when fetched (needed for the SHA-256 check). */
  raw?: string;
}

async function loadJson(name: BankFileName): Promise<LoadedJson> {
  try {
    const { json, raw } = await fetchJson(name);
    return { json, source: "public", raw };
  } catch (fetchError) {
    try {
      return { json: await importJson(name), source: "bundled" };
    } catch (importError) {
      const fetchMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
      const importMessage = importError instanceof Error ? importError.message : String(importError);
      throw new BankLoadError(`Unable to load bank/${name}.`, [fetchMessage, importMessage]);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Integrity: manifest version + per-file SHA-256                      */
/* ------------------------------------------------------------------ */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 of the exact file bytes; `null` when WebCrypto is unavailable. */
async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toHex(digest);
}

/**
 * Fails loudly when a fetched file does not match the version metadata in the
 * manifest: `manifest.fileMeta[name].sha256` for task1/task2 (and manifest.json
 * when it lists itself). Bundled imports carry no raw bytes and are skipped with
 * a warning — their content came from the same commit as the app.
 */
async function verifyBankIntegrity(
  manifest: BankManifest,
  loads: Record<BankFileName, LoadedJson>,
): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const anyPublic = (Object.keys(loads) as BankFileName[]).some((name) => loads[name].source === "public");

  if (!manifest.version || typeof manifest.version !== "string") {
    errors.push("manifest.version is missing — cannot pin the bank version.");
  }

  if (!manifest.fileMeta) {
    if (anyPublic) warnings.push("manifest.fileMeta is missing; public/bank file hashes cannot be verified.");
    return { errors, warnings };
  }

  for (const name of Object.keys(loads) as BankFileName[]) {
    const load = loads[name];
    const expected = manifest.fileMeta[name]?.sha256;
    if (!expected) {
      // The manifest cannot record its own hash, so its absence is expected.
      if (name !== "manifest.json") {
        warnings.push(`manifest.fileMeta has no sha256 for ${name}; that file was not integrity-checked.`);
      }
      continue;
    }
    if (load.source === "bundled" || !load.raw) {
      warnings.push(`${name} was loaded from the bundled fallback; its manifest sha256 was not verified.`);
      continue;
    }
    const actual = await sha256Hex(load.raw);
    if (!actual) {
      warnings.push(`${name} could not be hash-checked: WebCrypto is unavailable in this context.`);
      continue;
    }
    if (actual !== expected) {
      errors.push(
        `${name} does not match manifest v${manifest.version}: expected sha256 ${expected}, got ${actual}. ` +
          `Run \`npm run sync:bank\` to refresh public/bank.`,
      );
    }
  }

  return { errors, warnings };
}

let cachedBank: Promise<BankData> | null = null;

/** Loads and validates the bank once per page load (failed loads are retried on the next call). */
export function loadBank(): Promise<BankData> {
  if (!cachedBank) {
    cachedBank = loadBankInternal().catch((error: unknown) => {
      cachedBank = null;
      throw error;
    });
  }
  return cachedBank;
}

async function loadBankInternal(): Promise<BankData> {
  const [manifestLoad, task1Load, task2Load] = await Promise.all([
    loadJson("manifest.json"),
    loadJson("task1.json"),
    loadJson("task2.json"),
  ]);

  const manifest = manifestLoad.json as BankManifest;
  const task1 = task1Load.json as BankFile<Task1Item>;
  const task2 = task2Load.json as BankFile<Task2Item>;

  if (!manifest || typeof manifest !== "object" || !Array.isArray(task1?.items) || !Array.isArray(task2?.items)) {
    throw new BankLoadError("Bank JSON is malformed: expected a manifest object and two item arrays.", [
      `manifest: ${typeof manifestLoad.json}`,
      `task1.items: ${Array.isArray(task1?.items) ? task1.items.length : "missing"}`,
      `task2.items: ${Array.isArray(task2?.items) ? task2.items.length : "missing"}`,
    ]);
  }

  const integrity = await verifyBankIntegrity(manifest, {
    "manifest.json": manifestLoad,
    "task1.json": task1Load,
    "task2.json": task2Load,
  });
  const validation = validateBank(manifest, task1, task2);
  if (integrity.errors.length > 0) {
    validation.errors.push(...integrity.errors);
    validation.ok = false;
  }
  validation.warnings.push(...integrity.warnings);

  const bank: BankData = {
    manifest,
    task1,
    task2,
    index: buildIndex(task1, task2),
    validation,
    source: manifestLoad.source,
  };

  if (validation.ok) {
    const { stats } = validation;
    const integrityNote = bank.source === "public" ? "sha256 verified" : "bundled fallback";
    console.info(
      `[bank] v${manifest.version} verified (${bank.source}, ${integrityNote}): ${stats.task1Items} T1 items / ${stats.task2Items} T2 prompts, ` +
        `${stats.totalAnswers} reference answers, word counts match text.`,
    );
  } else {
    console.error("[bank] validation failed:", validation.errors);
  }
  for (const warning of validation.warnings) console.warn(`[bank] ${warning}`);

  return bank;
}

/* ------------------------------------------------------------------ */
/* Indexing / selectors                                                */
/* ------------------------------------------------------------------ */

function buildIndex(task1: BankFile<Task1Item>, task2: BankFile<Task2Item>): BankIndex {
  const task1ById = new Map<string, Task1Item>();
  const task2ById = new Map<string, Task2Item>();
  const task1ByType = new Map<Task1Type, Task1Item[]>();
  const task2ByFamily = new Map<Task2Family, Task2Item[]>();

  for (const item of task1.items) {
    task1ById.set(item.specId, item);
    const bucket = task1ByType.get(item.type);
    if (bucket) bucket.push(item);
    else task1ByType.set(item.type, [item]);
  }
  for (const item of task2.items) {
    task2ById.set(item.promptId, item);
    const bucket = task2ByFamily.get(item.family);
    if (bucket) bucket.push(item);
    else task2ByFamily.set(item.family, [item]);
  }

  return { task1ById, task2ById, task1ByType, task2ByFamily };
}

export function getTask1Item(bank: BankData, id: string | undefined): Task1Item | null {
  if (!id) return null;
  return bank.index.task1ById.get(id) ?? null;
}

export function getTask2Item(bank: BankData, id: string | undefined): Task2Item | null {
  if (!id) return null;
  return bank.index.task2ById.get(id) ?? null;
}

export function describeBank(bank: BankData): string {
  const { stats, ok } = bank.validation;
  return `Bank v${bank.manifest.version} · ${stats.task1Items} Task 1 items · ${stats.task2Items} Task 2 prompts · ${stats.totalAnswers} reference answers${ok ? " · verified" : " · CHECK FAILED"}`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const BANDS: Band[] = [6, 7, 8];

function range(values: number[]): [number, number] | null {
  if (values.length === 0) return null;
  return [Math.min(...values), Math.max(...values)];
}

export function validateBank(
  manifest: BankManifest,
  task1: BankFile<Task1Item>,
  task2: BankFile<Task2Item>,
): BankValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  /* --- manifest shape --- */
  if (!manifest.version) errors.push("manifest.version is missing.");
  if (
    manifest.counts?.task1 !== task1.items.length ||
    manifest.counts?.task2 !== task2.items.length
  ) {
    errors.push(
      `Manifest counts do not match the bank files: manifest says ${manifest.counts?.task1}/${manifest.counts?.task2}, ` +
        `files contain ${task1.items.length}/${task2.items.length}.`,
    );
  }
  if (manifest.counts?.totalItems !== task1.items.length + task2.items.length) {
    warnings.push(
      `manifest.counts.totalItems=${manifest.counts?.totalItems} but ${task1.items.length + task2.items.length} items are present.`,
    );
  }
  for (const [key, source] of Object.entries(ID_REGEX_SOURCE)) {
    const manifestSource = (manifest.idRegexes as Record<string, string> | undefined)?.[key];
    if (manifestSource !== source) {
      warnings.push(`manifest.idRegexes.${key} drifted from src/constants.ts (${manifestSource ?? "missing"}).`);
    }
  }
  if (manifest.bannedPhrases?.length !== BANNED_PHRASES.length) {
    warnings.push(
      `manifest.bannedPhrases has ${manifest.bannedPhrases?.length ?? 0} entries; constants define ${BANNED_PHRASES.length}.`,
    );
  }

  /* --- Task 1 --- */
  const task1Ids = new Set<string>();
  const task1WordCounts: number[] = [];
  let task1Answers = 0;
  const perType: Record<string, number> = {};

  for (const item of task1.items) {
    if (!item.specId) {
      errors.push("Task 1 item without a specId.");
      continue;
    }
    if (task1Ids.has(item.specId)) errors.push(`Duplicate Task 1 specId: ${item.specId}.`);
    task1Ids.add(item.specId);
    if (!ID_REGEXES.task1Item.test(item.specId)) {
      errors.push(`Task 1 specId fails manifest regex: ${item.specId}.`);
    }
    if (!TASK1_TYPES.includes(item.type)) {
      errors.push(`Task 1 item ${item.specId} has unknown type "${item.type}".`);
    }
    perType[item.type] = (perType[item.type] ?? 0) + 1;
    if (Array.isArray(item.typeEnum) && !item.typeEnum.includes(item.type)) {
      warnings.push(`Task 1 item ${item.specId}: type "${item.type}" missing from typeEnum.`);
    }
    if (JSON.stringify(item.wordTarget) !== JSON.stringify(TASK1_WORDS)) {
      warnings.push(`Task 1 item ${item.specId} wordTarget drifted from the shared constants.`);
    }
    if (item.recommendedMinutes !== TASK1_MINUTES) {
      warnings.push(`Task 1 item ${item.specId} recommends ${item.recommendedMinutes} min, expected ${TASK1_MINUTES}.`);
    }
    if (item.type === "pie") {
      const sums = pieSums(item);
      if (!sums.ok) {
        warnings.push(
          `Task 1 item ${item.specId}: pie slices total ${sums.groups.map((g) => `${g.year}=${g.sum}`).join(", ")} (expected ${sums.whole}).`,
        );
      }
    }
    for (const answer of item.referenceAnswers ?? []) {
      task1Answers += 1;
      const label = answer.id ?? `${item.specId} (answer)`;
      if (!ID_REGEXES.task1Answer.test(label)) {
        errors.push(`Task 1 answer id fails manifest regex: ${label}.`);
      }
      if (!BANDS.includes(answer.band)) errors.push(`Task 1 answer ${label} has band ${answer.band}.`);
      const words = countWords(answer.text ?? "");
      if (words !== answer.wordCount) {
        errors.push(`Task 1 answer ${label}: wordCount=${answer.wordCount} but text contains ${words} words.`);
      }
      task1WordCounts.push(words);
      if (words < (item.wordTarget?.min ?? 0) || words > (item.wordTarget?.hardCeiling ?? Number.MAX_SAFE_INTEGER)) {
        warnings.push(`Task 1 answer ${label}: ${words} words is outside the ${item.wordTarget?.min}–${item.wordTarget?.hardCeiling} window.`);
      }
      for (const hit of checkBannedPhrases(answer.text ?? "")) {
        warnings.push(`Task 1 answer ${label} contains banned phrase #${hit.ruleIndex}: "${hit.match}".`);
      }
    }
    if ((item.referenceAnswers ?? []).length !== BANDS.length) {
      errors.push(`Task 1 item ${item.specId} has ${item.referenceAnswers?.length ?? 0} reference answers; expected 3.`);
    } else {
      const bands = new Set((item.referenceAnswers ?? []).map((a) => a.band));
      if (!BANDS.every((band) => bands.has(band))) {
        errors.push(`Task 1 item ${item.specId} does not cover bands 6/7/8.`);
      }
    }
  }

  /* --- Task 2 --- */
  const task2Ids = new Set<string>();
  const task2WordCounts: number[] = [];
  let task2Answers = 0;
  const perFamily: Record<string, number> = {};

  for (const item of task2.items) {
    if (!item.promptId) {
      errors.push("Task 2 item without a promptId.");
      continue;
    }
    if (task2Ids.has(item.promptId)) errors.push(`Duplicate Task 2 promptId: ${item.promptId}.`);
    task2Ids.add(item.promptId);
    if (!ID_REGEXES.task2Item.test(item.promptId)) {
      errors.push(`Task 2 promptId fails manifest regex: ${item.promptId}.`);
    }
    if (!TASK2_FAMILIES.includes(item.family)) {
      errors.push(`Task 2 item ${item.promptId} has unknown family "${item.family}".`);
    }
    perFamily[item.family] = (perFamily[item.family] ?? 0) + 1;
    if (Array.isArray(item.familyEnum) && !item.familyEnum.includes(item.family)) {
      warnings.push(`Task 2 item ${item.promptId}: family "${item.family}" missing from familyEnum.`);
    }
    if (JSON.stringify(item.wordTarget) !== JSON.stringify(TASK2_WORDS)) {
      warnings.push(`Task 2 item ${item.promptId} wordTarget drifted from the shared constants.`);
    }
    if (item.recommendedMinutes !== TASK2_MINUTES) {
      warnings.push(`Task 2 item ${item.promptId} recommends ${item.recommendedMinutes} min, expected ${TASK2_MINUTES}.`);
    }
    // Every prompt must carry one of the two idea shapes the planner/viewer render:
    // pro/con (discussion & opinion) or causes/solutions (problem & solution).
    const hasProCon = (item.seedIdeas?.pro?.length ?? 0) > 0 || (item.seedIdeas?.con?.length ?? 0) > 0;
    const hasCausesSolutions =
      (item.seedIdeas?.causes?.length ?? 0) > 0 || (item.seedIdeas?.solutions?.length ?? 0) > 0;
    if (!hasProCon && !hasCausesSolutions) {
      errors.push(
        `Task 2 item ${item.promptId} has no seed ideas; expected a pro/con or causes/solutions pair.`,
      );
    }
    for (const answer of item.referenceAnswers ?? []) {
      task2Answers += 1;
      const expectedId = task2AnswerId(item.promptId, answer.band);
      if (answer.promptId !== item.promptId) {
        errors.push(`Task 2 answer ${expectedId}: promptId "${answer.promptId}" does not match its item.`);
      }
      if (!BANDS.includes(answer.band)) errors.push(`Task 2 answer ${expectedId} has band ${answer.band}.`);
      const words = countWords(answer.text ?? "");
      if (words !== answer.wordCount) {
        errors.push(`Task 2 answer ${expectedId}: wordCount=${answer.wordCount} but text contains ${words} words.`);
      }
      task2WordCounts.push(words);
      if (words < (item.wordTarget?.min ?? 0) || words > (item.wordTarget?.hardCeiling ?? Number.MAX_SAFE_INTEGER)) {
        warnings.push(`Task 2 answer ${expectedId}: ${words} words is outside the ${item.wordTarget?.min}–${item.wordTarget?.hardCeiling} window.`);
      }
      for (const hit of checkBannedPhrases(answer.text ?? "")) {
        warnings.push(`Task 2 answer ${expectedId} contains banned phrase #${hit.ruleIndex}: "${hit.match}".`);
      }
    }
    if ((item.referenceAnswers ?? []).length !== BANDS.length) {
      errors.push(`Task 2 item ${item.promptId} has ${item.referenceAnswers?.length ?? 0} reference answers; expected 3.`);
    } else {
      const bands = new Set((item.referenceAnswers ?? []).map((a) => a.band));
      if (!BANDS.every((band) => bands.has(band))) {
        errors.push(`Task 2 item ${item.promptId} does not cover bands 6/7/8.`);
      }
    }
  }

  const stats: BankStats = {
    task1Items: task1.items.length,
    task2Items: task2.items.length,
    task1Answers,
    task2Answers,
    totalAnswers: task1Answers + task2Answers,
    task1WordRange: range(task1WordCounts),
    task2WordRange: range(task2WordCounts),
    perType,
    perFamily,
  };

  if (manifest.counts?.referenceAnswers !== stats.totalAnswers) {
    warnings.push(
      `manifest.counts.referenceAnswers=${manifest.counts?.referenceAnswers} but ${stats.totalAnswers} answers are present.`,
    );
  }

  return { ok: errors.length === 0, errors, warnings, stats };
}
