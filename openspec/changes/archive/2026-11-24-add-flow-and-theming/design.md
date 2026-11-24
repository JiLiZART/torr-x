## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `spotlight-add-torrent.html`
  (04); `spotlight-light.html` (13); `active-tab-light.html` (14); `detail-view-light.html` (15);
  `active-tab-terminal-expanded-light.html` (16). Read it for layout, spacing and copy; each element carries
  its canvas name in `data-pencil-name`. Colors there are resolved hex values: map them back to theme tokens,
  never copy the hex. Board B has no export; use `pen/untitled.pen` for it.
- Source frames: 04 (Spotlight → Add Torrent expanded), 13–16 (light parity); board B
  (the six-frame transform wireframes).
- `active-tab-screen` provides the shell, tokens usage, query and file-scoped fields; `command-palette-screen`
  provides the panel and its mode detection; the add flow is a third mode of that same panel.
- Current code: `AddTorrent.tsx` modal with URL/file/magnet tabs; `preferences.theme` enum in `config.rs`.

## Goals / Non-Goals

**Goals:** one surface for adding (no dialog on top of the palette); a fresh install that orientates instead of
showing an empty table; every surface legible in both modes from one token ramp.

**Non-Goals:** the fit warning and provenance (`add-preflight-and-provenance`), streaming, settings page
(`settings-page-screen`), per-mode artwork.

## Decisions

1. **Expansion, not navigation.** A magnet/URL in the palette input, a chosen file or a window-wide drop
   switches the panel to add mode: same top edge and input, content grows downward (max height with internal
   scroll). Escape collapses back to input-only; nothing is added until a footer action. The panel's mode
   detector treats magnet/`.torrent` payloads as add mode before query parsing.
2. **Preview drives everything.** `POST /torrents/preview` (existing from the vendor port) supplies name, size,
   hash, files, trackers; the file list reuses the section mini filter bar with file fields; checked state
   survives filtering. While metadata is pending the panel shows a loading line at constant height, then the
   "add anyway" offer after 30 s.
3. **One ramp, two modes.** `--tx-*`/`$ui-*` tokens defined once per mode in `theme.css`; Tailwind preset maps
   them; components use tokens only (lint rule against literal colors in `packages/ui`). `appearance.mode:
   system` subscribes to `prefers-color-scheme` live; accent swaps the accent ramp only.
4. **Migration is lossless and one-way.** `hacker → dark/green`, `dark-blue → dark/cyan`, `light → light`,
   `useSystemTheme → system`; old keys removed from the served settings; a test loads each legacy combination.
5. **Fonts self-hosted.** Inter + JetBrains Mono woff2 served by the server (rust-embed), `font-display: swap`;
   no external font host ever requested.

## Risks / Trade-offs

- **Panel height jumps on expansion.** → Top edge pinned, loading line at constant height, max-height with
  internal scroll; the transform is the board B sequence.
- **Drops outside the palette.** → Window-wide drop handler opens the palette in add mode; drag-over shows the
  drop affordance on the list without changing the lens.
- **Token migration touches every component.** → Done inside this change with a lint guard; light frames 13–16
  are the acceptance checklist.
