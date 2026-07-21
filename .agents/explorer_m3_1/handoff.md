# Handoff Report: Manual Node/Edge CRUD UI with Yjs Sync

## 1. Observation
- **File Paths and Lines examined**:
  - `src/lib/ontology.types.ts` (lines 83-110, 154-159): Defines `OntologyNode` with optional `layerId` (`OntologyLayerId` typed as `0 | 1 | 2 | 3`) and `group` (`OntologyGroup`). Defines `OntologyEdge` with `source`, `target`, `weight`, and `type`.
  - `src/hooks/useGraphCustomization.ts` (lines 390-403): `addCustomNode` callback hardcodes group as `'OTHER'` and importance (`baseValue`) as `80`, and does not support `layerId`.
  - `src/components/MindMapInspector.tsx` (lines 1331-1430): Displays Focus Radar and priority nodes when `activeNode` is null. Has no manual node addition UI.
  - `src/components/MindMapInspector.tsx` (lines 942-1000, 1168-1215): Displays an AI relations recommender dropdown and a single de-duplicated "연결 끊기 (관계 해제)" connection list. Has no manual edge creation UI.
  - `src/components/MindMap3D.tsx` (lines 626-654): Re-initializes the layout engine only when `customNodes.length`, `customEdges.length`, or `deletedEdges.length` change. Does not track node metadata or override label/color updates.

---

## 2. Logic Chain
1. **Observation Reference**: `useGraphCustomization.ts:390` defines `addCustomNode(label, x, y, color)`.
   - **Reasoning**: To support rich metadata for custom nodes, `addCustomNode` needs parameters for `group`, `baseValue`, and `layerId`, which it will serialize into the Yjs `customNodesMap` map.
2. **Observation Reference**: `MindMapInspector.tsx:1331` contains the empty activeNode layout.
   - **Reasoning**: To enable node CRUD from the panel, we need to embed a node creation form (Label input, Group dropdown, Importance slider, and Layer dropdown) here. This form will invoke the updated `addCustomNode`.
3. **Observation Reference**: `MindMapInspector.tsx:942` and `1168` show a lack of manual edge addition and basic unlinking.
   - **Reasoning**: To implement edge CRUD, we need an edge creation form (Target selection dropdown, Edge Type selection dropdown, and Weight slider) using `addCustomEdge`, plus a list of actual Incoming and Outgoing connections with separate Delete buttons (using `deleteCustomEdge` and updating parent-child relationships).
4. **Observation Reference**: `MindMap3D.tsx:626` only triggers `initEngine()` on length changes of arrays.
   - **Reasoning**: To ensure edits to names, colors, groups, etc. sync in real-time across peers without lagging dragging (which updates coordinates at 60 FPS), we must compute a comprehensive hash of customization settings (labels, colors, parents, and orbits, excluding coordinates) and a hash of custom nodes' fields, and watch them in the React `useEffect` hook.

---

## 3. Caveats
- Coordinate updates (`fixedX` and `fixedY`) are intentionally excluded from the dependency hashes to prevent recreating the entire graph layout engine on every pixel drag, maintaining high rendering performance.
- When deleting a hierarchical edge, the parent-child relationship itself (`customParent`) must be explicitly set to `'NONE'` in overrides, in addition to calling Yjs `deleteCustomEdge`, otherwise `buildSignalGraph` will recreate the structural edge on next rebuild.

---

## 4. Conclusion
We have formulated a clean, performant, and robust strategy to implement Milestone 3. The strategy handles manual CRUD for nodes and edges, ensures real-time Yjs synchronization, and handles layout rebuilding correctly on node/edge creation, metadata edits, and deletion without degrading dragging performance.

---

## 5. Verification Method
- **Inspecting the Implementations**:
  - Verify `addCustomNode` in `useGraphCustomization.ts` supports group, baseValue, and layerId.
  - Verify the node creation form is rendered when no active node is selected in `MindMapInspector`.
  - Verify the edge creation form and connections list with Incoming/Outgoing classification and Delete buttons are rendered for active nodes.
  - Verify dragging nodes does not cause lag, and changes to node names or connection weights sync in real-time.
- **Verification Commands**:
  - Run `npm run lint` or `npx eslint src/` to check for syntax and type issues.
  - Run Next.js build: `npm run build` to confirm compilation is clean.
  - Use `node scripts/sync-rules.js` to synchronize the milestones logs after making modifications.

---

## 6. Remaining Work (Soft Handoff Next Steps)
1. **Extend `addCustomNode`**: Update `useGraphCustomization.ts` to accept and set `group`, `baseValue`, and `layerId`.
2. **Add Node Form**: Add state and JSX to `MindMapInspector.tsx` to display the Node Creation Form when `activeNode` is null.
3. **Add Edge Form & List**: Add target select, edge type select, weight slider, and Incoming/Outgoing lists with disconnect logic in `MindMapInspector.tsx` when `activeNode` is selected.
4. **Rebuild Trigger Hash**: Refactor `MindMap3D.tsx` to watch `customizationHash` and `customNodesHash` in its layout-rebuilding `useEffect`.
5. **Lint and Build**: Run eslint and typescript compile checks to verify type correctness.
