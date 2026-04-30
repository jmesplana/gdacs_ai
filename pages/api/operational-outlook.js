import { withRateLimit } from '../../lib/rateLimit';
import { formatWorldPopForAI } from '../../utils/worldpopHelpers';
import { formatOSMForAI } from '../../lib/osmHelpers';
import { scoreDistrictRisk } from '../../lib/districtRiskScoring';
/**
 * Operational Outlook API
 * Generates forward-looking humanitarian analysis based on current situation
 */

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * Smart extraction of country/region from shapefile properties
 * Handles multiple naming conventions (GADM, custom, etc.)
 */
function extractLocationFromDistrict(district) {
  const props = district.properties || district || {};

  // Try multiple field name patterns for country (admin level 0)
  const countryFields = [
    'NAME_0', 'ADM0_EN', 'COUNTRY', 'Country', 'country',
    'admin0Name', 'ADM0_NAME', 'ADMIN0', 'name_0'
  ];

  // Try multiple field name patterns for region (admin level 1)
  const regionFields = [
    'NAME_1', 'ADM1_EN', 'REGION', 'Region', 'region',
    'admin1Name', 'ADM1_NAME', 'ADMIN1', 'name_1'
  ];

  let country = null;
  let region = null;

  // Find first non-null country field
  for (const field of countryFields) {
    if (props[field]) {
      country = props[field];
      break;
    }
  }

  // Find first non-null region field
  for (const field of regionFields) {
    if (props[field]) {
      region = props[field];
      break;
    }
  }

  // If still no country, try to extract from district name or other fields
  if (!country && props.name) {
    // Some shapefiles might have "District, Country" format
    const parts = props.name.split(',');
    if (parts.length > 1) {
      country = parts[parts.length - 1].trim();
    }
  }

  return { country, region, allProps: props };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    facilities = [],
    disasters = [],
    acledData = [],
    districts = [],
    districtHazardAnalysis = null,
    supportingAssessments = null,
    selectedDistrict = null, // Optional: name of single admin level being analyzed
    worldPopData = {},
    worldPopYear = null,
    osmData = null, // Optional: OpenStreetMap infrastructure data
  } = req.body;

  if (!openai) {
    return res.status(503).json({
      error: 'AI service not available',
      message: 'OpenAI API key not configured'
    });
  }

  try {
    // Debug: Log what we received
    console.log('📥 Operational Outlook API received:', {
      facilities: facilities?.length || 0,
      disasters: disasters?.length || 0,
      acledData: acledData?.length || 0,
      districts: districts?.length || 0,
      osmData: osmData?.features?.length || 0,
      worldPopData: Object.keys(worldPopData || {}).length,
      selectedDistrict: selectedDistrict,
      districtHazardAnalysis: districtHazardAnalysis?.districts?.length || 0
    });

    // Extract country/region from shapefile for web search using smart extraction
    let country = null;
    let region = null;
    if (districts && districts.length > 0) {
      const locationInfo = extractLocationFromDistrict(districts[0]);
      country = locationInfo.country;
      region = locationInfo.region;

      console.log('📍 First district properties:', locationInfo.allProps);
      console.log('🌍 Extracted location:', { country, region });
    }

    // Perform web search for recent humanitarian events if we have a country
    let webSearchResults = null;
    if (country) {
      try {
        const searchScope = selectedDistrict ? `${selectedDistrict} ${country}` : country;
        const searchQuery = `${searchScope} humanitarian crisis disaster conflict ${new Date().getFullYear()}`;
        console.log(`🔍 Searching web for: "${searchQuery}"`);
        webSearchResults = await performWebSearch(searchQuery);
      } catch (searchError) {
        console.warn('Web search failed:', searchError);
        // Continue without web search results
      }
    }

    // Build context from available data
    let context = buildAnalysisContext(
      facilities,
      disasters,
      acledData,
      districts,
      districtHazardAnalysis,
      supportingAssessments,
      webSearchResults,
      country,
      selectedDistrict
    );

    if (districtHazardAnalysis?.districts?.length > 0) {
      context += '\n\n' + formatDistrictHazardAnalysisForContext(districtHazardAnalysis);
    }

    // Append WorldPop population data if available
    if (worldPopData && Object.keys(worldPopData).length > 0) {
      context += formatWorldPopForAI(worldPopData, districts, worldPopYear || 'unknown');
    }

    // Append OSM infrastructure data if available
    if (osmData && osmData.features && osmData.features.length > 0) {
      context += '\n\n' + formatOSMForAI(osmData, disasters);
      context += '\n\n**INFRASTRUCTURE ANALYSIS GUIDANCE:**\n';
      context += '- Assess infrastructure resilience and vulnerabilities\n';
      context += '- Identify critical infrastructure gaps in high-risk areas\n';
      context += '- Recommend infrastructure protection and redundancy measures\n';
      context += '- Consider logistical implications of infrastructure damage\n';
    }

    console.log('Generating operational outlook with context:', {
      facilities: facilities.length,
      disasters: disasters.length,
      acledEvents: acledData.length,
      districts: districts.length,
      country: country,
      hasWebSearch: !!webSearchResults,
      hasOSMData: !!(osmData && osmData.features && osmData.features.length > 0),
      osmFeatures: osmData?.features?.length || 0,
      hasDistrictHazardAnalysis: !!(districtHazardAnalysis?.districts?.length > 0),
      hasLogisticsAssessment: !!supportingAssessments?.logistics,
      analysisLevel: selectedDistrict ? 'admin' : 'country',
      selectedAdmin: selectedDistrict
    });

    // Generate outlook using AI
    const outlook = await generateOutlook(context, selectedDistrict);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      outlook,
      context: {
        facilitiesAnalyzed: facilities.length,
        disastersMonitored: disasters.length,
        securityEvents: acledData.length,
        districtsIncluded: districts.length,
        country: country,
        hasWebSearch: !!webSearchResults
      }
    });

  } catch (error) {
    console.error('Operational outlook generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate operational outlook',
      message: error.message
    });
  }
}

function formatDistrictHazardAnalysisForContext(districtHazardAnalysis = null) {
  if (!districtHazardAnalysis?.districts?.length) return '';

  const lines = [
    '## District Hazard Analysis',
    '',
    `Time window: ${districtHazardAnalysis.timeWindowDays || 7} days`
  ];

  if (districtHazardAnalysis.summary?.methodology?.length) {
    lines.push('Methodology:');
    districtHazardAnalysis.summary.methodology.slice(0, 5).forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push('');
  }

  lines.push('District hazard ranking:');
  districtHazardAnalysis.districts.slice(0, 10).forEach((district, index) => {
    const dominant = district.dominantHazard || {};
    const scoreLabel = typeof dominant.score === 'number'
      ? `${dominant.score}/100`
      : 'Not ready';
    lines.push(`${index + 1}. ${district.districtName}: ${normalizeHazardLabel(dominant.type)} ${dominant.level || 'not-ready'} (${scoreLabel})`);
    if (district.responseScale) lines.push(`   Response scale: ${district.responseScale}`);
    if (district.evidenceBase) lines.push(`   Evidence base: ${district.evidenceBase}`);
    if (district.confidence) lines.push(`   Confidence: ${district.confidence}`);
    if (district.drivers?.length) {
      lines.push(`   Top drivers: ${district.drivers.slice(0, 3).map((driver) => `${driver.label}${driver.value !== null && driver.value !== undefined ? ` (${driver.value}${driver.unit ? ` ${driver.unit}` : ''})` : ''}`).join(' | ')}`);
    }
    if (district.rationale?.length) {
      lines.push(`   Why: ${district.rationale.slice(0, 3).join(' | ')}`);
    }
    if (district.hazardAssessments) {
      const flood = district.hazardAssessments.flood;
      const drought = district.hazardAssessments.drought;
      const heat = district.hazardAssessments.heat;
      const access = district.accessibilityAssessment;

      if (flood) {
        lines.push(`   Flood readiness: ${flood.status}${flood.message ? ` - ${flood.message}` : ''}`);
      }
      if (drought) {
        lines.push(`   Drought readiness: ${drought.status}${drought.message ? ` - ${drought.message}` : ''}`);
      }
      if (heat) {
        lines.push(`   Heat readiness: ${heat.status}${heat.message ? ` - ${heat.message}` : ''}`);
      }
      if (access) {
        lines.push(`   Access readiness: ${access.status}${access.message ? ` - ${access.message}` : ''}`);
      }
    }
    if (district.limitations?.length) {
      lines.push(`   Limitations: ${district.limitations.slice(0, 3).join(' | ')}`);
    }
  });

  if (districtHazardAnalysis.summary?.sources?.length) {
    lines.push('');
    lines.push(`Sources: ${districtHazardAnalysis.summary.sources.join(' | ')}`);
  }

  if (districtHazardAnalysis.warnings?.length) {
    lines.push('');
    lines.push('Warnings:');
    districtHazardAnalysis.warnings.forEach((warning) => {
      lines.push(`- ${warning}`);
    });
  }

  return lines.join('\n');
}

function formatAssessmentAvailabilityForContext(districtHazardAnalysis = null, supportingAssessments = null) {
  const lines = ['## Assessment Availability and Limitations', ''];

  if (!districtHazardAnalysis && !supportingAssessments) {
    lines.push('- No scoped hazard or logistics assessments were available for this analysis.');
    return lines.join('\n');
  }

  const districts = districtHazardAnalysis?.districts || [];
  const floodReadyCount = districts.filter((district) => district.hazardAssessments?.flood?.status === 'ready').length;
  const droughtReadyCount = districts.filter((district) => district.hazardAssessments?.drought?.status === 'ready').length;
  const heatReadyCount = districts.filter((district) => district.hazardAssessments?.heat?.status === 'ready').length;
  const accessReadyCount = districts.filter((district) => district.accessibilityAssessment?.status === 'ready').length;

  if (districts.length > 0) {
    lines.push(`- Flood assessment readiness: ${floodReadyCount}/${districts.length} districts ready`);
    lines.push(`- Drought assessment readiness: ${droughtReadyCount}/${districts.length} districts ready`);
    lines.push(`- Heat assessment readiness: ${heatReadyCount}/${districts.length} districts ready`);
    lines.push(`- Hard-to-reach access readiness: ${accessReadyCount}/${districts.length} districts ready`);
  }

  if (supportingAssessments?.logistics) {
    lines.push('- OSM-backed logistics assessment is available for the current scope.');
  } else {
    lines.push('- No OSM-backed logistics assessment was available for the current scope. Do not infer road, fuel, or air access conditions as assessed facts.');
  }

  if (districtHazardAnalysis?.warnings?.length) {
    lines.push('- Current analysis warnings:');
    districtHazardAnalysis.warnings.forEach((warning) => {
      lines.push(`  * ${warning}`);
    });
  }

  return lines.join('\n');
}

function normalizeHazardLabel(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'unavailable') return 'Hazard';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Web search function using DuckDuckGo (same as chat.js)
 */
async function performWebSearch(query) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();

    // Parse DDG HTML results
    const results = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;

    let match;
    let count = 0;
    while ((match = resultRegex.exec(html)) !== null && count < 5) {
      const url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '');
      results.push({ title, url });
      count++;
    }

    // Extract snippets
    count = 0;
    while ((match = snippetRegex.exec(html)) !== null && count < results.length) {
      results[count].snippet = match[1].replace(/<[^>]*>/g, '').trim();
      count++;
    }

    if (results.length === 0) {
      return "No recent web results found.";
    }

    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.snippet || 'No description available'}\n   Source: ${r.url}`
    ).join('\n\n');

  } catch (error) {
    console.error('Web search error:', error);
    return `Web search unavailable: ${error.message}`;
  }
}

/**
 * Build analysis context from available data
 */
function buildAnalysisContext(facilities, disasters, acledData, districts, districtHazardAnalysis, supportingAssessments, webSearchResults, country, selectedDistrict) {
  let context = '# CURRENT SITUATION DATA\n\n';

  // Add analysis level indicator
  if (selectedDistrict) {
    context += `**ANALYSIS LEVEL**: Admin-level (single administrative unit)\n`;
    context += `**ADMIN UNIT**: ${selectedDistrict}\n\n`;
  } else {
    context += `**ANALYSIS LEVEL**: Country-level (all administrative units)\n\n`;
  }

  // Add web search results first for recent context
  if (webSearchResults && country) {
    context += `## Recent Events and News (Web Search for ${country})\n\n`;
    context += webSearchResults;
    context += '\n\n**Note**: The above information is from recent web sources. Use this to contextualize the analysis below.\n\n';
  }

  // Geographic coverage from shapefile
  if (districts && districts.length > 0) {
    context += `## Geographic Area (Shapefile Data)\n`;

    // Handle both GeoJSON FeatureCollection and array of features
    let districtFeatures = districts;
    if (districts.type === 'FeatureCollection' && districts.features) {
      districtFeatures = districts.features;
    }

    // Extract country/region from first district using smart extraction
    const locationInfo = extractLocationFromDistrict(districtFeatures[0]);
    const country = locationInfo.country || 'Unknown';
    const region = locationInfo.region;

    context += `- Country: ${country}\n`;
    if (region && region !== country) {
      context += `- Region: ${region}\n`;
    }
    context += `- Total admin levels: ${districtFeatures.length}\n`;

    // Debug: Log first district to understand structure
    console.log('First admin level sample:', JSON.stringify(locationInfo.allProps, null, 2).substring(0, 500));

    // Calculate admin level risks based on ACLED events (same logic as MapComponent)
    const enrichedDistricts = calculateDistrictRisks(districtFeatures, acledData);

    // Calculate risk distribution from calculated data
    const riskDistribution = enrichedDistricts.reduce((acc, d) => {
      const risk = d.riskLevel || 'none';
      acc[risk] = (acc[risk] || 0) + 1;
      return acc;
    }, {});

    context += `- District Risk Levels:\n`;
    if (riskDistribution['very-high']) context += `  * Very High Risk: ${riskDistribution['very-high']} districts\n`;
    if (riskDistribution.high) context += `  * High Risk: ${riskDistribution.high} districts\n`;
    if (riskDistribution.medium) context += `  * Medium Risk: ${riskDistribution.medium} districts\n`;
    if (riskDistribution.low) context += `  * Low Risk: ${riskDistribution.low} districts\n`;
    if (riskDistribution.none) context += `  * No Risk: ${riskDistribution.none} districts\n`;

    // Extract sample district details with events
    context += `\n### High Risk Districts (Examples):\n`;
    const highRiskDistricts = enrichedDistricts
      .filter(d => d.riskLevel === 'very-high' || d.riskLevel === 'high')
      .slice(0, 5);

    if (highRiskDistricts.length > 0) {
      highRiskDistricts.forEach(district => {
        const props = district.properties || {};
        const name = props.ADM2_EN || props.NAME || props.name || props.district || props.ADM1_EN || props.REGION || 'Unnamed';
        const risk = district.riskLevel || 'unknown';
        const eventCount = district.eventCount || 0;
        const score = district.riskScore || 0;
        const population = props.population || props.POP || props.Population;

        context += `- **${name}**: ${risk} (${eventCount} events, score: ${score.toFixed(1)})`;
        if (population) context += ` - Population: ${population.toLocaleString()}`;
        context += '\n';
      });
    } else {
      context += `No high-risk districts identified based on ACLED conflict data.\n`;
    }

    // Population data if available
    const totalPopulation = districtFeatures.reduce((sum, d) => {
      const pop = d.properties?.population || d.properties?.POP || d.properties?.Population || 0;
      return sum + (typeof pop === 'number' ? pop : 0);
    }, 0);

    if (totalPopulation > 0) {
      context += `\n- Total population (from shapefile): ${totalPopulation.toLocaleString()}\n`;
    }

    context += '\n';
  }

  // Facilities
  if (facilities && facilities.length > 0) {
    context += `## Health Facilities (Uploaded Data)\n`;
    context += `- Total facilities: ${facilities.length}\n`;

    // Get facility types
    const facilityTypes = facilities.reduce((acc, f) => {
      const type = f.type || f.facility_type || f.Type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    context += `- Facility types:\n`;
    Object.entries(facilityTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        context += `  * ${type}: ${count}\n`;
      });

    // Extract operational status if available
    const statusCounts = facilities.reduce((acc, f) => {
      const status = f.status || f.operational_status || f.Status;
      if (status) {
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {});

    if (Object.keys(statusCounts).length > 0) {
      context += `\n- Operational status:\n`;
      Object.entries(statusCounts).forEach(([status, count]) => {
        context += `  * ${status}: ${count}\n`;
      });
    }

    // Get geographic distribution
    const facilitiesByLocation = facilities.reduce((acc, f) => {
      const district = f.district || f.District || f.admin2 || f.location;
      if (district) {
        acc[district] = (acc[district] || 0) + 1;
      }
      return acc;
    }, {});

    if (Object.keys(facilitiesByLocation).length > 0) {
      context += `\n- Top locations by facility count:\n`;
      Object.entries(facilitiesByLocation)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([location, count]) => {
          context += `  * ${location}: ${count} facilities\n`;
        });
    }

    context += '\n';
  }

  // Active disasters - filter to relevant country if we have shapefile data
  if (disasters && disasters.length > 0) {
    let relevantDisasters = disasters;

    // If we have a country from shapefile, try to filter disasters to that country
    if (country) {
      const countryFiltered = disasters.filter(d => {
        const disasterCountry = d.country || d.Country || '';
        return disasterCountry.toLowerCase().includes(country.toLowerCase()) ||
               country.toLowerCase().includes(disasterCountry.toLowerCase());
      });

      // Use filtered if we found any, otherwise keep all
      if (countryFiltered.length > 0) {
        relevantDisasters = countryFiltered;
        context += `## Active Disasters (Filtered to ${country})\n`;
        context += `- Disasters in ${country}: ${relevantDisasters.length}\n`;
        context += `- Global disasters available: ${disasters.length}\n\n`;
      } else {
        context += `## Active Disasters (Global - none specific to ${country})\n`;
        context += `- Total active disasters worldwide: ${disasters.length}\n`;
        context += `- **Note**: No disasters specifically matched to ${country}. Showing nearby disasters for context.\n\n`;
      }
    } else {
      context += `## Active Disasters\n`;
      context += `- Total active disasters: ${disasters.length}\n\n`;
    }

    relevantDisasters.slice(0, 5).forEach((disaster, idx) => {
      context += `### Disaster ${idx + 1}: ${disaster.eventName || disaster.title}\n`;
      context += `- Type: ${disaster.eventType}\n`;
      context += `- Country: ${disaster.country || 'Unknown'}\n`;
      context += `- Alert Level: ${disaster.alertLevel || 'Unknown'}\n`;
      if (disaster.severity) context += `- Severity: ${disaster.severity}\n`;
      if (disaster.description) context += `- Description: ${disaster.description.substring(0, 200)}...\n`;
      context += '\n';
    });

    if (relevantDisasters.length > 5) {
      context += `... and ${relevantDisasters.length - 5} more disasters\n\n`;
    }
  }

  // Security events (ACLED) - with detailed analysis
  if (acledData && acledData.length > 0) {
    context += `## Security Events (ACLED Conflict Data)\n`;
    context += `- Total conflict events in area: ${acledData.length}\n`;

    // Group by event type
    const eventTypes = acledData.reduce((acc, event) => {
      const type = event.event_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    context += `\n- Event types:\n`;
    Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const percentage = ((count / acledData.length) * 100).toFixed(1);
        context += `  * ${type}: ${count} events (${percentage}%)\n`;
      });

    // Fatalities analysis
    const totalFatalities = acledData.reduce((sum, event) => {
      const fatalities = parseInt(event.fatalities) || 0;
      return sum + fatalities;
    }, 0);

    if (totalFatalities > 0) {
      context += `\n- Total fatalities: ${totalFatalities}\n`;
      context += `- Average fatalities per event: ${(totalFatalities / acledData.length).toFixed(1)}\n`;
    }

    // Actor analysis
    const actors = acledData.reduce((acc, event) => {
      const actor1 = event.actor1 || 'Unknown';
      if (actor1 !== 'Unknown') {
        acc[actor1] = (acc[actor1] || 0) + 1;
      }
      return acc;
    }, {});

    if (Object.keys(actors).length > 0) {
      context += `\n- Key actors (top 5):\n`;
      Object.entries(actors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([actor, count]) => {
          context += `  * ${actor}: ${count} events\n`;
        });
    }

    // Temporal analysis - recent trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const last30Days = acledData.filter(event => {
      const eventDate = new Date(event.event_date);
      return eventDate >= thirtyDaysAgo;
    });

    const previous30Days = acledData.filter(event => {
      const eventDate = new Date(event.event_date);
      return eventDate >= sixtyDaysAgo && eventDate < thirtyDaysAgo;
    });

    context += `\n- Temporal trends:\n`;
    context += `  * Last 30 days: ${last30Days.length} events\n`;
    context += `  * Previous 30 days: ${previous30Days.length} events\n`;

    if (previous30Days.length > 0) {
      const change = ((last30Days.length - previous30Days.length) / previous30Days.length) * 100;
      const trend = change > 0 ? 'increase' : 'decrease';
      context += `  * Trend: ${Math.abs(change).toFixed(1)}% ${trend}\n`;
    }

    // Geographic distribution
    const eventsByLocation = acledData.reduce((acc, event) => {
      const location = event.admin2 || event.location || 'Unknown';
      if (location !== 'Unknown') {
        acc[location] = (acc[location] || 0) + 1;
      }
      return acc;
    }, {});

    if (Object.keys(eventsByLocation).length > 0) {
      context += `\n- Most affected locations:\n`;
      Object.entries(eventsByLocation)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([location, count]) => {
          context += `  * ${location}: ${count} events\n`;
        });
    }

    // Sample recent high-impact events
    if (last30Days.length > 0) {
      context += `\n### Recent High-Impact Events (Examples):\n`;
      last30Days
        .filter(event => (parseInt(event.fatalities) || 0) > 0)
        .slice(0, 3)
        .forEach((event, idx) => {
          const fatalities = event.fatalities || 0;
          const location = event.admin2 || event.location || 'Unknown location';
          context += `${idx + 1}. ${event.event_type} in ${location} (${event.event_date})\n`;
          if (fatalities > 0) context += `   Fatalities: ${fatalities}\n`;
          if (event.notes) context += `   Details: ${event.notes.substring(0, 150)}...\n`;
        });
    }

    context += '\n';
  }

  if (districtHazardAnalysis) {
    context += `${formatAssessmentAvailabilityForContext(districtHazardAnalysis, supportingAssessments)}\n\n`;
  }

  if (supportingAssessments?.logistics) {
    const logistics = supportingAssessments.logistics;
    context += `## Logistics Assessment (OSM-backed)\n`;
    context += `- Access Score: ${logistics.accessScore ?? 'Unknown'}\n`;
    context += `- Rating: ${logistics.rating || 'Unknown'}\n`;
    context += `- Summary: ${logistics.summary || 'No summary available'}\n`;
    context += `- Road network status: ${logistics.roadNetwork?.assessmentStatus || 'Unknown'}\n`;
    context += `- Fuel access status: ${logistics.fuelAccess?.assessmentStatus || 'Unknown'}\n`;
    context += `- Air access status: ${logistics.airAccess?.assessmentStatus || 'Unknown'}\n`;
    context += '\n';
  }

  return context;
}

/**
 * Calculate admin level risks based on ACLED events (same logic as MapComponent)
 */
function calculateDistrictRisks(districts, acledData) {
  if (!districts || districts.length === 0) {
    return [];
  }

  if (!acledData || acledData.length === 0) {
    return districts.map(d => ({ ...d, riskLevel: 'none', riskScore: 0, eventCount: 0 }));
  }

  return districts.map(district => {
    const risk = scoreDistrictRisk(district, { acledData });

    return {
      ...district,
      riskLevel: risk.level,
      riskScore: risk.score,
      eventCount: risk.eventCount
    };
  });
}

/**
 * Generate operational outlook using AI
 */
async function generateOutlook(context, selectedDistrict) {
  // Determine analysis level and scope
  const isAdminLevel = !!selectedDistrict;
  const analysisScope = isAdminLevel ? `the **${selectedDistrict} admin level**` : 'the **entire operational area**';
  const geoTerm = isAdminLevel ? 'admin level' : 'country/admin levels';

  const prompt = `You are a **Humanitarian Analysis Assistant** supporting operational decision-making for humanitarian responders.

Your task is to analyze the current situation and produce a **forward-looking humanitarian outlook** based on available data such as disaster alerts, conflict trends, facility status, and operational access constraints.

${isAdminLevel ? `**ANALYSIS SCOPE**: You are analyzing a SINGLE administrative unit (${selectedDistrict}). Focus your analysis exclusively on this admin level, not the broader country.` : '**ANALYSIS SCOPE**: You are analyzing the entire operational area (all administrative units).'}

**IMPORTANT INSTRUCTIONS**:
1. **Prioritize the Geographic Area (Shapefile Data) section** - This contains the ACTUAL area of operations with ${geoTerm} risk assessments
2. **Use the Recent Events and News (Web Search)** section to provide current, real-time context
3. **Focus your analysis on ${analysisScope}** as specified in the context
4. **Reference specific ${isAdminLevel ? 'locations within the admin level' : 'admin level names'}** with their risk levels and event counts (e.g., "${isAdminLevel ? 'Northern zone with 4 events' : 'District X with 4 events (score 46)'}")
5. **Do NOT focus on global disasters** unless they directly affect the analyzed ${geoTerm}
6. **Integrate ACLED conflict data** with ${geoTerm} analysis
7. **Include timeframes for each scenario** (e.g., "Most Likely (next 2-4 weeks)", "Escalation (within 1-2 months)")
8. **Quantify uncertainties** with specific data gaps (e.g., "Limited data on ${geoTerm} water infrastructure" not just "uncertainties remain")
9. **Explicitly mention web search findings** in Situation Overview or Key Signals if available
10. **Do not present unsupported predictive outputs as facts.** If the context says a hazard is "not ready", "missing required layers", or "missing evidence data", state that clearly and do not convert it into a factual risk statement.
11. **Do not discuss disease outbreak risk unless the context explicitly includes assessed disease evidence or observed surveillance data.**
12. **Do not discuss logistics conditions as assessed facts unless the context explicitly includes an OSM-backed logistics assessment.**
13. **Prioritize district hazard warnings, readiness, evidence base, and limitations** over any weaker signal when they conflict.
14. **Lead with the decision, not the description.** The first section should make it obvious whether the posture is monitor, prepare, pre-position, escalate, or delay for the selected scope.
15. **If evidence is missing, say what data is needed.** Name the missing data source or layer explicitly (for example Flood Context, Drought Context, Nighttime Lights (GEE), OSM roads, airports, fuel, ACLED, or WorldPop).

Do not simply summarize events. Focus on explaining **what humanitarian impacts are likely to occur next and why**, and how they may affect response operations in ${analysisScope}.

Use the following structure:

**0. Decision Summary**
State the current decision posture for the selected scope in 2-4 sentences.
Include:
* current posture (monitor, prepare, pre-position, escalate, or delay)
* the 2-3 strongest evidence-backed reasons
* what data is still missing if that limits confidence
* one immediate action

**1. Situation Overview**
Briefly describe the current situation in the affected area, including disaster events, conflict trends, infrastructure status, and any important evidence limitations.

**2. Key Signals**
Identify the most important signals from the available data sources (for example GDACS alerts, ACLED conflict events, facility risk status, operational viability or access constraints).

**3. Humanitarian Drivers**
Explain the structural factors shaping humanitarian risk, such as:
* damage to infrastructure or health facilities
* population exposure and displacement
* conflict dynamics
* geographic access constraints
* seasonal hazards or cascading risks

**4. Possible Developments**
Describe three plausible developments with specific timeframes:

• **Most Likely Scenario (next 2-4 weeks)** – what is most likely to happen based on current signals
• **Escalation Scenario (within 1-2 months)** – how the situation could worsen
• **Stabilization Scenario (within 1-2 months)** – how risks might stabilize or improve

Provide a short narrative for each scenario, including realistic timeframes for when key developments would occur.

**5. Early Warning Indicators**
List specific, observable indicators that responders should monitor to understand which scenario may be unfolding. Be concrete (e.g., "Daily cholera case reports from health facilities" not just "disease indicators", "River gauge levels in northern districts" not just "water levels").

**6. Operational Implications**
Explain how the evolving situation may affect humanitarian operations, including:
* access to affected populations
* logistics or infrastructure constraints
* safety and security risks
* potential humanitarian needs or service disruptions

**7. Key Uncertainties**
Highlight specific unknowns or data gaps that affect the analysis. Be concrete about what information is missing (e.g., "Limited data on district-level water infrastructure capacity", "Unknown: government drought response budget allocation", "No recent health facility capacity assessments available" instead of generic statements like "uncertainties remain").

Write clearly and concisely for humanitarian decision makers.
Focus on **humanitarian impact, operational access, and likely developments**, rather than speculation.
If a forecast dimension is not ready, say so plainly. It is better to report "flood risk not ready because Flood Context was not enabled" than to infer a flood conclusion from incomplete inputs.
If a conclusion depends on missing evidence, explicitly say what the operator should load next to improve the decision.

---

Here is the current situation data to analyze:

${context}

---

Generate the operational outlook now:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert humanitarian analyst specializing in forward-looking operational assessments. You provide clear, structured analysis focused on humanitarian impact and operational decision-making.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 3000
  });

  return response.choices[0].message.content;
}

export default withRateLimit(handler);
