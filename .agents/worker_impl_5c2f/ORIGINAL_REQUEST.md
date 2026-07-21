## 2026-07-16T05:55:14Z

Implement the following fixes and features in the codebase:
1. In `src/hooks/useGraphCustomization.ts`:
   - Inside the `addCustomNode` callback, search the Yjs `overrides` map for any node ID corresponding to the newly created node's name (check if the key equals `tag-${labelLower}` or `leaf-${labelLower}`, or if the existing override's `customLabel` matches the label). If found and it is hidden, clear its hidden flag by setting `hidden: null` so it becomes visible again (resolves the Tombstone Re-creation Bug).
   - Inside `addCustomEdge`, modify the function so that if the edge already exists (or its reverse exists), it updates its weight and type instead of ignoring the call.
2. In `src/components/MindMap3D.tsx`:
   - In `handleExecuteDelete`, implement the cascade delete logic: check if the node has children, prompt the user, recursively gather all descendant node IDs, mark all of them as hidden, and update the graph engine nodes/edges accordingly (matching the sidebar deletion logic in `MindMapInspector.tsx`).
3. In `src/components/MindMapInspector.tsx`:
   - In the header of `renderNodeDetails`, render the close/deselect (`X`) button whenever `activeNode` is selected (i.e. `activeNode !== null`), regardless of `isOverlay` (resolves the sidebar deselect UX issue).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please implement these changes, run the build and test suite, verify they compile and pass, and report back with a handoff detailing what files were changed and the results of verification.
