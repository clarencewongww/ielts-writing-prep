/** @type {import('tailwindcss').Config} */
// Tailwind v3.4 classic config (deliberately not v4) so the CSS pipeline stays
// predictable for every downstream step. System font stack only — no network fonts.
//
// Step 4 token system: every color is a semantic CSS custom property declared in
// `src/index.css` (`:root`, dark, and increase-contrast variants). Components ask
// for a role (`bg-surface`, `text-ink-2`, `bg-tint-fill`), never a literal hue.
// Contrast figures for each token live in the index.css header.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        // Tabular numerals for the timer, word count and band scores come from
        // the system mono stack (typography.md › Using system fonts).
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      colors: {
        // surface / content — the two background tiers (color.md › Mobile).
        surface: "rgb(var(--surface) / <alpha-value>)",
        content: "rgb(var(--content) / <alpha-value>)",
        // ink — foreground text hierarchy. ink-3 is decorative/disabled only.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          2: "rgb(var(--ink-2) / <alpha-value>)",
          3: "rgb(var(--ink-3) / <alpha-value>)",
        },
        // tint — the one accent (#0071E3 Apple blue). Means interactive or
        // selected, nothing else (color.md › Best practices).
        tint: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          fill: "rgb(var(--accent-fill) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          strong: "rgb(var(--accent-strong) / <alpha-value>)",
        },
        // line — separators and card borders.
        line: {
          DEFAULT: "rgb(var(--line) / <alpha-value>)",
          soft: "rgb(var(--line-soft) / <alpha-value>)",
        },
        // warn / danger / ok — status only: score caps, deadlines, submitted.
        warn: {
          DEFAULT: "rgb(var(--warn) / <alpha-value>)",
          soft: "rgb(var(--warn-soft) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          fill: "rgb(var(--danger-fill) / <alpha-value>)",
          soft: "rgb(var(--danger-soft) / <alpha-value>)",
        },
        ok: {
          DEFAULT: "rgb(var(--ok) / <alpha-value>)",
          soft: "rgb(var(--ok-soft) / <alpha-value>)",
        },
        // paper — fixed figure surface: charts are recreated exam artifacts
        // (printed paper), so they keep one light surface in both appearances.
        paper: "rgb(var(--paper) / <alpha-value>)",
      },
      borderRadius: {
        // Continuous-corner feel: 16px cards, 10px controls, pills for actions.
        card: "1rem",
        control: "0.625rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12)",
        pop: "0 12px 32px -8px rgb(0 0 0 / 0.24)",
      },
      fontSize: {
        // Type roles (typography.md › Conveying hierarchy). iOS body default
        // 17 pt translates to 17px; 11px caption stays a floor for micro labels.
        display: ["2.125rem", { lineHeight: "2.625rem", letterSpacing: "-0.02em" }],
        "display-lg": ["2.5rem", { lineHeight: "3rem", letterSpacing: "-0.02em" }],
        title: ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.02em" }],
        title2: ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        headline: ["1.0625rem", { lineHeight: "1.375rem" }],
        body: ["1.0625rem", { lineHeight: "1.625rem" }],
        subhead: ["0.9375rem", { lineHeight: "1.375rem" }],
        footnote: ["0.8125rem", { lineHeight: "1.25rem" }],
        caption: ["0.75rem", { lineHeight: "1rem" }],
      },
      transitionTimingFunction: {
        // One easing for the whole app: 150ms ease-out state changes.
        apple: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};
