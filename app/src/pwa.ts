/**
 * Progressive Web App wiring — installability and the service worker lifecycle.
 *
 * Imported for side effects by `src/main.tsx`; it never renders React and never
 * touches exam state. Three jobs, in order of user impact:
 *
 * 1. INSTALL — Chrome/Edge fire `beforeinstallprompt` when the manifest, icons,
 *    service worker and start_url all satisfy the install criteria. We swallow
 *    the event so the browser's own mini-infobar stays out of the exam hall, and
 *    expose the deferred event through `promptInstall()` / `useInstallPrompt()`
 *    for an "Install app" button to wire up later. iOS never fires it; there the
 *    user installs from Share → Add to Home Screen (the metas in index.html are
 *    what make that produce a standalone window).
 *
 * 2. OFFLINE — registration is production-only (`import.meta.env.PROD`): the dev
 *    server has no `sw.js` to serve, and a worker cached from `vite preview`
 *    would shadow live edits on the same port. The worker itself precaches the
 *    shell + `bank/*.json` (see vite.config.ts).
 *
 * 3. UPDATES — a rebuilt `sw.js` installs and waits. We show a "New version —
 *    reload" toast and only post `SKIP_WAITING` when the user taps Reload, so a
 *    60-minute exam is never swapped or reloaded under the candidate mid-task.
 *    `clientsClaim` in the worker means the tap takes effect on the next load
 *    without needing a second visit.
 */

import { useEffect, useState } from "react";

/** The Chromium `beforeinstallprompt` event, which TS does not ship yet. */
export type InstallPromptEvent = Event & {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};

/** Where the worker is emitted (`vite.config.ts` → workbox `filename`). */
const SERVICE_WORKER_URL = "./sw.js";
const UPDATE_TOAST_ID = "pwa-update-toast";

/* ------------------------------------------------------------- install ---- */

let deferredPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<(available: boolean) => void>();

function notifyInstallListeners(): void {
  const available = deferredPrompt !== null;
  installListeners.forEach((listener) => listener(available));
}

/** True when the app is already running from the home screen / app window. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (iosStandalone) return true;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** True while a captured `beforeinstallprompt` event is available to replay. */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Subscribe to install availability (`true` after the browser signals the app is
 * installable, `false` once it has been installed). Returns an unsubscribe.
 */
export function subscribeInstallAvailability(listener: (available: boolean) => void): () => void {
  installListeners.add(listener);
  listener(canInstall());
  return () => {
    installListeners.delete(listener);
  };
}

/**
 * Show the browser's install prompt. Resolves `"unavailable"` when no event was
 * captured (Safari/Firefox, already installed, or dismissed for good), so a
 * caller can fall back to instructions instead of failing silently.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferredPrompt;
  if (!event) return "unavailable";
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // The event is single-use: a second prompt() call rejects.
    deferredPrompt = null;
    notifyInstallListeners();
    return outcome;
  } catch (error) {
    console.warn("[pwa] install prompt failed", error);
    deferredPrompt = null;
    notifyInstallListeners();
    return "unavailable";
  }
}

/**
 * Hook form of the two helpers above, for an "Install app" button:
 *
 *   const { canInstall, promptInstall } = useInstallPrompt();
 *   {canInstall && <button onClick={() => promptInstall()}>Install app</button>}
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  isStandalone: boolean;
  promptInstall: typeof promptInstall;
} {
  const [available, setAvailable] = useState(() => canInstall());
  const [standalone, setStandalone] = useState(() => isStandalone());

  useEffect(() => subscribeInstallAvailability(setAvailable), []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(display-mode: standalone)");
    const onChange = (event: MediaQueryListEvent) => setStandalone(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return { canInstall: available, isStandalone: standalone, promptInstall };
}

function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the default browser UI suppressed; we decide when to ask.
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notifyInstallListeners();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyInstallListeners();
  });
}

/* -------------------------------------------------------------- updates ---- */

let updateToastShown = false;
let reloadRequested = false;

function removeUpdateToast(): void {
  document.getElementById(UPDATE_TOAST_ID)?.remove();
}

/** Reload as soon as the new worker controls the page (or after a short grace). */
function reloadWhenControlled(): void {
  if (reloadRequested) return;
  reloadRequested = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  });
  // Safety net: if the worker was already active (controllerchange spent), or a
  // browser does not deliver it, the user still gets the version they asked for.
  window.setTimeout(() => window.location.reload(), 2000);
}

function showUpdateToast(registration: ServiceWorkerRegistration): void {
  if (updateToastShown || document.getElementById(UPDATE_TOAST_ID)) return;
  updateToastShown = true;

  const toast = document.createElement("div");
  toast.id = UPDATE_TOAST_ID;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.className = [
    "fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-1",
    "max-w-[calc(100vw-2rem)] rounded-full border border-line bg-content py-1.5 pl-4 pr-1.5",
    "text-ink shadow-pop",
    // Clear the home indicator on a phone held in any orientation.
    "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
  ].join(" ");

  const text = document.createElement("span");
  text.className = "text-subhead";
  text.textContent = "New version — reload to update.";

  const reload = document.createElement("button");
  reload.type = "button";
  reload.className = [
    "min-h-[44px] rounded-full bg-tint-fill px-4 text-subhead font-semibold text-white",
    "transition-colors ease-apple hover:bg-tint-strong",
  ].join(" ");
  reload.textContent = "Reload";
  reload.addEventListener("click", () => {
    reload.disabled = true;
    reloadWhenControlled();
    // The worker listens for this exact message (workbox template).
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  });

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = [
    "min-h-[44px] rounded-full px-3 text-subhead text-ink-2",
    "transition-colors ease-apple hover:text-ink",
  ].join(" ");
  dismiss.textContent = "Later";
  dismiss.setAttribute("aria-label", "Dismiss update notice");
  dismiss.addEventListener("click", () => {
    updateToastShown = false;
    removeUpdateToast();
  });

  toast.append(text, reload, dismiss);
  document.body.append(toast);
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register(SERVICE_WORKER_URL, { scope: "./", updateViaCache: "none" })
    .then((registration) => {
      // A worker can already be waiting when the page loads (reload while an
      // update was pending, or another tab triggered it).
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(registration);
        return;
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // No controller means this is the first install, not an update.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateToast(registration);
          }
        });
      });
    })
    .catch((error: unknown) => {
      // Offline-only first visits and private modes can block registration; the
      // app itself does not depend on the worker, so this stays a warning.
      console.warn("[pwa] service worker registration failed", error);
    });
}

/* ---------------------------------------------------------------- boot ---- */

if (typeof window !== "undefined") {
  captureInstallPrompt();
  if (import.meta.env.PROD) registerServiceWorker();
}
