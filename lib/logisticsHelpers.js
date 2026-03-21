/**
 * Logistics Assessment Helper Functions
 * Analyzes road networks, fuel access, air access, and logistics feasibility
 * for humanitarian disaster response operations
 *
 * Dependencies: geolib, @turf/* (already in package.json)
 */

const { getDistance } = require('geolib');
// Use specific Turf modules to avoid ES Module compatibility issues
const center = require('@turf/center').default;
const centroid = require('@turf/centroid').default;
const { lineString, polygon } = require('@turf/helpers');

function getDisasterTypeKey(disaster = {}) {
  const rawType = (
    disaster.eventType ||
    disaster.eventtype ||
    disaster.type ||
    disaster.disasterType ||
    ''
  ).toString().trim().toLowerCase();

  const mappedTypes = {
    eq: 'earthquake',
    earthquake: 'earthquake',
    fl: 'flood',
    flood: 'flood',
    tc: 'tropical cyclone',
    cyclone: 'tropical cyclone',
    'tropical cyclone': 'tropical cyclone',
    'tropical storm': 'tropical cyclone',
    wf: 'wildfire',
    wildfire: 'wildfire',
    fire: 'wildfire',
    dr: 'default',
    drought: 'default',
    vo: 'default',
    volcano: 'default',
    volcanic: 'default',
    ts: 'default',
    tsunami: 'default'
  };

  return mappedTypes[rawType] || rawType || 'default';
}

/**
 * Disaster impact models for infrastructure damage probability
 * Based on empirical disaster response data and engineering assessments
 */
const DISASTER_IMPACT_MODELS = {
  earthquake: {
    // Roads: damage decreases with distance from epicenter
    roadBlockage: (distanceKm, magnitude) => {
      const normalizedMag = (magnitude || 7.0) / 9.0; // Normalize magnitude (assume 7.0 if not provided)
      if (distanceKm < 5) return 0.9 * normalizedMag;
      if (distanceKm < 10) return 0.7 * normalizedMag;
      if (distanceKm < 25) return 0.4 * normalizedMag;
      if (distanceKm < 50) return 0.2 * normalizedMag;
      return 0.05 * normalizedMag;
    },
    // Bridges: critical chokepoints, higher vulnerability
    bridgeRisk: (distanceKm, magnitude) => {
      const normalizedMag = (magnitude || 7.0) / 9.0;
      if (distanceKm < 10) return 0.95 * normalizedMag;
      if (distanceKm < 25) return 0.6 * normalizedMag;
      if (distanceKm < 50) return 0.3 * normalizedMag;
      return 0.1 * normalizedMag;
    },
    // Fuel stations: power outages affect pumps
    fuelDisruption: (distanceKm) => {
      if (distanceKm < 10) return 0.8;
      if (distanceKm < 25) return 0.5;
      if (distanceKm < 50) return 0.2;
      return 0.05;
    },
    // Airports: runways may be damaged
    airportDisruption: (distanceKm) => {
      if (distanceKm < 5) return 0.9;
      if (distanceKm < 15) return 0.6;
      if (distanceKm < 30) return 0.3;
      return 0.1;
    }
  },
  flood: {
    // Roads: impassable when flooded
    roadBlockage: (distanceKm, severity) => {
      const severityMultiplier = severity === 'Red' ? 1.2 : severity === 'Orange' ? 1.0 : 0.7;
      if (distanceKm < 2) return 0.95 * severityMultiplier;
      if (distanceKm < 5) return 0.85 * severityMultiplier;
      if (distanceKm < 10) return 0.6 * severityMultiplier;
      if (distanceKm < 25) return 0.3 * severityMultiplier;
      return 0.1 * severityMultiplier;
    },
    // Bridges: often washed away or submerged
    bridgeRisk: (distanceKm, severity) => {
      const severityMultiplier = severity === 'Red' ? 1.2 : severity === 'Orange' ? 1.0 : 0.7;
      if (distanceKm < 5) return 0.98 * severityMultiplier;
      if (distanceKm < 10) return 0.8 * severityMultiplier;
      if (distanceKm < 25) return 0.5 * severityMultiplier;
      return 0.15 * severityMultiplier;
    },
    // Fuel stations: often flooded, power out
    fuelDisruption: (distanceKm) => {
      if (distanceKm < 5) return 0.9;
      if (distanceKm < 10) return 0.7;
      if (distanceKm < 25) return 0.4;
      return 0.1;
    },
    // Airports: runways flooded
    airportDisruption: (distanceKm) => {
      if (distanceKm < 10) return 0.85;
      if (distanceKm < 25) return 0.5;
      if (distanceKm < 50) return 0.2;
      return 0.05;
    }
  },
  'tropical cyclone': {
    // Roads: debris, fallen trees
    roadBlockage: (distanceKm, windSpeed) => {
      const windMultiplier = (windSpeed || 120) / 150; // Normalize wind speed
      if (distanceKm < 10) return 0.85 * windMultiplier;
      if (distanceKm < 25) return 0.7 * windMultiplier;
      if (distanceKm < 50) return 0.5 * windMultiplier;
      if (distanceKm < 100) return 0.3 * windMultiplier;
      return 0.1 * windMultiplier;
    },
    // Bridges: wind damage, flooding from storm surge
    bridgeRisk: (distanceKm, windSpeed) => {
      const windMultiplier = (windSpeed || 120) / 150;
      if (distanceKm < 15) return 0.8 * windMultiplier;
      if (distanceKm < 30) return 0.6 * windMultiplier;
      if (distanceKm < 60) return 0.4 * windMultiplier;
      return 0.15 * windMultiplier;
    },
    // Fuel stations: power outages, physical damage
    fuelDisruption: (distanceKm) => {
      if (distanceKm < 25) return 0.9;
      if (distanceKm < 50) return 0.7;
      if (distanceKm < 100) return 0.4;
      return 0.1;
    },
    // Airports: operations suspended
    airportDisruption: (distanceKm) => {
      if (distanceKm < 50) return 0.95;
      if (distanceKm < 100) return 0.7;
      if (distanceKm < 200) return 0.4;
      return 0.1;
    }
  },
  wildfire: {
    roadBlockage: (distanceKm) => {
      if (distanceKm < 2) return 0.95;
      if (distanceKm < 5) return 0.7;
      if (distanceKm < 10) return 0.4;
      return 0.05;
    },
    bridgeRisk: (distanceKm) => {
      if (distanceKm < 1) return 0.8;
      if (distanceKm < 5) return 0.5;
      return 0.1;
    },
    fuelDisruption: (distanceKm) => {
      if (distanceKm < 5) return 0.9;
      if (distanceKm < 10) return 0.6;
      return 0.1;
    },
    airportDisruption: (distanceKm) => {
      if (distanceKm < 20) return 0.7;
      if (distanceKm < 50) return 0.4;
      return 0.1;
    }
  },
  // Default model for other disaster types
  default: {
    roadBlockage: (distanceKm) => {
      if (distanceKm < 5) return 0.6;
      if (distanceKm < 15) return 0.4;
      if (distanceKm < 30) return 0.2;
      return 0.05;
    },
    bridgeRisk: (distanceKm) => {
      if (distanceKm < 10) return 0.7;
      if (distanceKm < 25) return 0.4;
      return 0.1;
    },
    fuelDisruption: (distanceKm) => {
      if (distanceKm < 10) return 0.5;
      if (distanceKm < 25) return 0.3;
      return 0.05;
    },
    airportDisruption: (distanceKm) => {
      if (distanceKm < 15) return 0.5;
      if (distanceKm < 30) return 0.3;
      return 0.05;
    }
  }
};

/**
 * Find the nearest disaster to a given point
 * @param {Object} coordinates - { latitude: number, longitude: number }
 * @param {Array} disasters - Array of disaster objects
 * @returns {Object|null} { disaster, distance } or null
 */
function findNearestDisaster(coordinates, disasters) {
  if (!disasters || disasters.length === 0) return null;
  if (!coordinates || !coordinates.latitude || !coordinates.longitude) return null;

  let nearest = null;
  let minDistance = Infinity;

  disasters.forEach(disaster => {
    // Handle both point-based and polygon-based disasters
    let distanceMeters;

    if (disaster.geometry && disaster.geometry.coordinates) {
      // Polygon-based disaster (e.g., flood zones)
      try {
        const disasterCenter = calculateCenter(disaster.geometry);
        if (!disasterCenter) return;

        distanceMeters = getDistance(
          { latitude: coordinates.latitude, longitude: coordinates.longitude },
          { latitude: disasterCenter.latitude, longitude: disasterCenter.longitude }
        );
      } catch (err) {
        console.warn('Error calculating distance to polygon disaster:', err.message);
        return;
      }
    } else if (disaster.latitude && disaster.longitude) {
      // Point-based disaster (e.g., earthquake epicenter)
      distanceMeters = getDistance(
        { latitude: coordinates.latitude, longitude: coordinates.longitude },
        { latitude: parseFloat(disaster.latitude), longitude: parseFloat(disaster.longitude) }
      );
    } else {
      return; // Skip invalid disaster
    }

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      nearest = disaster;
    }
  });

  if (!nearest) return null;

  return {
    disaster: nearest,
    distance: minDistance / 1000 // Convert to kilometers
  };
}

/**
 * Calculate center point of a geometry (supports Point, LineString, Polygon)
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {Object|null} { latitude, longitude } or null
 */
function calculateCenter(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return null;

  try {
    let centerPoint;

    switch (geometry.type) {
      case 'Point':
        return {
          latitude: geometry.coordinates[1],
          longitude: geometry.coordinates[0]
        };

      case 'LineString':
      case 'MultiPoint':
        // Use Turf to get center
        centerPoint = center(lineString(geometry.coordinates));
        return {
          latitude: centerPoint.geometry.coordinates[1],
          longitude: centerPoint.geometry.coordinates[0]
        };

      case 'Polygon':
        // Use centroid for polygons
        centerPoint = centroid(polygon(geometry.coordinates));
        return {
          latitude: centerPoint.geometry.coordinates[1],
          longitude: centerPoint.geometry.coordinates[0]
        };

      case 'MultiLineString':
      case 'MultiPolygon':
        // Use first element's center
        const firstGeometry = {
          type: geometry.type === 'MultiLineString' ? 'LineString' : 'Polygon',
          coordinates: geometry.coordinates[0]
        };
        return calculateCenter(firstGeometry);

      default:
        console.warn('Unsupported geometry type:', geometry.type);
        return null;
    }
  } catch (err) {
    console.error('Error calculating geometry center:', err);
    return null;
  }
}

/**
 * Calculate blockage probability for infrastructure based on distance to disaster
 * @param {number} distanceKm - Distance to disaster in kilometers
 * @param {string} disasterType - Type of disaster (earthquake, flood, etc.)
 * @param {Object} disaster - Full disaster object (for additional metadata)
 * @returns {number} Probability between 0 and 1
 */
function calculateBlockageProbability(distanceKm, disasterType, disaster = {}) {
  if (!disasterType) return 0;

  // Normalize disaster type to lowercase
  const normalizedType = disasterType.toLowerCase();

  // Get the appropriate model
  const model = DISASTER_IMPACT_MODELS[normalizedType] || DISASTER_IMPACT_MODELS.default;

  // Extract additional parameters
  const severity = disaster.severity || disaster.alertlevel;
  const magnitude = disaster.magnitude ? parseFloat(disaster.magnitude) : undefined;
  const windSpeed = disaster.windspeed ? parseFloat(disaster.windspeed) : undefined;

  // Calculate probability using the model
  let probability = model.roadBlockage(distanceKm, severity || magnitude || windSpeed);

  // Cap at 1.0 and ensure minimum of 0
  return Math.max(0, Math.min(1, probability));
}

/**
 * Calculate bridge risk score
 * Bridges are critical chokepoints with higher vulnerability than regular roads
 * @param {Object} bridge - Bridge feature from OSM
 * @param {Object} nearestDisaster - { disaster, distance } from findNearestDisaster
 * @returns {Object} { riskScore, status, details }
 */
function calculateBridgeRisk(bridge, nearestDisaster) {
  if (!nearestDisaster || !nearestDisaster.disaster) {
    return {
      riskScore: 0,
      status: 'OPERATIONAL',
      details: 'No nearby disasters detected'
    };
  }

  const { disaster, distance } = nearestDisaster;
  const disasterType = getDisasterTypeKey(disaster);

  // Get appropriate model
  const model = DISASTER_IMPACT_MODELS[disasterType] || DISASTER_IMPACT_MODELS.default;

  // Extract disaster metadata
  const severity = disaster.severity || disaster.alertlevel;
  const magnitude = disaster.magnitude ? parseFloat(disaster.magnitude) : undefined;
  const windSpeed = disaster.windspeed ? parseFloat(disaster.windspeed) : undefined;

  // Calculate bridge-specific risk
  const riskScore = model.bridgeRisk(distance, severity || magnitude || windSpeed);

  // Determine status
  let status;
  if (riskScore > 0.7) status = 'CRITICAL';
  else if (riskScore > 0.5) status = 'HIGH_RISK';
  else if (riskScore > 0.3) status = 'MODERATE_RISK';
  else if (riskScore > 0.1) status = 'LOW_RISK';
  else status = 'OPERATIONAL';

  // Get bridge metadata
  const bridgeName = bridge.properties?.name || bridge.properties?.tags?.name || 'Unnamed bridge';
  const bridgeType = bridge.properties?.tags?.bridge || 'unknown';
  const highway = bridge.properties?.tags?.highway || 'unknown';

  return {
    riskScore: Math.round(riskScore * 100) / 100,
    status,
    details: `${bridgeName} (${bridgeType}) at ${distance.toFixed(1)}km from ${disasterType}`,
    bridgeName,
    bridgeType,
    highway,
    distanceToDisaster: distance,
    disasterType
  };
}

/**
 * Analyze road network accessibility
 * @param {Object} osmData - OSM infrastructure data (must include 'roads' and 'bridges')
 * @param {Array} disasters - Array of disaster objects
 * @param {Object} options - Analysis options
 * @param {number} options.criticalThreshold - Probability threshold for "blocked" (default: 0.6)
 * @param {boolean} options.includeBridges - Include bridge analysis (default: true)
 * @returns {Object} Road network analysis
 */
function analyzeRoadNetwork(osmData, disasters = [], options = {}) {
  const {
    criticalThreshold = 0.6,
    includeBridges = true
  } = options;

  // Validate inputs
  if (!osmData || !osmData.features) {
    return {
      error: 'Invalid OSM data provided',
      totalRoads: 0,
      accessibleRoads: 0,
      blockedRoads: 0,
      accessibilityScore: 0,
      status: 'UNKNOWN'
    };
  }

  // Filter roads and bridges
  const roads = osmData.features.filter(f => f.properties?.category === 'road');
  const bridges = osmData.features.filter(f => f.properties?.category === 'bridge');

  if (roads.length === 0 && bridges.length === 0) {
    return {
      error: 'No road or bridge data available',
      totalRoads: 0,
      accessibleRoads: 0,
      blockedRoads: 0,
      accessibilityScore: 0,
      status: 'NO_DATA'
    };
  }

  // If no disasters, all roads are accessible
  if (!disasters || disasters.length === 0) {
    return {
      totalRoads: roads.length,
      totalBridges: bridges.length,
      accessibleRoads: roads.length,
      blockedRoads: 0,
      accessibilityScore: 10,
      status: 'FULLY_ACCESSIBLE',
      details: 'No active disasters affecting road network',
      roadDetails: [],
      bridgeDetails: []
    };
  }

  // Analyze each road
  const roadAnalysis = roads.map(road => {
    const roadCenter = calculateCenter(road.geometry);
    if (!roadCenter) return null;

    const nearestDisaster = findNearestDisaster(roadCenter, disasters);
    if (!nearestDisaster) return { road, accessible: true, blockageProbability: 0 };

    const { disaster, distance } = nearestDisaster;
  const disasterType = getDisasterTypeKey(disaster);
    const blockageProbability = calculateBlockageProbability(distance, disasterType, disaster);

    return {
      road,
      accessible: blockageProbability < criticalThreshold,
      blockageProbability,
      nearestDisaster: {
        type: disasterType,
        distance,
        name: disaster.title || disaster.name || 'Unnamed disaster'
      }
    };
  }).filter(Boolean);

  // Analyze bridges
  let bridgeAnalysis = [];
  if (includeBridges) {
    bridgeAnalysis = bridges.map(bridge => {
      const bridgeCenter = calculateCenter(bridge.geometry);
      if (!bridgeCenter) return null;

      const nearestDisaster = findNearestDisaster(bridgeCenter, disasters);
      const bridgeRisk = calculateBridgeRisk(bridge, nearestDisaster);

      return {
        bridge,
        accessible: bridgeRisk.status === 'OPERATIONAL' || bridgeRisk.status === 'LOW_RISK',
        ...bridgeRisk
      };
    }).filter(Boolean);
  }

  // Calculate statistics
  const accessibleRoads = roadAnalysis.filter(r => r.accessible).length;
  const blockedRoads = roadAnalysis.length - accessibleRoads;
  const accessibleBridges = bridgeAnalysis.filter(b => b.accessible).length;
  const criticalBridges = bridgeAnalysis.filter(b => b.status === 'CRITICAL' || b.status === 'HIGH_RISK').length;

  // Calculate accessibility score (0-10)
  const roadAccessibility = roadAnalysis.length > 0 ? (accessibleRoads / roadAnalysis.length) : 1;
  const bridgeAccessibility = bridgeAnalysis.length > 0 ? (accessibleBridges / bridgeAnalysis.length) : 1;

  // Weight bridges more heavily as they are critical chokepoints
  const overallAccessibility = bridgeAnalysis.length > 0
    ? (roadAccessibility * 0.6 + bridgeAccessibility * 0.4)
    : roadAccessibility;

  const accessibilityScore = Math.round(overallAccessibility * 10 * 10) / 10;

  // Determine overall status
  let status;
  if (accessibilityScore >= 9) status = 'FULLY_ACCESSIBLE';
  else if (accessibilityScore >= 7) status = 'MOSTLY_ACCESSIBLE';
  else if (accessibilityScore >= 5) status = 'PARTIALLY_ACCESSIBLE';
  else if (accessibilityScore >= 3) status = 'SEVERELY_RESTRICTED';
  else status = 'CRITICALLY_BLOCKED';

  return {
    totalRoads: roads.length,
    totalBridges: bridges.length,
    accessibleRoads,
    blockedRoads,
    accessibleBridges,
    criticalBridges,
    accessibilityScore,
    status,
    details: `${accessibleRoads}/${roadAnalysis.length} roads accessible, ${criticalBridges} critical bridges at risk`,
    roadDetails: roadAnalysis.slice(0, 50), // Limit to prevent payload bloat
    bridgeDetails: bridgeAnalysis.slice(0, 20),
    summary: {
      majorHighways: roadAnalysis.filter(r =>
        r.road.properties?.tags?.highway === 'motorway' ||
        r.road.properties?.tags?.highway === 'trunk'
      ).length,
      accessibleMajorHighways: roadAnalysis.filter(r =>
        r.accessible && (
          r.road.properties?.tags?.highway === 'motorway' ||
          r.road.properties?.tags?.highway === 'trunk'
        )
      ).length
    }
  };
}

/**
 * Analyze fuel station accessibility
 * @param {Object} osmData - OSM infrastructure data
 * @param {Array} disasters - Array of disaster objects
 * @returns {Object} Fuel access analysis
 */
function analyzeFuelAccess(osmData, disasters = []) {
  if (!osmData || !osmData.features) {
    return {
      error: 'Invalid OSM data provided',
      totalFuelStations: 0,
      accessibleStations: 0,
      compromisedStations: 0,
      status: 'UNKNOWN'
    };
  }

  const fuelStations = osmData.features.filter(f => f.properties?.category === 'fuel');

  if (fuelStations.length === 0) {
    return {
      error: 'No fuel station data available',
      totalFuelStations: 0,
      accessibleStations: 0,
      compromisedStations: 0,
      status: 'NO_DATA'
    };
  }

  // If no disasters, all fuel stations accessible
  if (!disasters || disasters.length === 0) {
    return {
      totalFuelStations: fuelStations.length,
      accessibleStations: fuelStations.length,
      compromisedStations: 0,
      status: 'FULLY_ACCESSIBLE',
      nearestSafe: fuelStations[0] ? {
        name: fuelStations[0].properties.name,
        coordinates: fuelStations[0].geometry.type === 'Point'
          ? {
              latitude: fuelStations[0].geometry.coordinates[1],
              longitude: fuelStations[0].geometry.coordinates[0]
            }
          : null
      } : null
    };
  }

  // Analyze each fuel station
  const stationAnalysis = fuelStations.map(station => {
    const stationCenter = calculateCenter(station.geometry);
    if (!stationCenter) return null;

    const nearestDisaster = findNearestDisaster(stationCenter, disasters);
    if (!nearestDisaster) return { station, accessible: true, disruptionProbability: 0 };

    const { disaster, distance } = nearestDisaster;
    const disasterType = getDisasterTypeKey(disaster);

    // Get fuel-specific disruption model
    const model = DISASTER_IMPACT_MODELS[disasterType] || DISASTER_IMPACT_MODELS.default;
    const disruptionProbability = model.fuelDisruption(distance);

    return {
      station,
      accessible: disruptionProbability < 0.5, // 50% threshold for fuel
      disruptionProbability,
      distance: distance,
      disasterType,
      coordinates: stationCenter
    };
  }).filter(Boolean);

  // Find nearest safe fuel station
  const safeStations = stationAnalysis.filter(s => s.accessible).sort((a, b) => a.distance - b.distance);
  const nearestSafe = safeStations[0] || null;

  // Calculate statistics
  const accessibleStations = stationAnalysis.filter(s => s.accessible).length;
  const compromisedStations = stationAnalysis.length - accessibleStations;
  const accessibilityRatio = accessibleStations / stationAnalysis.length;

  // Determine status
  let status;
  if (accessibilityRatio >= 0.8) status = 'SUFFICIENT';
  else if (accessibilityRatio >= 0.5) status = 'LIMITED';
  else if (accessibilityRatio >= 0.2) status = 'SCARCE';
  else status = 'CRITICAL';

  return {
    totalFuelStations: fuelStations.length,
    accessibleStations,
    compromisedStations,
    status,
    nearestSafe: nearestSafe ? {
      name: nearestSafe.station.properties.name || 'Unnamed fuel station',
      distance: nearestSafe.distance.toFixed(1),
      coordinates: nearestSafe.coordinates
    } : null,
    details: `${accessibleStations}/${stationAnalysis.length} fuel stations accessible`,
    stationList: stationAnalysis.slice(0, 20) // Limit output
  };
}

/**
 * Analyze air access points (airports and helipads)
 * @param {Object} osmData - OSM infrastructure data
 * @param {Array} disasters - Array of disaster objects
 * @param {Object} options - Analysis options
 * @param {number} options.safetyBuffer - Minimum safe distance from disaster in km (default: 15)
 * @returns {Object} Air access analysis
 */
function analyzeAirAccess(osmData, disasters = [], options = {}) {
  const { safetyBuffer = 15 } = options;

  if (!osmData || !osmData.features) {
    return {
      error: 'Invalid OSM data provided',
      totalAirports: 0,
      operationalAirports: 0,
      status: 'UNKNOWN'
    };
  }

  const airFacilities = osmData.features.filter(f => f.properties?.category === 'airport');

  if (airFacilities.length === 0) {
    return {
      error: 'No airport/helipad data available',
      totalAirports: 0,
      operationalAirports: 0,
      status: 'NO_DATA',
      recommendation: 'No mapped air access points in area'
    };
  }

  // If no disasters, all facilities operational
  if (!disasters || disasters.length === 0) {
    const recommendedFacility = airFacilities[0];
    return {
      totalAirports: airFacilities.length,
      operationalAirports: airFacilities.length,
      status: 'FULLY_OPERATIONAL',
      recommended: recommendedFacility ? {
        name: recommendedFacility.properties.name || 'Unnamed facility',
        type: recommendedFacility.properties.tags?.aeroway || 'unknown',
        coordinates: calculateCenter(recommendedFacility.geometry)
      } : null
    };
  }

  // Analyze each air facility
  const facilityAnalysis = airFacilities.map(facility => {
    const facilityCenter = calculateCenter(facility.geometry);
    if (!facilityCenter) return null;

    const nearestDisaster = findNearestDisaster(facilityCenter, disasters);
    if (!nearestDisaster) return { facility, operational: true, riskScore: 0, distance: Infinity };

    const { disaster, distance } = nearestDisaster;
    const disasterType = getDisasterTypeKey(disaster);

    // Get airport-specific disruption model
    const model = DISASTER_IMPACT_MODELS[disasterType] || DISASTER_IMPACT_MODELS.default;
    const disruptionProbability = model.airportDisruption(distance);

    // Consider safety buffer
    const inSafeZone = distance >= safetyBuffer;
    const operational = disruptionProbability < 0.5 && inSafeZone;

    return {
      facility,
      operational,
      riskScore: disruptionProbability,
      distance,
      disasterType,
      inSafeZone,
      coordinates: facilityCenter,
      facilityType: facility.properties.tags?.aeroway || 'unknown'
    };
  }).filter(Boolean);

  // Find best operational facility
  const operationalFacilities = facilityAnalysis
    .filter(f => f.operational)
    .sort((a, b) => a.riskScore - b.riskScore || a.distance - b.distance);

  const recommended = operationalFacilities[0] || null;

  // Calculate statistics
  const operationalCount = operationalFacilities.length;
  const operationalRatio = operationalCount / facilityAnalysis.length;

  // Determine status
  let status;
  if (operationalRatio >= 0.8) status = 'FULLY_OPERATIONAL';
  else if (operationalRatio >= 0.5) status = 'PARTIALLY_OPERATIONAL';
  else if (operationalRatio >= 0.2) status = 'LIMITED_ACCESS';
  else status = 'CRITICALLY_COMPROMISED';

  return {
    totalAirports: airFacilities.length,
    operationalAirports: operationalCount,
    compromisedAirports: facilityAnalysis.length - operationalCount,
    status,
    recommended: recommended ? {
      name: recommended.facility.properties.name || 'Unnamed facility',
      type: recommended.facilityType,
      distance: recommended.distance.toFixed(1),
      riskScore: Math.round(recommended.riskScore * 100),
      coordinates: recommended.coordinates,
      safetyBuffer: `${safetyBuffer}km`
    } : null,
    details: `${operationalCount}/${facilityAnalysis.length} air facilities operational`,
    facilityList: facilityAnalysis.slice(0, 10) // Limit output
  };
}

/**
 * Calculate overall logistics access score
 * @param {Object} roadAnalysis - Result from analyzeRoadNetwork
 * @param {Object} fuelAnalysis - Result from analyzeFuelAccess
 * @param {Object} airAnalysis - Result from analyzeAirAccess
 * @returns {Object} Overall logistics assessment
 */
function calculateAccessScore(roadAnalysis, fuelAnalysis, airAnalysis, assessmentCoverage = {}) {
  // Handle missing or error analyses
  const roadScore = roadAnalysis?.accessibilityScore || 0;
  const fuelScore = fuelAnalysis?.status === 'SUFFICIENT' ? 10 :
                    fuelAnalysis?.status === 'LIMITED' ? 7 :
                    fuelAnalysis?.status === 'SCARCE' ? 4 : 2;
  const airScore = airAnalysis?.status === 'FULLY_OPERATIONAL' ? 10 :
                   airAnalysis?.status === 'PARTIALLY_OPERATIONAL' ? 7 :
                   airAnalysis?.status === 'LIMITED_ACCESS' ? 4 : 2;

  const componentWeights = [];
  if (assessmentCoverage.roads !== false) componentWeights.push({ key: 'roadAccess', score: roadScore, weight: 0.5 });
  if (assessmentCoverage.fuel !== false) componentWeights.push({ key: 'fuelAccess', score: fuelScore, weight: 0.25 });
  if (assessmentCoverage.air !== false) componentWeights.push({ key: 'airAccess', score: airScore, weight: 0.25 });

  const totalWeight = componentWeights.reduce((sum, component) => sum + component.weight, 0) || 1;
  const overallScore = componentWeights.reduce((sum, component) => sum + (component.score * component.weight), 0) / totalWeight;
  const roundedScore = Math.round(overallScore * 10) / 10;

  // Determine rating
  let rating, description;
  if (roundedScore >= 9) {
    rating = 'GOOD';
    description = 'Logistics access is excellent. All supply routes operational.';
  } else if (roundedScore >= 7) {
    rating = 'MODERATE';
    description = 'Logistics access is adequate but some routes compromised.';
  } else if (roundedScore >= 4) {
    rating = 'LIMITED';
    description = 'Logistics access is significantly restricted. Alternative routes needed.';
  } else {
    rating = 'CRITICAL';
    description = 'Logistics access is severely compromised. Immediate intervention required.';
  }

  // Generate recommendations
  const recommendations = [];
  if (roadScore < 7) {
    recommendations.push('Consider helicopter airlift for critical supplies due to road blockages');
  }
  if (fuelAnalysis?.status === 'SCARCE' || fuelAnalysis?.status === 'CRITICAL') {
    recommendations.push('Pre-position fuel reserves; establish fuel supply chain from safe areas');
  }
  if (airAnalysis?.status === 'CRITICALLY_COMPROMISED') {
    recommendations.push('All air access compromised; rely on ground transport or remote airstrips');
  }
  if (roadAnalysis?.criticalBridges > 0) {
    recommendations.push(`${roadAnalysis.criticalBridges} critical bridges at risk; assess structural integrity before use`);
  }

  return {
    score: roundedScore,
    rating,
    description,
    breakdown: Object.fromEntries([
      ['roadAccess', assessmentCoverage.roads === false ? { score: null, weight: 'not assessed' } : { score: roadScore, weight: '50%' }],
      ['fuelAccess', assessmentCoverage.fuel === false ? { score: null, weight: 'not assessed' } : { score: fuelScore, weight: '25%' }],
      ['airAccess', assessmentCoverage.air === false ? { score: null, weight: 'not assessed' } : { score: airScore, weight: '25%' }]
    ]),
    recommendations,
    detailedAnalysis: {
      roads: roadAnalysis?.status || 'UNKNOWN',
      fuel: fuelAnalysis?.status || 'UNKNOWN',
      air: airAnalysis?.status || 'UNKNOWN'
    }
  };
}

function calculateSecurityScore(acledEvents = []) {
  if (!acledEvents || acledEvents.length === 0) {
    return {
      score: 10,
      level: 'LOW',
      incidentCount: 0,
      fatalities: 0,
      weightedIncidentScore: 0,
      description: 'No recent ACLED security incidents in the assessed area.'
    };
  }

  const severityWeights = {
    'Battles': 2.5,
    'Explosions/Remote violence': 2.3,
    'Violence against civilians': 2.7,
    'Riots': 1.4,
    'Protests': 0.8,
    'Strategic developments': 1.2
  };

  const weightedIncidentScore = acledEvents.reduce((sum, event) => {
    const eventWeight = severityWeights[event.event_type] || 1.0;
    const fatalitiesWeight = Math.min(3, (parseInt(event.fatalities, 10) || 0) * 0.2);
    return sum + eventWeight + fatalitiesWeight;
  }, 0);

  const fatalities = acledEvents.reduce((sum, event) => sum + (parseInt(event.fatalities, 10) || 0), 0);
  const scorePenalty = Math.min(8, weightedIncidentScore / 6);
  const score = Math.max(2, Math.round((10 - scorePenalty) * 10) / 10);

  let level = 'LOW';
  if (score < 4) level = 'CRITICAL';
  else if (score < 6) level = 'HIGH';
  else if (score < 8) level = 'MEDIUM';

  return {
    score,
    level,
    incidentCount: acledEvents.length,
    fatalities,
    weightedIncidentScore: Math.round(weightedIncidentScore * 10) / 10,
    description:
      level === 'CRITICAL' ? 'Severe insecurity likely to constrain movement and route reliability.' :
      level === 'HIGH' ? 'Elevated insecurity will require movement controls and tighter route planning.' :
      level === 'MEDIUM' ? 'Moderate insecurity present; monitor movement windows and escorts as needed.' :
      'Security conditions present limited direct constraints on logistics operations.'
  };
}

function calculateAccessScoreWithSecurity(roadAnalysis, fuelAnalysis, airAnalysis, securityAnalysis, assessmentCoverage = {}) {
  const base = calculateAccessScore(roadAnalysis, fuelAnalysis, airAnalysis, assessmentCoverage);
  const securityScore = securityAnalysis?.score ?? 10;
  let securityWeight = 0;

  if (securityAnalysis?.incidentCount > 0) {
    if (securityAnalysis.level === 'CRITICAL') securityWeight = 0.45;
    else if (securityAnalysis.level === 'HIGH') securityWeight = 0.35;
    else if (securityAnalysis.level === 'MEDIUM') securityWeight = 0.25;
    else securityWeight = 0.15;
  }

  const baseWeight = 1 - securityWeight;
  const overallScore = Math.round(((base.score * baseWeight) + (securityScore * securityWeight)) * 10) / 10;

  return {
    ...base,
    score: overallScore,
    breakdown: {
      ...base.breakdown,
      securityAccess: {
        score: securityScore,
        weight: securityWeight > 0 ? `${Math.round(securityWeight * 100)}%` : 'not assessed'
      }
    },
    detailedAnalysis: {
      ...base.detailedAnalysis,
      security: securityAnalysis?.level || 'LOW'
    }
  };
}

/**
 * Find alternative routes when primary routes are blocked
 * @param {Object} osmData - OSM infrastructure data
 * @param {Array} disasters - Array of disaster objects
 * @param {Object} origin - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 * @param {Object} options - Route finding options
 * @returns {Object} Alternative route suggestions
 */
function findAlternativeRoutes(osmData, disasters, origin, destination, options = {}) {
  const { maxDetourMultiplier = 2.0, minSafeDistance = 10 } = options;

  // Validate inputs
  if (!osmData || !osmData.features) {
    return { error: 'Invalid OSM data', alternatives: [] };
  }
  if (!origin || !destination) {
    return { error: 'Origin and destination required', alternatives: [] };
  }
  if (!origin.latitude || !destination.latitude) {
    return { error: 'Invalid coordinates', alternatives: [] };
  }

  // Calculate direct distance
  const directDistance = getDistance(origin, destination) / 1000; // km

  // Get roads
  const roads = osmData.features.filter(f => f.properties?.category === 'road');
  if (roads.length === 0) {
    return {
      directDistance,
      alternatives: [],
      message: 'No road data available for route analysis'
    };
  }

  // If no disasters, suggest direct route
  if (!disasters || disasters.length === 0) {
    return {
      directDistance,
      alternatives: [{
        type: 'DIRECT',
        description: 'Direct route - no disasters detected',
        estimatedDistance: directDistance,
        estimatedTime: `${Math.round(directDistance / 40)} hours`, // Assume 40 km/h
        viability: 'RECOMMENDED'
      }],
      recommendation: 'Use direct route'
    };
  }

  // Check if direct route passes through disaster zones
  const directRouteCompromised = disasters.some(disaster => {
    const disasterCoords = disaster.latitude && disaster.longitude
      ? { latitude: parseFloat(disaster.latitude), longitude: parseFloat(disaster.longitude) }
      : calculateCenter(disaster.geometry);

    if (!disasterCoords) return false;

    // Check if disaster is close to the straight line between origin and destination
    const distToOrigin = getDistance(disasterCoords, origin) / 1000;
    const distToDestination = getDistance(disasterCoords, destination) / 1000;

    // If disaster is roughly between origin and destination, route is compromised
    return (distToOrigin + distToDestination) < (directDistance + minSafeDistance);
  });

  // Generate alternatives
  const alternatives = [];

  // Alternative 1: Direct route (if viable)
  if (!directRouteCompromised) {
    alternatives.push({
      type: 'DIRECT',
      description: 'Direct route appears safe',
      estimatedDistance: directDistance,
      estimatedTime: `${Math.round(directDistance / 40)} hours`,
      detourFactor: 1.0,
      viability: 'RECOMMENDED'
    });
  } else {
    alternatives.push({
      type: 'DIRECT',
      description: 'Direct route compromised by disaster zones',
      estimatedDistance: directDistance,
      estimatedTime: 'BLOCKED',
      detourFactor: 1.0,
      viability: 'NOT_RECOMMENDED'
    });
  }

  // Alternative 2: Eastern detour
  alternatives.push({
    type: 'EASTERN_DETOUR',
    description: 'Route via eastern areas away from disaster zones',
    estimatedDistance: directDistance * 1.4,
    estimatedTime: `${Math.round((directDistance * 1.4) / 35)} hours`,
    detourFactor: 1.4,
    viability: directDistance * 1.4 < directDistance * maxDetourMultiplier ? 'VIABLE' : 'EXCESSIVE_DETOUR'
  });

  // Alternative 3: Western detour
  alternatives.push({
    type: 'WESTERN_DETOUR',
    description: 'Route via western areas away from disaster zones',
    estimatedDistance: directDistance * 1.5,
    estimatedTime: `${Math.round((directDistance * 1.5) / 35)} hours`,
    detourFactor: 1.5,
    viability: directDistance * 1.5 < directDistance * maxDetourMultiplier ? 'VIABLE' : 'EXCESSIVE_DETOUR'
  });

  // Alternative 4: Air transport (if direct road compromised)
  if (directRouteCompromised) {
    alternatives.push({
      type: 'AIR_TRANSPORT',
      description: 'Helicopter or air transport to bypass ground obstacles',
      estimatedDistance: directDistance,
      estimatedTime: `${Math.round(directDistance / 150)} hours`, // Assume 150 km/h
      detourFactor: 1.0,
      viability: 'VIABLE',
      note: 'Requires helicopter or small aircraft'
    });
  }

  // Determine best recommendation
  const viableRoutes = alternatives.filter(a =>
    a.viability === 'RECOMMENDED' || a.viability === 'VIABLE'
  );

  const recommendation = viableRoutes.length > 0
    ? `Recommended: ${viableRoutes[0].type}`
    : 'All routes severely compromised - consider delaying or air transport';

  return {
    directDistance,
    directRouteCompromised,
    alternatives,
    recommendation,
    notes: [
      'Route analysis is approximate - ground reconnaissance recommended',
      'Travel times assume average speeds and may vary significantly',
      'Check road conditions and bridge status before departure'
    ]
  };
}

/**
 * Get logistics rating based on access score
 * @param {number} accessScore - Access score (0-10)
 * @returns {string} Rating (EXCELLENT, GOOD, MODERATE, DIFFICULT, CRITICAL)
 */
function getLogisticsRating(accessScore) {
  if (accessScore >= 8) return 'EXCELLENT';
  if (accessScore >= 6) return 'GOOD';
  if (accessScore >= 4) return 'MODERATE';
  if (accessScore >= 2) return 'DIFFICULT';
  return 'CRITICAL';
}

module.exports = {
  // Main analysis functions
  analyzeRoadNetwork,
  analyzeFuelAccess,
  analyzeAirAccess,
  calculateAccessScore,
  calculateSecurityScore,
  calculateAccessScoreWithSecurity,
  findAlternativeRoutes,
  getLogisticsRating,

  // Helper functions
  calculateBlockageProbability,
  calculateBridgeRisk,
  findNearestDisaster,
  calculateCenter,

  // Constants (for testing and configuration)
  DISASTER_IMPACT_MODELS
};
