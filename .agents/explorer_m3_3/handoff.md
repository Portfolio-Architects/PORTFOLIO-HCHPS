# Handoff Report: Manual Node/Edge CRUD UI with Yjs Sync Strategy

## 1. Observation
The following source code components and structures were directly examined:

### A. `src/lib/ontology.types.ts`
- **Line 74**: `OntologyLayerId` type represents layers as:
  ```typescript
  export type OntologyLayerId = 0 | 1 | 2 | 3;
  ```
- **Lines 83–110**: `OntologyNode` contains:
  ```typescript
  export interface OntologyNode {
    id: string;
    label: string;
    group: OntologyGroup;
    baseValue: number;
    parentId?: string;
    layerId?: OntologyLayerId;
    ...
  }
  ```

### B. `src/hooks/useGraphCustomization.ts`
- **Lines 390–403**: `addCustomNode` adds a node to Yjs document:
  ```typescript
  const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group: 'OTHER',
      baseValue: 80,
      fixedX: x,
      fixedY: y,
      customColor: color,
      centralityScore: 100,
    };
    (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);
  ```

### C. `src/components/MindMapInspector.tsx`
- **Lines 25–46**: Props interface `MindMapInspectorProps` currently exposes `addCustomEdge`, `deleteCustomEdge`, and `deleteCustomNode`, but misses `addCustomNode`:
  ```typescript
  interface MindMapInspectorProps {
    ...
    deleteCustomNode: (id: string) => void;
    addCustomEdge: (src: string, tgt: string, type?: EdgeType) => void;
    deleteCustomEdge: (src: string, tgt: string) => void;
    ...
  }
  ```
- **Lines 1331–1430**: The component renders list of "요주의 노드 Top 5" and placeholders when `activeNode` is null, without displaying any node creation forms.
- **Lines 1175–1214**: Shows deduplicated connections for the selected node but lacks edge creation controls or incoming vs outgoing direction labeling:
  ```typescript
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">연결 끊기 (관계 해제)</label>
  ```

---

## 2. Logic Chain
1. **Adding Node Fields**: `addCustomNode` currently hardcodes `group` as `'OTHER'` and `baseValue` as `80`. It doesn't write `layerId` at all. To support fully customizable node creation, we must update the callback signature of `addCustomNode` to take these optional parameters and apply them during the custom node initialization (Observation B).
2. **Displaying Node Form**: When no active node is selected (`activeNode === null`), the inspector render method returns placeholder components (Observation C). Placing a form in this branch with controls for label, group, importance (baseValue), and layer selection, and hooking it up to `addCustomNode`, satisfies the Node CRUD UI requirement.
3. **Displaying Edge Form & Connections**: Currently, `MindMapInspector` has a "관계 끊기 (관계 해제)" block that only lists other node labels in a deduplicated manner (Observation C). We can expand this list by retrieving direction (Incoming/Outgoing) from the source/target fields, showing the relationship types, and adding an Edge creation dropdown targeting other available nodes in the canvas with customized types and weights.
4. **Triggering Layout Updates**: The engine (`OntologyCanvasEngine.ts`) marks the layout dirty on initialization:
   ```typescript
   this.layoutWorldGeometryDirty = true;
   this.topologyDirty = true;
   this.isTopologyDirty = true;
   ```
   Since the parent `MindMap3D.tsx` monitors custom node and edge arrays for updates and calls `initEngine()` when they change (initiating a fresh engine), Yjs updates automatically trigger full layout dirty flagging and physics solver updates (Observation C, engine logic).

---

## 3. Caveats
- **Coordinates Assignment**: Since manual node creation in `MindMapInspector` occurs when no active node is selected, there is no spatial context. We assign random positions like `(Math.random() - 0.5) * 50` to let the force-directed layout resolve its position relative to parents or layers.
- **Yjs Event Debouncing**: `useGraphCustomization` applies a 16ms debounce window to bundle rapid changes. This reduces render overhead on rapid slider updates (e.g. importance slider), but requires `setTimeout(() => initEngine(), 50)` callbacks to ensure the engine re-layouts with complete data.

---

## 4. Conclusion
A manual Node/Edge CRUD UI with Yjs sync can be implemented cleanly by:
1. Enhancing `addCustomNode` signature in `useGraphCustomization.ts` to accept `group`, `baseValue`, and `layerId`.
2. Building a "Create Node" form inside `MindMapInspector.tsx` that renders when `activeNode` is null.
3. Building a "Create Edge" form and a classified connection list (Incoming vs Outgoing) with delete buttons inside `MindMapInspector.tsx` when `activeNode` is selected.
4. Passing `addCustomNode` as a prop from `MindMap3D.tsx` to `MindMapInspector.tsx`.
5. Using `setTimeout(..., 50)` on actions to sync layout calculations cleanly.

---

## 5. Verification Method
1. **Codebase Inspection**: Verify that `useGraphCustomization.ts`, `MindMapInspector.tsx`, and `MindMap3D.tsx` are updated with the proposed changes.
2. **Lint & Build check**: Run `npm run build` and `npm run lint` on the terminal to check for syntax and type issues.
3. **Behavioral Test**:
   - Open the 3D Mind Map view.
   - Deselect any active node. Verify that the "새 노드 수동 추가" form appears in the inspector. Enter a name, select a group, set importance, pick a layer, and click "노드 생성". Verify that the node appears in the canvas.
   - Select the newly created node. Verify that the "수동 관계 연결" form and connection list appear. Select a target node, relationship type, weight, and click "관계 추가". Verify that the edge is rendered on the canvas and listed under "연결 목록".
   - Click the "Delete" trash icon next to the link. Verify that the connection is immediately deleted.
