import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COMMAND_FOR_ACTION, COMMAND_IDS, COMMANDS } from "./commands.ts";
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
  for (const id of Object.values(COMMAND_FOR_ACTION)) assert.ok(COMMAND_IDS.has(id), id);
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

test("palette chips: @ files, torrent picker, scope and Backspace", async () => {
  const { dropChip, fileResults, paletteMode, pickTorrent, typeInto } = await import("./palette.ts");
  const empty = { chips: [], text: "" };
  // `@` then Space enters file mode; `@` elsewhere is text.
  let s = typeInto(typeInto(empty, "@"), "@ ");
  assert.deepEqual(s, { chips: [{ kind: "files" }], text: "" });
  assert.equal(paletteMode(s).kind, "files");
  assert.deepEqual(typeInto({ chips: [], text: "foo " }, "foo @ "), { chips: [], text: "foo @ " });
  assert.equal(paletteMode(typeInto(empty, "@")).kind, "jump", "a lone @ is still text");
  // `>` keeps working.
  assert.deepEqual(typeInto(empty, ">pa"), { chips: [{ kind: "command" }], text: "pa" });

  // `torrent:` + Space opens the picker and keeps the file query for later.
  s = typeInto(s, "s01 torrent: ");
  assert.deepEqual(s.chips.at(-1), { kind: "torrentPending", rest: "s01" });
  assert.equal(paletteMode(s).kind, "pickTorrent");
  const picked = pickTorrent(typeInto(s, "exp"), { id: "ab", name: "The Expanse S01" });
  assert.deepEqual(picked, { chips: [{ kind: "files" }, { kind: "torrent", id: "ab", name: "The Expanse S01" }], text: "s01" });
  const mode = paletteMode(picked);
  assert.ok(mode.kind === "files" && mode.scope?.id === "ab");
  // Without the Space it is a predicate, not the picker.
  assert.equal(typeInto({ chips: [{ kind: "files" }], text: "" }, "torrent:ubuntu").chips.length, 1);

  // Backspace on empty pops chips in order; dropping the picker gives the query back.
  assert.deepEqual(dropChip(s), { chips: [{ kind: "files" }], text: "s01" });
  assert.deepEqual(dropChip({ ...picked, text: "" }), { chips: [{ kind: "files" }], text: "" });
  assert.deepEqual(dropChip({ chips: [{ kind: "files" }], text: "" }), empty);

  // On a torrent's page, file mode starts scoped to it.
  const here = typeInto(empty, "@ ", { id: "cd", name: "Ubuntu" });
  assert.deepEqual(here.chips, [{ kind: "files" }, { kind: "torrent", id: "cd", name: "Ubuntu" }]);
  assert.deepEqual(dropChip(here).chips, [{ kind: "files" }], "Backspace widens to all torrents");

  // Results: hint without scope or query, file order when scoped, name score ranking, cap.
  const hit = (torrentId: string, index: number, path: string) => ({ torrentId, torrentName: torrentId === "ab" ? "The Expanse S01" : "Other", index, path, size: 1, progress: 0, wanted: true, priority: "normal" as const });
  const hits = [hit("ab", 0, "S01/e04.srt"), hit("ab", 1, "S01/x-e04.mkv"), hit("cd", 0, "e04-other.mkv")];
  const files = (input: { chips: never[] | object[]; text: string }) => paletteMode(input as never) as Extract<ReturnType<typeof paletteMode>, { kind: "files" }>;
  assert.equal(fileResults(hits, files({ chips: [{ kind: "files" }], text: "" })), null);
  assert.deepEqual(fileResults(hits, files({ ...picked, text: "" }))!.rows.map((r) => r.index), [0, 1]);
  assert.deepEqual(fileResults(hits, files({ chips: [{ kind: "files" }], text: "e04" }))!.rows.map((r) => r.name), ["e04.srt", "e04-other.mkv", "x-e04.mkv"]);
  assert.deepEqual(fileResults(hits, files({ chips: [{ kind: "files" }], text: "e04 ext:mkv" }))!.rows.map((r) => r.torrentId), ["cd", "ab"]);
  const many = Array.from({ length: 60 }, (_, i) => hit("ab", i, `f${i}.txt`));
  const capped = fileResults(many, files({ chips: [{ kind: "files" }], text: "f" }))!;
  assert.equal(capped.rows.length, 50);
  assert.equal(capped.more, 10);
});
