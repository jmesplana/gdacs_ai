import axios from 'axios';

/**
 * API endpoint to fetch GDACS disaster geometry (tracks, shakemaps, affected areas)
 *
 * Query parameters:
 * - eventtype: Event type (TC, EQ, FL, DR, VO, WF)
 * - eventid: Event ID
 * - episodeid: Episode ID (optional, defaults to 1)
 */
export default async function handler(req, res) {
  const { eventtype, eventid, episodeid = '1' } = req.query;

  if (!eventtype || !eventid) {
    return res.status(400).json({
      error: 'Missing required parameters: eventtype and eventid'
    });
  }

  try {
    console.log(`Fetching geometry for ${eventtype} event ${eventid}, episode ${episodeid}`);

    const url = `https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=${eventtype}&eventid=${eventid}&episodeid=${episodeid}`;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'GDACS-Facilities-Impact-Tool'
      }
    });

    if (!response.data) {
      throw new Error('No geometry data received from GDACS');
    }

    console.log(`Successfully fetched geometry: ${response.data.features?.length || 0} features`);

    // Return the GeoJSON FeatureCollection
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error fetching GDACS geometry:', error.message);
    res.status(500).json({
      error: 'Failed to fetch disaster geometry',
      details: error.message
    });
  }
}
