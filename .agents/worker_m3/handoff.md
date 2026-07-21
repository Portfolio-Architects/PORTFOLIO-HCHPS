# Handoff Report: Manual Node/Edge CRUD UI with Yjs Sync (Milestone 3)

This report details the implementation of a manual Node and Edge CRUD UI in the 3D MindMap, fully synchronized with Yjs, along with the verification details and layout sync optimizations.

---

## 1. Observation

- **`src/hooks/useGraphCustomization.ts`**:
  - Located the hardcoded properties inside `addCustomNode` callback:
    ```typescript
    const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
      const newNode: OntologyNode = {
        id: `custom-${Date.now()}`,
        label,
        group: 'OTHER',
        baseValue: 80,
        ...
    ```
    This definition did not accept group, baseValue, or layerId, preventing proper custom node initialization.
- **`src/components/MindMapInspector.tsx`**:
  - Found that the sidebar lacked form states for custom node/edge fields and did not show forms when `activeNode` was null.
  - The previous connections list in `activeNode` panel (the old "4. 연결 끊기" section) looped over `uniqueConnectedEdges` and displayed unstructured connections:
    ```typescript
    {uniqueConnectedEdges.map(({ otherNode }) => { ... })}
    ```
- **`src/components/MindMap3D.tsx`**:
  - Found the reactive layout useEffect that triggers `initEngine()` when custom arrays or `topologicOverridesHash` changed:
    ```typescript
    if (customNodes.length !== prevDataLengths.current.nodes || 
        customEdges.length !== prevDataLengths.current.edges ||
        deletedEdges.length !== prevDataLengths.current.deletedEdges ||
        topologicOverridesHash !== prevDataLengths.current.topoHash)
    ```
    This hash tracked only `customParent` and `customOrbitIndex`, ignoring edits to labels, colors, groups, edge types, and weights.
- **Verification Commands & Results**:
  - Running `npx tsc --noEmit` returned successful compilation with no errors.
  - Running `npm run lint` initially returned:
    ```
    D:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\src\components\MindMapInspector.tsx
      459:9  warning  'uniqueConnectedEdges' is assigned a value but never used  @typescript-eslint/no-unused-vars
    ```
    After removing `uniqueConnectedEdges`, `npm run lint` completed cleanly.
  - Running `npm run test` ran 7 test suites, with 48/48 tests passing.
  - Running `npm run build` completed successfully, compiling the Turbopack build and generating all static routes.

---

## 2. Logic Chain

1. **Yjs Hook Upgrade**: Extending `addCustomNode` in `useGraphCustomization.ts` to accept `group: OntologyGroup`, `baseValue: number`, and `layerId?: OntologyLayerId` enables saving user-specified values to Yjs.
2. **Sidebar UI Additions**:
   - Implementing a form in `MindMapInspector.tsx` (shown when `activeNode` is null) with text inputs, sliders, and selection boxes populated with `GROUP_LABELS` and `LAYER_LABELS` lets users add nodes.
   - Adding target selection (filtered to active/visible nodes), relationship type selection (`EDGE_TYPE_LABELS`), and weight sliders (-1.0 to 1.0) under the active node allows manual connection creation.
3. **Categorized Connections List**:
   - Splitting connections into Outgoing (`edge.source === activeNode.id`) and Incoming (`edge.target === activeNode.id`) clarifies directional dependencies.
   - Calling `deleteCustomEdge` alongside clearing parent overrides (if the connection was a hierarchy link) ensures both visual and topological cleanup.
4. **Layout Redraw Convergence**:
   - Creating `customizationHash` (which includes overrides and custom edge weights/types, but ignores `fixedX` and `fixedY`) and `customNodesHash` ensures that metadata edits trigger `initEngine()` correctly without affecting drag performance.
   - The reactive `useEffect` checks these hashes and re-runs physics layouts whenever updates occur, converging layouts instantly.

---

## 3. Caveats

- **Dragging FPS Protection**: The `customizationHash` explicitly ignores `fixedX` and `fixedY`. While this ensures 60FPS dragging, coordinate syncing occurs silently under the hood. Only permanent property edits (e.g. groups, types, names, parent updates) trigger a full layout re-init.

---

## 4. Conclusion

Milestone 3 is successfully implemented:
- Forms for manual node creation and manual edge connection are fully operational.
- Incoming/Outgoing connections are split and show 'Unlink' buttons that clean up parent-child metadata as needed.
- layout recalculations trigger correctly on custom node property changes and overrides via `customizationHash` and `customNodesHash`.
- Build, lint, and tests compile and pass successfully.

---

## 5. Verification Method

To verify the changes:
1. **Type Checks**: Run `npx tsc --noEmit` from the project root.
2. **Linter Checks**: Run `npm run lint` to verify that there are no style or unused variable warnings.
3. **Testing**: Run `npm run test` to verify all 48 test cases pass.
4. **Build**: Run `npm run build` to confirm compilation in Turbopack passes without errors.
