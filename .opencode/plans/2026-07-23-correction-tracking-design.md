# EDI Correction File Tracking Design

**Date:** 2026-07-23
**Status:** Draft

## Problem

The current deduplication system uses SHA-256 content hashing to prevent re-processing identical files.
This correctly ensures that a corrected file with the **same filename but different content** gets processed
as a new file. However, it does not **link** the correction to the original, so there is no audit trail
showing that file B replaced/corrected file A. Additionally, when a corrected file is moved to the
`_processed` directory, its filename may collide with the original.

## Design

### 1. Data Model Changes

**UploadedFile** table (see: `backend/src/models/UploadedFile.js`):

| Column | Type | Notes |
|--------|------|-------|
| `supersedes_id` | UUID, nullable, FK → `uploaded_files.id` | The file this one corrects |
| `correction_notes` | TEXT, nullable | Optional admin notes about the correction |
| `status` | Add `'replaced'` to `isIn` validation | Set on original file when a correction is processed |

**Claim** table (see: `backend/src/models/Claim.js`):

| Column | Type | Notes |
|--------|------|-------|
| `superseded_by_id` | UUID, nullable, FK → `claims.id` | The claim that replaced this one |
| `status` | Add `'replaced'` to `isIn` validation | Set on original claim when a matching correction claim is processed |

**Remittance** table (see: `backend/src/models/Remittance.js`):

| Column | Type | Notes |
|--------|------|-------|
| `superseded_by_id` | UUID, nullable, FK → `remittances.id` | The remittance that replaced this one |
| `status` | Add `'replaced'` to `isIn` validation | Set on original remittance when a matching correction is processed |

**New indexes:**
- `UploadedFile`: `{ fields: ['filename'] }` — for efficient same-filename heuristic lookup

**Updated associations** (`backend/src/models/index.js`):
- `UploadedFile.belongsTo(UploadedFile, { as: 'Supersedes', foreignKey: 'supersedes_id' })`
- `UploadedFile.hasOne(UploadedFile, { as: 'SupersededBy', foreignKey: 'supersedes_id' })`
- `Claim.belongsTo(Claim, { as: 'SupersededBy', foreignKey: 'superseded_by_id' })`
- `Remittance.belongsTo(Remittance, { as: 'SupersededBy', foreignKey: 'superseded_by_id' })`

### 2. Correction Detection Logic

**Location:** `backend/src/services/upload.service.js`, inside `processFile()`, after the existing
content-hash duplicate check but before the file record is created (between current lines ~31-33).

**Filename heuristic:**

1. Extract the "base filename" from `path.basename(filePath)`:
   - Strip a leading timestamp prefix (pattern: `/^\d+-/`) — this is added by Multer for HTTP uploads
   - The remainder is the "base filename"
2. Query `UploadedFile.findOne({ where: { filename: baseFilename, file_type: fileType, status: 'parsed' },
   order: [['uploaded_at', 'DESC']] })` — excludes the current content hash
3. If a match is found → set `fileRecord.supersedes_id = originalFile.id` on the new record

### 3. Claim/Remittance Matching

After parsing completes (inside `_process837` / `_process835`):

**For 837 (claims):**
- Find all `Claim` records belonging to the superseded file where `claim_id` matches the new claims
- Set `match.superseded_by_id = newClaim.id`, `match.status = 'replaced'`

**For 835 (remittances):**
- Find all `Remittance` records belonging to the superseded file where `payer_claim_id` matches new ones
- Set `match.superseded_by_id = newRemittance.id`, `match.status = 'replaced'`

**Edge cases:** partial corrections (unmatched records stay), empty corrections (file-level link only).

### 4. File Move to Processed Directory

When `fileRecord.supersedes_id` is set, append `.CORRECTED.<timestamp>` to the destination filename:
```
original:  claims_202410.837
corrected: claims_202410.CORRECTED.1721734567.837
```
Ensures both files coexist in the processed directory without collision.

### 5. Status Updates on Original File

When a correction is successfully processed:
- Original `UploadedFile` status → `'replaced'`
- New file status → `'parsed'` (normal)

### 6. API Changes

- **GET `/api/upload/files`** — include `supersedes_id`, nested `supersedes` object, `superseded_by`
- **GET `/api/upload/files/:id`** — new endpoint: file record + correction chain + claims/remittances with links
- **POST `/api/upload/:type`** — optional body param `supersedes` (UUID) to manually override heuristic

### 7. Frontend Changes

- File list: correction status column ("Original" / "Correction of X") with links
- File detail: "Correction Chain" section
- Upload form: optional "This file corrects" dropdown (recent same-type files)

### 8. Testing

**Unit tests** (`backend/tests/upload.test.js`):
1. Identical content → duplicate (hash check unchanged)
2. Same base filename, different content → `supersedes_id` set
3. Different filename → no supersedes
4. Claim matching with overlapping claim_ids
5. Remittance matching with overlapping payer_claim_ids
6. Filename normalization: `123456-foo.837` → `foo.837`
7. Corrected file gets `.CORRECTED.timestamp` appended
8. Original file status → `'replaced'`

### 9. Files to Modify

| File | Changes |
|------|---------|
| `backend/src/models/UploadedFile.js` | Add `supersedes_id`, `correction_notes`; update status enum; add filename index |
| `backend/src/models/Claim.js` | Add `superseded_by_id`; update status enum |
| `backend/src/models/Remittance.js` | Add `superseded_by_id`; update status enum |
| `backend/src/models/index.js` | Add self-referential associations |
| `backend/src/services/upload.service.js` | Add heuristic check; claim/remittance matching; corrected file move logic |
| `backend/src/controllers/upload.controller.js` | Expose link fields; handle manual `supersedes` |
| `backend/src/routes/upload.routes.js` | Add `GET /:id` |
| `backend/tests/upload.test.js` | Add correction tracking tests |
| Frontend list/detail/upload components | Correction chain UI |
