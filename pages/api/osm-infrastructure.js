/**
 * OSM Infrastructure Query Endpoint
 * Fetches infrastructure data from Overpass API based on boundary geometry
 * Implements automatic query subdivision, caching, and error recovery
 */

const {
  buildOverpassQuery,
  filterToPolygon,
  convertToGeoJSON,
  categorizeInfrastructure,
  calculateAreaKm2,
  subdivideBoundary,
  deduplicateFeatures,
  countByLayer,
  generateCacheKey,
  calculateBoundingBox,
} = require('../../lib/osmHelpers');
const { getCachedOSM, setCachedOSM } = require('../../lib/osmCache');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const MAX_BOUNDARY_AREA_KM2 = 10000; // Subdivide if larger
const CACHE_TTL_HOURS = 24;
const OVERPASS_TIMEOUT_MS = 45000;
const MAX_RETRIES = 2;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests allowed' }
    });
  }

  const { boundary, layers = [], options = {} } = req.body;

  // Validation
  if (!boundary || !boundary.coordinates) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_BOUNDARY',
        message: 'Valid GeoJSON boundary required',
        details: { received: typeof boundary }
      }
    });
  }

  if (!layers || layers.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_LAYERS',
        message: 'At least one layer must be specified'
      }
    });
  }

  // Check cache first
  const cacheKey = generateCacheKey(boundary, layers, options);
  const cached = await getCachedOSM(cacheKey);
  if (cached && !options.forceRefresh) {
    console.log('OSM cache hit:', cacheKey);
    return res.status(200).json({
      success: true,
      data: { ...cached, metadata: { ...cached.metadata, cached: true } }
    });
  }

  try {
    const startTime = Date.now();

    // Calculate area and decide on subdivision
    const area = calculateAreaKm2(boundary);
    console.log(`OSM Query: ${area.toFixed(2)} km²`);

    if (area > 150000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BOUNDARY_TOO_LARGE',
          message: `Selected area is too large: ${Math.round(area).toLocaleString()} km² (max 150,000 km²). Try selecting a smaller region or individual districts instead of the entire country.`,
          details: { area: Math.round(area), maxArea: 150000 }
        }
      });
    }

    const subdivisions = area > MAX_BOUNDARY_AREA_KM2
      ? subdivideBoundary(boundary, MAX_BOUNDARY_AREA_KM2)
      : [boundary];

    console.log(`OSM subdivisions: ${subdivisions.length}`);

    // Execute queries (sequential to avoid overwhelming Overpass API)
    const allFeatures = [];
    const errors = [];

    for (const subBoundary of subdivisions) {
      try {
        const features = await queryOverpassWithRetry(subBoundary, layers, options);
        allFeatures.push(...features);
      } catch (err) {
        console.error('Subdivision query failed:', err.message);
        errors.push({ boundary: subBoundary, error: err.message });
      }
    }

    // If all subdivisions failed, try to return stale cache
    if (errors.length === subdivisions.length) {
      const staleCache = await getCachedOSM(cacheKey, true);
      if (staleCache) {
        console.log('All queries failed, returning stale cache');
        return res.status(200).json({
          success: true,
          data: { ...staleCache, metadata: { ...staleCache.metadata, stale: true } },
          warning: 'Using cached data due to query failure'
        });
      }
      throw new Error('All OSM queries failed');
    }

    // Log partial success
    if (errors.length > 0) {
      console.log(`⚠️ Partial success: ${allFeatures.length} features from ${subdivisions.length - errors.length}/${subdivisions.length} subdivisions`);
    }

    // Check if we got any features
    if (allFeatures.length === 0) {
      throw new Error('No OSM features retrieved');
    }

    // Deduplicate features (same OSM ID might appear in multiple subdivisions)
    const deduped = deduplicateFeatures(allFeatures);

    // Filter to exact boundary (subdivisions may overlap)
    const filtered = filterToPolygon(deduped, boundary);

    // Categorize and format
    const categorized = categorizeInfrastructure(filtered);

    // Build response
    const response = {
      type: 'FeatureCollection',
      features: categorized,
      metadata: {
        queryTime: Date.now() - startTime,
        totalFeatures: categorized.length,
        byLayer: countByLayer(categorized),
        boundingBox: calculateBoundingBox(boundary),
        querySubdivisions: subdivisions.length,
        cached: false,
        timestamp: new Date().toISOString(),
        partialFailures: errors.length
      }
    };

    // Cache result
    await setCachedOSM(cacheKey, response, CACHE_TTL_HOURS);

    console.log(`OSM query complete: ${categorized.length} features in ${Date.now() - startTime}ms`);

    return res.status(200).json({ success: true, data: response });

  } catch (error) {
    console.error('OSM Infrastructure Error:', error);

    // Try to return stale cache if available
    const staleCache = await getCachedOSM(cacheKey, true);
    if (staleCache) {
      return res.status(200).json({
        success: true,
        data: { ...staleCache, metadata: { ...staleCache.metadata, stale: true } },
        warning: 'Using cached data due to query failure'
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: error.code || 'QUERY_FAILED',
        message: 'Failed to fetch OSM infrastructure data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
}

/**
 * Query Overpass API with automatic retry and endpoint failover
 */
async function queryOverpassWithRetry(boundary, layers, options, retries = 0) {
  const endpoint = OVERPASS_ENDPOINTS[retries % OVERPASS_ENDPOINTS.length];
  const query = buildOverpassQuery(boundary, layers, options);

  console.log(`Querying Overpass (attempt ${retries + 1}): ${endpoint}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: query,
      signal: controller.signal,
      headers: { 'Content-Type': 'text/plain' }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 30;
        const error = new Error('Rate limited');
        error.code = 'RATE_LIMIT';
        error.retryAfter = retryAfter;
        throw error;
      }
      if (response.status === 504) {
        const error = new Error('Overpass timeout');
        error.code = 'OVERPASS_TIMEOUT';
        throw error;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.elements) {
      console.warn('No elements in Overpass response');
      return [];
    }

    console.log(`Overpass returned ${data.elements.length} elements`);
    return convertToGeoJSON(data.elements);

  } catch (error) {
    console.error(`Overpass query error (attempt ${retries + 1}):`, error.message);

    if (retries < MAX_RETRIES) {
      // Wait before retry (exponential backoff)
      const delay = 1000 * (retries + 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return queryOverpassWithRetry(boundary, layers, options, retries + 1);
    }

    throw error;
  }
}

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
