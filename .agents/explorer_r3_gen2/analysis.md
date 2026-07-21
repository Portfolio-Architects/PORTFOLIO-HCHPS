# Engineering Analysis: MindMap Node/Edge CRUD UI Audit (R3)

## Executive Summary
This report presents an in-depth investigation of `src/components/MindMapInspector.tsx`, `src/components/MindMap3D.tsx`, and their integration with `useGraphCustomization.ts` to assess compliance with the manual Node/Edge CRUD requirements defined in `SCOPE.md` (Objectives 1–5). 

The investigation confirms that the **basic CRUD operations are fully hooked up to Yjs and functional**, but identifies **2 critical bugs and 3 UI/UX discrepancies** that impair the robustness and consistency of the user experience. Detailed findings, specific trace analysis, and remediation recommendations are provided below.

---

## 1. Objectives Compliance Matrix (SCOPE.md)

| Objective | Requirement | Status | Verification & Hookup Details |
| :--- | :--- | :--- | :--- |
| **Obj 1** | **Node Manual Creation UI** | **MET (With Caveats)** | Form present in `MindMapInspector` when no node is active; prompts for Label, Group, Importance, and Layer; calls `addCustomNode` prop. (Caveat: HUD "+" modal does not prompt for all fields). |
| **Obj 2** | **Node Deletion UI** | **MET (With Caveats)** | "Delete Node" button present in `MindMapInspector`; delete keypress and modal present in `MindMap3D`; calls `deleteCustomNode` and sets `hidden: true` override. (Caveat: Inconsistent cascading delete behavior). |
| **Obj 3** | **Edge Manual Creation UI** | **MET (With Caveats)** | Form present in `MindMapInspector` under "수동 관계 연결"; prompts for Target, Type, and Weight; calls `addCustomEdge`. (Caveat: Cannot edit existing edges due to guard). |
| **Obj 4** | **Edge Deletion UI** | **MET** | Lists incoming and outgoing edges in `MindMapInspector` with "Delete" (`Unlink` icon) buttons; calls `deleteCustomEdge` which sets tombstones in Yjs. |
| **Obj 5** | **CRDT Sync & Rerendering** | **MET** | State syncs via `useSyncExternalStore` with 16ms debounce; `MindMap3D` tracks changes via `customizationHash` / `customNodesHash` and re-initializes layouts dynamically. |

---

## 2. Detailed Findings (Bugs & Gaps)

### Finding 1: The Tombstone Re-creation Invisible Node Bug (Critical)
* **Description**: If a user deletes a node, it is marked as `hidden: true` in the Yjs overrides map. When the user later recreates a node with the **same name** (either via Sidebar or the Add Modal), it is generated with a new unique ID (e.g., `custom-12345`). However, during the graph compilation in `buildSignalGraph.ts` (line 372), the new custom node is merged into the existing canonical data/tag/leaf node because the labels match. 
* **The Glitch**: The merge process does **not** clear the `hidden: true` flag from the target node's overrides. As a result, the newly recreated node remains hidden and is pruned from the graph. The user is left confused as the node they just created does not appear on the screen.
* **Evidence Trace**:
  - `buildSignalGraph.ts` (lines 372-402):
    ```typescript
    if (dataLabels.has(actualLabel)) {
      const targetNodeId = dataLabels.get(actualLabel)!;
      mergedIdMap.set(cn.id, targetNodeId);
      if (override) { // Since cn is new, overrides for cn.id are undefined. This block is skipped!
        // ...
      }
      return; // Skip adding cn (skips rendering duplicate)
    }
    ```
  - Since the override for `targetNodeId` in Yjs still has `hidden: true`, `hiddens.add(targetNodeId)` is executed (line 803), filtering the node out entirely (line 808).

### Finding 2: `addCustomEdge` Modification Guard prevents Edge Updates (Major)
* **Description**: When a custom edge is created, it is stored in `customEdgesMap` using a key like `source|||target`. If a user attempts to edit the weight or type of an existing edge using the Edge Creation Form, the change is silently ignored.
* **Evidence Trace**:
  - `useGraphCustomization.ts` (lines 472-474):
    ```typescript
    if (!map.has(edgeId) && !map.has(reverseId)) {
      map.set(edgeId, { source, target, weight, type });
    }
    ```
  - This check prevents updates. Tests in `__tests__/useGraphCustomization.test.tsx` (line 307) had to bypass this function and modify the Yjs map directly to test edge property updates.

### Finding 3: Inconsistent Deletion Logic (Cascade vs. Solo) (Medium)
* **Description**: 
  - In `MindMapInspector.tsx` (lines 1358–1378), deleting a node checks if it has children and prompts: *"하위 노드도 전체 함께 삭제하시겠습니까?"*. If confirmed, it recursively flags all descendants as hidden.
  - In `MindMap3D.tsx` (lines 192–243), deleting via the `Delete` key listener or the confirmation dialog runs `handleExecuteDelete()`, which does **not** check for children or perform cascade deletion. It only hides/deletes the target node, leaving children orphaned.
* **UX Impact**: Deletion behaves differently depending on whether it was triggered from the sidebar panel or from the canvas/keyboard, leading to inconsistent graph state.

### Finding 4: Inconsistent Node Creation Form Fields (Minor)
* **Description**: The creation form in `MindMapInspector.tsx` fully prompts for Label, Group, baseValue, and layerId (satisfying Objective 1). However, the quick-add HUD button in `MindMap3D.tsx` opens a modal that only prompts for "노드 이름" (Label) and sets other values to default. 
* **UX Impact**: Modifying group or layer for a node added from the HUD requires selecting the node and searching for options, which is cumbersome.

### Finding 5: Missing Deselect / Close Button in Side Panel (UX)
* **Description**: There is no button to close or deselect the active node in the standard Sidebar layout (`isOverlay = false` mode). The user must click the empty space on the canvas to return to the "Add Custom Node" form.
* **UX Impact**: Unintuitive for users who expect a close (X) or deselect button in the sidebar panel.

---

## 3. Remediation Recommendations

### 1. Fix Tombstone Re-creation Bug
Modify both the sidebar node creation handler (`MindMapInspector.tsx`) and the modal node creation handler (`MindMap3D.tsx`) to check if a node with the same name was previously hidden, and clear the override. 
* **Proposed Code Snippet (before `addCustomNode`):**
  ```typescript
  // Find any existing node ID by name in overrides
  const targetId = Object.keys(overrides).find(id => overrides[id]?.customLabel === name || id.endsWith(`-${name}`) || id === `tag-${name}`);
  if (targetId && overrides[targetId]?.hidden) {
    setNodeOverride(targetId, { hidden: null }); // Clear hidden tombstone
  }
  ```

### 2. Allow Edge Updates in `addCustomEdge`
Modify `addCustomEdge` in `useGraphCustomization.ts` to update properties if the edge already exists:
* **Proposed Implementation:**
  ```typescript
  const addCustomEdge = useCallback((source: string, target: string, type: EdgeType = 'DEPENDENCY', weight: number = 1.0) => {
    const edgeId = `${source}|||${target}`;
    const reverseId = `${target}|||${source}`;
    
    ydoc.transact(() => {
      const map = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
      const deletedMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
      
      if (deletedMap.has(edgeId)) deletedMap.delete(edgeId);
      if (deletedMap.has(reverseId)) deletedMap.delete(reverseId);

      if (map.has(edgeId)) {
        map.set(edgeId, { source, target, weight, type });
      } else if (map.has(reverseId)) {
        map.set(reverseId, { source: target, target: source, weight, type });
      } else {
        map.set(edgeId, { source, target, weight, type });
      }
    });
  }, [ydoc]);
  ```

### 3. Unify Cascade Deletion Logic
Move the recursive child search and prompt logic into a shared utility function, or implement cascade deletion inside `MindMap3D.tsx`'s `handleExecuteDelete()` so that keyboard deletes and confirmation dialogs behave identically to sidebar deletes.

### 4. Direct HUD Modal to Sidebar or Enhance Form
Either:
- Enhance the HUD "+" modal in `MindMap3D.tsx` to include Group, Importance, and Layer selections.
- Or, make the HUD "+" button clear selection and focus/highlight the creation form in the Sidebar.

### 5. Add Deselect/Close Button to Sidebar
In `MindMapInspector.tsx`, add an close/deselect button in the inspector header regardless of `isOverlay`:
* **Proposed Code:**
  ```typescript
  <div className="px-4.5 py-3.5 border-b border-white/20 bg-slate-500/5 flex justify-between items-center">
    <h3 className="text-[12.5px] font-bold text-slate-500 uppercase tracking-wider">노드 인스펙터</h3>
    {/* Always render close button to allow deselecting and returning to Create form */}
    <button onClick={() => setActiveNode(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shrink-0">
      <X size={16} />
    </button>
  </div>
  ```
