const config = require('../config/env');
const uploadService = require('../services/upload.service');
const logger = require('../utils/logger');

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