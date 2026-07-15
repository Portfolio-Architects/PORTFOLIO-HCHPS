# Project: Windows Explorer Sorting and Tagging Optimization in File Organizer

## Architecture
- **Script**: `scratch/organize-files.py` - Performs file indexing, categorization, deduplication (clustering), and metadata caching.
- **Cache**: `.search_cache.json` - Caches parsed file content, hash, mtime, size for search efficiency.
- **Test Suite**: `scratch/verify-duplicates.py` - Automated tests to verify deduplication, final-file marking, and cache integrity.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | keyword_extraction_impl | Implement `★최종★_` prefix and body keyword extraction/injection in `scratch/organize-files.py` | None | DONE |
| 2 | test_suite_updates | Update `scratch/verify-duplicates.py` to cover prefixing and keyword tagging | M1 | DONE |
| 3 | verification_and_debug | Run `scratch/verify-duplicates.py` and fix any execution issues or logic bugs | M2 | DONE |
| 4 | final_safety_check | Perform cache check and verify Zero Deletion Guard (no file loss) | M3 | IN_PROGRESS |

## Interface Contracts
- `organize-files.py`:
  - `main()`: Entry point of the organization process.
  - `get_clean_base_filename(filename)`: Cleans draft, final, and duplicate tags from name, but preserves any existing parentheses summary.
  - `clean_final_tag(filename)`: Strips and identifies final tags.
- `verify-duplicates.py`:
  - Runs in a mocked root `test_env` to prevent altering production files.
  - Returns exit code 0 on success.
