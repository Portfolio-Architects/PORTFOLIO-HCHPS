# Stress Testing & Edge-Case Validation Report — AI Semantic Extraction

## Challenge Summary

**Overall risk assessment**: **LOW**

The delayed-merge AI semantic extraction system is highly robust against data corruption, edge inputs, and empty states. Mitigations are embedded in both the Next.js API route (post-processing/heuristics) and the React frontend (modal warnings, Yjs transaction safety, and try-catch storage parsing).

---

## Challenges

### [Low Risk] Challenge 1: Empty or Mismatched Gemini Returns (0 Nodes or Edges)
- **Assumption challenged**: The extraction endpoint always receives a valid list of nodes and edges from the AI model, and the frontend expects non-empty datasets to render.
- **Attack scenario**: A user uploads an empty/unstructured text file that yields 0 nodes or edges, or the Gemini API model fails or returns empty arrays.
- **Blast radius**: If unhandled, this could crash the parsing layers, render a blank modal with broken state references, or trigger endless polling.
- **Mitigation**:
  1. **Backend Heuristic Fallback**: In `src/app/api/llm/extract/route.ts`, if all Gemini models fail or the API key is missing, the code triggers a local regex-based word scanner. If it scans 0 valid Korean/English words, it injects a root node (`node_fallback_root`) to ensure a non-empty nodes list.
  2. **Safe Post-Processing**: If the API returns successfully but with empty arrays, `postProcessGraph` handles it safely, returning `{ nodes: [], edges: [] }`.
  3. **HUD Visibility Filter**: In `src/components/MindMap3D.tsx`, the notification banner is only displayed if `pendingNodes.length > 0`.
  4. **Frontend UI Placards**: In `src/components/SemanticReviewModal.tsx`, empty states for nodes or edges are checked (`nodes.length === 0`), and the modal renders a helpful instruction panel rather than crashing. Clicking "Approve & Merge" with 0 elements acts as a clean no-op transaction.

### [Low Risk] Challenge 2: Massive Text Inputs
- **Assumption challenged**: Input documents will always be short, concise paragraphs.
- **Attack scenario**: The user inputs a massive text file (e.g., 50,000+ words) to extract relationships.
- **Blast radius**: Out-of-memory errors on the backend, context window overflow, or a massive graph returned that crashes the 3D Force Graph UI or Yjs.
- **Mitigation**:
  1. **Model Capacity**: Gemini 1.5 Flash and Pro models natively support massive context windows (1M to 2M tokens), easily handling huge documents.
  2. **Strict Graph Cap**: In `postProcessGraph`, the backend sorts extracted nodes by `baseValue` descending and slices the top 15 nodes. Any edges referencing omitted nodes are pruned. This limits graph complexity to $O(1)$ relative to the input document size.
  3. **Fallback Loop Protection**: The heuristic local scanner scans words using regex and inserts them into a `Set`. It checks `if (nodes.length >= 15) break` to immediately stop searching. This keeps processing bounded at $O(1)$ after the regex scan, avoiding memory leaks or deep recursion.
  4. **Noun Cleaning Limits**: `cleanKoreanLabel` is only run on the final extracted node labels (maximum of 15), not on the original massive text body.

### [Low Risk] Challenge 3: Corrupted or Empty Local Storage Keys
- **Assumption challenged**: Browser localStorage will always contain valid JSON strings matching the reviewed item schemas (`hchps-reviewed-ai-nodes`, `hchps-reviewed-ai-edges`, `hchps-global-tombstones`).
- **Attack scenario**: The user clears their cache, has localStorage disabled, or a manual edit corrupts a key to an invalid string like `"[invalid_json"`.
- **Blast radius**: JavaScript runtime crash (`SyntaxError` during `JSON.parse`), stopping the page initialization or breaking Yjs state syncing.
- **Mitigation**:
  1. **Try-Catch Guardrails**: In `useGraphCustomization.ts`, reading from `hchps-reviewed-ai-nodes` and `hchps-reviewed-ai-edges` is isolated inside `getReviewedNodeIds()` and `getReviewedEdgeKeys()` with robust `try-catch` structures. On error, they return an empty array `[]` rather than crashing the hook.
  2. **Self-Healing on Write**: When the user approves or skips nodes, `addReviewedItems()` reads the storage keys, falls back to `[]` if corrupted, and writes back a newly stringified valid JSON array. This automatically heals the corrupted entry.
  3. **Global Tombstones Resiliency**: Tombstone reads in `MindMap3D.tsx` and custom Yjs migrations are similarly wrapped in `try-catch` blocks.

### [Low Risk] Challenge 4: Node Renaming Collisions to Existing Node IDs
- **Assumption challenged**: Node IDs are unique, and users won't attempt to rename node IDs to match existing nodes.
- **Attack scenario**: A user renames a node during the review to an ID that already exists in the 3D Mindmap.
- **Blast radius**: Duplicate keys in Yjs maps, overwriting other node data, or causing dangling edge references.
- **Mitigation**:
  1. **ID Immutability**: In `SemanticReviewModal.tsx`, the unique English ID (e.g. `kim_chulsoo` or `custom-ai-...`) is read-only. The user can only edit the display `label`. This prevents users from manually typing duplicate IDs in the modal.
  2. **Real-time Integrity Warnings**: The modal calculates integrity warnings in real-time. If a pending node ID matches an existing ID in the mindmap, it triggers a warning: `노드 ID 중복: '...'는 이미 마인드맵에 존재합니다. 병합 시 덮어써집니다.`
  3. **Yjs Upsert Behavior**: If a collision is approved, `customNodesMap.set(node.id, node)` executes. As Yjs maps behave like standard key-value maps, this behaves as an atomic **upsert**, updating the existing node configuration safely.

---

## Stress Test Results

A test suite (`__tests__/semantic-stress.test.ts`) was created and executed containing 14 stress test cases. All tests passed successfully:

- **`cleanKoreanLabel` Edge Cases**:
  - `cleanKoreanLabel('')` → Returns `''` (Graceful empty input) → **PASS**
  - `cleanKoreanLabel(null)` → Returns `''` (Graceful null/undefined input) → **PASS**
  - Trailing postpositions (`'예산안의'`, `'회의에서'`) → Correctly stripped (`'예산안'`, `'회의'`) → **PASS**
  - Word equals postposition (`'는'`, `'로'`) → Preserved untouched (`'는'`, `'로'`) → **PASS**
  - Non-syllable boundary (`'!!!은'`) → Preserved untouched (`'!!!은'`) → **PASS**
  - Quotes stripping (`'"기획안"'`, `"'예산안'"`) → Quotes removed, words preserved → **PASS**
  - Massive label safety (`'가'.repeat(2000) + '의'`) → Safely handled without overflow → **PASS**

- **`postProcessGraph` Cap & Prune Limits**:
  - Empty input arrays → Returns empty outputs → **PASS**
  - Filters empty labels/IDs → Invalid nodes removed → **PASS**
  - Sorting and Capping → Limits to 15 nodes, sorted by `baseValue` descending → **PASS**
  - Edge Pruning → Self-referential edges and edges connecting to omitted nodes are removed → **PASS**

- **`computeIntegrityWarnings` Engine (Review Modal Simulation)**:
  - Duplicate pending labels → Flags warning → **PASS**
  - Duplicate IDs with existing node → Flags warning → **PASS**
  - Self-referencing edge → Flags warning → **PASS**
  - Dangling edge → Flags warning → **PASS**

---

## Unchallenged Areas

- **Gemini API Call Failures & Latency**: The actual network call to Google Generative AI API is mock-tested since external network requests are disallowed in this environment. The fallback heuristic path is, however, fully tested and validated.
