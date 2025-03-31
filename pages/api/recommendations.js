// Mock recommendations since we can't directly call OpenAI in client-side code
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facility, impacts } = req.body;
    
    if (!facility || !impacts || impacts.length === 0) {
      return res.status(400).json({ error: 'Missing facility or impacts data' });
    }
    
    // Generate situation summary
    const situationSummary = createSituationSummary(facility, impacts);
    
    // For demo purposes, generate mock recommendations based on disaster types
    const recommendations = generateMockRecommendations(facility, impacts);
    
    res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: error.message });
  }
}

function createSituationSummary(facility, impacts) {
  const facilityName = facility.name || 'Unnamed facility';
  const facilityLocation = `${facility.latitude}, ${facility.longitude}`;
  
  let summary = `Facility '${facilityName}' at coordinates ${facilityLocation} is potentially impacted by the following disasters:\n\n`;
  
  for (const impact of impacts) {
    const disaster = impact.disaster || {};
    const distance = impact.distance || 'unknown';
    
    const disasterType = disaster.eventType || 'unknown';
    const disasterName = disaster.eventName || disaster.title || 'Unnamed disaster';
    const alertLevel = disaster.alertLevel || 'unknown';
    
    // Map disaster type codes to human-readable names
    const disasterTypeNames = {
      'eq': 'Earthquake',
      'tc': 'Tropical Cyclone',
      'fl': 'Flood',
      'vo': 'Volcanic Activity',
      'dr': 'Drought'
    };
    
    const disasterTypeName = disasterTypeNames[disasterType.toLowerCase()] || disasterType;
    
    summary += `- ${disasterTypeName}: ${disasterName}, Alert Level: ${alertLevel}\n`;
    summary += `  Distance: ${distance} km from facility\n`;
    summary += `  Details: ${disaster.description || 'No details available'}\n\n`;
  }
  
  return summary;
}

function generateMockRecommendations(facility, impacts) {
  // Create recommendations based on disaster types
  const recommendations = {
    "Immediate Safety Measures": [],
    "Resource Mobilization": [],
    "Evacuation Considerations": [],
    "Communication Protocols": [],
    "Medium-term Mitigation Strategies": []
  };
  
  // Check what types of disasters are impacting the facility
  const disasterTypes = impacts.map(impact => impact.disaster.eventType?.toLowerCase() || '');
  
  // Add recommendations based on disaster types
  if (disasterTypes.includes('eq')) {
    // Earthquake recommendations
    recommendations["Immediate Safety Measures"].push("Conduct structural assessment of all buildings");
    recommendations["Immediate Safety Measures"].push("Check for gas leaks and shut off utilities if necessary");
    recommendations["Resource Mobilization"].push("Deploy search and rescue teams with specialized equipment");
    recommendations["Evacuation Considerations"].push("Identify and prepare open areas as temporary assembly points");
    recommendations["Communication Protocols"].push("Establish emergency communication channel for staff updates");
    recommendations["Medium-term Mitigation Strategies"].push("Retrofit vulnerable structures against seismic activity");
  }
  
  if (disasterTypes.includes('tc')) {
    // Tropical Cyclone recommendations
    recommendations["Immediate Safety Measures"].push("Secure all loose objects and equipment outside facilities");
    recommendations["Immediate Safety Measures"].push("Move critical assets to higher floors if flooding is possible");
    recommendations["Resource Mobilization"].push("Prepare emergency power generators and fuel supplies");
    recommendations["Evacuation Considerations"].push("Plan evacuation routes away from flood-prone areas");
    recommendations["Communication Protocols"].push("Establish regular situation updates for all staff");
    recommendations["Medium-term Mitigation Strategies"].push("Review and enhance flood defenses around facility");
  }
  
  if (disasterTypes.includes('fl')) {
    // Flood recommendations
    recommendations["Immediate Safety Measures"].push("Move valuable equipment and materials to higher ground");
    recommendations["Immediate Safety Measures"].push("Deploy sandbags or flood barriers if available");
    recommendations["Resource Mobilization"].push("Secure clean water supplies and water purification equipment");
    recommendations["Evacuation Considerations"].push("Identify evacuation routes that avoid low-lying areas");
    recommendations["Communication Protocols"].push("Monitor local weather and flood warnings hourly");
    recommendations["Medium-term Mitigation Strategies"].push("Develop improved drainage systems for facility grounds");
  }
  
  if (disasterTypes.includes('vo')) {
    // Volcanic activity recommendations
    recommendations["Immediate Safety Measures"].push("Distribute respiratory protection for staff (N95 masks)");
    recommendations["Immediate Safety Measures"].push("Close external air intakes to buildings");
    recommendations["Resource Mobilization"].push("Secure additional respiratory protection equipment");
    recommendations["Evacuation Considerations"].push("Prepare for possible rapid evacuation if eruption intensifies");
    recommendations["Communication Protocols"].push("Establish communication with local volcanological authorities");
    recommendations["Medium-term Mitigation Strategies"].push("Install air filtration systems in critical facilities");
  }
  
  if (disasterTypes.includes('dr')) {
    // Drought recommendations
    recommendations["Immediate Safety Measures"].push("Implement water conservation measures immediately");
    recommendations["Resource Mobilization"].push("Secure additional water supplies and storage capacity");
    recommendations["Communication Protocols"].push("Brief staff on water usage protocols");
    recommendations["Medium-term Mitigation Strategies"].push("Develop rainwater harvesting systems for facilities");
  }
  
  // General recommendations for any disaster
  if (recommendations["Immediate Safety Measures"].length === 0) {
    recommendations["Immediate Safety Measures"].push("Conduct a comprehensive facility safety assessment");
    recommendations["Resource Mobilization"].push("Prepare emergency supplies kit with food, water, and medical supplies");
    recommendations["Communication Protocols"].push("Establish emergency communication protocols for all staff");
  }
  
  return recommendations;
}