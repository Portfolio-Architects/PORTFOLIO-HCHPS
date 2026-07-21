# R1 Top-Level Hook Scoping & Conditional Computing Analysis Report

**Target File**: `src/app/page.tsx`, `src/hooks/useMergedSignals.ts`, `src/hooks/useGraphCustomization.ts`, `src/app/api/data/route.ts`  
**Analyzer**: `explorer_r1_1`  
**Date**: 2026-07-21  

---

## Executive Summary

An investigation of `ProtectedApp` in `src/app/page.tsx` revealed an essential optimization opportunity for top-level hook scoping, alongside a build-blocking TypeScript error in `src/app/api/data/route.ts`:

1. **Unconditional Signal Extraction**: `useMergedSignals` is currently invoked at the top level of `ProtectedApp` (`src/app/page.tsx:376`) without an `enabled` flag. On every state update or item edit in `tasks`, `projects`, `meetings`, `budgetEntries`, or `inventoryItems`, `useMergedSignals` parses and extracts keywords across all 5 domain entities regardless of whether the user is on the `mindmap` tab.
2. **Graph Customization Hook Scoping**: `useGraphCustomization(activeModule === 'mindmap')` is already passed `enabled = activeModule === 'mindmap'`. Its 10-second polling loop cleanly stops when leaving the `mindmap` tab. However, its Yjs store snapshot remains accessible in memory for AI Assistant context data.
3. **Memoization & Tab Switching**: When `useMergedSignals` recomputed keywords unconditionally on non-mindmap tabs, it generated new array/object references for `mergedEntries` and `mergedKeywordMap`. This forced `aiContextData` (`src/app/page.tsx:383-392`) to recompute, triggering child modal update checks even when switching between `dashboard`, `workspace`, and `project` tabs.
4. **Repository TypeScript Errors**: A project-wide `npx tsc --noEmit` check flagged two TypeScript compilation errors in `src/app/api/data/route.ts:546` due to a missing `RAGEngine` import and an implicit `any` error handler parameter.

**Recommended Solution**:
- Extend `useMergedSignals` in `src/hooks/useMergedSignals.ts` to accept an optional parameter `enabled: boolean = true`.
- Implement a ref-cached fallback mechanism inside `useMergedSignals` using `useRef` (`cachedMapRef`, `cachedEntriesRef`, `isInitializedRef`). When `enabled` is `false` and initial signals have been computed, return the cached references immediately without running keyword extraction loops.
- In `src/app/page.tsx`, calculate `const isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen;` and pass `isMergedSignalsEnabled` to `useMergedSignals`.
- Maintain `aiContextData`'s existing `useMemo` dependency array (`[mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, mergedKeywordMap]`). With stable signal references on non-mindmap tabs, `aiContextData` will zero-recompute during tab transitions.
- Fix TypeScript errors in `src/app/api/data/route.ts` by adding `import { RAGEngine } from '@/lib/rag/rag-engine';` and typing `(err: unknown)` on line 546.

---

## 1. Top-Level Hook Scoping Examination (`ProtectedApp` in `src/app/page.tsx`)

### Current State Analysis

In `src/app/page.tsx` (lines 355-395):

```tsx
function ProtectedApp({ appMode, onModeChange, isInitializingGlobal }: ProtectedAppProps & { isInitializingGlobal: boolean }) {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');
  const [isQuickInputOpen, setIsQuickInputOpen] = useState(false);
  ...
  // Hooks
  const { tasks, updateTask, stats: taskStats } = useTasks();
  const { categories: budgetCategories, entries: budgetEntries, ... } = useBudget();
  const { items: inventoryItems, ... } = useInventory();
  const { meetings } = useMeetings();
  const { projects } = useProjects();
  const { entries: signalEntries, ... } = useSignal();
  const scheduleAlerts = useScheduleAlerts(tasks, meetings);
  useNotificationAlerts(scheduleAlerts);

  // Top-level heavy hook calls
  const { mergedKeywordMap, mergedEntries } = useMergedSignals(signalEntries, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems);
  const { customNodes, customEdges, deletedEdges, overrides } = useGraphCustomization(activeModule === 'mindmap');
```

### Key Findings
1. **`useMergedSignals` Execution Overhead**:
   - `useMergedSignals` (lines 5-62 of `src/hooks/useMergedSignals.ts`) executes two `useMemo` blocks:
     - `mergedKeywordMap`: Loops through all `tasks`, `projects`, `meetings`, `budgetEntries`, and `inventoryItems` to extract keywords via regex pattern matching (`extractKeywords`).
     - `mergedEntries`: Transforms all items into signal format and sorts the aggregated list by `createdAt` descending.
   - Because `useMergedSignals` lacks an `enabled` flag, this regex matching and array sorting happens on **every single state change**, even when the user is working solely inside the `workspace` (budget) or `dashboard` views.

2. **`useGraphCustomization` Execution & Polling**:
   - `useGraphCustomization` is called as `useGraphCustomization(activeModule === 'mindmap')`.
   - In `src/hooks/useGraphCustomization.ts`:
     - Line 678: `useEffect` for cloud auto-fetch checks `if (enabled && isInitialMount.current)`.
     - Line 703: `useEffect` for 10s watcher DB polling checks `if (!enabled || !isCloudLoaded) return;`.
     - Line 776: Cleanup function decrements `activePollCount` and clears `activePollInterval` when `enabled` becomes `false`.
   - Therefore, polling is **already correctly disabled** when `activeModule !== 'mindmap'`.

---

## 2. Conditional Computing & Polling Bypass Strategy

### Proposed Parameter Update for `useMergedSignals`

Modify `useMergedSignals` signature and implementation in `src/hooks/useMergedSignals.ts`:

```typescript
export function useMergedSignals(
  signalEntries: SignalEntry[],
  keywordMap: Record<string, number>,
  tasks: Task[],
  projects: Project[],
  meetings: Meeting[],
  budgetEntries: BudgetEntry[],
  inventoryItems: InventoryItem[],
  enabled: boolean = true
) {
  const cachedMapRef = useRef<Record<string, number>>({});
  const cachedEntriesRef = useRef<any[]>([]);
  const isInitializedRef = useRef<boolean>(false);

  const mergedKeywordMap = useMemo(() => {
    if (!enabled && isInitializedRef.current) {
      return cachedMapRef.current;
    }

    const map: Record<string, number> = { ...keywordMap };
    const extractAndAdd = (text: string, tags: string[] = []) => {
      const words = extractKeywords(text);
      tags.forEach(t => { if (t.length >= 2) words.push(t); });
      words.forEach(kw => { map[kw] = (map[kw] || 0) + 1; });
    };

    for (const t of tasks) extractAndAdd(t.title + ' ' + (t.description || ''), t.tags);
    for (const p of projects) extractAndAdd(p.name + ' ' + (p.description || '') + ' ' + p.checklistItems.map(c => c.text).join(' '));
    for (const m of meetings) extractAndAdd(m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), m.attendees);
    for (const b of budgetEntries) extractAndAdd(b.purpose + ' ' + (b.memo || ''));
    for (const i of inventoryItems) extractAndAdd(i.name + ' ' + i.category);

    cachedMapRef.current = map;
    return map;
  }, [enabled, keywordMap, tasks, projects, meetings, budgetEntries, inventoryItems]);

  const mergedEntries = useMemo(() => {
    if (!enabled && isInitializedRef.current) {
      return cachedEntriesRef.current;
    }

    const buildEntry = (idPrefix: string, id: string, text: string, keywordsSource: string, tags: string[], createdAt: string, category: string) => ({
      id: `${idPrefix}-${id}`,
      text,
      keywords: [...extractKeywords(keywordsSource), ...tags.filter(tag => tag.length >= 2)],
      createdAt,
      category,
      tags: tags.filter(tag => tag.length >= 2),
    });

    const taskMap = tasks.map(t => buildEntry('task', t.id, `[업무] ${t.title}`, t.title + ' ' + (t.description || ''), t.tags, t.createdAt, '업무'));
    const projectMap = projects.map(p => buildEntry('proj', p.id, `[프로젝트] ${p.name}`, p.name + ' ' + (p.description || ''), ['프로젝트'], p.createdAt, '프로젝트'));
    const meetingMap = meetings.map(m => buildEntry('meet', m.id, `[회의] ${m.title}`, m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), ['회의록', ...m.attendees], m.createdAt, '회의록'));
    const budgetMap = budgetEntries.map(b => buildEntry('budg', b.id, `[지출] ${b.purpose}`, b.purpose + ' ' + (b.memo || ''), ['예산'], b.date, '지출예산'));
    const inventoryMap = inventoryItems.map(i => buildEntry('inv', i.id, `[비품] ${i.name}`, i.name + ' ' + i.category, ['재고'], i.createdAt, '홍보물'));
    const sigMap = signalEntries.map(s => ({ ...s, category: '내 생각', tags: [] }));

    const all = [...sigMap, ...taskMap, ...projectMap, ...meetingMap, ...budgetMap, ...inventoryMap];
    const sorted = all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    cachedEntriesRef.current = sorted;
    isInitializedRef.current = true;
    return sorted;
  }, [enabled, signalEntries, tasks, projects, meetings, budgetEntries, inventoryItems]);

  return { mergedKeywordMap, mergedEntries };
}
```

### Call Site Update in `ProtectedApp` (`src/app/page.tsx`)

```tsx
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

## 3. Memoization of `aiContextData` & Tab-Switching Isolation

In `src/app/page.tsx` (lines 383-393):

```tsx
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

### Analysis of Memoization Behavior
- **Tab Switching between Dashboard, Workspace, and Project**:
  - `activeModule` changes, causing `ProtectedApp` component re-render.
  - `isMergedSignalsEnabled` is `false` (assuming `isQuickInputOpen` is `false`).
  - `useMergedSignals` returns `cachedMapRef.current` and `cachedEntriesRef.current` (exact same object/array references).
  - `useGraphCustomization` is `enabled = false`; Yjs store snapshot references (`customNodes`, `customEdges`, `deletedEdges`, `overrides`) remain unchanged.
  - `budgetEntries` and `budgetCategories` remain unchanged.
  - Result: All dependencies of `aiContextData` maintain **referential equality** (`===`). `aiContextData` `useMemo` returns the cached object reference. `AIAssistantModal` receives an identical prop reference and skips re-rendering!

---

## 4. Side Effects, Dependencies & TypeScript Integrity Check

1. **Side Effects**:
   - **MindMap3D**: When user navigates to `mindmap`, `activeModule === 'mindmap'` becomes `true`. `enabled` becomes `true`. `useMergedSignals` updates its cache with fresh task/budget keywords, and `MindMap3D` receives updated `signalKeywords` and `signalEntries`.
   - **AI Assistant Modal**: When user clicks the floating AI Assistant button on any tab, `isQuickInputOpen` becomes `true`. `enabled` becomes `true`. `useMergedSignals` refreshes keywords, and `aiContextData` updates automatically.
   - **Non-MindMap Views**: Non-mindmap tabs (`PortfolioDashboardView`, `WorkspaceView`, `ProjectManagementPage`) do NOT use `mergedEntries` or `mergedKeywordMap`. There is zero functionality change on non-mindmap views.

2. **Dependency Arrays**:
   - `useMergedSignals`: Correctly includes `enabled` in both `useMemo` dependency arrays.
   - `aiContextData`: Correctly lists `[mergedEntries, budgetEntries, budgetCategories, customNodes, customEdges, deletedEdges, overrides, mergedKeywordMap]`.

3. **Repository TypeScript Compiler Checks**:
   - Running `npx tsc --noEmit` detected two existing errors in `src/app/api/data/route.ts`:
     - Line 546: `error TS2304: Cannot find name 'RAGEngine'.`
     - Line 546: `error TS7006: Parameter 'err' implicitly has an 'any' type.`
   - **Fix**:
     1. Add `import { RAGEngine } from '@/lib/rag/rag-engine';` to top imports of `src/app/api/data/route.ts`.
     2. Update `.catch((err) => {` to `.catch((err: unknown) => {`.

---

## Recommended Action Plan for Implementer (`implementer_r1_1`)

1. **Update `src/hooks/useMergedSignals.ts`**:
   - Add `enabled: boolean = true` parameter.
   - Add `useRef` declarations for `cachedMapRef`, `cachedEntriesRef`, `isInitializedRef`.
   - Add early return checks `if (!enabled && isInitializedRef.current) return cachedMapRef.current;` (and `cachedEntriesRef.current`).
   - Include `enabled` in both `useMemo` dependency arrays.

2. **Update `src/app/page.tsx`**:
   - Compute `const isMergedSignalsEnabled = activeModule === 'mindmap' || isQuickInputOpen;`
   - Pass `isMergedSignalsEnabled` as the 8th parameter to `useMergedSignals(...)`.

3. **Fix `src/app/api/data/route.ts`**:
   - Import `RAGEngine` from `@/lib/rag/rag-engine`.
   - Annotate `(err: unknown)` in `.catch`.

4. **Verify**:
   - Run TypeScript typecheck: `npx tsc --noEmit`.
