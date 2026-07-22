# Admin Data Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin endpoints and UI to delete 837 data, 835 data, and all uploaded file records.

**Architecture:** Three new admin-only DELETE endpoints in the backend, three new UI action buttons with confirmation dialogs in the admin panel.

**Tech Stack:** Express.js (backend), React (frontend), Sequelize (ORM)

## Global Constraints

- All delete endpoints require `authenticate` + `requireAdmin` middleware
- All operations are destructive — no undo
- Use Sequelize `destroy()` with `where` clauses

---

### Task 1: Backend Admin Controller & Routes

**Files:**
- Create: `backend/src/controllers/admin.controller.js`
- Modify: `backend/src/routes/admin.routes.js`

**Interfaces:**
- Consumes: Models from `../models` (Claim, ClaimLine, Remittance, DenialReason, UploadedFile, sequelize)
- Produces: Three route handlers mounted at `/api/admin/data/837`, `/api/admin/data/835`, `/api/admin/files`

- [ ] **Step 1: Create admin.controller.js**

```javascript
const { Op } = require('sequelize');
const { Claim, ClaimLine, Remittance, DenialReason, UploadedFile, sequelize } = require('../models');

/**
 * Delete all 837 data: claims, claim lines, denial reasons
 * from 837 files, plus any remittances linked to those claims,
 * plus the 837 uploaded file records.
 */
exports.delete837Data = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    // Find all 837 uploaded files
    const files837 = await UploadedFile.findAll({
      where: { file_type: '837' },
      attributes: ['id'],
      transaction: t,
    });
    const fileIds = files837.map(f => f.id);

    if (fileIds.length === 0) {
      await t.rollback();
      return res.json({ message: 'No 837 data to delete.', deleted: { claims: 0 } });
    }

    // Find claims from those files
    const claims = await Claim.findAll({
      where: { file_id: { [Op.in]: fileIds } },
      attributes: ['id'],
      transaction: t,
    });
    const claimIds = claims.map(c => c.id);

    // Delete denial reasons for those claims
    await DenialReason.destroy({
      where: { claim_id: { [Op.in]: claimIds } },
      transaction: t,
    });

    // Delete claim lines for those claims
    await ClaimLine.destroy({
      where: { claim_id: { [Op.in]: claimIds } },
      transaction: t,
    });

    // Delete remittances linked to those claims
    await DenialReason.destroy({
      where: { remittance_id: { [Op.ne]: null }, claim_id: { [Op.in]: claimIds } },
      transaction: t,
    });
    await Remittance.destroy({
      where: { claim_id: { [Op.in]: claimIds } },
      transaction: t,
    });

    // Delete the claims
    const deletedClaims = (await Claim.destroy({
      where: { id: { [Op.in]: claimIds } },
      transaction: t,
    }));

    // Delete the 837 uploaded file records
    await UploadedFile.destroy({
      where: { id: { [Op.in]: fileIds } },
      transaction: t,
    });

    await t.commit();
    res.json({ message: 'All 837 data deleted successfully.', deleted: { claims: deletedClaims } });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Delete all 835 data: remittances, their denial reasons,
 * plus the 835 uploaded file records.
 */
exports.delete835Data = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const files835 = await UploadedFile.findAll({
      where: { file_type: '835' },
      attributes: ['id'],
      transaction: t,
    });
    const fileIds = files835.map(f => f.id);

    if (fileIds.length === 0) {
      await t.rollback();
      return res.json({ message: 'No 835 data to delete.', deleted: { remittances: 0 } });
    }

    // Find remittances from those files
    const remittances = await Remittance.findAll({
      where: { file_id: { [Op.in]: fileIds } },
      attributes: ['id'],
      transaction: t,
    });
    const remittanceIds = remittances.map(r => r.id);

    // Delete denial reasons for those remittances
    await DenialReason.destroy({
      where: { remittance_id: { [Op.in]: remittanceIds } },
      transaction: t,
    });

    // Delete the remittances
    const deletedRemittances = await Remittance.destroy({
      where: { id: { [Op.in]: remittanceIds } },
      transaction: t,
    });

    // Delete the 835 uploaded file records
    await UploadedFile.destroy({
      where: { id: { [Op.in]: fileIds } },
      transaction: t,
    });

    await t.commit();
    res.json({ message: 'All 835 data deleted successfully.', deleted: { remittances: deletedRemittances } });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Clear all uploaded file records (data stays intact).
 */
exports.clearUploadedFiles = async (req, res, next) => {
  try {
    const deleted = await UploadedFile.destroy({ where: {} });
    res.json({ message: 'All uploaded file records cleared.', deleted: { files: deleted } });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Update admin.routes.js**

Modify to add the three new routes:

```javascript
const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { User } = require('../models');
const adminController = require('../controllers/admin.controller');

const router = Router();

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try { res.json({ users: await User.findAll({ attributes: { exclude: ['password_hash'] } }) }); }
  catch (error) { next(error); }
});

router.post('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await User.create({ username, email, password_hash: password, role: role || 'staff' });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (error) { next(error); }
});

// New data deletion endpoints
router.delete('/data/837', authenticate, requireAdmin, adminController.delete837Data);
router.delete('/data/835', authenticate, requireAdmin, adminController.delete835Data);
router.delete('/files', authenticate, requireAdmin, adminController.clearUploadedFiles);

module.exports = router;
```

- [ ] **Step 3: Verify backend compiles**

```bash
cd backend && node -e "require('./src/controllers/admin.controller'); console.log('Controller loads OK')"
```

### Task 2: Frontend Admin UI

**Files:**
- Modify: `frontend/src/pages/Admin.jsx`

**Interfaces:**
- Consumes: `api` from `../services/api`
- Produces: Three action buttons in a "Data Management" card

- [ ] **Step 1: Add Data Management section to Admin.jsx**

Add after the System Status card and before the closing `</div>`.

```jsx
      {/* Data Management */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">Data Management</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0 1rem' }}>
          These actions permanently delete data. They cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0 1rem 1rem' }}>
          <button
            className="btn btn-danger"
            onClick={() => handleDelete('837')}
            disabled={deleting === '837'}
          >
            {deleting === '837' ? 'Deleting...' : 'Delete All 837 Data'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleDelete('835')}
            disabled={deleting === '835'}
          >
            {deleting === '835' ? 'Deleting...' : 'Delete All 835 Data'}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleClearFiles}
            disabled={deleting === 'files'}
          >
            {deleting === 'files' ? 'Clearing...' : 'Clear Uploaded Files List'}
          </button>
        </div>
        {deleteMessage && (
          <div style={{ padding: '0 1rem 1rem', fontSize: '0.875rem', color: deleteMessage.includes('Error') ? '#e74c3c' : '#27ae60' }}>
            {deleteMessage}
          </div>
        )}
      </div>
```

- [ ] **Step 2: Add state and handlers**

Add to the top of the component (after the existing state declarations):

```javascript
  const [deleting, setDeleting] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
```

Add handler functions before the return:

```javascript
  const handleDelete = async (type) => {
    const label = type === '837' ? '837 claims' : '835 remittances';
    if (!window.confirm(`Are you sure you want to delete ALL ${label} data? This cannot be undone.`)) return;
    setDeleting(type);
    setDeleteMessage('');
    try {
      const res = await api.delete(`/admin/data/${type}`);
      setDeleteMessage(res.data.message || `All ${label} data deleted.`);
      // Refresh file list
      api.get('/upload/files').then(r => setFiles(r.data.files || [])).catch(() => setFiles([]));
    } catch (err) {
      setDeleteMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleting('');
    }
  };

  const handleClearFiles = async () => {
    if (!window.confirm('Are you sure you want to clear all uploaded file records? The claims/remittances data will remain but the file history will be lost. This cannot be undone.')) return;
    setDeleting('files');
    setDeleteMessage('');
    try {
      const res = await api.delete('/admin/files');
      setDeleteMessage(res.data.message || 'Uploaded files list cleared.');
      setFiles([]);
    } catch (err) {
      setDeleteMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDeleting('');
    }
  };
```

- [ ] **Step 3: Add btn-danger CSS style**

Check if there's already a `.btn-danger` style, if not add it to the CSS. Check the existing CSS file(s).

- [ ] **Step 4: Verify frontend builds**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
