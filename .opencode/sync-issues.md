# Sync Issues (Unresolved Only)

All 4 sync issues have been resolved. See below for details.

---

## Resolved Issues

### SYNC-1
- Severity: HIGH
- Files: `backend/src/controllers/denials.controller.js`
- Fix: Replaced `$Claim.xxx$` nested column references with `literal()` calls using properly-quoted table aliases (`"DenialReason"."denial_code"`, `"Claim"."claim_id"`, etc.). Added single-quote escaping for SQL injection safety.
- Verification: Module loads OK, 70 parser tests pass
- Status: ✅ resolved

### SYNC-2
- Severity: LOW
- Files: `backend/src/controllers/denials.controller.js`
- Fix: Added `include: [{ model: Claim, attributes: [], required: true }]` to the `topCode` query, matching `summaryQuery`. Changed `col('id')` → `col('DenialReason.id')` to disambiguate.
- Verification: Module loads OK, 70 parser tests pass
- Status: ✅ resolved

### SYNC-3
- Severity: HIGH
- Files: `backend/tests/admin.test.js` (CREATED)
- Fix: Created `backend/tests/admin.test.js` with 6 unit tests covering: replace existing setting (2 tests), append missing setting (2 tests), edge cases (empty file, single-line file) (2 tests). Uses Jest v29 built-in `expect` (no Chai).
- Verification: 6/6 tests passing
- Status: ✅ resolved

### SYNC-4
- Severity: LOW
- Files: `frontend/src/pages/Admin.jsx`
- Fix: Added `setEditValues({...settings})` to `handleCancelEdit` to reset edit values to current saved state on cancel.
- Verification: Frontend builds successfully (917 modules, 4.54s)
- Status: ✅ resolved