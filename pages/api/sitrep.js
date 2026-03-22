import { withRateLimit } from '../../lib/rateLimit';
import { formatWorldPopForAI } from '../../utils/worldpopHelpers';
import { formatOSMForAI } from '../../lib/osmHelpers';
// Sitrep generation with OpenAI
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
      districts = [],
      includeWebSearch = true
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
    
    if (!openai) {
      return res.status(503).json({ error: 'AI sitrep generation unavailable. Please check your API key configuration.' });
    }

    const scope = buildSitrepScope(impactedFacilities, disasters, districts);

    // Generate situation overview
    const situationOverview = createSituationOverview(impactedFacilities, disasters, statistics, scope);

    let recentExternalContext = null;
    if (includeWebSearch) {
      try {
        recentExternalContext = await gatherRecentExternalContext(scope, disasters);
      } catch (searchError) {
        console.warn('SitRep web search unavailable:', searchError);
      }
    }

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
        districts,
        scope,
        recentExternalContext
      );
      console.log('Successfully generated AI sitrep');
      res.status(200).json({
        sitrep: aiSitrep,
        metadata: {
          scopedTo: scope.summary,
          externalContextIncluded: Boolean(recentExternalContext?.summary)
        }
      });
      return;
    } catch (aiError) {
      console.error('Error generating AI sitrep, trying simplified prompt:', aiError);
    }

    // Try fallback with simplified prompt
    try {
      const sitrep = await generateFallbackSitrep(impactedFacilities, disasters, situationOverview, dateFilter, scope, recentExternalContext);
      res.status(200).json({
        sitrep,
        metadata: {
          scopedTo: scope.summary,
          externalContextIncluded: Boolean(recentExternalContext?.summary)
        }
      });
      return;
    } catch (_) {}

    res.status(503).json({ error: 'AI sitrep generation unavailable. Please check your API key configuration.' });
  } catch (error) {
    console.error('Error generating sitrep:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate situation report using OpenAI
async function generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText, statistics, acledData = [], osmData = null, worldPopData = {}, worldPopYear = null, districts = [], scope = {}, recentExternalContext = null) {
  try {
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

    if (recentExternalContext?.summary) {
      enhancedContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      enhancedContext += 'RECENT EXTERNAL CONTEXT (WEB SEARCH)\n';
      enhancedContext += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      enhancedContext += `${recentExternalContext.summary}\n`;
      enhancedContext += '\n**NOTE**: Treat this as supporting current context for the scoped operational area only. Do not let unrelated global news dominate the report.\n';
    }

    // Create prompt for GPT
    const prompt = `
You are a disaster management professional tasked with creating a concise Situation Report (SitRep).
Based on the information below, create a formal SitRep that would be suitable for sharing with
organizational leadership, emergency response teams, and other stakeholders.

WORKSPACE SCOPE:
- Scope summary: ${scope.summary || 'Current operational workspace'}
- Scope type: ${scope.scopeType || 'workspace'}
- Countries: ${scope.countries?.join(', ') || 'Unknown'}
- Regions/Admin units: ${scope.regions?.slice(0, 8).join(', ') || 'Not specified'}
- District count: ${scope.districtCount || 0}
- Facilities assessed: ${scope.facilityCount || 0}
- Impacted facilities: ${scope.impactedFacilityCount || 0}

SITUATION OVERVIEW (scoped disasters from the ${dateFilterText}):
${enhancedContext}

IMPORTANT SCOPING RULES:
- This report must ONLY describe the current operational workspace, not the global GDACS feed.
- ONLY include disasters, facilities, districts, and ACLED events from the current filtered selection (${dateFilterText}) and scoped area above.
- Do not reference unrelated disasters in other countries or regions.
- The primary narrative is operational impact on the user's facilities and covered geography.
- If web search context is included, use it only to supplement and update the scoped picture. Do not let it broaden the report into a global bulletin.

Your SitRep should include:
1. Scope
2. Executive Summary
3. Priority Areas
4. Facility Impact Summary
5. Threat Overview
6. Population and Access Context
7. Operational Implications
8. Immediate Actions
9. Data Confidence and Gaps

Format your response in markdown for readability. The first line of your report MUST be:
# Situation Report: Scoped Operational Assessment
## Generated: ${date} | ${time} | Filter: ${dateFilterText}

Keep the entire SitRep concise and actionable.
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "You are a disaster management professional creating a formal, scoped situation report for an operational workspace."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return response.output_text.trim();
  } catch (error) {
    console.error("Error using OpenAI API:", error);
    throw error;
  }
}

function createSituationOverview(impactedFacilities, disasters, statistics, scope = {}) {
  let overview = `WORKSPACE SCOPE:\n`;
  overview += `- ${scope.summary || 'Current operational workspace'}\n`;
  overview += `- Facilities assessed: ${scope.facilityCount || 0}\n`;
  overview += `- Impacted facilities: ${scope.impactedFacilityCount || 0}\n`;
  overview += `- Districts loaded: ${scope.districtCount || 0}\n`;
  overview += `- Countries in scope: ${scope.countries?.join(', ') || 'Unknown'}\n`;
  overview += `\nACTIVE DISASTERS IN SCOPE (${disasters.length}):\n`;
  
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
async function generateFallbackSitrep(impactedFacilities, disasters, situationOverview, dateFilter = '72h', scope = {}, recentExternalContext = null) {
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
  Generate a concise scoped disaster situation report (SitRep) based on this workspace:
  - Scope: ${scope.summary || 'Current operational workspace'}
  - Time period: ${dateFilterText}
  - Number of disasters: ${disasters.length}
  - Number of affected facilities: ${impactedFacilities.length}

  ${situationOverview}

  ${recentExternalContext?.summary ? `Recent external context:\n${recentExternalContext.summary}\n` : ''}

  Format as markdown with these sections:
  1. Scope
  2. Executive Summary
  3. Priority Areas
  4. Facility Impact Summary
  5. Threat Overview
  6. Operational Implications
  7. Immediate Actions
  8. Data Confidence and Gaps

  The first line must be:
  # Situation Report: Scoped Operational Assessment
  ## Generated: ${date} | ${time} | Filter: ${dateFilterText}

  Keep it concise and actionable. Do not describe unrelated global disasters.
  `;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: "You are a disaster management professional creating a formal, scoped situation report." },
      { role: "user", content: simplifiedPrompt }
    ]
  });

  return response.output_text.trim();
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

function extractLocationFromDistrict(district) {
  const props = district?.properties || district || {};
  const countryFields = ['NAME_0', 'ADM0_EN', 'COUNTRY', 'Country', 'country', 'admin0Name', 'ADM0_NAME', 'ADMIN0', 'name_0'];
  const regionFields = ['NAME_1', 'ADM1_EN', 'REGION', 'Region', 'region', 'admin1Name', 'ADM1_NAME', 'ADMIN1', 'name_1'];
  const districtFields = ['NAME_2', 'ADM2_EN', 'DISTRICT', 'District', 'district', 'admin2Name', 'ADM2_NAME', 'ADMIN2', 'name_2', 'NAME'];

  const country = countryFields.map((field) => props[field]).find(Boolean) || null;
  const region = regionFields.map((field) => props[field]).find(Boolean) || null;
  const districtName = districtFields.map((field) => props[field]).find(Boolean) || null;

  return { country, region, districtName };
}

function buildSitrepScope(impactedFacilities = [], disasters = [], districts = []) {
  const countrySet = new Set();
  const regionSet = new Set();
  const districtSet = new Set();

  districts.forEach((district) => {
    const location = extractLocationFromDistrict(district);
    if (location.country) countrySet.add(location.country);
    if (location.region) regionSet.add(location.region);
    if (location.districtName) districtSet.add(location.districtName);
  });

  impactedFacilities.forEach(({ facility }) => {
    if (facility?.country) countrySet.add(facility.country);
    if (facility?.region) regionSet.add(facility.region);
    if (facility?.district) districtSet.add(facility.district);
  });

  const countries = Array.from(countrySet);
  const regions = Array.from(regionSet);
  const districtNames = Array.from(districtSet);
  const scopeType = districtNames.length > 0 ? 'district' : countries.length > 0 ? 'country' : 'facility';

  let summary = 'Facility-centered operational workspace';
  if (districtNames.length > 0) {
    summary = `${districtNames.length} district(s) in ${countries.join(', ') || 'the selected area'}`;
  } else if (regions.length > 0 || countries.length > 0) {
    summary = `${regions.slice(0, 3).join(', ') || countries.join(', ')} operational workspace`;
  } else if (impactedFacilities.length > 0) {
    summary = `${impactedFacilities.length} impacted facility location(s)`;
  }

  const threatTypes = Array.from(new Set(
    disasters
      .map((disaster) => getDisasterTypeName(disaster.eventType || disaster.eventName || ''))
      .filter(Boolean)
  ));

  return {
    scopeType,
    summary,
    countries,
    regions,
    districtNames,
    districtCount: districts.length,
    facilityCount: impactedFacilities.length,
    impactedFacilityCount: impactedFacilities.length,
    threatTypes
  };
}

async function gatherRecentExternalContext(scope, disasters = []) {
  if (!openai) return null;

  const year = new Date().getFullYear();
  const placeTerms = [
    scope.districtNames?.slice(0, 2).join(' '),
    scope.regions?.slice(0, 2).join(' '),
    scope.countries?.slice(0, 2).join(' ')
  ].filter(Boolean);
  const threatTerms = scope.threatTypes?.slice(0, 3).join(' ') || 'disaster humanitarian';
  const query = `${placeTerms.join(' ')} ${threatTerms} humanitarian updates ${year}`.trim();

  if (!query) return null;

  const response = await openai.responses.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4.1-mini',
    tools: [{ type: 'web_search' }],
    input: `Find up-to-date, recent humanitarian context relevant to this operational scope only: ${query}.

Return a concise markdown summary with:
- 3 to 5 bullets maximum
- Only recent information relevant to the scoped area
- No generic global background
- Include short source attributions inline when possible`
  });

  return {
    query,
    summary: response.output_text?.trim() || null
  };
}
export default withRateLimit(handler);
