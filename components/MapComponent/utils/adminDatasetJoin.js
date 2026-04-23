import { parseMetricValue } from './adminDatasetStyling';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, '').trim());
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

function isWithinBounds(point, bounds) {
  if (!bounds) return true;
  const [lng, lat] = point;
  return lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat;
}

function getRowPoint(row = {}) {
  const latitude = toNumber(row.latitude ?? row.lat);
  const longitude = toNumber(row.longitude ?? row.lng ?? row.lon);

  if (latitude === null || longitude === null) return null;
  return [longitude, latitude];
}

export function findContainingDistrict(row, districts = []) {
  const point = getRowPoint(row);
  if (!point) return null;

  return districts.find((district) => {
    if (!district?.geometry) return false;
    if (!isWithinBounds(point, district.bounds)) return false;

    try {
      return isPointInGeometry(point, district.geometry);
    } catch (_) {
      return false;
    }
  }) || null;
}

export function buildAdminDatasetJoin(rows = [], districts = [], metricField = null) {
  const byDistrictId = {};
  let matchedRows = 0;
  let unmatchedRows = 0;

  rows.forEach((row) => {
    const district = findContainingDistrict(row, districts);
    if (!district) {
      unmatchedRows += 1;
      return;
    }

    matchedRows += 1;
    const districtId = district.id;
    const existing = byDistrictId[districtId] || {
      districtId,
      districtName: district.name,
      rows: [],
      values: {}
    };

    existing.rows.push(row);

    if (metricField) {
      const value = parseMetricValue(row[metricField]);
      if (Number.isFinite(value)) {
        const values = existing.values[metricField] || [];
        values.push(value);
        existing.values[metricField] = values;
      }
    }

    byDistrictId[districtId] = existing;
  });

  Object.values(byDistrictId).forEach((entry) => {
    entry.aggregated = {};
    Object.entries(entry.values).forEach(([field, values]) => {
      if (!values.length) return;
      const sum = values.reduce((total, value) => total + value, 0);
      entry.aggregated[field] = {
        value: sum / values.length,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    });
  });

  return {
    byDistrictId,
    matchedRows,
    unmatchedRows,
    matchedDistricts: Object.keys(byDistrictId).length,
    totalRows: rows.length
  };
}
