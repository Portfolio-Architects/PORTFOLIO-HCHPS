# Handoff Report: VITAL MindMap 3D & AI Engine Enhancement Analysis

## 1. Observation

Direct observations from codebase inspection:
- **AI Extraction API & Extraction Flow**:
  - `src/app/api/llm/extract/route.ts` maps semantic structures via `responseSchema` (line 6) using `GoogleGenerativeAI` (line 62). System prompt is defined at line 64:
    ```typescript
    const systemPrompt = `당신은 비정형 문서 텍스트로부터 핵심 개체(Node)와 이들의 관계(Edge)를 추출하여 시맨틱 온톨로지 지식 그래프를 구성하는 데이터 추출기입니다...`;
    ```
  - `src/lib/engine/ontology-extractor.ts` performs merging at line 37:
    ```typescript
    export function mergeExtractedGraph(ydoc: Y.Doc, extracted: ExtractedGraph) {
      if (!extracted || !extracted.nodes) return;
      ydoc.transact(() => {
        const customNodesMap = ydoc.getMap('customNodesMap') as Y.Map<OntologyNode>;
        const customEdgesMap = ydoc.getMap('customEdgesMap') as Y.Map<OntologyEdge>;
        const deletedEdgesMap = ydoc.getMap('deletedEdgesMap') as Y.Map<boolean>;
        ...
    ```
- **3D Layout & Physics rendering**:
  - `src/lib/OntologyCanvasEngine.ts` has physics disabled at line 480:
    ```typescript
    private runPhysicsTick(): boolean {
      return false; // 2D 평면 상대적 방사형 배치에서는 겹침이 기하학적으로 방지되어 척력이 필요 없음 (물리 비활성화)
    ```
  - `src/lib/engine/OntologyLayout.ts` calculates target coordinates inside `computePositions` (line 534):
    ```typescript
    } else {
      // 비공전 중이거나 초기화 상태일 때는 삼각함수로 위치 확정
      const rOffset = node.radialOffset ?? 0;
      const R = OntologyLayout.getOrbitRadius(node.orbitIndex) + rOffset;
      node.targetWorldX = R * Math.cos(node.orbitAngle) * ELLIPSE_RATIO;
      node.targetWorldY = R * Math.sin(node.orbitAngle);
    }
    ```
    This calls `Math.cos` and `Math.sin` on every frame for every node.
  - `src/lib/engine/OntologyRenderer.ts` applies frustum culling at lines 1086-1087 for nodes:
    ```typescript
    if (node.renderX < -CULL_MARGIN || node.renderX > canvasW + CULL_MARGIN) continue;
    if (node.renderY < -CULL_MARGIN || node.renderY > canvasH + CULL_MARGIN) continue;
    ```
    and at lines 464-467 for edges:
    ```typescript
    if (src.renderX < -CULL_MARGIN && tgt.renderX < -CULL_MARGIN) continue;
    if (src.renderX > canvasW + CULL_MARGIN && tgt.renderX > canvasW + CULL_MARGIN) continue;
    if (src.renderY < -CULL_MARGIN && tgt.renderY < -CULL_MARGIN) continue;
    if (src.renderY > canvasH + CULL_MARGIN && tgt.renderY > canvasH + CULL_MARGIN) continue;
    ```
- **Inspector Manual UI Controls**:
  - `src/components/MindMapInspector.tsx` handles node delete operations at line 1210:
    ```typescript
    if (targetNode.id.startsWith('custom-')) {
      deleteCustomNode(targetNode.id);
    }
    ```
  - The side panel currently has "AI 관계 추론 및 자동 연결" (line 861) which invokes `props.addCustomEdge(...)` (line 900). It lists connected edges for unlinking (line 1094) and unlinks via `deleteCustomEdge` (line 1109), but it has no UI form for manual node creation or manual edge addition.
- **Yjs State Synchronization Hook**:
  - `src/hooks/useGraphCustomization.ts` manages CRDT state. It defines `addCustomNode` (line 215), `deleteCustomNode` (line 232), `addCustomEdge` (line 271), and `deleteCustomEdge` (line 289) which write directly to Yjs maps inside transactions (`ydoc.transact`).

## 2. Logic Chain

1. **AI Semantic Engine Enhancement**: Standardizing lowercase English IDs (Observation 1) will resolve potential duplicate node collisions in Yjs map keys. By introducing a new `SemanticReviewModal` before calling `mergeExtractedGraph` (Observation 1), users can filter out unwanted AI extractions and edit node/edge attributes before writing them to the database or CRDT, providing a clean gate-keeping step.
2. **3D Performance Optimization (60 FPS)**:
   - When the graph is stationary (not orbiting), `node.orbitAngle` is constant, meaning `Math.cos`/`Math.sin` (Observation 2) are calculated redundant times. Caching these values on the node object will save 200+ trigonometric calculations per frame.
   - Bypassing LERP morphing when orbiting is active (Observation 2) will avoid LERP math overhead for all active nodes.
   - Frustum culling is already applied in `OntologyRenderer` (Observation 2), but caching the 3D perspective projection coordinates (`renderX`, `renderY`, `renderZ`) using a dirty flag pattern (re-projecting only when the camera or individual node moves) will save projection math overhead.
3. **Manual Node/Edge CRDT UI**:
   - The `useGraphCustomization` hook (Observation 4) already manages Yjs transaction calls for adding and deleting custom nodes and edges.
   - By creating simple React form components (input text, selectors for Group/Layer, target node dropdown) in `MindMapInspector.tsx` (Observation 3) and routing them to the hook's functions, we can enable instant, collaborative manual graph editing.

## 3. Caveats

- **External Network Restrictions**: Because we are in CODE_ONLY mode, we did not run external checks or invoke external API endpoints.
- **Physics Engine State**: We assume the production physics solver remains disabled (`runPhysicsTick()` returns `false` at line 480 in `src/lib/OntologyCanvasEngine.ts`). If it is re-enabled, the spatial hash grid repulsion logic (lines 515-635) will need separate profiling and optimizations.

## 4. Conclusion

The codebase contains all necessary hooks and rendering logic for collaborative Yjs editing and optimized 2D/3D projection rendering. The three requirements can be implemented cleanly by:
1. Enhancing the prompt schema rules in `src/app/api/llm/extract/route.ts` and implementing a new `SemanticReviewModal.tsx` for manual filtering.
2. Caching static trigonometric variables (`cosAngle`, `sinAngle`, `cosTilt`, `sinTilt`), bypassing LERP during active orbiting, and applying a node-level camera/position dirty flag.
3. Passing `addCustomNode` and the full edge modification functions as props to `MindMapInspector.tsx` and adding simple UI cards to allow manual node/edge creation and deletion.

## 5. Verification Method

- **Build/Lint Verification**: Propose running `npm run build` or `npx next build` to verify there are no TypeScript compile or import errors.
- **Unit/Integration Tests**: Run the project tests via `npm test` or `jest` to ensure graph manipulation is stable.
- **Manual Verification**: Run `npm run dev` and navigate to the 3D MindMap module. Inspect if Yjs WebSocket synchronization logs show up in the developer console. Verify if nodes and edges are culled when zoomed in and panned out of view.
