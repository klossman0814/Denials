const chokidar = require('chokidar');
const path = require('path');
const uploadService = require('../services/upload.service');
const ediQueue = require('../queue/ediQueue');
const logger = require('../utils/logger');

let watcher = null;

function startWatcher(dir837, dir835) {
  const resolved837 = path.resolve(dir837);
  const resolved835 = path.resolve(dir835);

  watcher = chokidar.watch([resolved837, resolved835], {
    ignored: /(^|[\\/])\\../,
    persistent: true,
    ignoreInitial: false,
    usePolling: true,
    interval: 3000,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });

  watcher
    .on('add', async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const dir = path.dirname(filePath);
      let fileType = null;

      // Use path.relative() for case-insensitive comparison on Windows
      // Also correctly handles files in subdirectories of the watched dir
      const rel837 = path.relative(resolved837, dir);
      const rel835 = path.relative(resolved835, dir);
      const in837dir = rel837 === '' || (!rel837.startsWith('..') && !path.isAbsolute(rel837));
      const in835dir = rel835 === '' || (!rel835.startsWith('..') && !path.isAbsolute(rel835));

      if (in837dir && (ext === '.837' || ext === '.edi' || ext === '.txt' || ext === '.bak')) fileType = '837';
      else if (in835dir && (ext === '.835' || ext === '.era' || ext === '.edi' || ext === '.txt' || ext === '.dat')) fileType = '835';

      if (fileType) {
        logger.info(`File detected: ${filePath} (type: ${fileType})`);
        if (ediQueue) {
          await ediQueue.add({ filePath, fileType, uploadedBy: null });
          logger.info(`File queued for processing: ${filePath}`);
        } else {
          try { await uploadService.processFile(filePath, fileType); }
          catch (error) { logger.error(`Auto-processing failed for ${filePath}: ${error.message}`); }
        }
      }
    })
    .on('error', (error) => logger.error(`File watcher error: ${error.message}`));

  logger.info(`File watcher started (polling mode): watching ${resolved837} and ${resolved835}`);
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
