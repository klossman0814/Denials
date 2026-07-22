const config = require('../config/env');
const logger = require('../utils/logger');

let ediQueue = null;

try {
  const Queue = require('bull');
  ediQueue = new Queue('edi-processing', config.redis.url, {
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

  logger.info('EDI queue initialized');
} catch (err) {
  logger.warn(`Bull queue not available (${err.message}) — processing will be synchronous`);
}

module.exports = ediQueue;