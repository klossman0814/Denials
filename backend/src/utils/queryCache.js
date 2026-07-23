const Redis = require('ioredis');
const config = require('../config/env');
const logger = require('./logger');

class QueryCache {
  constructor() {
    this._store = new Map();
    this._redis = null;
    this._redisAvailable = false;

    try {
      if (config.redis.url) {
        this._redis = new Redis(config.redis.url, {
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
          enableOfflineQueue: false,
        });

        this._redis.on('ready', () => {
          this._redisAvailable = true;
          logger.info('Redis cache connected');
        });

        this._redis.on('error', (err) => {
          this._redisAvailable = false;
          logger.warn(`Redis cache error: ${err.message} — falling back to in-memory cache`);
        });

        this._redis.on('close', () => {
          this._redisAvailable = false;
        });

        this._redis.connect().catch((err) => {
          logger.warn(`Redis cache connection failed: ${err.message} — using in-memory cache`);
        });
      } else {
        logger.info('No Redis URL configured — using in-memory cache only');
      }
    } catch (err) {
      logger.warn(`Redis cache not available: ${err.message} — using in-memory cache');
    }
  }

  async get(key) {
    // Try Redis first
    if (this._redisAvailable && this._redis) {
      try {
        const value = await this._redis.get(`cache:${key}`);
        if (value !== null && value !== undefined) {
          return JSON.parse(value);
        }
      } catch (err) {
        logger.warn(`Redis get error: ${err.message}`);
      }
    }

    // Fall back to in-memory
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlMs = 300000) {
    // Set in Redis
    if (this._redisAvailable && this._redis) {
      try {
        await this._redis.set(`cache:${key}`, JSON.stringify(value), 'PX', ttlMs);
      } catch (err) {
        logger.warn(`Redis set error: ${err.message}`);
      }
    }

    // Always set in-memory as fallback
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async invalidate(pattern) {
    // Clear Redis keys matching pattern
    if (this._redisAvailable && this._redis) {
      try {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await this._redis.scan(
            cursor,
            'MATCH',
            `cache:${pattern}*`,
            'COUNT',
            100
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await this._redis.del(...keys);
          }
        } while (cursor !== '0');
      } catch (err) {
        logger.warn(`Redis invalidate error: ${err.message}`);
      }
    }

    // Clear in-memory cache
    for (const key of this._store.keys()) {
      if (key.startsWith(pattern)) this._store.delete(key);
    }
  }

  size() {
    return this._store.size;
  }
}

module.exports = new QueryCache();