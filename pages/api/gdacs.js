import axios from 'axios';

export default async function handler(req, res) {
  try {
    console.log("Fetching GDACS data from JSON API...");

    // Use the GDACS JSON API which is more reliable and works from local networks
    // This API returns the most recent 100 events from the last 4 days in GeoJSON format
    const response = await axios.get('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
      },
      timeout: 15000
    });

    if (!response.data || !response.data.features) {
      throw new Error("Invalid response structure from GDACS API");
    }

    console.log(`Successfully fetched ${response.data.features.length} events from GDACS API`);

    // Transform GeoJSON features to match the expected format
    const processedDisasters = response.data.features.map(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates; // [longitude, latitude]

      console.log('Processing GDACS event:', props.name || props.eventname);

      // Fetch polygon data if available
      let polygon = [];
      if (props.url && props.url.geometry) {
        // Polygon URL is available but we'll fetch it lazily on the client side
        // For now, just return empty array and fetch polygons separately if needed
        polygon = [];
      }

      // Map alert level text (Red, Orange, Green) to match old format
      let alertLevel = props.alertlevel || '';

      // Build description from available fields
      let description = props.description || props.htmldescription || '';

      // Format dates
      let pubDate = props.fromdate || props.datemodified || '';

      // Build title
      let title = props.name || props.description || '';

      // Build link to GDACS report page
      let link = '';
      let webUrl = '';
      if (props.url && props.url.report) {
        link = props.url.report;
        webUrl = props.url.report;
      }

      return {
        title: title,
        description: description,
        pubDate: pubDate,
        link: link,
        webUrl: webUrl,
        latitude: coords[1], // GeoJSON uses [lon, lat]
        longitude: coords[0],
        alertLevel: alertLevel,
        eventType: props.eventtype || '',
        eventName: props.eventname || '',
        severity: props.severitydata ? props.severitydata.severitytext : '',
        certainty: '', // Not provided in JSON API
        urgency: '', // Not provided in JSON API
        polygon: polygon,
        // Additional useful fields from the JSON API
        eventId: props.eventid,
        episodeId: props.episodeid,
        glide: props.glide || '',
        country: props.country || '',
        iso3: props.iso3 || '',
        affectedCountries: props.affectedcountries || [],
        alertScore: props.alertscore || 0,
        isCurrent: props.iscurrent === 'true',
        fromDate: props.fromdate || '',
        toDate: props.todate || '',
        icon: props.icon || '',
        geometryUrl: props.url && props.url.geometry ? props.url.geometry : null
      };
    });

    console.log(`Processed ${processedDisasters.length} disasters`);

    // Return the disaster data
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
