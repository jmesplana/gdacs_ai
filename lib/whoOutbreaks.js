const WHO_DONS_BASE_URL = 'https://www.who.int';
const WHO_DONS_ITEM_BASE_URL = 'https://www.who.int/emergencies/disease-outbreak-news/item';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const MAX_GEOCODE_CANDIDATES_PER_REPORT = 20;
const MAX_GEOCODE_RESULTS_PER_RESPONSE = 80;

const geocodeCache = new Map();

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
  const parts = String(title).split(/\s*[–-]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || title || 'Unknown disease';
  return parts.slice(0, -1).join(' - ') || parts[0];
}

function buildSearchableText(item = {}) {
  return [
    item.OverrideTitle,
    item.Title,
    stripHtml(item.Summary),
    stripHtml(item.Overview),
    stripHtml(item.Epidemiology),
    stripHtml(item.Assessment),
    stripHtml(item.Response),
    stripHtml(item.Advice),
    stripHtml(item.FurtherInformation)
  ].filter(Boolean).join(' ');
}

function extractMetrics(item = {}) {
  return extractMetricsFromText(buildSearchableText(item));
}

function extractMetricsFromText(text = '') {
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

function getTitleLocationTail(title = '') {
  const parts = String(title).split(/\s*[–-]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];

  const commaParts = String(title).split(',').map((part) => part.trim()).filter(Boolean);
  return commaParts.length > 1 ? commaParts[commaParts.length - 1] : '';
}

function splitLocationList(value = '') {
  return String(value)
    .replace(/\s+(?:and|&)\s+/gi, ',')
    .split(',')
    .map((part) => cleanLocationCandidate(part))
    .filter(Boolean);
}

function cleanLocationCandidate(value = '') {
  const cleaned = String(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:province|region|district|territory|state)\b$/i, (match) => match)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '');

  if (cleaned.length < 3 || cleaned.length > 120) return '';
  if (/^(multi[-\s]?locations?|global|worldwide|unknown|not specified)$/i.test(cleaned)) return '';
  if (/\b(?:hantavirus|virus|infection|disease|outbreak|case|cases|contact|contacts|surveillance|confirmed|suspected|probable|health organization)\b/i.test(cleaned)) return '';
  if (/[.?!]/.test(cleaned)) return '';
  if (/^\d/.test(cleaned)) return '';
  return cleaned;
}

function addCandidate(candidates, phrase, context = '', source = 'text') {
  const cleanPhrase = cleanLocationCandidate(phrase);
  if (!cleanPhrase) return;

  const cleanContext = cleanLocationCandidate(context);
  const query = cleanContext && !cleanPhrase.toLowerCase().includes(cleanContext.toLowerCase())
    ? `${cleanPhrase}, ${cleanContext}`
    : cleanPhrase;
  const key = query.toLowerCase();

  if (!candidates.some((candidate) => candidate.key === key)) {
    candidates.push({
      key,
      query,
      phrase: cleanPhrase,
      source
    });
  }
}

function extractLocationCandidates(item = {}) {
  const title = item.OverrideTitle || item.Title || '';
  const titleTail = getTitleLocationTail(title);
  const text = buildSearchableText(item);
  const candidates = [];
  const titleContexts = splitLocationList(titleTail);

  titleContexts.forEach((part) => addCandidate(candidates, part, '', 'title'));

  const sharedAdminListPattern = /\b(?:in|from|across|within|concentrated in|reported from)\s+([^.;:()]{3,180}?)\s+(provinces|regions|districts|territories|states|health zones)\b/g;
  for (const match of text.matchAll(sharedAdminListPattern)) {
    const suffix = match[2].replace(/s$/i, '');
    const names = match[1]
      .replace(/\bas well as\b/gi, ',')
      .replace(/\band\b/gi, ',')
      .split(',')
      .map((part) => cleanLocationCandidate(part))
      .filter(Boolean);
    const contexts = titleContexts.length > 0 ? titleContexts : [''];

    names.forEach((name) => {
      contexts.forEach((titleContext) => {
        addCandidate(candidates, `${name} ${suffix}`, titleContext, 'body');
        addCandidate(candidates, name, titleContext, 'body');
      });
    });
  }

  const adminPairPattern = /([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,5}),\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,5})\s+(Province|Region|District|Territory|State|Health Zone)\b/g;
  for (const match of text.matchAll(adminPairPattern)) {
    const context = `${match[2]} ${match[3]}`;
    const contexts = titleContexts.length > 0 ? titleContexts : [''];
    contexts.forEach((titleContext) => {
      addCandidate(candidates, match[1], [context, titleContext].filter(Boolean).join(', '), 'body');
      addCandidate(candidates, context, titleContext, 'body');
    });
  }

  const adminPattern = /\b([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,5})\s+(Province|Region|District|Territory|State|Health Zone)\b/g;
  for (const match of text.matchAll(adminPattern)) {
    const contexts = titleContexts.length > 0 ? titleContexts : [''];
    contexts.forEach((titleContext) => {
      addCandidate(candidates, `${match[1]} ${match[2]}`, titleContext, 'body');
      if (!/^state$/i.test(match[2])) {
        addCandidate(candidates, match[1], titleContext, 'body');
      }
    });
  }

  const nestedAdminPattern = /\b([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,3})\s+in\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,4})\s+(Province|Region|District|Territory|State|Health Zone)\b/g;
  for (const match of text.matchAll(nestedAdminPattern)) {
    const contexts = titleContexts.length > 0 ? titleContexts : [''];
    contexts.forEach((titleContext) => {
      addCandidate(candidates, match[1], [`${match[2]} ${match[3]}`, titleContext].filter(Boolean).join(', '), 'body');
    });
  }

  const namedAdminPattern = /\b(?:city|town|village|province|region|district|territory|state)\s+of\s+([A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,4})\b/g;
  for (const match of text.matchAll(namedAdminPattern)) {
    const contexts = titleContexts.length > 0 ? titleContexts : [''];
    contexts.forEach((titleContext) => {
      addCandidate(candidates, match[1], titleContext, 'body');
    });
  }

  return candidates.slice(0, MAX_GEOCODE_CANDIDATES_PER_REPORT);
}

function getLocationSnippet(text, phrase, radius = 220) {
  if (!phrase) return '';
  const index = text.toLowerCase().indexOf(String(phrase).toLowerCase());
  if (index < 0) return '';
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + phrase.length + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function inferLocationType(result = {}) {
  const address = result.address || {};
  if (address.city || address.town || address.village || address.hamlet || address.municipality) return 'city';
  if (address.county || address.district || address.suburb) return 'district';
  if (address.state || address.region || address.province) return 'admin1';
  if (address.country) return 'country';
  return result.type || result.class || 'place';
}

function displayNameFromResult(result = {}, fallback = '') {
  const address = result.address || {};
  return address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.county ||
    address.district ||
    address.state ||
    address.region ||
    address.province ||
    address.country ||
    result.name ||
    fallback;
}

async function geocodeLocationCandidate(candidate, fetchImpl = fetch) {
  const cacheKey = candidate.query.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('q', candidate.query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetchImpl(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Aidstack/1.0 (WHO outbreak geocoding; contact: https://github.com/jmesplana/gdacs_ai)'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const results = await response.json();
    const result = Array.isArray(results)
      ? results.find((entry) => ['boundary', 'place'].includes(entry?.category || entry?.class)) || null
      : null;
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const address = result.address || {};
    const geocoded = {
      name: displayNameFromResult(result, candidate.phrase),
      type: inferLocationType(result),
      country: address.country || null,
      admin1: address.state || address.region || address.province || null,
      latitude,
      longitude,
      confidence: result.importance ? `geocoder:${Number(result.importance).toFixed(2)}` : 'geocoder',
      source: 'nominatim',
      geocoderDisplayName: result.display_name || candidate.query,
      geocoderClass: result.category || result.class || null,
      geocoderType: result.type || null,
      query: candidate.query,
      phrase: candidate.phrase
    };
    geocodeCache.set(cacheKey, geocoded);
    return geocoded;
  } catch (error) {
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

function dedupeLocations(locations = []) {
  const byKey = new Map();
  locations.forEach((location) => {
    const key = [
      Number(location.latitude).toFixed(4),
      Number(location.longitude).toFixed(4),
      location.name || '',
      location.country || ''
    ].join('|').toLowerCase();
    if (!byKey.has(key)) byKey.set(key, location);
  });
  return Array.from(byKey.values());
}

async function geocodeOutbreakLocations(item = {}, options = {}) {
  const candidates = extractLocationCandidates(item)
    .filter((candidate) => !options.candidateSource || candidate.source === options.candidateSource);
  const text = buildSearchableText(item);
  const fetchImpl = options.fetchImpl || fetch;
  const locations = [];

  for (const candidate of candidates) {
    if (options.geocodeBudget && options.geocodeBudget.remaining <= 0) break;
    if (options.geocodeBudget) options.geocodeBudget.remaining -= 1;

    const location = await geocodeLocationCandidate(candidate, fetchImpl);
    if (!location) continue;

    const snippet = getLocationSnippet(text, candidate.phrase);
    locations.push({
      ...location,
      snippet,
      metrics: snippet ? extractMetricsFromText(snippet) : {}
    });
  }

  return dedupeLocations(locations);
}

async function normalizeWhoOutbreakItem(item = {}, options = {}) {
  const reportDate = item.PublicationDateAndTime || item.PublicationDate || item.DateCreated || null;
  const updatedDate = item.LastModified || null;
  const filterDate = reportDate || updatedDate;
  const title = item.OverrideTitle || item.Title || 'WHO Disease Outbreak News';
  const metrics = extractMetrics(item);
  const locations = options.locations || await geocodeOutbreakLocations(item, options);
  const countries = Array.from(new Set(locations.map((location) => location.country).filter(Boolean)));

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
    id: `${report.id}-${location.query || location.name || index}`,
    reportId: report.id,
    source: report.source,
    sourceUrl: report.sourceUrl,
    title: report.title,
    disease: report.disease,
    reportDate: report.reportDate,
    updatedDate: report.updatedDate,
    filterDate: report.filterDate || report.updatedDate || report.reportDate,
    country: location.country,
    locationName: location.name || location.country,
    locationType: location.type || location.confidence,
    admin1: location.admin1 || null,
    latitude: location.latitude,
    longitude: location.longitude,
    locationConfidence: location.confidence,
    locationSource: location.source || 'unknown',
    locationSnippet: location.snippet || '',
    geocoderDisplayName: location.geocoderDisplayName || '',
    affectedCountries: report.countries || [],
    metrics: Object.values(location.metrics || {}).some((value) => value !== null && value !== undefined)
      ? location.metrics
      : report.metrics || {},
    reportMetrics: report.metrics || {},
    summary: report.summary || ''
  }));
}

async function normalizeWhoOutbreakResponse(data = {}, options = {}) {
  const geocodeBudget = {
    remaining: Number.isFinite(options.maxGeocodeQueries)
      ? options.maxGeocodeQueries
      : MAX_GEOCODE_RESULTS_PER_RESPONSE
  };
  const reports = [];

  if (Array.isArray(data.value)) {
    const reportDrafts = data.value.map((item) => ({
      item,
      titleLocations: [],
      detailLocations: []
    }));

    for (const draft of reportDrafts) {
      draft.titleLocations = await geocodeOutbreakLocations(draft.item, {
        ...options,
        geocodeBudget,
        candidateSource: 'title'
      });
    }

    for (const draft of reportDrafts) {
      draft.detailLocations = await geocodeOutbreakLocations(draft.item, {
        ...options,
        geocodeBudget,
        candidateSource: 'body'
      });
    }

    for (const draft of reportDrafts) {
      reports.push(await normalizeWhoOutbreakItem(draft.item, {
        ...options,
        locations: dedupeLocations([
          ...draft.titleLocations,
          ...draft.detailLocations
        ])
      }));
    }
  }

  const mapFeatures = reports.flatMap(expandOutbreakMapFeatures);
  return { reports, mapFeatures };
}

export {
  WHO_DONS_BASE_URL,
  extractLocationCandidates,
  normalizeWhoOutbreakItem,
  normalizeWhoOutbreakResponse,
  expandOutbreakMapFeatures
};
