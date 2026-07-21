# Scope: Milestone 3 - Manual Node/Edge CRUD UI with Yjs Sync (R3)

## Objectives
1. **Node Manual Creation UI**:
   - In `MindMapInspector.tsx`, add a form to allow users to create new custom nodes manually.
   - The form should prompt for: Label, Group (Category), baseValue (Importance), and layerId.
   - When submitted, call the Yjs custom node creation hook/method `addCustomNode` (passed down from MindMap3D or retrieved).
2. **Node Deletion UI**:
   - For any selected node (especially custom nodes, or any node except the root), add a "Delete Node" button.
   - Clicking it calls `deleteCustomNode` to clean up the node and its relationships in the Yjs CRDT store.
3. **Edge Manual Creation UI**:
   - Add a form to create a relationship (edge) from the current active node to another node selected from a dropdown.
   - The form should allow specifying the edge type (e.g. `DEPENDENCY`, `CAUSAL_DRIVE`, `COMPONENTS`, etc.) and optionally weight.
   - When submitted, call `addCustomEdge` to write the relationship into Yjs.
4. **Edge Deletion UI**:
   - List the current active node's connections (both incoming and outgoing).
   - Provide a "Delete" button next to each edge in the list.
   - Clicking it calls `deleteCustomEdge` to register the deletion (tombstone) in Yjs.
5. **CRDT Sync & Rerendering**:
   - Verify that all mutations (creating/deleting nodes/edges) immediately trigger rendering updates across Yjs network peers, and trigger layouter dirty flagging so the positions recalculate correctly.

## Files to Modify
- `src/components/MindMapInspector.tsx`
- `src/components/MindMap3D.tsx` (if props or callback bindings need to be updated)

## Verification Method
- Manually create a node, verify it appears in the 3D Mindmap.
- Delete a node, verify it and its connected edges disappear.
- Create an edge between two nodes, verify the edge is drawn on the 3D Mindmap.
- Delete an edge, verify it is removed.
- Run build and lint.

## Milestone Status
- Status: DONE
- Completed At: 2026-07-16T15:55:00+09:00
- Key Outputs:
  - `src/hooks/useGraphCustomization.ts` (fixes for recreation and edge weight/type updates)
  - `src/components/MindMap3D.tsx` (fixes for cascade deletion in canvas)
  - `src/components/MindMapInspector.tsx` (fixes for deselect button in sidebar panel)
  - Updated Jest tests in `__tests__/useGraphCustomization.test.tsx`
  - Verified compilation and Jest execution (60/60 tests passed, verdict CLEAN)

