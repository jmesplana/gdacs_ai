/**
 * Facility Clustering Utilities
 * Groups facilities by geographic proximity to reduce API calls
 */

import { getDistance } from 'geolib';

/**
 * Cluster facilities within a radius
 * @param {Array} facilities - Array of facility objects with latitude/longitude
 * @param {number} radiusKm - Clustering radius in kilometers
 * @returns {Array} Array of clusters with centroids and facilities
 */
export function clusterFacilities(facilities, radiusKm = 50) {
  if (!facilities || facilities.length === 0) return [];

  const clusters = [];
  const assigned = new Set();

  facilities.forEach((facility, idx) => {
    if (assigned.has(idx)) return;

    const cluster = {
      id: `cluster_${clusters.length}`,
      centroid: {
        latitude: facility.latitude,
        longitude: facility.longitude,
      },
      facilities: [facility],
      facilityIds: [facility.id || idx],
    };

    // Find nearby facilities
    facilities.forEach((other, otherIdx) => {
      if (otherIdx === idx || assigned.has(otherIdx)) return;

      const distance = getDistance(
        { latitude: facility.latitude, longitude: facility.longitude },
        { latitude: other.latitude, longitude: other.longitude }
      ) / 1000; // Convert meters to km

      if (distance <= radiusKm) {
        cluster.facilities.push(other);
        cluster.facilityIds.push(other.id || otherIdx);
        assigned.add(otherIdx);
      }
    });

    assigned.add(idx);

    // Recalculate centroid as average of all facilities in cluster
    cluster.centroid = calculateCentroid(cluster.facilities);
    cluster.radius = calculateClusterRadius(cluster.centroid, cluster.facilities);
    cluster.facilityCount = cluster.facilities.length;

    clusters.push(cluster);
  });

  return clusters;
}

/**
 * Calculate geographic centroid of facilities
 */
export function calculateCentroid(facilities) {
  if (facilities.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;

  facilities.forEach(f => {
    sumLat += f.latitude;
    sumLng += f.longitude;
  });

  return {
    latitude: sumLat / facilities.length,
    longitude: sumLng / facilities.length,
  };
}

/**
 * Calculate maximum distance from centroid to any facility
 */
export function calculateClusterRadius(centroid, facilities) {
  if (!centroid || facilities.length === 0) return 0;

  let maxDistance = 0;

  facilities.forEach(f => {
    const distance = getDistance(
      { latitude: centroid.latitude, longitude: centroid.longitude },
      { latitude: f.latitude, longitude: f.longitude }
    ) / 1000; // Convert to km

    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });

  return Math.round(maxDistance * 10) / 10; // Round to 1 decimal
}

/**
 * Get clustering statistics
 */
export function getClusteringStats(facilities, clusters) {
  const totalFacilities = facilities.length;
  const totalClusters = clusters.length;
  const reductionPercentage = ((1 - totalClusters / totalFacilities) * 100).toFixed(1);

  const facilitiesPerCluster = clusters.map(c => c.facilityCount);
  const avgFacilitiesPerCluster = (facilitiesPerCluster.reduce((a, b) => a + b, 0) / totalClusters).toFixed(1);

  return {
    totalFacilities,
    totalClusters,
    apiCallReduction: reductionPercentage + '%',
    avgFacilitiesPerCluster: parseFloat(avgFacilitiesPerCluster),
    largestCluster: Math.max(...facilitiesPerCluster),
    smallestCluster: Math.min(...facilitiesPerCluster),
  };
}

/**
 * Apply cluster data to all facilities in cluster
 * @param {Array} clusters - Clusters with weather/prediction data
 * @param {string} dataKey - Key name for the data (e.g., 'weatherForecast', 'predictions')
 */
export function distributeCl usterData(clusters, dataKey) {
  const facilitiesWithData = [];

  clusters.forEach(cluster => {
    if (!cluster[dataKey]) return;

    cluster.facilities.forEach(facility => {
      facilitiesWithData.push({
        ...facility,
        [dataKey]: cluster[dataKey],
        clusterId: cluster.id,
        clusterCentroid: cluster.centroid,
        clusterRadius: cluster.radius,
      });
    });
  });

  return facilitiesWithData;
}
