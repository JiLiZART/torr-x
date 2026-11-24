// Theme tokens: colors come from CSS variables set per <html data-theme / data-accent> in src/theme.css.

// The canvas palette; values per theme live in src/theme.css.
const UI = [
  "bg",
  "chrome",
  "chrome-2",
  "surface",
  "surface-2",
  "surface-3",
  "border",
  "border-strong",
  "text",
  "text-2",
  "text-3",
  "accent",
  "accent-soft",
  "accent-line",
  "amber",
  "amber-soft",
  "cyan",
  "cyan-soft",
  "red",
  "red-soft",
  "violet",
];

export default {
  theme: {
    extend: {
      colors: {
        ui: Object.fromEntries(UI.map((name) => [name, `rgb(var(--ui-${name}) / <alpha-value>)`])),
      },
      fontFamily: {
        ui: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"],
        code: ['"JetBrains Mono Variable"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
};
