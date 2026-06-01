const EXCLUDED_PROPERTY_KEYS = new Set([
  'geometry',
  'bounds',
  'displayGeometry',
  'riskLevel',
  'riskScore',
  'eventCount'
]);

function normalizeKey(key = '') {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function formatPathLabel(path = '') {
  return String(path)
    .split('.')
    .map((segment) => normalizeKey(segment)
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '))
    .join(' / ');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compactValue(value, maxLength = 160) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(value) < 10 ? 3 : 1
    });
  }

  const stringValue = String(value).replace(/\s+/g, ' ').trim();
  if (!stringValue) return null;

  const numericValue = Number(stringValue.replace(/,/g, ''));
  if (!Number.isNaN(numericValue)) {
    return numericValue.toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(numericValue) < 10 ? 3 : 1
    });
  }

  return stringValue.length > maxLength
    ? `${stringValue.slice(0, maxLength - 3)}...`
    : stringValue;
}

function flattenAdminProperties(value, options = {}, path = [], output = []) {
  const {
    maxDepth = 3,
    maxFields = 40
  } = options;

  if (output.length >= maxFields) return output;
  if (value === null || value === undefined || value === '') return output;

  if (path.length > 0 && !isPlainObject(value) && !Array.isArray(value)) {
    const compact = compactValue(value);
    if (compact !== null) {
      output.push({
        path: path.join('.'),
        label: formatPathLabel(path.join('.')),
        value: compact,
        type: typeof value
      });
    }
    return output;
  }

  if (Array.isArray(value)) {
    if (path.length > 0) {
      const scalarItems = value
        .filter((item) => !isPlainObject(item) && !Array.isArray(item))
        .slice(0, 5)
        .map((item) => compactValue(item, 80))
        .filter(Boolean);

      if (scalarItems.length > 0) {
        output.push({
          path: path.join('.'),
          label: formatPathLabel(path.join('.')),
          value: scalarItems.join(', '),
          type: 'array'
        });
      }
    }
    return output;
  }

  if (isPlainObject(value)) {
    if (path.length >= maxDepth) return output;

    Object.entries(value).forEach(([key, childValue]) => {
      if (output.length >= maxFields) return;
      const normalized = normalizeKey(key);
      if (path.length === 0 && EXCLUDED_PROPERTY_KEYS.has(key)) return;
      if (path.length === 0 && EXCLUDED_PROPERTY_KEYS.has(normalized)) return;
      flattenAdminProperties(childValue, options, [...path, key], output);
    });
  }

  return output;
}

function summarizeAdminProperties(properties = {}, options = {}) {
  const {
    maxFields = 30,
    maxDepth = 3
  } = options;

  return flattenAdminProperties(properties, { maxFields, maxDepth })
    .slice(0, maxFields);
}

function summarizeDistrictAttributes(district = {}, options = {}) {
  const props = district.properties || {};
  return summarizeAdminProperties(props, options);
}

export {
  summarizeAdminProperties,
  summarizeDistrictAttributes
};
