# Handoff Report — R1 Top-Level Hook Scoping & Conditional Computing

**Agent**: `explorer_r1_1`  
**Role**: Explorer  
**Task**: R1 Analysis — Top-Level Hook Scoping & Conditional Computing in `ProtectedApp` (`src/app/page.tsx`)  
**Status**: Completed  

---

## 1. Observation

- **Top-Level Hook Calls in `src/app/page.tsx`**:
  - Line 376: `const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems);`
  - Line 377: `const { customNodes, customEdges, deletedEdges, overrides } = useGraphCustomization(activeModule === 'mindmap');`
  - Line 383: `const aiContextData = useMemo(() => ({ signals: mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, keywordMap: mergedKeywordMap }), [mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, mergedKeywordMap]);`

- **Hook Implementation in `src/hooks/useMergedSignals.ts`**:
  - `useMergedSignals` signature accepts 7 arguments: `(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems)`.
  - It does NOT accept an `enabled` parameter.
  - It executes `useMemo` blocks for `mergedKeywordMap` and `mergedEntries` unconditionally on every render whenever any input changes, parsing text with `extractKeywords` regex matching across all 5 domain entities (`tasks`, `projects`, `meetings`, `budgetEntries`, `inventoryItems`).

- **Hook Implementation in `src/hooks/useGraphCustomization.ts`**:
  - Accepts `enabled = true` parameter (passed as `activeModule === 'mindmap'`).
  - Lines 703-784: Polling loop (`runPoll`) checks `if (!enabled || !isCloudLoaded) return;` and cleanup function clears `activePollInterval` when `enabled` changes to `false`.
  - Polling is already conditionally scoped to when `activeModule === 'mindmap'`.

- **TypeScript Compilation Errors (`npx tsc --noEmit`)**:
  - `src/app/api/data/route.ts:546`: `error TS2304: Cannot find name 'RAGEngine'.`
  - `src/app/api/data/route.ts:546`: `error TS7006: Parameter 'err' implicitly has an 'any' type.`

---

## 2. Logic Chain

1. **Unconditional Computation Observation**: `useMergedSignals` runs keyword extraction and sorting over all tasks, projects, meetings, budget entries, inventory items, and signal entries regardless of `activeModule`.
2. **Impact on Non-Mindmap Tabs**: When a user creates or updates a task/budget item while on `dashboard`, `workspace`, or `project` tab, `useMergedSignals` executes full keyword extraction and returns new array and object references for `mergedEntries` and `mergedKeywordMap`.
3. **Impact on Memoization**: Because `mergedEntries` and `mergedKeywordMap` receive new object references, the `useMemo` for `aiContextData` in `src/app/page.tsx` recalculates, creating a new `aiContextData` object reference on every data edit.
4. **Conditional Bypass Solution**: Passing `isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen` to `useMergedSignals` allows the hook to check `enabled`. Using a ref-cached fallback (`cachedMapRef`, `cachedEntriesRef`, `isInitializedRef`), `useMergedSignals` returns the previously computed references instantly when `enabled` is `false`.
5. **Tab Switching Result**: When switching between `dashboard`, `workspace`, and `project` tabs (with `isQuickInputOpen = false`), `isMergedSignalsEnabled` remains `false`. Signal calculations do not run, and references remain strictly equal (`===`), eliminating re-computations of `aiContextData` and unnecessary child re-renders.
6. **Build Fix Requirement**: The missing `RAGEngine` import in `src/app/api/data/route.ts` causes `tsc --noEmit` build failures and must be resolved by adding `import { RAGEngine } from '@/lib/rag/rag-engine';` and typing `(err: unknown)`.

---

## 3. Caveats

- **Initial Load Behavior**: If the application starts on `dashboard` (the default tab), `isInitializedRef.current` is `false`. `useMergedSignals` will execute once on initial mount to populate the cache, ensuring `aiContextData` has valid signal data immediately if the user opens the AI Assistant modal before visiting the mindmap.
- **AI Assistant Modal**: The `isQuickInputOpen` state MUST be OR'd with `activeModule === 'mindmap'` (`activeModule === 'mindmap' || isQuickInputOpen`). If only `activeModule === 'mindmap'` were checked, opening the AI Assistant modal on the `dashboard` tab would use stale signal keywords until the user visited the mindmap tab.

---

## 4. Conclusion

The strategy to solve R1 (Top-Level Hook Scoping & Conditional Computing) and fix the build errors is clear, safe, and actionable:

1. Update `src/hooks/useMergedSignals.ts`:
   - Add optional parameter `enabled: boolean = true`.
   - Add `cachedMapRef`, `cachedEntriesRef`, and `isInitializedRef`.
   - Check `if (!enabled && isInitializedRef.current) return cachedMapRef.current;` (and `cachedEntriesRef.current`).
   - Add `enabled` to both `useMemo` dependency arrays.
2. Update `src/app/page.tsx`:
   - Define `const isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen;`
   - Pass `isMergedSignalsEnabled` as the 8th parameter to `useMergedSignals`.
3. Update `src/app/api/data/route.ts`:
   - Import `RAGEngine` from `@/lib/rag/rag-engine`.
   - Annotate `(err: unknown)`.

No code changes were made to `src/` during this read-only investigation.

---

## 5. Verification Method

To independently verify the analysis and proposed strategy:

1. **Inspect Files**:
   - `src/app/page.tsx` lines 376-393
   - `src/hooks/useMergedSignals.ts` lines 5-62
   - `src/hooks/useGraphCustomization.ts` lines 703-784
   - `src/app/api/data/route.ts` lines 1-5, 546
2. **Run TypeScript Check**:
   - `npx tsc --noEmit`
3. **Test Invalidation Conditions**:
   - If `useMergedSignals` is disabled on non-mindmap tabs without checking `isQuickInputOpen`, opening the AI Assistant modal on the `dashboard` tab will fail to reflect newly added tasks/signals until visiting the `mindmap` tab.
