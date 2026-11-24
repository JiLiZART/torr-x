// Theme tokens: colors come from CSS variables set per <html data-theme> in src/theme.css.
const v = (name) => `rgb(var(--tx-${name}) / <alpha-value>)`;
const scale = (prefix, keys) => Object.fromEntries(keys.map((k) => [k, v(`${prefix}-${k}`)]));

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
        tx: {
          base: v("base"),
          surface: scale("surface", [700, 800, 900, 950]),
          accent: scale("accent", [100, 300, 400, 500, 600, 700, 800, 900]),
        },
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
