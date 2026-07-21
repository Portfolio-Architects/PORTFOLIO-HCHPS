# Milestone 1 (R1) Forensic Audit & Adversarial Review Report

## Forensic Audit Report

**Work Product**: Milestone 1 (R1: AI Semantic Extraction & Review Modal)
**Profile**: General Project (Development Mode)
**Verdict**: CLEAN

### Phase Results
- **Hardcoded test results detection**: PASS — Inspected `src/app/api/llm/extract/route.ts` and the modal components. No hardcoded test outputs or cheat values exist.
- **Facade detection**: PASS — Confirmed that `route.ts` contains real Gemini API integration with a regex/keyword-matching local heuristic fallback. `SemanticReviewModal.tsx` contains interactive node/edge editing, creation, validation, and warning logic. `useGraphCustomization.ts` has full Yjs CRDT real-time coordination, dynamic sheets syncing, and debounced watchers. `WikiEditor.tsx` incorporates BlockNote views, Llama auto-streaming, and extractor triggers. `MindMapInspector.tsx` implements full radar views, contact recording to local files, and automated relationship linkages.
- **Pre-populated artifact detection**: PASS — No pre-populated logs or dummy test output files exist in the repository to bypass tests.
- **Build and run**: PASS — The Jest environment successfully builds and executes the test files.
- **Output verification**: PASS — Verified that mock behaviors in `__tests__/semantic-review-r1.test.tsx` and `__tests__/semantic-stress.test.ts` are standard unit mocks and that no validation checks were bypassed. All 17 tests across both test suites pass.
- **Dependency audit**: PASS — Third-party libraries (Gemini API, Yjs, BlockNote, Next.js) are used to implement core real-time collaborative whiteboarding features, while custom heuristic and validation logic is built from scratch.

### Evidence
```
> portfolio-vital@0.1.0 test
> jest __tests__/semantic-review-r1.test.tsx __tests__/semantic-stress.test.ts

PASS __tests__/semantic-stress.test.ts
PASS __tests__/semantic-review-r1.test.tsx
  ● Console

    console.log
      [Extract API] Attempting extraction with model: gemini-3.5-flash

      at log (src/app/api/llm/extract/route.ts:165:17)


Test Suites: 2 passed, 2 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        16.284 s
Ran all test suites matching __tests__/semantic-review-r1.test.tsx|__tests__/semantic-stress.test.ts.
```

---

## Challenge Summary

**Overall risk assessment**: LOW

## Challenges

### [Low] Challenge 1: Heuristic Fallback Extraction Quality under Non-Standard Inputs
- **Assumption challenged**: The local heuristic fallback in the extract API assumes that document texts will contain some Korean characters or common keywords (like '담당', '예산', '회의').
- **Attack scenario**: If the input text is entirely in a foreign language with no matching keyword tokens (e.g. classical Latin or ancient Greek) or contains only numeric data, the regex matcher will produce nodes categorized under layerId 2 (Task) and group `OTHER`. If no words matching the regex `/[가-힣a-zA-Z0-9_]{2,12}/g` are found, it falls back to a single node named `로컬 스캔 개체`.
- **Blast radius**: The user will see a simplified or single-node graph, but the backend will not crash or throw exceptions.
- **Mitigation**: The system already handles this gracefully by using a single fallback root node rather than throwing errors.

### [Low] Challenge 2: Client-side Yjs Conflict under Sudden Disconnection
- **Assumption challenged**: The whiteboarding state assumes the sheets DB and Yjs are kept in sync via local debounce and auto-saving.
- **Attack scenario**: If a user modifies the whiteboard heavily and immediately closes the window before the 2500ms upload debounce triggers, local edits remain in JSDOM / localStorage but might not sync to the cloud sheets.
- **Blast radius**: Local modifications will be preserved on the user's browser, but other collaborative sessions will not see the sync until the user opens the page again.
- **Mitigation**: Standard behavior for web applications. The next time the user loads the app, the Yjs migration effect will synchronize any remaining local items back to the cloud/backend sheets.

## Stress Test Results
- **Korean Postposition Stripping**:
  - `cleanKoreanLabel("예산안의")` ➔ `"예산안"` ➔ **PASS**
  - `cleanKoreanLabel("회의에서")` ➔ `"회의"` ➔ **PASS**
  - `cleanKoreanLabel("는")` ➔ `"는"` (preserved due to short length) ➔ **PASS**
  - `cleanKoreanLabel("!!!은")` ➔ `"!!!은"` (preserved since preceding char is not alphanumeric/syllable) ➔ **PASS**
- **Size Capping**:
  - Feeding 30 nodes into postProcessGraph ➔ limits to 15 nodes based on sorted baseValue ➔ **PASS**
- **Self & Dangling Edge Pruning**:
  - An edge source referencing itself or a pruned node ➔ filtered out ➔ **PASS**
- **Modal Integrity Checks**:
  - Passing duplicate labels/IDs or self-referential edges into the modal ➔ displays warnings ➔ **PASS**

## Unchallenged Areas
- **3D Render Performance (WebGL/Three.js)** — Out of scope. The audit focuses on the semantic extraction API, modal components, and the synchronization hooks, not the 3D canvas physics loops.
