#!/usr/bin/env node
/**
 * Copies the read-only bank JSON into `app/public/bank/` so the app can fetch it
 * without touching `server.fs.allow` in production and without bundling ~650 kB of JSON.
 *
 * Runs automatically via the `predev` / `prebuild` npm hooks. Fails fast when the
 * manifest counts disagree with the actual item arrays (boot-time validation repeats it).
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const bankDir = path.resolve(appRoot, "..", "bank");
const outDir = path.join(appRoot, "public", "bank");

const FILES = ["manifest.json", "task1.json", "task2.json"];

async function readJson(file) {
  return JSON.parse(await readFile(path.join(bankDir, file), "utf8"));
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const [manifest, task1, task2] = await Promise.all(FILES.map(readJson));

  const problems = [];
  if (manifest?.counts?.task1 !== task1?.items?.length) {
    problems.push(`manifest.counts.task1=${manifest?.counts?.task1} but task1.json has ${task1?.items?.length} items`);
  }
  if (manifest?.counts?.task2 !== task2?.items?.length) {
    problems.push(`manifest.counts.task2=${manifest?.counts?.task2} but task2.json has ${task2?.items?.length} items`);
  }
  if (task1?.task !== 1 || task2?.task !== 2) {
    problems.push("task1.json/task2.json carry unexpected `task` markers");
  }
  if (problems.length > 0) {
    console.error("[sync-bank] bank integrity check failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  for (const file of FILES) {
    await copyFile(path.join(bankDir, file), path.join(outDir, file));
  }

  console.log(
    `[sync-bank] copied ${FILES.join(", ")} -> public/bank (bank v${manifest.version}: ${task1.items.length} T1 items, ${task2.items.length} T2 prompts)`,
  );
}

main().catch((error) => {
  console.error("[sync-bank] failed:", error);
  process.exit(1);
});
