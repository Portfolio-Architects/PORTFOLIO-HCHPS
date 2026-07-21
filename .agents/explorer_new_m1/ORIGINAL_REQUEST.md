## 2026-07-16T03:01:37Z
You are the Codebase Explorer. Your task is to investigate the VITAL Work & Wealth application code to prepare the implementation plan for the following new requirements:

1. **R1: AI Semantic Engine Enhancement & Review Modal**:
   - Inspect `src/app/api/llm/extract/route.ts` and `src/lib/engine/ontology-extractor.ts` (or similar extraction engines). Find how they perform semantic extraction, structure prompts, parse LLM results into nodes and edges, and merge them into the dataset.
   - Design a plan to enhance the extraction prompts and logic.
   - Design a plan to implement a User Review Modal where users can see, edit, and select/deselect extracted nodes and edges before they are written to the database or Yjs CRDT.

2. **R2: 3D Rendering Performance Optimization (Target 60 FPS)**:
   - Inspect `src/components/MindMap3D.tsx` (the Force-Directed Graph render loop, physics, layout calculations).
   - Identify where unnecessary computations occur.
   - Design a plan to apply:
     - Dirty-Flag pattern to node position calculations (calculating layout positions only when dirty).
     - Frustum Culling (not rendering nodes/edges that are outside the camera frustum).
     - Tuning collision loop bounds/damping parameters.
     - Optimizing or removing expensive Orbiting trigonometric calculations.

3. **R3: Manual Node/Edge CRDT UI in MindMapInspector**:
   - Inspect `src/components/MindMapInspector.tsx` and how it handles active nodes and overrides.
   - Identify how Yjs or CRDT state synchronization is implemented for nodes and edges in the application.
   - Design a plan to add a manual UI in `MindMapInspector.tsx` to:
     - Create new nodes and connect them with new edges.
     - Delete existing nodes and edges.
     - Ensure these operations update the Yjs CRDT shared maps/arrays directly so changes synchronize instantly across clients.

Write your findings and detailed implementation proposals in `analysis.md` inside `.agents/explorer_new_m1/`. When complete, send a message back to the orchestrator (conversation ID: 31acc72e-e0bc-4c9d-a62a-5c8a9a6b863f) with the analysis path.
