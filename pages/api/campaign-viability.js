import OpenAI from 'openai';
import { getDistance } from 'geolib';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facility, impacts, disasters, acledData, acledEnabled } = req.body;

    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }

    console.log('Assessing campaign viability for:', facility.name);
    if (acledData && acledEnabled) {
      console.log(`ACLED data available: ${acledData.length} events, enabled: ${acledEnabled}`);
    }

    // Calculate viability score and identify risks
    const assessment = calculateViability(facility, impacts || [], disasters || []);

    // Add security assessment if location data available
    if (facility.country || facility.region || facility.district) {
      try {
        const securityResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/security-assessment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facility,
            acledData: acledEnabled ? acledData : null,
            acledEnabled
          })
        });

        if (securityResponse.ok) {
          const securityData = await securityResponse.json();
          assessment.securityAssessment = securityData;

          // Adjust viability score based on security level
          if (securityData.securityLevel === 'CRITICAL') {
            assessment.viabilityScore = Math.max(0, assessment.viabilityScore - 40);
            assessment.risks.push({
              factor: 'Critical Security Risk',
              severity: 'CRITICAL',
              detail: 'Area assessed as critical security risk - campaign operations may be unsafe',
              icon: '🚨'
            });
          } else if (securityData.securityLevel === 'HIGH') {
            assessment.viabilityScore = Math.max(0, assessment.viabilityScore - 25);
            assessment.risks.push({
              factor: 'High Security Risk',
              severity: 'HIGH',
              detail: 'Elevated security concerns requiring enhanced protocols',
              icon: '⚠️'
            });
          } else if (securityData.securityLevel === 'MEDIUM') {
            assessment.viabilityScore = Math.max(0, assessment.viabilityScore - 10);
            assessment.risks.push({
              factor: 'Moderate Security Risk',
              severity: 'MEDIUM',
              detail: 'Standard security precautions required',
              icon: '🔒'
            });
          }

          // Recalculate decision based on new score
          assessment.decision = getDecision(assessment.viabilityScore);
        }
      } catch (securityError) {
        console.error('Error fetching security assessment:', securityError);
        // Continue without security assessment
      }
    }

    // Generate AI recommendations if OpenAI is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const aiRecommendations = await generateAIRecommendations(facility, assessment, impacts, disasters);
        assessment.aiRecommendations = aiRecommendations;
        assessment.isAIGenerated = true;
      } catch (aiError) {
        console.error('Error generating AI recommendations:', aiError);
        // Continue with basic assessment without AI
        assessment.aiRecommendations = generateBasicRecommendations(assessment);
        assessment.isAIGenerated = false;
      }
    } else {
      assessment.aiRecommendations = generateBasicRecommendations(assessment);
      assessment.isAIGenerated = false;
    }

    res.status(200).json(assessment);
  } catch (error) {
    console.error('Error in campaign viability assessment:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Calculate campaign viability score based on multiple factors
 */
function calculateViability(facility, impacts, disasters) {
  let viabilityScore = 100;
  const risks = [];
  const mitigationStrategies = [];

  // Factor 1: Disaster Proximity and Severity
  if (impacts && impacts.length > 0) {
    for (const impact of impacts) {
      const distance = impact.distance || 0;
      const disaster = impact.disaster;
      const disasterType = disaster.eventType?.toUpperCase() || 'UNKNOWN';
      const alertLevel = disaster.alertLevel?.toLowerCase() || 'unknown';

      // Critical proximity (< 10km)
      if (distance < 10) {
        viabilityScore -= 40;
        risks.push({
          factor: 'Disaster Proximity',
          severity: 'CRITICAL',
          detail: `${getDisasterName(disasterType)} only ${distance}km away`,
          icon: '🔴',
          disasterType: disasterType
        });
        mitigationStrategies.push({
          risk: 'Disaster Proximity',
          strategy: `Postpone campaign until ${getDisasterName(disasterType)} threat subsides. Monitor situation daily.`
        });
      }
      // High risk proximity (10-50km)
      else if (distance < 50) {
        viabilityScore -= 20;
        risks.push({
          factor: 'Disaster Proximity',
          severity: 'HIGH',
          detail: `${getDisasterName(disasterType)} ${distance}km away - may impact operations`,
          icon: '🟠',
          disasterType: disasterType
        });
        mitigationStrategies.push({
          risk: 'Disaster Proximity',
          strategy: 'Proceed with caution. Have evacuation plan ready and monitor disaster progression.'
        });
      }
      // Medium risk proximity (50-100km)
      else if (distance < 100) {
        viabilityScore -= 10;
        risks.push({
          factor: 'Disaster Proximity',
          severity: 'MEDIUM',
          detail: `${getDisasterName(disasterType)} ${distance}km away - monitor closely`,
          icon: '🟡',
          disasterType: disasterType
        });
      }

      // Alert level considerations
      if (alertLevel === 'red') {
        viabilityScore -= 25;
        risks.push({
          factor: 'High Alert Level',
          severity: 'CRITICAL',
          detail: `RED alert for ${getDisasterName(disasterType)} - severe conditions`,
          icon: '🔴',
          disasterType: disasterType
        });
      } else if (alertLevel === 'orange') {
        viabilityScore -= 15;
        risks.push({
          factor: 'Elevated Alert Level',
          severity: 'HIGH',
          detail: `ORANGE alert for ${getDisasterName(disasterType)} - heightened risk`,
          icon: '🟠',
          disasterType: disasterType
        });
      }

      // Disaster-specific risks
      addDisasterSpecificRisks(disasterType, risks, mitigationStrategies, distance);
    }
  }

  // Factor 2: Cold Chain Risk (for immunization campaigns)
  const coldChainRisk = assessColdChainRisk(facility, impacts, disasters);
  if (coldChainRisk.risk > 0) {
    viabilityScore -= coldChainRisk.score;
    risks.push(coldChainRisk.riskData);
    mitigationStrategies.push(coldChainRisk.mitigation);
  }

  // Factor 3: Access and Infrastructure
  const accessRisk = assessAccessRisk(facility, impacts, disasters);
  if (accessRisk.risk > 0) {
    viabilityScore -= accessRisk.score;
    risks.push(accessRisk.riskData);
    mitigationStrategies.push(accessRisk.mitigation);
  }

  // Factor 4: Population Displacement
  const displacementRisk = assessPopulationDisplacement(facility, impacts, disasters);
  if (displacementRisk.risk > 0) {
    viabilityScore -= displacementRisk.score;
    risks.push(displacementRisk.riskData);
    mitigationStrategies.push(displacementRisk.mitigation);
  }

  // Factor 5: Staff Safety
  const safetyRisk = assessStaffSafety(facility, impacts, disasters);
  if (safetyRisk.risk > 0) {
    viabilityScore -= safetyRisk.score;
    risks.push(safetyRisk.riskData);
    mitigationStrategies.push(safetyRisk.mitigation);
  }

  // Ensure score doesn't go below 0
  viabilityScore = Math.max(0, viabilityScore);

  // Determine decision
  const decision = getDecision(viabilityScore);
  const timeline = estimateTimeline(viabilityScore, risks);

  return {
    viabilityScore,
    decision,
    risks,
    mitigationStrategies,
    timeline,
    alternativeSites: [], // Will be populated by AI or separate logic
    facilityName: facility.name
  };
}

/**
 * Add disaster-specific risks for public health campaigns
 */
function addDisasterSpecificRisks(disasterType, risks, mitigations, distance) {
  switch (disasterType) {
    case 'FL': // Flooding
      risks.push({
        factor: 'Waterborne Disease Risk',
        severity: 'HIGH',
        detail: 'Post-flood conditions create mosquito breeding sites - expect 40-60% increase in malaria cases',
        icon: '🦟',
        disasterType: 'FL'
      });
      risks.push({
        factor: 'Water Contamination',
        severity: 'HIGH',
        detail: 'Contaminated water sources increase diarrheal disease risk',
        icon: '💧',
        disasterType: 'FL'
      });
      mitigations.push({
        risk: 'Waterborne Disease Risk',
        strategy: 'Increase ACT/RDT stock by 50%. Coordinate with WASH team for vector control. Consider prophylaxis for high-risk populations.'
      });
      break;

    case 'TC': // Tropical Cyclone
      risks.push({
        factor: 'Infrastructure Damage',
        severity: 'CRITICAL',
        detail: 'Cyclones typically damage health facilities, roads, and communication networks',
        icon: '🌀',
        disasterType: 'TC'
      });
      mitigations.push({
        risk: 'Infrastructure Damage',
        strategy: 'Conduct facility assessment before campaign. Use mobile teams if fixed sites damaged. Bring backup communication equipment.'
      });
      break;

    case 'EQ': // Earthquake
      risks.push({
        factor: 'Structural Safety',
        severity: 'CRITICAL',
        detail: 'Buildings may be unsafe. Aftershocks possible.',
        icon: '🏚️',
        disasterType: 'EQ'
      });
      risks.push({
        factor: 'Healthcare System Strain',
        severity: 'HIGH',
        detail: 'Local health system overwhelmed with trauma cases',
        icon: '🏥',
        disasterType: 'EQ'
      });
      mitigations.push({
        risk: 'Structural Safety',
        strategy: 'Conduct building safety assessment. Use outdoor vaccination posts or temporary structures. Have earthquake evacuation plan.'
      });
      break;

    case 'DR': // Drought
      risks.push({
        factor: 'Malnutrition Risk',
        severity: 'HIGH',
        detail: 'Drought conditions lead to malnutrition, reducing vaccine efficacy',
        icon: '🌾',
        disasterType: 'DR'
      });
      risks.push({
        factor: 'Population Migration',
        severity: 'MEDIUM',
        detail: 'Communities may migrate in search of water/food',
        icon: '👥',
        disasterType: 'DR'
      });
      mitigations.push({
        risk: 'Malnutrition Risk',
        strategy: 'Integrate vitamin A supplementation and nutrition screening. Partner with food security programs.'
      });
      break;

    case 'VO': // Volcanic Activity
      risks.push({
        factor: 'Air Quality Hazard',
        severity: 'HIGH',
        detail: 'Volcanic ash causes respiratory issues - complicates vaccination',
        icon: '🌋',
        disasterType: 'VO'
      });
      mitigations.push({
        risk: 'Air Quality Hazard',
        strategy: 'Provide N95 masks for staff and community. Monitor air quality. Consider indoor-only activities.'
      });
      break;

    case 'WF': // Wildfire
      risks.push({
        factor: 'Air Quality & Smoke',
        severity: 'HIGH',
        detail: 'Smoke inhalation risk, especially for children and vulnerable populations',
        icon: '🔥',
        disasterType: 'WF'
      });
      mitigations.push({
        risk: 'Air Quality & Smoke',
        strategy: 'Monitor air quality index. Postpone if AQI > 150. Provide masks and indoor venues.'
      });
      break;
  }
}

/**
 * Assess cold chain risk for vaccine storage
 */
function assessColdChainRisk(facility, impacts, disasters) {
  // Check for power outage risks
  const hasPowerRisk = impacts.some(impact => {
    const type = impact.disaster?.eventType?.toUpperCase();
    return ['EQ', 'TC', 'FL'].includes(type) && impact.distance < 50;
  });

  if (hasPowerRisk) {
    return {
      risk: 1,
      score: 35,
      riskData: {
        factor: 'Cold Chain Compromise',
        severity: 'CRITICAL',
        detail: 'Power outage risk threatens vaccine storage. Potency loss possible within 24-48 hours.',
        icon: '❄️'
      },
      mitigation: {
        risk: 'Cold Chain Compromise',
        strategy: 'Pre-position vaccines at unaffected facility. Bring ice packs and vaccine carriers. Check generator fuel. Have cold chain monitor devices.'
      }
    };
  }

  return { risk: 0, score: 0 };
}

/**
 * Assess access and infrastructure risks
 */
function assessAccessRisk(facility, impacts, disasters) {
  // Check for road blockage risks
  const hasAccessRisk = impacts.some(impact => {
    const type = impact.disaster?.eventType?.toUpperCase();
    const distance = impact.distance || 0;
    // Floods, landslides, earthquakes commonly block roads
    return ['FL', 'EQ', 'TC'].includes(type) && distance < 30;
  });

  if (hasAccessRisk) {
    return {
      risk: 1,
      score: 30,
      riskData: {
        factor: 'Access Constraints',
        severity: 'HIGH',
        detail: 'Roads may be impassable due to flooding, debris, or structural damage',
        icon: '🚧'
      },
      mitigation: {
        risk: 'Access Constraints',
        strategy: 'Scout alternative routes. Use 4x4 vehicles or motorcycles. Consider postponing until roads cleared. Deploy mobile teams if facility unreachable.'
      }
    };
  }

  return { risk: 0, score: 0 };
}

/**
 * Assess population displacement
 */
function assessPopulationDisplacement(facility, impacts, disasters) {
  // Estimate displacement based on disaster type and proximity
  const severeImpacts = impacts.filter(impact => {
    const type = impact.disaster?.eventType?.toUpperCase();
    const distance = impact.distance || 0;
    return distance < 20 && ['FL', 'TC', 'EQ', 'VO'].includes(type);
  });

  if (severeImpacts.length > 0) {
    const estimatedDisplacement = 35; // Rough estimate

    return {
      risk: 1,
      score: 25,
      riskData: {
        factor: 'Population Displacement',
        severity: 'HIGH',
        detail: `~${estimatedDisplacement}% of target population may have fled to safer areas or IDP camps`,
        icon: '🏕️'
      },
      mitigation: {
        risk: 'Population Displacement',
        strategy: 'Deploy mobile teams to IDP camps and displacement sites. Coordinate with camp managers. Adjust target numbers. Track population movements.'
      }
    };
  }

  return { risk: 0, score: 0 };
}

/**
 * Assess staff safety concerns
 */
function assessStaffSafety(facility, impacts, disasters) {
  const hasOngoingHazard = impacts.some(impact => {
    const type = impact.disaster?.eventType?.toUpperCase();
    const distance = impact.distance || 0;
    // Aftershocks, ongoing eruptions, active cyclones
    return distance < 50 && ['EQ', 'VO', 'TC'].includes(type);
  });

  if (hasOngoingHazard) {
    return {
      risk: 1,
      score: 20,
      riskData: {
        factor: 'Staff Safety Concerns',
        severity: 'MEDIUM',
        detail: 'Aftershocks, ongoing hazards, or unstable conditions pose risks to campaign teams',
        icon: '⚠️'
      },
      mitigation: {
        risk: 'Staff Safety Concerns',
        strategy: 'Provide safety briefing and PPE. Establish check-in protocols (hourly). Have evacuation plan. Ensure teams have communication equipment. Consider hazard pay.'
      }
    };
  }

  return { risk: 0, score: 0 };
}

/**
 * Determine GO/NO-GO decision based on score
 */
function getDecision(score) {
  if (score >= 70) return 'GO';
  if (score >= 40) return 'PROCEED WITH CAUTION';
  if (score >= 20) return 'DELAY RECOMMENDED';
  return 'DO NOT PROCEED';
}

/**
 * Estimate timeline for safe campaign execution
 */
function estimateTimeline(score, risks) {
  if (score >= 70) {
    return {
      recommendation: 'Proceed immediately',
      waitTime: '0 days',
      rationale: 'Conditions are favorable for campaign execution'
    };
  }

  if (score >= 40) {
    return {
      recommendation: 'Proceed with enhanced precautions',
      waitTime: '3-7 days',
      rationale: 'Wait for initial situation to stabilize. Reassess conditions in 3 days.'
    };
  }

  if (score >= 20) {
    return {
      recommendation: 'Delay campaign',
      waitTime: '2-3 weeks',
      rationale: 'Significant risks present. Wait for disaster impacts to subside and conditions to improve.'
    };
  }

  return {
    recommendation: 'Postpone campaign',
    waitTime: '1-2 months',
    rationale: 'Severe risks make campaign unsafe or ineffective. Major recovery needed before proceeding.'
  };
}

/**
 * Get human-readable disaster name
 */
function getDisasterName(code) {
  const names = {
    'EQ': 'Earthquake',
    'TC': 'Tropical Cyclone',
    'FL': 'Flood',
    'VO': 'Volcanic Activity',
    'DR': 'Drought',
    'WF': 'Wildfire',
    'TS': 'Tsunami'
  };
  return names[code] || code;
}

/**
 * Generate AI-powered recommendations using OpenAI with AMP best practices
 */
async function generateAIRecommendations(facility, assessment, impacts, disasters) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const disastersInfo = disasters.map(d => ({
    type: d.eventType,
    name: d.title,
    alertLevel: d.alertLevel,
    severity: d.severity
  }));

  const prompt = `You are a public health campaign planning expert specializing in malaria control and immunization programs in disaster-affected areas. You follow Alliance for Malaria Prevention (AMP) best practices and WHO guidelines.

FACILITY: ${facility.name}
VIABILITY SCORE: ${assessment.viabilityScore}/100
DECISION: ${assessment.decision}

IDENTIFIED RISKS:
${assessment.risks.map(r => `- ${r.severity}: ${r.factor} - ${r.detail}`).join('\n')}

FACILITY DETAILS:
${JSON.stringify(facility, null, 2)}

DISASTERS AFFECTING AREA:
${disastersInfo.map(d => `- ${d.type}: ${d.name} (Alert: ${d.alertLevel})`).join('\n')}

PRELIMINARY MITIGATION STRATEGIES:
${assessment.mitigationStrategies.map(m => `- ${m.risk}: ${m.strategy}`).join('\n')}

TIMELINE: ${assessment.timeline.recommendation} (${assessment.timeline.waitTime})

Provide detailed, actionable recommendations for this campaign:

1. **Clear Decision**: Confirm or refine the GO/NO-GO/DELAY recommendation with specific justification
2. **Mitigation Actions**: Specific steps to address each risk (be very specific - mention supplies, staff, protocols)
3. **Timeline Details**: When exactly should they proceed? What conditions to monitor?
4. **Resource Adjustments**: Extra supplies, staff, transport, or equipment needed
5. **Alternative Approaches**: If primary facility unsafe, suggest alternatives (mobile teams, nearby facilities, etc.)
6. **Program-Specific Considerations**:
   - For malaria campaigns:
     * ACT/RDT needs (50% increase after floods)
     * LLIN/ITN distribution strategy (mass campaign vs routine vs school-based)
     * Vector control coordination with WASH teams
     * Expected case surge (40-60% post-flood)
     * Supply chain considerations (pre-positioning, barcode tracking)
   - For immunization: Consider cold chain, target populations, vaccine types
7. **Assessment Planning** (AMP cLQAS methodology):
   - Recommend in-process or end-process evaluation
   - Suggest rapid assessment if campaign delayed
   - Include household registration quality checks
   - Coverage assessment using clustered LQAS
8. **Digital Tools** (if applicable):
   - Mobile data collection (Android BYOD approach)
   - Geospatial microplanning for targeting
   - Barcode scanning for supply chain tracking
   - Real-time monitoring dashboards
   - Electronic payment systems for workers

Be concrete and actionable. Use bullet points. Focus on practical field operations following AMP guidance.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in public health campaign planning during disasters. You follow Alliance for Malaria Prevention (AMP) best practices, including cLQAS assessment procedures, digital tools for campaign monitoring, and emergency response protocols for ITN/LLIN distribution. Provide specific, actionable recommendations for field operations.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  return response.choices[0].message.content;
}

/**
 * Generate basic recommendations without AI
 */
function generateBasicRecommendations(assessment) {
  let recommendations = `## Campaign Viability Assessment\n\n`;
  recommendations += `**Decision**: ${assessment.decision}\n`;
  recommendations += `**Viability Score**: ${assessment.viabilityScore}/100\n\n`;

  recommendations += `### Timeline\n`;
  recommendations += `- ${assessment.timeline.recommendation}\n`;
  recommendations += `- Wait time: ${assessment.timeline.waitTime}\n`;
  recommendations += `- Rationale: ${assessment.timeline.rationale}\n\n`;

  recommendations += `### Mitigation Strategies\n`;
  assessment.mitigationStrategies.forEach(m => {
    recommendations += `**${m.risk}**\n`;
    recommendations += `- ${m.strategy}\n\n`;
  });

  return recommendations;
}
