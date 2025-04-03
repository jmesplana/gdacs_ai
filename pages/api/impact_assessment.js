import Papa from 'papaparse';
import { getDistance, isPointInPolygon, getAreaOfPolygon } from 'geolib';

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
      
      facilityData = parsedCsv.data.map(row => ({
        name: row.name,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude)
      }));
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
  const impacted = [];
  const disasterStats = {};
  const overlappingDisasters = {};
  
  // Pre-process disasters to collect statistics
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
  
  // Process each facility
  for (const facility of facilities) {
    const facilityPos = {
      latitude: facility.latitude,
      longitude: facility.longitude
    };
    
    const facilityImpacts = [];
    const impactingDisasters = [];
    
    for (const disaster of disasters) {
      if (!disaster.latitude || !disaster.longitude) {
        continue;
      }
      
      const disasterId = disaster.eventName || disaster.title || `${disaster.eventType}-${disaster.latitude}-${disaster.longitude}`;
      const disasterPos = {
        latitude: disaster.latitude,
        longitude: disaster.longitude
      };
      
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
        // Determine impact radius based on disaster type
        let impactRadius = getImpactRadius(disaster);
        
        // Check if facility is within impact radius
        if (distance <= impactRadius) {
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
  
  // Compile statistics
  const statistics = {
    totalDisasters: disasters.length,
    totalFacilities: facilities.length,
    impactedFacilityCount: impacted.length,
    percentageImpacted: facilities.length ? Math.round((impacted.length / facilities.length) * 100) : 0,
    disasterStats: Object.values(disasterStats).filter(stat => stat.affectedFacilities > 0),
    overlappingImpacts: Object.values(overlappingDisasters)
  };
  
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