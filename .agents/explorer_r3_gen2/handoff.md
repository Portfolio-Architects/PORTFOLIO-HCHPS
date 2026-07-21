# Handoff Report: MindMap Node/Edge CRUD UI investigation (R3)

## 1. Observation
- **Node manual creation form**: Located in `src/components/MindMapInspector.tsx` (lines 1455-1557). It prompts for label (`createLabel`), group (`createGroup`), baseValue (`createBaseValue`), and layer (`createLayer`). Upon click of "노드 생성", it calls `addCustomNode` (line 1529).
- **HUD Add Node Modal**: Located in `src/components/MindMap3D.tsx` (lines 1496-1571). It only prompts for name (`newNodeName`) and calls `addCustomNode` with coordinates only (line 576): `addCustomNode(trimmedName, x, y)`.
- **`addCustomNode` hook function**: Defined in `src/hooks/useGraphCustomization.ts` (lines 390-412):
  ```typescript
  const addCustomNode = useCallback((
    label: string,
    x: number,
    y: number,
    color?: string,
    group?: OntologyGroup,
    baseValue?: number,
    layerId?: OntologyLayerId
  ) => { ...
  ```
- **Node deletion form**: Defined in `src/components/MindMapInspector.tsx` (lines 1347-1444) which supports cascade deletion by traversing child nodes and setting `hidden: true` overrides for all of them.
- **Node deletion via Keypress/Dialog**: Defined in `src/components/MindMap3D.tsx` via `handleExecuteDelete()` (lines 192-243), which deletes/hides only the target node without prompting for cascade deletion of descendants.
- **Edge manual creation form**: Defined in `src/components/MindMapInspector.tsx` (lines 1173-1244) which prompts for Target, Type, and Weight, and calls `addCustomEdge` (line 1226).
- **`addCustomEdge` hook function**: Defined in `src/hooks/useGraphCustomization.ts` (lines 460-476). It contains the following guard:
  ```typescript
  if (!map.has(edgeId) && !map.has(reverseId)) {
    map.set(edgeId, { source, target, weight, type });
  }
  ```
- **Edge deletion listing**: Defined in `src/components/MindMapInspector.tsx` (lines 1246-1335) which lists connections via `getConnectedEdges()` and provides buttons to call `deleteCustomEdge`.
- **Yjs synchronization**: Implemented in `src/hooks/useGraphCustomization.ts` using `useSyncExternalStore` (line 344) and Yjs observations. `MindMap3D.tsx` tracks mutations using `customizationHash` and `customNodesHash` (lines 636-654) and triggers `initEngine()` (lines 656-687).
- **Test cases**: Located in `__tests__/useGraphCustomization.test.tsx` (lines 307-313), where the test modifications for edge weight had to bypass the `addCustomEdge` hook and mutate the Yjs map directly:
  ```typescript
  // Directly modify the Yjs edge weight to simulate an update (since addCustomEdge has "not exists" guard)
  const customEdgesMap = globalYDoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
  ```

---

## 2. Logic Chain
1. **Node manual creation**: Since `MindMapInspector.tsx` contains fields for Label, Group, Importance (baseValue), and Layer, and hooks them up to the `addCustomNode` callback, the basic manual creation requirement is met (Objective 1).
2. **Re-creation bug**: If a node is deleted, its Yjs override is set to `hidden: true`. When a new custom node with the same name is created, `buildSignalGraph.ts` (line 372) merges it back to the existing node but skips applying overrides because the custom node's ID is new and has no overrides yet. Since the canonical node ID retains `hidden: true`, the recreated node is filtered out and remains invisible.
3. **Edge manual creation and modification**: The edge creation form captures all necessary fields. However, the `addCustomEdge` function only calls `map.set` when `!map.has(edgeId) && !map.has(reverseId)`. This prevents modifying an existing edge's weight or type. Therefore, Objective 3 is met for creation, but fails for modification.
4. **Edge deletion**: Since `MindMapInspector.tsx` retrieves connections using `getConnectedEdges` and provides individual delete buttons that call `deleteCustomEdge`, which registers a tombstone in `deletedEdgesMap` in Yjs, Objective 4 is fully met.
5. **Deletion inconsistency**: Deleting a node from the sidebar prompts the user to perform cascade deletion, whereas keyboard deletion in `MindMap3D` simply hides the target node solo. This results in inconsistent graph behaviors.
6. **Syncing and layouter updates**: Since `MindMap3D` listens to Yjs updates via the React store, computes hashes on topology modifications, and calls `initEngine()` to reconstruct the layout and recalculate positions, Objective 5 is fully met.

---

## 3. Caveats
- This investigation is read-only. No code modifications were implemented.
- We assumed that Yjs networking operates correctly. Testing did not involve real multi-peer Yjs network sync, but verified hook updates and state transitions using fake timers in the test suite.
- Other components (such as `WikiEditor` or `SemanticReviewModal`) were not analyzed in detail as they are outside the scope of Node/Edge CRUD.

---

## 4. Conclusion
All manual Node/Edge CRUD requirements (Objectives 1–5) are implemented and hooked up to the Yjs store via `useGraphCustomization.ts`. However, they are not entirely seamless. 
We recommend the following fixes:
1. **Resurrect deleted nodes**: Clear the `hidden` flag in Yjs overrides when creating a node with a matching name.
2. **Allow edge updates**: Modify `addCustomEdge` to update existing edges instead of ignoring them.
3. **Unify deletion behaviors**: Ensure both keyboard deletes and sidebar deletes prompt for cascading deletes where appropriate.
4. **Enhance Quick Add Modal**: Add fields to the Add Node Modal in `MindMap3D.tsx`.

---

## 5. Verification Method
1. Run lint and type checking to ensure there are no build issues:
   `npm run build` or `npm run lint`
2. Run customization tests to verify hook behaviors:
   `npm test __tests__/useGraphCustomization.test.tsx`
   - *Status*: **VERIFIED PASSING** (Run on 2026-07-16)
   - *Verbatim results*:
     ```
     PASS __tests__/useGraphCustomization.test.tsx (54.844 s)
       useGraphCustomization Hook M3 CRUD & Sync Verification
         √ 1. should store custom nodes in Yjs and reflect them in customNodes array (1111 ms)
         √ 2. should store custom edges in Yjs and reflect them in customEdges array (68 ms)
         √ 3. should delete node from customNodesMap and clean up connected edges and overrides (44 ms)
         √ 4. should delete edge and set tombstone in deletedEdgesMap when unlinking (55 ms)
         √ 5. should not change hashes when changing fixedX/fixedY coordinates, but should change when modifying structural fields (123 ms)
     ```
3. Inspect code references for:
   - `src/components/MindMapInspector.tsx`
   - `src/components/MindMap3D.tsx`
   - `src/hooks/useGraphCustomization.ts`
   - `src/lib/signal-graph.ts`
