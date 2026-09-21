/**
 * Appearance contract — the single source of truth for light / dark / system.
 *
 * Storage: `ielts.theme.v1`, written through the schema-versioned envelope owned
 * by `store/persistence` (`loadThemePreference` / `saveThemePreference`), which
 * whitelists the value and defaults to `"system"`.
 *
 * Rendering contract (mirrored, byte-for-byte in behaviour, by the pre-paint
 * inline script in `index.html`):
 *   - `document.documentElement` carries `class="dark"` only when the resolved
 *     theme is dark; `src/index.css` maps `.dark` to the dark token set.
 *   - `color-scheme` (meta + inline style) and `theme-color` follow the
 *     resolved theme so browser chrome matches.
 *   - `"system"` is never written to the DOM: it always resolves through
 *     `matchMedia("(prefers-color-scheme: dark)")`, and a live `change` listener
 *     re-applies while it is selected.
 */

import { STORAGE_KEYS, loadThemePreference, saveThemePreference } from "../store/persistence";

/** The preference the user picks. */
export type Theme = "light" | "dark" | "system";

/** The concrete appearance actually rendered (`system` already resolved). */
export type ResolvedTheme = "light" | "dark";

/** localStorage key for the appearance preference (`ielts.theme.v1`). */
export const STORAGE_KEY = STORAGE_KEYS.theme;

/** Theme colors for the browser chrome (mirrors index.html). */
export const LIGHT_THEME_COLOR = "#F5F5F7";
export const DARK_THEME_COLOR = "#000000";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Stored preference; `"system"` when absent, corrupt or stale-schema. */
export function getStoredTheme(): Theme {
  return loadThemePreference();
}

export function setStoredTheme(theme: Theme): void {
  saveThemePreference(theme);
}

/** One-shot read of the OS appearance; `false` when matchMedia is unavailable. */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/** Collapse a stored preference + OS state into the appearance to render. */
export function resolveTheme(stored: Theme, matchesDark: boolean): ResolvedTheme {
  if (stored === "system") return matchesDark ? "dark" : "light";
  return stored;
}

/** `resolveTheme` against the current OS state. */
export function resolveCurrentTheme(stored: Theme): ResolvedTheme {
  return resolveTheme(stored, systemPrefersDark());
}

/**
 * Reflect a resolved theme in the DOM: `<html class="dark">`, `color-scheme`
 * (meta + inline style so UA controls and scrollbars follow) and the
 * `theme-color` meta the browser paints its chrome with.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (schemeMeta) schemeMeta.setAttribute("content", resolved);

  const themeColor = resolved === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute("media");
    meta.setAttribute("content", themeColor);
  });
}

/**
 * Observe OS appearance changes. `listener` receives the new
 * `(prefers-color-scheme: dark)` state; returns an unsubscribe function.
 * The listener is not called on subscribe — callers resolve the initial state
 * with `resolveTheme` / `systemPrefersDark` first.
 */
export function subscribeSystem(listener: (matchesDark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => listener(event.matches);
  media.addEventListener("change", handler);
  return () => media.removeEventListener("change", handler);
}
