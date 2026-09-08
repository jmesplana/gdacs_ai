import Redis from 'ioredis';

let redis;

function getRedis() {
  if (!redis && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    redis.on('error', () => {}); // suppress unhandled rejections in serverless
  }
  return redis;
}

const RATE_LIMIT = 100;
const WINDOW_SECS = 3600; // 1 hour
const localWindows = new Map();

function localAllowed(key, limit, windowSecs) {
  const now = Date.now();
  if (localWindows.size >= 10000) {
    for (const [id, entry] of localWindows) if (entry.expires <= now) localWindows.delete(id);
    if (localWindows.size >= 10000 && !localWindows.has(key)) return false;
  }
  const current = localWindows.get(key);
  const entry = current && current.expires > now ? current : { count: 0, expires: now + windowSecs * 1000 };
  entry.count += 1;
  localWindows.set(key, entry);
  return entry.count <= limit;
}

export function withRateLimit(handler, options = {}) {
  return async (req, res) => {
    const limit = options.limit || RATE_LIMIT;
    const windowSecs = options.windowSecs || WINDOW_SECS;
    const keyPrefix = options.keyPrefix || 'rl';
    const client = getRedis();
    const forwarded = process.env.VERCEL ? req.headers['x-forwarded-for'] : null;
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}:${Math.floor(Date.now() / (windowSecs * 1000))}`;
    let distributedLimitChecked = false;

    if (client) {

      try {
        const count = await client.incr(key);
        if (count === 1) {
          await client.expire(key, windowSecs);
        }
        if (count > limit) {
          return res.status(429).json({
            error: 'Too many requests. Please try again in an hour.',
          });
        }
        distributedLimitChecked = true;
      } catch {
        // The per-process fallback is bounded; shared quotas still require Redis.
      }
    }

    if (!distributedLimitChecked && !localAllowed(key, limit, windowSecs)) {
      res.setHeader('Retry-After', String(windowSecs));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    return handler(req, res);
  };
}
