import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Bank JSON lives at `<repo>/bank/` and is served two ways:
 *  - `scripts/sync-bank.mjs` copies it to `public/bank/` before dev/build (primary, no bundle cost);
 *  - a dynamic-import fallback reads the original files, which needs `server.fs.allow` to include "..".
 */
export default defineConfig({
  plugins: [
    react(),
    /**
     * Offline shell (PWA). generateSW keeps the whole strategy declarative:
     *
     *  - Precache: every emitted asset plus `index.html`, the icons, the static
     *    `manifest.webmanifest` and `bank/*.json`, so a load that happened once
     *    keeps working with the network switched off. Workbox records a content
     *    hash per file; any rebuilt byte changes `sw.js`, which is exactly the
     *    trigger the browser uses for `updatefound` (versioned via build hash).
     *  - `navigateFallback: "index.html"` answers an offline reload of the
     *    document (and any future deep link) from the precache.
     *  - Updates: `clientsClaim` lets the new worker take over without a second
     *    load, while `skipWaiting` stays message-driven (workbox emits the
     *    SKIP_WAITING listener). src/pwa.ts shows the "New version — reload"
     *    toast and posts SKIP_WAITING only when the user taps reload: a 60-minute
     *    exam must never be swapped out from under the candidate mid-task.
     *  - `manifest: false` + `injectRegister: null`: `public/manifest.webmanifest`
     *    is linked from index.html and src/pwa.ts owns registration, so the
     *    relative "./" base (`base: "./"`) stays the single source of truth for
     *    both start_url/scope and the worker path.
     */
    VitePWA({
      strategies: "generateSW",
      filename: "sw.js",
      registerType: "prompt",
      manifest: false,
      injectRegister: null,
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
  base: "./",
  server: {
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // The lazy bank-fallback chunk is ~350 kB of JSON; it is only fetched if `public/bank` is missing.
    chunkSizeWarningLimit: 900,
  },
});
