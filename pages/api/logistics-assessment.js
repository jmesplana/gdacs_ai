import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';
import {
  analyzeRoadNetwork,
  analyzeFuelAccess,
  analyzeAirAccess,
  findAlternativeRoutes,
  calculateAccessScore,
  calculateSecurityScore,
  calculateAccessScoreWithSecurity,
  getLogisticsRating,
} from '../../lib/logisticsHelpers';

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

  const startTime = Date.now();

  try {
    const {
      osmData,
      disasters = [],
      facilities = [],
      acledEvents = [],
      weatherData = null,
      options = {},
    } = req.body;

    // Input validation
    if (!osmData) {
      return res.status(400).json({
        error: 'Missing required data',
        message: 'osmData is required for logistics assessment'
      });
    }

    if (!disasters || !Array.isArray(disasters)) {
      return res.status(400).json({
        error: 'Invalid data format',
        message: 'disasters must be an array'
      });
    }

    // Validate OSM data structure
    if (!osmData.features || !Array.isArray(osmData.features)) {
      return res.status(400).json({
        error: 'Invalid OSM data format',
        message: 'osmData must be a valid GeoJSON FeatureCollection with features array'
      });
    }

    console.log('📦 Logistics Assessment API received:', {
      osmFeatures: osmData.features?.length || 0,
      disasters: disasters.length,
      facilities: facilities.length,
      acledEvents: acledEvents.length,
      hasWeatherData: !!weatherData,
      hasOrigin: !!(options.origin),
      hasDestination: !!(options.destination),
    });

    // Log disaster details for debugging
    if (disasters.length > 0) {
      console.log('🌪️ Disasters received:');
      disasters.forEach(d => {
        console.log(`  - ${d.title || d.eventName} (${d.eventType || d.eventtype || d.type}) at [${d.latitude ?? d.lat}, ${d.longitude ?? d.lon}]`);
      });
    } else {
      console.log('⚠️ No disasters in request - baseline assessment mode');
    }

    const requestedLayers = osmData.metadata?.requestedLayers || [];
    const assessmentCoverage = {
      roads: requestedLayers.includes('roads') || requestedLayers.includes('bridges'),
      fuel: requestedLayers.includes('fuel'),
      air: requestedLayers.includes('airports')
    };

    // Perform core logistics analysis
    const roadNetworkRaw = analyzeRoadNetwork(osmData, disasters, options);
    const fuelAccessRaw = analyzeFuelAccess(osmData, disasters);
    const airAccessRaw = analyzeAirAccess(osmData, disasters, options);

    // Transform road network data to match drawer expectations
    const roadNetwork = {
      ...roadNetworkRaw,
      passableCount: roadNetworkRaw.accessibleRoads,
      passablePercentage: roadNetworkRaw.totalRoads > 0
        ? Math.round((roadNetworkRaw.accessibleRoads / roadNetworkRaw.totalRoads) * 100)
        : 0,
      blockedCount: roadNetworkRaw.blockedRoads,
      blockedPercentage: roadNetworkRaw.totalRoads > 0
        ? Math.round((roadNetworkRaw.blockedRoads / roadNetworkRaw.totalRoads) * 100)
        : 0,
      majorRoutes: roadNetworkRaw.summary?.majorHighways || 0,
      criticalBlocked: roadNetworkRaw.roadDetails
        ?.filter(r => r.blockageProbability >= 0.6)
        .map(r => ({
          name: r.road.properties?.name || r.road.properties?.tags?.name,
          blockageProbability: r.blockageProbability,
          distanceToDisaster: r.nearestDisaster?.distance || 0
        })) || [],
      bridgesAtRisk: roadNetworkRaw.bridgeDetails
        ?.filter(b => b.status === 'HIGH_RISK' || b.status === 'CRITICAL')
        .map(b => ({
          name: b.bridge.properties?.name || b.bridge.properties?.tags?.name,
          riskScore: b.riskScore || 0,
          distanceToDisaster: b.nearestDisaster?.distance || 0
        })) || [],
      roads: roadNetworkRaw.roadDetails?.map(r => ({
        ...r.road,
        blockageProbability: r.blockageProbability,
        highway: r.road.properties?.tags?.highway,
        name: r.road.properties?.name || r.road.properties?.tags?.name
      })) || [],
      assessmentStatus: assessmentCoverage.roads ? 'ASSESSED' : 'NOT_LOADED'
    };

    // Transform fuel access data
    const fuelAccess = {
      ...fuelAccessRaw,
      totalStations: fuelAccessRaw.totalStations || 0,
      operationalCount: fuelAccessRaw.operationalStations?.length || 0,
      operationalPercentage: fuelAccessRaw.totalStations > 0
        ? Math.round((fuelAccessRaw.operationalStations?.length || 0) / fuelAccessRaw.totalStations * 100)
        : 0,
      atRiskCount: fuelAccessRaw.atRiskStations?.length || 0,
      atRiskPercentage: fuelAccessRaw.totalStations > 0
        ? Math.round((fuelAccessRaw.atRiskStations?.length || 0) / fuelAccessRaw.totalStations * 100)
        : 0
      ,
      assessmentStatus: assessmentCoverage.fuel ? 'ASSESSED' : 'NOT_LOADED'
    };

    // Transform air access data
    const airAccess = {
      ...airAccessRaw,
      totalAirports: airAccessRaw.totalAirports || 0,
      operationalCount: airAccessRaw.operationalAirports?.length || 0,
      operationalPercentage: airAccessRaw.totalAirports > 0
        ? Math.round((airAccessRaw.operationalAirports?.length || 0) / airAccessRaw.totalAirports * 100)
        : 0,
      atRiskCount: airAccessRaw.atRiskAirports?.length || 0,
      atRiskPercentage: airAccessRaw.totalAirports > 0
        ? Math.round((airAccessRaw.atRiskAirports?.length || 0) / airAccessRaw.totalAirports * 100)
        : 0
      ,
      assessmentStatus: assessmentCoverage.air ? 'ASSESSED' : 'NOT_LOADED'
    };

    // Calculate alternative routes if origin and destination provided
    let alternativeRoutes = [];
    if (options.origin && options.destination) {
      alternativeRoutes = findAlternativeRoutes(
        osmData,
        disasters,
        options.origin,
        options.destination,
        options
      );
    }

    // Calculate overall access score
    const securityAnalysis = calculateSecurityScore(acledEvents);
    const accessScoreResult = calculateAccessScoreWithSecurity(
      roadNetworkRaw,
      fuelAccessRaw,
      airAccessRaw,
      securityAnalysis,
      assessmentCoverage
    );
    const accessScore = accessScoreResult.score;
    const rating = getLogisticsRating(accessScore);

    // Generate summary
    const summary = generateLogisticsSummary(accessScore, rating, roadNetwork, fuelAccess, airAccess, securityAnalysis);

    // Generate AI recommendations (with timeout and error handling)
    let recommendations = null;
    if (openai) {
      try {
        console.log('🤖 Generating AI recommendations...');
        recommendations = await Promise.race([
          generateAIRecommendations(
            roadNetwork,
            fuelAccess,
            airAccess,
            alternativeRoutes,
            disasters,
            acledEvents,
            weatherData,
            accessScore,
            rating
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI recommendation timeout')), 30000)
          )
        ]);
        recommendations = {
          ...recommendations,
          aiGenerated: true
        };
      } catch (aiError) {
        console.warn('AI recommendations failed:', aiError.message);
        // Continue without AI recommendations - analysis is still valuable
        recommendations = generateFallbackRecommendations(rating, roadNetwork, fuelAccess, airAccess);
      }
    } else {
      console.warn('OpenAI not configured - using fallback recommendations');
      recommendations = generateFallbackRecommendations(rating, roadNetwork, fuelAccess, airAccess);
    }

    const analysisTime = Date.now() - startTime;

    // Assess data quality
    const dataQuality = {
      osmCoverage: osmData.features.length > 100 ? 'good' : osmData.features.length > 20 ? 'fair' : 'limited',
      disasterData: disasters.length > 0 ? 'complete' : 'none',
      securityData: acledEvents.length > 0 ? 'available' : 'none',
      weatherData: weatherData ? 'available' : 'unavailable',
    };
    const confidence = calculateLogisticsConfidence({
      assessmentCoverage,
      disasters,
      acledEvents,
      weatherData,
      osmFeatureCount: osmData.features.length
    });

    console.log(`✅ Logistics assessment completed in ${analysisTime}ms`);

    return res.status(200).json({
      success: true,
      data: {
        accessScore: parseFloat(accessScore.toFixed(1)),
        rating,
        summary,

        roadNetwork,
        fuelAccess,
        airAccess,
        securityAnalysis,
        alternativeRoutes,

        recommendations,

        metadata: {
          timestamp: new Date().toISOString(),
          analysisTime,
          dataQuality,
          confidence,
        },
      },
    });

  } catch (error) {
    console.error('Logistics assessment error:', error);

    // Return user-friendly error message without exposing internals
    return res.status(500).json({
      error: 'Logistics assessment failed',
      message: 'Unable to complete logistics analysis. Please check your data and try again.',
    });
  }
}

/**
 * Generate summary text for logistics assessment
 * (Different from generateSummary which is used by other features)
 */
function generateLogisticsSummary(accessScore, rating, roadNetwork, fuelAccess, airAccess, securityAnalysis) {
  const summaries = [];

  // Overall assessment
  if (rating === 'EXCELLENT') {
    summaries.push('Logistics access is excellent with minimal disruptions.');
  } else if (rating === 'GOOD') {
    summaries.push('Logistics access is good with some manageable challenges.');
  } else if (rating === 'MODERATE') {
    summaries.push('Logistics access is moderate with significant challenges that require planning.');
  } else if (rating === 'DIFFICULT') {
    summaries.push('Logistics access is difficult with severe constraints requiring alternative approaches.');
  } else {
    summaries.push('Logistics access is critical with major disruptions across multiple infrastructure types.');
  }

  // Road network
  const roadPassable = roadNetwork.passablePercentage || 0;
  if (roadNetwork.assessmentStatus === 'NOT_LOADED') {
    summaries.push('Road network was not assessed because road or bridge layers were not loaded.');
  } else if (roadPassable < 30) {
    summaries.push(`Most roads are blocked or at risk (${100 - roadPassable}% affected).`);
  } else if (roadPassable < 60) {
    summaries.push(`Significant road blockages present (${100 - roadPassable}% affected).`);
  } else if (roadPassable < 90) {
    summaries.push(`Some road disruptions (${100 - roadPassable}% affected).`);
  } else {
    summaries.push('Road network is largely functional.');
  }

  // Fuel access
  const fuelOperational = fuelAccess.operationalPercentage || 0;
  if (fuelAccess.assessmentStatus === 'NOT_LOADED') {
    summaries.push('Fuel access was not assessed because the fuel infrastructure layer was not loaded.');
  } else if (fuelAccess.totalStations === 0) {
    summaries.push('No fuel stations identified in the area.');
  } else if (fuelOperational < 30) {
    summaries.push(`Critical fuel shortage - most stations at risk (${fuelAccess.atRiskCount}/${fuelAccess.totalStations}).`);
  } else if (fuelOperational < 70) {
    summaries.push(`Limited fuel availability (${fuelAccess.operationalCount}/${fuelAccess.totalStations} stations operational).`);
  } else {
    summaries.push(`Fuel access is adequate (${fuelAccess.operationalCount}/${fuelAccess.totalStations} stations operational).`);
  }

  // Air access
  const airOperational = airAccess.operationalPercentage || 0;
  if (airAccess.assessmentStatus === 'NOT_LOADED') {
    summaries.push('Air access was not assessed because the airport layer was not loaded.');
  } else if (airAccess.totalAirports === 0) {
    summaries.push('No airports or airfields identified.');
  } else if (airOperational < 50) {
    summaries.push(`Limited air access - most airports at risk (${airAccess.atRiskCount}/${airAccess.totalAirports}).`);
  } else {
    summaries.push(`Air access available via ${airAccess.operationalCount} operational airport(s).`);
  }

  if (securityAnalysis && securityAnalysis.incidentCount > 0) {
    if (securityAnalysis.level === 'CRITICAL' || securityAnalysis.level === 'HIGH') {
      summaries.push(`Security conditions are ${securityAnalysis.level.toLowerCase()} with ${securityAnalysis.incidentCount} recent ACLED incidents affecting logistics reliability.`);
    } else {
      summaries.push(`Security conditions are being monitored (${securityAnalysis.incidentCount} recent ACLED incidents).`);
    }
  }

  return summaries.join(' ');
}

/**
 * Generate summary text from analysis results
 */
function generateSummary(accessScore, rating, roadNetwork, fuelAccess, airAccess) {
  let summary = '';

  if (rating === 'EXCELLENT') {
    summary = 'Logistics access is excellent with well-developed infrastructure and minimal constraints.';
  } else if (rating === 'GOOD') {
    summary = 'Logistics access is good with adequate infrastructure, though some planning is needed.';
  } else if (rating === 'MODERATE') {
    summary = 'Logistics access is possible but challenging. Careful planning and alternative routes are recommended.';
  } else if (rating === 'DIFFICULT') {
    summary = 'Logistics access is difficult with significant infrastructure gaps and access constraints.';
  } else {
    summary = 'Logistics access is critical with severe constraints. Alternative transport methods strongly recommended.';
  }

  // Add specific details
  const details = [];

  if (roadNetwork.disruptionRisks.length > 0) {
    details.push(`${roadNetwork.disruptionRisks.length} disaster-related road disruption(s) identified`);
  }

  if (roadNetwork.securityRisks.length > 0) {
    details.push('security risks present on road network');
  }

  if (fuelAccess.accessibilityRating === 'poor') {
    details.push('fuel access limited');
  }

  if (airAccess.operationalStatus === 'unavailable') {
    details.push('no air access available');
  } else if (airAccess.operationalStatus === 'limited') {
    details.push('air access restricted by weather');
  }

  if (details.length > 0) {
    summary += ' ' + details.join(', ').charAt(0).toUpperCase() + details.join(', ').slice(1) + '.';
  }

  return summary;
}

/**
 * Generate AI-powered logistics recommendations
 */
async function generateAIRecommendations(
  roadNetwork,
  fuelAccess,
  airAccess,
  alternativeRoutes,
  disasters,
  acledEvents,
  weatherData,
  accessScore,
  rating
) {
  // Build comprehensive context
  let context = `# LOGISTICS ASSESSMENT CONTEXT\n\n`;

  // Overall assessment
  context += `## Overall Access Assessment\n`;
  context += `- Access Score: ${accessScore.toFixed(1)}/10\n`;
  context += `- Rating: ${rating}\n\n`;

  // Road network
  context += `## Road Network Analysis\n`;
  context += `- Total roads mapped: ${roadNetwork.totalRoads}\n`;
  context += `- Accessible roads: ${roadNetwork.accessibleRoads} (${Math.round((roadNetwork.accessibleRoads / roadNetwork.totalRoads) * 100)}%)\n`;
  context += `- Blocked/at-risk roads: ${roadNetwork.blockedRoads}\n`;
  context += `- Critical bridges at risk: ${roadNetwork.criticalBridges || 0}\n`;
  context += `- Accessibility score: ${roadNetwork.accessibilityScore.toFixed(1)}/10\n`;
  context += `- Status: ${roadNetwork.status}\n`;

  if (roadNetwork.blockedRoads > 0) {
    context += `\n**Road Disruptions:**\n`;
    context += `- ${roadNetwork.blockedRoads} roads blocked or at high risk from disasters\n`;
    if (roadNetwork.summary) {
      context += `- Major highways accessible: ${roadNetwork.summary.accessibleMajorHighways}/${roadNetwork.summary.majorHighways}\n`;
    }
  }

  context += `\n`;

  // Fuel access
  context += `## Fuel Access\n`;
  context += `- Total fuel stations: ${fuelAccess.totalStations}\n`;
  context += `- Operational stations: ${fuelAccess.operationalCount} (${fuelAccess.operationalPercentage}%)\n`;
  context += `- At-risk stations: ${fuelAccess.atRiskCount} (${fuelAccess.atRiskPercentage}%)\n`;
  if (fuelAccess.within10km > 0) {
    context += `- Stations within 10km: ${fuelAccess.within10km}\n`;
  }
  context += `\n`;

  // Air access
  context += `## Air Access\n`;
  context += `- Total airports/airfields: ${airAccess.totalAirports}\n`;
  context += `- Operational airports: ${airAccess.operationalCount} (${airAccess.operationalPercentage}%)\n`;
  context += `- At-risk airports: ${airAccess.atRiskCount} (${airAccess.atRiskPercentage}%)\n`;
  context += `\n`;

  // Alternative routes
  if (alternativeRoutes.length > 0) {
    context += `## Alternative Routes Analysis\n`;
    alternativeRoutes.forEach((route, idx) => {
      context += `\n**Route ${idx + 1}: ${route.type}**\n`;
      context += `- Distance: ${route.estimatedDistance} km\n`;
      context += `- Estimated time: ${route.estimatedTime} hours\n`;
      context += `- Risks: ${route.risks.length > 0 ? route.risks.map(r => `${r.name} (${r.distance} km away)`).join(', ') : 'None'}\n`;
      context += `- Note: ${route.recommendation}\n`;
    });
    context += `\n`;
  }

  // Active disasters summary
  if (disasters.length > 0) {
    context += `## Active Disasters in the Region (${disasters.length})\n`;
    disasters.slice(0, 5).forEach((disaster, idx) => {
      context += `${idx + 1}. ${disaster.eventName || disaster.title} (${disaster.eventType})\n`;
      context += `   Alert: ${disaster.alertLevel || 'Unknown'}\n`;
      if ((disaster.latitude ?? disaster.lat) && (disaster.longitude ?? disaster.lon)) {
        context += `   Location: ${disaster.latitude ?? disaster.lat}, ${disaster.longitude ?? disaster.lon}\n`;
      }
    });
    if (disasters.length > 5) {
      context += `... and ${disasters.length - 5} more disasters\n`;
    }
    context += `\n`;
  } else {
    context += `## Active Disasters in the Region\n`;
    context += `No active disasters detected within the assessed region.\n\n`;
  }

  // Security incidents summary
  if (acledEvents.length > 0) {
    context += `## Security Context\n`;
    context += `- Total conflict events: ${acledEvents.length}\n`;
    const eventTypes = acledEvents.reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {});
    context += `- Event types: ${Object.entries(eventTypes).map(([type, count]) => `${type} (${count})`).join(', ')}\n`;
    context += `\n`;
  }

  // Weather context
  if (weatherData && weatherData.daily) {
    context += `## Weather Forecast\n`;
    const { precipitation_probability_max, windspeed_10m_max, temperature_2m_max } = weatherData.daily;
    if (precipitation_probability_max) {
      context += `- Max precipitation probability: ${Math.max(...precipitation_probability_max)}%\n`;
    }
    if (windspeed_10m_max) {
      context += `- Max wind speed: ${Math.max(...windspeed_10m_max)} km/h\n`;
    }
    if (temperature_2m_max) {
      context += `- Max temperature: ${Math.max(...temperature_2m_max)}°C\n`;
    }
    context += `\n`;
  }

  const prompt = `You are a **Humanitarian Logistics Expert** providing actionable recommendations for humanitarian operations.

Based on the logistics assessment data below, provide specific, practical recommendations for humanitarian response operations.

${context}

---

Provide recommendations in the following categories:

1. **Immediate Actions** (next 24-48 hours):
   - Urgent steps to secure logistics access
   - Critical preparations needed now

2. **Short-term Planning** (next 1-2 weeks):
   - Route planning and security measures
   - Resource prepositioning
   - Infrastructure hardening

3. **Operational Risks**:
   - Key logistics vulnerabilities
   - Security considerations for transport
   - Weather-related constraints

4. **Timeline & Feasibility**:
   - Realistic timeframe for logistics operations
   - Accessibility windows (if time-sensitive)
   - Estimated lead times for supplies

**IMPORTANT GUIDELINES:**
- Be specific and actionable (e.g., "Preposition 7-day fuel supply at staging area" not "ensure fuel availability")
- Reference actual infrastructure from the data (e.g., "Use helipad at X hospital" if available)
- Quantify recommendations where possible (distances, quantities, timeframes)
- Consider the access rating (${rating}) when prioritizing recommendations
- Address both ground and air logistics
- Account for disaster and security risks mentioned in the context
- **CRITICAL: Only reference disasters that are explicitly listed in the "Active Disasters in the Region" section above. Do NOT mention any other disasters or make assumptions about disasters not in the context.**
- If no disasters are listed in the context, focus recommendations on baseline logistics preparedness and infrastructure resilience

Format your response as a JSON object with these categories as keys and arrays of recommendations as values.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert humanitarian logistics advisor specializing in access assessments and operational planning. Provide practical, specific recommendations in JSON format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 2000
  });

  const recommendationsJSON = response.choices[0].message.content.trim();
  return JSON.parse(recommendationsJSON);
}

/**
 * Generate fallback recommendations (when AI unavailable)
 */
function generateFallbackRecommendations(rating, roadNetwork, fuelAccess, airAccess) {
  const recommendations = {
    aiGenerated: false,
    'Immediate Actions': [],
    'Short-term Planning': [],
    'Operational Risks': [],
    'Timeline & Feasibility': []
  };

  // Immediate actions based on rating
  if (rating === 'CRITICAL' || rating === 'DIFFICULT') {
    recommendations['Immediate Actions'].push('Assess alternative transport methods immediately');
    recommendations['Immediate Actions'].push('Establish communication with local authorities for access coordination');
    recommendations['Immediate Actions'].push('Preposition supplies at nearest accessible location');
  }

  // Fuel access issues
  if (fuelAccess.operationalPercentage < 50) {
    recommendations['Immediate Actions'].push('Secure fuel supply for extended operations (minimum 7-day reserve)');
  }

  // Short-term planning
  if (roadNetwork.blockedRoads > 0) {
    recommendations['Short-term Planning'].push('Map alternative routes avoiding disaster-affected areas');
    recommendations['Short-term Planning'].push('Coordinate with local infrastructure teams on road status');
  }

  if (roadNetwork.criticalBridges > 0) {
    recommendations['Short-term Planning'].push(`${roadNetwork.criticalBridges} critical bridge(s) at risk - identify backup routes`);
  }

  if (airAccess.operationalCount > 0) {
    recommendations['Short-term Planning'].push('Consider air transport for urgent supplies');
  }

  // Operational risks
  recommendations['Operational Risks'].push(`Overall access rating: ${rating}`);

  if (roadNetwork.accessibilityScore < 5) {
    recommendations['Operational Risks'].push('Severe road constraints may require 4x4 vehicles or alternative transport');
  }

  if (airAccess.atRiskCount > 0) {
    recommendations['Operational Risks'].push(`${airAccess.atRiskCount} airport(s) at risk from disasters`);
  }

  // Timeline
  if (rating === 'EXCELLENT' || rating === 'GOOD') {
    recommendations['Timeline & Feasibility'].push('Logistics operations feasible within 24 hours');
  } else if (rating === 'MODERATE') {
    recommendations['Timeline & Feasibility'].push('Logistics operations feasible within 48-72 hours with planning');
  } else {
    recommendations['Timeline & Feasibility'].push('Logistics operations will require extended planning (5-7 days minimum)');
  }

  return recommendations;
}

function calculateLogisticsConfidence({ assessmentCoverage, disasters, acledEvents, weatherData, osmFeatureCount }) {
  const signals = [
    {
      label: 'Road network',
      available: assessmentCoverage.roads && osmFeatureCount > 0
    },
    {
      label: 'Fuel access',
      available: assessmentCoverage.fuel
    },
    {
      label: 'Air access',
      available: assessmentCoverage.air
    },
    {
      label: 'Disaster context',
      available: disasters.length > 0
    },
    {
      label: 'Security context',
      available: acledEvents.length > 0
    },
    {
      label: 'Weather context',
      available: Boolean(weatherData)
    }
  ];

  const availableCount = signals.filter(signal => signal.available).length;
  const totalCount = signals.length;
  const ratio = totalCount > 0 ? availableCount / totalCount : 0;

  let level = 'Low';
  if (ratio >= 0.8) level = 'High';
  else if (ratio >= 0.5) level = 'Medium';

  return {
    level,
    coverageRatio: ratio,
    availableCount,
    totalCount,
    availableSignals: signals.filter(signal => signal.available).map(signal => signal.label),
    missingSignals: signals.filter(signal => !signal.available).map(signal => signal.label),
    summary:
      level === 'High'
        ? 'Assessment uses a broad operational picture across infrastructure, disruption, and security signals.'
        : level === 'Medium'
          ? 'Assessment uses core infrastructure inputs, but some supporting signals are missing.'
          : 'Assessment is based on partial coverage and should be treated as directional only.'
  };
}

export default withRateLimit(handler);
