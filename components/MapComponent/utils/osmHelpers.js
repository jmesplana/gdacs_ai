/**
 * Client-side OSM utilities
 * Proximity calculations, filtering, formatting
 */

import { getDistance } from 'geolib';

/**
 * Calculate proximity from facility to nearest OSM features
 * @param {Object} facility - Facility with { lat, lng }
 * @param {Object} osmData - GeoJSON FeatureCollection
 * @param {Object} options - Calculation options
 * @returns {Object} Proximity analysis
 */
export function calculateOSMProximity(facility, osmData, options = {}) {
  if (!osmData || !osmData.features) return null;

  const { maxDistance = 50 } = options; // km
  const facilityCoords = {
    latitude: facility.lat || facility.latitude,
    longitude: facility.lng || facility.longitude
  };

  const proximity = {
    nearest: {},
    within5km: {},
    within10km: {},
    within25km: {},
    total: osmData.features.length
  };

  // Group by category
  const byCategory = {};
  osmData.features.forEach(feature => {
    const cat = feature.properties.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(feature);
  });

  // Calculate nearest for each category
  Object.entries(byCategory).forEach(([category, features]) => {
    let nearest = null;
    let minDistance = Infinity;

    features.forEach(feature => {
      if (feature.geometry.type === 'Point') {
        try {
          const [lng, lat] = feature.geometry.coordinates;
          const distanceMeters = getDistance(facilityCoords, { latitude: lat, longitude: lng });
          const distance = distanceMeters / 1000; // Convert to kilometers

          if (distance < minDistance) {
            minDistance = distance;
            nearest = {
              name: feature.properties.name,
              osmId: feature.properties.osmId,
              distance: distance.toFixed(2),
              category: feature.properties.category,
              tags: feature.properties.tags
            };
          }

          // Count by distance bands
          if (distance <= 5) {
            proximity.within5km[category] = (proximity.within5km[category] || 0) + 1;
          }
          if (distance <= 10) {
            proximity.within10km[category] = (proximity.within10km[category] || 0) + 1;
          }
          if (distance <= 25) {
            proximity.within25km[category] = (proximity.within25km[category] || 0) + 1;
          }
        } catch (err) {
          console.warn('Error calculating distance:', err);
        }
      }
    });

    if (nearest && minDistance <= maxDistance) {
      proximity.nearest[category] = nearest;
    }
  });

  return proximity;
}

/**
 * Filter OSM features by category
 * @param {Object} osmData - OSM GeoJSON data
 * @param {Array} categories - Categories to include
 * @returns {Object} Filtered GeoJSON
 */
export function filterByCategory(osmData, categories) {
  if (!osmData || !osmData.features) return null;

  return {
    ...osmData,
    features: osmData.features.filter(f =>
      categories.includes(f.properties.category)
    )
  };
}

/**
 * Filter OSM features within distance of point
 * @param {Object} osmData - OSM GeoJSON data
 * @param {Object} point - { lat, lng }
 * @param {number} maxDistanceKm - Maximum distance in km
 * @returns {Object} Filtered GeoJSON
 */
export function filterByDistance(osmData, point, maxDistanceKm) {
  if (!osmData || !osmData.features) return null;

  const centerPoint = turf.point([point.lng || point.longitude, point.lat || point.latitude]);

  return {
    ...osmData,
    features: osmData.features.filter(f => {
      if (f.geometry.type === 'Point') {
        try {
          const distance = turf.distance(centerPoint, f.geometry, { units: 'kilometers' });
          return distance <= maxDistanceKm;
        } catch (err) {
          return false;
        }
      }
      return false;
    })
  };
}

/**
 * Get features in disaster impact zone
 * @param {Object} osmData - OSM GeoJSON data
 * @param {Object} disaster - Disaster object with lat/lng
 * @param {number} radiusKm - Radius in km
 * @returns {Array} Features in impact zone
 */
export function getInfrastructureInDisasterZone(osmData, disaster, radiusKm = 50) {
  if (!osmData || !disaster) return [];

  const disasterPoint = turf.point([disaster.lng || disaster.longitude, disaster.lat || disaster.latitude]);
  const affected = [];

  osmData.features.forEach(feature => {
    if (feature.geometry.type === 'Point') {
      try {
        const distance = turf.distance(disasterPoint, feature.geometry, { units: 'kilometers' });
        if (distance <= radiusKm) {
          affected.push({
            ...feature,
            properties: {
              ...feature.properties,
              distanceFromDisaster: distance.toFixed(2)
            }
          });
        }
      } catch (err) {
        console.warn('Error calculating disaster proximity:', err);
      }
    }
  });

  return affected;
}

/**
 * Format OSM context for AI consumption
 * @param {Object} facility - Facility object
 * @param {Object} osmData - OSM GeoJSON data
 * @param {Array} disasters - Array of disasters
 * @returns {string} Formatted context string
 */
export function buildOSMContext(facility, osmData, disasters = []) {
  if (!osmData || !osmData.features || osmData.features.length === 0) {
    return '\n\n**INFRASTRUCTURE CONTEXT**: No OSM data available for this area.\n';
  }

  const proximity = calculateOSMProximity(facility, osmData, { maxDistance: 50 });
  if (!proximity) return '';

  let context = '\n\n**INFRASTRUCTURE CONTEXT (from OpenStreetMap)**\n\n';
  context += `Total mapped features in area: ${proximity.total}\n\n`;

  // Nearest critical infrastructure
  if (Object.keys(proximity.nearest).length > 0) {
    context += '**Nearest Infrastructure to Facility:**\n';

    const criticalCategories = ['hospital', 'clinic', 'water', 'power', 'airport'];
    criticalCategories.forEach(category => {
      if (proximity.nearest[category]) {
        const info = proximity.nearest[category];
        context += `- ${category.toUpperCase()}: "${info.name}" at ${info.distance} km (OSM ID: ${info.osmId})\n`;
      }
    });

    // Other infrastructure
    const otherCategories = Object.keys(proximity.nearest).filter(
      cat => !criticalCategories.includes(cat)
    );
    if (otherCategories.length > 0) {
      context += '\nOther nearby infrastructure:\n';
      otherCategories.forEach(category => {
        const info = proximity.nearest[category];
        context += `- ${category}: "${info.name}" at ${info.distance} km\n`;
      });
    }
  } else {
    context += '**WARNING**: No infrastructure found within 50km of facility.\n';
  }

  // Infrastructure density analysis
  context += '\n**Infrastructure Density:**\n';
  if (Object.keys(proximity.within5km).length > 0) {
    context += 'Within 5km radius:\n';
    Object.entries(proximity.within5km)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        context += `- ${count} ${category}\n`;
      });
  } else {
    context += 'Within 5km: No infrastructure\n';
  }

  // Infrastructure in disaster impact zones
  if (disasters && disasters.length > 0) {
    context += '\n**Infrastructure in Active Disaster Zones:**\n';

    let totalAffected = 0;
    disasters.forEach(disaster => {
      const affected = getInfrastructureInDisasterZone(osmData, disaster, 50);
      if (affected.length > 0) {
        totalAffected += affected.length;
        context += `\n${disaster.title || disaster.eventName} (${disaster.disastertype || disaster.eventType}):\n`;

        // Count by category
        const byCat = affected.reduce((acc, f) => {
          const cat = f.properties.category;
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});

        Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .forEach(([cat, count]) => {
            context += `  - ${count} ${cat} within 50km\n`;
          });

        // Highlight critical infrastructure at risk
        const criticalAffected = affected.filter(f =>
          ['hospital', 'clinic', 'water', 'power', 'airport'].includes(f.properties.category)
        );
        if (criticalAffected.length > 0) {
          context += `  - **CRITICAL**: ${criticalAffected.length} critical infrastructure features at risk\n`;
        }
      }
    });

    if (totalAffected === 0) {
      context += 'No infrastructure detected in current disaster impact zones.\n';
    }
  }

  context += '\n---\n';
  return context;
}

/**
 * Get icon class for OSM category
 * @param {string} category - OSM category
 * @returns {string} Font Awesome icon class
 */
export function getOSMIcon(category) {
  const icons = {
    hospital: 'fa-hospital',
    clinic: 'fa-clinic-medical',
    school: 'fa-school',
    road: 'fa-road',
    bridge: 'fa-bridge',
    water: 'fa-tint',
    power: 'fa-bolt',
    fuel: 'fa-gas-pump',
    pharmacy: 'fa-pills',
    airport: 'fa-plane',
  };
  return icons[category] || 'fa-map-marker';
}

/**
 * Get color for OSM category
 * @param {string} category - OSM category
 * @returns {string} Hex color
 */
export function getOSMColor(category) {
  const colors = {
    hospital: '#dc2626',
    clinic: '#ea580c',
    school: '#2563eb',
    road: '#475569',
    bridge: '#64748b',
    water: '#0891b2',
    power: '#eab308',
    fuel: '#84cc16',
    pharmacy: '#a855f7',
    airport: '#8b5cf6',
  };
  return colors[category] || '#888888';
}
