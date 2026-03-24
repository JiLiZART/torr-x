# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files:**
- PascalCase for React components: `Header.tsx`, `TorrentItem.tsx`, `AddTorrent.tsx`
- camelCase for utility/service files: `torrent-api.ts`, `mock_data.ts`, `utils.ts`
- CSS files use PascalCase matching component: `App.css`

**Functions:**
- PascalCase for React component functions: `export function Header()`, `export function TorrentList()`
- camelCase for handler/utility functions: `handleStartEdit()`, `handleDragOver()`, `handleCommand()`, `formatEta()`
- Internal class methods use camelCase: `setBackend()`, `addTorrent()`, `getTorrents()`
- Leading "handle" prefix for event handlers: `handleMenuClick()`, `handleActionClick()`, `handleFinishEdit()`

**Variables:**
- camelCase for all variables and constants: `activeTabId`, `searchQuery`, `downloadSpeed`, `isSubmitting`
- State variables typically use present tense: `fileName`, `selectedTorrent`, `terminalOpen`
- Boolean flags use verb prefixes: `isSelected`, `isDragging`, `isSubmitting`, `isDownloading`

**Types:**
- PascalCase for interfaces: `HeaderProps`, `TorrentListProps`, `DownloadOptions`, `FileItem`
- Interfaces use `Props` suffix for component props: `TabBarProps`, `TorrentDetailsProps`, `SettingsProps`
- Union types use camelCase with pipes: `type AddTorrentTab = "url" | "file" | "magnet"`
- Type aliases use PascalCase: `type SortColumn = ...`, `type SortDirection = ...`

## Code Style

**Formatting:**
- No explicit Prettier config found; uses default formatting
- Semicolons present in all statements
- Single quotes preferred: `import { useState } from 'react'`
- Double quotes for JSX attributes: `className="flex items-center"`

**Linting:**
- ESLint configured with TypeScript and React rules (`@typescript-eslint/eslint-plugin`)
- React Hooks plugin enabled (`eslint-plugin-react-hooks`)
- React Refresh plugin for fast refresh during development
- Rules file: `.eslintrc.cjs`
- Ignores: `dist/` and `.eslintrc.cjs` itself

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- No unused locals: `noUnusedLocals: true`
- No unused parameters: `noUnusedParameters: true`
- No implicit any
- Target: ES2020
- Module resolution: bundler

## Import Organization

**Order:**
1. React and external libraries: `import React from "react"`, `import { useState } from "react"`
2. Third-party UI libraries: `import { Search, Plus, Terminal } from "lucide-react"`
3. Local components: `import { Header } from "./components/Header"`
4. Local utilities/services: `import { torrentAPI } from "@/lib/torrent-api"`
5. Local types/interfaces: `import { DownloadOptions } from "./DownloadOptionsForm"`
6. CSS imports: `import "./index.css"`

**Path Aliases:**
- `@/` resolves to `./src/` (configured in `vite.config.ts`)
- Example: `import { cn } from "@/lib/utils"`

## Error Handling

**Patterns:**
- No try-catch blocks found in current codebase (async operations are handled via Tauri invoke)
- Console logging used for debug/action logging: `console.log()` statements in event handlers
- Status strings used to indicate state: `"Saving..."`, `"Settings saved successfully!"`
- Validation via condition checks before state updates
- Error state managed via component state: `const [error, setError] = useState("")`

**No formal error boundary or centralized error handling detected.** Errors are typically:
- Silently handled in event handlers with optional console.log
- Stored in state for display to user
- Not thrown or caught explicitly

## Logging

**Framework:** `console` (native)

**Patterns:**
- Debug actions: `console.log(\`Move torrent ${torrentId} to tab ${tabId}\`)`
- Action tracking: `console.log(\`Action: ${action} on torrent ${torrent.id}\`)`
- Minimal logging overall; mostly used for development debugging

## Comments

**When to Comment:**
- Inline comments used sparingly for non-obvious logic
- Mock data blocks include brief descriptions: `// Mock data for peers`
- Shuffle logic commented: `// Shuffle the array to make it look more realistic`
- Type comments for generated values: `// Convert bytes to human readable format`

**JSDoc/TSDoc:**
- No JSDoc blocks found in codebase
- Type annotations serve as documentation
- Interface definitions document prop shapes inline

**Example comment pattern:**
```typescript
// Generate mock piece status data (for GitHub-like graph)
const totalPieces = 200;
```

## Function Design

**Size:**
- Typical functions 5-40 lines
- Larger components like `TorrentDetails` (946 lines) split between UI and logic inline
- Event handlers kept small and focused

**Parameters:**
- Props passed as destructured object parameter
- Handler functions accept single event parameter
- No function overloading observed

**Return Values:**
- React components return JSX elements
- Event handlers return void
- API methods return Promises: `async getTorrents(): Promise<TorrentInfo[]>`

**Example function patterns:**
```typescript
const handleStartEdit = (tab: Tab) => {
  setEditingTabId(tab.id);
  setEditingName(tab.name);
};

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleFinishEdit();
  }
};

const formatEta = (torrent: TorrentInfo): string => {
  if (torrent.status === 'seeding') {
    return '-';
  }
  // ... more logic
};
```

## Module Design

**Exports:**
- Named exports preferred: `export function Header()`
- Singleton instances exported: `export const torrentAPI = new TorrentAPI()`
- Interfaces and types exported for use in other modules

**Barrel Files:**
- No barrel files (index.ts) used in components directory
- Direct imports from component files

**Class Design:**
- Single main class in service layer: `class TorrentAPI` wraps Tauri invoke calls
- Private methods for internal logic: `private formatEta()`
- Methods are async where calling external APIs

## Tailwind CSS

**Conventions:**
- All styling via Tailwind classes in JSX
- No CSS modules; single `App.css` exists for custom styles (minimal usage)
- Consistent color scheme: `text-green-400`, `bg-gray-950`, `border-green-900/30`
- Theme: Dark terminal aesthetic with green text on black background
- Spacing utilities: `space-x-1`, `space-y-1`, `px-3`, `py-2`
- Responsive not heavily used; component-focused sizing

---

*Convention analysis: 2026-03-24*
