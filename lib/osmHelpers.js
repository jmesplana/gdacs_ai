/**
 * OSM Helper Functions
 * Server-side utilities for Overpass API queries, GeoJSON conversion, and infrastructure categorization
 */

const { polygon, featureCollection } = require('@turf/helpers');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const booleanIntersects = require('@turf/boolean-intersects').default;
const area = require('@turf/area').default;
const bbox = require('@turf/bbox').default;
const bboxPolygon = require('@turf/bbox-polygon').default;
const intersect = require('@turf/intersect').default;

// Layer definitions with Overpass QL queries
const LAYER_QUERIES = {
  hospitals: `
    (
      node["amenity"="hospital"](poly:"{polygon}");
      way["amenity"="hospital"](poly:"{polygon}");
      node["amenity"="clinic"](poly:"{polygon}");
      way["amenity"="clinic"](poly:"{polygon}");
      node["healthcare"="hospital"](poly:"{polygon}");
      node["healthcare"="clinic"](poly:"{polygon}");
    );
  `,
  schools: `
    (
      node["amenity"="school"](poly:"{polygon}");
      way["amenity"="school"](poly:"{polygon}");
      node["amenity"="university"](poly:"{polygon}");
      way["amenity"="university"](poly:"{polygon}");
      node["amenity"="college"](poly:"{polygon}");
    );
  `,
  roads: `
    (
      way["highway"~"motorway|trunk|primary|secondary"](poly:"{polygon}");
    );
  `,
  water: `
    (
      node["amenity"="water_point"](poly:"{polygon}");
      way["amenity"="water_point"](poly:"{polygon}");
      node["man_made"="water_well"](poly:"{polygon}");
      node["man_made"="water_tower"](poly:"{polygon}");
      way["man_made"="water_tower"](poly:"{polygon}");
      node["natural"="spring"](poly:"{polygon}");
      node["amenity"="drinking_water"](poly:"{polygon}");
    );
  `,
  power: `
    (
      node["power"="plant"](poly:"{polygon}");
      way["power"="plant"](poly:"{polygon}");
      node["power"="substation"](poly:"{polygon}");
      way["power"="substation"](poly:"{polygon}");
      node["power"="generator"](poly:"{polygon}");
    );
  `,
  fuel: `
    (
      node["amenity"="fuel"](poly:"{polygon}");
      way["amenity"="fuel"](poly:"{polygon}");
    );
  `,
  pharmacies: `
    (
      node["amenity"="pharmacy"](poly:"{polygon}");
      way["amenity"="pharmacy"](poly:"{polygon}");
    );
  `,
  bridges: `
    (
      way["bridge"="yes"]["highway"](poly:"{polygon}");
    );
  `,
  airports: `
    (
      node["aeroway"="aerodrome"](poly:"{polygon}");
      way["aeroway"="aerodrome"](poly:"{polygon}");
      node["aeroway"="helipad"](poly:"{polygon}");
      way["aeroway"="helipad"](poly:"{polygon}");
    );
  `,
};

/**
 * Build Overpass QL query from boundary and layers
 * @param {Object} boundary - GeoJSON Polygon/MultiPolygon
 * @param {Array<string>} layers - Layer IDs to query
 * @param {Object} options - Query options
 * @returns {string} Overpass QL query
 */
function buildOverpassQuery(boundary, layers, options = {}) {
  const { maxFeatures = 5000 } = options;

  // Convert GeoJSON to Overpass polygon format
  const polygonString = boundaryToOverpassPolygon(boundary);

  // Build union of all layer queries
  const layerQueries = layers
    .filter(layer => LAYER_QUERIES[layer])
    .map(layer => LAYER_QUERIES[layer].replace(/{polygon}/g, polygonString))
    .join('\n');

  if (!layerQueries) {
    throw new Error('No valid layers specified');
  }

  const query = `
    [out:json][timeout:45];
    ${layerQueries}
    out geom ${maxFeatures};
  `.trim();

  return query;
}

/**
 * Convert GeoJSON boundary to Overpass polygon format
 * @param {Object} boundary - GeoJSON geometry
 * @returns {string} Space-separated lat/lon pairs
 */
function boundaryToOverpassPolygon(boundary) {
  // Get outer ring coordinates
  let coords;
  if (boundary.type === 'Polygon') {
    coords = boundary.coordinates[0];
  } else if (boundary.type === 'MultiPolygon') {
    // Use first polygon of multipolygon
    coords = boundary.coordinates[0][0];
  } else {
    throw new Error('Boundary must be Polygon or MultiPolygon');
  }

  // Overpass format: "lat1 lon1 lat2 lon2 ..."
  return coords.map(([lon, lat]) => `${lat} ${lon}`).join(' ');
}

/**
 * Filter features to exact polygon boundary
 * (Overpass bounding box may include features outside polygon)
 * @param {Array} features - GeoJSON features
 * @param {Object} boundary - GeoJSON polygon
 * @returns {Array} Filtered features
 */
function filterToPolygon(features, boundary) {
  try {
    const boundaryPolygon = polygon(boundary.coordinates);

    return features.filter(feature => {
      try {
        // Point features
        if (feature.geometry.type === 'Point') {
          return booleanPointInPolygon(feature.geometry, boundaryPolygon);
        }

        // Line/Polygon features - check if intersects
        if (feature.geometry.type === 'LineString' ||
            feature.geometry.type === 'Polygon' ||
            feature.geometry.type === 'MultiLineString' ||
            feature.geometry.type === 'MultiPolygon') {
          return booleanIntersects(feature.geometry, boundaryPolygon);
        }

        return false;
      } catch (err) {
        console.warn('Error filtering feature:', err.message);
        return false;
      }
    });
  } catch (err) {
    console.error('Error in filterToPolygon:', err);
    return features; // Return all features if filtering fails
  }
}

/**
 * Convert OSM elements to GeoJSON
 * @param {Array} elements - OSM elements from Overpass
 * @returns {Array} GeoJSON features
 */
function convertToGeoJSON(elements) {
  const features = [];

  for (const element of elements) {
    try {
      const feature = {
        type: 'Feature',
        id: `${element.type}/${element.id}`,
        properties: {
          osmId: element.id,
          osmType: element.type,
          tags: element.tags || {},
          name: element.tags?.name || 'Unnamed'
        },
        geometry: null
      };

      // Convert geometry based on type
      if (element.type === 'node') {
        feature.geometry = {
          type: 'Point',
          coordinates: [element.lon, element.lat]
        };
      } else if (element.type === 'way' && element.geometry) {
        const coords = element.geometry.map(nd => [nd.lon, nd.lat]);

        // Closed way = polygon, open = linestring
        const isClosed = coords.length > 3 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1];

        if (isClosed && element.tags?.area !== 'no' && !element.tags?.highway) {
          feature.geometry = { type: 'Polygon', coordinates: [coords] };
        } else {
          feature.geometry = { type: 'LineString', coordinates: coords };
        }
      }

      if (feature.geometry) {
        features.push(feature);
      }
    } catch (err) {
      console.warn('Error converting OSM element:', err.message);
    }
  }

  return features;
}

/**
 * Categorize infrastructure features by type and priority
 * @param {Array} features - GeoJSON features
 * @returns {Array} Features with category metadata
 */
function categorizeInfrastructure(features) {
  return features.map(feature => {
    const tags = feature.properties.tags;
    let category = 'other';
    let priority = 'low';
    let icon = 'circle';
    let color = '#888888';

    // Categorization logic
    if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') {
      category = 'hospital';
      priority = 'critical';
      icon = 'hospital';
      color = '#dc2626';
    } else if (tags.amenity === 'clinic' || tags.healthcare === 'clinic') {
      category = 'clinic';
      priority = 'high';
      icon = 'clinic';
      color = '#ea580c';
    } else if (tags.amenity === 'school' || tags.amenity === 'university' || tags.amenity === 'college') {
      category = 'school';
      priority = 'medium';
      icon = 'school';
      color = '#2563eb';
    } else if (tags.highway) {
      category = 'road';
      priority = tags.highway === 'motorway' || tags.highway === 'trunk' ? 'high' : 'medium';
      icon = 'road';
      color = '#475569';
    } else if (tags.bridge === 'yes') {
      category = 'bridge';
      priority = 'high';
      icon = 'bridge';
      color = '#64748b';
    } else if (tags.amenity === 'water_point' || tags.amenity === 'drinking_water' ||
               tags.man_made?.includes('water') || tags.natural === 'spring') {
      category = 'water';
      priority = 'critical';
      icon = 'water';
      color = '#0891b2';
    } else if (tags.power) {
      category = 'power';
      priority = 'high';
      icon = 'bolt';
      color = '#eab308';
    } else if (tags.amenity === 'fuel') {
      category = 'fuel';
      priority = 'medium';
      icon = 'gas-pump';
      color = '#84cc16';
    } else if (tags.amenity === 'pharmacy') {
      category = 'pharmacy';
      priority = 'high';
      icon = 'pills';
      color = '#a855f7';
    } else if (tags.aeroway) {
      category = 'airport';
      priority = 'critical';
      icon = 'plane';
      color = '#8b5cf6';
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        category,
        priority,
        icon,
        color
      }
    };
  });
}

/**
 * Calculate area of polygon in km²
 * @param {Object} boundary - GeoJSON polygon
 * @returns {number} Area in km²
 */
function calculateAreaKm2(boundary) {
  try {
    const poly = polygon(boundary.coordinates);
    return area(poly) / 1_000_000; // m² to km²
  } catch (err) {
    console.error('Error calculating area:', err);
    return 0;
  }
}

/**
 * Subdivide large boundary into smaller chunks
 * @param {Object} boundary - GeoJSON polygon
 * @param {number} maxAreaKm2 - Maximum area per subdivision
 * @returns {Array<Object>} Array of smaller polygons
 */
function subdivideBoundary(boundary, maxAreaKm2) {
  try {
    const bboxCoords = bbox(boundary);
    const [minLon, minLat, maxLon, maxLat] = bboxCoords;

    // Calculate grid dimensions
    const area = calculateAreaKm2(boundary);
    const subdivisions = Math.ceil(Math.sqrt(area / maxAreaKm2));

    if (subdivisions <= 1) {
      return [boundary];
    }

    const lonStep = (maxLon - minLon) / subdivisions;
    const latStep = (maxLat - minLat) / subdivisions;

    const subBoundaries = [];

    for (let i = 0; i < subdivisions; i++) {
      for (let j = 0; j < subdivisions; j++) {
        const subBbox = [
          minLon + i * lonStep,
          minLat + j * latStep,
          minLon + (i + 1) * lonStep,
          minLat + (j + 1) * latStep
        ];

        const subPolygon = bboxPolygon(subBbox);

        // Only include if intersects original boundary
        if (booleanIntersects(subPolygon, boundary)) {
          try {
            const intersection = intersect(featureCollection([subPolygon, boundary]));
            if (intersection) {
              subBoundaries.push(intersection.geometry);
            }
          } catch (err) {
            // If intersection fails, use the sub-polygon
            subBoundaries.push(subPolygon.geometry);
          }
        }
      }
    }

    return subBoundaries.length > 0 ? subBoundaries : [boundary];
  } catch (err) {
    console.error('Error subdividing boundary:', err);
    return [boundary];
  }
}

/**
 * Deduplicate features by OSM ID
 */
function deduplicateFeatures(features) {
  const seen = new Set();
  return features.filter(f => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

/**
 * Count features by layer/category
 */
function countByLayer(features) {
  return features.reduce((acc, f) => {
    const cat = f.properties.category;
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Generate cache key from query parameters
 */
function generateCacheKey(boundary, layers, options) {
  try {
    const bboxCoords = bbox(boundary);
    const layersKey = layers.sort().join(',');
    return `osm:${bboxCoords.join(',')}:${layersKey}:${options.maxFeatures || 5000}`;
  } catch (err) {
    console.error('Error generating cache key:', err);
    return `osm:${Date.now()}`;
  }
}

/**
 * Calculate bounding box from boundary
 */
function calculateBoundingBox(boundary) {
  try {
    return bbox(boundary);
  } catch (err) {
    console.error('Error calculating bbox:', err);
    return [0, 0, 0, 0];
  }
}

/**
 * Format OSM data for AI consumption
 * @param {Object} osmData - OSM GeoJSON data
 * @param {Array} disasters - Disaster array
 * @returns {string} Formatted text for AI
 */
function formatOSMForAI(osmData, disasters = []) {
  if (!osmData || !osmData.features || osmData.features.length === 0) {
    return '\n## Infrastructure Data (OpenStreetMap)\nNo infrastructure data available for this area.\n';
  }

  let text = '\n## Infrastructure Data (OpenStreetMap)\n';
  text += `Total features mapped: ${osmData.features.length}\n\n`;

  // Count by category
  const byCat = countByLayer(osmData.features);

  // Critical infrastructure summary
  const critical = ['hospital', 'clinic', 'water', 'airport', 'power'];
  const criticalCounts = critical.filter(cat => byCat[cat]);

  if (criticalCounts.length > 0) {
    text += '**Critical Infrastructure Summary:**\n';
    criticalCounts.forEach(cat => {
      text += `- ${cat}: ${byCat[cat]}\n`;
    });
    text += '\n';
  }

  // Other infrastructure summary
  const other = Object.keys(byCat).filter(cat => !critical.includes(cat));
  if (other.length > 0) {
    text += '**Other Infrastructure Summary:**\n';
    other.forEach(cat => {
      text += `- ${cat}: ${byCat[cat]}\n`;
    });
    text += '\n';
  }

  // Detailed facility list (critical infrastructure only, to keep context manageable)
  text += '**Detailed Facility List:**\n';
  text += 'IMPORTANT: Use this list to answer questions about specific locations, cities, or districts.\n\n';

  const criticalFeatures = osmData.features.filter(f =>
    critical.includes(f.properties.category)
  );

  // Group by category for organized output
  critical.forEach(category => {
    const categoryFeatures = criticalFeatures.filter(f => f.properties.category === category);
    if (categoryFeatures.length === 0) return;

    text += `**${category.toUpperCase()} FACILITIES (${categoryFeatures.length}):**\n`;

    categoryFeatures.forEach((feature, idx) => {
      // Limit to first 100 per category to avoid context explosion
      if (idx >= 100) {
        if (idx === 100) text += `  ... (${categoryFeatures.length - 100} more ${category} facilities not shown)\n`;
        return;
      }

      const props = feature.properties;
      const tags = props.tags || {};

      // Extract location info from tags
      const city = tags['addr:city'] || tags.city || tags['is_in:city'] || '';
      const district = tags['addr:district'] || tags.district || '';
      const suburb = tags['addr:suburb'] || tags.suburb || '';
      const location = city || district || suburb || 'Unknown location';

      // Get coordinates for Point features
      let coords = '';
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates;
        coords = ` @ ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }

      // Build facility line
      text += `  ${idx + 1}. ${props.name}`;
      if (location !== 'Unknown location') {
        text += ` [${location}]`;
      }
      text += coords;

      // Add extra metadata for hospitals/clinics
      if (category === 'hospital' || category === 'clinic') {
        if (tags.operator) text += ` | Operator: ${tags.operator}`;
        if (tags.beds) text += ` | Beds: ${tags.beds}`;
        if (tags.emergency === 'yes') text += ` | ⚡ Emergency`;
      }

      text += '\n';
    });

    text += '\n';
  });

  text += '\n**USAGE INSTRUCTIONS FOR AI:**\n';
  text += '- When asked about facilities in a specific city/district (e.g., "Rafah"), search the detailed list above for that location name in brackets []\n';
  text += '- Count only the facilities that match the requested location\n';
  text += '- If no location info is available in the OSM data, acknowledge this limitation\n';
  text += '- Use the coordinates to cross-reference with district boundaries if available\n';

  return text;
}

module.exports = {
  buildOverpassQuery,
  boundaryToOverpassPolygon,
  filterToPolygon,
  convertToGeoJSON,
  categorizeInfrastructure,
  calculateAreaKm2,
  subdivideBoundary,
  deduplicateFeatures,
  countByLayer,
  generateCacheKey,
  calculateBoundingBox,
  formatOSMForAI,
};
