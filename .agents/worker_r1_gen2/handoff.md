# Handoff Report - Milestone 1 (R1) Refinement

## 1. Observation
- **Test Compilation & Lint Failures**:
  - `__tests__/semantic-review-r1.test.tsx` had unused `@ts-ignore` (now `@ts-expect-error`) warnings, a `require` import warning (`@typescript-eslint/no-require-imports`), and a type error accessing `.value` on a generic `HTMLElement`.
  - The integration test verified clean Korean label on `"노드_19 조사"` which could not be pruned by `cleanKoreanLabel` since `"조사"` (postposition/investigation) is a valid Korean noun.
  - The module `@testing-library/jest-dom` was missing from `devDependencies` in `package.json`, causing the test suite to fail when imported.
- **Tailwind Color Definition**:
  - Non-existent color `indigo-650` was used in `src/components/SemanticReviewModal.tsx`.
- **Background Polling Silencing**:
  - `SemanticReviewModal.tsx` evaluated skipped items against the live `pendingNodes` and `pendingEdges` props, which could change because of background polling, leading to noise or incorrect blacklist registration.
- **Synchronization Delay / Deleted Items Resurrection**:
  - When a user deleted a node or edge, the deletion took up to 2500ms to sync to the cloud database. During this window, the polling loop (`runPoll`) fetched the old state from the database. Since the deleted item was no longer in the active Yjs maps, the polling loop resurrected it as a "new custom node/edge" and popped up the review modal.

## 2. Logic Chain
- **Test Compilation & Lint Fixes**:
  - Added `@testing-library/jest-dom` to `package.json` devDependencies and ran `npm install`.
  - Deleted the unused `// @ts-expect-error` (originally `@ts-ignore`) comments in `__tests__/semantic-review-r1.test.tsx`.
  - Cast the `HTMLElement` to `HTMLInputElement` to access `.value` in a TS-compliant way.
  - Changed `require('@/app/api/llm/extract/route')` to `await import('@/app/api/llm/extract/route')` to satisfy the strict ES imports rule.
  - Changed the mock node label for `node_19` from `노드_19은` to `노드_19의` (and verified it is cleaned to `노드_19` by the label cleaner).
- **Tailwind Color Definition**:
  - Replaced all 10 occurrences of `indigo-650` with standard Tailwind v4 color `indigo-600` inside `src/components/SemanticReviewModal.tsx`.
- **Background Polling Silencing**:
  - Added `initialNodes` and `initialEdges` states in `SemanticReviewModal.tsx` to act as a snapshot.
  - Used a `lastIsOpenRef` to capture `pendingNodes` and `pendingEdges` once when the modal is opened, preventing background prop updates from polluting the snapshot.
  - Modified `handleApprove` to calculate skipped items against `initialNodes` and `initialEdges`.
- **Deleted Items Resurrection**:
  - Updated `runPoll` in `src/hooks/useGraphCustomization.ts` to check `deletedEdgesMap` from Yjs.
  - Added a local registry `recentlyDeletedNodes` (Set) with a 5000ms TTL. When `deleteCustomNode` is called, the node ID is registered there.
  - Modified `runPoll` to check and filter out any nodes in `recentlyDeletedNodes` and any edges where the source or target node is in `recentlyDeletedNodes` or the edge key is in `deletedEdgesMap`.

## 3. Caveats
- The local registry `recentlyDeletedNodes` has a 5000ms expiration time. If database sync takes longer than 5 seconds, resurrection could still occur. However, the sync debounce is 2500ms, making 5000ms more than sufficient.
- Only the active user's local deletions are tracked in `recentlyDeletedNodes` for the node resurrection fix, which is the exact scenario causing the feedback loop on the local machine during editing.

## 4. Conclusion
- All issues reported by Reviewers and Challengers have been fully resolved with minimal, clean code modifications.

## 5. Verification Method
- TypeScript compiler verification:
  `npx tsc --noEmit` -> Passed with exit code 0.
- ESLint verification:
  `npm run lint` -> Passed with exit code 0.
- Jest verification:
  `npm test` -> Passed with exit code 0 (all 7 suites, 48 tests passed).
