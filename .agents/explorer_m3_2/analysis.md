# Analysis: Manual CRUD UI for Nodes and Edges with Yjs Synchronization

This document outlines the detailed strategy and code modifications required to implement the manual CRUD UI for nodes and edges in `MindMapInspector.tsx`, synchronized with Yjs CRDTs via `useGraphCustomization.ts`.

---

## 1. Updating `addCustomNode` in `useGraphCustomization.ts`

### Current State
In `src/hooks/useGraphCustomization.ts`, `addCustomNode` only accepts `label`, `x`, `y`, and an optional `color`. It defaults `group` to `'OTHER'`, `baseValue` to `80`, and does not set `layerId`:
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

### Proposed Changes
To allow detailed custom node creation, the signature of `addCustomNode` must be expanded to accept `group`, `baseValue`, and `layerId`.
1. **Import Types**: Add `OntologyGroup` and `OntologyLayerId` to the imports from `@/lib/ontology.types`.
2. **Updated Signature**:
```typescript
  const addCustomNode = useCallback((
    label: string,
    x: number,
    y: number,
    color?: string,
    group: OntologyGroup = 'OTHER',
    baseValue: number = 80,
    layerId?: OntologyLayerId
  ) => {
    const newNode: OntologyNode = {
      id: `custom-${Date.now()}`,
      label,
      group,
      baseValue,
      layerId,
      fixedX: x,
      fixedY: y,
      customColor: color,
      centralityScore: 100,
    };
    (ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>).set(newNode.id, newNode);
    return newNode;
  }, [ydoc]);
```

---

## 2. Node Creation Form in `MindMapInspector`

### Location
When no node is active (`activeNode === null`), the inspector displays analysis panels such as "Smart Focus Radar" and the "Top 5 Focus Nodes". The Node Creation Form should be added here as a clean, interactive card.

### UI Form Requirements
- **Label input**: Text box for naming the custom node.
- **Group selection**: Dropdown selector using mappings from `GROUP_LABELS` (e.g. CORE_PROJECT, INFRASTRUCTURE, etc.).
- **Importance (baseValue)**: Sliders with real-time numeric display ranging from `0` to `100`.
- **Layer selection**: Dropdown selector using mapping from `LAYER_LABELS` (Layer 0 to Layer 3).

### Mock State Hooks inside `MindMapInspector`
```typescript
  const [newLabel, setNewLabel] = React.useState('');
  const [newGroup, setNewGroup] = React.useState<OntologyGroup>('OTHER');
  const [newBaseValue, setNewBaseValue] = React.useState<number>(80);
  const [newLayerId, setNewLayerId] = React.useState<OntologyLayerId | undefined>(undefined);
```

---

## 3. Edge Creation Form and Connection List for Selected Node

### Location
When an active node is selected (`activeNode !== null`), the edge CRUD components will be displayed as a dedicated panel in the inspector.

### Edge Creation UI
- **Target Node selection dropdown**: Populate with all nodes in `engineNodes` except the current `activeNode`.
- **Relationship Type selection**: Dropdown using mappings from `EDGE_TYPE_LABELS` (e.g., CAUSAL_DRIVE, DEPENDENCY, etc.).
- **Weight**: Slider spanning `-1.0` to `1.0` (step `0.1`), reflecting positive or negative influence weights.

### Connection List with "Delete" Buttons
By querying `connectedEdges` (already fetched from `engineRef.current.getConnectedEdges`), the UI distinguishes between:
- **Outgoing Edges**: `edge.source === activeNode.id` (Target: `otherNode.label`)
- **Incoming Edges**: `edge.target === activeNode.id` (Source: `otherNode.label`)
Each edge item features a delete button that runs `deleteCustomEdge(edge.source, edge.target)` after a confirmation modal.

---

## 4. Hooking Up UIs to the Customization Hook

To support edge weights and node creation in `MindMapInspector`, the prop interfaces must be updated.

### Interface Changes in `MindMapInspector.tsx`
```typescript
interface MindMapInspectorProps {
  // ... existing props
  addCustomNode: (
    label: string,
    x: number,
    y: number,
    color?: string,
    group?: OntologyGroup,
    baseValue?: number,
    layerId?: OntologyLayerId
  ) => any;
  addCustomEdge: (src: string, tgt: string, type?: EdgeType, weight?: number) => void;
  // ... other props
}
```

### Action Logic for Node Creation
```typescript
  const handleCreateCustomNode = () => {
    if (!newLabel.trim()) return;
    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    
    const newNode = addCustomNode(newLabel.trim(), x, y, undefined, newGroup, newBaseValue, newLayerId);
    
    // Auto-focus camera on the new node
    if (engineRef.current) {
      engineRef.current.pendingCameraTargetId = newNode.id;
    }
    
    // Clear form and activate the new node
    setActiveNode(newNode as OrbitalNode);
    setNewLabel('');
    setNewGroup('OTHER');
    setNewBaseValue(80);
    setNewLayerId(undefined);
  };
```

---

## 5. Yjs Synchronization & Layouter Rebuild Trigger

### Reactivity Loop
The canvas rendering logic in `MindMap3D.tsx` is completely reactive to Yjs changes:
1. When `addCustomNode`, `deleteCustomNode`, `addCustomEdge`, or `deleteCustomEdge` are called, they modify Yjs shared maps (`customNodesMap`, `customEdgesMap`, `deletedEdgesMap`).
2. The hook `useGraphCustomization` receives update events and sets the new snapshot through `useSyncExternalStore`.
3. In `MindMap3D.tsx`, a specific `useEffect` listens to length alterations of `customNodes`, `customEdges`, `deletedEdges`, and changes in the `topologicOverridesHash`:
   ```typescript
   useEffect(() => {
     if (customNodes.length !== prevDataLengths.current.nodes || 
         customEdges.length !== prevDataLengths.current.edges ||
         deletedEdges.length !== prevDataLengths.current.deletedEdges ||
         topologicOverridesHash !== prevDataLengths.current.topoHash) {
       initEngine();
     }
   }, [...]);
   ```
4. `initEngine()` runs, recreating the `OntologyCanvasEngine` using the updated database structure. It automatically positions nodes, resolves their connections, and applies force-directed physics.

---

## 6. Proposed Code Integration Blueprint

### Patch A: `src/hooks/useGraphCustomization.ts`
```diff
@@ -4,3 +4,3 @@
-import { OntologyNode, OntologyEdge, EdgeType } from '@/lib/ontology.types';
+import { OntologyNode, OntologyEdge, EdgeType, OntologyGroup, OntologyLayerId } from '@/lib/ontology.types';
 import { useYjsStore, globalYDoc } from './useYjsStore';
@@ -390,11 +390,17 @@
-  const addCustomNode = useCallback((label: string, x: number, y: number, color?: string) => {
+  const addCustomNode = useCallback((
+    label: string,
+    x: number,
+    y: number,
+    color?: string,
+    group: OntologyGroup = 'OTHER',
+    baseValue: number = 80,
+    layerId?: OntologyLayerId
+  ) => {
     const newNode: OntologyNode = {
       id: `custom-${Date.now()}`,
       label,
-      group: 'OTHER',
-      baseValue: 80,
+      group,
+      baseValue,
+      layerId,
       fixedX: x,
       fixedY: y,
       customColor: color,
```

### Patch B: `src/components/MindMap3D.tsx`
Ensure `addCustomNode` is passed down to `<MindMapInspector>`:
```diff
@@ -1180,3 +1180,4 @@
             <MindMapInspector
-              activeNode={activeNode} engineRef={engineRef} activeNodeOverride={activeNodeOverride} setNodeOverride={setNodeOverride}
+              activeNode={activeNode} engineRef={engineRef} activeNodeOverride={activeNodeOverride} setNodeOverride={setNodeOverride}
+              addCustomNode={addCustomNode}
               setActiveNode={setActiveNode} onRenameCategory={onRenameCategory} onDeleteCategory={onDeleteCategory}
```

### Patch C: `src/components/MindMapInspector.tsx`
Update prop types and add the form UI:
```diff
@@ -2,3 +2,3 @@
-import { OrbitalNode, OntologyEdge, GROUP_COLORS, OntologyGroup, EdgeType } from '@/lib/ontology.types';
+import { OrbitalNode, OntologyEdge, GROUP_COLORS, GROUP_LABELS, LAYER_LABELS, OntologyGroup, EdgeType, OntologyLayerId } from '@/lib/ontology.types';
 import { useGraphCustomization, NodeOverride } from '@/hooks/useGraphCustomization';
@@ -37,3 +37,4 @@
   deleteCustomNode: (id: string) => void;
-  addCustomEdge: (src: string, tgt: string, type?: EdgeType) => void;
+  addCustomNode: (label: string, x: number, y: number, color?: string, group?: OntologyGroup, baseValue?: number, layerId?: OntologyLayerId) => any;
+  addCustomEdge: (src: string, tgt: string, type?: EdgeType, weight?: number) => void;
   deleteCustomEdge: (src: string, tgt: string) => void;
```
