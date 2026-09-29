// Fails when a dictionary misses (or adds) keys relative to en.json, or drops a {placeholder}.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/i18n");
const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const en = load("en.json");
const vars = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
const errors = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const dict = load(file);
  for (const key of Object.keys(en)) {
    if (!(key in dict)) errors.push(`${file}: missing "${key}"`);
    else if (vars(dict[key]) !== vars(en[key])) errors.push(`${file}: placeholders differ in "${key}"`);
  }
  for (const key of Object.keys(dict)) if (!(key in en)) errors.push(`${file}: unknown key "${key}"`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("i18n: all dictionaries match en.json");
