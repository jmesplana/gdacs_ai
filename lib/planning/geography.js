export function fingerprint(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < text.length; index += 1) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ text.charCodeAt(index);
  }
  return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
}

export function areaIdentity(feature) {
  const props = feature.properties || {};
  const codeField = ['ADM4_PCODE', 'ADM3_PCODE', 'ADM2_PCODE', 'ADM1_PCODE', 'ADM0_PCODE', 'PCODE', 'GID_4', 'GID_3', 'GID_2', 'GID_1'].find((key) => props[key] !== undefined && props[key] !== '');
  const code = codeField ? String(props[codeField]) : feature.id != null ? String(feature.id) : null;
  const country = props.ISO3 || props.ADM0_PCODE || props.ADM0_NAME || props.COUNTRY || props.NAME_0 || '';
  const geometryVersion = fingerprint(feature.geometry);
  return { id: code ? `area:${country}:${codeField || 'id'}:${code}` : `geometry:${geometryVersion}`, areaCode: code, geometryVersion };
}

export function geographyKey(districts) {
  return fingerprint(districts.map((district) => [String(district.id), district.geometryVersion || fingerprint(district.geometry)]).sort(([a], [b]) => a.localeCompare(b)));
}
