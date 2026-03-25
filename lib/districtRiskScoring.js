import { point as turfPoint } from '@turf/helpers';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isPointOnSegment(point, start, end) {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1);

  if (Math.abs(cross) > 1e-10) return false;

  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= 1e-10;
}

function isPointInRing(point, ring = []) {
  if (ring.length < 4) return false;

  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const start = ring[i];
    const end = ring[j];

    if (!Array.isArray(start) || !Array.isArray(end)) continue;
    if (isPointOnSegment(point, start, end)) return true;

    const [xi, yi] = start;
    const [xj, yj] = end;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInPolygonCoordinates(point, polygon = []) {
  if (!polygon.length || !isPointInRing(point, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (isPointInRing(point, polygon[i])) return false;
  }

  return true;
}

function isPointInGeometry(point, geometry) {
  if (!geometry?.type || !geometry?.coordinates) return false;

  if (geometry.type === 'Polygon') {
    return isPointInPolygonCoordinates(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => isPointInPolygonCoordinates(point, polygon));
  }

  return false;
}

export function hasUsableGeometry(feature) {
  return !!(feature?.geometry?.type && feature?.geometry?.coordinates);
}

export function isPointInDistricts(latitude, longitude, districts = []) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  if (lat === null || lng === null || !districts.length) return false;

  const candidatePoint = turfPoint([lng, lat]).geometry.coordinates;

  return districts.some((district) => {
    if (!hasUsableGeometry(district)) return false;

    try {
      return isPointInGeometry(candidatePoint, district.geometry);
    } catch (_) {
      return false;
    }
  });
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

export function scoreDistrictRisk(district, { disasters = [], acledData = [] } = {}) {
  let disasterScore = 0;
  let securityScore = 0;
  let disasterCount = 0;
  let acledCount = 0;

  disasters.forEach((disaster) => {
    if (!isPointInDistricts(disaster.latitude, disaster.longitude, [district])) return;
    disasterCount += 1;
    disasterScore += getDisasterWeight(disaster);
  });

  acledData.forEach((event) => {
    if (!isPointInDistricts(event.latitude, event.longitude, [district])) return;
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
