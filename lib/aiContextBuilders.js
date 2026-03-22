/**
 * AI Context Builders
 * Reusable functions to build context for GPT-4o across different endpoints
 */

const { point } = require('@turf/helpers');
const { default: distance } = require('@turf/distance');
const { formatOSMForAI } = require('./osmHelpers');

/**
 * Calculate proximity from facility to nearest OSM features (server-side version)
 * @param {Object} facility - Facility with { lat, lng } or { latitude, longitude }
 * @param {Object} osmData - GeoJSON FeatureCollection
 * @param {Object} options - Calculation options
 * @returns {Object} Proximity analysis
 */
function calculateOSMProximity(facility, osmData, options = {}) {
  if (!osmData || !osmData.features) return null;

  const { maxDistance = 50 } = options; // km
  const facilityPoint = point([
    facility.lng || facility.longitude,
    facility.lat || facility.latitude
  ]);

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
          const featureDistance = distance(facilityPoint, feature.geometry, { units: 'kilometers' });

          if (featureDistance < minDistance) {
            minDistance = featureDistance;
            nearest = {
              name: feature.properties.name,
              osmId: feature.properties.osmId,
              distance: featureDistance.toFixed(2),
              category: feature.properties.category,
              tags: feature.properties.tags
            };
          }

          // Count by distance bands
          if (featureDistance <= 5) {
            proximity.within5km[category] = (proximity.within5km[category] || 0) + 1;
          }
          if (featureDistance <= 10) {
            proximity.within10km[category] = (proximity.within10km[category] || 0) + 1;
          }
          if (featureDistance <= 25) {
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
 * Get infrastructure in disaster impact zone
 * @param {Object} osmData - OSM GeoJSON data
 * @param {Object} disaster - Disaster with lat/lng
 * @param {number} radiusKm - Radius in km
 * @returns {Array} Affected infrastructure
 */
function getInfrastructureInDisasterZone(osmData, disaster, radiusKm = 50) {
  if (!osmData || !disaster) return [];

  const disasterPoint = point([
    disaster.lng || disaster.longitude,
    disaster.lat || disaster.latitude
  ]);
  const affected = [];

  osmData.features.forEach(feature => {
    if (feature.geometry.type === 'Point') {
      try {
        const featureDistance = distance(disasterPoint, feature.geometry, { units: 'kilometers' });
        if (featureDistance <= radiusKm) {
          affected.push({
            ...feature,
            properties: {
              ...feature.properties,
              distanceFromDisaster: featureDistance.toFixed(2)
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
 * Build OSM infrastructure context for AI analysis
 * @param {Object} facility - Facility with { lat, lng, name }
 * @param {Object} osmData - GeoJSON FeatureCollection
 * @param {Array} disasters - Array of disasters
 * @returns {string} Formatted context string
 */
function buildOSMContext(facility, osmData, disasters = []) {
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

  // Operational implications
  context += '\n**Operational Implications:**\n';
  const hasHospital = proximity.nearest.hospital && parseFloat(proximity.nearest.hospital.distance) < 25;
  const hasClinic = proximity.nearest.clinic && parseFloat(proximity.nearest.clinic.distance) < 25;
  const hasWater = proximity.nearest.water && parseFloat(proximity.nearest.water.distance) < 10;
  const hasPower = proximity.nearest.power && parseFloat(proximity.nearest.power.distance) < 15;
  const hasAirport = proximity.nearest.airport && parseFloat(proximity.nearest.airport.distance) < 50;

  if (hasHospital || hasClinic) {
    const medical = hasHospital ? proximity.nearest.hospital : proximity.nearest.clinic;
    context += `- Medical support: Accessible (${hasHospital ? 'hospital' : 'clinic'} "${medical.name}" ${medical.distance} km away)\n`;
  } else {
    context += '- Medical support: LIMITED - no hospitals/clinics within 25km\n';
  }

  if (hasWater) {
    context += `- Water access: Available (water point "${proximity.nearest.water.name}" ${proximity.nearest.water.distance} km away)\n`;
  } else {
    context += '- Water access: CRITICAL CONCERN - no water points within 10km\n';
  }

  if (hasPower) {
    context += `- Power grid: Accessible (${proximity.nearest.power.distance} km away)\n`;
  } else {
    context += '- Power grid: REMOTE - plan for generators/solar\n';
  }

  if (hasAirport) {
    context += `- Air logistics: Possible (airport/helipad ${proximity.nearest.airport.distance} km away)\n`;
  } else {
    context += '- Air logistics: NOT AVAILABLE - ground transport only\n';
  }

  context += '\n---\n';
  return context;
}

/**
 * Build comprehensive context for chat endpoint
 * @param {Object} params - { facilities, osmData, disasters, worldPopData, acledData, districts }
 * @returns {string} Full context for chat
 */
function buildChatContext(params) {
  const { facilities, osmData, disasters, worldPopData, acledData, districts } = params;

  let context = '';

  // OSM infrastructure summary
  if (osmData && osmData.features && osmData.features.length > 0) {
    context += formatOSMForAI(osmData, disasters);
  }

  // If user asks about a specific facility, add proximity analysis
  // This will be called per-facility as needed

  return context;
}

module.exports = {
  buildOSMContext,
  buildChatContext,
  calculateOSMProximity,
  getInfrastructureInDisasterZone,
};
