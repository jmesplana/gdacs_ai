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

export function withRateLimit(handler, options = {}) {
  return async (req, res) => {
    const limit = options.limit || RATE_LIMIT;
    const windowSecs = options.windowSecs || WINDOW_SECS;
    const keyPrefix = options.keyPrefix || 'rl';
    const client = getRedis();

    if (client) {
      const ip =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        '127.0.0.1';

      const window = Math.floor(Date.now() / (windowSecs * 1000));
      const key = `${keyPrefix}:${ip}:${window}`;

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
      } catch {
        // Redis unavailable — fail open so the app keeps working
      }
    }

    return handler(req, res);
  };
}
