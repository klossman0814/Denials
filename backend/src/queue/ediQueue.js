const Queue = require('bull');
const config = require('../config/env');
const logger = require('../utils/logger');

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

module.exports = ediQueue;