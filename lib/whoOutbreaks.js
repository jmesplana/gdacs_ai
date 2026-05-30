const WHO_DONS_BASE_URL = 'https://www.who.int';
const WHO_DONS_ITEM_BASE_URL = 'https://www.who.int/emergencies/disease-outbreak-news/item';

const COUNTRY_CENTROIDS = {
  Afghanistan: [33.9391, 67.71],
  Angola: [-11.2027, 17.8739],
  Argentina: [-38.4161, -63.6167],
  Australia: [-25.2744, 133.7751],
  Bangladesh: [23.685, 90.3563],
  Benin: [9.3077, 2.3158],
  Bolivia: [-16.2902, -63.5887],
  Brazil: [-14.235, -51.9253],
  'Burkina Faso': [12.2383, -1.5616],
  Burundi: [-3.3731, 29.9189],
  'Cabo Verde': [16.5388, -23.0418],
  Cambodia: [12.5657, 104.991],
  Cameroon: [7.3697, 12.3547],
  Canada: [56.1304, -106.3468],
  'Central African Republic': [6.6111, 20.9394],
  Chad: [15.4542, 18.7322],
  Chile: [-35.6751, -71.543],
  China: [35.8617, 104.1954],
  Colombia: [4.5709, -74.2973],
  Congo: [-0.228, 15.8277],
  'Costa Rica': [9.7489, -83.7534],
  "Cote d'Ivoire": [7.54, -5.5471],
  Cuba: [21.5218, -77.7812],
  Denmark: [56.2639, 9.5018],
  Djibouti: [11.8251, 42.5903],
  'Dominican Republic': [18.7357, -70.1627],
  Ecuador: [-1.8312, -78.1834],
  Egypt: [26.8206, 30.8025],
  'Equatorial Guinea': [1.6508, 10.2679],
  Eritrea: [15.1794, 39.7823],
  Ethiopia: [9.145, 40.4897],
  France: [46.2276, 2.2137],
  Gabon: [-0.8037, 11.6094],
  Gambia: [13.4432, -15.3101],
  Georgia: [42.3154, 43.3569],
  Germany: [51.1657, 10.4515],
  Ghana: [7.9465, -1.0232],
  Guinea: [9.9456, -9.6966],
  'Guinea-Bissau': [11.8037, -15.1804],
  Haiti: [18.9712, -72.2852],
  Honduras: [15.2, -86.2419],
  India: [20.5937, 78.9629],
  Indonesia: [-0.7893, 113.9213],
  Iran: [32.4279, 53.688],
  Iraq: [33.2232, 43.6793],
  Israel: [31.0461, 34.8516],
  Italy: [41.8719, 12.5674],
  Japan: [36.2048, 138.2529],
  Jordan: [30.5852, 36.2384],
  Kenya: [-0.0236, 37.9062],
  Laos: [19.8563, 102.4955],
  Lebanon: [33.8547, 35.8623],
  Liberia: [6.4281, -9.4295],
  Libya: [26.3351, 17.2283],
  Madagascar: [-18.7669, 46.8691],
  Malawi: [-13.2543, 34.3015],
  Malaysia: [4.2105, 101.9758],
  Mali: [17.5707, -3.9962],
  Mauritania: [21.0079, -10.9408],
  Mexico: [23.6345, -102.5528],
  Mozambique: [-18.6657, 35.5296],
  Myanmar: [21.9162, 95.956],
  Namibia: [-22.9576, 18.4904],
  Nepal: [28.3949, 84.124],
  Netherlands: [52.1326, 5.2913],
  Nicaragua: [12.8654, -85.2072],
  Niger: [17.6078, 8.0817],
  Nigeria: [9.082, 8.6753],
  Norway: [60.472, 8.4689],
  Oman: [21.5126, 55.9233],
  Pakistan: [30.3753, 69.3451],
  Panama: [8.538, -80.7821],
  Paraguay: [-23.4425, -58.4438],
  Peru: [-9.19, -75.0152],
  Philippines: [12.8797, 121.774],
  Poland: [51.9194, 19.1451],
  Qatar: [25.3548, 51.1839],
  Romania: [45.9432, 24.9668],
  Russia: [61.524, 105.3188],
  Rwanda: [-1.9403, 29.8739],
  'Saudi Arabia': [23.8859, 45.0792],
  Senegal: [14.4974, -14.4524],
  Serbia: [44.0165, 21.0059],
  Singapore: [1.3521, 103.8198],
  Somalia: [5.1521, 46.1996],
  'South Africa': [-30.5595, 22.9375],
  'South Sudan': [6.877, 31.307],
  Spain: [40.4637, -3.7492],
  'Sri Lanka': [7.8731, 80.7718],
  Sudan: [12.8628, 30.2176],
  Sweden: [60.1282, 18.6435],
  Switzerland: [46.8182, 8.2275],
  Syria: [34.8021, 38.9968],
  Tanzania: [-6.369, 34.8888],
  Thailand: [15.87, 100.9925],
  Togo: [8.6195, 0.8248],
  Tunisia: [33.8869, 9.5375],
  Turkey: [38.9637, 35.2433],
  Uganda: [1.3733, 32.2903],
  Ukraine: [48.3794, 31.1656],
  'United Arab Emirates': [23.4241, 53.8478],
  'United Kingdom': [55.3781, -3.436],
  'United States': [37.0902, -95.7129],
  Uruguay: [-32.5228, -55.7658],
  Venezuela: [6.4238, -66.5897],
  Vietnam: [14.0583, 108.2772],
  Yemen: [15.5527, 48.5164],
  Zambia: [-13.1339, 27.8493],
  Zimbabwe: [-19.0154, 29.1549]
};

const COUNTRY_ALIASES = {
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
  'Democratic Republic of Congo': 'Democratic Republic of the Congo',
  DRC: 'Democratic Republic of the Congo',
  'Côte d’Ivoire': "Cote d'Ivoire",
  'Côte d\'Ivoire': "Cote d'Ivoire",
  "Lao People's Democratic Republic": 'Laos',
  'Republic of Korea': 'South Korea',
  'Russian Federation': 'Russia',
  'Syrian Arab Republic': 'Syria',
  'Türkiye': 'Turkey',
  'United Republic of Tanzania': 'Tanzania',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'United States of America': 'United States',
  'Viet Nam': 'Vietnam'
};

COUNTRY_CENTROIDS['Democratic Republic of the Congo'] = [-4.0383, 21.7587];
COUNTRY_CENTROIDS['South Korea'] = [35.9078, 127.7669];

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalCountryName(value = '') {
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  return COUNTRY_ALIASES[cleaned] || cleaned;
}

function buildWhoSourceUrl(item = {}) {
  if (item.ItemDefaultUrl && /^https?:\/\//i.test(item.ItemDefaultUrl)) {
    return item.ItemDefaultUrl;
  }

  const slug = item.UrlName || item.DonId || String(item.ItemDefaultUrl || '').replace(/^\//, '');
  if (slug) return `${WHO_DONS_ITEM_BASE_URL}/${slug}`;

  if (item.ItemDefaultUrl) return `${WHO_DONS_BASE_URL}${item.ItemDefaultUrl}`;
  return WHO_DONS_ITEM_BASE_URL;
}

function extractDisease(title = '') {
  const parts = String(title).split(/\s+[–-]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || title || 'Unknown disease';
  return parts.slice(0, -1).join(' - ') || parts[0];
}

function extractCountries(item = {}) {
  const title = item.Title || item.OverrideTitle || '';
  const text = [
    stripHtml(item.Summary),
    stripHtml(item.Overview)
  ].join(' ');
  const titleCountries = new Set();
  const bodyCountries = new Set();
  const titleParts = String(title).split(/\s+[–-]\s+/).map((part) => part.trim()).filter(Boolean);
  const possibleTail = titleParts[titleParts.length - 1] || '';

  Object.keys(COUNTRY_CENTROIDS).forEach((country) => {
    const escaped = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titleRegex = new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i');
    const bodyRegex = new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`);
    if (titleRegex.test(possibleTail) || titleRegex.test(title)) titleCountries.add(country);
    if (bodyRegex.test(text)) bodyCountries.add(country);
  });

  Object.entries(COUNTRY_ALIASES).forEach(([alias, country]) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titleRegex = new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`, 'i');
    const bodyRegex = new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`);
    if (titleRegex.test(possibleTail) || titleRegex.test(title)) titleCountries.add(country);
    if (bodyRegex.test(text)) bodyCountries.add(country);
  });

  const countries = titleCountries.size > 0 ? titleCountries : bodyCountries;
  return Array.from(countries).map(canonicalCountryName);
}

function extractMetrics(item = {}) {
  const text = [
    stripHtml(item.Summary),
    stripHtml(item.Overview),
    stripHtml(item.Epidemiology),
    stripHtml(item.Assessment)
  ].join(' ');

  const findNumber = (patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = Number(String(match[1]).replace(/,/g, ''));
        if (Number.isFinite(value)) return value;
      }
    }
    return null;
  };

  const cfrMatch = text.match(/(?:case fatality ratio|case fatality rate|CFR)[^\d]{0,20}(\d+(?:\.\d+)?)\s*%/i);

  return {
    cases: findNumber([
      /(?:total of|total|cumulative total of|has reported|reported)\s+([\d,]+)\s+(?:laboratory-confirmed\s+|confirmed\s+|suspected\s+|probable\s+)?cases/i,
      /([\d,]+)\s+(?:laboratory-confirmed\s+|confirmed\s+|suspected\s+|probable\s+)?cases(?:\s+have been|\s+were|\s+has been|\s+reported)/i
    ]),
    deaths: findNumber([
      /(?:including|with|and)\s+([\d,]+)\s+deaths/i,
      /([\d,]+)\s+(?:fatalities|deaths)\s+(?:have been|were|reported)/i
    ]),
    cfr: cfrMatch?.[1] ? Number(cfrMatch[1]) : null
  };
}

function normalizeWhoOutbreakItem(item = {}) {
  const countries = extractCountries(item);
  const reportDate = item.PublicationDateAndTime || item.PublicationDate || item.DateCreated || null;
  const updatedDate = item.LastModified || null;
  const filterDate = reportDate || updatedDate;
  const title = item.OverrideTitle || item.Title || 'WHO Disease Outbreak News';
  const metrics = extractMetrics(item);
  const locations = countries
    .map((country) => {
      const coords = COUNTRY_CENTROIDS[country];
      if (!coords) return null;
      return {
        country,
        latitude: coords[0],
        longitude: coords[1],
        confidence: 'country'
      };
    })
    .filter(Boolean);

  return {
    id: item.DonId || item.Id || item.UrlName || title,
    source: 'WHO DONS',
    sourceUrl: buildWhoSourceUrl(item),
    title,
    disease: extractDisease(title),
    reportDate,
    updatedDate,
    filterDate,
    countries,
    locations,
    metrics,
    summary: stripHtml(item.Summary || item.Overview || '').slice(0, 600),
    raw: item
  };
}

function expandOutbreakMapFeatures(report = {}) {
  return (report.locations || []).map((location, index) => ({
    id: `${report.id}-${location.country || index}`,
    reportId: report.id,
    source: report.source,
    sourceUrl: report.sourceUrl,
    title: report.title,
    disease: report.disease,
    reportDate: report.reportDate,
    updatedDate: report.updatedDate,
    filterDate: report.filterDate || report.updatedDate || report.reportDate,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
    locationConfidence: location.confidence,
    affectedCountries: report.countries || [],
    metrics: report.metrics || {},
    summary: report.summary || ''
  }));
}

function normalizeWhoOutbreakResponse(data = {}) {
  const reports = Array.isArray(data.value)
    ? data.value.map(normalizeWhoOutbreakItem)
    : [];

  const mapFeatures = reports.flatMap(expandOutbreakMapFeatures);
  return { reports, mapFeatures };
}

export {
  WHO_DONS_BASE_URL,
  COUNTRY_CENTROIDS,
  normalizeWhoOutbreakItem,
  normalizeWhoOutbreakResponse,
  expandOutbreakMapFeatures
};
