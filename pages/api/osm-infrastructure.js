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
  optimizeInfrastructureResponse,
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
const MAX_RETRIES = 1;

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
    if ((cached.features || []).length > 0) {
      console.log('OSM cache hit:', cacheKey);
      return res.status(200).json({
        success: true,
        data: { ...cached, metadata: { ...cached.metadata, cached: true } }
      });
    }

    console.log('OSM cache contained empty result, refetching:', cacheKey);
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
    let successfulSubdivisions = 0;
    let failedSubdivisions = 0;

    for (const subBoundary of subdivisions) {
      try {
        const result = await queryOverpassByLayer(subBoundary, layers, options);
        const features = result.features || [];
        allFeatures.push(...features);
        errors.push(...(result.errors || []));
        successfulSubdivisions += 1;
      } catch (err) {
        console.error('Subdivision query failed:', err.message);
        failedSubdivisions += 1;
        errors.push({ scope: 'subdivision', error: err.message });
      }
    }

    // If all subdivisions failed, try to return stale cache
    if (successfulSubdivisions === 0) {
      const staleCache = await getCachedOSM(cacheKey, true);
      if (staleCache) {
        console.log('All queries failed, returning stale cache');
        return res.status(200).json({
          success: true,
          data: { ...staleCache, metadata: { ...staleCache.metadata, stale: true } },
          warning: 'Using cached data due to query failure'
        });
      }

      const error = new Error(`All OSM queries failed: ${summarizeErrors(errors)}`);
      error.code = 'QUERY_FAILED';
      throw error;
    }

    // Log partial success
    if (failedSubdivisions > 0 || errors.length > 0) {
      console.log(`⚠️ Partial success: ${allFeatures.length} features from ${successfulSubdivisions}/${subdivisions.length} subdivisions`);
    }

    const warnings = [];

    if (failedSubdivisions > 0) {
      warnings.push(`Loaded partial OSM data: ${successfulSubdivisions} of ${subdivisions.length} subdivisions succeeded.`);
    }

    if (errors.length > 0) {
      warnings.push(`Some OSM layer queries failed: ${summarizeErrors(errors)}`);
    }

    // Empty Overpass results are valid for sparse districts or narrow layer selections.
    if (allFeatures.length === 0) {
      warnings.push('No matching OSM infrastructure features were found for the selected area and layers.');

      const emptyResponse = {
        type: 'FeatureCollection',
        features: [],
        metadata: {
          queryTime: Date.now() - startTime,
          totalFeatures: 0,
          byLayer: {},
          requestedLayers: layers,
          boundingBox: calculateBoundingBox(boundary),
          querySubdivisions: subdivisions.length,
          cached: false,
          timestamp: new Date().toISOString(),
          partialFailures: errors.length,
          warnings,
          roadsTrimmed: 0,
          originalRoadCount: 0,
          returnedRoadCount: 0
        }
      };

      console.log(`OSM query complete: no matching features in ${Date.now() - startTime}ms`);

      return res.status(200).json({
        success: true,
        data: emptyResponse,
        warning: warnings.join(' ')
      });
    }

    // Deduplicate features (same OSM ID might appear in multiple subdivisions)
    const deduped = deduplicateFeatures(allFeatures);

    // Filter to exact boundary (subdivisions may overlap)
    const filtered = filterToPolygon(deduped, boundary);

    // Categorize and format
    const categorized = categorizeInfrastructure(filtered);
    const optimized = optimizeInfrastructureResponse(categorized);

    if (optimized.metadata.roadsTrimmed > 0) {
      warnings.push(`Road results were reduced for performance: returned ${optimized.metadata.returnedRoadCount.toLocaleString()} of ${optimized.metadata.originalRoadCount.toLocaleString()} road features.`);
    }

    // Build response
    const response = {
      type: 'FeatureCollection',
      features: optimized.features,
      metadata: {
        queryTime: Date.now() - startTime,
        totalFeatures: optimized.features.length,
        byLayer: countByLayer(optimized.features),
        requestedLayers: layers,
        boundingBox: calculateBoundingBox(boundary),
        querySubdivisions: subdivisions.length,
        cached: false,
        timestamp: new Date().toISOString(),
        partialFailures: errors.length,
        warnings,
        roadsTrimmed: optimized.metadata.roadsTrimmed,
        originalRoadCount: optimized.metadata.originalRoadCount,
        returnedRoadCount: optimized.metadata.returnedRoadCount
      }
    };

    // Cache result
    await setCachedOSM(cacheKey, response, CACHE_TTL_HOURS);

    console.log(`OSM query complete: ${optimized.features.length} features in ${Date.now() - startTime}ms`);

    return res.status(200).json({
      success: true,
      data: response,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined
    });

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
 * Query each requested layer separately so expensive categories do not fail the
 * entire district load.
 */
async function queryOverpassByLayer(boundary, layers, options) {
  if (layers.length === 1) {
    try {
      const features = await queryLayerWithFallback(boundary, layers[0], options);
      return { features, errors: [] };
    } catch (error) {
      console.error(`OSM layer failed (${layers[0]}):`, error.message);
      return {
        features: [],
        errors: [{ scope: 'layer', layer: layers[0], error: error.message }]
      };
    }
  }

  const features = [];
  const errors = [];

  for (const layer of layers) {
    try {
      console.log(`Querying OSM layer: ${layer}`);
      const layerFeatures = await queryLayerWithFallback(boundary, layer, options);
      features.push(...layerFeatures);
    } catch (error) {
      console.error(`OSM layer failed (${layer}):`, error.message);
      errors.push({ scope: 'layer', layer, error: error.message });
    }
  }

  if (errors.length === layers.length) {
    throw new Error(`All OSM layer queries failed: ${summarizeErrors(errors)}`);
  }

  return { features, errors };
}

async function queryLayerWithFallback(boundary, layer, options) {
  const layerOptions = {
    ...options,
    maxFeatures: getLayerMaxFeatures(layer, options.maxFeatures),
    useCenterOnly: shouldUseCenterOutput(layer)
  };

  try {
    return await queryOverpassWithRetry(boundary, [layer], layerOptions);
  } catch (error) {
    if (layerOptions.useBboxOnly) throw error;

    console.warn(`Retrying OSM layer with bbox fallback (${layer}):`, error.message);
    return queryOverpassWithRetry(boundary, [layer], {
      ...layerOptions,
      useBboxOnly: true,
      useCenterOnly: shouldUseCenterOutput(layer)
    });
  }
}

function getLayerMaxFeatures(layer, requestedMaxFeatures = 5000) {
  const layerLimits = {
    roads: 1500,
    schools: 1000,
    water: 1000,
    hospitals: 700,
    pharmacies: 700,
    fuel: 700,
    power: 500,
    bridges: 500,
    airports: 300
  };

  return Math.min(requestedMaxFeatures, layerLimits[layer] || 700);
}

function shouldUseCenterOutput(layer) {
  return !['roads', 'bridges'].includes(layer);
}

function summarizeErrors(errors = []) {
  const uniqueMessages = Array.from(new Set(
    errors
      .map(item => {
        const prefix = item.layer ? `${item.layer}: ` : '';
        return `${prefix}${item.error || item.message || String(item)}`;
      })
      .filter(Boolean)
  ));

  return uniqueMessages.slice(0, 3).join('; ') || 'Unknown Overpass error';
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
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'gdacs-facilities-ai/0.1'
      }
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

      // Capture response body for better debugging
      const responseText = await response.text().catch(() => 'Unable to read response body');
      console.error(`Overpass HTTP ${response.status} error:`, responseText.slice(0, 200));
      throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 100)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const responseText = await response.text();
      throw new Error(`Unexpected Overpass response format (${contentType || 'unknown'}): ${responseText.slice(0, 80)}`);
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
