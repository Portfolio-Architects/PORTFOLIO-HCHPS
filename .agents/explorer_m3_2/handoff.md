# Handoff Report: Manual CRUD UI for Nodes and Edges with Yjs Synchronization

This handoff report summarizes the findings, architectural decisions, and integration strategy to enable manual CRUD UI for nodes and edges within `MindMapInspector.tsx`, synchronized with Yjs.

---

## 1. Observation

The investigation analyzed four key files:
- **`src/hooks/useGraphCustomization.ts`**:
  - `addCustomNode` is defined on line 390 as:
    ```typescript
    const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
    ```
    This function sets hardcoded values for `group` (`'OTHER'`) and `baseValue` (`80`), and ignores `layerId`.
  - `addCustomEdge` is defined on line 451:
    ```typescript
    const addCustomEdge = useCallback((source: string, target: string, type: EdgeType = 'DEPENDENCY', weight: number = 1.0) => {
    ```
- **`src/components/MindMapInspector.tsx`**:
  - Props list `addCustomEdge` on line 37:
    ```typescript
    addCustomEdge: (src: string, tgt: string, type?: EdgeType) => void;
    ```
    Note that this signature omits the `weight` parameter.
  - The fallback view (when `activeNode` is null) starts at line 1331:
    ```typescript
    ) : (
      <div className="p-4.5 flex flex-col h-full gap-4">
        {priorityNodes.length > 0 ? (
    ```
    It has no custom node creation form.
- **`src/components/MindMap3D.tsx`**:
  - A `useEffect` hook starting at line 636 automatically tracks collection changes and overrides to trigger layout updates:
    ```typescript
    useEffect(() => {
      ...
      if (customNodes.length !== prevDataLengths.current.nodes || 
          customEdges.length !== prevDataLengths.current.edges ||
          deletedEdges.length !== prevDataLengths.current.deletedEdges ||
          topologicOverridesHash !== prevDataLengths.current.topoHash) {
        initEngine();
      }
    }, [...]);
    ```
- **`src/lib/ontology.types.ts`**:
  - Mappings such as `GROUP_LABELS` (lines 28–36) and `LAYER_LABELS` (lines 76–81) define human-readable Korean labels for groups and layers.

---

## 2. Logic Chain

1. **Parameter Extension**: To allow user selection of group, importance, and layer, `addCustomNode` in `useGraphCustomization.ts` must be extended from its signature on line 390 to accept `group: OntologyGroup`, `baseValue: number`, and `layerId?: OntologyLayerId`.
2. **Prop Injection**: `MindMapInspector` needs to receive `addCustomNode` as a prop from `MindMap3D.tsx`, and the prop signature of `addCustomEdge` must be updated to accept `weight?: number`.
3. **Form Rendering**:
   - **Node Form**: Placing a form inside the `else` block (line 1332) of `MindMapInspector.tsx` allows creation of nodes when `activeNode` is null. Text fields, selectors (`GROUP_LABELS`, `LAYER_LABELS`), and a range input (`0-100` for `baseValue`) will capture inputs.
   - **Edge Form**: In the active node panel, displaying a target dropdown (excluding the active node), a type selector (`EDGE_TYPE_LABELS`), and a weight slider (`-1.0` to `1.0`) enables edge creation.
4. **Reactivity & Redraw**:
   - Setting Yjs values triggers update notifications to all synced peers.
   - The reactive `useEffect` in `MindMap3D.tsx` detects collection size updates and initiates `initEngine()`, updating the physics canvas layout automatically.
   - Manually focusing the camera on a new node is accomplished by setting `engineRef.current.pendingCameraTargetId` to the new node's ID.

---

## 3. Caveats

- **Layout Drift**: Randomly positioned new nodes ($x, y$ within a radius of $50$) may take a few frames to settle due to the force-directed solver.
- **Offline States**: Yjs updates are stored in memory and indexedDB. If offline, Yjs maintains local consistency and syncs upon reconnecting.

---

## 4. Conclusion

Implementing the CRUD UI requires:
1. Extending the signatures of `addCustomNode` in `useGraphCustomization.ts` and `addCustomEdge` in `MindMapInspector.tsx`.
2. Adding a node creation form in the fallback view of `MindMapInspector.tsx` and an edge creation/list view in the active node inspection view of `MindMapInspector.tsx`.
3. Relying on `MindMap3D`'s existing reactive `useEffect` to trigger engine reinits.

---

## 5. Verification Method

To verify the proposed implementation:
1. **Type Checks**: Run `npx tsc --noEmit` from the root directory to confirm all types in `MindMapInspector.tsx` and `useGraphCustomization.ts` compile without errors.
2. **Inspection**: Verify that `GROUP_LABELS` and `LAYER_LABELS` are used to render options in selectors.
3. **Redraw Verification**: Inspect if adding/deleting nodes triggers `initEngine()` in `MindMap3D.tsx` by verifying changes to the Yjs `customNodes` array length.
