/**
 * ThemeToggle — segmented Light | Dark | System appearance switcher.
 *
 * Self-contained by design (Step 2 imports this path from the setup screen):
 * with no props it reads the stored preference on mount, writes it on choice,
 * applies the resolved theme to <html>, and tracks OS changes live while
 * `system` is selected. `value` / `onChange` are optional so it can also be
 * driven by a parent without losing persistence.
 *
 * Accessibility: a single `role="group"` named "Appearance"; each option is a
 * toggle button with `aria-pressed`, a 44px target, visible text label and a
 * decorative icon; focus uses the app-wide accent ring.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  subscribeSystem,
  systemPrefersDark,
  type Theme,
} from "./theme";

export interface ThemeToggleProps {
  /** Controlled preference; omit for the self-contained (stored) behaviour. */
  value?: Theme;
  /** Called with the chosen preference after it is applied and persisted. */
  onChange?: (theme: Theme) => void;
}

interface ThemeOption {
  value: Theme;
  label: string;
  icon: ReactNode;
}

const OPTIONS: readonly ThemeOption[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "system", label: "System", icon: <SystemIcon /> },
];

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const [stored, setStored] = useState<Theme>(() => getStoredTheme());
  const theme = value ?? stored;

  /* Resolve -> class + metas; while `system` is selected, follow the OS live. */
  useEffect(() => {
    applyTheme(resolveTheme(theme, systemPrefersDark()));
    if (theme !== "system") return;
    return subscribeSystem((matchesDark) => applyTheme(resolveTheme("system", matchesDark)));
  }, [theme]);

  const select = (next: Theme) => {
    if (value === undefined) setStored(next);
    setStoredTheme(next);
    onChange?.(next);
  };

  return (
    <div
      role="group"
      aria-label="Appearance"
      data-testid="theme-toggle"
      className="flex shrink-0 items-center gap-1 rounded-full bg-ink/[0.04] p-1"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-testid={`theme-option-${option.value}`}
            aria-pressed={active}
            title={`${option.label} appearance`}
            onClick={() => select(option.value)}
            className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-footnote font-semibold transition-colors ease-apple focus-visible:outline-tint ${
              active ? "bg-tint-fill text-white" : "text-ink-2 hover:text-ink"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;

/* Decorative glyphs only: the label carries the meaning (aria-hidden). */

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
    </svg>
  );
}
