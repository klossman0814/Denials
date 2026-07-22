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
