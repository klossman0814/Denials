## Task 7: Async File Processing Queue

**Files:** Create: `backend/src/queue/ediQueue.js`, `backend/src/queue/ediWorker.js`; Modify: `backend/src/controllers/upload.controller.js`, `backend/src/config/env.js`, `backend/src/server.js`, `docker-compose.yml`, `backend/package.json`

**Interfaces:**
- Consumes: File path + type from upload controller
- Produces: Background job processes file, updates DB status independently

- [ ] **Step 1: Add Bull dependency**

```bash
cd backend && npm install bull
```

- [ ] **Step 2: Add Redis config to env.js**

Read `backend/src/config/env.js`, add a `redis` section:

```js
redis: {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
},
```

- [ ] **Step 3: Create ediQueue.js**

Create `backend/src/queue/ediQueue.js`:

```js
const Queue = require('bull');
const config = require('../config/env');

const ediQueue = new Queue('edi-processing', config.redis.url, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

ediQueue.on('error', (error) => {
  logger.error(`EDI queue error: ${error.message}`);
});

const logger = require('../utils/logger');

module.exports = ediQueue;
```

Add `const logger = require('../utils/logger');` at the top of the file (before queue creation) to avoid hoisting issues:

```js
const Queue = require('bull');
const config = require('../config/env');
const logger = require('../utils/logger');
```

- [ ] **Step 4: Create ediWorker.js**

Create `backend/src/queue/ediWorker.js`:

```js
const config = require('../config/env');
const uploadService = require('../services/upload.service');
const logger = require('../utils/logger');

function startWorker() {
  // Only start if not in test mode
  if (config.nodeEnv === 'test') {
    logger.info('EDI worker: skipping (test mode)');
    return;
  }

  const ediQueue = require('./ediQueue');

  ediQueue.process(async (job) => {
    const { filePath, fileType, uploadedBy } = job.data;
    logger.info(`Worker processing: ${filePath} (${fileType})`);

    try {
      const result = await uploadService.processFile(filePath, fileType, uploadedBy);
      logger.info(`Worker completed: ${filePath} — ${result.recordsCreated} records`);
      return result;
    } catch (error) {
      logger.error(`Worker failed: ${filePath} — ${error.message}`);
      throw error;
    }
  });

  logger.info('EDI worker started');
}

module.exports = { startWorker };
```

- [ ] **Step 5: Update upload.controller.js**

Read `backend/src/controllers/upload.controller.js`.

Replace the `uploadFile` function to enqueue a job instead of processing synchronously:

```js
const ediQueue = require('../queue/ediQueue');

exports.uploadFile = async (req, res, next) => {
  try {
    const fileType = req.params.type;
    if (!['837', '835'].includes(fileType)) return res.status(400).json({ error: 'Invalid file type' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Create initial file record in 'queued' status
    const { UploadedFile } = require('../models');
    const fs = require('fs');
    const crypto = require('crypto');
    const content = fs.readFileSync(req.file.path, 'utf8');
    const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    const fileRecord = await UploadedFile.create({
      filename: req.file.filename || req.file.originalname,
      file_type: fileType,
      file_path: req.file.path,
      file_size: req.file.size,
      content_hash: contentHash,
      status: 'queued',
      uploaded_by: req.user?.id || null,
    });

    // Enqueue processing job
    await ediQueue.add({
      filePath: req.file.path,
      fileType,
      uploadedBy: req.user?.id || null,
    });

    res.status(202).json({
      message: 'File queued for processing',
      file: fileRecord,
    });
  } catch (error) { next(error); }
};
```

- [ ] **Step 6: Update server.js**

Read `backend/src/server.js`.

After starting the file watcher and before starting the HTTP server, add worker startup:

```js
// Start EDI worker
const { startWorker } = require('./queue/ediWorker');
startWorker();
```

Place this right after `startWatcher(dir837, dir835);` and before `const server = app.listen(...)`.

- [ ] **Step 7: Update docker-compose.yml**

Read and edit `docker-compose.yml`. Add a Redis service before the `backend` service:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

Add `redis_data` to the `volumes:` section at the bottom:

```yaml
  redis_data:
```

Make the `backend` service depend on Redis:

```yaml
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
```

- [ ] **Step 8: Verify syntax**

Run: `cd backend && node -e "
  const q = require('./src/queue/ediQueue');
  const w = require('./src/queue/ediWorker');
  console.log('Queue and worker modules OK');
"`

- [ ] **Step 9: Commit**

```bash
git add backend/src/queue/ backend/src/controllers/upload.controller.js backend/src/config/env.js backend/src/server.js docker-compose.yml backend/package.json
git commit -m "perf: async EDI file processing via Bull queue and Redis worker"
```

---
