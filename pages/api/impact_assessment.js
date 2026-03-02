import Papa from 'papaparse';
import { getDistance, isPointInPolygon, getAreaOfPolygon } from 'geolib';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase from default 1mb to handle large datasets
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facilities, disasters } = req.body;
    
    if (!facilities || !disasters) {
      return res.status(400).json({ error: 'Missing facilities or disasters data' });
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
    
    // Assess impact
    const assessmentResult = assessImpact(facilityData, disasters);
    
    res.status(200).json({
      impactedFacilities: assessmentResult.impactedFacilities,
      statistics: assessmentResult.statistics
    });
  } catch (error) {
    console.error('Error assessing impact:', error);
    res.status(500).json({ error: error.message });
  }
}

function assessImpact(facilities, disasters) {
  console.time('Impact assessment total');
  const impacted = [];
  const disasterStats = {};
  const overlappingDisasters = {};

  console.log(`Starting assessment: ${facilities.length} facilities vs ${disasters.length} disasters`);

  // Pre-process disasters to collect statistics
  console.time('Pre-process disasters');
  for (const disaster of disasters) {
    if (!disaster.latitude || !disaster.longitude) continue;

    const disasterId = disaster.eventName || disaster.title || `${disaster.eventType}-${disaster.latitude}-${disaster.longitude}`;
    disasterStats[disasterId] = {
      type: disaster.eventType,
      alertLevel: disaster.alertLevel || 'Unknown',
      name: disaster.eventName || disaster.title || 'Unnamed',
      affectedFacilities: 0,
      impactArea: calculateImpactArea(disaster),
      severity: disaster.severity || disaster.alertLevel || 'Unknown',
      polygon: hasValidPolygon(disaster)
    };
  }
  console.timeEnd('Pre-process disasters');

  // Process each facility
  console.time('Process facilities');

  // Pre-calculate impact radii and bounding boxes for disasters (optimization)
  const disasterData = disasters.map(disaster => {
    if (!disaster.latitude || !disaster.longitude) return null;

    const impactRadius = getImpactRadius(disaster);
    return {
      disaster,
      lat: parseFloat(disaster.latitude),
      lng: parseFloat(disaster.longitude),
      radius: impactRadius,
      // Bounding box for quick rejection (approximate degrees per km at equator)
      minLat: parseFloat(disaster.latitude) - (impactRadius / 111),
      maxLat: parseFloat(disaster.latitude) + (impactRadius / 111),
      minLng: parseFloat(disaster.longitude) - (impactRadius / (111 * Math.cos(disaster.latitude * Math.PI / 180))),
      maxLng: parseFloat(disaster.longitude) + (impactRadius / (111 * Math.cos(disaster.latitude * Math.PI / 180))),
      disasterId: disaster.eventName || disaster.title || `${disaster.eventType}-${disaster.latitude}-${disaster.longitude}`
    };
  }).filter(d => d !== null);

  for (const facility of facilities) {
    const facilityLat = parseFloat(facility.latitude);
    const facilityLng = parseFloat(facility.longitude);
    const facilityPos = { latitude: facilityLat, longitude: facilityLng };

    const facilityImpacts = [];
    const impactingDisasters = [];

    for (const disasterInfo of disasterData) {
      const { disaster, lat, lng, radius, minLat, maxLat, minLng, maxLng, disasterId } = disasterInfo;

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