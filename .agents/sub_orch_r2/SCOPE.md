# Scope: Milestone 2 - 3D Mindmap Rendering Performance Optimization (R2)

## Objectives
1. **Dirty-Flag Layout calculations**:
   - In `src/components/MindMap3D.tsx` (and `src/lib/engine/OntologyLayout.ts` if applicable), introduce a `dirtyFlag` (e.g. `isTopologyDirty` or layout needs updates).
   - Only perform BFS tree traversal and node position calculations (`computePositions`, etc.) when topology changes (node/edge added/removed/renamed). If no changes occur, reuse the cached layout positions completely to save CPU cycles.
2. **Frustum Culling**:
   - Skip rendering nodes and edges in the `draw` or rendering loop if they lie outside the camera's view frustum (boundaries of the canvas viewport).
   - Calculate viewport boundaries using camera position, zoom, and scale, and only draw nodes/edges that fall within this bounding box.
   - Skip physics/collision calculations for nodes/edges that are far outside the camera field.
3. **Collision Loop & Damping Optimization**:
   - Optimize the collision resolving loop (limit collision resolution iterations if frame rate drops).
   - Calibrate the Damping parameters to prevent jittering/trembling during orbiting animations.
4. **Orbiting calculation efficiency**:
   - Currently, orbiting animation calculates trigonometric functions (`Math.sin`, `Math.cos`) in every frame for each node.
   - Replace this with incremental rotation matrix additions or lookups to lower CPU utilization.

## Files to Modify
- `src/components/MindMap3D.tsx`
- `src/lib/engine/OntologyLayout.ts` (if applicable)

## Verification Method
- Profile FPS during orbiting and zooming (verify Target 60 FPS is maintained).
- Verify positioning calculation is skipped when layout is not dirty.
- Verify culling behaves correctly (off-screen nodes are not drawn).
- Run build & lint checks.
