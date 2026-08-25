import { toNumber } from './geo/coordinates.js';
import { isPointInDistricts, isPointInGeometry } from './geo/geometry.js';

export { isPointInDistricts } from './geo/geometry.js';

export function hasUsableGeometry(feature) {
  return !!(feature?.geometry?.type && feature?.geometry?.coordinates);
}

function getDisasterWeight(disaster = {}) {
  const severity = String(disaster.severity || '').toLowerCase();
  const alertLevel = String(disaster.alertLevel || '').toLowerCase();

  if (severity.includes('extreme') || alertLevel === 'red') return 10;
  if (severity.includes('severe') || alertLevel === 'orange') return 7;
  if (severity.includes('moderate') || alertLevel === 'yellow') return 5;
  return 3;
}

function getAcledBaseWeight(event = {}) {
  const eventType = String(event.event_type || '').toLowerCase();

  if (eventType.includes('violence against civilians')) return 10;
  if (eventType.includes('battles') || eventType.includes('explosion')) return 8;
  if (eventType.includes('riots') || eventType.includes('protests')) return 4;
  if (eventType.includes('strategic development')) return 2;
  return 2;
}

function getFatalityWeight(event = {}) {
  const fatalities = toNumber(event.fatalities) || 0;

  if (fatalities > 10) return 10;
  if (fatalities > 5) return 7;
  if (fatalities > 0) return 3;
  return 0;
}

export function getDistrictRiskLevel(score) {
  if (score === 0) return 'none';
  if (score < 10) return 'low';
  if (score < 20) return 'medium';
  if (score < 40) return 'high';
  return 'very-high';
}

const boundsCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

function calculateGeometryBounds(geometry = null) {
  if (!geometry?.coordinates) return null;
  if (boundsCache?.has(geometry)) return boundsCache.get(geometry);

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const visit = (coords) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lng = toNumber(coords[0]);
      const lat = toNumber(coords[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    coords.forEach(visit);
  };

  visit(geometry.coordinates);

  const bounds = Number.isFinite(minLng) && Number.isFinite(maxLng) && Number.isFinite(minLat) && Number.isFinite(maxLat)
    ? { minLng, maxLng, minLat, maxLat }
    : null;

  boundsCache?.set(geometry, bounds);
  return bounds;
}

function getDistrictBounds(district = {}) {
  return district.bounds || calculateGeometryBounds(district.geometry);
}

function pointIsInBounds(latitude, longitude, bounds) {
  if (!bounds) return true;
  return longitude >= bounds.minLng &&
    longitude <= bounds.maxLng &&
    latitude >= bounds.minLat &&
    latitude <= bounds.maxLat;
}

function pointIsInDistrict(latitude, longitude, district = {}) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!pointIsInBounds(lat, lng, getDistrictBounds(district))) return false;
  return isPointInGeometry([lng, lat], district.geometry);
}

export function scoreDistrictRisk(district, { disasters = [], acledData = [] } = {}) {
  let disasterScore = 0;
  let securityScore = 0;
  let disasterCount = 0;
  let acledCount = 0;

  disasters.forEach((disaster) => {
    if (!pointIsInDistrict(disaster.latitude, disaster.longitude, district)) return;
    disasterCount += 1;
    disasterScore += getDisasterWeight(disaster);
  });

  acledData.forEach((event) => {
    if (!pointIsInDistrict(event.latitude, event.longitude, district)) return;
    acledCount += 1;
    securityScore += getAcledBaseWeight(event) + getFatalityWeight(event);
  });

  const score = disasterScore + securityScore;

  return {
    disasterCount,
    acledCount,
    eventCount: disasterCount + acledCount,
    disasterScore,
    securityScore,
    score,
    level: getDistrictRiskLevel(score)
  };
}

export function buildDistrictRiskIndex(districts = [], { disasters = [], acledData = [] } = {}) {
  return districts.reduce((acc, district) => {
    const risk = scoreDistrictRisk(district, { disasters, acledData });
    const props = district.properties || {};
    const keys = [
      district.id,
      district.name,
      props.ADM2_EN,
      props.NAME_2,
      props.NAME,
      props.name
    ].filter(Boolean);

    if (!keys.length) return acc;
    keys.forEach((key) => {
      acc[key] = risk;
    });
    return acc;
  }, {});
}
