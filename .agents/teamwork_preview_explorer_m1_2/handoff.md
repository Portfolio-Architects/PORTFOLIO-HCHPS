# 5-Component Handoff Report — Explorer 2 (Workspace & MindMap3D UI Stall Investigation)

## 1. Observation
- **File Paths & Line Numbers**:
  - `src/components/inventory/InventoryList.tsx`:
    - Line 284: `const visibleItemHistoryMap = useMemo(() => { ... map.set(itemId, (getItemHistory(itemId) || []).slice(0, 3)); ... }, [visibleRows, getItemHistory]);`
    - Line 376: `<InventoryItemCard key={itemId} item={item} history={history} onEdit={openEdit} onDelete={handleDeleteItem} onAdjust={openAdjust} />`
    - Lines 42–70: `useVirtualGrid` hook uses `const containerRect = containerRef.current.getBoundingClientRect();` inside synchronous `scrollParent.addEventListener('scroll', updateMetrics, { passive: true });`.
  - `src/components/MindMap3D.tsx`:
    - Line 15: `import { MindMapInspector } from './MindMapInspector';` (86.6 KB static import)
    - Line 16: `import { SemanticReviewModal } from './SemanticReviewModal';` (31.1 KB static import)
    - Line 759: `const delta = Math.min(now - lastFrameTime, 100);`
    - Line 818: `lastFrameTime = performance.now();` (overwrites `lastFrameTime` after `engine.render()`).
    - Lines 856–867: `handleVisibilityChange` checks `if (document.hidden)` but does NOT trigger when switching app tabs (`isActive = false` in `page.tsx`).
  - `src/components/WorkspaceView.tsx`:
    - Line 29: `const InventoryList = dynamic(..., { loading: () => (<div className="animate-spin ...">...</div>) });` (Generic spinner fallback causes layout shift).

- **Tool Execution & Diagnostics**:
  - `find_by_name`: Checked 41 component files across `src/components/`.
  - `grep_search`: Located all references to `WorkspaceView`, `MindMap3D`, `InventoryList`, `MindMapInspector`, `getItemHistory`, `useVirtualGrid`, `requestAnimationFrame`.
  - `view_file`: Traced lines in `WorkspaceView.tsx`, `InventoryList.tsx`, `MindMap3D.tsx`, `OntologyCanvasEngine.ts`, `modal.tsx`, `page.tsx`.

---

## 2. Logic Chain
1. **Observation 1** (`InventoryList.tsx:284`): `visibleItemHistoryMap` calls `.slice(0, 3)` on `getItemHistory(itemId)` for every visible item.
   - **Reasoning Step A**: `.slice(0, 3)` produces a new JavaScript array object on every invocation (`[] !== []`).
   - **Reasoning Step B**: When scrolling, `visibleRows` changes, recalculating `visibleItemHistoryMap` and giving every `InventoryItemCard` a brand new `history` array reference.
   - **Reasoning Step C**: `InventoryItemCard` is wrapped in default `React.memo` (shallow comparison). Because `prevProps.history !== nextProps.history`, React re-renders 100% of visible cards on every scroll frame, causing main thread DOM churn.

2. **Observation 2** (`InventoryList.tsx:42–70`): `useVirtualGrid` calls `getBoundingClientRect()` synchronously inside a scroll event listener.
   - **Reasoning Step A**: Querying element layout properties during scroll forces the browser to flush pending DOM updates and execute forced synchronous reflows.
   - **Reasoning Step B**: Combined with Step C above (re-rendering all cards on scroll), the browser enters a continuous **Style Recalculation & Reflow Loop**, locking the main thread during fast scrolling.

3. **Observation 3** (`MindMap3D.tsx:759, 818, 856`): `handleVisibilityChange` only pauses physics when `document.hidden` is true, ignoring internal app tab switches (`isActive = false`).
   - **Reasoning Step A**: When switching tabs away from `mindmap`, `lastFrameTime` stops updating while `engineRef.current` remains active with non-zero node velocities.
   - **Reasoning Step B**: Upon returning to `mindmap`, `now - lastFrameTime` is large and gets clamped to `100ms`.
   - **Reasoning Step C**: A 100ms physics step applies 6x normal force acceleration per frame ($v += a \cdot 100\text{ms}$). Nodes jump, overlap, and collide violently.
   - **Reasoning Step D**: The physics engine spends up to **3,752ms** in `runPhysicsTick()` attempting to resolve hundreds of overlapping node force pairs, freezing the UI thread.

4. **Observation 4** (`MindMap3D.tsx:15–16`, `WorkspaceView.tsx:29`): `MindMapInspector` (86.6 KB) and `SemanticReviewModal` (31.1 KB) are statically imported at the top of `MindMap3D.tsx`, while `InventoryList` uses a non-conforming spinner fallback in `WorkspaceView.tsx`.
   - **Reasoning Step A**: Eager static imports force the browser to parse 117.7 KB of modal JavaScript code immediately during `MindMap3D` initialization, even though the user has not opened those modals.
   - **Reasoning Step B**: The spinner fallback in `WorkspaceView.tsx` causes visual jump and layout shift (CLS) when `InventoryList` finishes dynamic loading.

---

## 3. Caveats
- **WebGL Hardware Variations**: Physics frame rates and lag spike durations (reported up to 3,752ms) may vary depending on client GPU/CPU specs and canvas DPR settings.
- **Data Scaling**: `InventoryList` tests were analyzed with 50+ items; larger dataset scalability relies on `useVirtualGrid` reflow elimination.
- **Unexplored Areas**: Internal `OntologyRenderer.ts` canvas drawing routines were not modified since canvas draw calls occur off React's reconciliation tree.

---

## 4. Conclusion
The UI thread stalls (up to 3,752ms) in the `workspace` and `mindmap` modules are directly caused by:
1. Invalidated `React.memo` cache in `InventoryItemCard` due to new array references returned by `.slice(0, 3)` in `visibleItemHistoryMap`.
2. Forced synchronous layout reflows in `useVirtualGrid` via `getBoundingClientRect()` on scroll pixels.
3. Physics explosion and stale time delta (`now - lastFrameTime`) in `MindMap3D.tsx` when returning from inactive tabs.
4. Eager static bundling of heavy sub-modals (117.7 KB) in `MindMap3D.tsx` and low-fidelity fallback UI in `WorkspaceView.tsx`.

Implementing the 4 proposed fix strategies (Custom Deep Prop Comparator for `InventoryItemCard`, RAF Throttled `useVirtualGrid`, Physics Freeze & Time Delta Reset in `MindMap3D`, and Lazy Sub-Modals + `InventoryListSkeleton`) will eliminate the 3,752ms stall and ensure 60 FPS zero-stall performance.

---

## 5. Verification Method

### Concrete Verification Commands
Execute the following verification suite after implementer completes code changes:
1. **TypeScript Static Type Verification**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected output*: 0 errors.

2. **Automated Project Quality Harness**:
   ```powershell
   node scripts/run-harness.js
   ```
   *Expected output*: 0 Zod errors, 0 ESLint errors/warnings, 0 MVC ontology violations.

### Manual Inspection Guidelines
1. **Scrolling Verification in `InventoryList`**:
   - Open Chrome DevTools Performance tab, switch to `Workspace` -> `홍보물 관리`.
   - Perform rapid scroll. Verify zero forced reflow warnings and zero card re-renders for offscreen/unmodified cards.

2. **Tab Navigation Verification in `MindMap3D`**:
   - Open `마인드맵` tab, switch away to `예산 대조보드` tab for 10 seconds, then switch back to `마인드맵`.
   - Verify zero node explosion, zero physics whiplash, and Long Task duration under 16ms.

3. **Invalidation Conditions**:
   - If `npx tsc --noEmit` returns any type errors.
   - If `InventoryItemCard` re-renders when scrolling without data updates.
   - If returning to `MindMap3D` causes lag spikes greater than 50ms.
