const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { sequelize, User } = require('./models');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  const admin = await User.findOne({ where: { username: 'admin' } });
  if (!admin) {
    await User.create({ username: 'admin', email: 'admin@denials.local', password_hash: 'admin123', role: 'admin' });
    logger.info('Default admin user created (admin / admin123)');
  }
}

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    await sequelize.sync();
    logger.info('Database models synchronized');

    await seedAdmin();

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

      // Start EDI queue worker
      const { startWorker } = require('./queue/ediWorker');
      startWorker();
    }

    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        sequelize.close().then(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10000);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
