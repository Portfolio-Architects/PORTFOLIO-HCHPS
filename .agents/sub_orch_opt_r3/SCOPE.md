# Scope: Milestone 4 - 3D Mindmap Rendering Speed and GC Lag Optimization (R3)

## Architecture
- **View (UI)**:
  - `src/components/MindMap3D.tsx`: React component wrapping the canvas rendering engine.
- **Controller (Engine)**:
  - `src/lib/engine/OntologyRenderer.ts`: Handles canvas rendering, culling, and spatial hashing.
  - `src/lib/OntologyCanvasEngine.ts`: Manages animation frames and tick scheduling.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | integer_hash_keys | Refactor spatial hash keys from string `${r},${c}` to bitwise integer key single numeric values | None | DONE |
| 2 | static_map_pooling | Reuse static class-level Map for `spatialGrid` and pool grid arrays to avoid allocations | integer_hash_keys | DONE |
| 3 | verification | Verify that no temporary objects are allocated in render loop and build succeeds | static_map_pooling | DONE |

## Interface Contracts
- Eliminate all frame-level Map, Set, and Array allocations inside `renderNodes` when `isFastPath` is false.
- Maintain existing frustum culling logic for edges, labels, and nodes.
