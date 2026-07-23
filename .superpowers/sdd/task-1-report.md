# Task 1 Report: Update Database Models

## Implemented
- Added `supersedes_id` (UUID, nullable) and `correction_notes` (TEXT, nullable) to UploadedFile model
- Extended UploadedFile.status enum to include `'replaced'`
- Added filename index to UploadedFile
- Added `superseded_by_id` (UUID, nullable) to Claim model
- Extended Claim.status enum to include `'replaced'`
- Added `superseded_by_id` (UUID, nullable) to Remittance model
- Extended Remittance.status enum to include `'replaced'`

## Files Changed
- backend/src/models/UploadedFile.js
- backend/src/models/Claim.js
- backend/src/models/Remittance.js

## Self-Review
- All changes follow existing code style (no comments added, CommonJS requires preserved)
- Only modified files listed in the task brief
- Indexes array properly updated with new filename index
- No tests changed (not required per plan for this task)

## Commits
- 49bdb08 feat: add supersedes columns and replaced status to UploadedFile, Claim, Remittance models
