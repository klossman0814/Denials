# Configurable File Drop Locations — Design Document

**Date:** 2026-07-22
**Status:** Approved

## 1. Overview

Add the ability for admins to configure the inbound directories for 837 (claims) and 835 (remittance) EDI files via the Admin UI. Currently these paths are hardcoded in `.env` as `UPLOAD_DIR_837` and `UPLOAD_DIR_835`.

## 2. Storage Strategy (DB + .env)

- **Primary (runtime):** A `Setting` key-value table in PostgreSQL. The app reads paths from here on startup and at runtime.
- **Secondary (persistence):** On every admin save, the `.env` file is also updated so Docker container restarts (which re-read `.env`) pick up the latest paths.
- **Startup resolution:** DB first → if not found, fall back to `.env` defaults.

## 3. Data Model

### New Model: `Setting`

| Column | Type | Notes |
|--------|------|-------|
| `key` | `STRING(100)` | Primary key. Values: `upload_dir_837`, `upload_dir_835` |
| `value` | `TEXT` | Directory path (UNC or local) |
| `updated_at` | `DATE` | Auto-set on update |

No foreign key associations needed. The model is standalone.

## 4. Backend API

### `GET /admin/settings` (admin only, authenticated)

Returns current settings:

```json
{
  "settings": {
    "upload_dir_837": "\\\\nas-server\\shares\\837",
    "upload_dir_835": "./data/835"
  }
}
```

### `PUT /admin/settings` (admin only, authenticated)

Request body:
```json
{
  "upload_dir_837": "\\\\nas-server\\shares\\837",
  "upload_dir_835": "./data/835"
}
```

Processing flow:
1. Validate each path:
   - If path exists → accept
   - If path does not exist → attempt `fs.mkdirSync(path, { recursive: true })`, return a warning
   - If creation fails → return 400 with error message
2. Upsert rows in `Setting` table
3. Sync `.env` file (replace `UPLOAD_DIR_837=...` and `UPLOAD_DIR_835=...` lines; add if missing)
4. Restart `fileWatcher` with new paths via `restartWatcher(dir837, dir835)`
5. Return updated settings with any warnings

Response (success):
```json
{
  "settings": { "...": "..." },
  "warning": "Directory did not exist for 837, created it."
}
```

Response (validation error):
```json
{
  "error": "Cannot access directory for 837: \\\\bad\\path — The network path was not found"
}
```

## 5. File Watcher Changes

### Modified: `watcher/fileWatcher.js`

- `startWatcher(dir837, dir835)` — accepts explicit paths instead of reading from config
- `stopWatcher()` — unchanged (already exists)
- `restartWatcher(dir837, dir835)` — new function: calls `stopWatcher()` then `startWatcher(newDir837, newDir835)`
- On failure to watch a new path: log error, watcher stays stopped (safe state)

### Modified: `server.js`

Startup order changed:
1. Connect DB & sync models
2. Seed admin
3. Load settings from `Setting` table (findAll)
4. If settings found → use those paths; else fall back to `config.upload.dir837` / `dir835`
5. Start watcher with resolved paths

## 6. Admin Page (Frontend)

### New Card: "File Drop Locations"

Added to the existing `Admin.jsx` page between the Users card and System Status card.

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  File Drop Locations                                 │
│                                                      │
│  837 Claim Files                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ \\server\share\837                       [Edit]│   │
│  └──────────────────────────────────────────────┘   │
│  ● Status: Reachable                                │
│                                                      │
│  835 Remittance Files                                │
│  ┌──────────────────────────────────────────────┐   │
│  │ \\server\share\835                       [Edit]│   │
│  └──────────────────────────────────────────────┘   │
│  ● Status: Reachable                                │
│                                                      │
│  (status shows: ✅ Reachable | ⚠ Created | ❌ Error)│
└─────────────────────────────────────────────────────┘
```

**Edit mode:** Each row toggles to an `<input>` field with Save/Cancel buttons when Edit is clicked. No modal needed — inline editing keeps it clean.

**States:**
- **Loading:** Spinner while fetching settings
- **Edit mode:** Input field + Save/Cancel buttons
- **Validation feedback:** Status indicator updates live after save
- **Error:** Red text explaining why path was rejected
- **Warning:** Yellow text if directory was auto-created

### API Integration (existing `api.js`)

```js
// No new service file needed — uses existing api.js
api.get('/admin/settings')
api.put('/admin/settings', { upload_dir_837: '...', upload_dir_835: '...' })
```

## 7. .env Sync Mechanism

On `PUT /admin/settings`, after DB save:

1. Read `.env` file content
2. For each setting key (`UPLOAD_DIR_837`, `UPLOAD_DIR_835`):
   - If line exists → replace it
   - If not → append to end of file
3. Write file back atomically

**Edge cases:**
- If `.env` is read-only → log warning, skip silently (DB values still work)
- If `.env` doesn't exist → create it
- Use `os.EOL` for cross-platform line endings

## 8. Testing

- **Unit:** Setting model create/update/read
- **Unit:** .env sync logic (with temp files)
- **Unit:** fileWatcher restart (mock chokidar)
- **Integration:** PUT /admin/settings → verify settings returned, watcher restart called
- **Manual:** Configure a UNC path, drop a file, confirm it's processed

## 9. Files Changed

| File | Change |
|------|--------|
| `backend/src/models/Setting.js` | **NEW** — Setting model |
| `backend/src/models/index.js` | Add Setting to exports & no associations |
| `backend/src/controllers/admin.controller.js` | Add `getSettings`, `updateSettings` |
| `backend/src/routes/admin.routes.js` | Add GET/PUT /settings routes |
| `backend/src/watcher/fileWatcher.js` | Accept params, add `restartWatcher` |
| `backend/src/config/env.js` | No change needed (used as fallback) |
| `backend/src/server.js` | Load settings before starting watcher |
| `backend/.env` | Updated at runtime (always) |
| `frontend/src/pages/Admin.jsx` | Add File Drop Locations card |
