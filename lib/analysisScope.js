import { isPointInDistricts } from './districtRiskScoring';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function getFeatureCoordinates(geometry = null) {
  if (!geometry?.type || !geometry?.coordinates) return [];

  if (geometry.type === 'Point') {
    return [geometry.coordinates];
  }

  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
    return geometry.coordinates;
  }

  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') {
    return geometry.coordinates.flat();
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2);
  }

  return [];
}

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
    const coordinates = getFeatureCoordinates(feature?.geometry);

    return coordinates.some((coord) => {
      const longitude = toNumber(coord?.[0]);
      const latitude = toNumber(coord?.[1]);

      if (latitude === null || longitude === null) return false;
      return isPointInDistricts(latitude, longitude, selectedDistricts);
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
