# Handoff Report — R1 Optimization Analysis: Top-Level Hook Scoping & Conditional Computing

## 1. Observation

### Exact File Locations & Code Snippets Observed

1. **`src/app/page.tsx:376-392`**:
   ```typescript
   376: const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems);
   377: const { customNodes, customEdges, deletedEdges, overrides } = useGraphCustomization(activeModule === 'mindmap');
   ...
   383: const aiContextData = useMemo(() => ({
   384:   signals: mergedEntries,
   385:   budgetEntries: budgetEntries,
   386:   budgetCategories: budgetCategories,
   387:   customNodes,
   388:   customEdges,
   389:   deletedEdges,
   390:   overrides,
   391:   keywordMap: mergedKeywordMap
   392: }), [mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, mergedKeywordMap]);
   ```

2. **`src/hooks/useMergedSignals.ts:5-62`**:
   ```typescript
   5: export function useMergedSignals(
   6:   signalEntries: SignalEntry[],
   7:   keywordMap: Record<string, number>,
   8:   tasks: Task[],
   9:   projects: Project[],
   10:  meetings: Meeting[],
   11:  budgetEntries: BudgetEntry[],
   12:  inventoryItems: InventoryItem[]
   13: )
   ```
   - `mergedKeywordMap` (lines 15-36) and `mergedEntries` (lines 38-59) execute regex keyword extraction (`extractKeywords`) across all task titles, descriptions, project checklists, meeting notes, budget memos, and inventory items, followed by an $O(N \log N)$ date sort (`all.sort(...)`) on every re-render.
   - `useMergedSignals` currently lacks an `enabled` parameter.

3. **`src/hooks/useGraphCustomization.ts:690-698`**:
   ```typescript
   690: useEffect(() => {
   691:   if (!cloudFetched.current || isSyncing.current) return;
   692:   const timer = setTimeout(() => {
   693:     syncToCloud(true).then(() => {
   694:       console.log('[Auto-Save] MindMap configuration uploaded to cloud.');
   695:     });
   696:   }, 2500);
   697:   return () => clearTimeout(timer);
   698: }, [data, syncToCloud]);
   ```
   - Line 691 checks `!cloudFetched.current || isSyncing.current`, but DOES NOT check `enabled`. Auto-save timers continue to schedule cloud sync operations even when `enabled` is `false` (`activeModule !== 'mindmap'`).

---

## 2. Logic Chain

1. **Step 1 (Observation 1 & 2)**: `ProtectedApp` invokes `useMergedSignals` unconditionally on every render. `useMergedSignals` performs string regex parsing (`extractKeywords`) across 6 data collections and sorts merged entries.
2. **Step 2 (Observation 1)**: `mergedKeywordMap` and `mergedEntries` are passed ONLY to `<MindMap3D>` (active when `activeModule === 'mindmap'`) and `aiContextData` (active when `isQuickInputOpen === true`).
3. **Step 3 (Logical Inference from Step 1 & 2)**: When the user is on the Dashboard (`activeModule === 'dashboard'`), Budget Workspace (`workspace`), or Project Management (`project`) and `isQuickInputOpen === false`, computing merged signals is 100% redundant and creates CPU / memory overhead during tab switches.
4. **Step 4 (Observation 3)**: In `useGraphCustomization.ts`, `activeModule === 'mindmap'` is passed as `enabled`. While initial fetching (lines 677-687) and watcher polling (lines 702-784) correctly check `enabled`, the Auto-Save effect (lines 690-698) lacks an `enabled` check. If `cloudFetched.current` is true, data updates trigger background sheet writes even when the MindMap tab is unmounted.
5. **Step 5 (Observation 1)**: `aiContextData` in `ProtectedApp` is memoized without checking `isQuickInputOpen`. When `isQuickInputOpen === false`, `AIAssistantModal` is hidden (`if (!isOpen) return null`). Therefore, returning a static `EMPTY_AI_CONTEXT` when `!isQuickInputOpen` prevents `aiContextData` from invalidating object references during tab switches.

---

## 3. Caveats

- **Caveat 1**: When `isQuickInputOpen` becomes `true` while on the Dashboard or Workspace tab, `isMergedSignalsEnabled` transitions to `true`. This causes `useMergedSignals` to compute full signal data on-demand for the AI Assistant. This is the desired behavior (lazy on-demand computation).
- **Caveat 2**: No modifications were made to `src/` source code during this investigation phase in strict compliance with the read-only explorer role. All findings and recommended fix strategies are provided for implementation by `implementer_r1`.

---

## 4. Conclusion

Top-level hook scoping and conditional computing in `ProtectedApp` (`src/app/page.tsx`), `useMergedSignals.ts`, and `useGraphCustomization.ts` can be achieved with three targeted changes:

1. **In `src/hooks/useMergedSignals.ts`**:
   - Add `enabled: boolean = true` parameter.
   - When `!enabled`, return static constants `EMPTY_KEYWORD_MAP = {}` and `EMPTY_MERGED_ENTRIES = []`.

2. **In `src/hooks/useGraphCustomization.ts`**:
   - Add `!enabled` check to line 691 in the Auto-Save effect:
     `if (!enabled || !cloudFetched.current || isSyncing.current) return;`

3. **In `src/app/page.tsx`**:
   - Pass `isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen` to `useMergedSignals`.
   - Update `aiContextData` `useMemo` to return `EMPTY_AI_CONTEXT` when `!isQuickInputOpen`.

---

## 5. Verification Method

To independently verify the recommendations:
1. **Type & Zod Integrity Test**:
   Run `node scripts/run-harness.js` to ensure data schema integrity.
2. **TypeScript Compilation Check**:
   Run `npx tsc --noEmit` to verify type safety across modified hook signatures.
3. **Manual Execution Verification**:
   - Launch Next.js app on `http://localhost:3001`.
   - Open browser developer tools and monitor console logs.
   - Switch between Dashboard, Workspace, MindMap, and Project tabs.
   - Verify zero console logs or watcher polling loops for MindMap customization when on non-mindmap tabs.
   - Click AI Assistant button (`Sparkles` icon) on Dashboard tab and verify signals are correctly loaded on demand into `AIAssistantModal`.
