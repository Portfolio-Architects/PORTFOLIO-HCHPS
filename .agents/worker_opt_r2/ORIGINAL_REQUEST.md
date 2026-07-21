## 2026-07-16T03:38:50Z
<USER_REQUEST>
You are the Worker for Milestone 2: 3D Mindmap Rendering Performance Optimization.
Your workspace directory is d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL.
Please create your own metadata folder under `.agents/worker_opt_r2/` and write your briefing/progress files there.
Your task is to implement the synthesized performance optimization strategy:
Read synthesis.md at d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\sub_orch_r2\synthesis.md
Read the Explorer reports:
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_r2_2\analysis.md
- d:\Desktop\PORTFOLIO\PORTFOLIO - VITAL\.agents\explorer_r2_3\analysis.md

Implement the following optimizations:
1. Dirty-Flag Layout Calculations (BFS Optimization): Decouple layout structural updates (topology changes like add, remove, collapse, expand) from geometry updates (dragging, panning, zoom, orbiting) using a new `isTopologyDirty` flag. Only recalculate tree BFS layout in `OntologyLayout.computePositions` if `isTopologyDirty` is true. Otherwise reuse cached coordinates in static mode.
2. Viewport & Label Frustum Culling: Skip processing off-screen nodes, text backing boxes, and edge labels in `OntologyRenderer.ts` using screen-space bounding box checks.
3. Collision Loop & Damping Calibration:
   - Scale down collision resolution iterations dynamically based on current FPS from `PerformanceProfiler` (iterations = 2 if FPS < 50, 1 if FPS < 40).
   - Attenuate damping by a decay factor of 0.80 per iteration to prevent node jitter/trembling.
   - Ignore overlaps below 0.8px.
   - Banish collision updates during passive camera pan/zoom; only run during active layout updates or node dragging.
   - Sleep node physics velocities faster when speedSq < 0.012.
4. Orbiting & Ring Rendering Efficiency:
   - Cache unit vectors `(orbitCos, orbitSin)` on nodes. Incrementally rotate and renormalize these vectors, then scale by radius to compute node coordinates.
   - Bypass LERP positioning during active orbiting and snap positions directly to eliminate lag trembling.
   - Use Taylor-series small-angle rotation approximations inside collision updates instead of expensive trig functions.
   - Cache tilt angles statically in `OntologyLayout`.
   - Precompute 64-segment unit circle points in `OntologyRenderer` to render orbit rings.

Important:
- Record your patch details in `PORTFOLIO VITAL - Engineering Report.md` immediately upon completing the code changes.
- Run `node scripts/run-harness.js` to verify that there are no TS, ESLint, or database integrity errors.
- Ensure you strictly follow AGENTS.md rules (e.g. FSD/MVC constraints).

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.

When complete, write handoff.md and send a message back to the parent (conversation ID: 9b15eace-e7e8-4066-8492-f68b1200e2a3) with your handoff path.
</USER_REQUEST>
