import Papa from 'papaparse';
import { getDistance } from 'geolib';

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
    const impactedFacilities = assessImpact(facilityData, disasters);
    
    res.status(200).json({ impactedFacilities });
  } catch (error) {
    console.error('Error assessing impact:', error);
    res.status(500).json({ error: error.message });
  }
}

function assessImpact(facilities, disasters) {
  const impacted = [];
  
  for (const facility of facilities) {
    const facilityPos = {
      latitude: facility.latitude,
      longitude: facility.longitude
    };
    
    const facilityImpacts = [];
    
    for (const disaster of disasters) {
      if (!disaster.latitude || !disaster.longitude) {
        continue;
      }
      
      const disasterPos = {
        latitude: disaster.latitude,
        longitude: disaster.longitude
      };
      
      // Calculate distance in kilometers
      const distance = getDistance(facilityPos, disasterPos) / 1000;
      
      // Determine impact radius based on disaster type
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
      
      // Check if facility is within impact radius
      if (distance <= impactRadius) {
        facilityImpacts.push({
          disaster: disaster,
          distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
        });
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
  
  return impacted;
}