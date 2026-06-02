import { buildAdminDatasetJoin } from './adminDatasetJoin';

export const DEFAULT_METRIC_BUBBLE_COLOR = '#2563eb';

export function buildMetricBubbleJoin({
  rows = [],
  districts = [],
  metricField = ''
} = {}) {
  if (!metricField) {
    return {
      byDistrictId: {},
      matchedRows: 0,
      unmatchedRows: 0,
      matchedDistricts: 0,
      totalRows: rows?.length || 0
    };
  }

  return buildAdminDatasetJoin(rows, districts, metricField);
}

export function buildMetricBubbleFeatures({
  districts = [],
  join = null,
  metricField = '',
  getDistrictCenter
} = {}) {
  if (!metricField || !join || typeof getDistrictCenter !== 'function') return [];

  return (districts || [])
    .map((district) => {
      const metric = join.byDistrictId?.[district.id]?.aggregated?.[metricField];
      const value = metric?.value;
      if (!Number.isFinite(value)) return null;

      const center = getDistrictCenter(district);
      if (!center) return null;

      return {
        id: district.id,
        name: district.name || 'Admin area',
        latitude: center.latitude,
        longitude: center.longitude,
        value,
        count: metric.count || 0
      };
    })
    .filter(Boolean);
}

export function buildMetricBubbleScale(values = [], options = {}) {
  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) return null;

  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const minRadius = Number(options.minRadius) || 7;
  const maxRadius = Number(options.maxRadius) || 34;

  return {
    min,
    max,
    minRadius,
    maxRadius,
    radiusForValue: (value) => {
      if (!Number.isFinite(value)) return minRadius;
      if (min === max) return Math.round((minRadius + maxRadius) / 2);

      const clamped = Math.max(min, Math.min(max, value));
      const ratio = (clamped - min) / (max - min);
      return minRadius + Math.sqrt(ratio) * (maxRadius - minRadius);
    }
  };
}

export function buildMetricBubbleLegend({
  metricField = '',
  color = DEFAULT_METRIC_BUBBLE_COLOR,
  scale = null,
  features = [],
  selectedMetric = null,
  join = null
} = {}) {
  if (!metricField || !scale) return null;

  return {
    field: metricField,
    color,
    min: scale.min,
    max: scale.max,
    minRadius: scale.minRadius,
    maxRadius: scale.maxRadius,
    count: features.length,
    isPercent: Boolean(selectedMetric?.isPercent),
    matchedRows: join?.matchedRows ?? 0,
    totalRows: join?.totalRows ?? 0
  };
}
