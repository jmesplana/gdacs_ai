// Sitrep generation with OpenAI
import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { impactedFacilities, disasters, dateFilter, statistics } = req.body;
    
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
        const situationOverview = createSituationOverview(impactedFacilities, disasters, statistics);
        
        console.log('Generating AI situation report using OpenAI...');
        
        // Generate AI sitrep
        const aiSitrep = await generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText, statistics);
        
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
    const situationOverview = createSituationOverview(impactedFacilities, disasters, statistics);
    
    // For demo purposes, generate a mock sitrep
    const sitrep = generateMockSitrep(impactedFacilities, disasters, situationOverview, dateFilter, statistics);
    
    res.status(200).json({ sitrep });
  } catch (error) {
    console.error('Error generating sitrep:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate situation report using OpenAI
async function generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText, statistics) {
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

NEW FEATURES TO HIGHLIGHT:
1. Enhanced polygon-based impact assessment (more accurate than simple radius checks)
2. Statistical analysis of affected areas (in square kilometers)
3. Identification of facilities impacted by multiple overlapping disasters

Your SitRep should include:
1. Executive Summary (2-3 sentences overview specifically about the data provided)
2. Current Situation (Brief description of active disasters from the filtered time period)
3. Statistical Analysis (Highlight the polygon-based calculations and overlapping impacts)
4. Impacts on Facilities (Summary of affected facilities based on current selection)
5. Recommended Actions (Prioritized by urgency, specific to these facilities and disasters)
6. Resource Requirements (If applicable)
7. Next Steps

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

function createSituationOverview(impactedFacilities, disasters, statistics) {
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
      'dr': 'Drought',
      'wf': 'Wildfire',
      'ts': 'Tsunami'
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
      const hasPolygon = disaster.polygon && Array.isArray(disaster.polygon) && disaster.polygon.length > 2;
      overview += `- ${title} (Alert Level: ${alertLevel})${hasPolygon ? ' [Has polygon data]' : ''}\n`;
    }
  }
  
  // Add statistics if available
  if (statistics) {
    overview += `\nIMPACT STATISTICS:\n`;
    
    // Add basic statistics
    overview += `- Total Disasters: ${statistics.totalDisasters}\n`;
    overview += `- Total Facilities: ${statistics.totalFacilities}\n`;
    overview += `- Impacted Facilities: ${statistics.impactedFacilityCount} (${statistics.percentageImpacted}%)\n`;
    
    // Add disaster statistics
    if (statistics.disasterStats && statistics.disasterStats.length > 0) {
      overview += `\nDISASTER IMPACT DETAILS:\n`;
      for (const disasterStat of statistics.disasterStats) {
        overview += `- ${disasterStat.name} (${disasterStat.type}): ${disasterStat.affectedFacilities} facilities impacted, ${disasterStat.impactArea} km² area, ${disasterStat.polygon ? 'using polygon data' : 'using radius'}\n`;
      }
    }
    
    // Add overlapping impacts if available
    if (statistics.overlappingImpacts && statistics.overlappingImpacts.length > 0) {
      overview += `\nOVERLAPPING DISASTER IMPACTS (${statistics.overlappingImpacts.length}):\n`;
      for (const overlap of statistics.overlappingImpacts) {
        overview += `- ${overlap.disasters[0]} + ${overlap.disasters[1]}: Impacts ${overlap.facilities.length} facilities\n`;
      }
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
      const impactMethod = disasterImpact.impactMethod || 'radius';
      
      const disasterTitle = disaster.title || 'Unnamed disaster';
      overview += `- Impacted by ${disasterTitle} (${distance} km away)${impactMethod === 'polygon' ? ' [Within impact polygon]' : ''}\n`;
    }
  }
  
  return overview;
}

// We'll modify the generateAISitrep function to always use AI
// and fall back to a direct prompt approach if the main API call fails
async function generateMockSitrep(impactedFacilities, disasters, situationOverview, dateFilter = '72h', statistics) {
  // Instead of generating a hard-coded mock report,
  // attempt to use the OpenAI API with a simplified prompt
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    
    // Get human-readable time period
    const dateFilterText = {
      '24h': 'last 24 hours',
      '48h': 'last 48 hours',
      '72h': 'last 72 hours',
      '7d': 'last 7 days',
      '30d': 'last 30 days',
      'all': 'all time'
    }[dateFilter] || 'recent time period';
    
    // Create a simpler prompt for the fallback
    const simplifiedPrompt = `
    Generate a concise disaster situation report (SitRep) based on this data:
    - Time period: ${dateFilterText}
    - Number of disasters: ${disasters.length}
    - Number of affected facilities: ${impactedFacilities.length}
    
    ${situationOverview}
    
    NEW FEATURES TO HIGHLIGHT:
    1. Enhanced polygon-based impact assessment (more accurate than simple radius checks)
    2. Statistical analysis of affected areas (in square kilometers)
    3. Identification of facilities impacted by multiple overlapping disasters
    
    Format as markdown with these sections:
    1. Executive Summary
    2. Current Situation
    3. Statistical Analysis (Highlight polygon impact areas and overlapping impacts)
    4. Impacts on Facilities 
    5. Recommended Actions
    6. Resource Requirements
    7. Next Steps
    
    The first line must be:
    # Situation Report: Disaster Impact Assessment
    ## Generated: ${date} | ${time} | Filter: ${dateFilterText}
    
    Keep it concise and actionable.
    `;
    
    // Call OpenAI with the simplified prompt
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a disaster management professional creating a formal Situation Report."},
        {role: "user", content: simplifiedPrompt}
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error using OpenAI API for fallback sitrep:", error);
    
    // Return minimal fallback if all else fails
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];
    
    // Get human-readable time period
    const dateFilterText = {
      '24h': 'last 24 hours',
      '48h': 'last 48 hours',
      '72h': 'last 72 hours',
      '7d': 'last 7 days',
      '30d': 'last 30 days',
      'all': 'all time'
    }[dateFilter] || 'recent time period';
    
    return `# Situation Report: Disaster Impact Assessment
## Generated: ${date} | ${time} | Filter: ${dateFilterText}

## Executive Summary
Monitoring ${disasters.length} active disaster events with ${impactedFacilities.length} facilities potentially impacted.

## Current Situation
Actively tracking multiple disaster events in the system.

## Impacts on Facilities
${impactedFacilities.length} facilities are potentially impacted by current disaster events.

## Recommended Actions
1. Assess all affected facilities
2. Implement emergency protocols
3. Monitor situation developments

## Resource Requirements
- Emergency response teams
- Communication equipment
- Emergency supplies

## Next Steps
1. Continue monitoring all active disaster events
2. Implement immediate safety measures
3. Update situation report as developments occur

---
*Generated by AI Disaster Impact and Response Tool*`;
  }
}

// Helper function to get disaster type name
function getDisasterTypeName(eventType) {
  const types = {
    'eq': 'Earthquake',
    'tc': 'Tropical Cyclone',
    'fl': 'Flood',
    'vo': 'Volcanic Activity',
    'dr': 'Drought',
    'wf': 'Wildfire',
    'ts': 'Tsunami'
  };
  
  return types[eventType?.toLowerCase()] || eventType;
}