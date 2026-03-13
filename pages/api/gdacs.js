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
      // Try direct fetch with CORS headers to CAP XML feed
      console.log("Attempting direct fetch from CAP XML...");
      response = await axios.get('https://www.gdacs.org/xml/gdacs_cap.xml', {
        headers: {
          'Accept': 'application/xml, text/xml, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
        },
        timeout: 10000 // Extended timeout for larger XML
      });
      xmlData = response.data;
      fetchMethod = 'direct-cap';
    } catch (error) {
      console.log("Direct CAP fetch failed:", error.message);
      
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
          // Try direct fetch with RSS as fallback
          console.log("Attempting direct fetch from RSS...");
          response = await axios.get('https://gdacs.org/xml/rss.xml', {
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'User-Agent': 'Mozilla/5.0 (compatible; GDACSFacilitiesApp/1.0)',
            },
            timeout: 5000
          });
          xmlData = response.data;
          fetchMethod = 'direct-rss';
        } catch (error) {
          console.log("Direct RSS fetch failed:", error.message);
          
          // All fetch methods failed
          throw new Error("All fetch methods failed");
        }
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
      console.log('Processing GDACS item, title:', item.title);
      
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
      
      // Extract GDACS-specific information
      let gdacsEventName = '';
      let gdacsEventType = '';
      let gdacsAlertLevel = '';
      let severity = '';
      let certainty = '';
      let urgency = '';
      let polygon = [];
      
      // First try to get from gdacs namespace (RSS format)
      if (item['gdacs:eventname']) gdacsEventName = item['gdacs:eventname'];
      if (item['gdacs:eventtype']) gdacsEventType = item['gdacs:eventtype'];
      if (item['gdacs:alertlevel']) gdacsAlertLevel = item['gdacs:alertlevel'];
      
      // Then try to get from CAP format
      if (item['cap:alert']) {
        const capAlert = item['cap:alert'];
        
        if (capAlert['cap:info']) {
          const capInfo = Array.isArray(capAlert['cap:info']) 
            ? capAlert['cap:info'][0] 
            : capAlert['cap:info'];
          
          // Extract event type if not found from gdacs namespace
          if (!gdacsEventType && capInfo['cap:event']) {
            const event = capInfo['cap:event'];
            // Map event name to GDACS event code
            if (event.includes('Earthquake')) gdacsEventType = 'EQ';
            else if (event.includes('Tropical Cyclone')) gdacsEventType = 'TC';
            else if (event.includes('Flood')) gdacsEventType = 'FL';
            else if (event.includes('Volcano')) gdacsEventType = 'VO';
            else if (event.includes('Drought')) gdacsEventType = 'DR';
            else if (event.includes('Wild Fire')) gdacsEventType = 'WF';
            else if (event.includes('Tsunami')) gdacsEventType = 'TS';
          }
          
          // Extract CAP specific fields
          if (capInfo['cap:severity']) severity = capInfo['cap:severity'];
          if (capInfo['cap:certainty']) certainty = capInfo['cap:certainty'];
          if (capInfo['cap:urgency']) urgency = capInfo['cap:urgency'];
          
          // Extract polygon data
          if (capInfo['cap:area']) {
            const capArea = Array.isArray(capInfo['cap:area']) 
              ? capInfo['cap:area'][0] 
              : capInfo['cap:area'];
            
            if (capArea['cap:polygon']) {
              const polygonText = capArea['cap:polygon'];
              console.log(`Found polygon data for ${item.title}`);
              
              try {
                // Parse polygon points (format: "lat1,lon1 lat2,lon2 ...")
                const points = polygonText.split(' ');
                polygon = points.map(point => {
                  const [lat, lon] = point.split(',');
                  return [parseFloat(lat), parseFloat(lon)];
                }).filter(coord => 
                  !isNaN(coord[0]) && !isNaN(coord[1]) &&
                  coord[0] >= -90 && coord[0] <= 90 && 
                  coord[1] >= -180 && coord[1] <= 180
                );
                
                console.log(`Extracted ${polygon.length} valid polygon points`);
              } catch (e) {
                console.error(`Error parsing polygon: ${e.message}`);
              }
            }
          }
        }
      }
      
      console.log(`Processed disaster: type=${gdacsEventType}, severity=${severity}, polygon points=${polygon.length}`);
      
      // Extract proper web URL from CAP data
      let webUrl = '';
      
      // First check if web URL is in cap:web
      if (item['cap:alert'] && item['cap:alert']['cap:info']) {
        const capInfo = Array.isArray(item['cap:alert']['cap:info']) 
          ? item['cap:alert']['cap:info'][0] 
          : item['cap:alert']['cap:info'];
          
        if (capInfo['cap:web']) {
          webUrl = capInfo['cap:web'];
        }
      }
      
      // Then check if it's in parameters with valueName="link"
      if (!webUrl && item['cap:alert'] && item['cap:alert']['cap:info']) {
        const capInfo = Array.isArray(item['cap:alert']['cap:info']) 
          ? item['cap:alert']['cap:info'][0] 
          : item['cap:alert']['cap:info'];
          
        if (capInfo['cap:parameter']) {
          const parameters = Array.isArray(capInfo['cap:parameter']) 
            ? capInfo['cap:parameter'] 
            : [capInfo['cap:parameter']];
            
          const linkParam = parameters.find(param => 
            param['cap:valueName'] === 'link'
          );
          
          if (linkParam && linkParam['cap:value']) {
            webUrl = linkParam['cap:value'];
          }
        }
      }
      
      // If no proper web URL found, use the original link
      if (!webUrl) {
        webUrl = item.link || '';
      }
      
      return {
        title: item.title || '',
        description: item.description || '',
        pubDate: item.pubDate || '',
        link: item.link || '',
        webUrl: webUrl,
        latitude: geoLat ? parseFloat(geoLat) : null,
        longitude: geoLong ? parseFloat(geoLong) : null,
        alertLevel: gdacsAlertLevel,
        eventType: gdacsEventType,
        eventName: gdacsEventName,
        severity: severity,
        certainty: certainty,
        urgency: urgency,
        polygon: polygon.length > 2 ? polygon : []
      };
    });
    
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
