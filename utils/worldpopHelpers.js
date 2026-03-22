// WorldPop Global 2 helper utilities

export const GEE_DATASETS = {
  total: {
    collectionId: 'projects/sat-io/open-datasets/WORLDPOP/pop',
    band: 'population',
    label: 'Total Population',
    release: 'R2024B',
  },
  agesex: {
    collectionId: 'projects/sat-io/open-datasets/WORLDPOP/agesex',
    label: 'Age & Sex Structure',
    release: 'R2025A',
  },
};

export const WORLDPOP_YEARS = Array.from({ length: 16 }, (_, i) => 2015 + i); // 2015–2030

export const AGE_GROUPS = [
  { key: 'under5',   label: 'Under 5',   color: '#EF4444', bands: ['f_00','m_00','f_01','m_01'] },
  { key: 'age5_14',  label: '5–14',      color: '#F97316', bands: ['f_05','m_05','f_10','m_10'] },
  { key: 'age15_49', label: '15–49',     color: '#3B82F6', bands: ['f_15','m_15','f_20','m_20','f_25','m_25','f_30','m_30','f_35','m_35','f_40','m_40','f_45','m_45'] },
  { key: 'age50_59', label: '50–59',     color: '#8B5CF6', bands: ['f_50','m_50','f_55','m_55'] },
  { key: 'age60plus',label: '60+',       color: '#6B7280', bands: ['f_60','m_60','f_65','m_65','f_70','m_70','f_75','m_75','f_80','m_80','f_85','m_85','f_90','m_90'] },
];

export const WORLDPOP_TILE_LAYERS = {
  population1km: {
    id: 'worldpop_pop_1km',
    name: 'Population Density (1km)',
    // WorldPop Population Density via ArcGIS ImageServer
    // This shows actual population density at 1km resolution (2020 data)
    url: 'https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_1km/ImageServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.worldpop.org">WorldPop</a> / <a href="https://www.esri.com">Esri</a>',
    opacity: 0.65,
  },
  density100m: {
    id: 'worldpop_density_100m',
    name: 'Population Density (100m)',
    // WorldPop Population Density at 100m resolution (2020 data)
    // Higher resolution - shows more detailed population distribution
    url: 'https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_100m/ImageServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.worldpop.org">WorldPop</a> / <a href="https://www.esri.com">Esri</a>',
    opacity: 0.65,
  },
};

/**
 * Auto-detect country name from shapefile district properties.
 * Returns a human-readable country name (not ISO3).
 */
export function extractCountryFromDistricts(districts) {
  if (!districts || districts.length === 0) return null;
  const props = districts[0]?.properties || {};
  return (
    props.ADM0_EN ||
    props.ADM0_NAME ||
    props.COUNTRY ||
    props.Country ||
    props.country ||
    props.NAME_0 ||
    null
  );
}

/**
 * Group raw GEE age-sex band values into humanitarian-relevant categories.
 * `rawBands` is an object like { f_00: 1234, m_00: 1100, f_05: 890, ... }
 */
export function groupAgeBands(rawBands) {
  const get = (key) => Math.round(rawBands[key] || 0);

  const groups = {};
  for (const group of AGE_GROUPS) {
    groups[group.key] = group.bands.reduce((sum, band) => sum + get(band), 0);
  }

  const female = Object.keys(rawBands)
    .filter(k => k.startsWith('f_'))
    .reduce((sum, k) => sum + get(k), 0);

  const male = Object.keys(rawBands)
    .filter(k => k.startsWith('m_'))
    .reduce((sum, k) => sum + get(k), 0);

  return {
    ...groups,
    female,
    male,
    total: female + male,
  };
}

/**
 * Format WorldPop data as a string for AI prompt context.
 */
export function formatWorldPopForAI(worldPopData, districts, year) {
  if (!worldPopData || Object.keys(worldPopData).length === 0) return '';

  const entries = Object.entries(worldPopData);
  const totalPop = entries.reduce((sum, [, d]) => sum + (d.total || 0), 0);

  let text = `\n## Population Data (WorldPop Global 2, ${year})\n`;
  text += `- Total population in operational area: ${totalPop.toLocaleString()}\n`;

  // Identify most/least populous
  const sorted = [...entries].sort((a, b) => (b[1].total || 0) - (a[1].total || 0));
  if (sorted.length > 0) {
    const topDistrict = districts?.find(d => String(d.id) === String(sorted[0][0]));
    text += `- Most populous admin area: ${topDistrict?.name || sorted[0][0]} (${(sorted[0][1].total || 0).toLocaleString()} people)\n`;
  }

  // Vulnerable groups aggregate
  const totalUnder5 = entries.reduce((sum, [, d]) => sum + (d.ageGroups?.under5 || 0), 0);
  const total60plus = entries.reduce((sum, [, d]) => sum + (d.ageGroups?.age60plus || 0), 0);
  if (totalPop > 0 && (totalUnder5 > 0 || total60plus > 0)) {
    const vulnPct = Math.round(((totalUnder5 + total60plus) / totalPop) * 100);
    text += `- Vulnerable groups (under 5 + 60+): ${vulnPct}% of total (${(totalUnder5 + total60plus).toLocaleString()} people)\n`;
  }

  text += `\n### Population Breakdown by Admin Area\n`;
  for (const [districtId, data] of sorted.slice(0, 20)) {
    const district = districts?.find(d => String(d.id) === String(districtId));
    const name = district?.name || `Admin Area ${districtId}`;
    const total = (data.total || 0).toLocaleString();

    if (data.ageGroups) {
      const u5 = (data.ageGroups.under5 || 0).toLocaleString();
      const a1549 = (data.ageGroups.age15_49 || 0).toLocaleString();
      const a60p = (data.ageGroups.age60plus || 0).toLocaleString();
      text += `- ${name}: ${total} people | Under 5: ${u5} | 15–49: ${a1549} | 60+: ${a60p}\n`;
    } else {
      text += `- ${name}: ${total} people\n`;
    }
  }

  return text;
}

/**
 * Calculate geographic bounds from an array of districts.
 * Returns { west, south, east, north } for scoping WorldPop tiles.
 */
export function calculateBounds(districts) {
  if (!districts || districts.length === 0) return null;

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;

  for (const district of districts) {
    const geometry = district.geometry;
    if (!geometry || !geometry.coordinates) continue;

    // Handle both Polygon and MultiPolygon
    const coordArrays = geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flat(1)
      : geometry.coordinates;

    for (const ring of coordArrays) {
      for (const [lng, lat] of ring) {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      }
    }
  }

  // Return null if no valid coordinates found
  if (!isFinite(west)) return null;

  return { west, south, east, north };
}

/**
 * Format a number as a compact string (e.g. 1234567 → "1.2M")
 */
export function formatPopNumber(n) {
  if (!n || isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
