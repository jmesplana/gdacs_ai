import { withRateLimit } from '../../lib/rateLimit';
import { normalizeWhoOutbreakResponse } from '../../lib/whoOutbreaks';
import OpenAI from 'openai';

const WHO_DONS_API_URL = 'https://www.who.int/api/hubs/diseaseoutbreaknews';
const DEFAULT_OUTBREAK_LIMIT = 100;
const MAX_OUTBREAK_LIMIT = 100;
const MAX_AI_LOCATION_REPORTS = 20;
const aiLocationCache = new Map();

function getBoundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function getWhoPublicationTime(item = {}) {
  return new Date(item.PublicationDateAndTime || item.PublicationDate || item.LastModified || 0).getTime() || 0;
}

function isAiOutbreakLocationExtractionEnabled() {
  return process.env.WHO_OUTBREAK_AI_LOCATIONS_ENABLED === 'true' && Boolean(process.env.OPENAI_API_KEY);
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function getReportCacheKey(item = {}) {
  return String(item.DonId || item.Id || item.UrlName || item.Title || '').trim();
}

function compactWhoItemForAI(item = {}) {
  return {
    id: getReportCacheKey(item),
    title: item.OverrideTitle || item.Title || '',
    publicationDate: item.PublicationDateAndTime || item.PublicationDate || null,
    summary: stripHtml(item.Summary || item.Overview || '').slice(0, 1200),
    epidemiology: stripHtml(item.Epidemiology || '').slice(0, 1200),
    assessment: stripHtml(item.Assessment || item.Response || item.Advice || '').slice(0, 800)
  };
}

function normalizeAiLocationCandidate(candidate = {}) {
  const confidence = Number(candidate.confidence);
  return {
    locationName: String(candidate.locationName || candidate.name || '').slice(0, 120),
    country: String(candidate.country || '').slice(0, 120),
    admin1: candidate.admin1 ? String(candidate.admin1).slice(0, 120) : '',
    admin2: candidate.admin2 ? String(candidate.admin2).slice(0, 120) : '',
    locationType: candidate.locationType ? String(candidate.locationType).slice(0, 40) : '',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : null,
    evidence: candidate.evidence ? String(candidate.evidence).slice(0, 240) : ''
  };
}

async function extractAiLocationCandidates(items = []) {
  if (!process.env.OPENAI_API_KEY || items.length === 0) return new Map();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const output = new Map();
  const uncachedItems = [];

  items.slice(0, MAX_AI_LOCATION_REPORTS).forEach((item) => {
    const key = getReportCacheKey(item);
    if (!key) return;
    if (aiLocationCache.has(key)) {
      output.set(key, aiLocationCache.get(key));
    } else {
      uncachedItems.push(item);
    }
  });

  if (uncachedItems.length === 0) return output;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_OUTBREAK_LOCATION_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Extract geographic location mentions from WHO Disease Outbreak News text. Return JSON only in this shape: {"reports":[{"id":"...","locations":[{"locationName":"", "country":"", "admin1":"", "admin2":"", "locationType":"country|admin1|admin2|city|health_zone|other", "confidence":0.0, "evidence":""}]}]}. Use only locations explicitly supported by the text. Do not return latitude or longitude. Prefer the most specific operational locations over broad countries, but include a country when no subnational location is explicit.`
        },
        {
          role: 'user',
          content: JSON.stringify({
            reports: uncachedItems.map(compactWhoItemForAI)
          })
        }
      ]
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}');
    const reports = Array.isArray(parsed.reports) ? parsed.reports : [];

    reports.forEach((report) => {
      const key = String(report.id || '').trim();
      if (!key) return;
      const locations = Array.isArray(report.locations)
        ? report.locations
            .map(normalizeAiLocationCandidate)
            .filter((candidate) => candidate.locationName && candidate.country)
            .slice(0, 8)
        : [];
      aiLocationCache.set(key, locations);
      output.set(key, locations);
    });
  } catch (error) {
    console.warn('WHO outbreak AI location extraction failed; using deterministic extraction only:', error.message);
  }

  return output;
}

async function addAiLocationCandidates(data = {}) {
  if (!Array.isArray(data.value) || data.value.length === 0) return data;

  const candidatesById = await extractAiLocationCandidates(data.value);
  if (candidatesById.size === 0) return data;

  return {
    ...data,
    value: data.value.map((item) => {
      const key = getReportCacheKey(item);
      const candidates = candidatesById.get(key);
      return candidates?.length
        ? { ...item, AiLocationCandidates: candidates }
        : item;
    })
  };
}

export const config = {
  api: {
    responseLimit: false
  }
};

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch outbreaks from the last 6 months to get recent data
    // WHO API requires a date filter to return fresh data (otherwise returns cached historical data)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const filterDate = sixMonthsAgo.toISOString().split('.')[0] + 'Z';

    const limit = getBoundedInteger(req.query.limit, DEFAULT_OUTBREAK_LIMIT, 1, MAX_OUTBREAK_LIMIT);
    const skip = getBoundedInteger(req.query.skip, 0, 0, 1000);
    const maxGeocodeQueries = getBoundedInteger(req.query.geocodeLimit, undefined, 0, 200);
    const includeDetailLocations = req.query.detailLocations !== 'false';
    const includeAiLocationsRequested = req.query.aiLocations === 'true';
    const includeAiLocations = includeAiLocationsRequested && isAiOutbreakLocationExtractionEnabled();

    const query = new URLSearchParams({
      $filter: `PublicationDateAndTime ge ${filterDate}`,
      $orderby: 'PublicationDateAndTime desc',
      $top: String(limit)
    });
    const fallbackQuery = new URLSearchParams({
      $orderby: 'PublicationDateAndTime desc',
      $top: String(limit)
    });

    if (skip > 0) {
      query.set('$skip', String(skip));
      fallbackQuery.set('$skip', String(skip));
    }

    const sortedUrl = `${WHO_DONS_API_URL}?${query.toString()}`;
    const fallbackUrl = `${WHO_DONS_API_URL}?${fallbackQuery.toString()}`;

    console.log('Fetching WHO outbreaks since:', filterDate);
    console.log('Query URL:', sortedUrl);

    let response = await fetch(sortedUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Aidstack/1.0)',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.warn(`WHO DONS filtered query returned ${response.status}; retrying sorted feed.`);
      response = await fetch(fallbackUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; Aidstack/1.0)',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
    }

    if (!response.ok) {
      throw new Error(`WHO DONS API returned ${response.status}`);
    }

    const data = await response.json();

    // Debug: Log the most recent items from WHO API
    if (Array.isArray(data.value) && data.value.length > 0) {
      const mostRecent = data.value
        .sort((a, b) => {
          return getWhoPublicationTime(b) - getWhoPublicationTime(a);
        })
        .slice(0, 3);

      console.log('🦠 Most recent WHO items from API:', mostRecent.map(item => ({
        title: item.Title,
        publicationDate: item.PublicationDate,
        lastModified: item.LastModified,
        publicationDateAndTime: item.PublicationDateAndTime
      })));
    }

    if (Array.isArray(data.value)) {
      data.value = data.value
        .slice()
        .sort((a, b) => {
          return getWhoPublicationTime(b) - getWhoPublicationTime(a);
        })
        .slice(0, limit);
    }

    const dataForNormalization = includeAiLocations
      ? await addAiLocationCandidates(data)
      : data;

    const normalizeOptions = {
      includeDetailLocations
    };
    if (Number.isFinite(maxGeocodeQueries)) {
      normalizeOptions.maxGeocodeQueries = maxGeocodeQueries;
    }
    const normalized = await normalizeWhoOutbreakResponse(dataForNormalization, normalizeOptions);
    const latestFilterDate = normalized.reports
      .map((report) => report.filterDate || report.updatedDate || report.reportDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
    const latestUpdatedDate = normalized.reports
      .map((report) => report.updatedDate)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || latestFilterDate;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentMapFeatureCount = normalized.mapFeatures.filter((feature) => {
      const date = new Date(feature.filterDate || feature.updatedDate || feature.reportDate);
      return !Number.isNaN(date.getTime()) && date >= thirtyDaysAgo;
    }).length;

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({
      ...normalized,
      diagnostics: {
        sourceRecords: Array.isArray(data.value) ? data.value.length : 0,
        latestUpdatedDate,
        latestFilterDate,
        recentMapFeatureCount,
        sortedBy: 'PublicationDateAndTime desc',
        filterField: 'PublicationDateAndTime',
        limit,
        skip,
        maxGeocodeQueries: Number.isFinite(maxGeocodeQueries) ? maxGeocodeQueries : null,
        includeDetailLocations,
        includeAiLocations,
        includeAiLocationsRequested,
        aiLocationExtractionConfigured: isAiOutbreakLocationExtractionEnabled(),
        aiLocationReports: includeAiLocations ? Math.min(Array.isArray(data.value) ? data.value.length : 0, MAX_AI_LOCATION_REPORTS) : 0
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('WHO outbreak fetch failed:', error);
    res.status(502).json({
      error: 'Unable to fetch WHO Disease Outbreak News',
      details: error.message
    });
  }
}

export default withRateLimit(handler, 'who-outbreaks');
