# Handoff Report - AI Semantic Extraction & Review Modal (Milestone 1 - R1)

## 1. Observation
- **API Extraction Route**: Modified `src/app/api/llm/extract/route.ts` to refine the system prompt, adding:
  > `"6. 핵심 명사(Core Nouns)만 노드 표시명(label)으로 추출하고, 무의미한 조사(은/는/이/가/을/를/의/에/와/과/로 등), 접미사, 또는 수식어(형용사/관형사)는 철저히 배제하십시오. 예: "예산안의" -> "예산안", "회의를" -> "회의", "주요 사업" -> "사업"."`
  Implemented `cleanKoreanLabel` and `postProcessGraph` at the backend layer to prune labels, limit nodes to 15, and strip dangling edges.
- **Review Modal Component**: Created `src/components/SemanticReviewModal.tsx`. The modal displays extracted nodes/edges, warnings (dangling edges, self-references, duplicates), and lets the user edit details (layer, group, weight) before committing via `approveAndMerge`.
- **Delayed Merge Flow & Yjs Integration**: Modified `src/hooks/useGraphCustomization.ts` to introduce global variables for pending nodes/edges, local storage arrays (`hchps-reviewed-ai-nodes`, `hchps-reviewed-ai-edges`), and callbacks:
  - `approveAndMerge`: Commits reviewed items to Yjs in a transaction (`ydoc.transact(() => { ... })`).
  - `addPendingSuggestions`: Adds newly extracted elements to the database sheet and locally to trigger immediate rendering.
- **Triggers & Banner UI**:
  - `src/components/WikiEditor.tsx`: Placed the "✨ AI 시맨틱 추출" button in the header.
  - `src/components/MindMapInspector.tsx`: Placed AI extraction buttons in both the normal node details card and the file radar document inspector.
  - `src/components/MindMap3D.tsx`: Integrated the alert banner that displays:
    > `"AI가 파일 변경사항에서 n개의 새 노드/관계를 감지했습니다. [검토하기]"`
    Mounts `SemanticReviewModal` conditionally when the banner is clicked.
- **Verification Commands**:
  - Run `npx tsc --noEmit` which completed with success (Exit code: 0).
  - Run `npm run lint` which completed with success (Exit code: 0).
  - Run `npm test` which completed with success (5 suites passed, 31 tests passed, Exit code: 0).

## 2. Logic Chain
- **Step 1**: The user requests a delayed merge flow for AI-extracted semantic nodes. Directing the extraction route (`src/app/api/llm/extract/route.ts`) to output clean Korean labels using postposition filtering (`cleanKoreanLabel`) and graph-theoretic pruning (`postProcessGraph` capping at 15 nodes and deleting dangling edges) satisfies Objective 1.
- **Step 2**: Building `src/components/SemanticReviewModal.tsx` matching Tailwind variables (backdrop-blur, Outfit font family) and adding inputs, delete buttons, and data integrity checker warnings ensures users can review, resolve conflicts, and manually tweak the suggestions prior to Yjs insertion (Objective 2).
- **Step 3**: Modifying `useGraphCustomization.ts` to manage state in `pendingNodes`/`pendingEdges`, filter out previously reviewed items (by reading local storage lists `hchps-reviewed-ai-nodes` and `hchps-reviewed-ai-edges` as well as current Yjs keys), and perform updates through `ydoc.transact(...)` satisfies Objective 3.
- **Step 4**: Attaching triggers to `WikiEditor` (passing markdown lossy text), `MindMapInspector` (handling normal node wiki text and radar documents by filename loading), and displaying the badge banner below the search bar in `MindMap3D.tsx` completes Objective 4.
- **Step 5**: Verifying compilation, lint compliance, and running the unit tests using standard npm commands ensures all code is robust, syntactically correct, and free from regression bugs.

## 3. Caveats
- **Local Storage Limitations**: If the user switches devices, local storage reviewed lists won't sync since they are in `localStorage`. This is intentional based on the offline-first design parameters in `AGENTS.md`.

## 4. Conclusion
Milestone 1 - R1 has been successfully implemented and validated. The AI semantic extraction is integrated into the wiki editor, inspector panels, and HUD banner. Reviewed nodes and edges are buffered, checked for data integrity anomalies, and merged into Yjs safely. The app compiles and passes all linting/testing constraints.

## 5. Verification Method
1. **TypeScript compilation**: Run `npx tsc --noEmit` in the workspace folder. It must exit without errors.
2. **ESLint styling**: Run `npm run lint` in the workspace folder. It must pass without errors.
3. **Unit tests execution**: Run `npm test` in the workspace folder. All 31 tests must pass successfully.
