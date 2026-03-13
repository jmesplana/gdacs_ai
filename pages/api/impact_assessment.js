import { withRateLimit } from '../../lib/rateLimit';
import Papa from 'papaparse';
import { getDistance, isPointInPolygon, getAreaOfPolygon } from 'geolib';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase from default 1mb to handle large datasets
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facilities, disasters, acledEvents = [] } = req.body;

    if (!facilities) {
      return res.status(400).json({ error: 'Missing facilities data' });
    }

    // disasters and acledEvents are both optional - at least one should be provided
    if ((!disasters || disasters.length === 0) && (!acledEvents || acledEvents.length === 0)) {
      console.log('No disasters or ACLED events provided - returning empty impact assessment');
      return res.status(200).json({
        impactedFacilities: [],
        statistics: { facilitiesImpacted: 0, totalImpacts: 0 }
      });
    }
    
    // Process CSV data
    let facilityData = [];
    if (typeof facilities === 'string') {
      // Parse CSV string
      const parsedCsv = Papa.parse(facilities, {
        header: true,
        skipEmptyLines: true
      });

      // Preserve ALL fields from the CSV, not just name/lat/lng
      facilityData = parsedCsv.data.map(row => {
        const facility = {
          name: row.name,
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude)
        };

        // Add all other fields from the CSV
        Object.keys(row).forEach(key => {
          if (key !== 'name' && key !== 'latitude' && key !== 'longitude' && row[key]) {
            facility[key] = row[key];
          }
        });

        return facility;
      });
    } else if (Array.isArray(facilities)) {
      // Already parsed data
      facilityData = facilities;
    }
    
    // Assess impact with both GDACS disasters and ACLED events
    const assessmentResult = assessImpact(facilityData, disasters || [], acledEvents || []);

    res.status(200).json({
      impactedFacilities: assessmentResult.impactedFacilities,
      statistics: assessmentResult.statistics
    });
  } catch (error) {
    console.error('Error assessing impact:', error);
    res.status(500).json({ error: error.message });
  }
}

function assessImpact(facilities, disasters, acledEvents) {
  console.time('Impact assessment total');
  const impacted = [];
  const disasterStats = {};
  const overlappingDisasters = {};

  // Combine GDACS disasters and ACLED events into a single threat array
  // ACLED events need to be converted to disaster-like format for processing
  const acledThreats = acledEvents.map(event => ({
    eventType: event.event_type || 'Security Event',
    eventName: event.event_type || 'ACLED Event',
    title: `${event.event_type} - ${event.sub_event_type}`,
    latitude: parseFloat(event.latitude),
    longitude: parseFloat(event.longitude),
    alertLevel: 'Orange', // Treat ACLED events as medium-high severity
    severity: 'Moderate',
    source: 'ACLED',
    event_date: event.event_date,
    fatalities: event.fatalities || 0,
    notes: event.notes
  }));

  const allThreats = [...disasters, ...acledThreats];

  console.log(`Starting assessment: ${facilities.length} facilities vs ${disasters.length} GDACS disasters + ${acledEvents.length} ACLED events = ${allThreats.length} total threats`);

  // Pre-process all threats (GDACS + ACLED) to collect statistics
  console.time('Pre-process threats');
  for (const threat of allThreats) {
    if (!threat.latitude || !threat.longitude) continue;

    const threatId = threat.eventName || threat.title || `${threat.eventType}-${threat.latitude}-${threat.longitude}`;
    disasterStats[threatId] = {
      type: threat.eventType,
      alertLevel: threat.alertLevel || 'Unknown',
      name: threat.eventName || threat.title || 'Unnamed',
      affectedFacilities: 0,
      impactArea: calculateImpactArea(threat),
      severity: threat.severity || threat.alertLevel || 'Unknown',
      polygon: hasValidPolygon(threat),
      source: threat.source || 'GDACS'
    };
  }
  console.timeEnd('Pre-process threats');

  // Process each facility
  console.time('Process facilities');

  // Pre-calculate impact radii and bounding boxes for all threats (optimization)
  const threatData = allThreats.map(threat => {
    if (!threat.latitude || !threat.longitude) return null;

    const impactRadius = getImpactRadius(threat);
    return {
      disaster: threat, // Keep property name as 'disaster' for compatibility
      lat: parseFloat(threat.latitude),
      lng: parseFloat(threat.longitude),
      radius: impactRadius,
      // Bounding box for quick rejection (approximate degrees per km at equator)
      minLat: parseFloat(threat.latitude) - (impactRadius / 111),
      maxLat: parseFloat(threat.latitude) + (impactRadius / 111),
      minLng: parseFloat(threat.longitude) - (impactRadius / (111 * Math.cos(threat.latitude * Math.PI / 180))),
      maxLng: parseFloat(threat.longitude) + (impactRadius / (111 * Math.cos(threat.latitude * Math.PI / 180))),
      disasterId: threat.eventName || threat.title || `${threat.eventType}-${threat.latitude}-${threat.longitude}`
    };
  }).filter(d => d !== null);

  for (const facility of facilities) {
    const facilityLat = parseFloat(facility.latitude);
    const facilityLng = parseFloat(facility.longitude);
    const facilityPos = { latitude: facilityLat, longitude: facilityLng };

    const facilityImpacts = [];
    const impactingDisasters = [];

    for (const threatInfo of threatData) {
      const { disaster, lat, lng, radius, minLat, maxLat, minLng, maxLng, disasterId } = threatInfo;

      // Quick bounding box check - skip if facility is clearly outside impact area
      if (facilityLat < minLat || facilityLat > maxLat ||
          facilityLng < minLng || facilityLng > maxLng) {
        continue;
      }

      const disasterPos = { latitude: lat, longitude: lng };

      // First check if we have a valid polygon for more accurate assessment
      let isImpacted = false;
      let impactMethod = "radius"; // Default method
      let distance = getDistance(facilityPos, disasterPos) / 1000; // Calculate distance in kilometers
      
      // Try to use polygon data for precise impact assessment if available
      if (hasValidPolygon(disaster)) {
        const polygon = convertPolygonFormat(disaster.polygon);
        if (isPointInPolygon(facilityPos, polygon)) {
          isImpacted = true;
          impactMethod = "polygon";
          // Set distance to 0 if inside polygon
          distance = 0;
        }
      }
      
      // If not impacted by polygon, fall back to radius-based assessment
      if (!isImpacted) {
        // Use pre-calculated impact radius
        if (distance <= radius) {
          isImpacted = true;
        }
      }
      
      // If impacted, add to the impacts list
      if (isImpacted) {
        facilityImpacts.push({
          disaster: disaster,
          distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
          impactMethod: impactMethod
        });
        
        // Track the impacting disaster for overlapping analysis
        impactingDisasters.push(disasterId);
        
        // Update the disaster stats
        if (disasterStats[disasterId]) {
          disasterStats[disasterId].affectedFacilities++;
        }
      }
    }
    
    // Check for overlapping disasters
    if (impactingDisasters.length > 1) {
      // Create a key for the combination of disasters
      for (let i = 0; i < impactingDisasters.length; i++) {
        for (let j = i + 1; j < impactingDisasters.length; j++) {
          const overlapKey = [impactingDisasters[i], impactingDisasters[j]].sort().join('__');
          
          if (!overlappingDisasters[overlapKey]) {
            overlappingDisasters[overlapKey] = {
              disasters: [impactingDisasters[i], impactingDisasters[j]],
              facilities: []
            };
          }
          
          overlappingDisasters[overlapKey].facilities.push(facility.name);
        }
      }
    }
    
    // If facility has impacts, add to the impacted list
    if (facilityImpacts.length > 0) {
      impacted.push({
        facility: facility,
        impacts: facilityImpacts
      });
    }
  }
  console.timeEnd('Process facilities');

  // Compile statistics
  console.time('Compile statistics');
  const statistics = {
    totalDisasters: disasters.length,
    totalFacilities: facilities.length,
    impactedFacilityCount: impacted.length,
    percentageImpacted: facilities.length ? Math.round((impacted.length / facilities.length) * 100) : 0,
    disasterStats: Object.values(disasterStats).filter(stat => stat.affectedFacilities > 0),
    overlappingImpacts: Object.values(overlappingDisasters)
  };
  console.timeEnd('Compile statistics');
  console.timeEnd('Impact assessment total');

  console.log(`Assessment complete: ${impacted.length} impacted facilities found`);

  return {
    impactedFacilities: impacted,
    statistics: statistics
  };
}

// Helper function to determine if a disaster has valid polygon data
function hasValidPolygon(disaster) {
  return disaster.polygon && 
         Array.isArray(disaster.polygon) && 
         disaster.polygon.length > 2;
}

// Helper function to convert GDACS polygon format to geolib format
function convertPolygonFormat(polygon) {
  return polygon.map(point => {
    if (Array.isArray(point)) {
      return { latitude: point[0], longitude: point[1] };
    }
    return point;
  });
}

// Calculate the impact area in square kilometers
function calculateImpactArea(disaster) {
  if (hasValidPolygon(disaster)) {
    try {
      const polygon = convertPolygonFormat(disaster.polygon);
      // Convert to square kilometers (getAreaOfPolygon returns square meters)
      return Math.round(getAreaOfPolygon(polygon) / 1000000);
    } catch (e) {
      console.error("Error calculating area:", e);
    }
  }
  
  // Use circular area as fallback
  const radius = getImpactRadius(disaster);
  return Math.round(Math.PI * radius * radius); // πr²
}

// Helper function to determine impact radius based on disaster type
function getImpactRadius(disaster) {
  let impactRadius = 0;

  // Handle ACLED security events with localized impact radius
  if (disaster.source === 'ACLED') {
    const eventType = disaster.eventType?.toLowerCase() || '';
    const fatalities = disaster.fatalities || 0;

    // Base radius for ACLED events (smaller than natural disasters)
    if (eventType.includes('battle') || eventType.includes('violence against civilians')) {
      impactRadius = 20; // km - battles and violence are localized
    } else if (eventType.includes('explosion')) {
      impactRadius = 30; // km - explosions have wider impact
    } else if (eventType.includes('strategic development') || eventType.includes('protest')) {
      impactRadius = 10; // km - protests/strategic developments very localized
    } else {
      impactRadius = 15; // km - default for other ACLED events
    }

    // Increase radius if high fatalities
    if (fatalities > 50) {
      impactRadius += 20; // Major incident with wider impact
    } else if (fatalities > 10) {
      impactRadius += 10; // Significant incident
    }

    return impactRadius;
  }

  // GDACS disasters (existing logic)
  if (disaster.eventType?.toLowerCase() === 'eq') {
    // Earthquake - try to extract magnitude
    let magnitude = 6.0; // Default magnitude
    const title = disaster.title?.toLowerCase() || '';
    if (title.includes('m=')) {
      try {
        const magMatch = title.match(/m=([0-9.]+)/);
        if (magMatch && magMatch[1]) {
          magnitude = parseFloat(magMatch[1]);
        }
      } catch (e) {
        // Use default if parsing fails
      }
    }

    // Adjust radius based on magnitude
    impactRadius = magnitude * 50; // km

  } else if (disaster.eventType?.toLowerCase() === 'tc') {
    // Tropical Cyclone
    impactRadius = 300; // km
  } else if (disaster.eventType?.toLowerCase() === 'fl') {
    // Flood
    impactRadius = 100; // km
  } else if (disaster.eventType?.toLowerCase() === 'vo') {
    // Volcanic activity
    impactRadius = 100; // km
  } else if (disaster.eventType?.toLowerCase() === 'dr') {
    // Drought
    impactRadius = 500; // km
  } else {
    // Default for other disaster types
    impactRadius = 100; // km
  }

  return impactRadius;
}
export default withRateLimit(handler);
