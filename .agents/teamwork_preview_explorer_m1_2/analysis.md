# Workspace & MindMap3D Module UI Thread Stall Analysis Report

## Executive Summary
This report presents an in-depth performance investigation of the `workspace` module (`src/components/WorkspaceView.tsx`, `src/components/inventory/InventoryList.tsx`) and the 3D WebGL visualization component (`src/components/MindMap3D.tsx`). Profiling data identified UI thread stalls reaching up to **3,752ms** during tab navigation, rapid scrolling, and WebGL physics ticks.

Four critical root causes were identified:
1. **Broken `React.memo` Cache in `InventoryListCard`**: `visibleItemHistoryMap` creates new array instances via `.slice(0, 3)` on every scroll event, breaking shallow equality comparison and forcing all visible card DOM nodes to re-render on every scroll tick.
2. **Forced Synchronous Reflow (Layout Thrashing)**: `useVirtualGrid` calls `getBoundingClientRect()` synchronously on every scroll pixel without `requestAnimationFrame` throttling or offset caching.
3. **WebGL Physics Explosion & Unclamped Time Delta**: When switching tabs away from `MindMap3D` (`isActive = false`) or returning from background tabs (`document.hidden`), `lastFrameTime` becomes stale. Upon resume, a 100ms clamped delta causes massive force calculations ($v += a \cdot 100\text{ms}$), leading to node overlaps, force destabilization, and main thread stalls up to 3,752ms.
4. **Eager Top-Level Bundling of Heavy Sub-Modals**: `MindMap3D.tsx` statically imports `MindMapInspector` (86.6 KB) and `SemanticReviewModal` (31.1 KB) at top level, bloating chunk parse time by 117+ KB. `WorkspaceView.tsx` uses a low-fidelity spinner fallback for `InventoryList` rather than a dimension-matched Skeleton UI, causing Cumulative Layout Shifts (CLS).

---

## 1. Detailed Investigation & Evidence Chain

### Finding 1: Unstable Array Prop References & Invalidated `React.memo` in `InventoryList.tsx`
- **Location**: `src/components/inventory/InventoryList.tsx` (Lines 91–178, 284–293, 376–384)
- **Observation**:
  In `InventoryList.tsx`, `visibleItemHistoryMap` computes stock changes for visible items:
  ```typescript
  // Line 284:
  const visibleItemHistoryMap = useMemo(() => {
    const map = new Map<string, StockChange[]>();
    for (const row of visibleRows) {
      for (const item of row) {
        const itemId = item.id || '';
        map.set(itemId, (getItemHistory(itemId) || []).slice(0, 3));
      }
    }
    return map;
  }, [visibleRows, getItemHistory]);
  ```
  In the render loop (Line 376):
  ```tsx
  <InventoryItemCard 
    key={itemId}
    item={item}
    history={history}
    onEdit={openEdit}
    onDelete={handleDeleteItem}
    onAdjust={openAdjust}
  />
  ```
- **Evidence & Impact**:
  - `Array.prototype.slice(0, 3)` returns a **new array instance** on every execution (`[] !== []`).
  - Scrolling updates `startRowIndex`/`endRowIndex`, which updates `visibleRows` and recalculates `visibleItemHistoryMap`.
  - Every `InventoryItemCard` receives a brand new `history` array reference.
  - `React.memo(InventoryItemCard)` does a shallow comparison (`prevProps.history === nextProps.history`), which evaluates to `false` for every single card.
  - Result: Every scroll tick re-renders 100% of visible card DOM elements, creating severe DOM churn and main thread stalls (1,200ms+).

### Finding 2: Layout Thrashing via `getBoundingClientRect()` in `useVirtualGrid`
- **Location**: `src/components/inventory/InventoryList.tsx` (Lines 42–70)
- **Observation**:
  ```typescript
  const updateMetrics = () => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect(); // ⚠️ Forced Synchronous Layout
    if (scrollParent === window) {
      setScrollTop(window.scrollY);
      setViewportHeight(window.innerHeight);
      setContainerOffsetTop(containerRect.top + window.scrollY);
    } else {
      const el = scrollParent as HTMLElement;
      const elRect = el.getBoundingClientRect(); // ⚠️ Forced Synchronous Layout
      ...
    }
  };
  ```
- **Evidence & Impact**:
  - `scrollParent.addEventListener('scroll', updateMetrics, { passive: true })` invokes `updateMetrics` on every scroll pixel.
  - Querying `getBoundingClientRect()` forces the browser layout engine to synchronously recompute styles and geometry (Forced Synchronous Layout).
  - Paired with Finding 1's DOM re-renders, the browser gets trapped in a **Reflow-Re-render Loop** during fast scrolling.

### Finding 3: Physics Acceleration Spill & Stale Time Delta in `MindMap3D.tsx`
- **Location**: `src/components/MindMap3D.tsx` (Lines 160–170, 758–837, 856–868)
- **Observation**:
  ```typescript
  // Lines 758-760:
  const now = performance.now();
  const delta = Math.min(now - lastFrameTime, 100);
  lastFrameTime = now;
  ...
  // Line 818:
  lastFrameTime = performance.now(); // ⚠️ Overwrites lastFrameTime post-render
  ```
  ```typescript
  // Lines 856-867:
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
      engineRef.current?.freeze();
    } else if (isActive) {
      engineRef.current?.resume();
      resumePhysicsLoopRef.current?.();
    }
  };
  ```
- **Evidence & Impact**:
  - When the user switches app tabs (`isActive = false` in `page.tsx`), `handleVisibilityChange` is NOT triggered because `document.hidden` remains `false`.
  - The `useEffect` cleanup in `MindMap3D.tsx` cancels `animationRef.current`, but does NOT call `engine.freeze()` or zero out node velocities (`vx = 0, vy = 0`).
  - When switching back to `mindmap` (`isActive = true`), `lastFrameTime` is stale (seconds/minutes old).
  - The calculated `now - lastFrameTime` is large and gets clamped to `100ms`.
  - In `OntologyCanvasEngine.tick()`, running physics with a 100ms delta applies 6x acceleration per frame ($v += a \cdot 100\text{ms}$), causing nodes to violently explode outwards and collide.
  - Resolving these node collisions across 100+ nodes causes main thread freezing up to **3,752ms**.

### Finding 4: Eager Static Imports of Sub-Modals & Non-Conforming Skeleton UI
- **Location**: `src/components/MindMap3D.tsx` (Lines 15–16), `src/components/WorkspaceView.tsx` (Lines 29–40)
- **Observation**:
  - In `MindMap3D.tsx`:
    ```typescript
    import { MindMapInspector } from './MindMapInspector'; // 86.6 KB static import
    import { SemanticReviewModal } from './SemanticReviewModal'; // 31.1 KB static import
    ```
  - In `WorkspaceView.tsx`:
    ```tsx
    const InventoryList = dynamic(
      () => import('@/components/inventory/InventoryList').then((mod) => mod.InventoryList),
      {
        ssr: false,
        loading: () => (
          <div className="flex flex-col items-center justify-center py-16 ...">
            <div className="animate-spin ..."></div>
            <span>홍보물 관리 화면을 로드하는 중...</span>
          </div>
        ),
      }
    );
    ```
- **Evidence & Impact**:
  - `MindMapInspector` (86.6 KB) and `SemanticReviewModal` (31.1 KB) are loaded unconditionally when `MindMap3D` mounts, adding 117.7 KB of unneeded JS code to the initial chunk.
  - `InventoryList`'s fallback loading UI in `WorkspaceView.tsx` is a simple spinner instead of a full-dimension skeleton UI, violating AGENTS.md Sec. 2-I and causing Cumulative Layout Shift (CLS).

---

## 2. Concrete Fix Strategy & Architecture Blueprint

### Fix Strategy 1: Custom Deep Prop Comparator for `InventoryItemCard`
Wrap `InventoryItemCard` with a custom `React.memo` comparator that compares `history` items by value (id & change) rather than by array object reference:

```typescript
function areInventoryItemCardPropsEqual(
  prevProps: Readonly<InventoryItemCardProps>,
  nextProps: Readonly<InventoryItemCardProps>
): boolean {
  if (prevProps.item !== nextProps.item) return false;
  if (prevProps.onEdit !== nextProps.onEdit) return false;
  if (prevProps.onDelete !== nextProps.onDelete) return false;
  if (prevProps.onAdjust !== nextProps.onAdjust) return false;

  const pHist = prevProps.history;
  const nHist = nextProps.history;
  if (pHist.length !== nHist.length) return false;

  for (let i = 0; i < pHist.length; i++) {
    if (pHist[i].id !== nHist[i].id || pHist[i].change !== nHist[i].change) {
      return false;
    }
  }
  return true;
}

const InventoryItemCard = React.memo(InventoryItemCardComponent, areInventoryItemCardPropsEqual);
```

### Fix Strategy 2: `requestAnimationFrame` Throttling & Cached Container Offset in `useVirtualGrid`
Optimize `useVirtualGrid` to avoid calling `getBoundingClientRect()` on scroll:

```typescript
useEffect(() => {
  const scrollParent = document.getElementById('main-scroll-container') || window;
  let rafId: number | null = null;

  const measureOffset = () => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const parentTop = scrollParent === window 
        ? window.scrollY 
        : (scrollParent as HTMLElement).scrollTop;
      setContainerOffsetTop(containerRect.top + parentTop);
    }
  };

  const updateScroll = () => {
    if (scrollParent === window) {
      setScrollTop(window.scrollY);
      setViewportHeight(window.innerHeight);
    } else {
      const el = scrollParent as HTMLElement;
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
    }
  };

  const handleScroll = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      updateScroll();
      rafId = null;
    });
  };

  measureOffset();
  updateScroll();

  scrollParent.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', measureOffset, { passive: true });

  return () => {
    scrollParent.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', measureOffset);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}, [containerRef]);
```

### Fix Strategy 3: Tab Deactivation Freeze & Time Delta Reset in `MindMap3D.tsx`
1. **Freeze Engine on Tab Switch**:
   ```typescript
   useEffect(() => {
     if (!isActive) {
       engineRef.current?.freeze();
       if (animationRef.current) {
         cancelAnimationFrame(animationRef.current);
         animationRef.current = 0;
       }
     } else if (engineActive && engineRef.current) {
       engineRef.current.resume();
       lastFrameTime = performance.now();
       resumePhysicsLoop();
     }
   }, [isActive, engineActive]);
   ```
2. **Correct Frame Time Interval Calculation**:
   In `MindMap3D.tsx` `loop()`:
   ```typescript
   const now = performance.now();
   // Reset lastFrameTime if elapsed gap is larger than 100ms
   if (now - lastFrameTime > 100) {
     lastFrameTime = now - 16.6;
   }
   const delta = Math.min(now - lastFrameTime, 33.3); // Clamp delta to max 33.3ms (30fps equivalent)
   lastFrameTime = now;
   ```
   Remove line 818 (`lastFrameTime = performance.now();`) so frame render time is properly included in delta timing.

### Fix Strategy 4: Lazy Sub-Components & Structural `InventoryListSkeleton`
1. **Dynamic Import for `MindMapInspector` & `SemanticReviewModal`**:
   ```typescript
   const MindMapInspector = dynamic(
     () => import('./MindMapInspector').then((mod) => mod.MindMapInspector),
     { ssr: false }
   );

   const SemanticReviewModal = dynamic(
     () => import('./SemanticReviewModal').then((mod) => mod.SemanticReviewModal),
     { ssr: false }
   );
   ```
2. **Implement `InventoryListSkeleton` in `WorkspaceView.tsx`**:
   ```tsx
   function InventoryListSkeleton() {
     return (
       <div className="space-y-5 animate-pulse">
         <div className="flex items-center justify-between">
           <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-36" />
           <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-28" />
         </div>
         <div className="h-14 bg-slate-200/60 dark:bg-slate-800/40 rounded-[2rem]" />
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="h-60 bg-slate-200/60 dark:bg-slate-800/40 rounded-[2rem]" />
           ))}
         </div>
       </div>
     );
   }
   ```
   Set `loading: () => <InventoryListSkeleton />` in `WorkspaceView.tsx`.

---

## 3. Summary of Expected Performance Gains

| Component | Metric Before | Target After Fix | Primary Mechanism |
|---|---|---|---|
| `MindMap3D.tsx` | 3,752ms Stall (Physics Explosion) | < 16ms Zero-Stall | Freeze physics on tab blur; reset `lastFrameTime` on resume; clamp delta to 33ms |
| `MindMap3D.tsx` Initial Chunk | 117.7 KB Extra Payload | Dynamic / Deferred | Lazy import `MindMapInspector` & `SemanticReviewModal` |
| `InventoryList.tsx` Scroll | 100% Cards Re-render per scroll tick | 0% Re-render (Only new rows) | Custom `areInventoryItemCardPropsEqual` comparator |
| `useVirtualGrid` | Forced Synchronous Reflow per scroll pixel | 0 Synchronous Reflow | Cached container offset & `requestAnimationFrame` scroll throttling |
| `WorkspaceView.tsx` Tab Switch | CLS & Layout Shift | 0 CLS | Structured `InventoryListSkeleton` matching exact grid dimensions |

