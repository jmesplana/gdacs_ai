import {
  getNumericFields,
  isPercentLikeField,
  parseMetricValue,
  suggestMetricMeaning
} from './adminDatasetStyling';
import { summarizeDistrictAttributes } from '../../../lib/adminProperties';

export const ADMIN_METRIC_SOURCES = {
  UPLOADED_ROWS: 'uploaded_rows',
  ADMIN_PROPERTIES: 'admin_properties'
};

function buildMetricId(source, field) {
  return `${source}:${field}`;
}

function getDistrictNumericAttributes(district = {}) {
  return summarizeDistrictAttributes(district, { maxFields: 160, maxDepth: 6 })
    .map((attribute) => ({
      ...attribute,
      numericValue: parseMetricValue(attribute.value)
    }))
    .filter((attribute) => Number.isFinite(attribute.numericValue));
}

export function buildAdminMetricCatalog(rows = [], districts = []) {
  const uploadedMetrics = getNumericFields(rows).map((item) => ({
    ...item,
    id: buildMetricId(ADMIN_METRIC_SOURCES.UPLOADED_ROWS, item.field),
    source: ADMIN_METRIC_SOURCES.UPLOADED_ROWS,
    label: item.field
  }));

  const adminFieldStats = new Map();
  (districts || []).forEach((district) => {
    getDistrictNumericAttributes(district).forEach((attribute) => {
      const field = attribute.label || attribute.path;
      if (!field) return;

      const stats = adminFieldStats.get(field) || {
        field,
        label: field,
        path: attribute.path,
        count: 0,
        values: []
      };
      stats.count += 1;
      stats.values.push(attribute.numericValue);
      adminFieldStats.set(field, stats);
    });
  });

  const adminMetrics = Array.from(adminFieldStats.values())
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field))
    .map((item) => ({
      id: buildMetricId(ADMIN_METRIC_SOURCES.ADMIN_PROPERTIES, item.field),
      field: item.field,
      label: item.label,
      path: item.path,
      source: ADMIN_METRIC_SOURCES.ADMIN_PROPERTIES,
      count: item.count,
      isPercent: isPercentLikeField(item.field, item.values),
      suggestedMeaning: suggestMetricMeaning(item.field)
    }));

  return [...uploadedMetrics, ...adminMetrics];
}

export function buildAdminPropertyMetricJoin(districts = [], metricField = '') {
  const byDistrictId = {};
  let matchedDistricts = 0;

  (districts || []).forEach((district) => {
    const attribute = getDistrictNumericAttributes(district).find((item) => (
      item.label === metricField || item.path === metricField
    ));
    if (!attribute) return;

    matchedDistricts += 1;
    byDistrictId[district.id] = {
      districtId: district.id,
      districtName: district.name,
      rows: [district.properties || {}],
      values: {
        [metricField]: [attribute.numericValue]
      },
      aggregated: {
        [metricField]: {
          value: attribute.numericValue,
          count: 1,
          min: attribute.numericValue,
          max: attribute.numericValue
        }
      }
    };
  });

  return {
    byDistrictId,
    matchedRows: matchedDistricts,
    unmatchedRows: Math.max((districts || []).length - matchedDistricts, 0),
    matchedDistricts,
    totalRows: (districts || []).length
  };
}

export function isAdminPropertyMetric(metric = null) {
  return metric?.source === ADMIN_METRIC_SOURCES.ADMIN_PROPERTIES;
}
