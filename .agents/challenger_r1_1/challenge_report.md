## Challenge Summary

**Overall risk assessment**: LOW

All verification tests passed successfully. The AI Semantic Extraction API and Review Modal components perform correctly and follow the defined specifications. There are no dangling or self-referential edges in the extraction payload, duplicate names and existing node/edge key conflicts are flagged with warnings, and local edits/deletes are maintained prior to calling Yjs transaction commits.

---

## Challenges

### [Low] Challenge 1: Edge case where node label consists only of a Korean postposition (조사)

- **Assumption challenged**: Assumes node labels contain meaningful nouns besides postpositions.
- **Attack scenario**: If the LLM generates a node with a label like "은" or "는" (which are purely postpositions), the `cleanKoreanLabel` function will reduce the label to an empty string `""` which is then filtered out, leaving a pruned node.
- **Blast radius**: The node is discarded. If other nodes depended on this node via edges, those edges are pruned as dangling. This is expected behavior and prevents garbage data from being added, but might miss nodes if the LLM output is extremely poor.
- **Mitigation**: The current fallback heuristics and post-processing filters handle empty labels gracefully, so the application remains robust.

### [Low] Challenge 2: Self-referencing relationships in API response

- **Assumption challenged**: Assumes LLM will always generate valid directional relations between different concepts.
- **Attack scenario**: If the LLM extracts an edge where `source === target` (e.g. node_19 -> node_19).
- **Blast radius**: If self-referencing relationships are committed to the graph, it can cause render anomalies or layout calculation loops.
- **Mitigation**: `postProcessGraph` correctly checks `e.source !== e.target` and prunes self-references. If manually added, the Review Modal correctly generates a visual conflict warning.

---

## Stress Test Results

- **Scenario 1: Extract API with >15 nodes**
  - Expected behavior: Only top 15 nodes are retained (sorted by `baseValue` desc), all low-value nodes are pruned.
  - Actual behavior: 20 nodes were sent, 15 nodes were returned. Lower-importance nodes were filtered.
  - Pass/Fail: PASS

- **Scenario 2: Pruning of dangling edges in API**
  - Expected behavior: Edges referencing pruned nodes are stripped.
  - Actual behavior: An edge referencing node_0 (pruned) was correctly removed, while the edge between top-15 nodes was retained.
  - Pass/Fail: PASS

- **Scenario 3: Korean label postposition removal**
  - Expected behavior: Trailing Korean grammatical postpositions (e.g., "은") are stripped.
  - Actual behavior: "노드_19은" was cleaned to "노드_19".
  - Pass/Fail: PASS

- **Scenario 4: Duplicate name warning**
  - Expected behavior: Shows warning when two pending nodes have the same label.
  - Actual behavior: Correctly triggered: `노드 이름 중복: '동일라벨'이라는 이름의 노드가 검토 목록에 여러 개 포함되어 있습니다.`
  - Pass/Fail: PASS

- **Scenario 5: Duplicate ID (Conflict) warning**
  - Expected behavior: Shows warning when a pending node ID matches an existing graph node ID.
  - Actual behavior: Correctly triggered: `노드 ID 중복: 'existing_node'(표시명: 기존노드)는 이미 마인드맵에 존재합니다. 병합 시 덮어써집니다.`
  - Pass/Fail: PASS

- **Scenario 6: Edit node label before Yjs commit**
  - Expected behavior: Editing labels updates local React component state.
  - Actual behavior: Value of input updated immediately to the edited text and was committed with the updated value.
  - Pass/Fail: PASS

- **Scenario 7: Delete node before Yjs commit**
  - Expected behavior: Deleting a node removes it from local state and automatically removes any edges referencing it.
  - Actual behavior: Node was removed, and associated edge was pruned. Both were logged in `skippedIds` so that they would not reappear.
  - Pass/Fail: PASS

---

## Unchallenged Areas

- **Yjs CRDT Concurrent Conflict resolution** — Since Yjs handles concurrent edits automatically via LWW (Last-Write-Wins) and state vectors, testing concurrent physical Yjs merges is handled at the engine level and is out of scope for the front-end Review Modal verification.
