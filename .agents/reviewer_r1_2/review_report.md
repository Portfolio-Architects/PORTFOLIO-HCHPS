# UX & Yjs CRDT Consistency Review Report - Milestone 1 (R1)

## Review Summary

**Verdict**: REQUEST_CHANGES

The implementation provides a solid foundation for the AI Review Modal and hooks integration, successfully utilizing Yjs transactions and providing a fully responsive, dark-mode-friendly UI. However, changes are requested due to:
1. **ESLint Errors**: Lint checks (`npm run lint`) fail with 3 errors and 1 warning.
2. **Jest Test Failures**: Running the full test suite (`npm test`) fails due to cross-test module pollution.
3. **Critical/Major Functional Gaps**: A race condition silently blacklists incoming AI nodes/edges during active reviews, and a Yjs sync-delay race condition mistakenly re-displays deleted nodes/edges.

---

## Findings

### [Critical] Finding 1: Background Polling Silencing Race Condition
- **What**: Newly polled AI nodes/edges are permanently skipped and blacklisted in `localStorage` without user awareness if they arrive while the modal is open.
- **Where**: `src/components/SemanticReviewModal.tsx` (Lines 171-181)
- **Why**: 
  1. The modal copies `pendingNodes` and `pendingEdges` to local `nodes` and `edges` state once at initialization (`useState` lazy initializer).
  2. If background polling fetches new elements (e.g. `NodeB`) while the modal is open, the parent passes the new list to the modal's props, but the local state `nodes` does not update.
  3. Upon approval, `newlySkippedNodes` is calculated by filtering `pendingNodes` (props, which now contain `NodeB`) against `finalApprovedNodeIds` (local state, which only contains `NodeA`).
  4. `NodeB` is marked as skipped and written to `hchps-reviewed-ai-nodes` in `localStorage`, forever blacklisting it from being reviewed.
- **Suggestion**: In `handleApprove`, calculate skipped items only against the initial snapshot of pending nodes/edges captured when the modal was opened, or merge new incoming pending nodes dynamically into the local state with a visual notification.

### [Major] Finding 2: Unused Import and Jest Test Suite Failure
- **What**: Running the full test suite (`npm test`) fails, and `npm run lint` reports violations.
- **Where**: `__tests__/semantic-stress.test.ts` (Line 1) and `__tests__/semantic-review-r1.test.tsx` (Lines 6, 10, 14)
- **Why**:
  1. `__tests__/semantic-stress.test.ts` imports `POST` but never uses it. This causes a lint warning and, more critically, loads `@/app/api/llm/extract/route` into the Jest module cache *before* `process.env.GOOGLE_GEMINI_API_KEY` is mocked in `semantic-review-r1.test.tsx`. The API key is initialized to `""`, causing subsequent route test calls in the same worker thread to fail with an API key missing error.
  2. `__tests__/semantic-review-r1.test.tsx` uses `// @ts-ignore` instead of `// @ts-expect-error`, which violates the `@typescript-eslint/ban-ts-comment` ESLint rule.
- **Suggestion**: Remove the unused import of `POST` from `__tests__/semantic-stress.test.ts` and change `// @ts-ignore` to `// @ts-expect-error` in `__tests__/semantic-review-r1.test.tsx`.

### [Major] Finding 3: Synchronization Delay Race Condition (Deleted Items Re-appear)
- **What**: User-deleted custom nodes/edges re-appear in the Review Modal if a poll occurs within the 2.5-second debounce save window.
- **Where**: `src/hooks/useGraphCustomization.ts` (Lines 646-654 & 666-701)
- **Why**: 
  1. When a user deletes a custom node/edge, it is deleted from the Yjs map immediately, but cloud synchronization (`syncToCloud`) is debounced by 2500ms.
  2. If the 10-second background poll (`runPoll`) fires before `syncToCloud` writes the update, the database still contains the deleted element.
  3. `runPoll` checks `!customNodesMap.has(n.id)` and `!reviewedNodeIds.has(n.id)`. Since it was deleted from Yjs and is not an AI node (not in reviewed list), it is treated as a "new pending node" and immediately added to `pendingNodes`, popping up the review modal.
- **Suggestion**: Ensure `runPoll` ignores elements that are marked in `deletedEdgesMap` (for edges) and implement a similar tombstone system or local cache for deleted custom nodes, or cancel/force-flush the sync when deletions occur.

### [Minor] Finding 4: Non-standard Tailwind Color `indigo-650`
- **What**: Styling issues/silently ignored rules due to the use of non-existent Tailwind class names.
- **Where**: `src/components/SemanticReviewModal.tsx` (Lines 233, 243, 332, 400, 471, 550, 572, 583) and other files.
- **Why**: The codebase uses classes like `text-indigo-650` and `border-indigo-650`, but no custom color `indigo-650` (or `--color-indigo-650`) is defined under the `@theme` directive in `src/app/globals.css`. These classes do not resolve to any CSS rules in Tailwind CSS v4.
- **Suggestion**: Define `--color-indigo-650` in the `@theme` block of `globals.css` or use standard Tailwind colors like `indigo-600` or `indigo-700`.

### [Minor] Finding 5: Local Storage Accumulation Bloat
- **What**: Persistent memory accumulation in `localStorage`.
- **Where**: `src/hooks/useGraphCustomization.ts` (Lines 27-60)
- **Why**: `hchps-reviewed-ai-nodes` and `hchps-reviewed-ai-edges` arrays grow indefinitely as new nodes/edges are reviewed, with no eviction, TTL, or compaction mechanism, potentially hitting the 5MB browser quota.
- **Suggestion**: Implement a compaction mechanism to prune IDs that are no longer in the DB's pending list or apply a sliding window/TTL.

---

## Verified Claims

- **Yjs Transaction Safety** → Verified via `view_file` → **PASS**: All updates in `useGraphCustomization.ts` are correctly wrapped in `ydoc.transact()`.
- **Responsive Layout** → Verified via `view_file` → **PASS**: Modal structure uses responsive directives shifting from vertical (`flex-col`) on mobile to side-by-side (`md:flex-row`) on desktop.
- **Dark Mode Styling** → Verified via `view_file` → **PASS**: Elements in `SemanticReviewModal.tsx` utilize `dark:bg-slate-950/95` and `dark:border-slate-800` correctly.
- **TypeScript Compilation** → Verified via `npx tsc --noEmit` → **PASS**: No compilation errors.
- **Lint Verification** → Verified via `npm run lint` → **FAIL**: 3 errors and 1 warning detected in test files.
- **Jest Test Suite Verification** → Verified via `npm test` → **FAIL**: `__tests__/semantic-review-r1.test.tsx` fails when run concurrently due to test pollution.

---

## Coverage Gaps

- **Collaboration Conflict Coverage** — *Risk Level: Medium* — Skipped/reviewed nodes are stored in browser-local `localStorage` instead of Yjs or DB. If User A skips a node, User B's browser still prompts User B to review it. Recommendation: Move skipped/reviewed state into Yjs or cloud store for consistent collaborative states.
- **Active Node Label Conflict Coverage** — *Risk Level: Low* — The modal checks for duplicate labels within pending nodes but not against already existing active nodes in the mindmap. Recommendation: Validate pending labels against active node labels.

---

## Unverified Items

- None. All key claims verified.

---

# Adversarial Challenge Report

## Challenge Summary

**Overall risk assessment**: HIGH

The main risks stem from concurrency bugs between background processes (polling/cloud synchronization) and local user states (modal editing, node deletion). These can result in permanent silencing of data (RSI/AI data loss) or phantom UI pops.

## Challenges

### [High] Challenge 1: Modal Review Concurrency Silence
- **Assumption challenged**: That the user is always reviewing a static list of pending items.
- **Attack scenario**: AI writes `NodeB` to database while user reviews `NodeA`. Polling adds `NodeB` to props. User approves `NodeA` and closes modal. `NodeB` is categorized as skipped and permanently blacklisted.
- **Blast radius**: User loses AI suggestions without ever seeing them.
- **Mitigation**: Freeze the pending list snapshot when the modal opens and only resolve items in that snapshot.

### [Medium] Challenge 2: Phantom Deletion Resurrection
- **Assumption challenged**: That local deletion immediately coordinates with polling.
- **Attack scenario**: User deletes a node. Within 2.5 seconds (sync debounce), polling reads the database and thinks the node is new because it is missing in Yjs.
- **Blast radius**: Deleted nodes immediately reappear in the Review Modal.
- **Mitigation**: Reference local tombstones in the polling filter.
