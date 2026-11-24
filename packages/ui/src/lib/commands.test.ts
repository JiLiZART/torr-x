import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMMAND_FOR_ACTION, COMMAND_IDS, COMMANDS, QUERY_DEFAULT_ACTIONS } from "./commands.ts";
import { commandFor, eventBinding, keyCaps, matchBinding, usableKeys } from "./keymap.ts";
import { detectMode, rank } from "./palette.ts";

const components = join(dirname(fileURLToPath(import.meta.url)), "../components");

test("every rendered action button is a registered command", () => {
  const used = new Set<string>();
  for (const file of readdirSync(components).filter((f) => f.endsWith(".tsx"))) {
    for (const m of readFileSync(join(components, file), "utf8").matchAll(/data-command=(?:"([^"]+)"|\{"([^"]+)"\})/g)) used.add(m[1] ?? m[2]);
  }
  assert.ok(used.size >= 10, `expected tagged buttons, found ${[...used]}`);
  for (const id of used) assert.ok(COMMAND_IDS.has(id), `button data-command="${id}" has no registry entry`);
  for (const id of [...Object.values(COMMAND_FOR_ACTION), ...QUERY_DEFAULT_ACTIONS]) assert.ok(COMMAND_IDS.has(id), id);
  assert.equal(COMMAND_IDS.size, COMMANDS.length, "ids are unique");
});

test("no two commands share a binding", () => {
  for (const mac of [true, false]) {
    const seen = new Map<string, string>();
    for (const def of COMMANDS) {
      for (const key of def.keys) {
        const caps = keyCaps(key, mac).join("+");
        assert.ok(!seen.has(caps), `${caps}: ${seen.get(caps)} and ${def.id}`);
        seen.set(caps, def.id);
      }
    }
  }
});

test("key caps follow the platform", () => {
  assert.deepEqual(keyCaps("Mod+Shift+P", true), ["⌘", "⇧", "P"]);
  assert.deepEqual(keyCaps("Mod+Shift+P", false), ["Ctrl", "Shift", "P"]);
  assert.deepEqual(keyCaps("Alt+F", false), ["Alt", "F"]);
  assert.deepEqual(keyCaps("Ctrl+`", true), ["⌃", "`"]);
  assert.deepEqual(keyCaps("Ctrl+`", false), ["Ctrl", "`"]);
  assert.deepEqual(keyCaps("Mod+Backspace", true), ["⌘", "⌫"]);
});

const key = (code: string, k: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}, target: EventTarget | null = null) => ({
  code,
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  target,
  ...mods,
});

test("events match bindings on both platforms", () => {
  assert.equal(eventBinding(key("KeyP", "∏", { metaKey: true, altKey: true }), true), "Mod+Alt+P");
  assert.equal(eventBinding(key("KeyP", "P", { ctrlKey: true, shiftKey: true }), false), "Mod+Shift+P");
  assert.equal(matchBinding("Mod+1…9", "Mod+4", true), 4);
  assert.equal(matchBinding("Mod+1…9", "Mod+Shift+4", true), null);
  assert.equal(matchBinding("Ctrl+`", "Mod+`", false), true);
  assert.equal(matchBinding("Ctrl+`", "Mod+`", true), null);
  const opts = { mac: true, desktop: true };
  assert.equal(commandFor(key("KeyP", "P", { metaKey: true, shiftKey: true }), COMMANDS, opts)?.def.id, "tab.pauseAll");
  assert.equal(commandFor(key("Digit3", "3", { metaKey: true }), COMMANDS, opts)?.arg, 3);
  assert.equal(commandFor(key("Space", " "), COMMANDS, opts)?.def.id, "sel.pause");
});

test("browser-reserved bindings fall back", () => {
  assert.deepEqual(usableKeys(["Mod+T", "Mod+P"], false), ["Mod+P"]);
  assert.deepEqual(usableKeys(["Mod+T", "Mod+P"], true), ["Mod+T", "Mod+P"]);
  const tabNew = COMMANDS.find((c) => c.id === "tab.new")!;
  assert.deepEqual(usableKeys(tabNew.keys, false), ["Alt+Shift+T"]);
  const browser = { mac: true, desktop: false };
  assert.equal(commandFor(key("KeyT", "t", { metaKey: true }), COMMANDS, browser), null);
  assert.equal(commandFor(key("KeyP", "p", { metaKey: true }), COMMANDS, browser)?.def.id, "palette.open");
});

test("typing guard: no shortcut fires from a text field unless it has a modifier", () => {
  // node has no DOM; a stand-in that `isTextField` recognizes.
  class Field {
    isContentEditable = false;
    matches = () => true;
  }
  (globalThis as { HTMLElement?: unknown }).HTMLElement = Field;
  const input = new Field() as unknown as EventTarget;
  const opts = { mac: true, desktop: true };
  assert.equal(commandFor(key("KeyP", "p", {}, input), COMMANDS, opts), null);
  assert.equal(commandFor(key("Space", " ", {}, input), COMMANDS, opts), null);
  assert.equal(commandFor(key("KeyZ", "z", { metaKey: true }, input), COMMANDS, opts), null, "⌘Z undoes text in a field");
  assert.equal(commandFor(key("KeyK", "k", { metaKey: true }, input), COMMANDS, opts)?.def.id, "sheet.open");
  delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
});

test("mode detection: plain text jumps, a structured query groups", () => {
  assert.equal(detectMode("paus").kind, "jump");
  assert.equal(detectMode("ubuntu iso").kind, "jump");
  assert.equal(detectMode("state:paused").kind, "query");
  assert.equal(detectMode("!tag:4k size:>4GB").kind, "query");
  assert.equal(detectMode("statu:active").kind, "jump", "a parse error never switches modes");
  assert.deepEqual(detectMode("> pause"), { kind: "command", text: "pause" });
});

test("jump ranking: prefix, then word prefix, then substring", () => {
  const names = ["Fedora-archive.iso", "archlinux-2025.11.01-x86_64.iso", "monarch.mkv", "debian.iso"];
  assert.deepEqual(
    rank(names, "arch", (n) => [n]),
    ["archlinux-2025.11.01-x86_64.iso", "Fedora-archive.iso", "monarch.mkv"],
  );
  const tabs = [{ name: "Seeding", pinned: false }, { name: "Seed box", pinned: true }];
  assert.deepEqual(
    rank(tabs, "seed", (t) => [t.name], (t) => (t.pinned ? 1 : 0)).map((t) => t.name),
    ["Seed box", "Seeding"],
  );
  assert.equal(rank(names, "", (n) => [n]).length, 4);
});
