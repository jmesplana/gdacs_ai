import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

export default async function handler(req, res) {
  try {
    console.log("Fetching GDACS data from both RSS feed and JSON API...");

    // Fetch both sources in parallel for better performance
    const [rssResponse, jsonResponse] = await Promise.allSettled([
      // RSS feed - fast, up-to-date alerts
      axios.get('https://www.gdacs.org/xml/rss.xml', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
        },
        timeout: 15000
      }),
      // JSON API - detailed geometry data (shakemaps, storm paths, polygons)
      axios.get('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
        },
        timeout: 15000
      })
    ]);

    // Parse RSS feed if successful
    let rssEvents = [];
    if (rssResponse.status === 'fulfilled') {
      try {
        const rssXML = await parseXML(rssResponse.value.data);
        const items = rssXML.rss?.channel?.[0]?.item || [];

        console.log(`Successfully fetched ${items.length} events from RSS feed`);

        rssEvents = items.map(item => {
          // Extract coordinates from georss:point (lat lon format)
          let latitude = null;
          let longitude = null;
          if (item['georss:point'] && item['georss:point'][0]) {
            const coords = item['georss:point'][0].split(' ');
            latitude = parseFloat(coords[0]);
            longitude = parseFloat(coords[1]);
          }

          // Extract bounding box from georss:box
          let bbox = null;
          if (item['georss:box'] && item['georss:box'][0]) {
            const coords = item['georss:box'][0].split(' ').map(parseFloat);
            bbox = {
              minLat: coords[0],
              minLon: coords[1],
              maxLat: coords[2],
              maxLon: coords[3]
            };
          }

          // Extract event ID from link or guid
          let eventId = null;
          const link = item.link?.[0] || '';
          const eventIdMatch = link.match(/eventid=(\d+)/);
          if (eventIdMatch) {
            eventId = parseInt(eventIdMatch[1]);
          }

          // Helper function to extract text from XML fields (handles both text and nested objects)
          const extractText = (field) => {
            if (!field || !field[0]) return '';
            return typeof field[0] === 'string' ? field[0] : (field[0]['_'] || field[0]['#text'] || '');
          };

          // Extract GDACS fields - try different namespace variations
          const alertLevel = extractText(item['gdacs:alertlevel']) ||
                            extractText(item.alertlevel) || '';
          const eventType = extractText(item['gdacs:eventtype']) ||
                           extractText(item.eventtype) || '';
          const severity = extractText(item['gdacs:severity']) ||
                          extractText(item.severity) || '';
          const population = extractText(item['gdacs:population']) ||
                            extractText(item.population) || '';
          const vulnerability = extractText(item['gdacs:vulnerability']) ||
                               extractText(item.vulnerability) || '';
          const country = extractText(item['gdacs:country']) ||
                         extractText(item.country) || '';
          const iso3 = extractText(item['gdacs:iso3']) ||
                      extractText(item.iso3) || '';
          const icon = extractText(item['gdacs:icon']) ||
                      extractText(item.icon) || '';

          return {
            source: 'rss',
            eventId: eventId,
            title: item.title?.[0] || '',
            description: item.description?.[0] || '',
            pubDate: item.pubDate?.[0] || '',
            link: link,
            latitude: latitude,
            longitude: longitude,
            bbox: bbox,
            alertLevel: alertLevel,
            eventType: eventType,
            severity: severity,
            population: population,
            vulnerability: vulnerability,
            country: country,
            iso3: iso3,
            icon: icon,
            // CAP (Common Alerting Protocol) link for additional details
            capLink: item['cap:event']?.[0] || null
          };
        });
      } catch (parseError) {
        console.error("Error parsing RSS feed:", parseError.message);
      }
    } else {
      console.warn("RSS feed fetch failed:", rssResponse.reason?.message);
    }

    // Parse JSON API if successful
    let jsonEventsMap = new Map();
    if (jsonResponse.status === 'fulfilled' && jsonResponse.value.data?.features) {
      const features = jsonResponse.value.data.features;
      console.log(`Successfully fetched ${features.length} events from JSON API`);

      // Build a map of eventId -> detailed geometry data for enrichment
      features.forEach(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates; // [longitude, latitude]

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

        jsonEventsMap.set(props.eventid, enrichmentData);
      });
    } else {
      console.warn("JSON API fetch failed:", jsonResponse.reason?.message);
    }

    // Merge RSS events with JSON API enrichment data
    const mergedEvents = rssEvents.map(rssEvent => {
      const jsonData = jsonEventsMap.get(rssEvent.eventId);

      if (jsonData) {
        // RSS event with JSON API enrichment (best case)
        return {
          ...rssEvent,
          // Add geometry URLs from JSON API (shakemaps, storm paths, polygons)
          geometryUrl: jsonData.geometryUrl,
          detailsUrl: jsonData.detailsUrl,
          reportUrl: jsonData.reportUrl,
          // Add other useful JSON API fields
          episodeId: jsonData.episodeId,
          eventName: jsonData.eventName,
          glide: jsonData.glide,
          affectedCountries: jsonData.affectedCountries,
          alertScore: jsonData.alertScore,
          isCurrent: jsonData.isCurrent,
          fromDate: jsonData.fromDate,
          toDate: jsonData.toDate,
          lastModified: jsonData.lastModified,
          severityData: jsonData.severityData,
          // Mark as enriched
          enriched: true,
          dataSources: ['rss', 'json_api']
        };
      } else {
        // RSS-only event (geometry data not yet available)
        return {
          ...rssEvent,
          enriched: false,
          dataSources: ['rss']
        };
      }
    });

    // Add any JSON API events that weren't in RSS (rare, but possible)
    jsonEventsMap.forEach((jsonData, eventId) => {
      const existsInRSS = rssEvents.some(e => e.eventId === eventId);
      if (!existsInRSS) {
        mergedEvents.push({
          ...jsonData,
          // Transform to match RSS structure
          pubDate: jsonData.fromDate,
          link: jsonData.reportUrl || '',
          webUrl: jsonData.reportUrl || '',
          enriched: true,
          dataSources: ['json_api']
        });
      }
    });

    // Transform to final output format matching existing schema
    const processedDisasters = mergedEvents.map(event => ({
      title: event.title,
      description: event.description,
      pubDate: event.pubDate,
      lastModified: event.lastModified || event.pubDate,
      link: event.link || event.reportUrl || '',
      webUrl: event.link || event.reportUrl || '',
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
      // Legacy fields for backward compatibility
      certainty: '',
      urgency: '',
      polygon: [],
      // Bounding box from RSS
      bbox: event.bbox || null,
      capLink: event.capLink || null,
      population: event.population || '',
      vulnerability: event.vulnerability || ''
    }));

    console.log(`Processed ${processedDisasters.length} disasters (${rssEvents.length} from RSS, ${jsonEventsMap.size} from JSON API)`);
    console.log(`Enriched events: ${processedDisasters.filter(e => e.enriched).length}/${processedDisasters.length}`);

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
