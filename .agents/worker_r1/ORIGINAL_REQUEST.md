## 2026-07-16T12:05:47+09:00
Role: Swap Implementation Worker (Milestone 1 - R1)
You are a teamwork_preview_worker.
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_r1.

Your task is to implement the AI Semantic Extraction & Review Modal (Milestone 1 - R1) based on the combined analysis of the Explorers.

### Objectives:
1. **Gemini prompt & Backend Filtering**:
   - Refine Gemini system prompt in `src/app/api/llm/extract/route.ts` to strictly extract core nouns and relationships. Eliminate meaningless particles, postpositions, and adjectives.
   - Implement `cleanKoreanLabel` and `postProcessGraph` functions. Limit nodes to 15 (sort by baseValue descending and slice) and prune dangling edges (edges where source or target is not in the 15 nodes list).
2. **Review & Approve Modal UI**:
   - Create `src/components/SemanticReviewModal.tsx`. It must allow the user to view the list of extracted nodes and edges, add new ones, delete unwanted ones, and edit labels/connections (groups, layers, types, weights) before merging.
   - Design it beautifully matching Tailwind CSS variables (backdrop-blur, glass-panel, Outfit fonts, theme colors for layers and groups).
   - Display data integrity warnings (dangling edges, self-references, or duplicate names/IDs).
3. **Delayed Merge Flow & Local Storage**:
   - Modify `src/hooks/useGraphCustomization.ts` to:
     - Buffering: Maintain `pendingNodes` and `pendingEdges` in state.
     - Filtering: When polling fetches `MAP_CUSTOMIZATION`, filter out nodes and edges that have already been reviewed (either merged to Yjs or skipped/rejected by the user).
     - Persistence: Keep track of reviewed nodes/edges in `localStorage` (`hchps-reviewed-ai-nodes`, `hchps-reviewed-ai-edges`).
     - Callback: Implement `approveAndMerge(nodes, edges, skippedIds)` to merge checked items into the Yjs store using `ydoc.transact(() => { ... })` and add their IDs to the localStorage reviewed lists.
4. **Trigger Buttons & HUD Banner Integration**:
   - Add a header button "AI 시맨틱 추출" in `src/components/WikiEditor.tsx` next to the close button, calling the extraction API.
   - Add extraction buttons in `src/components/MindMapInspector.tsx` (for normal nodes and radar file details).
   - Add a banner/notification badge in the HUD (e.g. in `src/components/MindMap3D.tsx` or `MindMapHUD.tsx`) showing "AI가 파일 변경사항에서 n개의 새 노드/관계를 감지했습니다. [검토하기]" when pending items exist. Clicking this banner should open the `SemanticReviewModal`.

### Verification Requirements:
- Execute `npx tsc --noEmit` and `npm run lint` to ensure compilation and lint compliance.
- Run any relevant unit tests.
- Document command execution and results in your handoff report.
