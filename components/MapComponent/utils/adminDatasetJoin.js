import { parseMetricValue } from './adminDatasetStyling';
import { toNumber } from '../../../lib/geo/coordinates.js';
import { isPointInGeometry } from '../../../lib/geo/geometry.js';

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
