# Synthesis - Duplicate Engine Optimization & Verification

This document synthesizes the findings and design proposals from the three Explorer subagents.

## Consensus
All three Explorers reached consensus on the following items:
1. **Flaws in Current Script**: The existing online, single-pass processing is order-dependent and cannot reliably identify the true final version of a duplicate file.
2. **Group-First Strategy**: The script should map all files to their target categories, group them into similarity clusters (using the 4 Tiers of similarity), and then resolve each cluster.
3. **Final File Identification Ranking**:
   - Primary: Presence of keywords ('최종', '수정완료', '제출용', '배포용') in the filename, or a prior `[최종]` prefix (stripped during scanning to prevent repeat-run prefix accumulation).
   - Secondary: Most recent modification time (`mtime`) as a tie-breaker.
4. **Renaming & Move Action**:
   - Final File: Prepend `[최종] ` (or `[최종]`), optionally clean draft/duplicate suffixes to keep the root tidy, and keep it in the root folder.
   - Duplicate Files: Strip any `[최종]` prefix, keep their draft suffixes, and move them to `_Duplicates` folder.
5. **Real-Time Cache Sync**: Update `.search_cache.json` on disk immediately after each rename or move operation to ensure recovery capability if the script is interrupted. Prune obsolete cache keys at the end.
6. **Zero Deletion Guard**: Handle name collisions using `resolve_filename_collision` for both root and duplicate files, and never delete any files.
7. **Verify-duplicates.py updates**: Add test cases for 묶음 A, 묶음 B, repeat-run safety, and cache integrity.

## Resolved Conflicts
No major conflicts were found. The Explorers agreed on the graph-based clustering (connected components) approach for grouping similar files, which is mathematically sound.

## Dissenting Views
None.

## Gaps
None. All requirements in `ORIGINAL_REQUEST.md` have been fully addressed in the design.
