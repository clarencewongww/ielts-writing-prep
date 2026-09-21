# IELTS Writing Prep

IELTS Academic Writing practice: a 60-minute CBT/paper simulation with bank-driven Task 1 and Task 2 items.

## Layout

- `app/` — Vite + React + TypeScript + Tailwind + Chart.js client. Build output goes to `app/dist/`.
- `bank/` — authored content bank: `manifest.json`, `task1.json` (28 items), `task2.json` (30 prompts).
- `research/` — source research notes used to author the bank.

## Develop

```sh
cd app
npm install
npm run dev
```

`npm run build` runs `tsc --noEmit` and builds a static bundle into `app/dist/`. Vite is configured with `base: "./"`, so the bundle can be served from any sub-path, including GitHub Pages.

## Content pipeline

`app/scripts/sync-bank.mjs` copies `bank/*.json` into `app/public/bank/` before dev and build (`predev` / `prebuild`), which in turn is copied into `app/dist/bank/` by Vite's `publicDir`.
