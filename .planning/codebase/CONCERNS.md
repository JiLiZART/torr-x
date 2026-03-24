# Codebase Concerns

**Analysis Date:** 2026-03-24

## Tech Debt

**Missing API Integration for Torrent Information:**
- Issue: `AddTorrent.tsx` contains a TODO comment at line 102 indicating getTorrentInfo API call is not implemented. Component currently uses placeholder/mock data instead of real torrent metadata.
- Files: `src/components/AddTorrent.tsx` (line 102)
- Impact: Users cannot see accurate torrent details (file count, total size, piece information) before downloading. File selection shows hardcoded mock data instead of actual torrent contents.
- Fix approach: Implement `getTorrentInfo` method in `src/lib/torrent-api.ts` that calls the Tauri backend to retrieve torrent metadata. Replace hardcoded mockFilesTree with dynamic data from API response.

**Mock Data Embedded in Components:**
- Issue: Multiple components use hardcoded mock data directly in component files instead of centralizing or fetching real data.
- Files: `src/components/TorrentList.tsx` (lines 70-206), `src/components/TorrentDetails.tsx` (lines 56-78), `src/components/mock_data.ts`
- Impact: Switching from mock to real data requires refactoring component code. Data is duplicated across multiple files. New developers may inadvertently use mock data in production paths.
- Fix approach: Create a mock data service layer that conditionally returns mock vs. real data based on environment. Move all mock torrents to centralized location with clear labeling. Add feature flag to disable mock mode in production.

**Unimplemented Move-to-Tab Functionality:**
- Issue: `App.tsx` line 105 shows move torrent to tab handler that only logs: `console.log(\`Move torrent ${torrentId} to tab ${tabId}\`)`. No actual state persistence or backend call.
- Files: `src/App.tsx` (line 104-106), `src/components/TorrentList.tsx` (line 327)
- Impact: Tab organization feature appears functional but doesn't persist. Users lose tab organization on refresh. Drag-and-drop UI exists but backend doesn't support the operation.
- Fix approach: Implement backend API methods for organizing torrents into tabs. Add state management to persist tab assignments. Replace console.log with actual API call.

**Remote Connection Settings Not Connected:**
- Issue: `Settings.tsx` contains Remote tab UI (lines 36-47) with form fields for hostname, port, auth credentials, but no connection logic or API calls implemented.
- Files: `src/components/Settings.tsx` (lines 36-47)
- Impact: Users cannot configure remote Transmission servers. Settings form collects credentials but discards them. False impression of supported functionality.
- Fix approach: Implement settings persistence (localStorage or Tauri config). Add backend API integration to test remote connection. Add validation for hostname/port format.

**Weak Type Safety with `any`:**
- Issue: Multiple files use TypeScript's `any` type, defeating type checking. `App.tsx` line 33 stores selectedTorrent as `any`. `TorrentDetails.tsx` line 34 accepts `torrent: any`. `TorrentList.tsx` callbacks use `any` for parameters.
- Files: `src/App.tsx` (line 33), `src/components/TorrentDetails.tsx` (line 34), `src/components/TorrentList.tsx` (line 37)
- Impact: Silent type mismatches at runtime. No IDE autocomplete for torrent properties. Refactoring becomes error-prone. Missing fields go undetected.
- Fix approach: Define strict Torrent interface matching TorrentInfo in `torrent-api.ts`. Replace all `any` with proper types. Use discriminated unions for different torrent states (downloading, seeding, paused, error).

**Platform-Specific Hardcoded Path:**
- Issue: `AddTorrent.tsx` line 86 hardcodes Windows download path: `"D:\\Downloads\\Torrents"`. Not cross-platform compatible.
- Files: `src/components/AddTorrent.tsx` (line 86)
- Impact: Non-Windows users see incorrect default path. Path picker shows Windows-style paths on Mac/Linux. Confuses users about system compatibility.
- Fix approach: Get default download directory from OS using Tauri. Use path.join() for cross-platform path construction. Detect OS and show appropriate default path.

**Inefficient Dependency Arrays in useEffect:**
- Issue: `AddTorrent.tsx` useEffect (lines 100-201) includes `fileName` and `url` in dependency array, causing re-execution every keystroke during input. Mock file tree regenerated on every state change.
- Files: `src/components/AddTorrent.tsx` (line 101, dependency: `[showFileSelection, fileName, url]`)
- Impact: Unnecessary re-renders and data regeneration. Poor performance on slower devices. Mock file tree state is recreated constantly.
- Fix approach: Only depend on `showFileSelection`. Move torrent info fetching to separate effect triggered only by user action, not input changes.

## Known Bugs

**Torrent Status Display Mismatch:**
- Symptoms: `TorrentList.tsx` filters by exact status match (line 259: `torrent.status !== "downloading"`), but status values like "checking" or "error" don't map to UI states.
- Files: `src/components/TorrentList.tsx` (lines 256-265)
- Trigger: Add torrent with "checking" or "error" status, use Downloading tab
- Workaround: Ensure backend only returns "downloading", "seeding", "paused" status values
- Fix approach: Add complete status filtering logic for all possible torrent states. Handle "checking" and "error" appropriately in tab filters.

**Mock Piece Status Shuffle Logic Issue:**
- Symptoms: `TorrentDetails.tsx` (lines 72-78) uses Fisher-Yates shuffle but assignment syntax is backwards: `[mockPieceStatus[i], mockPieceStatus[j]] = [mockPieceStatus[j], mockPieceStatus[i]]`. While this works in JavaScript due to destructuring, it's fragile and confusing.
- Files: `src/components/TorrentDetails.tsx` (lines 72-78)
- Trigger: Component renders piece visualization
- Workaround: None needed - works by accident due to destructuring
- Fix approach: Use standard swap pattern or array method: `const temp = mockPieceStatus[i]; mockPieceStatus[i] = mockPieceStatus[j]; mockPieceStatus[j] = temp;`

**Lost State on Tab Switch with Selected Torrent:**
- Symptoms: When `selectedTorrent` exists and user switches tabs, TorrentDetails panel persists even if torrent isn't in new tab. Details panel shows torrent from "deleted" tab.
- Files: `src/App.tsx` (lines 99-114), `src/components/TorrentList.tsx` (lines 56-63)
- Trigger: Select torrent in "Downloading" tab, click "Completed" tab
- Workaround: Close details panel manually when switching tabs
- Fix approach: Add effect to clear selectedTorrent when activeTabId changes and torrent not in new tab.

## Security Considerations

**No Input Validation on Torrent URLs:**
- Risk: `AddTorrent.tsx` accepts any URL without validation (line 738-744). Could accept malicious URLs. No check for protocol (http/https). No URL parsing or sanitization.
- Files: `src/components/AddTorrent.tsx` (lines 738-744)
- Current mitigation: Only basic string presence check (line 214-216)
- Recommendations: Add URL validation regex checking for valid http/https/magnet protocols. Use URL() constructor to parse and validate. Add warning for non-HTTPS URLs.

**Unencrypted Settings Storage:**
- Risk: `Settings.tsx` accepts plain-text authentication credentials for Transmission connections (lines 20-21: `remotePassword`). No indication these are encrypted or sent securely.
- Files: `src/components/Settings.tsx` (lines 17-21)
- Current mitigation: UI only - not persisted
- Recommendations: Encrypt credentials before storing. Use Tauri's secure storage or OS keychain. Never log credentials. Add secure flag indicator in UI.

**No CORS or Origin Validation for Tauri Invocations:**
- Risk: `torrent-api.ts` directly invokes Tauri commands without explicit allowlist validation. Backend permissions not verified in frontend.
- Files: `src/lib/torrent-api.ts` (throughout - all invoke calls)
- Current mitigation: Tauri's built-in command allowlist (if configured)
- Recommendations: Verify `src-tauri/capabilities/` files are properly configured. Add runtime checks for sensitive operations. Document required capabilities.

**Exposed Peer/Seed IP Addresses:**
- Risk: Mock peer/seed data in `mock_data.ts` contains real-looking IP addresses (potentially identifiable). If real data replaces mock, user privacy could be compromised if data is logged/displayed without sanitization.
- Files: `src/components/mock_data.ts` (lines 4-85)
- Current mitigation: Currently mock data only
- Recommendations: Implement IP address anonymization when displaying peer lists. Don't log full IPs in debug mode. Add privacy notice when fetching peer data.

## Performance Bottlenecks

**Recursive File Tree Rendering Without Virtualization:**
- Problem: `AddTorrent.tsx` FileTreeView renders all files recursively (lines 412-474) without virtualization. Large torrents with thousands of files will render all DOM nodes at once.
- Files: `src/components/AddTorrent.tsx` (lines 406-514)
- Cause: Linear render of entire file tree structure with no lazy loading or windowing
- Improvement path: Implement virtual scrolling using react-window or similar. Render only visible files. Lazy load child nodes on expand.

**ETA Calculation on Every Render:**
- Problem: `TorrentList.tsx` parseEtaToMinutes (lines 227-239) is called during sort operations even when not sorting by ETA. String parsing for each torrent repeatedly.
- Files: `src/components/TorrentList.tsx` (lines 227-239, called at line 298)
- Cause: ETA parsing happens in sort comparator which is called for all columns
- Improvement path: Memoize parsed ETA values. Pre-calculate ETA on torrent object. Only recompute when progress/speed changes.

**Component Re-renders on Mock Data Shuffle:**
- Problem: `TorrentDetails.tsx` (lines 56-78) Fisher-Yates shuffle runs at module load, not in component. Every component mount triggers re-render of piece grid even though shuffle is static.
- Files: `src/components/TorrentDetails.tsx` (lines 56-78)
- Cause: Mock data generation not memoized
- Improvement path: Move shuffle to useMemo hook. Cache piece status data. Only regenerate if torrent ID changes.

**Unoptimized Search Filtering:**
- Problem: `TorrentList.tsx` filters torrents by search query with string.includes() on every render (line 268). No debouncing of search input in Header.
- Files: `src/components/Header.tsx` (search handler), `src/components/TorrentList.tsx` (line 268)
- Cause: Search query changes trigger full list re-render without debounce
- Improvement path: Add 300ms debounce to setSearchQuery in Header. Implement full-text search indexing if torrent list grows large.

## Fragile Areas

**Tab Management Logic Scattered Across App:**
- Files: `src/App.tsx` (handleAddTab, handleRenameTab, handleDeleteTab, line 36-69), `src/components/TabBar.tsx`, `src/components/TorrentList.tsx` (handleMoveToTab, line 330-342)
- Why fragile: Tab state lives in App but specific operations (renaming, deletion) are triggered from TabBar. Move operation lives in TorrentList. No single source of truth. Adding new tab feature requires changes in 3+ files.
- Safe modification: Create custom hook useTabManager() that centralizes all tab operations. Pass single handler to TabBar. Test thoroughly after moving logic.
- Test coverage: No test files exist for tab operations. Manual testing required.

**File Tree Selection State Management:**
- Files: `src/components/AddTorrent.tsx` (toggleFolder, toggleFileSelection, updateChildrenSelection, selectAllFiles, lines 236-328)
- Why fragile: Recursive update functions are complex and easy to break. Parent/child selection sync happens in multiple places. No validation that state remains consistent.
- Safe modification: Add unit tests for recursive selection logic. Consider using a library for tree management. Add invariant checks to validate parent/child consistency.
- Test coverage: Zero tests for file tree logic. Integration test needed for select all/deselect all operations.

**TorrentInfo Type Definition Duplication:**
- Files: `src/lib/torrent-api.ts` (lines 3-15), `src/components/TorrentList.tsx` (lines 8-34), `src/components/AddTorrent.tsx` (lines 43-53)
- Why fragile: Multiple identical type definitions. Changes to backend response structure require updates in 3+ locations. Inconsistencies can appear silently.
- Safe modification: Define single TorrentInfo type in `torrent-api.ts`, export it, import everywhere. Create type tests to catch mismatches.
- Test coverage: No type validation tests exist.

**Hardcoded Strings and Magic Values:**
- Files: Throughout - tab IDs ("all", "downloading", "completed"), status strings ("downloading", "seeding", "paused", "checking", "error"), class names with green-900/30 repeated 50+ times
- Why fragile: Typo in status string breaks entire feature. Color changes require find-replace across all files. Tab ID logic duplicated in multiple places.
- Safe modification: Create constants file: `src/constants.ts` with TAB_IDS, TORRENT_STATUS, COLORS. Replace all hardcoded values.
- Test coverage: No tests validate enum consistency.

## Scaling Limits

**Mock Data Scales Linearly:**
- Current capacity: 5 torrents in TorrentList, ~200 pieces in TorrentDetails, ~14 files in file tree
- Limit: Component renders entire list without virtualization. At 1000+ torrents, browser will hang during sort/filter operations.
- Scaling path: (1) Implement virtual scrolling for TorrentList, (2) Implement pagination for file trees, (3) Implement server-side filtering/sorting.

**No Pagination for Peer/Seed Lists:**
- Current capacity: 5 peers and 5 seeds shown in TorrentDetails
- Limit: Real torrents have 100+ peers/seeds. Rendering all DOM nodes will slow component.
- Scaling path: Add pagination or infinite scroll for peer/seed tabs. Load peers on demand from backend.

**State Stored Only in React Components:**
- Current capacity: All state lost on page refresh. No persistence beyond session.
- Limit: Cannot reliably track torrent status across app restarts. Tab organization lost on close.
- Scaling path: Add localStorage persistence for tab organization. Implement IndexedDB for torrent cache. Add Tauri file-based config storage.

## Dependencies at Risk

**React 19.2.0 (Very New):**
- Risk: React 19 is very recent (released late 2024). May have undiscovered bugs. Ecosystem not fully adapted. Some libraries may have compatibility issues.
- Impact: Third-party packages may not support React 19 yet. Breaking changes more likely in minor updates.
- Migration plan: Pin to 19.2.0 explicitly. Test all dependency updates thoroughly. Consider stable React 18 until ecosystem stabilizes if issues arise.

**Tauri 2.x (Under Development):**
- Risk: Tauri 2 is relatively new. API may change. Plugin system still evolving. Rust backend may have performance regressions.
- Impact: Backend Rust code may need frequent updates. Plugins may not be maintained.
- Migration plan: Lock to specific @tauri-apps versions. Review changelog before upgrades. Have backup plan to switch to Electron if Tauri stability issues arise.

**Lucide React 0.522.0 (Specific Old Version):**
- Risk: Pinned to specific version, not caret/tilde. May have missed critical icon additions or bug fixes in newer versions.
- Impact: Missing icons may require version upgrade. No automatic security updates from dependabot.
- Migration plan: Upgrade to latest lucide-react version and test icon changes. Use ^0.522.0 to allow patch updates.

## Missing Critical Features

**No Persistent Settings:**
- Problem: Settings form exists but changes are not saved. Refresh page loses all configuration.
- Blocks: Remote server switching, bandwidth limiting, default download folder configuration
- Implementation needed: Tauri config file or localStorage with encryption. Save handler on Settings "Save" button. Load on app start.

**No Real-Time Progress Updates:**
- Problem: Torrent progress shown in state but never updated after initial load. No backend polling or event listeners.
- Blocks: Accurate speed display, ETA calculation, status changes
- Implementation needed: Implement setInterval polling or Tauri event listeners for torrent status updates.

**No Error Recovery:**
- Problem: No error boundary components. Network errors will crash components. Invalid torrent responses cause undefined behavior.
- Blocks: Graceful degradation when backend fails. User guidance on errors.
- Implementation needed: Add React Error Boundary. Add try-catch in API calls. Show user-friendly error messages.

**No Backend API Documentation:**
- Problem: TorrentAPI calls methods like "add_torrent", "get_torrents", "pause_torrent" but no specification of expected return types or error codes.
- Blocks: Frontend cannot implement proper error handling. Cannot validate responses.
- Implementation needed: Add JSDoc comments to TorrentAPI. Specify exact return type and error scenarios for each method.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: All utility functions, all components, all API calls
- Files: Entire `src/` directory
- Risk: Refactoring components breaks functionality silently. Type errors in props go undetected. Mock data inconsistencies spread.
- Priority: High - add at minimum unit tests for TorrentAPI, filter/sort logic in TorrentList, file tree selection logic in AddTorrent

**No Integration Tests:**
- What's not tested: Tab switching with torrent selection, moving torrents between tabs, adding torrents and viewing file selection, remote connection configuration
- Files: Cross-component flows
- Risk: UI flows that seem to work in manual testing fail in edge cases. Data consistency between components breaks.
- Priority: High - add integration tests for critical user workflows

**No E2E Tests:**
- What's not tested: Full application flows with Tauri backend
- Files: All files
- Risk: Cannot validate that UI correctly displays backend responses. Backend API contract not verified.
- Priority: Medium - add E2E tests for add-torrent, list display, detail view once backend implementation stabilizes

**No Type Validation Tests:**
- What's not tested: TorrentInfo interface consistency across files, API response type matching, prop type correctness
- Files: `src/lib/torrent-api.ts`, `src/App.tsx`, all components
- Risk: API response structure change breaks frontend silently. Type definitions drift from reality.
- Priority: Medium - add TypeScript type tests or zod schema validation

---

*Concerns audit: 2026-03-24*
