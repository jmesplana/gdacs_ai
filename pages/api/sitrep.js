import { withRateLimit } from '../../lib/rateLimit';
import { formatWorldPopForAI } from '../../utils/worldpopHelpers';
import { formatOSMForAI } from '../../lib/osmHelpers';
// Sitrep generation with OpenAI
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

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
      uploadedDataSchema = null,
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
        uploadedDataSchema,
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
async function generateAISitrep(impactedFacilities, disasters, situationOverview, dateFilterText, statistics, acledData = [], osmData = null, worldPopData = {}, worldPopYear = null, districts = [], uploadedDataSchema = null, scope = {}, recentExternalContext = null) {
  try {
    // Get current date and time
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0];

    // Build enhanced context
    let enhancedContext = situationOverview;

    // Add ACLED security context
    if (acledData && acledData.length > 0) {
      const acledSummary = buildAreaAcledSummary(acledData);
      enhancedContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      enhancedContext += `SECURITY CONTEXT - ACLED CONFLICT DATA (${acledData.length} events)\n`;
      enhancedContext += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      enhancedContext += '\nACLED summary:\n';
      if (acledSummary.dateRange.start && acledSummary.dateRange.end) {
        enhancedContext += `- Event date range in analyzed area: ${acledSummary.dateRange.start} to ${acledSummary.dateRange.end}\n`;
      }
      enhancedContext += `- Reported fatalities in analyzed area: ${acledSummary.totalFatalities}\n`;
      if (acledSummary.zeroFatalityEvents > 0) {
        enhancedContext += `- Events recorded with no reported fatalities: ${acledSummary.zeroFatalityEvents}\n`;
      }
      if (acledSummary.eventTypes.length > 0) {
        enhancedContext += '- Incidents by event type:\n';
        acledSummary.eventTypes.forEach(({ label, count }) => {
          enhancedContext += `  - ${label}: ${count}\n`;
        });
      }
      if (acledSummary.subEventTypes.length > 0) {
        enhancedContext += '- Incidents by sub-event type:\n';
        acledSummary.subEventTypes.forEach(({ label, count }) => {
          enhancedContext += `  - ${label}: ${count}\n`;
        });
      }
      if (acledSummary.hotspots.length > 0) {
        enhancedContext += '- Main hotspots in analyzed area:\n';
        acledSummary.hotspots.forEach(({ label, count, fatalities }, index) => {
          enhancedContext += `  - Hotspot ${index + 1}: ${label} (${count} events${fatalities > 0 ? `, ${fatalities} reported fatalities` : ''})\n`;
        });
      }
      if (acledSummary.actorPairs.length > 0) {
        enhancedContext += '- Most frequent actor pairings:\n';
        acledSummary.actorPairs.forEach(({ label, count }) => {
          enhancedContext += `  - ${label}: ${count} events\n`;
        });
      }
      if (acledSummary.notableIncidents.length > 0) {
        enhancedContext += '\nNotable security incidents in analyzed area:\n';
        acledSummary.notableIncidents.forEach((incident) => {
          enhancedContext += `- ${incident.event_date}: ${incident.event_type}${incident.sub_event_type ? ` / ${incident.sub_event_type}` : ''} in ${incident.location}${incident.actorSummary ? ` involving ${incident.actorSummary}` : ''}${incident.fatalities > 0 ? ` (${incident.fatalities} fatalities)` : ' (no reported fatalities)'}\n`;
          if (incident.notes) enhancedContext += `  Note: ${incident.notes}\n`;
          if (incident.source) enhancedContext += `  Source: ${incident.source}\n`;
        });
      }
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

    if (uploadedDataSchema && (uploadedDataSchema.keyFields?.length || uploadedDataSchema.typeBreakdown?.length)) {
      enhancedContext += '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      enhancedContext += 'UPLOADED SITE DATA PROFILE\n';
      enhancedContext += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      enhancedContext += `- Uploaded records in scope: ${uploadedDataSchema.recordCount || impactedFacilities.length}\n`;
      if (uploadedDataSchema.typeBreakdown?.length) {
        enhancedContext += '- Site type breakdown:\n';
        uploadedDataSchema.typeBreakdown.forEach((entry) => {
          enhancedContext += `  - ${entry.label}: ${entry.count}\n`;
        });
      }
      if (uploadedDataSchema.keyFields?.length) {
        enhancedContext += `- Key uploaded fields available for interpretation: ${uploadedDataSchema.keyFields.join(', ')}\n`;
      }
      enhancedContext += '\n**NOTE**: Infer the operational meaning of the uploaded site data from these fields. If the uploaded records look like campaign sites, immunization points, health facilities, labs, blood banks, or malaria program records, adapt the report wording and priorities accordingly.\n';
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
- Sites assessed: ${scope.siteCount || 0}
- Impacted sites: ${scope.impactedSiteCount || 0}
- Uploaded site record types: ${uploadedDataSchema?.typeBreakdown?.map((entry) => `${entry.label} (${entry.count})`).join(', ') || 'Not specified'}
- Uploaded key fields: ${uploadedDataSchema?.keyFields?.join(', ') || 'Not specified'}

SITUATION OVERVIEW (scoped disasters from the ${dateFilterText}):
${enhancedContext}

IMPORTANT SCOPING RULES:
- This report must ONLY describe the current operational workspace, not the global GDACS feed.
- ONLY include disasters, sites, districts, and ACLED events from the current filtered selection (${dateFilterText}) and scoped area above.
- Do not reference unrelated disasters in other countries or regions.
- Use the word "site" or "sites" in the report, not "facility" or "facilities", unless directly quoting an external source.
- The primary narrative is operational impact on the user's sites and covered geography.
- Do not assume all uploaded sites are the same type. The uploaded data may represent health facilities, PHCs, hospitals, labs, blood banks, immunization sites, malaria campaign sites, or other operational records.
- When uploaded fields indicate campaign or program metrics such as target population, refusals, refusal rate, doses, stock, coverage, malaria indicators, or service type, explicitly use those metrics in the report.
- When site types vary, distinguish them in the narrative instead of collapsing everything into one generic category.
- If web search context is included, use it only to supplement and update the scoped picture. Do not let it broaden the report into a global bulletin.

Your SitRep should include:
1. Scope
2. Executive Summary
3. Priority Areas
4. Site Impact Summary (adapt to the uploaded record types and include any meaningful uploaded metrics)
5. Security Context (must explicitly use the uploaded ACLED data: event counts, main hotspots, most relevant event types, fatalities if present, and recent notable incidents)
6. Threat Overview
7. Population and Access Context
8. Operational Implications
9. Immediate Actions
10. Data Confidence and Gaps

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
  overview += `- Sites assessed: ${scope.siteCount || 0}\n`;
  overview += `- Impacted sites: ${scope.impactedSiteCount || 0}\n`;
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
    overview += `- Total Sites: ${statistics.totalFacilities}\n`;
    overview += `- Impacted Sites: ${statistics.impactedFacilityCount} (${statistics.percentageImpacted}%)\n`;
    
    // Add disaster statistics
    if (statistics.disasterStats && statistics.disasterStats.length > 0) {
      overview += `\nDISASTER IMPACT DETAILS:\n`;
      for (const disasterStat of statistics.disasterStats) {
        overview += `- ${disasterStat.name} (${disasterStat.type}): ${disasterStat.affectedFacilities} sites impacted, ${disasterStat.impactArea} km² area, ${disasterStat.polygon ? 'using polygon data' : 'using radius'}\n`;
      }
    }
    
    // Add overlapping impacts if available
    if (statistics.overlappingImpacts && statistics.overlappingImpacts.length > 0) {
      overview += `\nOVERLAPPING DISASTER IMPACTS (${statistics.overlappingImpacts.length}):\n`;
      for (const overlap of statistics.overlappingImpacts) {
        overview += `- ${overlap.disasters[0]} + ${overlap.disasters[1]}: Impacts ${overlap.facilities.length} sites\n`;
      }
    }
  }
  
  // Add impacted sites summary
  overview += `\nIMPACTED SITES (${impactedFacilities.length}):\n`;
  
  for (const impact of impactedFacilities) {
    const facility = impact.facility || {};
    const attributes = impact.attributes || {};
    const facilityImpacts = impact.impacts || [];
    
    const facilityName = facility.name || 'Unnamed site';
    const locationBits = [facility.district, facility.region, facility.country].filter(Boolean);
    overview += `\n${facilityName}${locationBits.length > 0 ? ` (${locationBits.join(', ')})` : ''}:\n`;
    const typeLabel = facility.type || facility.facilityType || facility.site_type || facility.siteType || facility.category || facility.service_type;
    if (typeLabel) {
      overview += `- Site type: ${typeLabel}\n`;
    }
    const relevantAttributes = Object.entries(attributes)
      .filter(([key]) => /type|category|service|target|population|refusal|coverage|dose|stock|supply|capacity|status|team|malaria|campaign/i.test(key))
      .slice(0, 8);
    relevantAttributes.forEach(([key, value]) => {
      overview += `- ${key}: ${value}\n`;
    });
    
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
  - Number of affected sites: ${impactedFacilities.length}

  ${situationOverview}

  ${recentExternalContext?.summary ? `Recent external context:\n${recentExternalContext.summary}\n` : ''}

  Format as markdown with these sections:
  1. Scope
  2. Executive Summary
  3. Priority Areas
  4. Site Impact Summary
  5. Security Context
  6. Threat Overview
  7. Operational Implications
  8. Immediate Actions
  9. Data Confidence and Gaps

  Use "site" / "sites" instead of "facility" / "facilities".
  Adapt the report to the uploaded site types and fields instead of assuming generic facilities.

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
  const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const entries = Object.entries(props || {});
  const getFirstMatchingValue = (matchers = []) => {
    for (const [key, value] of entries) {
      if (value === null || value === undefined || value === '') continue;
      const normalized = normalizeKey(key);
      if (matchers.some((matcher) => normalized === matcher || normalized.includes(matcher))) {
        return value;
      }
    }
    return null;
  };

  const country = getFirstMatchingValue([
    'name0', 'adm0en', 'adm0name', 'country', 'admin0', 'admin0name', 'cntry', 'iso0name'
  ]);
  const region = getFirstMatchingValue([
    'name1', 'adm1en', 'adm1name', 'region', 'province', 'state', 'admin1', 'admin1name', 'provience', 'provincec'
  ]);
  const districtName = getFirstMatchingValue([
    'name2', 'adm2en', 'adm2name', 'district', 'admin2', 'admin2name', 'tehsil', 'uc', 'municipality', 'county', 'name'
  ]);

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

  let summary = 'Site-centered operational workspace';
  if (districtNames.length > 0) {
    summary = `${districtNames.length} district(s) in ${countries.join(', ') || 'the selected area'}`;
  } else if (regions.length > 0 || countries.length > 0) {
    summary = `${regions.slice(0, 3).join(', ') || countries.join(', ')} operational workspace`;
  } else if (impactedFacilities.length > 0) {
    summary = `${impactedFacilities.length} impacted site location(s)`;
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
    siteCount: impactedFacilities.length,
    impactedSiteCount: impactedFacilities.length,
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

function buildAreaAcledSummary(acledData = []) {
  const countBy = (items, getter, { limit = 6 } = {}) => {
    const counts = items.reduce((acc, item) => {
      const key = getter(item);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));
  };

  const hotspotMap = acledData.reduce((acc, event) => {
    const key = event.admin2 || event.admin1 || event.location || event.country || 'Unspecified';
    if (!acc[key]) {
      acc[key] = { count: 0, fatalities: 0 };
    }
    acc[key].count += 1;
    acc[key].fatalities += toNumber(event.fatalities) || 0;
    return acc;
  }, {});

  const totalFatalities = acledData.reduce((sum, event) => sum + (toNumber(event.fatalities) || 0), 0);
  const zeroFatalityEvents = acledData.filter((event) => (toNumber(event.fatalities) || 0) === 0).length;
  const sortedDates = acledData.map((event) => event.event_date).filter(Boolean).sort();

  const notableIncidents = acledData
    .slice()
    .sort((a, b) => {
      const fatalityDiff = (toNumber(b.fatalities) || 0) - (toNumber(a.fatalities) || 0);
      if (fatalityDiff !== 0) return fatalityDiff;
      return new Date(b.event_date || 0) - new Date(a.event_date || 0);
    })
    .slice(0, 5)
    .map((event) => ({
      event_date: event.event_date,
      event_type: event.event_type || 'Unknown',
      sub_event_type: event.sub_event_type || null,
      location: event.admin2 || event.admin1 || event.location || event.country || 'Unspecified',
      actorSummary: [event.actor1, event.actor2].filter(Boolean).join(' vs ') || null,
      fatalities: toNumber(event.fatalities) || 0,
      notes: event.notes ? String(event.notes).slice(0, 180) : null,
      source: event.source || null
    }));

  return {
    totalFatalities,
    zeroFatalityEvents,
    dateRange: {
      start: sortedDates[0] || null,
      end: sortedDates[sortedDates.length - 1] || null
    },
    eventTypes: countBy(acledData, (event) => event.event_type || 'Unknown'),
    subEventTypes: countBy(acledData, (event) => event.sub_event_type || null),
    hotspots: Object.entries(hotspotMap)
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].fatalities - a[1].fatalities;
      })
      .slice(0, 5)
      .map(([label, value]) => ({ label, count: value.count, fatalities: value.fatalities })),
    actorPairs: countBy(
      acledData,
      (event) => {
        const actors = [event.actor1, event.actor2].filter(Boolean);
        return actors.length > 0 ? actors.join(' vs ') : null;
      },
      { limit: 5 }
    ),
    notableIncidents
  };
}
