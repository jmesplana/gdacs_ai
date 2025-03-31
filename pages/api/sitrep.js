// Sitrep generation with OpenAI
import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { impactedFacilities, disasters, dateFilter } = req.body;
    
    if (!impactedFacilities || !disasters) {
      return res.status(400).json({ error: 'Missing impacted facilities or disasters data' });
    }
    
    // Get human-readable time period
    const dateFilterText = {
      '24h': 'last 24 hours',
      '48h': 'last 48 hours',
      '72h': 'last 72 hours',
      '7d': 'last 7 days',
      '30d': 'last 30 days',
      'all': 'all time'
    }[dateFilter] || 'recent time period';
    
    // Log API key status without revealing the key
    console.log(`API Key status: ${process.env.OPENAI_API_KEY ? 'Available' : 'Not available'}`);
    
    // Try to generate with AI if API key exists
    if (process.env.OPENAI_API_KEY) {
      try {
        // Generate situation overview
        const situationOverview = createSituationOverview(impactedFacilities, disasters);
        
        console.log('Generating AI situation report using OpenAI...');
        
        // Generate AI sitrep
        const aiSitrep = await generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText);
        
        console.log('Successfully generated AI sitrep');
        res.status(200).json({ sitrep: aiSitrep });
        return;
      } catch (aiError) {
        console.error('Error generating AI sitrep, falling back to mock:', aiError);
        // Fall back to mock sitrep if AI fails
      }
    } else {
      console.log('No OpenAI API key found, using mock data instead');
    }
    
    // Generate situation overview
    const situationOverview = createSituationOverview(impactedFacilities, disasters);
    
    // For demo purposes, generate a mock sitrep
    const sitrep = generateMockSitrep(impactedFacilities, disasters, situationOverview, dateFilter);
    
    res.status(200).json({ sitrep });
  } catch (error) {
    console.error('Error generating sitrep:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate situation report using OpenAI
async function generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get current date and time
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    
    // Create prompt for GPT
    const prompt = `
You are a disaster management professional tasked with creating a concise Situation Report (SitRep).
Based on the information below, create a formal SitRep that would be suitable for sharing with 
organizational leadership, emergency response teams, and other stakeholders.

SITUATION OVERVIEW (disasters from the ${dateFilterText}):
${situationOverview}

IMPORTANT: This report must ONLY include disasters and impacted facilities from the current filtered selection 
(${dateFilterText}). Do not reference any facilities or disasters not included in the data above.

Your SitRep should include:
1. Executive Summary (2-3 sentences overview specifically about the data provided)
2. Current Situation (Brief description of active disasters from the filtered time period)
3. Impacts on Facilities (Summary of affected facilities based on current selection)
4. Recommended Actions (Prioritized by urgency, specific to these facilities and disasters)
5. Resource Requirements (If applicable)
6. Next Steps

Format your response in markdown for readability. The first line of your report MUST be:
# Situation Report: Disaster Impact Assessment
## Generated: ${date} | ${time} | Filter: ${dateFilterText}

Keep the entire SitRep concise and actionable.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a disaster management professional creating a formal Situation Report."},
        {role: "user", content: prompt}
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error using OpenAI API:", error);
    throw error;
  }
}

function createSituationOverview(impactedFacilities, disasters) {
  let overview = `ACTIVE DISASTERS (${disasters.length}):\n`;
  
  // Group disasters by type
  const disasterTypes = {};
  for (const disaster of disasters) {
    const disasterType = disaster.eventType?.toLowerCase() || 'unknown';
    
    // Map disaster type codes to human-readable names
    const disasterTypeNames = {
      'eq': 'Earthquake',
      'tc': 'Tropical Cyclone',
      'fl': 'Flood',
      'vo': 'Volcanic Activity',
      'dr': 'Drought'
    };
    
    const disasterTypeName = disasterTypeNames[disasterType] || disasterType;
    
    if (!disasterTypes[disasterTypeName]) {
      disasterTypes[disasterTypeName] = [];
    }
    
    disasterTypes[disasterTypeName].push(disaster);
  }
  
  // Add disaster summaries by type
  for (const [disasterType, typeDisasters] of Object.entries(disasterTypes)) {
    overview += `\n${disasterType} Events (${typeDisasters.length}):\n`;
    
    for (const disaster of typeDisasters) {
      const title = disaster.title || 'Unnamed disaster';
      const alertLevel = disaster.alertLevel || 'unknown';
      overview += `- ${title} (Alert Level: ${alertLevel})\n`;
    }
  }
  
  // Add impacted facilities summary
  overview += `\nIMPACTED FACILITIES (${impactedFacilities.length}):\n`;
  
  for (const impact of impactedFacilities) {
    const facility = impact.facility || {};
    const facilityImpacts = impact.impacts || [];
    
    const facilityName = facility.name || 'Unnamed facility';
    overview += `\n${facilityName}:\n`;
    
    for (const disasterImpact of facilityImpacts) {
      const disaster = disasterImpact.disaster || {};
      const distance = disasterImpact.distance || 'unknown';
      
      const disasterTitle = disaster.title || 'Unnamed disaster';
      overview += `- Impacted by ${disasterTitle} (${distance} km away)\n`;
    }
  }
  
  return overview;
}

function generateMockSitrep(impactedFacilities, disasters, situationOverview, dateFilter = '72h') {
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0];
  
  // Count disaster types
  const disasterTypes = disasters.reduce((acc, disaster) => {
    const type = disaster.eventType?.toLowerCase() || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  
  // Get human-readable time period
  const dateFilterText = {
    '24h': 'last 24 hours',
    '48h': 'last 48 hours',
    '72h': 'last 72 hours',
    '7d': 'last 7 days',
    '30d': 'last 30 days',
    'all': 'all time'
  }[dateFilter] || 'recent time period';
  
  // Map disaster type codes to human-readable names
  const disasterTypeNames = {
    'eq': 'Earthquake',
    'tc': 'Tropical Cyclone',
    'fl': 'Flood',
    'vo': 'Volcanic Activity',
    'dr': 'Drought'
  };
  
  // Create a text listing of the disaster types
  const disasterTypeSummary = Object.entries(disasterTypes)
    .map(([type, count]) => `${count} ${disasterTypeNames[type] || type}${count > 1 ? 's' : ''}`)
    .join(', ');
  
  // Generate the sitrep
  return `# Situation Report: Disaster Impact Assessment
## Generated: ${date} | ${time} | Filter: ${dateFilterText}

## Executive Summary
Currently monitoring ${disasters.length} active disaster events from the ${dateFilterText} (${disasterTypeSummary}) with ${impactedFacilities.length} facilities potentially impacted. Immediate response actions recommended for high-risk facilities based on threat assessment.

## Current Situation
${Object.entries(disasterTypes).map(([type, count]) => {
  const typeName = disasterTypeNames[type] || type;
  const relevantDisasters = disasters.filter(d => d.eventType?.toLowerCase() === type);
  const highestAlert = relevantDisasters.sort((a, b) => {
    const alertOrder = { 'red': 3, 'orange': 2, 'green': 1 };
    return (alertOrder[b.alertLevel?.toLowerCase()] || 0) - (alertOrder[a.alertLevel?.toLowerCase()] || 0);
  })[0];
  
  return `### ${typeName} Events (${count})
${highestAlert ? `Highest alert: ${highestAlert.title} (Alert Level: ${highestAlert.alertLevel})` : ''}
${relevantDisasters.map(d => `- ${d.title || 'Unnamed event'}`).join('\n')}`;
}).join('\n\n')}

## Impacts on Facilities
${impactedFacilities.map(impact => {
  const facility = impact.facility;
  const facilityImpacts = impact.impacts;
  
  return `### ${facility.name}
Location: ${facility.latitude}, ${facility.longitude}
Impacted by: ${facilityImpacts.map(i => i.disaster.eventType).join(', ')}
${facilityImpacts.map(i => `- ${getDisasterTypeName(i.disaster.eventType)}: ${i.disaster.title} (${i.distance} km away)`).join('\n')}`;
}).join('\n\n')}

## Recommended Actions
${generatePrioritizedActions(impactedFacilities)}

## Resource Requirements
- Emergency response teams for ${impactedFacilities.length} affected facilities
- Communication equipment for real-time updates
- Specialized equipment based on disaster types (${Object.keys(disasterTypes).map(t => getDisasterTypeName(t)).join(', ')})
- Transportation for potential evacuations
- Emergency supplies including water, food, and medical kits

## Next Steps
1. Continue monitoring all active disaster events
2. Implement immediate safety measures at impacted facilities
3. Establish communication protocols with all facility managers
4. Prepare for potential evacuations if situation deteriorates
5. Update situation report in 24 hours or as significant developments occur

---
*Generated by AI Disaster Impact and Response Tool*`;
}

// Helper function to get disaster type name
function getDisasterTypeName(eventType) {
  const types = {
    'eq': 'Earthquake',
    'tc': 'Tropical Cyclone',
    'fl': 'Flood',
    'vo': 'Volcanic Activity',
    'dr': 'Drought'
  };
  
  return types[eventType?.toLowerCase()] || eventType;
}

// Generate prioritized actions based on impacted facilities
function generatePrioritizedActions(impactedFacilities) {
  // Identify most severe disaster types across all facilities
  const disasterTypeCounts = {};
  
  for (const impact of impactedFacilities) {
    for (const disasterImpact of impact.impacts) {
      const type = disasterImpact.disaster.eventType?.toLowerCase();
      disasterTypeCounts[type] = (disasterTypeCounts[type] || 0) + 1;
    }
  }
  
  // Generate actions based on most common disaster types
  const actions = [];
  
  if (disasterTypeCounts['eq']) {
    actions.push("1. **Structural Assessment**: Immediately inspect all buildings at affected facilities for structural damage");
    actions.push("2. **Utility Safety**: Check for gas leaks and electrical hazards at all earthquake-affected sites");
  }
  
  if (disasterTypeCounts['tc']) {
    actions.push("3. **Secure Facilities**: Reinforce and secure vulnerable structures against high winds and flooding");
    actions.push("4. **Power Backup**: Ensure backup power systems are operational at cyclone-affected locations");
  }
  
  if (disasterTypeCounts['fl']) {
    actions.push("5. **Flood Protection**: Deploy flood barriers and move critical equipment to higher elevations");
    actions.push("6. **Water Testing**: Implement water quality testing protocols for flood-affected facilities");
  }
  
  if (disasterTypeCounts['vo']) {
    actions.push("7. **Air Quality**: Distribute respiratory protection equipment and monitor air quality");
    actions.push("8. **Evacuation Readiness**: Prepare evacuation routes and transportation for volcanic-affected areas");
  }
  
  if (disasterTypeCounts['dr']) {
    actions.push("9. **Water Conservation**: Implement strict water conservation measures at drought-affected facilities");
    actions.push("10. **Supply Chain**: Assess impact on water-dependent operations and implement contingency plans");
  }
  
  // Add general actions if specific ones are limited
  if (actions.length < 5) {
    actions.push("11. **Communication**: Establish emergency communication protocols with all affected facilities");
    actions.push("12. **Staff Safety**: Account for all personnel and implement safety briefings");
    actions.push("13. **Resource Allocation**: Prioritize resource distribution based on facility risk levels");
  }
  
  return actions.join("\n");
}