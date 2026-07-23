# Correction File Tracking Implementation Plan

> **For agentic workers:** Sub-tasks use checkbox (`- [ ]`) syntax.

**Goal:** Add correction tracking for EDI 835/837 files so that a corrected file with the same base filename but different content is linked to the original file, and individual claims/remittances are tracked as superseded.

**Architecture:** Filename-heuristic detection in `uploadService.processFile()` links new files to originals via `supersedes_id`. After parsing, matching claims (`claim_id` for 837) and remittances (`payer_claim_id` for 835) are marked `replaced`. Filenames in the processed dir get `.CORRECTED.<timestamp>` appended to avoid collision.

**Tech Stack:** Node.js/Express, PostgreSQL + Sequelize, React 18, chokidar, Bull/Redis

---
## Global Constraints
- Follow existing code style (no comments unless asked, CommonJS requires, Sequelize models)
- Only modify or create files listed in this plan
- Use content-hash dedup check exclusively for true duplicates; filename heuristic runs AFTER hash check
- The `status: 'parsed'` filter must be used on the original file lookup to avoid matching queued/parsing/error files

---

### Task 1: Update Database Models

**Files:**
- Modify: `backend/src/models/UploadedFile.js`
- Modify: `backend/src/models/Claim.js`
- Modify: `backend/src/models/Remittance.js`

- [ ] **Add `supersedes_id` and `correction_notes` to UploadedFile, extend status enum, add filename index**

In `UploadedFile.js`, add to the model definition:
```js
supersedes_id: { type: DataTypes.UUID, allowNull: true },
correction_notes: { type: DataTypes.TEXT, allowNull: true },
```

Change the `status` validate `isIn` to include `'replaced'`:
```js
status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending',
  validate: { isIn: [['pending', 'parsing', 'parsed', 'duplicate', 'error', 'replaced']] } },
```

Add a filename index to the indexes array:
```js
{ fields: ['filename'] },
```

- [ ] **Add `superseded_by_id` to Claim, extend status enum**

In `Claim.js`, add:
```js
superseded_by_id: { type: DataTypes.UUID, allowNull: true },
```

Change the `status` validate to:
```js
status: { type: DataTypes.STRING(20), defaultValue: 'submitted',
  validate: { isIn: [['submitted', 'paid', 'denied', 'partial', 'replaced']] } },
```

- [ ] **Add `superseded_by_id` to Remittance, extend status enum**

In `Remittance.js`, add:
```js
superseded_by_id: { type: DataTypes.UUID, allowNull: true },
```

Change the `status` validate to:
```js
status: { type: DataTypes.STRING(20), defaultValue: 'pending',
  validate: { isIn: [['pending', 'paid', 'denied', 'partial', 'replaced']] } },
```

---

### Task 2: Add Self-Referential Model Associations

**Files:**
- Modify: `backend/src/models/index.js`

- [ ] **Update model associations to include self-referential links**

In `index.js`, replace the `UploadedFile.associate?.({...})` line to include the self-join:
```js
UploadedFile.associate?.({ User, Claim, Remittance, RemittanceFile });
```

Add the `supersedes` and `superseded_by` associations inside `UploadedFile.associate` in `UploadedFile.js`:
```js
UploadedFile.belongsTo(models.UploadedFile, { as: 'Supersedes', foreignKey: 'supersedes_id' });
UploadedFile.hasOne(models.UploadedFile, { as: 'SupersededBy', foreignKey: 'supersedes_id' });
```

In `index.js`, update the `Claim.associate?.({...})` line to include the self-join:
```js
Claim.associate?.({ UploadedFile, ClaimLine, Remittance, DenialReason });
```

Add the `superseded_by` association inside `Claim.associate` in `Claim.js`:
```js
Claim.belongsTo(models.Claim, { as: 'SupersededBy', foreignKey: 'superseded_by_id' });
```

In `index.js`, update the `Remittance.associate?.({...})`:
```js
Remittance.associate?.({ UploadedFile, Claim, DenialReason, RemittanceFile, RemittanceLine });
```

Add the `superseded_by` association inside `Remittance.associate` in `Remittance.js`:
```js
Remittance.belongsTo(models.Remittance, { as: 'SupersededBy', foreignKey: 'superseded_by_id' });
```

---

### Task 3: Add Correction Detection Heuristic

**Files:**
- Modify: `backend/src/services/upload.service.js`
- Test: `backend/tests/upload.test.js`

- [ ] **Add filename heuristic to `processFile()`**

In `upload.service.js`, add this helper method after the existing `_matchClaim` (line ~210):

```js
async _findSupersededFile(filePath, fileType, contentHash) {
  const filename = path.basename(filePath);
  const baseFilename = filename.replace(/^\d+-/, '');
  return await UploadedFile.findOne({
    where: {
      filename: baseFilename,
      file_type: fileType,
      status: 'parsed',
      content_hash: { [Op.ne]: contentHash },
    },
    order: [['uploaded_at', 'DESC']],
  });
}
```

Import `Op` at the top — it's already imported from Sequelize on line 4.

In `processFile()`, after the existing duplicate check (line 31) and before the `UploadedFile.create` call (line 33), add the heuristic check:

```js
const supersededFile = await this._findSupersededFile(filePath, fileType, contentHash);
```

Then when creating the file record, include `supersedes_id` if a match was found:

```js
const fileRecord = await UploadedFile.create({
  filename, file_type: fileType, file_path: filePath,
  file_size: stats.size, content_hash: contentHash,
  status: 'parsing', uploaded_by: uploadedBy,
  supersedes_id: supersededFile?.id || null,
});
```

After the successful parse (after `fileRecord.parsed_at = new Date()` on line 45), and before moving the file, add the claim/remittance matching call:

```js
if (supersededFile) {
  await this._markSupersededRecords(fileType, supersededFile.id, fileRecord.id);
  await UploadedFile.update({ status: 'replaced' }, { where: { id: supersededFile.id } });
}
```

- [ ] **Write test for filename heuristic detection**

Add to `backend/tests/upload.test.js`:

```js
const crypto = require('crypto');
const { Op } = require('sequelize');

it('should link correction files by same base filename', async () => {
  const tmpDir = path.resolve(__dirname, '../data/837');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Upload first file
  const file1 = path.join(tmpDir, 'claims_202410.837');
  fs.writeFileSync(file1, SAMPLE_837);
  const res1 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file1);
  expect(res1.status).toBe(201);
  const firstFileId = res1.body.file.id;

  // Upload corrected file with same base name, different content
  const modifiedContent = SAMPLE_837 + '\n// CORRECTION';
  const file2 = path.join(tmpDir, 'claims_202410.837');
  fs.writeFileSync(file2, modifiedContent);
  const res2 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file2);
  expect(res2.status).toBe(201);

  // Verify the new file is linked to the original
  const newFile = await require('../src/models').UploadedFile.findByPk(res2.body.file.id);
  expect(newFile.supersedes_id).toBe(firstFileId);

  // Verify original file is marked replaced
  const originalFile = await require('../src/models').UploadedFile.findByPk(firstFileId);
  expect(originalFile.status).toBe('replaced');

  if (fs.existsSync(file1)) fs.unlinkSync(file1);
  if (fs.existsSync(file2)) fs.unlinkSync(file2);
});

it('should NOT link files with different base filenames', async () => {
  const tmpDir = path.resolve(__dirname, '../data/837');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const file1 = path.join(tmpDir, 'claims_a.837');
  fs.writeFileSync(file1, SAMPLE_837);
  const res1 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file1);
  expect(res1.status).toBe(201);

  const file2 = path.join(tmpDir, 'claims_b.837');
  fs.writeFileSync(file2, SAMPLE_837 + '\n// CORRECTION');
  const res2 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file2);
  expect(res2.status).toBe(201);

  const newFile = await require('../src/models').UploadedFile.findByPk(res2.body.file.id);
  expect(newFile.supersedes_id).toBeNull();

  if (fs.existsSync(file1)) fs.unlinkSync(file1);
  if (fs.existsSync(file2)) fs.unlinkSync(file2);
});
```

---

### Task 4: Claim/Remittance Matching for Corrections

**Files:**
- Modify: `backend/src/services/upload.service.js`
- Test: `backend/tests/upload.test.js`

- [ ] **Add `_markSupersededRecords` method to upload service**

Add this method to `UploadService` class:

```js
async _markSupersededRecords(fileType, supersededFileId, newFileId) {
  if (fileType === '837') {
    const newClaims = await Claim.findAll({ where: { file_id: newFileId } });
    const claimIds = newClaims.map(c => c.claim_id).filter(Boolean);
    if (claimIds.length === 0) return;
    const oldClaims = await Claim.findAll({
      where: { file_id: supersededFileId, claim_id: { [Op.in]: claimIds } },
    });
    for (const oldClaim of oldClaims) {
      const matchingNew = newClaims.find(c => c.claim_id === oldClaim.claim_id);
      if (matchingNew) {
        oldClaim.superseded_by_id = matchingNew.id;
        oldClaim.status = 'replaced';
        await oldClaim.save();
      }
    }
  } else if (fileType === '835') {
    const newRemits = await Remittance.findAll({ where: { file_id: newFileId } });
    const payerClaimIds = newRemits.map(r => r.payer_claim_id).filter(Boolean);
    if (payerClaimIds.length === 0) return;
    const oldRemits = await Remittance.findAll({
      where: { file_id: supersededFileId, payer_claim_id: { [Op.in]: payerClaimIds } },
    });
    for (const oldRemit of oldRemits) {
      const matchingNew = newRemits.find(r => r.payer_claim_id === oldRemit.payer_claim_id);
      if (matchingNew) {
        oldRemit.superseded_by_id = matchingNew.id;
        oldRemit.status = 'replaced';
        await oldRemit.save();
      }
    }
  }
}
```

- [ ] **Write tests for claim/remittance matching**

```js
it('should mark matching claims as replaced in correction file', async () => {
  const tmpDir = path.resolve(__dirname, '../data/837');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // Upload original
  const file1 = path.join(tmpDir, 'match_test.837');
  fs.writeFileSync(file1, SAMPLE_837);
  const res1 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file1);
  expect(res1.status).toBe(201);
  const originalClaims = await require('../src/models').Claim.findAll({
    where: { file_id: res1.body.file.id },
  });
  expect(originalClaims.length).toBeGreaterThan(0);

  // Use modified content to avoid hash dedup
  const modifiedContent = SAMPLE_837 + '\n// CORRECTION';
  const file2 = path.join(tmpDir, 'match_test.837');
  fs.writeFileSync(file2, modifiedContent);
  const res2 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file2);
  expect(res2.status).toBe(201);

  // Check original claims are marked replaced
  const reloadedClaims = await require('../src/models').Claim.findAll({
    where: { file_id: res1.body.file.id },
  });
  for (const c of reloadedClaims) {
    expect(c.superseded_by_id).not.toBeNull();
    expect(c.status).toBe('replaced');
  }

  if (fs.existsSync(file1)) fs.unlinkSync(file1);
  if (fs.existsSync(file2)) fs.unlinkSync(file2);
});
```

---

### Task 5: Handle Corrected File Move to Processed Directory

**Files:**
- Modify: `backend/src/services/upload.service.js`
- Test: `backend/tests/upload.test.js`

- [ ] **Add `.CORRECTED.<timestamp>` suffix when moving corrected files**

In `processFile()`, replace the file move block (lines 48-57, starting with `try { const processedDir = ...`):

```js
try {
  const processedDir = fileType === '837' ? config.upload.processedDir837 : config.upload.processedDir835;
  if (processedDir) {
    const absProcessed = path.resolve(processedDir);
    fs.mkdirSync(absProcessed, { recursive: true });
    let destFilename = filename;
    if (supersededFile) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      destFilename = `${base}.CORRECTED.${Date.now()}${ext}`;
    }
    const destPath = path.join(absProcessed, destFilename);
    fs.copyFileSync(filePath, destPath);
    fs.unlinkSync(filePath);
    logger.info(`Moved ${filename} to ${absProcessed}${supersededFile ? ' (corrected)' : ''}`);
  }
} catch (moveErr) {
  logger.warn(`Could not move ${filename} to processed dir: ${moveErr.message}`);
}
```

Note: need to keep `const supersededFile` in scope. The variable is already declared before the `UploadedFile.create` call (in Task 3). Make sure to pass it through to the move logic.

- [ ] **Write test for corrected file naming**

```js
it('should append .CORRECTED.timestamp to corrected file in processed dir', async () => {
  const tmpDir = path.resolve(__dirname, '../data/837');
  const processedDir = path.resolve(__dirname, '../data/837_processed');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

  // Clean processed dir
  fs.readdirSync(processedDir).forEach(f => fs.unlinkSync(path.join(processedDir, f)));

  const file1 = path.join(tmpDir, 'move_test.837');
  fs.writeFileSync(file1, SAMPLE_837);
  const res1 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file1);
  expect(res1.status).toBe(201);

  const modifiedContent = SAMPLE_837 + '\n// CORRECTION v2';
  const file2 = path.join(tmpDir, 'move_test.837');
  fs.writeFileSync(file2, modifiedContent);
  const res2 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file2);
  expect(res2.status).toBe(201);

  // Check that a .CORRECTED file exists in processed dir
  const processedFiles = fs.readdirSync(processedDir);
  const correctedFile = processedFiles.find(f => f.startsWith('move_test.CORRECTED.'));
  expect(correctedFile).toBeDefined();
  // Original file should still be there too
  const originalFile = processedFiles.find(f => f === 'move_test.837');
  expect(originalFile).toBeDefined();

  if (fs.existsSync(file1)) fs.unlinkSync(file1);
  if (fs.existsSync(file2)) fs.unlinkSync(file2);
});
```

---

### Task 6: Update API — Expose Fields, Add Detail Endpoint

**Files:**
- Modify: `backend/src/controllers/upload.controller.js`
- Modify: `backend/src/routes/upload.routes.js`
- Test: `backend/tests/upload.test.js`

- [ ] **Modify `listFiles` to include supersedes info**

In `upload.controller.js`, update the `findAndCountAll` call to include the `Supersedes` association:

```js
const { rows, count } = await UploadedFile.findAndCountAll({
  include: [
    { association: 'Supersedes', attributes: ['id', 'filename', 'uploaded_at'] },
    { association: 'SupersededBy', attributes: ['id', 'filename', 'uploaded_at'] },
  ],
  order: [['uploaded_at', 'DESC']],
  limit: parseInt(limit),
  offset,
});
```

- [ ] **Add `getFile` endpoint**

Add to `upload.controller.js`:

```js
exports.getFile = async (req, res, next) => {
  try {
    const file = await UploadedFile.findByPk(req.params.id, {
      include: [
        { association: 'Supersedes', attributes: ['id', 'filename', 'uploaded_at', 'status'] },
        { association: 'SupersededBy', attributes: ['id', 'filename', 'uploaded_at', 'status'] },
      ],
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const claims = await Claim.findAll({ where: { file_id: file.id } });
    const remittances = await Remittance.findAll({ where: { file_id: file.id } });

    res.json({ file, claims, remittances });
  } catch (error) { next(error); }
};
```

Make sure `Claim` and `Remittance` are imported at the top. The current import is:
```js
const { UploadedFile } = require('../models');
```
Change to:
```js
const { UploadedFile, Claim, Remittance } = require('../models');
```

- [ ] **Add route for new endpoint**

In `upload.routes.js`, add:
```js
router.get('/files/:id', authenticate, controller.getFile);
```

- [ ] **Write test for new endpoint**

```js
it('should return file detail with supersedes info', async () => {
  const tmpDir = path.resolve(__dirname, '../data/837');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const file = path.join(tmpDir, 'detail_test.837');
  fs.writeFileSync(file, SAMPLE_837);
  const res1 = await request(app)
    .post('/api/upload/837').set('Authorization', `Bearer ${token}`)
    .attach('file', file);
  expect(res1.status).toBe(201);
  const fileId = res1.body.file.id;

  const res2 = await request(app)
    .get(`/api/upload/files/${fileId}`).set('Authorization', `Bearer ${token}`);
  expect(res2.status).toBe(200);
  expect(res2.body.file.id).toBe(fileId);
  expect(res2.body.claims).toBeDefined();

  if (fs.existsSync(file)) fs.unlinkSync(file);
});
```

---

### Task 7: Update Frontend Upload API Service

**Files:**
- Modify: `frontend/src/services/upload.api.js`

- [ ] **Add `getFileById` method**

```js
getFileById: (id) => api.get(`/upload/files/${id}`),
uploadWithSupersedes: (type, file, supersedesId) => {
  const formData = new FormData();
  formData.append('file', file);
  if (supersedesId) formData.append('supersedes', supersedesId);
  return api.post(`/upload/${type}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
},
```

---

### Task 8: Add Correction Column to File List

**Files:**
- Modify: `frontend/src/pages/Upload.jsx`

- [ ] **Add a "Correction" column to the file table**

Between "Status" and "Uploaded" columns (line 78):

```jsx
<th>Correction</th>
```

In the table body, add a new cell after the StatusBadge:

```jsx
<td style={{ fontSize: '0.8125rem' }}>
  {f.supersedes ? (
    <span style={{ color: 'var(--color-warning)' }}>
      Corrects <Link to={`/files/${f.supersedes.id}`} style={{ textDecoration: 'underline' }}>
        {f.supersedes.filename}
      </Link>
    </span>
  ) : f.superseded_by ? (
    <span style={{ color: 'var(--text-secondary)' }}>Replaced</span>
  ) : (
    <span style={{ color: 'var(--text-secondary)' }}>—</span>
  )}
</td>
```

Add `Link` import:
```jsx
import { Link } from 'react-router-dom';
```

---

### Task 9: Create File Detail Page

**Files:**
- Create: `frontend/src/pages/FileDetail.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Create FileDetail page**

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { uploadApi } from '../services/upload.api';
import StatusBadge from '../components/StatusBadge';

export default function FileDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    uploadApi.getFileById(id).then(res => {
      setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page" style={{ textAlign: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>;
  if (!data) return <div className="page"><p>File not found.</p></div>;

  const { file, claims, remittances } = data;

  return (
    <div className="page">
      <Link to="/upload" style={{ fontSize: '0.875rem', color: 'var(--color-primary)', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Files</Link>
      <h2 className="page-title" style={{ fontFamily: 'monospace' }}>{file.filename}</h2>

      <div className="chart-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">File Info</div>
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>Type</td><td>{file.file_type}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Status</td><td><StatusBadge status={file.status} /></td></tr>
              <tr><td style={{ fontWeight: 600 }}>Uploaded</td><td>{file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : '—'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Size</td><td>{file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : '—'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Content Hash</td><td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{file.content_hash || '—'}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">Correction Chain</div>
          <table className="table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Supersedes</td>
                <td>
                  {file.supersedes ? (
                    <Link to={`/files/${file.supersedes.id}`}>{file.supersedes.filename}</Link>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Superseded By</td>
                <td>
                  {file.superseded_by ? (
                    <Link to={`/files/${file.superseded_by.id}`}>{file.superseded_by.filename}</Link>
                  ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {claims.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Claims ({claims.length})</div>
          <table className="table">
            <thead><tr><th>Claim ID</th><th>Patient</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/claims/${c.id}`} style={{ fontFamily: 'monospace' }}>{c.claim_id}</Link></td>
                  <td>{c.patient_first_name} {c.patient_last_name}</td>
                  <td>${c.total_charge || '0'}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remittances.length > 0 && (
        <div className="card">
          <div className="card-header">Remittances ({remittances.length})</div>
          <table className="table">
            <thead><tr><th>Claim ID</th><th>Patient</th><th>Paid</th><th>Status</th></tr></thead>
            <tbody>
              {remittances.map(r => (
                <tr key={r.id}>
                  <td><Link to={`/remittances/${r.id}`} style={{ fontFamily: 'monospace' }}>{r.payer_claim_id}</Link></td>
                  <td>{r.patient_name}</td>
                  <td>${r.total_paid || '0'}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Add route in App.jsx**

```jsx
import FileDetail from './pages/FileDetail';
```

Add route inside the `<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>` block:
```jsx
<Route path="/files/:id" element={<FileDetail />} />
```

---

### Task 10: Add Correction Dropdown to Upload Form

**Files:**
- Modify: `frontend/src/pages/Upload.jsx`
- Modify: `frontend/src/services/upload.api.js` (already updated in Task 7)

- [ ] **Add a "This file corrects" dropdown per upload zone**

Add state for the selected supersedes mapping:
```jsx
const [supersedes, setSupersedes] = useState({ '837': '', '835': '' });
```

Add a `useEffect` to fetch files for the dropdown when the page loads (within `fetchFiles` or separate). Since we already have `files` state, we can create filtered lists:

```jsx
const supersedesOptions = (type) =>
  files.filter(f => f.file_type === type && f.status === 'parsed' && !f.superseded_by)
    .map(f => ({ id: f.id, filename: f.filename, uploaded_at: f.uploaded_at }));
```

Update `handleUpload` to pass `supersedes` value:
```jsx
const res = await uploadApi.uploadWithSupersedes(type, file, supersedes[type] || undefined);
```

Add the dropdown inside each upload zone div, after the `<FileUploadZone>`:

```jsx
{supersedesOptions('837').length > 0 && (
  <div style={{ marginTop: '0.5rem' }}>
    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
      This file corrects:
    </label>
    <select className="form-input" value={supersedes['837']}
      onChange={e => setSupersedes(s => ({ ...s, '837': e.target.value }))}
      style={{ fontSize: '0.75rem', width: '100%' }}>
      <option value="">— No correction —</option>
      {supersedesOptions('837').map(f => (
        <option key={f.id} value={f.id}>{f.filename} ({new Date(f.uploaded_at).toLocaleDateString()})</option>
      ))}
    </select>
  </div>
)}
```

Repeat the same dropdown for the `'835'` type.

Also update `handleUpload` to clear the supersedes selection after upload:
```jsx
setSupersedes(s => ({ ...s, [type]: '' }));
```
