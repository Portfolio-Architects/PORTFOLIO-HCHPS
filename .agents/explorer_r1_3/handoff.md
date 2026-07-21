# Handoff Report: R1 Requirement Analysis (Top-Level Hook Scoping & Conditional Computing)

## 1. Observation
- **Top-Level Hooks**: `ProtectedApp` in `src/app/page.tsx` calls 32 React hooks (lines 356–393). Primary data hooks (`useTasks`, `useBudget`, `useInventory`, `useMeetings`, `useProjects`, `useSignal`) maintain single sources of truth at top level.
- **Unconditional Execution of `useMergedSignals`**: `src/app/page.tsx:376` calls `useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems)` unconditionally.
- **Heavy Processing**: `src/hooks/useMergedSignals.ts:15-59` performs O(N) regex stemming (`stripSuffix`), stop-word filtering (`stopWords`), keyword map aggregation, and sorting across 5 domains (`tasks`, `projects`, `meetings`, `budgetEntries`, `inventoryItems`).
- **Consumer Scoping**: `mergedKeywordMap` and `mergedEntries` are passed to `<MindMap3D>` (rendered only when `activeModule === 'mindmap'`) and `<AIAssistantModal>` (renders `null` when `isQuickInputOpen === false`).
- **`useGraphCustomization` Scoping**: `src/app/page.tsx:377` calls `useGraphCustomization(activeModule === 'mindmap')`. Its internal polling loop (`src/hooks/useGraphCustomization.ts:703`) correctly pauses when `enabled` is `false`.
- **State Navigation**: Top-level navigation uses `activeModule` (`'dashboard' | 'mindmap' | 'workspace' | 'project'`) and `visitedModules` for DOM caching. Child views (e.g. `WorkspaceView`) manage internal `activeTab` states.

## 2. Logic Chain
1. `ProtectedApp` holds top-level data hooks whose state updates trigger re-renders of `ProtectedApp`.
2. On every re-render of `ProtectedApp`, `useMergedSignals` re-evaluates all keyword extractions and entry sortings.
3. However, `mergedKeywordMap` and `mergedEntries` are only consumed by `MindMap3D` (active during `activeModule === 'mindmap'`) and `AIAssistantModal` (active during `isQuickInputOpen === true`).
4. Therefore, when `activeModule !== 'mindmap'` AND `isQuickInputOpen === false`, `useMergedSignals` computation is unnecessary and wasteful.
5. By introducing `enabled: boolean = true` to `useMergedSignals` and passing `isSignalsNeeded = activeModule === 'mindmap' || isQuickInputOpen`, computation is bypassed when inactive.
6. When `isSignalsNeeded` transitions from `false` to `true`, `useMemo` in `useMergedSignals` re-evaluates synchronously during that render using the latest React state for `tasks`, `projects`, `meetings`, `budgetEntries`, and `inventoryItems`.
7. This guarantees zero stale data when switching tabs or opening the AI modal.

## 3. Caveats
- No source code in `src/` was modified in this analysis phase (read-only investigation per role guidelines).
- Proposed patch modifies `src/hooks/useMergedSignals.ts` and `src/app/page.tsx`.
- All tests/harnesses (`node scripts/run-harness.js`) should be run after implementing the proposed patch.

## 4. Conclusion
Top-level hook scoping in `ProtectedApp` can be optimized by adding an `enabled` flag to `useMergedSignals` set to `activeModule === 'mindmap' || isQuickInputOpen`. This suspends heavy keyword extraction during inactive tab usage while ensuring fresh data on demand.

## 5. Verification Method
1. Inspect `src/hooks/useMergedSignals.ts` to confirm `enabled` parameter handling and fallback returns (`EMPTY_KEYWORD_MAP` / `EMPTY_ENTRIES`).
2. Inspect `src/app/page.tsx` line 376 to confirm `isSignalsNeeded = activeModule === 'mindmap' || isQuickInputOpen` is passed.
3. Switch between tabs (Dashboard → Budget → MindMap → Dashboard) and open/close the AI Assistant modal.
4. Verify that MindMap renders all nodes accurately and AI Assistant modal receives full context data without stale entries.
5. Run project harness or build test: `node scripts/run-harness.js` or `npm run build`.
