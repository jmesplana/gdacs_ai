import { withRateLimit } from '../../lib/rateLimit';
/**
 * Weather Forecast API with Server-Side Caching
 * Uses Open-Meteo (FREE, no API key) + optional Vercel KV cache
 */

import { PREDICTION_CONFIG } from '../../config/predictionConfig';

// Try to use Vercel KV if available, otherwise use in-memory cache
let kv = null;
const hasKvEnv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

if (hasKvEnv) {
  try {
    kv = require('@vercel/kv').kv;
  } catch (error) {
    console.warn('Vercel KV package unavailable, using in-memory cache');
  }
} else {
  console.log('Vercel KV env vars not set, using in-memory weather cache');
}

// Fallback in-memory cache (for development)
const memoryCache = new Map();

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { latitude, longitude, days = 7 } = req.method === 'GET' ? req.query : req.body;

  // Validate inputs
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Missing latitude or longitude' });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }

  const forecastDays = Math.min(parseInt(days) || 7, PREDICTION_CONFIG.weatherAPI.maxForecastDays);

  try {
    // Round coordinates to reduce cache misses (~11km grid)
    const roundedLat = Math.round(lat * 10) / 10;
    const roundedLng = Math.round(lng * 10) / 10;
    const cacheKey = `weather:${roundedLat}:${roundedLng}:${forecastDays}`;

    // Check cache
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        ...cached,
        cached: true,
        cacheKey,
        source: 'cache',
      });
    }

    // Fetch from Open-Meteo
    const weatherData = await fetchOpenMeteoWeather(roundedLat, roundedLng, forecastDays);

    // Cache for 6 hours
    const cacheSeconds = PREDICTION_CONFIG.weatherAPI.cacheHours * 3600;
    await saveToCache(cacheKey, weatherData, cacheSeconds);

    return res.status(200).json({
      ...weatherData,
      cached: false,
      cacheKey,
      source: 'open-meteo',
    });

  } catch (error) {
    console.error('Weather API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch weather data',
      message: error.message,
    });
  }
}

/**
 * Fetch weather from Open-Meteo (FREE, no API key)
 */
async function fetchOpenMeteoWeather(lat, lng, days) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'windspeed_10m_max',
      'relative_humidity_2m_mean',
    ].join(','),
    forecast_days: days,
    timezone: 'auto',
  });

  const url = `${PREDICTION_CONFIG.weatherAPI.baseURL}/forecast?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    daily: data.daily,
    units: {
      temperature: '°C',
      precipitation: 'mm',
      windspeed: 'km/h',
      humidity: '%',
    }
  };
}

/**
 * Get data from cache (Vercel KV or memory)
 */
async function getFromCache(key) {
  try {
    if (kv) {
      // Use Vercel KV
      return await kv.get(key);
    } else {
      // Use in-memory cache
      const cached = memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
      return null;
    }
  } catch (error) {
    console.warn('Cache read error:', error.message);
    return null;
  }
}

/**
 * Save data to cache
 */
async function saveToCache(key, data, expirySeconds) {
  try {
    if (kv) {
      // Use Vercel KV
      await kv.set(key, data, { ex: expirySeconds });
    } else {
      // Use in-memory cache
      memoryCache.set(key, {
        data,
        expiry: Date.now() + (expirySeconds * 1000),
      });

      // Cleanup old entries (keep cache size manageable)
      if (memoryCache.size > 1000) {
        const entriesToDelete = [];
        for (const [k, v] of memoryCache.entries()) {
          if (v.expiry < Date.now()) {
            entriesToDelete.push(k);
          }
        }
        entriesToDelete.forEach(k => memoryCache.delete(k));
      }
    }
  } catch (error) {
    console.warn('Cache write error:', error.message);
  }
}

export default withRateLimit(handler);
