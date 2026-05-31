import { withRateLimit } from '../../lib/rateLimit';
import { normalizeWhoOutbreakResponse } from '../../lib/whoOutbreaks';

const WHO_DONS_API_URL = 'https://www.who.int/api/hubs/diseaseoutbreaknews';

function getWhoPublicationTime(item = {}) {
  return new Date(item.PublicationDateAndTime || item.PublicationDate || item.LastModified || 0).getTime() || 0;
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

    const query = new URLSearchParams({
      $filter: `PublicationDateAndTime ge ${filterDate}`,
      $orderby: 'PublicationDateAndTime desc',
      $top: '100'
    });
    const fallbackQuery = new URLSearchParams({
      $orderby: 'PublicationDateAndTime desc',
      $top: '100'
    });
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
        .slice(0, 100);
    }

    const normalized = await normalizeWhoOutbreakResponse(data);
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
        filterField: 'PublicationDateAndTime'
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
