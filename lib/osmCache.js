/**
 * OSM Data Caching
 * Redis-backed with in-memory fallback for graceful degradation
 */

let redis = null;
const memoryCache = new Map();
const MEMORY_CACHE_MAX_SIZE = 50; // Max entries in memory

// Try to initialize Redis (graceful degradation if unavailable)
if (process.env.REDIS_URL) {
  try {
    const { createClient } = require('redis');
    redis = createClient({ url: process.env.REDIS_URL });
    redis.connect().catch(err => {
      console.warn('Redis connection failed, using memory cache:', err.message);
      redis = null;
    });
  } catch (err) {
    console.warn('Redis not available, using memory cache');
  }
}

/**
 * Get cached OSM data
 * @param {string} key - Cache key
 * @param {boolean} allowStale - Return expired cache if available
 * @returns {Object|null} Cached data or null
 */
async function getCachedOSM(key, allowStale = false) {
  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const data = JSON.parse(cached);

        // Check expiry
        const age = Date.now() - new Date(data.metadata.timestamp).getTime();
        const ttl = data.metadata.ttl || 24 * 60 * 60 * 1000; // 24h default

        if (allowStale || age < ttl) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Redis GET error:', err.message);
    }
  }

  // Fallback to memory
  const cached = memoryCache.get(key);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const ttl = cached.ttl || 24 * 60 * 60 * 1000;

    if (allowStale || age < ttl) {
      return cached.data;
    } else {
      memoryCache.delete(key);
    }
  }

  return null;
}

/**
 * Set cached OSM data
 * @param {string} key - Cache key
 * @param {Object} data - Data to cache
 * @param {number} ttlHours - TTL in hours
 */
async function setCachedOSM(key, data, ttlHours = 24) {
  const ttlMs = ttlHours * 60 * 60 * 1000;

  // Add TTL to metadata
  const cachedData = {
    ...data,
    metadata: {
      ...data.metadata,
      ttl: ttlMs
    }
  };

  // Try Redis first
  if (redis) {
    try {
      await redis.setEx(
        key,
        ttlHours * 60 * 60, // seconds
        JSON.stringify(cachedData)
      );
      return;
    } catch (err) {
      console.warn('Redis SET error:', err.message);
    }
  }

  // Fallback to memory
  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    // Evict oldest entry (first key)
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }

  memoryCache.set(key, {
    data: cachedData,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

/**
 * Clear all OSM cache
 */
async function clearOSMCache() {
  if (redis) {
    try {
      const keys = await redis.keys('osm:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (err) {
      console.warn('Redis CLEAR error:', err.message);
    }
  }

  memoryCache.clear();
}

module.exports = {
  getCachedOSM,
  setCachedOSM,
  clearOSMCache,
};
