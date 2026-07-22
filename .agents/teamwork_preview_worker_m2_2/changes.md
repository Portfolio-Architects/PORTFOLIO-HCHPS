# Summary of Changes

## 1. `src/components/inventory/InventoryList.tsx`
- **Prop Comparator & Memoization**:
  - Implemented `areInventoryItemCardPropsEqual` custom prop comparator.
  - Compares `history` array items by value (`id` and `change`) instead of reference equality.
  - Exported `InventoryItemCard = React.memo(InventoryItemCardComponent, areInventoryItemCardPropsEqual)`.
- **`useVirtualGrid` Optimization**:
  - Throttled window/container scroll event listener using `requestAnimationFrame`.
  - Cached `containerOffsetTop` calculation on mount and window resize events.
  - Removed synchronous `getBoundingClientRect()` invocations from passive scroll listeners to eliminate layout thrashing.

## 2. `src/components/MindMap3D.tsx`
- **Physics Freeze & Pause Control**:
  - Invoked `engineRef.current?.freeze()` when `isActive` is `false` or `document.hidden` is `true`.
  - Reset `lastFrameTime = performance.now()` upon resume to prevent simulation velocity spikes.
- **Render Loop & Delta Time Clamping**:
  - In `loop()`, added time jump reset: if `now - lastFrameTime > 100`, resets `lastFrameTime = now - 16.6`.
  - Clamped single-step delta: `delta = Math.min(now - lastFrameTime, 33.3)`.
  - Removed line 818 post-render `lastFrameTime = performance.now()` overwrite.
- **Dynamic Import Sub-Modals**:
  - Converted `MindMapInspector` and `SemanticReviewModal` imports to Next.js dynamic imports (`dynamic(() => import(...), { ssr: false })`).

## 3. `src/components/WorkspaceView.tsx`
- **Grid Layout Skeleton**:
  - Created `InventoryListSkeleton` component matching actual layout & 3-column grid dimensions with pulse animations.
- **Dynamic Import Fallback**:
  - Configured `InventoryList` dynamic import with `loading: () => <InventoryListSkeleton />`.
