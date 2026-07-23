# Concurrent EDI Processing with 837/835 Dependency Handling

> **For agentic workers:** Sub-tasks use checkbox (`- [ ]`) syntax.

**Goal:** Allow multiple 837/835 files to process in parallel while ensuring 835 remittances are matched to claims from their corresponding 837 files.

**Architecture:** Increase Bull queue concurrency from 1 to 3. Add retry logic in 835 processing — when no claims match, defer via retry with exponential backoff. Add a periodic rematch job to clean up unlinked remittances.

**Tech Stack:** Node.js/Express, Bull + Redis, Sequelize/PostgreSQL

---
## Global Constraints
- Follow existing code style (no comments unless asked, CommonJS requires)
- Only modify or create files listed in this plan
- Queue concurrency should be configurable via env var (default 3)
- Retry backoff: 30s, 1m, 2m, 4m (max 4 retries)
- Periodic rematch runs every 5 minutes

---

### Task 1: Increase Bull Queue Concurrency

**Files:**
- Modify: `backend/src/queue/ediWorker.js`

- [ ] **Make concurrency configurable**

At the top of `ediWorker.js`, after the requires, add:
```js
const WORKER_CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY, 10) || 3;
```

- [ ] **Set concurrency on queue processor**

Change line 17 from:
```js
ediQueue.process(async (job) => {
```
to:
```js
ediQueue.process(WORKER_CONCURRENCY, async (job) => {
```

---

### Task 2: Deferred Matching — Retry 835 Jobs When Claims Are Missing

**Files:**
- Modify: `backend/src/services/upload.service.js`
- Modify: `backend/src/queue/ediWorker.js`

- [ ] **Add retry detection to 835 processing**

In `upload.service.js`, modify `_process835` to track whether any remittances found a claim match.

After the remittance loop (after line ~163 in the current file, where `match` is used), add logic at the end of `_process835`:

```js
if (remittanceRecords.length > 0 && remittanceRecords.every(r => !r.claim_id)) {
  // No claims found for any remittance in this file — signal retry
  return { count: 0, retry: true };
}
```

At the end of `_process835`, change the return from:
```js
return { count };
```
to:
```js
return { count, retry: remittanceRecords.length > 0 && remittanceRecords.every(r => !r.claim_id) };
```

- [ ] **Handle retry signal in processFile**

In `processFile()`, after the parse result comes back (line ~43-45), add retry handling:

```js
let result;
if (fileType === '837') result = await this._process837(content, fileRecord.id);
else result = await this._process835(content, fileRecord.id);

if (result.retry) {
  // No claims found — delete the file record and signal retry
  await fileRecord.destroy();
  throw new RetryableError('835 file deferred: no matching claims found');
}
```

Define the `RetryableError` class at the top of the file (after the requires):
```js
class RetryableError extends Error {
  constructor(message) { super(message); this.retryable = true; }
}
```

- [ ] **Update the worker to only retry on RetryableError**

In `ediWorker.js`, modify the process handler:

```js
ediQueue.process(WORKER_CONCURRENCY, async (job) => {
  const { filePath, fileType, uploadedBy } = job.data;
  logger.info(`Worker processing: ${filePath} (${fileType})`);

  try {
    const result = await uploadService.processFile(filePath, fileType, uploadedBy);
    logger.info(`Worker completed: ${filePath} — ${result.recordsCreated} records`);
    return result;
  } catch (error) {
    if (error.retryable) {
      logger.warn(`Worker deferring: ${filePath} — ${error.message}`);
      throw error; // Bull will retry per job options
    }
    logger.error(`Worker failed: ${filePath} — ${error.message}`);
    throw error;
  }
});
```

- [ ] **Configure Bull job retry options**

In `ediQueue.js`, update the default job options to include retry with backoff:

```js
defaultJobOptions: {
  attempts: 5,
  backoff: { type: 'exponential', delay: 30000 },
  removeOnComplete: 100,
  removeOnFail: 50,
},
```

This means:
- Attempt 1: initial try
- Attempt 2: 30s later
- Attempt 3: 1m later (30s * 2)
- Attempt 4: 2m later (30s * 4)
- Attempt 5: 4m later (30s * 8)
- After 5 attempts: job fails permanently

---

### Task 3: Periodic Rematch Job for Unlinked Remittances

**Files:**
- Modify: `backend/src/services/upload.service.js`
- Modify: `backend/src/queue/ediWorker.js`

- [ ] **Add `_rematchUnlinkedRemittances` method**

In `upload.service.js`, add after `_markSupersededRecords`:

```js
async _rematchUnlinkedRemittances() {
  const unlinked = await Remittance.findAll({
    where: { claim_id: null },
    include: [{ model: UploadedFile, where: { file_type: '835' }, attributes: [] }],
  });
  let matched = 0;
  for (const remit of unlinked) {
    const claim = await this._matchClaim(remit.patient_name, remit.payer_claim_id);
    if (claim) {
      remit.claim_id = claim.id;
      await remit.save();
      matched++;
    }
  }
  if (matched > 0) {
    logger.info(`Rematch job: linked ${matched}/${unlinked.length} previously unlinked remittances`);
  }
  return matched;
}
```

- [ ] **Start periodic rematch job in worker**

In `ediWorker.js`, at the bottom of `startWorker()`, add:

```js
const REMATCH_INTERVAL = parseInt(process.env.REMATCH_INTERVAL_MS, 10) || 300000;

const rematchTimer = setInterval(async () => {
  try {
    await uploadService._rematchUnlinkedRemittances();
  } catch (err) {
    logger.error(`Rematch job failed: ${err.message}`);
  }
}, REMATCH_INTERVAL);

// Clean up timer on shutdown
process.on('SIGTERM', () => clearInterval(rematchTimer));
process.on('SIGINT', () => clearInterval(rematchTimer));
```

---

### Task 4: Add `.env` Variables

**Files:**
- Modify: `backend/.env`

- [ ] **Add queue concurrency and rematch interval to env**

```
QUEUE_CONCURRENCY=3
REMATCH_INTERVAL_MS=300000
```

---

### Files Modified Summary

| File | Changes |
|------|---------|
| `backend/src/queue/ediWorker.js` | Add concurrency param; handle retryable errors; start rematch timer |
| `backend/src/queue/ediQueue.js` | Increase retry attempts, add exponential backoff |
| `backend/src/services/upload.service.js` | Add `RetryableError` class; retry logic in `_process835`/`processFile`; `_rematchUnlinkedRemittances` method |
| `backend/.env` | Add `QUEUE_CONCURRENCY` and `REMATCH_INTERVAL_MS` |
