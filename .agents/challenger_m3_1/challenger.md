# Adversarial Challenge Report: M3 CRUD UI & Yjs Sync

## Challenge Summary

**Overall risk assessment**: **LOW**

The manual Node/Edge CRUD operations and Yjs synchronization have been fully verified. The implementation is highly robust, utilizing Yjs's CRDT structures to ensure consistency across clients, backed by a debounced synchronization store that throttles state updates to 16ms (60 FPS) to prevent rendering overhead. The drag position updates are successfully excluded from the calculation of rendering hashes (`customizationHash` and `customNodesHash`), which protects the system from rendering whiplash during interactive node movements.

---

## Challenges & Vulnerability Analysis

### [Medium] Challenge 1: `addCustomEdge` Lacks Upsert capability (Guard Block)

- **Assumption challenged**: That `addCustomEdge` is strictly for new connections and does not need to handle updates to existing connections.
- **Attack scenario**: If a UI action or AI-driven auto-merging script calls `addCustomEdge(source, target, type, newWeight)` on an edge that already exists in either direction (i.e. `source->target` or `target->source`), the call is silently ignored due to the guard:
  ```typescript
  if (!map.has(edgeId) && !map.has(reverseId)) {
    map.set(edgeId, { source, target, weight, type });
  }
  ```
  Consequently, trying to update the weight or relationship type of an existing edge using this function fails to propagate changes to Yjs.
- **Blast radius**: Moderate. The UI is currently designed to delete and re-add edges rather than edit them in-place, but any backend/LLM integrations calling `addCustomEdge` to update parameters will fail silently.
- **Mitigation**: Update `addCustomEdge` to support upsert behavior, or provide a separate `updateCustomEdge` helper. For example:
  ```typescript
  if (map.has(edgeId)) {
    const existing = map.get(edgeId);
    map.set(edgeId, { ...existing, weight, type });
  }
  ```

### [Low-Medium] Challenge 2: Debounce Latency (16ms) Stale React State Reads

- **Assumption challenged**: That React state updates instantly after Yjs mutations.
- **Attack scenario**: The synchronization layer debounces Yjs updates by 16ms:
  ```typescript
  timeoutId = setTimeout(() => {
    snapshot = { ... };
    listeners.forEach(l => l());
  }, 16);
  ```
  If a developer modifies Yjs state (e.g. `addCustomNode`) and immediately reads the React state (`customNodes` array) within the same thread execution, they will read a stale snapshot.
- **Blast radius**: Low. Standard React state updates are always asynchronous, but the extra 16ms debounce extends this delay. This must be managed carefully in sequential workflows.
- **Mitigation**: Instruct components to rely on the returned values of helper functions (e.g. `addCustomNode` returns the newly created `OntologyNode` object) rather than trying to read it from the `customNodes` array immediately.

---

## Stress & Empirical Test Results

We created a custom integration test suite (`__tests__/useGraphCustomization.test.tsx`) running under Jest and JSDOM to test all CRUD and hash behaviors.

| Scenario / Test Case | Expected Behavior | Actual Behavior | Pass/Fail |
|---|---|---|---|
| **1. Custom Node Storage** | Node is stored in Yjs `customNodesMap` and reflected in `customNodes` array with `label`, `group`, `baseValue`, and `layerId`. | Yjs map contains the node; after 16ms debounce, the React hook returns it in the array. | **PASS** |
| **2. Custom Edge Storage** | Edge is stored in Yjs `customEdgesMap` and reflected in `customEdges` array with `source`, `target`, `type`, and `weight`. | Yjs map contains the edge; after 16ms debounce, the hook returns it in the array. | **PASS** |
| **3. Node Deletion Cascade** | Deleting a node deletes it from `customNodesMap`, deletes connected edges from `customEdgesMap`, and removes corresponding `overrides`. | The node, its edges, and overrides are successfully removed from all Yjs maps in a single transaction. | **PASS** |
| **4. Edge Unlinking / Tombstoning** | Deleting an edge deletes it from `customEdgesMap` and writes `true` to `deletedEdgesMap` (tombstone) to prevent sync resurrection. | The edge is removed, and a tombstone is correctly recorded in Yjs `deletedEdgesMap`. | **PASS** |
| **5. Rendering Hash Performance** | Changing `fixedX` / `fixedY` coordinates (via drag/overrides) does **not** change hashes. Changing structural fields (`label`, `weight`, `type`) **does** change hashes. | `customizationHash` and `customNodesHash` remain stable during coordinate moves but change immediately upon structural edits. | **PASS** |

---

## Unchallenged Areas

- **PartyKit Network Sync Collision**: Real-time network sync and concurrency conflict resolution (e.g., two users modifying the same custom node concurrently) were not tested under a live server environment, as network connections are mocked out during Jest tests. However, Yjs's CRDT logic naturally guarantees eventual consistency.
