## 2026-07-16T03:20:18Z

Role: Swap Refinement Worker (Milestone 1 - R1)
You are a teamwork_preview_worker.
Your working directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_r1_gen2.

Your task is to fix the issues discovered by the Reviewers and Challengers for Milestone 1 (R1).

### Action Items:

1. **Test Compilation & Lint Fixes**:
   - In `__tests__/semantic-review-r1.test.tsx`:
     - Add `import '@testing-library/jest-dom';` at the top of the file to fix TS errors for `toBeInTheDocument`/`toHaveValue`.
     - Replace all `// @ts-ignore` comments with `// @ts-expect-error`.
     - Fix the test assertion on line 122: change `"노드_19 조사"` to a real Korean particle like `"노드_19의"` or `"노드_19를"` to prevent test failure (as `"조사"` is a valid noun and is not stripped by the label cleaner).
   - In `__tests__/semantic-stress.test.ts`:
     - Remove the unused import of `POST` on line 1 to resolve ESLint unused import warning and prevent test cache pollution (which was breaking the other route tests).

2. **Tailwind Color Definition**:
   - Inspect `src/components/SemanticReviewModal.tsx` and verify color classes. Replace occurrences of non-existent Tailwind v4 color `indigo-650` with standard Tailwind colors (`indigo-600` or `indigo-700`).

3. **Background Polling Silencing Race Condition Fix**:
   - In `src/components/SemanticReviewModal.tsx`, when the modal is opened, capture a snapshot of the initial `extractedGraph` (or `pendingNodes` and `pendingEdges`) in local states.
   - When calculating skipped/rejected items in `handleApprove`, calculate them ONLY against that initial snapshot. If new items arrive from polling (props change) while the modal is open, do not mark them as skipped or add them to the blacklist, since the user hasn't seen or reviewed them.

4. **Synchronization Delay Race Condition (Deleted Items Resurrection) Fix**:
   - In `src/hooks/useGraphCustomization.ts`, during the polling loop (`runPoll`), filter out elements that are marked in `deletedEdgesMap` (for edges) or have been recently deleted by the user. If the user deletes a node, add a tombstone check or local registry check in `runPoll` so that it doesn't immediately treat it as a "new custom node" and pop up the review modal during the 2500ms sync debounce window.

### Verification:
- Run `npx tsc --noEmit`, `npm run lint`, and `npm test` to ensure all checks pass completely.
- Document command execution and results in your handoff report.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

When done, write d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\worker_r1_gen2\handoff.md detailing what you implemented, files modified, verification command outputs, and send a message back to the sub-orchestrator (conversation ID: f8db7c39-06b7-4c12-8e53-c28a2bbad3dc).
