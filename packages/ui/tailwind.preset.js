// Theme tokens: colors come from CSS variables set per <html data-theme> in src/theme.css.
const v = (name) => `rgb(var(--tx-${name}) / <alpha-value>)`;
const scale = (prefix, keys) => Object.fromEntries(keys.map((k) => [k, v(`${prefix}-${k}`)]));

export default {
  theme: {
    extend: {
      colors: {
        tx: {
          base: v("base"),
          surface: scale("surface", [700, 800, 900, 950]),
          accent: scale("accent", [100, 300, 400, 500, 600, 700, 800, 900]),
        },
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
