import { toNumber } from './geo/coordinates.js';
import { isPointInDistricts } from './geo/geometry.js';
import booleanIntersects from '@turf/boolean-intersects';

function countByCategory(features = []) {
  return features.reduce((acc, feature) => {
    const category = feature?.properties?.category;
    if (!category) return acc;
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
}

export function getDistrictScopeKeys(district = {}, index = 0) {
  const props = district.properties || {};

  return [
    String(district.id ?? index),
    district.name,
    props.ADM2_EN,
    props.NAME_2,
    props.NAME,
    props.name,
    props.district,
    district.id ?? index
  ].filter(Boolean);
}

export function getScopedWorldPopData(worldPopData = {}, selectedDistricts = []) {
  if (!worldPopData || !selectedDistricts.length) return {};

  const scoped = {};

  selectedDistricts.forEach((district, index) => {
    getDistrictScopeKeys(district, index).forEach((key) => {
      if (worldPopData[key] && !scoped[key]) {
        scoped[key] = worldPopData[key];
      }
    });
  });

  return scoped;
}

export function filterItemsToDistricts(items = [], selectedDistricts = [], latitudeKey = 'latitude', longitudeKey = 'longitude') {
  if (!Array.isArray(items) || selectedDistricts.length === 0) return Array.isArray(items) ? items : [];

  return items.filter((item) => {
    const latitude = toNumber(item?.[latitudeKey]);
    const longitude = toNumber(item?.[longitudeKey]);

    if (latitude === null || longitude === null) return false;
    return isPointInDistricts(latitude, longitude, selectedDistricts);
  });
}

export function filterFacilitiesToDistricts(facilities = [], selectedDistricts = []) {
  return filterItemsToDistricts(facilities, selectedDistricts, 'latitude', 'longitude');
}

export function filterImpactedFacilitiesToDistricts(impactedFacilities = [], selectedDistricts = []) {
  if (!Array.isArray(impactedFacilities) || selectedDistricts.length === 0) {
    return Array.isArray(impactedFacilities) ? impactedFacilities : [];
  }

  return impactedFacilities.filter((item) => {
    const facility = item?.facility || {};
    return isPointInDistricts(facility.latitude, facility.longitude, selectedDistricts);
  });
}

export function filterOsmDataToDistricts(osmData = null, selectedDistricts = []) {
  if (!osmData?.features || selectedDistricts.length === 0) return osmData;

  const filteredFeatures = osmData.features.filter((feature) => {
    return selectedDistricts.some((district) => {
      if (!feature?.geometry || !district?.geometry) return false;
      try {
        return booleanIntersects(feature.geometry, district.geometry);
      } catch (_) {
        return false;
      }
    });
  });

  return {
    ...osmData,
    features: filteredFeatures,
    metadata: {
      ...(osmData.metadata || {}),
      totalFeatures: filteredFeatures.length,
      byLayer: countByCategory(filteredFeatures)
    }
  };
}
