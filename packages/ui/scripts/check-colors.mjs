// Fails when a component picks a color outside the theme tokens (ui-*): Tailwind palette colors,
// the retired tx-* ramp, or hex literals. The macOS window dots are the one fixed exception.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../src");
const PALETTE = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white";
const CLASS = new RegExp(`\\b(?:bg|text|border|ring|fill|stroke|divide|placeholder|from|via|to|outline|decoration|caret|accent|shadow)-(?:tx-[a-z]+|(?:${PALETTE})(?:-\\d{2,3})?)\\b`, "g");
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const ALLOWED_HEX = new Set(["#FF5F57", "#FEBC2E", "#28C840"]);

const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [join(dir, e.name)] : []));
const errors = [];
for (const file of files(root)) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(CLASS)) errors.push(`${file.slice(root.length + 1)}:${i + 1}: ${m[0]}`);
    for (const m of line.matchAll(HEX)) if (!ALLOWED_HEX.has(m[0]) && /["'`\[]/.test(line)) errors.push(`${file.slice(root.length + 1)}:${i + 1}: ${m[0]}`);
  });
}
if (errors.length) {
  console.error(`colors outside the theme tokens:\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("colors: theme tokens only");
