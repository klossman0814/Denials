const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5441,
    name: process.env.NODE_ENV === 'test' ? (process.env.DB_NAME || 'denials_test') : (process.env.DB_NAME || 'denials_db'),
    user: process.env.DB_USER || 'denials_user',
    password: process.env.DB_PASSWORD || 'denials_pass',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  upload: {
    dir837: process.env.UPLOAD_DIR_837 || './data/837',
    dir835: process.env.UPLOAD_DIR_835 || './data/835',
    processedDir837: process.env.PROCESSED_DIR_837 || './data/837_processed',
    processedDir835: process.env.PROCESSED_DIR_835 || './data/835_processed',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380',
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
