# Scope: Milestone 1 - AI Semantic Extraction & Review Modal (R1)

## Objectives
1. **Gemini prompt & Backend Filtering**:
   - Refine Gemini system prompt in `src/app/api/llm/extract/route.ts` to strictly extract core nouns and relationships. Eliminate meaningless particles, postpositions, and adjectives.
   - Implement a post-processing filter (stopword list/Korean POS) and limit the maximum number of extracted nodes to 15.
2. **Review & Approve Modal UI**:
   - Instead of merging nodes directly to Yjs store via `mergeExtractedGraph` immediately upon completion of semantic extraction, show an interactive Review Modal.
   - Let the user view the list of extracted nodes and edges, add new ones, delete unwanted ones, and edit labels/connections before merging.
   - Provide an "Approve & Merge" button that executes the actual Yjs store merge.
   - Ensure the modal is beautifully integrated with Tailwind CSS, matching the existing design.

## Files to Modify
- `src/app/api/llm/extract/route.ts`
- `src/lib/engine/ontology-extractor.ts`
- `src/components/MindMapInspector.tsx` (or new component `src/components/SemanticReviewModal.tsx` and integrate it)
- `src/components/WikiEditor.tsx` (if extraction is triggered from here) or wherever the extraction call is initialized.

## Verification Method
- Trigger semantic extraction from a wiki document.
- Verify the Review Modal pops up.
- Edit nodes/edges in the modal.
- Click approve and verify the changes are merged into Yjs and rendered on the 3D Mindmap.
- Run build & lint.
