export const ADMIN_FILL_MODES = {
  NONE: 'none',
  RISK: 'risk',
  DATASET: 'dataset'
};

export const ADMIN_METRIC_MEANINGS = {
  WORSE_HIGH: 'worse_high',
  BETTER_HIGH: 'better_high',
  NEUTRAL: 'neutral'
};

export const ADMIN_CLASSIFICATION_METHODS = {
  QUANTILE: 'quantile',
  EQUAL_INTERVAL: 'equal_interval'
};

export const NO_DATA_STYLES = {
  TRANSPARENT: 'transparent',
  GRAY: 'gray'
};

export const RISK_COLORS = {
  'very-high': '#d32f2f',
  high: '#f57c00',
  medium: '#fbc02d',
  low: '#7cb342',
  none: '#89CFF0'
};

export const RISK_BORDER_COLORS = {
  'very-high': '#b71c1c',
  high: '#e65100',
  medium: '#f9a825',
  low: '#558b2f',
  none: '#2D5A7B'
};

const WORSE_HIGH_PALETTE = ['#fee2e2', '#fca5a5', '#f87171', '#ef4444', '#b91c1c'];
const BETTER_HIGH_PALETTE = ['#dcfce7', '#86efac', '#4ade80', '#16a34a', '#166534'];
const NEUTRAL_PALETTE = ['#dbeafe', '#93c5fd', '#60a5fa', '#2563eb', '#1e3a8a'];

const WORSE_HIGH_KEYWORDS = [
  'refusal', 'risk', 'case', 'cases', 'incidence', 'mortality', 'death', 'fatal',
  'stockout', 'stock_out', 'missed', 'dropout', 'drop_out', 'zero_dose',
  'unvaccinated', 'insecurity', 'conflict', 'violence', 'delay', 'distance',
  'travel_time', 'gap', 'deficit', 'failure'
];

const BETTER_HIGH_KEYWORDS = [
  'coverage', 'readiness', 'availability', 'available', 'capacity', 'completion',
  'completed', 'accessibility', 'supply', 'staffing', 'performance', 'score',
  'success', 'recovery'
];

const NEUTRAL_KEYWORDS = [
  'target', 'population', 'pop', 'budget', 'doses', 'dose', 'facility',
  'facilities', 'household', 'households', 'count', 'total', 'admin'
];

export function getRiskColor(level = 'none') {
  return RISK_COLORS[level] || RISK_COLORS.none;
}

export function getRiskBorderColor(level = 'none') {
  return RISK_BORDER_COLORS[level] || RISK_BORDER_COLORS.none;
}

export function parseMetricValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const normalized = String(value)
    .trim()
    .replace(/,/g, '')
    .replace(/%$/, '');

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isPercentLikeField(field = '', values = []) {
  const normalized = field.toLowerCase();
  if (/%|percent|percentage|pct|rate|ratio/.test(normalized)) return true;

  const numericValues = values.filter((value) => Number.isFinite(value));
  if (!numericValues.length) return false;
  const max = Math.max(...numericValues);
  const min = Math.min(...numericValues);
  return min >= 0 && max <= 1;
}

export function formatMetricValue(value, { isPercent = false } = {}) {
  if (!Number.isFinite(value)) return 'No data';

  if (isPercent) {
    const displayValue = value <= 1 ? value * 100 : value;
    return `${displayValue.toLocaleString(undefined, { maximumFractionDigits: displayValue < 10 ? 1 : 0 })}%`;
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 1 });
}

export function getNumericFields(rows = []) {
  const excludedFields = new Set(['latitude', 'lat', 'longitude', 'lng', 'lon', 'name']);
  const fieldStats = new Map();

  rows.forEach((row) => {
    Object.entries(row || {}).forEach(([field, rawValue]) => {
      const normalizedField = field.toLowerCase();
      if (excludedFields.has(normalizedField)) return;

      const value = parseMetricValue(rawValue);
      if (!Number.isFinite(value)) return;

      const stats = fieldStats.get(field) || { field, count: 0, values: [] };
      stats.count += 1;
      stats.values.push(value);
      fieldStats.set(field, stats);
    });
  });

  return Array.from(fieldStats.values())
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field))
    .map((item) => ({
      field: item.field,
      count: item.count,
      isPercent: isPercentLikeField(item.field, item.values),
      suggestedMeaning: suggestMetricMeaning(item.field)
    }));
}

export function suggestMetricMeaning(field = '') {
  const normalized = field.toLowerCase().replace(/[\s-]+/g, '_');

  if (WORSE_HIGH_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return ADMIN_METRIC_MEANINGS.WORSE_HIGH;
  }

  if (BETTER_HIGH_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return ADMIN_METRIC_MEANINGS.BETTER_HIGH;
  }

  if (NEUTRAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return ADMIN_METRIC_MEANINGS.NEUTRAL;
  }

  return ADMIN_METRIC_MEANINGS.NEUTRAL;
}

function getPalette(meaning, classCount, reverse = false) {
  const palette = meaning === ADMIN_METRIC_MEANINGS.BETTER_HIGH
    ? BETTER_HIGH_PALETTE
    : meaning === ADMIN_METRIC_MEANINGS.NEUTRAL
      ? NEUTRAL_PALETTE
      : WORSE_HIGH_PALETTE;
  const orderedPalette = reverse ? [...palette].reverse() : palette;

  if (classCount === orderedPalette.length) return orderedPalette;
  if (classCount <= 1) return [orderedPalette[orderedPalette.length - 1]];

  return Array.from({ length: classCount }, (_, index) => {
    const paletteIndex = Math.round((index / (classCount - 1)) * (orderedPalette.length - 1));
    return orderedPalette[paletteIndex];
  });
}

function uniqueSortedValues(values) {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((a, b) => a - b);
}

function buildEqualIntervalBreaks(values, classCount) {
  const sorted = uniqueSortedValues(values);
  if (!sorted.length) return [];

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [{ min, max }];

  const step = (max - min) / classCount;
  return Array.from({ length: classCount }, (_, index) => ({
    min: index === 0 ? min : min + step * index,
    max: index === classCount - 1 ? max : min + step * (index + 1)
  }));
}

function buildQuantileBreaks(values, classCount) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return [];

  const uniqueValues = uniqueSortedValues(sorted);
  const actualClassCount = Math.min(classCount, uniqueValues.length);
  if (actualClassCount <= 1) return [{ min: sorted[0], max: sorted[sorted.length - 1] }];

  const breaks = [];
  let previousMin = sorted[0];

  for (let index = 0; index < actualClassCount; index += 1) {
    const endIndex = index === actualClassCount - 1
      ? sorted.length - 1
      : Math.max(0, Math.ceil(((index + 1) / actualClassCount) * sorted.length) - 1);
    const max = sorted[endIndex];
    breaks.push({ min: previousMin, max });
    previousMin = max;
  }

  return breaks;
}

function findBreakIndex(value, breaks) {
  if (!Number.isFinite(value) || !breaks.length) return -1;
  const index = breaks.findIndex((item, itemIndex) => (
    itemIndex === breaks.length - 1
      ? value >= item.min && value <= item.max
      : value >= item.min && value <= item.max
  ));
  return index === -1 ? breaks.length - 1 : index;
}

export function buildDatasetColorScale(values = [], options = {}) {
  const {
    classCount = 5,
    meaning = ADMIN_METRIC_MEANINGS.WORSE_HIGH,
    classification = ADMIN_CLASSIFICATION_METHODS.QUANTILE,
    isPercent = false,
    reverseColors = false
  } = options;

  const cleanValues = values.filter((value) => Number.isFinite(value));
  if (!cleanValues.length) {
    return {
      breaks: [],
      legend: [],
      getColor: () => '#94a3b8'
    };
  }

  const normalizedClassCount = Math.min(Math.max(Number(classCount) || 5, 3), 7);
  const breaks = classification === ADMIN_CLASSIFICATION_METHODS.EQUAL_INTERVAL
    ? buildEqualIntervalBreaks(cleanValues, normalizedClassCount)
    : buildQuantileBreaks(cleanValues, normalizedClassCount);
  const colors = getPalette(meaning, breaks.length || normalizedClassCount, reverseColors);

  return {
    breaks,
    legend: breaks.map((item, index) => ({
      color: colors[index] || colors[colors.length - 1],
      label: item.min === item.max
        ? formatMetricValue(item.min, { isPercent })
        : `${formatMetricValue(item.min, { isPercent })} - ${formatMetricValue(item.max, { isPercent })}`
    })),
    getColor: (value) => {
      const index = findBreakIndex(value, breaks);
      return index >= 0 ? colors[index] || colors[colors.length - 1] : '#94a3b8';
    }
  };
}
