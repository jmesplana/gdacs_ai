import { withRateLimit } from '../../lib/rateLimit';
import { formatWorldPopForAI } from '../../utils/worldpopHelpers';
import { formatOSMForAI } from '../../lib/osmHelpers';
// Sitrep generation with OpenAI
import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      impactedFacilities,
      disasters,
      dateFilter,
      statistics,
      acledData = [],
      osmData = null,
      worldPopData = {},
      worldPopYear = null,
      districts = []
    } = req.body;

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
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI sitrep generation unavailable. Please check your API key configuration.' });
    }

    // Generate situation overview
    const situationOverview = createSituationOverview(impactedFacilities, disasters, statistics);

    // Try primary AI sitrep
    try {
      console.log('Generating AI situation report using OpenAI...');
      const aiSitrep = await generateAISitrep(
        impactedFacilities,
        disasters,
        situationOverview,
        dateFilterText,
        statistics,
        acledData,
        osmData,
        worldPopData,
        worldPopYear,
        districts
      );
      console.log('Successfully generated AI sitrep');
      res.status(200).json({ sitrep: aiSitrep });
      return;
    } catch (aiError) {
      console.error('Error generating AI sitrep, trying simplified prompt:', aiError);
    }

    // Try fallback with simplified prompt
    try {
      const sitrep = await generateFallbackSitrep(impactedFacilities, disasters, situationOverview, dateFilter);
      res.status(200).json({ sitrep });
      return;
    } catch (_) {}

    res.status(503).json({ error: 'AI sitrep generation unavailable. Please check your API key configuration.' });
  } catch (error) {
    console.error('Error generating sitrep:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate situation report using OpenAI
async function generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText, statistics, acledData = [], osmData = null, worldPopData = {}, worldPopYear = null, districts = []) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Get current date and time
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];

    // Build enhanced context
    let enhancedContext = situationOverview;

    // Add ACLED security context
    if (acledData && acledData.length > 0) {
      enhancedContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      enhancedContext += `SECURITY CONTEXT - ACLED CONFLICT DATA (${acledData.length} events)\n`;
      enhancedContext += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      // Group by event type
      const byType = acledData.reduce((acc, event) => {
        const type = event.event_type || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      enhancedContext += 'Security incidents by type:\n';
      Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          enhancedContext += `- ${type}: ${count} events\n`;
        });

      // Most recent events
      const recentEvents = acledData
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
        .slice(0, 5);

      enhancedContext += '\nRecent security incidents:\n';
      recentEvents.forEach(event => {
        enhancedContext += `- ${event.event_date}: ${event.event_type} in ${event.admin2 || event.admin1 || event.country}\n`;
        if (event.notes) enhancedContext += `  Note: ${event.notes.substring(0, 100)}...\n`;
      });
    }

    // Add OSM infrastructure context
    if (osmData && osmData.features && osmData.features.length > 0) {
      enhancedContext += '\n\n' + formatOSMForAI(osmData, disasters);
      enhancedContext += '\n**NOTE**: Use this infrastructure data to assess operational capacity and identify critical infrastructure at risk.\n';
    }

    // Add WorldPop population context
    if (worldPopData && Object.keys(worldPopData).length > 0) {
      enhancedContext += '\n\n' + formatWorldPopForAI(worldPopData, districts, worldPopYear || 'unknown');
      enhancedContext += '\n**NOTE**: Use this population data to estimate affected populations and prioritize response.\n';
    }

    // Create prompt for GPT
    const prompt = `
You are a disaster management professional tasked with creating a concise Situation Report (SitRep).
Based on the information below, create a formal SitRep that would be suitable for sharing with
organizational leadership, emergency response teams, and other stakeholders.

SITUATION OVERVIEW (disasters from the ${dateFilterText}):
${enhancedContext}

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

// Simplified fallback sitrep prompt
async function generateFallbackSitrep(impactedFacilities, disasters, situationOverview, dateFilter = '72h') {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toTimeString().split(' ')[0];

  const dateFilterText = {
    '24h': 'last 24 hours',
    '48h': 'last 48 hours',
    '72h': 'last 72 hours',
    '7d': 'last 7 days',
    '30d': 'last 30 days',
    'all': 'all time'
  }[dateFilter] || 'recent time period';

  const simplifiedPrompt = `
  Generate a concise disaster situation report (SitRep) based on this data:
  - Time period: ${dateFilterText}
  - Number of disasters: ${disasters.length}
  - Number of affected facilities: ${impactedFacilities.length}

  ${situationOverview}

  Format as markdown with these sections:
  1. Executive Summary
  2. Current Situation
  3. Statistical Analysis
  4. Impacts on Facilities
  5. Recommended Actions
  6. Resource Requirements
  7. Next Steps

  The first line must be:
  # Situation Report: Disaster Impact Assessment
  ## Generated: ${date} | ${time} | Filter: ${dateFilterText}

  Keep it concise and actionable.
  `;

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
export default withRateLimit(handler);
