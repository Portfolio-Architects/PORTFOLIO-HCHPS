# Adversarial Review & Challenge Report — Milestone 3

## Challenge Summary

**Overall risk assessment**: **LOW**

The manual node/edge CRUD UI with Yjs sync shows high architectural robustness. Standard CRDT synchronization features, including cascade deletions and tombstones for unlinked edges, function correctly. The performance optimization using target hashing (`customizationHash` and `customNodesHash`) successfully prevents rendering whiplash during node dragging by ignoring coordinates changes (`fixedX`/`fixedY`), while still catching metadata/structural modifications correctly.

---

## Challenges

### [Low] Challenge 1: Millisecond ID Collision in Real-time Concurrent Editing

- **Assumption challenged**: Unique identifier generation using `custom-${Date.now()}` is sufficient.
- **Attack scenario**: Two collaborators click "Add Custom Node" at the exact same millisecond. Because Yjs maps act as standard key-value maps, the client whose transaction is processed last will overwrite the earlier node with the same ID, causing one user's node to disappear silently.
- **Blast radius**: Low. Only affects simultaneous creation of custom nodes within the same millisecond.
- **Mitigation**: Update the ID generation in `addCustomNode` to include a random suffix:
  ```typescript
  id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  ```

### [Low] Challenge 2: Edge Deduplication and Direction Constraint

- **Assumption challenged**: Edges are strictly bidirectional and deduplicated without direction distinction.
- **Attack scenario**: If a user attempts to create two separate edges between the same two nodes in opposite directions (e.g. `nodeA -> nodeB` with type `DEPENDENCY` and `nodeB -> nodeA` with type `INFLUENCE`), the second edge creation will be blocked because of the undirected check `!map.has(edgeId) && !map.has(reverseId)`.
- **Blast radius**: Low. Prevents representing bidirectional relationships with separate edge types, but maintains graph topology safety.
- **Mitigation**: If bidirectional relationships with different metadata are required in the future, remove the `!map.has(reverseId)` guard and use directional composite keys.

---

## Stress Test Results

- **Scenario 1: Custom Node Addition & Storage**
  - *Expected behavior*: Stored in Yjs with all custom fields (`label`, `group`, `baseValue`, `layerId`) and reflected in hook `customNodes` state.
  - *Actual behavior*: Successfully added, stored under `customNodesMap` map, and reflected after 16ms debounce.
  - *Result*: **PASS**

- **Scenario 2: Custom Edge Addition & Storage**
  - *Expected behavior*: Stored under composite key `source|||target` with `type` and `weight`, reflected in hook `customEdges` state.
  - *Actual behavior*: Stored in Yjs `customEdgesMap` and synced to state.
  - *Result*: **PASS**

- **Scenario 3: Node Deletion Cascade**
  - *Expected behavior*: Deleting node removes it from `customNodesMap`, removes all edges where it is source or target, removes overrides, and cleans up tombstones to prevent memory leak.
  - *Actual behavior*: All targets deleted clean, Yjs maps cleared.
  - *Result*: **PASS**

- **Scenario 4: Edge Unlinking and Tombstones**
  - *Expected behavior*: Deleting edge removes it from `customEdgesMap` and sets a tombstone in `deletedEdgesMap` to prevent replication/sync revival.
  - *Actual behavior*: Edge removed, tombstone set to `true`.
  - *Result*: **PASS**

- **Scenario 5: Drag Performance & Hash Invariance**
  - *Expected behavior*: Modifying node `fixedX`/`fixedY` coordinates does NOT change `customizationHash` or `customNodesHash`. Modifying label, group, color, or edge weight DOES change hashes.
  - *Actual behavior*: Coordinates changes did not alter hashes. Label and color changes successfully altered hashes.
  - *Result*: **PASS**

---

## Unchallenged Areas

- **PartyKit Server Performance under heavy network load**: Not challenged, as it requires a live network environment which is out of scope for the current local-first testing harness.
- **IndexedDB state compression/compaction rules**: Not challenged, as it depends on browser storage mechanics and was bypassed/mocked during Jest execution.
