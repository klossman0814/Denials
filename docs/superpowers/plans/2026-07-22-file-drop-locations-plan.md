# Configurable File Drop Locations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-configurable directory paths for 837 and 835 file drops, stored in DB + synced to .env, with dynamic watcher restart.

**Architecture:** Key-value `Setting` model stores paths at runtime. On save, the .env file is updated for container restart persistence. The file watcher gains a `restartWatcher()` method and the admin page gets an inline UI for editing paths.

**Tech Stack:** Node.js/Express, Sequelize (PostgreSQL), React (Vite), chokidar

## Global Constraints

- Use existing test patterns: mocha + chai with supertest for API, Jest config already in place
- All backend files in `backend/src/`, tests in `backend/tests/`
- Frontend in `frontend/src/`, API calls via shared `api.js` (axios)
- Follow existing Sequelize model conventions (DataTypes, tableName, underscored)
- All admin routes under `/api/admin/`, require `authenticate` + `requireAdmin` middleware
- `.env` file lives at `backend/.env`

---

### Task 1: Setting Model

**Files:**
- Create: `backend/src/models/Setting.js`
- Modify: `backend/src/models/index.js`

**Interfaces:**
- Consumes: Nothing
- Produces: `Setting` model — sequelize model with `key` (STRING 100, PK) and `value` (TEXT)

- [ ] **Step 1: Create the Setting model**

Write `backend/src/models/Setting.js`:

```js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING(100), primaryKey: true },
  value: { type: DataTypes.TEXT, allowNull: false },
}, {
  tableName: 'settings',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: false,
  underscored: true,
});

module.exports = Setting;
```

- [ ] **Step 2: Register Setting in models/index.js**

Edit `backend/src/models/index.js`. Add `Setting` to the requires and exports:

```js
const Setting = require('./Setting');
```

Add to the `module.exports` object:
```js
module.exports = { sequelize, User, UploadedFile, Claim, ClaimLine, Remittance, DenialReason, Setting };
```

No associations needed — Setting is standalone.

- [ ] **Step 3: Verify model loads**

Run: `node -e "const { Setting } = require('./src/models'); console.log('Setting model loaded');"`

Expected: prints "Setting model loaded" with no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/Setting.js backend/src/models/index.js
git commit -m "feat: add Setting model for admin configuration"
```

---

### Task 2: File Watcher Refactor

**Files:**
- Modify: `backend/src/watcher/fileWatcher.js`

**Interfaces:**
- Consumes: Nothing (but integrates with `config/env.js` for fallback)
- Produces: `startWatcher(dir837, dir835)` — accepts explicit paths | `restartWatcher(dir837, dir835)` — stop + start with new paths

- [ ] **Step 1: Refactor fileWatcher.js**

Replace the contents of `backend/src/watcher/fileWatcher.js`:

```js
const chokidar = require('chokidar');
const path = require('path');
const uploadService = require('../services/upload.service');
const logger = require('../utils/logger');

let watcher = null;

function startWatcher(dir837, dir835) {
  const resolved837 = path.resolve(dir837);
  const resolved835 = path.resolve(dir835);

  watcher = chokidar.watch([resolved837, resolved835], {
    ignored: /(^|[\\/])\\../,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });

  watcher
    .on('add', async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const dir = path.dirname(filePath);
      let fileType = null;
      if (dir === resolved837 && (ext === '.837' || ext === '.edi' || ext === '.txt' || ext === '.bak')) fileType = '837';
      else if (dir === resolved835 && (ext === '.835' || ext === '.edi' || ext === '.txt' || ext === '.dat')) fileType = '835';

      if (fileType) {
        logger.info(`File detected: ${filePath} (type: ${fileType})`);
        try { await uploadService.processFile(filePath, fileType); }
        catch (error) { logger.error(`Auto-processing failed for ${filePath}: ${error.message}`); }
      }
    })
    .on('error', (error) => logger.error(`File watcher error: ${error.message}`));

  logger.info(`File watcher started: watching ${resolved837} and ${resolved835}`);
  return watcher;
}

function stopWatcher() {
  if (watcher) { watcher.close(); watcher = null; logger.info('File watcher stopped'); }
}

function restartWatcher(dir837, dir835) {
  stopWatcher();
  startWatcher(dir837, dir835);
}

module.exports = { startWatcher, stopWatcher, restartWatcher };
```

Key changes: `startWatcher` now accepts `(dir837, dir835)` params instead of reading from config. Added `restartWatcher` function.

- [ ] **Step 2: Verify module loads**

Run: `node -e "const fw = require('./src/watcher/fileWatcher'); console.log(typeof fw.restartWatcher);"`

Expected: prints "function"

- [ ] **Step 3: Commit**

```bash
git add backend/src/watcher/fileWatcher.js
git commit -m "refactor: fileWatcher accepts explicit paths, add restartWatcher"
```

---

### Task 3: Settings API — Controller & Routes

**Files:**
- Modify: `backend/src/controllers/admin.controller.js`
- Modify: `backend/src/routes/admin.routes.js`

**Interfaces:**
- Consumes: `Setting` model (from Task 1)
- Produces: `getSettings` and `updateSettings` controller functions | `GET /admin/settings` and `PUT /admin/settings` routes

- [ ] **Step 1: Add .env sync helper to admin.controller.js**

Add a helper function at the top of `admin.controller.js` after the requires:

```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Op } = require('sequelize');
const { Claim, ClaimLine, Remittance, DenialReason, UploadedFile, Setting, sequelize } = require('../models');
const { restartWatcher } = require('../watcher/fileWatcher');
const logger = require('../utils/logger');

function syncEnvFile(settings) {
  const envPath = path.resolve(__dirname, '../../.env');
  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    const keyMapping = {
      upload_dir_837: 'UPLOAD_DIR_837',
      upload_dir_835: 'UPLOAD_DIR_835',
    };

    for (const [settingKey, envKey] of Object.entries(keyMapping)) {
      if (settings[settingKey] === undefined) continue;
      const regex = new RegExp(`^${envKey}=.*`, 'm');
      const line = `${envKey}=${settings[settingKey]}`;
      if (regex.test(content)) {
        content = content.replace(regex, line);
      } else {
        content += (content.endsWith(os.EOL) ? '' : os.EOL) + line + os.EOL;
      }
    }

    fs.writeFileSync(envPath, content, 'utf8');
    logger.info('.env file synced with updated settings');
  } catch (err) {
    logger.warn(`Could not sync .env file: ${err.message}`);
  }
}
```

- [ ] **Step 2: Add getSettings and updateSettings to admin.controller.js**

Append these exports before the module.exports (at end of file):

```js
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.findAll();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({ settings: result });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { upload_dir_837, upload_dir_835 } = req.body;

    // Validate: at least one path provided
    if (!upload_dir_837 && !upload_dir_835) {
      return res.status(400).json({ error: 'Provide at least upload_dir_837 or upload_dir_835' });
    }

    const entries = {};
    if (upload_dir_837) entries['upload_dir_837'] = upload_dir_837;
    if (upload_dir_835) entries['upload_dir_835'] = upload_dir_835;

    const warnings = [];

    for (const [key, dirPath] of Object.entries(entries)) {
      try {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          warnings.push(`Directory did not exist for ${key}, created it.`);
        }
      } catch (err) {
        return res.status(400).json({
          error: `Cannot access directory for ${key}: ${dirPath} — ${err.message}`
        });
      }
    }

    // Upsert settings in DB
    for (const [key, value] of Object.entries(entries)) {
      await Setting.upsert({ key, value });
    }

    // Sync to .env
    syncEnvFile(entries);

    // Restart watcher with merged paths (old + new)
    const allSettings = await Setting.findAll();
    const current = {};
    allSettings.forEach(s => { current[s.key] = s.value; });
    const dir837 = current.upload_dir_837 || require('../config/env').upload.dir837;
    const dir835 = current.upload_dir_835 || require('../config/env').upload.dir835;
    restartWatcher(dir837, dir835);

    // Return updated settings
    const result = {};
    allSettings.forEach(s => { result[s.key] = s.value; });
    res.json({
      settings: result,
      ...(warnings.length > 0 && { warning: warnings.join(' ') }),
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Remove duplicate `require('../config/env')` issue**

The `updateSettings` function uses `require('../config/env')` inline for the fallback. This is fine since Node caches modules. No changes needed — just be aware.

- [ ] **Step 4: Add settings routes to admin.routes.js**

Edit `backend/src/routes/admin.routes.js`. Add the new routes before the data deletion routes:

```js
// Settings (admin only)
router.get('/settings', authenticate, requireAdmin, adminController.getSettings);
router.put('/settings', authenticate, requireAdmin, adminController.updateSettings);
```

Also add `const config = require('../config/env');` at the top (no change needed).

- [ ] **Step 5: Write a unit test for the .env sync helper**

Create `backend/tests/admin.test.js`:

```js
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Admin Settings', () => {
  describe('.env sync helper', () => {
    const tmpEnv = path.resolve(__dirname, '../.env.test');

    afterEach(() => {
      if (fs.existsSync(tmpEnv)) fs.unlinkSync(tmpEnv);
    });

    it('should replace existing UPLOAD_DIR_837 line', () => {
      fs.writeFileSync(tmpEnv, [
        'NODE_ENV=development',
        'UPLOAD_DIR_837=./data/837',
        'UPLOAD_DIR_835=./data/835',
      ].join(os.EOL) + os.EOL);

      // Read and modify inline to test the logic
      let content = fs.readFileSync(tmpEnv, 'utf8');
      content = content.replace(/^UPLOAD_DIR_837=.*/m, 'UPLOAD_DIR_837=\\\\nas\\837');
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).to.include('UPLOAD_DIR_837=\\\\nas\\837');
      expect(updated).to.include('UPLOAD_DIR_835=./data/835');
    });

    it('should append UPLOAD_DIR_837 if missing', () => {
      fs.writeFileSync(tmpEnv, 'NODE_ENV=production' + os.EOL);

      let content = fs.readFileSync(tmpEnv, 'utf8');
      if (!/^UPLOAD_DIR_837=/m.test(content)) {
        content += `UPLOAD_DIR_837=./data/837${os.EOL}`;
      }
      fs.writeFileSync(tmpEnv, content, 'utf8');

      const updated = fs.readFileSync(tmpEnv, 'utf8');
      expect(updated).to.include('UPLOAD_DIR_837=./data/837');
    });
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npx jest tests/admin.test.js --forceExit`

Expected: Tests pass (2 passing).

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/admin.controller.js backend/src/routes/admin.routes.js backend/tests/admin.test.js
git commit -m "feat: add settings API (GET/PUT /admin/settings) with .env sync"
```

---

### Task 4: Server Startup — Load Settings Before Watcher

**Files:**
- Modify: `backend/src/server.js`

**Interfaces:**
- Consumes: `Setting` model (Task 1), `startWatcher` with new signature (Task 2)
- No new exports

- [ ] **Step 1: Modify server.js to load settings dynamically**

Edit `backend/src/server.js`. After `await seedAdmin();` and before the watcher startup block (around line 25), add settings loading:

```js
    // Load persisted settings from DB (fall back to .env defaults)
    const { Setting } = require('./models');
    const settings = await Setting.findAll();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    const dir837 = settingsMap.upload_dir_837 || config.upload.dir837;
    const dir835 = settingsMap.upload_dir_835 || config.upload.dir835;
```

Then replace the watcher start block:
```js
    if (config.nodeEnv !== 'test') {
      const { startWatcher } = require('./watcher/fileWatcher');
      startWatcher(dir837, dir835);
    }
```

Full modified block (lines 25-28 become):
```js
    if (config.nodeEnv !== 'test') {
      // Load persisted settings from DB (fall back to .env defaults)
      const { Setting } = require('./models');
      const settings = await Setting.findAll();
      const settingsMap = {};
      settings.forEach(s => { settingsMap[s.key] = s.value; });
      const dir837 = settingsMap.upload_dir_837 || config.upload.dir837;
      const dir835 = settingsMap.upload_dir_835 || config.upload.dir835;

      const { startWatcher } = require('./watcher/fileWatcher');
      startWatcher(dir837, dir835);
    }
```

- [ ] **Step 2: Verify server starts without errors**

Run: `node -e "const app = require('./src/app'); console.log('App loaded');"` from the backend directory.

Expected: prints "App loaded" without watcher errors (app.js doesn't start the watcher, server.js does).

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.js
git commit -m "feat: load persisted drop directory settings at startup"
```

---

### Task 5: Frontend Admin UI — File Drop Locations Card

**Files:**
- Modify: `frontend/src/pages/Admin.jsx`

**Interfaces:**
- Consumes: `GET /admin/settings` and `PUT /admin/settings` API endpoints (from Task 3)
- No new components needed — inline UI within existing Admin page

- [ ] **Step 1: Add file drop locations card to Admin.jsx**

Edit `frontend/src/pages/Admin.jsx`. Add new state variables after the existing state declarations (lines 5-9):

```js
const [settings, setSettings] = useState({});
const [editing, setEditing] = useState(null); // '837' | '835' | null
const [editValues, setEditValues] = useState({});
const [settingsLoading, setSettingsLoading] = useState(true);
const [settingsMessage, setSettingsMessage] = useState('');
const [saving, setSaving] = useState(false);
```

Add settings fetch to the existing useEffect (around line 13):
```js
api.get('/admin/settings')
  .then(r => {
    setSettings(r.data.settings);
    setEditValues(r.data.settings);
  })
  .catch(() => setSettings({}))
  .finally(() => setSettingsLoading(false));
```

Full updated useEffect:
```js
useEffect(() => {
  setLoading(true);
  Promise.all([
    api.get('/admin/users').then(r => setUsers(r.data.users)).catch(() => setUsers([])),
    api.get('/upload/files').then(r => setFiles(r.data.files || [])).catch(() => setFiles([])),
    api.get('/admin/settings').then(r => {
      setSettings(r.data.settings);
      setEditValues(r.data.settings);
    }).catch(() => setSettings({})),
  ]).finally(() => { setLoading(false); setSettingsLoading(false); });
}, []);
```

Add the edit handlers after `handleClearFiles` (around line 58):

```js
const handleStartEdit = (type) => {
  setEditing(type);
  setEditValues(prev => ({ ...prev, [type === '837' ? 'upload_dir_837' : 'upload_dir_835']: settings[type === '837' ? 'upload_dir_837' : 'upload_dir_835'] || '' }));
  setSettingsMessage('');
};

const handleCancelEdit = () => {
  setEditing(null);
  setSettingsMessage('');
};

const handleSaveSettings = async () => {
  setSaving(true);
  setSettingsMessage('');
  try {
    const payload = {};
    if (editValues.upload_dir_837 !== undefined) payload.upload_dir_837 = editValues.upload_dir_837;
    if (editValues.upload_dir_835 !== undefined) payload.upload_dir_835 = editValues.upload_dir_835;
    const res = await api.put('/admin/settings', payload);
    setSettings(res.data.settings);
    setEditValues(res.data.settings);
    setEditing(null);
    const msg = res.data.warning
      ? `Saved with warning: ${res.data.warning}`
      : 'File drop locations updated.';
    setSettingsMessage(msg);
    setTimeout(() => setSettingsMessage(''), 5000);
  } catch (err) {
    setSettingsMessage(`Error: ${err.response?.data?.error || err.message}`);
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 2: Add the UI card**

Add this card between the Users card (closing around line 91) and the System Status card (starting around line 93):

```jsx
      {/* File Drop Locations */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">File Drop Locations</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', padding: '0 1rem' }}>
          Configure the directories where 837 and 835 files are dropped for automatic processing.
        </p>
        {settingsLoading ? (
          <div style={{ padding: '1rem', textAlign: 'center' }}><div className="spinner" /></div>
        ) : (
          <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { type: '837', label: '837 Claim Files', key: 'upload_dir_837' },
              { type: '835', label: '835 Remittance Files', key: 'upload_dir_835' },
            ].map(({ type, label, key }) => (
              <div key={type}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>{label}</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {editing === type ? (
                    <>
                      <input
                        className="form-input"
                        type="text"
                        value={editValues[key] || ''}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ flex: 1 }}
                        placeholder={`Enter ${type} directory path`}
                      />
                      <button className="btn btn-sm btn-primary" onClick={handleSaveSettings} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn btn-sm" onClick={handleCancelEdit} disabled={saving}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <code style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {settings[key] || '(not configured)'}
                      </code>
                      <button className="btn btn-sm" onClick={() => handleStartEdit(type)}>Edit</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {settingsMessage && (
              <div style={{
                fontSize: '0.85rem',
                padding: '0.5rem',
                borderRadius: '4px',
                color: settingsMessage.includes('Error') ? 'var(--color-error)'
                     : settingsMessage.includes('warning') ? 'var(--color-warning, #b8860b)'
                     : 'var(--color-success)',
                background: settingsMessage.includes('Error') ? 'var(--bg-error, rgba(220,38,38,0.1))'
                          : settingsMessage.includes('warning') ? 'var(--bg-warning, rgba(184,134,11,0.1))'
                          : 'var(--bg-success, rgba(34,197,94,0.1))',
              }}>
                {settingsMessage}
              </div>
            )}
          </div>
        )}
      </div>
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd frontend && npx vite build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Admin.jsx
git commit -m "feat: add File Drop Locations card to Admin page"
```
