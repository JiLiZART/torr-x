// The command registry: every GUI command, its scope and its key bindings, in one table. The palette,
// the global keymap, the list's keys and the shortcut sheet all read it; App supplies the handlers.
// Labels are i18n keys `cmd.<id>`.

export type Scope = "selection" | "tab" | "global";
export type Group = "palette" | "tabs" | "lens" | "list" | "navigation";

export interface CommandDef {
  id: string;
  group: Group;
  scope: Scope;
  /** lucide-react icon name, resolved by the component that renders the row. */
  icon: string;
  /**
   * Bindings in canonical form (`Mod+Shift+P`, `Ctrl+\``, `F2`, `Mod+1…9`), most preferred first.
   * `Mod` is ⌘ on macOS and Ctrl elsewhere. Later entries are fallbacks where a browser reserves the first.
   */
  keys: string[];
  /** Handled by the focused surface (the list's row cursor, Space, ⏎; the chip row); never global. */
  local?: boolean;
  /** Not fired while typing in a text field, even with a modifier (⌘Z, ⌘A, ⌘⌫ edit text there). */
  textEditing?: boolean;
  /** Not offered as a palette row (cursor moves, the palette itself). */
  hidden?: boolean;
}

const def = (id: string, group: Group, scope: Scope, icon: string, keys: string[] = [], more: Partial<CommandDef> = {}): CommandDef => ({
  id,
  group,
  scope,
  icon,
  keys,
  ...more,
});

export const COMMANDS: CommandDef[] = [
  // One surface: Spotlight, the command palette (`>`) and New tab are the same panel.
  def("palette.open", "palette", "global", "Search", ["Mod+T", "Mod+P"], { hidden: true }),
  def("palette.commands", "palette", "global", "ChevronRight", [], { hidden: true }),
  def("sheet.open", "palette", "global", "Keyboard", ["Mod+K"]),
  def("torrent.add", "palette", "global", "FilePlus", ["Mod+O"]),

  def("tab.jump", "tabs", "global", "Hash", ["Mod+1…9"], { hidden: true }),
  def("tab.next", "tabs", "global", "ChevronDown", ["Ctrl+Tab", "Alt+ArrowDown"]),
  def("tab.prev", "tabs", "global", "ChevronUp", ["Ctrl+Shift+Tab", "Alt+ArrowUp"]),
  def("tab.new", "tabs", "global", "Plus", ["Mod+Shift+T", "Alt+Shift+T"]),
  def("tab.save", "tabs", "tab", "Save", ["Mod+S"]),
  def("tab.rename", "tabs", "tab", "Pencil", ["F2"]),
  def("tab.moveUp", "tabs", "tab", "ArrowUp", ["Mod+Ctrl+ArrowUp"]),
  def("tab.moveDown", "tabs", "tab", "ArrowDown", ["Mod+Ctrl+ArrowDown"]),
  def("sidebar.toggle", "tabs", "global", "PanelLeft", ["Mod+B"]),

  def("filter.focus", "lens", "tab", "Search", ["Mod+F"]),
  def("builder.open", "lens", "tab", "Funnel", ["Alt+F"]),
  def("lens.clear", "lens", "tab", "FunnelX", ["Mod+Shift+K"]),
  def("lens.undo", "lens", "tab", "Undo2", ["Mod+Z"], { textEditing: true }),
  def("chip.prev", "lens", "tab", "ArrowLeft", ["ArrowLeft"], { local: true, hidden: true }),
  def("chip.next", "lens", "tab", "ArrowRight", ["ArrowRight"], { local: true, hidden: true }),
  def("chip.remove", "lens", "tab", "X", ["Backspace"], { local: true, hidden: true }),

  def("list.down", "list", "tab", "ArrowDown", ["ArrowDown"], { local: true, hidden: true }),
  def("list.up", "list", "tab", "ArrowUp", ["ArrowUp"], { local: true, hidden: true }),
  def("list.extendDown", "list", "tab", "ArrowDown", ["Shift+ArrowDown"], { local: true, hidden: true }),
  def("list.extendUp", "list", "tab", "ArrowUp", ["Shift+ArrowUp"], { local: true, hidden: true }),
  def("list.selectAll", "list", "tab", "ListChecks", ["Mod+A"], { textEditing: true }),
  def("list.open", "list", "selection", "PanelBottomOpen", ["Enter"], { local: true }),
  def("sel.pause", "list", "selection", "Pause", ["Space"], { local: true }),
  def("sel.resume", "list", "selection", "Play"),
  def("tab.pauseAll", "list", "tab", "Pause", ["Mod+Shift+P"]),
  def("tab.resumeAll", "list", "tab", "Play", ["Mod+Shift+R"]),
  def("all.pause", "list", "global", "CirclePause", ["Mod+Alt+P"]),
  def("all.resume", "list", "global", "CirclePlay", ["Mod+Alt+R"]),
  def("sel.remove", "list", "selection", "Trash2", ["Mod+Backspace"], { textEditing: true }),
  def("sel.erase", "list", "selection", "Trash", ["Mod+Alt+Backspace"], { textEditing: true }),
  def("sel.tags", "list", "selection", "Tag", ["Mod+L", "Alt+L"]),
  def("sel.verify", "list", "selection", "CheckCircle"),
  def("sel.reveal", "list", "selection", "FolderOpen"),
  def("sel.relocate", "list", "selection", "FolderInput"),
  def("sel.rename", "list", "selection", "Edit3"),
  def("sel.torrentFile", "list", "selection", "Save"),
  def("sel.magnet", "list", "selection", "Link2"),

  def("nav.back", "navigation", "global", "ChevronLeft", ["Mod+["]),
  def("nav.forward", "navigation", "global", "ChevronRight", ["Mod+]"]),
  def("settings.open", "navigation", "global", "Settings", ["Mod+,"]),
  def("terminal.toggle", "navigation", "global", "SquareTerminal", ["Ctrl+`"]),
  def("density.toggle", "navigation", "global", "Rows3"),
  def("auth.logout", "navigation", "global", "LogOut"),
];

export type CommandId = (typeof COMMANDS)[number]["id"];
export const COMMAND_IDS = new Set(COMMANDS.map((c) => c.id));
export const commandById = (id: string) => COMMANDS.find((c) => c.id === id);

/** Row menu actions. */
export type TorrentAction =
  | "pause"
  | "resume"
  | "remove"
  | "erase"
  | "reveal"
  | "relocate"
  | "rename"
  | "torrentFile"
  | "magnet"
  | "verify"
  | "tags";

/** Every row action is a registered selection command. */
export const COMMAND_FOR_ACTION: Record<TorrentAction, string> = {
  pause: "sel.pause",
  resume: "sel.resume",
  remove: "sel.remove",
  erase: "sel.erase",
  reveal: "sel.reveal",
  relocate: "sel.relocate",
  rename: "sel.rename",
  torrentFile: "sel.torrentFile",
  magnet: "sel.magnet",
  verify: "sel.verify",
  tags: "sel.tags",
};

/** ACTIONS shown for a structured query when no command label matches the typed words. */
export const QUERY_DEFAULT_ACTIONS = ["sel.pause", "tab.pauseAll", "all.pause", "tab.resumeAll"];

/** What App supplies per command: how to run it, and why it cannot run right now. */
export interface Handler {
  run: (arg?: number) => void;
  /** A reason shown next to the disabled row; null or absent when it can run. */
  disabled?: string | null;
  /** Not applicable at all here (e.g. log out with auth off). */
  unavailable?: boolean;
}

export type Handlers = Record<string, Handler>;
