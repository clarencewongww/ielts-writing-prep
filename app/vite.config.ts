import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Bank JSON lives at `<repo>/bank/` and is served two ways:
 *  - `scripts/sync-bank.mjs` copies it to `public/bank/` before dev/build (primary, no bundle cost);
 *  - a dynamic-import fallback reads the original files, which needs `server.fs.allow` to include "..".
 */
export default defineConfig({
  plugins: [react()],
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
