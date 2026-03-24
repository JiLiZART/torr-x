# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Runner:**
- Not configured
- No Jest, Vitest, or other test runner found in dependencies

**Assertion Library:**
- Not configured

**Run Commands:**
- No test scripts defined in `package.json`
- Current build pipeline: `npm run build` (TypeScript + Vite build)
- Development: `npm run dev` (Vite dev server)

## Test File Organization

**Location:**
- No test files present in codebase
- Searched patterns: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Only test files found are in `node_modules/.pnpm/` (dependency tests)

**Naming:**
- No naming conventions established

**Structure:**
- Not applicable - no tests present

## Test Coverage

**Requirements:** None enforced

**Current State:** 0% coverage (no tests)

## Known Testing Gaps

**Untested Areas:**
- All React components: `Header.tsx`, `TorrentList.tsx`, `TorrentItem.tsx`, `AddTorrent.tsx`, `TorrentDetails.tsx`, `Settings.tsx`, `Terminal.tsx`, `TabBar.tsx`, `StatusBar.tsx`, `Sidebar.tsx`, `DownloadOptionsForm.tsx`
- Business logic in `TorrentAPI` class (`src/lib/torrent-api.ts`)
- Utility functions: `cn()` in `src/lib/utils.ts`
- State management and hooks in all components
- User interactions (drag/drop, form submissions, menu actions)
- Data formatting and calculations (e.g., `formatEta()`, progress calculations)

**Files most needing tests:**
- `src/components/TorrentList.tsx` (440 lines) - sorting, filtering, drag/drop logic
- `src/components/TorrentDetails.tsx` (946 lines) - file tree expansion, tab switching, data display
- `src/components/AddTorrent.tsx` (868 lines) - form validation, torrent info parsing, file selection
- `src/lib/torrent-api.ts` (86 lines) - ETA calculation, Tauri API calls
- `src/components/Settings.tsx` (402 lines) - form inputs, persistence

## Recommendations for Adding Tests

### Setup Steps:
1. Install test framework: `npm install -D vitest @testing-library/react @testing-library/jest-dom`
2. Create `vitest.config.ts` with React support
3. Create test files co-located with components: `Header.test.tsx` next to `Header.tsx`
4. Set up test environment configuration in `tsconfig.json` if needed

### Testing Strategy:

**Component Testing:**
```typescript
// Example pattern for testing components
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  it('renders search input', () => {
    const mockFn = vi.fn();
    render(<Header
      toggleTerminal={mockFn}
      toggleSettings={mockFn}
      toggleAddTorrent={mockFn}
      searchQuery=""
      setSearchQuery={mockFn}
    />);
    expect(screen.getByPlaceholderText('Search torrents...')).toBeInTheDocument();
  });
});
```

**Hooks Testing:**
```typescript
// Pattern for testing custom hooks and state logic
import { renderHook, act } from '@testing-library/react';

describe('TorrentList sorting', () => {
  it('should sort by column ascending', () => {
    // Test sort state changes
  });
});
```

**API Testing:**
```typescript
// Pattern for testing TorrentAPI class
import { describe, it, expect, vi } from 'vitest';
import { torrentAPI } from '@/lib/torrent-api';

describe('TorrentAPI.formatEta', () => {
  it('returns "-" for seeding torrents', () => {
    const torrent = { status: 'seeding', progress: 100 };
    expect(torrentAPI.formatEta(torrent)).toBe('-');
  });
});
```

## Current Testing State

**Status:** No testing infrastructure configured

**Why tests are missing:**
- Project appears to be early-stage (v0.1.0)
- Focus on UI prototyping with mock data
- No test scripts or frameworks installed
- No CI/CD pipeline requiring tests

**Test Debt Priority:**
- **High:** `TorrentAPI.formatEta()` - complex calculation, easy to unit test
- **High:** `TorrentList` sorting/filtering logic
- **Medium:** Component rendering and user interactions
- **Medium:** Form validation in `AddTorrent`, `Settings`
- **Low:** Presentational components like `StatusBar`, `Header`

---

*Testing analysis: 2026-03-24*
