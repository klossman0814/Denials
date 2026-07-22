const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path}: ${err.message}`, { stack: err.stack });

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.errors.map((e) => e.message) });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};

module.exports = errorMiddleware;
