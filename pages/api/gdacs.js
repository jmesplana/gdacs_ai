import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);
const GDACS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
};

const TEXT_VALUE_KEYS = ['_', '#text'];
const CAP_ALERT_KEY = 'cap:alert';
const CAP_INFO_KEY = 'cap:info';
const GEO_POINT_KEY = 'geo:Point';
const GEO_LAT_KEY = 'geo:lat';
const GEO_LON_KEY = 'geo:long';

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null;
  const stringValue = String(value).trim();
  return stringValue || null;
}

function extractText(field) {
  if (!field || !field[0]) return '';
  const value = field[0];
  if (typeof value === 'string') return value.trim();
  for (const key of TEXT_VALUE_KEYS) {
    if (typeof value[key] === 'string') {
      return value[key].trim();
    }
  }
  return '';
}

function extractCapValue(node, key) {
  if (!node) return '';
  return extractText(node[key]);
}

function extractCapParameters(capInfo) {
  if (!capInfo || !capInfo['cap:parameter']) return {};

  return capInfo['cap:parameter'].reduce((acc, parameter) => {
    const name = extractCapValue(parameter, 'cap:valueName').toLowerCase();
    const value = extractCapValue(parameter, 'cap:value');
    if (name) {
      acc[name] = value;
    }
    return acc;
  }, {});
}

function extractCoordinates(item) {
  const pointText = extractText(item[GEO_POINT_KEY]);
  if (pointText) {
    const [lat, lon] = pointText.split(/\s+/).map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }
  }

  const geoPoint = item[GEO_POINT_KEY]?.[0];
  if (geoPoint && typeof geoPoint === 'object') {
    const nestedLat = parseFloat(extractText(geoPoint[GEO_LAT_KEY]));
    const nestedLon = parseFloat(extractText(geoPoint[GEO_LON_KEY]));
    if (Number.isFinite(nestedLat) && Number.isFinite(nestedLon)) {
      return { latitude: nestedLat, longitude: nestedLon };
    }
  }

  const lat = parseFloat(extractText(item[GEO_LAT_KEY]));
  const lon = parseFloat(extractText(item[GEO_LON_KEY]));
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { latitude: lat, longitude: lon };
  }

  return { latitude: null, longitude: null };
}

function extractBoundingBox(item) {
  const boxText = extractText(item['georss:box']);
  if (!boxText) return null;

  const coords = boxText.split(/\s+/).map(Number);
  if (coords.length !== 4 || coords.some(coord => !Number.isFinite(coord))) {
    return null;
  }

  return {
    minLat: coords[0],
    minLon: coords[1],
    maxLat: coords[2],
    maxLon: coords[3]
  };
}

function extractEventIds(item, capAlert) {
  let eventId = null;
  let episodeId = null;
  const capIdentifier = extractCapValue(capAlert, 'cap:identifier');
  const structuredCandidates = [
    extractText(item.link),
    extractText(item.guid),
    capIdentifier,
    extractCapValue(capAlert, 'cap:incidents'),
    extractText(item['cap:event'])
  ].filter(Boolean);

  for (const candidate of structuredCandidates) {
    const eventIdMatch = candidate.match(/eventid=(\d+)/i);
    if (!eventId && eventIdMatch) {
      eventId = parseInt(eventIdMatch[1], 10);
    }

    const episodeMatch = candidate.match(/episodeid=(\d+)/i);
    if (!episodeId && episodeMatch) {
      episodeId = parseInt(episodeMatch[1], 10);
    }

    if (eventId && episodeId) {
      break;
    }
  }

  if (!eventId) {
    const incidentText = extractCapValue(capAlert, 'cap:incidents') || extractText(item['cap:event']);
    const fallbackMatch = incidentText.match(/\b(\d{6,})\b/);
    if (fallbackMatch) {
      eventId = parseInt(fallbackMatch[1], 10);
    }
  }

  if (!episodeId && capIdentifier) {
    const identifierMatch = capIdentifier.match(/GDACS_[A-Z]+_(\d+)_(\d+)/i);
    if (identifierMatch) {
      eventId = eventId || parseInt(identifierMatch[1], 10);
      episodeId = parseInt(identifierMatch[2], 10);
    }
  }

  return { eventId, episodeId };
}

function normalizeCapEventType(rawValue, fallbackText = '') {
  const source = `${rawValue} ${fallbackText}`.toLowerCase();

  if (source.includes('earthquake')) return 'EQ';
  if (source.includes('tropical cyclone') || source.includes('cyclone') || source.includes('storm')) return 'TC';
  if (source.includes('flood')) return 'FL';
  if (source.includes('volcano') || source.includes('eruption')) return 'VO';
  if (source.includes('wildfire') || source.includes('forest fire') || source.includes('fire')) return 'WF';
  if (source.includes('drought')) return 'DR';
  if (source.includes('tsunami')) return 'TS';

  return rawValue || '';
}

function buildGdacsReportUrl(eventType, eventId, episodeId) {
  if (!eventType || !eventId || !episodeId) return '';

  const params = new URLSearchParams({
    eventtype: String(eventType),
    eventid: String(eventId),
    episodeid: String(episodeId)
  });

  return `https://www.gdacs.org/report.aspx?${params.toString()}`;
}

function parsePrimaryFeedItems(xmlData, sourceLabel) {
  const root = xmlData.rss?.channel?.[0];
  const items = root?.item || [];

  return items.map(item => {
    const capAlert = item[CAP_ALERT_KEY]?.[0] || null;
    const capInfo = capAlert?.[CAP_INFO_KEY]?.[0] || null;
    const capParameters = extractCapParameters(capInfo);
    const coords = extractCoordinates(item);
    const { eventId: parsedEventId, episodeId: parsedEpisodeId } = extractEventIds(item, capAlert);

    const title = extractText(item.title);
    const description = extractText(item.description);
    const capSent = extractCapValue(capAlert, 'cap:sent');
    const capStatus = extractCapValue(capAlert, 'cap:status');
    const capMsgType = extractCapValue(capAlert, 'cap:msgType');
    const capScope = extractCapValue(capAlert, 'cap:scope');
    const capIdentifier = extractCapValue(capAlert, 'cap:identifier');
    const capIncidents = extractCapValue(capAlert, 'cap:incidents');
    const capEvent = extractCapValue(capInfo, 'cap:event');
    const capUrgency = extractCapValue(capInfo, 'cap:urgency');
    const capCertainty = extractCapValue(capInfo, 'cap:certainty');
    const capSeverity = extractCapValue(capInfo, 'cap:severity');
    const capHeadline = extractCapValue(capInfo, 'cap:headline');
    const capAreaDesc = extractCapValue(capInfo, 'cap:areaDesc');
    const eventId = parsedEventId || (capParameters.eventid ? parseInt(capParameters.eventid, 10) : null);
    const episodeId = parsedEpisodeId || (capParameters.currentepisodeid ? parseInt(capParameters.currentepisodeid, 10) : null);

    const eventType = normalizeCapEventType(
      extractText(item['gdacs:eventtype']) || capParameters.eventtype || capEvent,
      `${title} ${description}`
    );

    return {
      source: sourceLabel,
      eventId,
      episodeId,
      title: title || capHeadline || capEvent,
      description,
      pubDate: capParameters.fromdate || extractText(item.pubDate) || capSent,
      lastModified: capParameters.datemodified || capSent || extractText(item.pubDate),
      link: extractText(item.link),
      latitude: coords.latitude,
      longitude: coords.longitude,
      bbox: extractBoundingBox(item),
      alertLevel: extractText(item['gdacs:alertlevel']) || capParameters.alertlevel || '',
      eventType,
      severity: extractText(item['gdacs:severity']) || capParameters.severity || capSeverity || '',
      population: extractText(item['gdacs:population']) || capParameters.population || '',
      vulnerability: extractText(item['gdacs:vulnerability']) || capParameters.vulnerability || '',
      country: extractText(item['gdacs:country']) || capParameters.country || capAreaDesc || '',
      iso3: extractText(item['gdacs:iso3']) || capParameters.iso3 || '',
      icon: extractText(item['gdacs:icon']) || '',
      certainty: capCertainty,
      urgency: capUrgency,
      capLink: capParameters.link || extractText(item['cap:event']) || null,
      capIdentifier,
      capStatus,
      capMsgType,
      capScope,
      capIncidents,
      capParameters,
      eventName: capParameters.eventname || ''
    };
  });
}

export default async function handler(req, res) {
  try {
    console.log("Fetching GDACS data from CAP feed and JSON API...");

    const [capResponse, jsonResponse] = await Promise.allSettled([
      axios.get('https://www.gdacs.org/xml/gdacs_cap.xml', {
        headers: GDACS_HEADERS,
        timeout: 15000
      }),
      axios.get('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH', {
        headers: {
          'Accept': 'application/json',
          ...GDACS_HEADERS,
        },
        timeout: 15000
      })
    ]);

    let primaryEvents = [];
    let primarySource = 'cap';

    if (capResponse.status === 'fulfilled') {
      try {
        const capXML = await parseXML(capResponse.value.data);
        primaryEvents = parsePrimaryFeedItems(capXML, 'cap');
        console.log(`Successfully fetched ${primaryEvents.length} events from CAP feed`);
      } catch (parseError) {
        console.error("Error parsing CAP feed:", parseError.message);
      }
    } else {
      console.warn("CAP feed fetch failed:", capResponse.reason?.message);
    }

    if (primaryEvents.length === 0) {
      primarySource = 'rss_fallback';
      try {
        const rssResponse = await axios.get('https://www.gdacs.org/xml/rss.xml', {
          headers: GDACS_HEADERS,
          timeout: 15000
        });
        const rssXML = await parseXML(rssResponse.data);
        primaryEvents = parsePrimaryFeedItems(rssXML, 'rss');
        console.log(`Fell back to RSS feed with ${primaryEvents.length} events`);
      } catch (rssError) {
        console.warn("RSS fallback fetch failed:", rssError.message);
      }
    }

    let jsonEventsMap = new Map();
    if (jsonResponse.status === 'fulfilled' && jsonResponse.value.data?.features) {
      const features = jsonResponse.value.data.features;
      console.log(`Successfully fetched ${features.length} events from JSON API`);

      // Build a map of eventId -> detailed geometry data for enrichment
      features.forEach(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates; // [longitude, latitude]
        const normalizedEventId = normalizeId(props.eventid);

        const enrichmentData = {
          source: 'json_api',
          eventId: props.eventid,
          episodeId: props.episodeid,
          // Geometry data - the key advantage of JSON API
          geometryUrl: props.url && props.url.geometry ? props.url.geometry : null,
          detailsUrl: props.url && props.url.details ? props.url.details : null,
          reportUrl: props.url && props.url.report ? props.url.report : null,
          // Additional metadata
          eventName: props.eventname || '',
          glide: props.glide || '',
          affectedCountries: props.affectedcountries || [],
          alertScore: props.alertscore || 0,
          isCurrent: props.iscurrent === 'true',
          fromDate: props.fromdate || '',
          toDate: props.todate || '',
          lastModified: props.datemodified || props.fromdate || '',
          severityData: props.severitydata || null,
          // Fallback data if RSS doesn't have these
          latitude: coords[1],
          longitude: coords[0],
          title: props.name || props.description || '',
          description: props.description || props.htmldescription || '',
          alertLevel: props.alertlevel || '',
          eventType: props.eventtype || '',
          country: props.country || '',
          iso3: props.iso3 || '',
          icon: props.icon || ''
        };

        if (normalizedEventId) {
          jsonEventsMap.set(normalizedEventId, enrichmentData);
        }
      });
    } else {
      console.warn("JSON API fetch failed:", jsonResponse.reason?.message);
    }

    const capEventsMap = new Map(
      primaryEvents
        .map(event => [normalizeId(event.eventId), event])
        .filter(([eventId]) => Boolean(eventId))
    );

    const mergedEvents = [];

    // Prefer JSON API events as the primary map source because they carry geometry URLs
    // needed for cyclone tracks, shakemaps, and other impact-zone overlays.
    jsonEventsMap.forEach((jsonData, eventId) => {
      const primaryEvent = capEventsMap.get(eventId);

      if (primaryEvent) {
        mergedEvents.push({
          ...jsonData,
          ...primaryEvent,
          latitude: Number.isFinite(primaryEvent.latitude) ? primaryEvent.latitude : jsonData.latitude,
          longitude: Number.isFinite(primaryEvent.longitude) ? primaryEvent.longitude : jsonData.longitude,
          eventId: primaryEvent.eventId || jsonData.eventId,
          episodeId: primaryEvent.episodeId || jsonData.episodeId,
          title: primaryEvent.title || jsonData.title,
          description: primaryEvent.description || jsonData.description,
          pubDate: primaryEvent.pubDate || jsonData.fromDate,
          lastModified: jsonData.lastModified || primaryEvent.lastModified || primaryEvent.pubDate,
          link: jsonData.reportUrl || primaryEvent.link || '',
          webUrl: jsonData.reportUrl || primaryEvent.link || '',
          geometryUrl: jsonData.geometryUrl,
          detailsUrl: jsonData.detailsUrl,
          reportUrl: jsonData.reportUrl,
          eventName: jsonData.eventName || primaryEvent.eventName || '',
          glide: jsonData.glide || '',
          affectedCountries: jsonData.affectedCountries,
          alertScore: jsonData.alertScore,
          isCurrent: jsonData.isCurrent,
          fromDate: jsonData.fromDate,
          toDate: jsonData.toDate,
          severityData: jsonData.severityData,
          enriched: true,
          dataSources: [primaryEvent.source, 'json_api']
        });
      } else {
        mergedEvents.push({
          ...jsonData,
          pubDate: jsonData.fromDate,
          link: jsonData.reportUrl || '',
          webUrl: jsonData.reportUrl || '',
          enriched: true,
          dataSources: ['json_api']
        });
      }
    });

    primaryEvents.forEach(primaryEvent => {
      const eventId = normalizeId(primaryEvent.eventId);
      const existsInMerged = eventId && jsonEventsMap.has(eventId);

      if (!existsInMerged) {
        mergedEvents.push({
          ...primaryEvent,
          enriched: false,
          dataSources: [primaryEvent.source]
        });
      }
    });

    // Transform to final output format matching existing schema
    const processedDisasters = mergedEvents.map(event => ({
      reportPageUrl: buildGdacsReportUrl(event.eventType, event.eventId, event.episodeId),
      title: event.title,
      description: event.description,
      pubDate: event.pubDate,
      lastModified: event.lastModified || event.pubDate,
      link: buildGdacsReportUrl(event.eventType, event.eventId, event.episodeId) || event.reportUrl || event.webUrl || event.link || '',
      webUrl: buildGdacsReportUrl(event.eventType, event.eventId, event.episodeId) || event.reportUrl || event.webUrl || event.link || '',
      latitude: event.latitude,
      longitude: event.longitude,
      alertLevel: event.alertLevel,
      eventType: event.eventType,
      eventName: event.eventName || '',
      severity: event.severityData?.severitytext || event.severity || '',
      eventId: event.eventId,
      episodeId: event.episodeId || null,
      glide: event.glide || '',
      country: event.country,
      iso3: event.iso3,
      affectedCountries: event.affectedCountries || [],
      alertScore: event.alertScore || 0,
      isCurrent: event.isCurrent || false,
      fromDate: event.fromDate || '',
      toDate: event.toDate || '',
      icon: event.icon,
      // Geometry URLs for detailed data (shakemaps, storm paths, polygons)
      geometryUrl: event.geometryUrl || null,
      detailsUrl: event.detailsUrl || null,
      reportUrl: event.reportUrl || null,
      // Metadata about data sources
      enriched: event.enriched,
      dataSources: event.dataSources,
      certainty: event.certainty || '',
      urgency: event.urgency || '',
      polygon: [],
      // Bounding box from RSS
      bbox: event.bbox || null,
      capLink: event.capLink || null,
      population: event.population || '',
      vulnerability: event.vulnerability || '',
      capIdentifier: event.capIdentifier || '',
      capStatus: event.capStatus || '',
      capMsgType: event.capMsgType || '',
      capScope: event.capScope || '',
      capIncidents: event.capIncidents || '',
      primarySource
    }));

    const eventsWithCoordinates = processedDisasters.filter(event =>
      Number.isFinite(event.latitude) && Number.isFinite(event.longitude)
    ).length;

    console.log(`Processed ${processedDisasters.length} disasters (${primaryEvents.length} from ${primarySource}, ${jsonEventsMap.size} from JSON API)`);
    console.log(`Enriched events: ${processedDisasters.filter(e => e.enriched).length}/${processedDisasters.length}`);
    console.log(`Events with coordinates: ${eventsWithCoordinates}/${processedDisasters.length}`);
    console.log(`Events with geometry URL: ${processedDisasters.filter(e => Boolean(e.geometryUrl)).length}/${processedDisasters.length}`);

    // Return the merged disaster data
    res.status(200).json(processedDisasters);

  } catch (error) {
    console.error("Error fetching GDACS data:", error.message);

    // Return error status
    res.status(500).json({
      error: "Failed to fetch GDACS data",
      message: error.message
    });
  }
}
