## 1. Query package

- [ ] 1.1 Registry metadata (`type`, `scope`, `examples`) for every field in the card; verify a test lists
      each field once with a parser case
- [ ] 1.2 Value groups `field:(a OR b)` in parser + formatter; typed values (`progress:<50`,
      `ratio:0..0.5`, `size:700MB..2GB`), open-enum `tag`; verify `node --test` for each form and the
      format round-trip
- [ ] 1.3 Unknown-field error always inline with suggestion; lens never rewrites tab text; verify tests
- [ ] 1.4 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 2. Reference card

- [ ] 2.1 `QueryReference` generated from the registry (fields table with scope, operators, sort, examples,
      rules); verify identical render in builder, palette and terminal
- [ ] 2.2 `⌘/` toggle from any query input; `⌘C` on chip row copies canonical text; verify cross-surface
      paste reproduces the chips

## 3. Keyboard sheet

- [ ] 3.1 Binding table as data with `{keys, label, scope, group, commandId}` for all six groups; hotkeys
      read it; verify a test for collisions within overlapping scopes
- [ ] 3.2 Scope enforcement (chip row, sidebar, drawer, list, detail) and typing guard; verify `⌘⇧S` only
      acts with the chip row focused
- [ ] 3.3 `ShortcutSheet` (`⌘K`) grouped by section with scope labels, platform modifiers and browser
      fallbacks; verify on macOS and Linux
- [ ] 3.4 Update the sidebar hint to `⌘⇧T` for new tab; i18n keys in six dictionaries; verify `pnpm lint`
      parity and manual keyboard-only pass over each group
