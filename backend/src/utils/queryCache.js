class QueryCache {
  constructor() {
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = 300000) {
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern) {
    for (const key of this._store.keys()) {
      if (key.startsWith(pattern)) this._store.delete(key);
    }
  }

  size() {
    return this._store.size;
  }
}

module.exports = new QueryCache();