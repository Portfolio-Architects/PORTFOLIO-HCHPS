# R1 Architectural Analysis Report: Top-Level Hook Scoping & Conditional Computing

## Executive Summary
This report analyzes the R1 optimization requirements for `ProtectedApp` (`src/app/page.tsx`), `useMergedSignals` (`src/hooks/useMergedSignals.ts`), and `useGraphCustomization` (`src/hooks/useGraphCustomization.ts`).

Switching tabs between `dashboard`, `workspace`, `mindmap`, and `project` or triggering React state updates currently causes top-level hooks in `ProtectedApp` to execute heavy computations unnecessarily. Specifically:
1. `useMergedSignals` re-extracts keywords (via regex parsing) and maps/sorts 6 data models on every render regardless of active tab or AI modal state.
2. `useGraphCustomization` accepts an `enabled` parameter (`activeModule === 'mindmap'`), but its internal Auto-Save effect fails to respect `enabled`, leading to potential unneeded cloud writes.
3. `aiContextData` in `src/app/page.tsx` is reconstructed when `mergedEntries` or graph customizations change, causing context object invalidation even when the AI Assistant modal is closed.

---

## 1. Deep-Dive: `src/app/page.tsx` & `src/hooks/useMergedSignals.ts`

### 1.1 Current Architecture & Bottlenecks
In `ProtectedApp` (`src/app/page.tsx:355-393`):
```tsx
367: const { tasks, updateTask, stats: taskStats } = useTasks();
368: const { categories: budgetCategories, entries: budgetEntries, ... } = useBudget();
369: const { items: inventoryItems, ... } = useInventory();
370: const { meetings } = useMeetings();
371: const { projects } = useProjects();
372: const { entries: signalEntries, addSignal, updateSignalKeywords, keywordMap } = useSignal();
...
376: const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems);
377: const { customNodes, customEdges, deletedEdges, overrides } = useGraphCustomization(activeModule === 'mindmap');
```

In `src/hooks/useMergedSignals.ts:5-62`:
- `mergedKeywordMap` (Lines 15-36): Iterates through `tasks`, `projects`, `meetings`, `budgetEntries`, `inventoryItems`, and calls `extractKeywords()` (regex parsing) on titles, descriptions, checklist items, agendas, notes, purposes, memos, categories, and tags.
- `mergedEntries` (Lines 38-59): Transforms all tasks, projects, meetings, budget entries, inventory items, and signals into uniform `SignalEntry` objects, extracts keywords, spreads arrays, and performs an $O(N \log N)$ date sort (`all.sort(...)`).

### 1.2 Impact of Unscoped Execution
- `mergedKeywordMap` and `mergedEntries` are ONLY consumed by:
  1. `<MindMap3D>` (active ONLY when `activeModule === 'mindmap'`).
  2. `aiContextData` (passed to `<AIAssistantModal>`, active ONLY when `isQuickInputOpen === true`).
- When the user is on the Dashboard, Budget Workspace, or Project Management tabs and the AI Assistant modal is closed (`isQuickInputOpen === false`), running `useMergedSignals` is **100% wasted CPU work**.

---

## 2. Analysis & Fix Strategy for `useMergedSignals.ts`

### 2.1 Parameter Signature Enhancement
Add an optional `enabled: boolean = true` parameter to `useMergedSignals`:

```typescript
// Proposed signature in src/hooks/useMergedSignals.ts
export function useMergedSignals(
  signalEntries: SignalEntry[],
  keywordMap: Record<string, number>,
  tasks: Task[],
  projects: Project[],
  meetings: Meeting[],
  budgetEntries: BudgetEntry[],
  inventoryItems: InventoryItem[],
  enabled: boolean = true
)
```

### 2.2 Short-Circuiting Heavy Computations
Define module-level immutable fallbacks:
```typescript
const EMPTY_KEYWORD_MAP: Record<string, number> = {};
const EMPTY_MERGED_ENTRIES: SignalEntry[] = [];
```

Inside `useMemo`:
```typescript
const mergedKeywordMap = useMemo(() => {
  if (!enabled) return EMPTY_KEYWORD_MAP;
  
  const map: Record<string, number> = { ...keywordMap };
  // ... (keyword extraction loop)
  return map;
}, [enabled, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems]);

const mergedEntries = useMemo(() => {
  if (!enabled) return EMPTY_MERGED_ENTRIES;

  // ... (entry building and date sorting)
  return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}, [enabled, signalEntries, tasks, projects, meetings, budgetEntries, inventoryItems]);
```

### 2.3 Invocation Scoping in `ProtectedApp` (`src/app/page.tsx`)
In `ProtectedApp`:
```typescript
const isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen;

const { mergedKeywordMap, mergedEntries } = useMergedSignals(
  signalEntries,
  keywordMap,
  tasks,
  projects,
  meetings,
  budgetEntries,
  inventoryItems,
  isMergedSignalsEnabled
);
```

---

## 3. Analysis & Fix Strategy for `useGraphCustomization.ts`

### 3.1 Review of Current `enabled` Parameter Handling
In `src/hooks/useGraphCustomization.ts`:
- Line 103: `export function useGraphCustomization(enabled = true)`
- Line 677: `useEffect` for Auto-Load (Initial Cloud Fetch) checks `if (enabled && isInitialMount.current)`. Lazy loading is correctly deferred until MindMap tab becomes active.
- Line 702: `useEffect` for Watcher Polling Loop checks `if (!enabled || !isCloudLoaded) return;`. Polling loop correctly pauses when `activeModule !== 'mindmap'`.

### 3.2 Bug Discovery in Auto-Save Effect
Look at lines 690-698 in `src/hooks/useGraphCustomization.ts`:
```typescript
// CURRENT (BUG)
useEffect(() => {
  if (!cloudFetched.current || isSyncing.current) return;
  const timer = setTimeout(() => {
    syncToCloud(true).then(() => {
      console.log('[Auto-Save] MindMap configuration uploaded to cloud.');
    });
  }, 2500);
  return () => clearTimeout(timer);
}, [data, syncToCloud]);
```
- **Issue**: Line 691 DOES NOT check `enabled`! If `cloudFetched.current` is true from a prior visit to MindMap, any background Yjs update will trigger `syncToCloud` network requests even when the user is on the Dashboard or Budget Workspace.
- **Fix**: Update condition to check `!enabled`:
```typescript
// PROPOSED FIX
useEffect(() => {
  if (!enabled || !cloudFetched.current || isSyncing.current) return;
  const timer = setTimeout(() => {
    syncToCloud(true).then(() => {
      console.log('[Auto-Save] MindMap configuration uploaded to cloud.');
    });
  }, 2500);
  return () => clearTimeout(timer);
}, [enabled, data, syncToCloud]);
```

---

## 4. Analysis & Fix Strategy for `aiContextData` in `src/app/page.tsx`

### 4.1 Current Implementation & Invalidation Issues
In `src/app/page.tsx:383-392`:
```typescript
const aiContextData = useMemo(() => ({
  signals: mergedEntries,
  budgetEntries: budgetEntries,
  budgetCategories: budgetCategories,
  customNodes,
  customEdges,
  deletedEdges,
  overrides,
  keywordMap: mergedKeywordMap
}), [mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, mergedKeywordMap]);
```

### 4.2 Optimization Strategy
When `isQuickInputOpen` is `false`, the AI Assistant modal is closed and hidden (`if (!isOpen) return null`).
1. Define a static fallback object `EMPTY_AI_CONTEXT` outside component scope.
2. Inside `useMemo`, short-circuit if `!isQuickInputOpen` and return `EMPTY_AI_CONTEXT`.
3. Add `isQuickInputOpen` to the dependency array.

```typescript
const EMPTY_AI_CONTEXT = {
  signals: [],
  budgetEntries: [],
  budgetCategories: [],
  customNodes: [],
  customEdges: [],
  deletedEdges: [],
  overrides: {},
  keywordMap: {}
};

// Inside ProtectedApp:
const aiContextData = useMemo(() => {
  if (!isQuickInputOpen) return EMPTY_AI_CONTEXT;

  return {
    signals: mergedEntries,
    budgetEntries,
    budgetCategories,
    customNodes,
    customEdges,
    deletedEdges,
    overrides,
    keywordMap: mergedKeywordMap
  };
}, [
  isQuickInputOpen,
  mergedEntries,
  budgetEntries,
  budgetCategories,
  customNodes,
  customEdges,
  deletedEdges,
  overrides,
  mergedKeywordMap
]);
```

---

## 5. Summary of Recommended Code Modifications

| File Path | Targeted Logic | Recommended Change | Expected Result |
|---|---|---|---|
| `src/hooks/useMergedSignals.ts` | Hook parameter & internal `useMemo` | Add `enabled = true` param; short-circuit with `EMPTY_KEYWORD_MAP` & `EMPTY_MERGED_ENTRIES` when `!enabled` | Zero string extraction/sorting overhead when MindMap and AI Modal are inactive |
| `src/hooks/useGraphCustomization.ts` | Auto-save `useEffect` (line 691) | Add `!enabled` guard to auto-save effect condition & dependency array | Eliminates unwanted background cloud writes when off MindMap tab |
| `src/app/page.tsx` | `ProtectedApp` hook calls & `aiContextData` | 1) Pass `isMergedSignalsEnabled = activeModule === 'mindmap' \|\| isQuickInputOpen` to `useMergedSignals`<br>2) Short-circuit `aiContextData` with `EMPTY_AI_CONTEXT` when `!isQuickInputOpen` | Tab switches become instantaneous sub-ms renders; object references remain strictly stable |

