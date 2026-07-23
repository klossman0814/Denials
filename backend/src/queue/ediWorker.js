const config = require('../config/env');
const uploadService = require('../services/upload.service');
const logger = require('../utils/logger');

const WORKER_CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY, 10) || 3;
const REMATCH_INTERVAL = parseInt(process.env.REMATCH_INTERVAL_MS, 10) || 300000;

function startWorker() {
  if (config.nodeEnv === 'test') {
    logger.info('EDI worker: skipping (test mode)');
    return;
  }

  const ediQueue = require('./ediQueue');
  if (!ediQueue) {
    logger.info('EDI worker: not started (Bull queue not available)');
    return;
  }

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
        throw error;
      }
      logger.error(`Worker failed: ${filePath} — ${error.message}`);
      throw error;
    }
  });

  const rematchTimer = setInterval(async () => {
    try {
      await uploadService._rematchUnlinkedRemittances();
    } catch (err) {
      logger.error(`Rematch job failed: ${err.message}`);
    }
  }, REMATCH_INTERVAL);

  process.on('SIGTERM', () => clearInterval(rematchTimer));
  process.on('SIGINT', () => clearInterval(rematchTimer));

  logger.info(`EDI worker started (concurrency: ${WORKER_CONCURRENCY}, rematch: ${REMATCH_INTERVAL}ms)`);
}

module.exports = { startWorker };