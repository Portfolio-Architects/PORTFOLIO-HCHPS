# Analysis & Implementation Plan: VITAL MindMap 3D & AI Engine Enhancement

## Core Findings Summary
This report analyzes three core areas of the VITAL Work & Wealth collaborative knowledge graph:
1. **AI Semantic Engine & Review Modal**: Standardizing LLM ontology extraction prompts (Gemini API) and planning an interactive User Review Modal before merging nodes/edges to the Yjs collaborative CRDT.
2. **3D Rendering Performance (60 FPS)**: Optimizing rendering math (caching trigonometric calls, bypassing LERP during orbit, and camera/node dirty flags).
3. **Manual Node/Edge CRDT Controls**: Creating UI elements in the `MindMapInspector` side panel to manually add/delete custom nodes and edges, communicating directly with Yjs maps via standard hooks.

---

## 1. R1: AI Semantic Engine Enhancement & Review Modal

### A. Code Inspection & Current Flow
The semantic extraction and Yjs merging logic are defined in:
- **API Route**: `src/app/api/llm/extract/route.ts`
  - Receives unstructured `text`.
  - Runs Gemini API (`gemini-3.5-flash` / `gemini-1.5-flash` / `gemini-1.5-pro`) using Gemini's native JSON Schema structured output feature (`responseSchema` matching node/edge structures).
  - Falls back to `Heuristic Local Extraction` if API keys are missing or fail (scans Korean text, matches hardcoded keywords to generate mock nodes, and chains them with component/assignee/budget edges).
- **Client Extractor Hook**: `src/lib/engine/ontology-extractor.ts`
  - Defines `extractSemanticGraph(text)` to call the extraction API.
  - Defines `mergeExtractedGraph(ydoc, extracted)` to immediately merge the nodes/edges into Yjs maps (`customNodesMap`, `customEdgesMap`, `deletedEdgesMap`) in a single `ydoc.transact` transaction.

### B. Prompt & Extraction Logic Enhancement Plan
To improve the accuracy, consistency, and reliability of the extracted ontology network:
1. **Deterministic ID Generation**:
   - Instruct the LLM to generate lowercase, underscore-separated, English-compatible IDs based on the semantic meaning of Korean labels (e.g. "서울체력장 연구용역" -> `seoul_fitness_research_study`), avoiding random string hashes or raw Korean characters in Yjs keys.
2. **Edge Type & Directionality Rules**:
   - **`ASSIGNEE`**: Source must be a Person node (Layer 0), Target must be a Task/Meeting node (Layer 2).
   - **`BUDGET_SOURCE`**: Source must be a Budget/Asset node (Layer 1), Target must be a Task (Layer 2) or Equipment (Layer 1) node.
   - **`DEPENDENCY`**: Source must be a prerequisite Task/Meeting (Layer 2) or Wiki/Document (Layer 3), Target must be a dependent Task.
   - **`COMPONENTS`**: Source must be a parent entity, Target must be a constituent part.
3. **Few-Shot Examples**:
   - Embed 1 or 2 concrete Korean-to-JSON training examples in the prompt to help Gemini align with the schema types and directional constraints.
4. **Weight Standardization**:
   - positive weights (+0.1 to +1.0) for supportive relationships, negative weights (-0.1 to -1.0) for Bottleneck or Conflict relationships.

### C. User Review Modal Design Plan
To prevent AI extraction noise from corrupting Yjs shared state, we will insert an interactive review step before merging.
- **Component**: Create `src/components/mindmap/ui/SemanticReviewModal.tsx`.
- **UI Structure**:
  - A modal dialog showing two tables or side-by-side grids: **Nodes** and **Edges** to be imported.
  - **Checkboxes**: Next to each node/edge to select/deselect them.
  - **Inline Editors**:
    - Nodes: Edit Label (text input), Group (select dropdown: `CORE_PROJECT`, etc.), Layer (select dropdown: 0-3).
    - Edges: Edit Type (select dropdown: `DEPENDENCY`, etc.), Weight (number input/slider: -1.0 to 1.0).
  - **Actions**:
    - "Select All" / "Deselect All".
    - "Add Row" to manually append custom nodes/edges on the fly during review.
    - "Apply Selected to Workspace": Calls `mergeExtractedGraph(ydoc, filteredExtracted)` and closes.
- **Integration**: Mount the modal in `MindMap3D.tsx` (or `AddDataModal.tsx`), passing down the extracted JSON result to render the review UI.

---

## 2. R2: 3D Rendering Performance Optimization (Target 60 FPS)

### A. Code Inspection & Current Flow
The layout and rendering calculations occur in:
- **`src/components/MindMap3D.tsx`**: Sets up the animation loop with `requestAnimationFrame` and invokes `engine.tick()`.
- **`src/lib/OntologyCanvasEngine.ts`**:
  - `tick()` checks camera movement, drags, and physics activity. It triggers `runPhysicsTick()` and LERPs target positions.
  - `runPhysicsTick()` has a hardcoded `return false` statement at the very top, meaning **physics is disabled** and the system relies entirely on static concentric orbit mathematical layouts.
- **`src/lib/engine/OntologyLayout.ts`**:
  - `computePositions` calculates node positions recursively by traversing the directed spanning tree.
  - Non-orbiting layout: Recomputes target coordinates on every single frame by calling `Math.cos` and `Math.sin` for all nodes.
  - Perspective projection: Applies 3D perspective projection (`worldY` -> `rotatedY`, `depth`, `perspectiveScale`) on all visible nodes to map them to canvas space on every frame.
- **`src/lib/engine/OntologyRenderer.ts`**:
  - Batches edges and renders circles/lines.
  - Node drawing already implements frustum culling:
    ```typescript
    if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
    if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;
    ```
  - Edge drawing also implements frustum culling:
    ```typescript
    if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
    ...
    ```

### B. Performance Optimization Plan
To achieve a solid 60 FPS in dense networks, we will apply the following optimization techniques:
1. **Cache Node Trigonometric Values**:
   - If the canvas is not orbiting (stationary orbit angles), `node.orbitAngle` is constant.
   - We will precalculate and cache `cosAngle = Math.cos(node.orbitAngle)` and `sinAngle = Math.sin(node.orbitAngle)` on node initialization or when `orbitAngle` is explicitly modified.
   - Replace `Math.cos(node.orbitAngle)` with `node.cosAngle` in the layout loop, eliminating 200+ trigonometric calls per frame.
2. **Static Perspective Tilt Caching**:
   - Cache `cosTilt = Math.cos(OntologyLayout.tiltAngle)` and `sinTilt = Math.sin(OntologyLayout.tiltAngle)` as static class members in `OntologyLayout` to avoid computing them repeatedly.
3. **Bypass LERP in Orbit Mode**:
   - When `isOrbiting` is active and there are no active drags, nodes move in a smooth, continuous circle. LERP interpolation (`node.worldX = currentX + dx * LERP_SPEED`) lags behind the actual circle path and wastes CPU cycles.
   - In orbit mode, we can directly assign `node.worldX = node.targetWorldX` and `node.worldY = node.targetWorldY`, bypassing LERP calculations.
4. **Node-Level Dirty Flag Pattern**:
   - Introduce a `dirty: boolean` property on each node.
   - Only recompute a node's world coordinates and target coordinates if its configuration has changed or it is actively orbiting.
   - Only re-run the 3D perspective projection to screen coordinates (`renderX`, `renderY`, `renderZ`) if the camera moved, the zoom changed, or the node's individual dirty flag is set.
5. **Adjust Frustum Culling Margin Dynamically**:
   - Bind `CULL_MARGIN` to the current zoom level. When zoomed out, the margin can be reduced (since nodes are smaller), preventing unnecessary out-of-bounds draws.
6. **Collision Loop Tuning (If Physics Re-enabled)**:
   - If the `return false;` in `runPhysicsTick()` is ever removed to enable force-directed simulation:
     - Run collision checks ONLY on nodes inside the camera frustum.
     - Skip checking nodes with `layoutHidden: true` or those that are too far apart ($dist^2 > 102400$).

---

## 3. R3: Manual Node/Edge CRDT UI in MindMapInspector

### A. State Synchronization Analysis
- Yjs collaborative maps (`customNodesMap`, `customEdgesMap`, `overrides`, `deletedEdgesMap`) are synchronized in real-time.
- Any local modification inside a `ydoc.transact` block instantly updates IndexedDB and propagates via PartyKit WebSocket providers to other clients.
- React components bind to these updates using `useSyncExternalStore` in `src/hooks/useGraphCustomization.ts`, which batches updates with a 16ms (60 FPS) debounce buffer to keep UI rendering lightweight.

### B. MindMapInspector Manual UI Implementation Plan
We will expose manual creation and deletion controls directly in the `MindMapInspector` sidebar (`src/components/MindMapInspector.tsx`).

#### 1. Manual Node Creation UI (No Active Node Selected)
When `activeNode` is `null` (general board view):
- Render a **"신규 노드 수동 생성" (Manual Node Creation)** card in the side panel.
- **Form Controls**:
  - **이름 (Label)**: Text input.
  - **레이어 (Layer)**: Select dropdown mapping to `0: 인물`, `1: 예산`, `2: 업무`, `3: 위키`.
  - **그룹 (Group)**: Select dropdown mapping to `OntologyGroup` enums.
  - **중요도 (Base Value)**: Slider or input from 0 to 100.
  - **상위 노드 (Parent Node)**: Select dropdown listing all current nodes in the map (including a "없음 - 루트 지정" option).
- **Behavior**:
  - Add `addCustomNode` to the props of `MindMapInspector` (passed down from `MindMap3D.tsx` which calls `useGraphCustomization`).
  - When clicking the **노드 생성 (Create Node)** button:
    1. Call `addCustomNode(label, 0, 0, groupColor)` to add the node to `customNodesMap`. The hook automatically handles generating `custom-${Date.now()}`.
    2. If a parent node was selected, call `setNodeOverride(newNodeId, { customParent: parentId })` and `addCustomEdge(parentId, newNodeId, 'COMPONENTS')` to link it hierarchically.
    3. Call `initEngine()` to rebuild the graph and trigger a redraw.

#### 2. Manual Node Deletion UI (Active Node Selected)
When an `activeNode` is selected (except the root node `root-HCHPS`):
- Enhance the existing **"노드 삭제"** button.
- If it is a custom node, call `deleteCustomNode(activeNode.id)` to erase it from `customNodesMap` (and cascade deletes for related edges/overrides).
- If it is a system node, set `setNodeOverride(activeNode.id, { hidden: true })` to hide it.
- Automatically clear selection, focus on the parent node (if any), and call `initEngine()` to redraw.

#### 3. Manual Relationship (Edge) Creation UI (Active Node Selected)
When an `activeNode` is selected:
- Render a **"수동 관계 추가" (Add Manual Relationship)** panel under the "AI 관계 추론 및 자동 연결" card.
- **Form Controls**:
  - **연결 대상 노드 (Target Node)**: Select dropdown listing all visible nodes in the map (excluding the active node and the root).
  - **관계 유형 (Relationship Type)**: Select dropdown mapping to `EdgeType` (`DEPENDENCY`, `CAUSAL_DRIVE`, `ASSIGNEE`, etc.).
  - **가중치 (Weight)**: Slider from -1.0 to 1.0 (default: 1.0).
- **Behavior**:
  - Ensure `addCustomEdge` prop accepts both `type` and `weight`:
    `addCustomEdge(activeNode.id, targetId, selectedType, selectedWeight)`.
  - When clicking **관계 생성 (Create Edge)**, mutate Yjs `customEdgesMap` and call `initEngine()`.

#### 4. Edge Deletion UI (Active Node Selected)
- The existing "연결 끊기" section lists all connected nodes.
- When the user clicks the "Unlink" button, it deletes the edge from Yjs (`deleteCustomEdge`) and resets any parent-child relationship overrides. This behavior is already robust and handles Yjs CRDT synchronization perfectly.
