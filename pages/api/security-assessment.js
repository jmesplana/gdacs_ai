import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';
import { getDistance } from 'geolib';

/**
 * Security Risk Assessment API
 * Analyzes security risks for humanitarian operations based on facility location
 * Uses ACLED data when available, falls back to AI knowledge
 */
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
    const { facility, acledData, acledEnabled } = req.body;

    if (!facility || !facility.name || !facility.latitude || !facility.longitude) {
      return res.status(400).json({ error: 'Missing facility data' });
    }

    console.log('Assessing security risks for:', facility.name);

    // If ACLED data is available and enabled, use it for precise analysis
    if (acledData && acledEnabled && acledData.length > 0) {
      console.log(`Using ACLED data: ${acledData.length} events`);
      const assessment = await generateAcledBasedAssessment(facility, acledData);
      res.status(200).json(assessment);
    } else {
      // Fall back to AI-only assessment
      console.log('Using AI-only assessment (no ACLED data)');

      if (!process.env.OPENAI_API_KEY) {
        return res.status(200).json({
          securityLevel: 'UNKNOWN',
          risks: [],
          recommendations: 'Security assessment requires AI capabilities to be configured.',
          isAIGenerated: false
        });
      }

      const assessment = await generateAIOnlyAssessment(facility);
      res.status(200).json(assessment);
    }
  } catch (error) {
    console.error('Error in security assessment:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Generate ACLED-based security assessment with AI enhancement
 */
async function generateAcledBasedAssessment(facility, acledData) {
  const { latitude, longitude } = facility;

  // Define proximity zones
  const zones = [
    { name: '0-10 km', min: 0, max: 10, weight: 5 },
    { name: '10-25 km', min: 10, max: 25, weight: 3 },
    { name: '25-50 km', min: 25, max: 50, weight: 2 },
    { name: '50-100 km', min: 50, max: 100, weight: 1 }
  ];

  // Calculate incidents in each zone
  const incidentsByZone = zones.map(zone => ({
    ...zone,
    incidents: []
  }));

  const allNearbyIncidents = [];

  // Filter for recent events (last 60 days by default)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  acledData.forEach(event => {
    const eventDate = new Date(event.event_date);
    if (eventDate < sixtyDaysAgo) return; // Skip old events

    const distance = getDistance(
      { latitude, longitude },
      { latitude: event.latitude, longitude: event.longitude }
    ) / 1000; // Convert to km

    // Find which zone this incident belongs to
    for (let zone of incidentsByZone) {
      if (distance >= zone.min && distance < zone.max) {
        zone.incidents.push({ ...event, distance });
        allNearbyIncidents.push({ ...event, distance });
        break;
      }
    }
  });

  // Count incidents by type
  const incidentsByType = {};
  const actorCount = {};
  let totalFatalities = 0;

  allNearbyIncidents.forEach(incident => {
    const type = incident.event_type;
    incidentsByType[type] = (incidentsByType[type] || 0) + 1;
    totalFatalities += incident.fatalities || 0;

    // Track actors
    if (incident.actor1) {
      actorCount[incident.actor1] = (actorCount[incident.actor1] || 0) + 1;
    }
  });

  // Calculate risk score (0-100)
  let riskScore = 0;

  incidentsByZone.forEach(zone => {
    const count = zone.incidents.length;
    riskScore += count * zone.weight;
  });

  // Add fatality weight
  riskScore += totalFatalities * 0.5;

  // Determine security level based on risk score
  let securityLevel = 'LOW';
  if (riskScore >= 100) {
    securityLevel = 'CRITICAL';
  } else if (riskScore >= 50) {
    securityLevel = 'HIGH';
  } else if (riskScore >= 20) {
    securityLevel = 'MEDIUM';
  }

  // Find most active actors
  const topActors = Object.entries(actorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([actor, count]) => ({ actor, count }));

  // Generate AI-enhanced recommendations if API key available
  let aiRecommendations = '';
  let isAIGenerated = false;

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const acledSummary = `
REAL-TIME ACLED DATA ANALYSIS (Last 60 days):
- Total incidents within 100km: ${allNearbyIncidents.length}
- 0-10km: ${incidentsByZone[0].incidents.length} incidents (IMMEDIATE THREAT)
- 10-25km: ${incidentsByZone[1].incidents.length} incidents
- 25-50km: ${incidentsByZone[2].incidents.length} incidents
- 50-100km: ${incidentsByZone[3].incidents.length} incidents
- Total fatalities: ${totalFatalities}

Incident Types:
${Object.entries(incidentsByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Most Active Armed Groups/Actors:
${topActors.map(({ actor, count }) => `- ${actor}: ${count} incidents`).join('\n')}

Calculated Risk Score: ${riskScore.toFixed(1)}/100
Determined Security Level: ${securityLevel}
`;

      const prompt = `You are a security analyst for humanitarian health operations. Based on this REAL ACLED conflict data, provide operational security guidance.

FACILITY: ${facility.name}
LOCATION: ${facility.latitude}, ${facility.longitude}
${facility.country ? `COUNTRY: ${facility.country}` : ''}
${facility.region ? `REGION: ${facility.region}` : ''}
${facility.type ? `FACILITY TYPE: ${facility.type}` : ''}
${facility.description ? `FACILITY DESCRIPTION: ${facility.description}` : ''}

${acledSummary}

Use this neutral humanitarian operational security checklist when framing your assessment:
- Security: hospital and staff exposure to hostilities or military targets, building protection, banditry / hostage-taking risk, and patient safety
- Access: evacuation time, road and checkpoint safety, transport availability, first-aid-post feasibility, and logistics constraints
- Infrastructure: structural integrity, expansion potential, temporary structures, utilities, kitchen, laundry, residence, and warehouse
- Personnel: local and expatriate staffing, neutrality concerns, competence, language issues, and support functions

Provide:
1. **Operational Security Framework**: Under headings Security, Access, Infrastructure, Personnel, say what the ACLED evidence suggests and what still needs field verification
2. **Operational Implications**: How these incidents affect operations
3. **Specific Threats**: Based on event types and actors present
4. **Mitigation Strategies**: Concrete security protocols needed
5. **Movement Restrictions**: Safe times/routes based on incident patterns
6. **Liaison Requirements**: Which actors/authorities to coordinate with
7. **Go/No-Go Recommendation**: Can the operation proceed? Under what conditions?

Be specific and actionable. Reference the actual incident data provided.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a security analyst for humanitarian operations. You have real ACLED conflict data. Provide specific, actionable guidance based on the actual incidents reported.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1200
      });

      aiRecommendations = response.choices[0].message.content;
      isAIGenerated = true;
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      aiRecommendations = 'AI recommendations unavailable. See ACLED data summary below.';
    }
  }

  // Build detailed assessment
  const securityFramework = buildSecurityFramework({
    facility,
    securityLevel,
    riskScore,
    allNearbyIncidents,
    incidentsByZone,
    incidentsByType,
    totalFatalities,
    topActors,
    dataSource: 'ACLED'
  });

  const assessment = {
    facilityName: facility.name,
    securityLevel: securityLevel,
    riskScore: Math.round(riskScore),
    dataSource: 'ACLED',
    timeframe: 'Last 60 days',
    incidentsNearby: allNearbyIncidents.length,
    incidentsByZone: incidentsByZone.map(z => ({
      zone: z.name,
      count: z.incidents.length,
      severity: z.incidents.length === 0 ? 'NONE' :
                z.incidents.length < 5 ? 'LOW' :
                z.incidents.length < 15 ? 'MEDIUM' :
                z.incidents.length < 30 ? 'HIGH' : 'CRITICAL'
    })),
    incidentsByType,
    totalFatalities,
    topActors,
    closestIncident: allNearbyIncidents.length > 0 ? {
      distance: allNearbyIncidents[0].distance.toFixed(1),
      type: allNearbyIncidents[0].event_type,
      date: allNearbyIncidents[0].event_date,
      location: allNearbyIncidents[0].location
    } : null,
    assessment: formatAcledAssessment(
      securityLevel,
      allNearbyIncidents.length,
      incidentsByZone,
      incidentsByType,
      topActors,
      totalFatalities,
      securityFramework,
      aiRecommendations
    ),
    securityFramework,
    isAIGenerated,
    timestamp: new Date().toISOString(),
    note: `Security assessment based on ${allNearbyIncidents.length} ACLED incidents within 100km from the last 60 days.`
  };

  return assessment;
}

/**
 * Format ACLED assessment into readable text
 */
function formatAcledAssessment(securityLevel, totalIncidents, zones, incidentsByType, actors, fatalities, securityFramework, aiRecommendations) {
  let assessment = `## Security Level: **${securityLevel}**\n\n`;

  assessment += `### ACLED Data Summary (Last 60 Days)\n\n`;
  assessment += `**Total Security Incidents within 100km:** ${totalIncidents}\n\n`;

  if (totalIncidents === 0) {
    assessment += `✅ **No conflict events recorded in the vicinity.** This area shows no recent security incidents in ACLED data.\n\n`;
    assessment += `**Recommendation:** Proceed with standard security protocols. Monitor for emerging threats.\n\n`;
    return assessment;
  }

  assessment += `**Proximity Analysis:**\n`;
  zones.forEach(zone => {
    if (zone.count > 0) {
      const icon = zone.severity === 'CRITICAL' ? '🔴' :
                   zone.severity === 'HIGH' ? '🟠' :
                   zone.severity === 'MEDIUM' ? '🟡' : '🟢';
      assessment += `- ${icon} ${zone.zone}: **${zone.count} incidents** (${zone.severity} risk)\n`;
    }
  });

  assessment += `\n**Total Fatalities:** ${fatalities}\n\n`;

  assessment += `### Incident Types\n\n`;
  Object.entries(incidentsByType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      assessment += `- **${type}**: ${count} incidents\n`;
    });

  if (actors.length > 0) {
    assessment += `\n### Most Active Armed Groups/Actors\n\n`;
    actors.forEach(({ actor, count }) => {
      assessment += `- ${actor}: ${count} incidents\n`;
    });
  }

  if (securityFramework?.sections?.length) {
    assessment += `\n### Operational Security Framework\n\n`;
    securityFramework.sections.forEach(section => {
      assessment += `**${section.title}**\n`;
      section.items.forEach(item => {
        assessment += `- ${item.label}: ${item.status}${item.detail ? ` - ${item.detail}` : ''}\n`;
      });
      assessment += `\n`;
    });
  }

  if (aiRecommendations) {
    assessment += `\n### AI-Enhanced Operational Guidance\n\n`;
    assessment += aiRecommendations;
  }

  return assessment;
}

/**
 * Generate AI-only security assessment (fallback when no ACLED data)
 */
async function generateAIOnlyAssessment(facility) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `You are a security analyst specializing in humanitarian operations in complex environments. Analyze the security situation for health operations.

FACILITY: ${facility.name}
LOCATION: ${facility.latitude}, ${facility.longitude}
COUNTRY: ${facility.country || 'Unknown'}
${facility.region ? `REGION: ${facility.region}` : ''}
${facility.district ? `DISTRICT: ${facility.district}` : ''}
${facility.type ? `FACILITY TYPE: ${facility.type}` : ''}
${facility.description ? `FACILITY DESCRIPTION: ${facility.description}` : ''}

Use this neutral humanitarian operational security checklist when assessing the site:
- Hospital and staff security concerns: proximity to hostilities or military targets, local environment, and likely fighting developments
- Building type and protection: number of storeys, ground floor exposure, underground space, cellar, bomb shelter, tents, temporary structures
- Incidence of banditry, hostage-taking, checkpoints, and criminality
- Patient safety inside the facility and after discharge
- Access: distance, evacuation time, roads, vehicles, air evacuation, checkpoint safety, and first-aid-post feasibility
- Infrastructure: structural integrity, expansion potential, water, sanitation, electricity, kitchen, laundry, staff residence, warehouse
- Personnel: availability, neutrality concerns, competence, language needs, and support staff requirements

Based on your knowledge of security situations, conflict zones, and access constraints (updated to January 2025), provide a security risk assessment with these sections:

1. **Security Level**: Rate as LOW, MEDIUM, HIGH, or CRITICAL
2. **Operational Security Framework**: Under headings Security, Access, Infrastructure, Personnel, state what is known, what is unknown, and what requires field verification
3. **Identified Security Risks**: List specific security concerns
4. **Operational Implications**: How these risks affect operations
5. **Mitigation Strategies**: Specific recommendations
6. **Go/No-Go Recommendation**: Can the operation proceed? Under what conditions?

Format your response in clear sections with bullet points. Be specific and actionable.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are a security analyst for humanitarian operations. Provide specific, actionable security assessments based on location data.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 1500
  });

  const aiResponse = response.choices[0].message.content;

  // Parse the security level from response
  let securityLevel = 'MEDIUM'; // default
  if (aiResponse.toLowerCase().includes('security level: critical') || aiResponse.toLowerCase().includes('security level:** critical')) {
    securityLevel = 'CRITICAL';
  } else if (aiResponse.toLowerCase().includes('security level: high') || aiResponse.toLowerCase().includes('security level:** high')) {
    securityLevel = 'HIGH';
  } else if (aiResponse.toLowerCase().includes('security level: low') || aiResponse.toLowerCase().includes('security level:** low')) {
    securityLevel = 'LOW';
  }

  const securityFramework = buildSecurityFramework({
    facility,
    securityLevel,
    riskScore: null,
    allNearbyIncidents: [],
    incidentsByZone: [],
    incidentsByType: {},
    totalFatalities: 0,
    topActors: [],
    dataSource: 'AI Knowledge'
  });

  return {
    facilityName: facility.name,
    securityLevel: securityLevel,
    assessment: aiResponse,
    securityFramework,
    dataSource: 'AI Knowledge',
    isAIGenerated: true,
    timestamp: new Date().toISOString(),
    note: 'Security assessment based on AI analysis of known conflict zones. For real-time data, upload ACLED conflict data.'
  };
}

function buildSecurityFramework({
  facility,
  securityLevel,
  riskScore,
  allNearbyIncidents = [],
  incidentsByZone = [],
  incidentsByType = {},
  totalFatalities = 0,
  topActors = [],
  dataSource = 'AI Knowledge'
}) {
  const immediateZone = incidentsByZone.find(zone => zone.name === '0-10 km');
  const nearZone = incidentsByZone.find(zone => zone.name === '10-25 km');
  const directThreatCount = immediateZone?.incidents?.length || 0;
  const nearbyThreatCount = nearZone?.incidents?.length || 0;
  const hasViolentEvents = Object.entries(incidentsByType).some(([type, count]) => {
    const normalized = String(type || '').toLowerCase();
    return count > 0 && (
      normalized.includes('violence') ||
      normalized.includes('battle') ||
      normalized.includes('explosion') ||
      normalized.includes('remote violence') ||
      normalized.includes('riots')
    );
  });
  const buildingDescriptor = [facility.type, facility.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hasProtectedStructureHint = ['underground', 'cellar', 'shelter', 'bunker'].some(term => buildingDescriptor.includes(term));
  const isTemporaryStructure = ['tent', 'temporary', 'prefab', 'prefabricated'].some(term => buildingDescriptor.includes(term));

  return {
    framework: 'humanitarian operational security framework',
    dataSource,
    sections: [
      {
        key: 'security',
        title: 'Security',
        items: [
          {
            label: 'Hospital and staff security',
            status: securityLevel,
            detail: directThreatCount > 0
              ? `${directThreatCount} incidents within 10km and ${nearbyThreatCount} within 10-25km indicate direct exposure to hostilities.`
              : allNearbyIncidents.length > 0
                ? `${allNearbyIncidents.length} incidents within 100km require route and site-specific movement controls.`
                : 'No recent ACLED incidents in the immediate vicinity; maintain routine monitoring.'
          },
          {
            label: 'Building protection profile',
            status: hasProtectedStructureHint ? 'PARTIAL' : 'UNKNOWN',
            detail: hasProtectedStructureHint
              ? 'Facility description suggests some protected space, but structural survivability still needs field verification.'
              : isTemporaryStructure
                ? 'Facility appears to rely on temporary structures, which increases blast and weather vulnerability.'
                : 'No reliable data on storeys, hardened areas, cellar, or shelter capacity.'
          },
          {
            label: 'Banditry / hostage-taking / criminal threats',
            status: hasViolentEvents || totalFatalities > 0 ? 'ELEVATED' : 'UNKNOWN',
            detail: topActors.length > 0
              ? `Conflict actor presence is documented nearby. Top actors: ${topActors.slice(0, 3).map(actor => actor.actor).join(', ')}.`
              : 'Current inputs do not specifically identify banditry or kidnapping patterns.'
          },
          {
            label: 'Patient safety',
            status: securityLevel === 'CRITICAL' || securityLevel === 'HIGH' ? 'HIGH RISK' : securityLevel === 'MEDIUM' ? 'MODERATE RISK' : 'LOW RISK',
            detail: securityLevel === 'CRITICAL' || securityLevel === 'HIGH'
              ? 'Patient movement, admission surge, and discharge routes should be treated as controlled-security issues.'
              : 'Patient flow appears manageable, but discharge route safety still requires local validation.'
          }
        ]
      },
      {
        key: 'access',
        title: 'Access',
        items: [
          {
            label: 'Distance and evacuation time',
            status: 'UNKNOWN',
            detail: 'Not calculated in this endpoint. Pair with logistics assessment for route distance, road condition, and medevac feasibility.'
          },
          {
            label: 'Roads, checkpoints, and movement safety',
            status: allNearbyIncidents.length > 0 ? 'REQUIRES REVIEW' : 'PARTIAL',
            detail: allNearbyIncidents.length > 0
              ? 'Conflict activity nearby raises checkpoint and route-security concerns; validate movement windows before deployment.'
              : 'No incident signal here, but checkpoint risk still depends on local authorities and armed actor control.'
          },
          {
            label: 'First-aid post network feasibility',
            status: 'UNKNOWN',
            detail: 'Requires operational design input and facility catchment mapping.'
          }
        ]
      },
      {
        key: 'infrastructure',
        title: 'Infrastructure',
        items: [
          {
            label: 'Structural integrity and expansion potential',
            status: facility.type || facility.description ? 'PARTIAL' : 'UNKNOWN',
            detail: facility.type || facility.description
              ? `Available metadata: ${[facility.type, facility.description].filter(Boolean).join(' | ')}`
              : 'No building assessment data on integrity, expansion space, or adaptive reuse.'
          },
          {
            label: 'Utilities and essential services',
            status: 'UNKNOWN',
            detail: 'Water, sanitation, electricity, kitchen, laundry, residence, and warehouse capacity are not captured in this endpoint.'
          }
        ]
      },
      {
        key: 'personnel',
        title: 'Personnel',
        items: [
          {
            label: 'Local and expatriate staffing availability',
            status: 'UNKNOWN',
            detail: 'No staffing roster, surge profile, or support-function coverage in current facility payload.'
          },
          {
            label: 'Neutrality, competence, and language support',
            status: 'UNKNOWN',
            detail: 'Recruitment neutrality, credentials, translators, and support staff need separate field validation.'
          }
        ]
      }
    ],
    summary: {
      securityLevel,
      riskScore,
      incidentsNearby: allNearbyIncidents.length,
      totalFatalities
    }
  };
}

export default withRateLimit(handler);
