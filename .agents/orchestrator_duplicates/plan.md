# Project: Duplicate File Detection and Safe Organization

## Architecture
- **Root Directory**: `F:\부엉이_정리됨`
- **Search Cache**: `F:\부엉이_정리됨\.search_cache.json`
- **Engine File**: `scratch/organize-files.py` (which will be modified or extended with duplicate detection & transfer)
- **Verification Script**: `scratch/verify-duplicates.py`

## Milestones
| # | Name | Scope | Dependencies | Status | Conversation ID |
|---|------|-------|-------------|--------|-----------------|
| 1 | Plan & Requirements | Establish analysis and layout in `plan.md` | None | DONE | - |
| 2 | Design & Exploration | Analyze `scratch/organize-files.py`, similarity metrics, cache updates, and write verification logic | M1 | DONE | 27adeddd-d33c-494f-a8fc-d8a8eceee635 |
| 3 | Implementation & Testing | Update `scratch/organize-files.py` to identify similarity, safely transfer, and update cache | M2 | DONE | 9073d884-9aba-4419-953a-659109c064d1 |
| 4 | Verification Execution | Run `scratch/verify-duplicates.py` to ensure all tests pass and verify no deletions occurred | M3 | DONE | 971cae54-025b-4c03-bc1d-34cb00a56c41 |

## Interface Contracts & Specifications
- **Similarity Threshold**:
  - Filename Similarity: SequenceMatcher ratio or Levenshtein ratio >= 80% (or filename-based grouping).
  - Text Similarity: Content cosine similarity or keyword density overlap >= 80%.
  - Both file content AND name similarity should be taken into account, or content similarity >= 80% with similar filenames.
- **Bottom-level `_Duplicates` Folder**:
  - Any duplicate file should be moved to the `_Duplicates` folder located inside the *same* bottom-level folder where the file would be archived (e.g. `F:\부엉이_정리됨\<Theme>\<SubTheme>\<Year>\<WorkDomain>\_Duplicates`).
  - Filename collisions in `_Duplicates` must be resolved by appending `_1`, `_2`, etc. before the extension (e.g., `20260715_test_1.txt`).
- **No File Deletion Rule**:
  - Files MUST NOT be deleted. Only `shutil.move` is allowed.
  - If any error occurs during transfer, roll back or abort to prevent data loss.
- **Cache Integrity**:
  - The cache `.search_cache.json` maps absolute file paths to metadata (`{"mtime": ms, "size": bytes, "content": text}`).
  - When files are renamed or moved, the old path keys must be removed or updated, and the new paths must be registered in the cache.
