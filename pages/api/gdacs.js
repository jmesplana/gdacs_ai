import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXml = promisify(parseString);

export default async function handler(req, res) {
  try {
    // Try different methods to fetch the GDACS data
    let response;
    let xmlData;
    let fetchMethod = '';
    
    try {
      // Try to fetch using the Vercel rewrite (without baseURL, letting Next.js handle the rewrite)
      console.log("Attempting to fetch with rewrite...");
      response = await axios.get('/api/gdacs-feed', {
        timeout: 5000
      });
      xmlData = response.data;
      fetchMethod = 'rewrite';
    } catch (error) {
      console.log("Rewrite fetch failed:", error.message);
      
      try {
        // Try direct fetch with CORS headers
        console.log("Attempting direct fetch...");
        response = await axios.get('https://gdacs.org/xml/rss.xml', {
          headers: {
            'Accept': 'application/xml, text/xml, */*',
            'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
          },
          timeout: 5000
        });
        xmlData = response.data;
        fetchMethod = 'direct';
      } catch (error) {
        console.log("Direct fetch failed:", error.message);
        
        // All fetch methods failed, fall back to mock data
        throw new Error("All fetch methods failed");
      }
    }
    
    console.log(`Successfully fetched data via ${fetchMethod}`);
    
    // Parse XML to JSON
    const result = await parseXml(xmlData, { explicitArray: false });
    
    if (!result || !result.rss || !result.rss.channel || !result.rss.channel.item) {
      throw new Error("Invalid XML structure from GDACS");
    }
    
    // Extract items
    const items = result.rss.channel.item;
    const disasters = Array.isArray(items) ? items : [items];
    
    // Process disaster data
    const processedDisasters = disasters.map(item => {
      console.log('Processing GDACS item:', JSON.stringify(item));
      
      // Extract geo information if available
      let geoLat = null;
      let geoLong = null;
      
      // Try different possible paths for geo coordinates
      if (item['geo:lat']) {
        geoLat = item['geo:lat'];
      } else if (item['geo:Point'] && item['geo:Point']['geo:lat']) {
        geoLat = item['geo:Point']['geo:lat'];
      }
      
      if (item['geo:long']) {
        geoLong = item['geo:long'];
      } else if (item['geo:Point'] && item['geo:Point']['geo:long']) {
        geoLong = item['geo:Point']['geo:long'];
      }
      
      // Try to extract from georss:point if available (format: "lat long")
      if (!geoLat && !geoLong && item['georss:point']) {
        const pointParts = item['georss:point'].split(' ');
        if (pointParts.length === 2) {
          geoLat = pointParts[0];
          geoLong = pointParts[1];
        }
      }
      
      console.log(`Found coordinates: [${geoLat}, ${geoLong}] for ${item.title}`);
      
      // Extract GDACS-specific information
      const gdacsEventName = item['gdacs:eventname'] || '';
      const gdacsEventType = item['gdacs:eventtype'] || '';
      const gdacsAlertLevel = item['gdacs:alertlevel'] || '';
      
      return {
        title: item.title || '',
        description: item.description || '',
        pubDate: item.pubDate || '',
        link: item.link || '',
        latitude: geoLat ? parseFloat(geoLat) : null,
        longitude: geoLong ? parseFloat(geoLong) : null,
        alertLevel: gdacsAlertLevel,
        eventType: gdacsEventType,
        eventName: gdacsEventName
      };
    });
    
    // Return the disaster data
    res.status(200).json(processedDisasters);
    
  } catch (error) {
    console.error("Error fetching GDACS data:", error.message);
    
    // For development, provide mock data if the real API fails
    const mockDisasters = generateMockDisasters();
    res.status(200).json(mockDisasters);
  }
}

// Function to generate mock disaster data for development/testing
function generateMockDisasters() {
  return [
    {
      title: "EQ 6.2 M, Indonesia (Indonesia) 2024-03-30 UTC",
      description: "Earthquake of magnitude 6.2M in Indonesia. The earthquake occurred at a depth of 10km.",
      pubDate: "Sat, 30 Mar 2024 10:15:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345678",
      latitude: -0.7893,
      longitude: 131.2461,
      alertLevel: "Orange",
      eventType: "EQ",
      eventName: "Earthquake Indonesia"
    },
    {
      title: "TC IRENE-24, Philippines (Philippines) 2024-03-29 UTC",
      description: "Tropical Cyclone IRENE-24 with maximum sustained winds of 120 km/h making landfall in Philippines.",
      pubDate: "Fri, 29 Mar 2024 18:30:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345679",
      latitude: 13.2543,
      longitude: 123.6714,
      alertLevel: "Red",
      eventType: "TC",
      eventName: "Tropical Cyclone IRENE-24"
    },
    {
      title: "FL, Vietnam (Vietnam) 2024-03-28 UTC",
      description: "Flooding reported in central Vietnam after heavy rainfall. Multiple provinces affected.",
      pubDate: "Thu, 28 Mar 2024 09:45:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345680",
      latitude: 16.4637,
      longitude: 107.5909,
      alertLevel: "Orange",
      eventType: "FL",
      eventName: "Flood Vietnam"
    },
    {
      title: "VO, Iceland (Iceland) 2024-03-26 UTC",
      description: "Volcanic activity reported in Iceland. Eruption ongoing with ash emissions.",
      pubDate: "Tue, 26 Mar 2024 14:20:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345681",
      latitude: 63.6301,
      longitude: -19.0516,
      alertLevel: "Green",
      eventType: "VO",
      eventName: "Volcano Iceland"
    },
    {
      title: "DR, Ethiopia (Ethiopia) 2024-03-25 UTC",
      description: "Drought conditions worsening in Ethiopia affecting agricultural production and water availability.",
      pubDate: "Mon, 25 Mar 2024 11:10:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345682",
      latitude: 9.1450,
      longitude: 40.4897,
      alertLevel: "Orange",
      eventType: "DR",
      eventName: "Drought Ethiopia"
    },
    // Add more mock disasters with dates further in the past
    {
      title: "EQ 5.8 M, Peru (Peru) 2024-03-20 UTC",
      description: "Earthquake of magnitude 5.8M in Peru. Minimal damage reported.",
      pubDate: "Mon, 20 Mar 2024 08:30:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345683",
      latitude: -12.0464,
      longitude: -77.0428,
      alertLevel: "Green",
      eventType: "EQ",
      eventName: "Earthquake Peru"
    },
    {
      title: "TC ALEX-24, Madagascar (Madagascar) 2024-03-15 UTC",
      description: "Tropical Cyclone ALEX-24 affecting eastern coast of Madagascar.",
      pubDate: "Wed, 15 Mar 2024 12:20:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345684",
      latitude: -18.9249,
      longitude: 47.5185,
      alertLevel: "Orange",
      eventType: "TC",
      eventName: "Tropical Cyclone ALEX-24"
    },
    {
      title: "FL, Brazil (Brazil) 2024-03-10 UTC",
      description: "Severe flooding in Southern Brazil after prolonged rainfall.",
      pubDate: "Fri, 10 Mar 2024 10:00:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345685",
      latitude: -23.5505,
      longitude: -46.6333,
      alertLevel: "Red",
      eventType: "FL",
      eventName: "Flood Brazil"
    },
    {
      title: "VO, Japan (Japan) 2024-03-05 UTC",
      description: "Volcanic activity reported in Japan. Minor eruption with ash plume.",
      pubDate: "Sun, 05 Mar 2024 14:45:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345686",
      latitude: 35.3606,
      longitude: 138.7274,
      alertLevel: "Green",
      eventType: "VO",
      eventName: "Volcano Japan"
    },
    {
      title: "DR, Kenya (Kenya) 2024-03-01 UTC",
      description: "Drought affecting eastern regions of Kenya. Agricultural impact significant.",
      pubDate: "Fri, 01 Mar 2024 09:30:00 UTC",
      link: "https://gdacs.org/report.aspx?eventid=1345687",
      latitude: 1.2921,
      longitude: 36.8219,
      alertLevel: "Orange",
      eventType: "DR",
      eventName: "Drought Kenya"
    }
  ];
}