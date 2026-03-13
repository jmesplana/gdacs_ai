import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';
import { getDistance } from 'geolib';
import { getOperationType } from '../../config/operationTypes';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase from default 1mb to handle large ACLED datasets
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facility, impacts, disasters, acledData, acledEnabled, operationType = 'general' } = req.body;

    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }

    console.log('Assessing operation viability for:', facility.name);
    console.log('Operation type:', operationType);
    if (acledData && acledEnabled) {
      console.log(`ACLED data available: ${acledData.length} events, enabled: ${acledEnabled}`);
    }

    // Get operation type configuration
    const opConfig = getOperationType(operationType);

    // Calculate viability score and identify risks
    const assessment = calculateViability(facility, impacts || [], disasters || [], opConfig);

    // Add security assessment if location data available
    if (facility.country || facility.region || facility.district) {
      try {
        const _baseUrl = process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const securityResponse = await fetch(`${_baseUrl}/api/security-assessment`, {
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
        const aiRecommendations = await generateAIRecommendations(facility, assessment, impacts, disasters, opConfig);
        assessment.aiRecommendations = aiRecommendations;
        assessment.isAIGenerated = true;
      } catch (aiError) {
        console.error('Error generating AI recommendations:', aiError);
        // Continue with basic assessment without AI
        assessment.aiRecommendations = generateBasicRecommendations(assessment, opConfig);
        assessment.isAIGenerated = false;
      }
    } else {
      assessment.aiRecommendations = generateBasicRecommendations(assessment, opConfig);
      assessment.isAIGenerated = false;
    }

    res.status(200).json(assessment);
  } catch (error) {
    console.error('Error in operation viability assessment:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Calculate operation viability score based on multiple factors
 */
function calculateViability(facility, impacts, disasters, opConfig) {
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
      addDisasterSpecificRisks(disasterType, risks, mitigationStrategies, distance, opConfig);
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
 * Add disaster-specific risks tailored to operation type
 */
function addDisasterSpecificRisks(disasterType, risks, mitigations, distance, opConfig) {
  // Get disaster impact configuration for this operation type
  const disasterImpact = opConfig.disasterImpacts[disasterType] || opConfig.disasterImpacts['ALL'];

  if (!disasterImpact) return;

  // Add operation-specific disaster risks
  switch (disasterType) {
    case 'FL': // Flooding
      if (opConfig.id === 'malaria_control') {
        risks.push({
          factor: 'Waterborne Disease Risk',
          severity: 'HIGH',
          detail: 'Post-flood conditions create mosquito breeding sites - expect 40-60% increase in malaria cases',
          icon: '🦟',
          disasterType: 'FL'
        });
        mitigations.push({
          risk: 'Waterborne Disease Risk',
          strategy: 'Increase ACT/RDT stock by 50%. Coordinate with WASH team for vector control. Consider prophylaxis for high-risk populations.'
        });
      } else if (opConfig.id === 'wash') {
        risks.push({
          factor: 'Water Contamination',
          severity: 'CRITICAL',
          detail: 'Widespread water contamination and destroyed sanitation facilities',
          icon: '💧',
          disasterType: 'FL'
        });
        mitigations.push({
          risk: 'Water Contamination',
          strategy: 'Deploy water purification units. Distribute purification tablets and jerrycans. Establish temporary latrines.'
        });
      } else if (opConfig.id === 'immunization') {
        risks.push({
          factor: 'Cold Chain Risk',
          severity: 'HIGH',
          detail: 'Power outages threaten vaccine cold chain integrity',
          icon: '❄️',
          disasterType: 'FL'
        });
        mitigations.push({
          risk: 'Cold Chain Risk',
          strategy: 'Pre-position vaccines at unaffected sites. Double ice pack supply. Use solar fridges where possible.'
        });
      } else {
        risks.push({
          factor: disasterImpact.reason,
          severity: disasterImpact.severity,
          detail: `Flood impact on ${opConfig.name}: ${disasterImpact.reason}`,
          icon: '🌊',
          disasterType: 'FL'
        });
      }
      break;

    case 'TC': // Tropical Cyclone
    case 'EQ': // Earthquake
    case 'DR': // Drought
    case 'VO': // Volcanic Activity
    case 'WF': // Wildfire
    case 'TS': // Tsunami
    default:
      // Use generic disaster impact from operation config
      risks.push({
        factor: `${getDisasterName(disasterType)} Impact`,
        severity: disasterImpact.severity,
        detail: disasterImpact.reason,
        icon: getDisasterIcon(disasterType),
        disasterType: disasterType
      });

      // Add operation-specific mitigation
      const supplies = Object.entries(disasterImpact.supplyAdjustment || {})
        .map(([supply, multiplier]) => `${supply} (${Math.round(multiplier * 100)}% increase)`)
        .join(', ');

      mitigations.push({
        risk: `${getDisasterName(disasterType)} Impact`,
        strategy: supplies
          ? `Adjust supply levels: ${supplies}. ${disasterImpact.reason}`
          : disasterImpact.reason
      });
      break;
  }
}

/**
 * Get disaster icon by type
 */
function getDisasterIcon(disasterType) {
  const icons = {
    'FL': '🌊',
    'TC': '🌀',
    'EQ': '🏚️',
    'DR': '🌾',
    'VO': '🌋',
    'WF': '🔥',
    'TS': '🌊'
  };
  return icons[disasterType] || '⚠️';
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
 * Generate AI-powered recommendations tailored to operation type
 */
async function generateAIRecommendations(facility, assessment, impacts, disasters, opConfig) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const disastersInfo = disasters.map(d => ({
    type: d.eventType,
    name: d.title,
    alertLevel: d.alertLevel,
    severity: d.severity
  }));

  // Build operation-specific context
  const operationContext = buildOperationContext(opConfig);

  const prompt = `You are a humanitarian operations expert specializing in ${opConfig.name} operations in disaster-affected areas. ${operationContext}

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

KEY SUPPLIES FOR THIS OPERATION:
${opConfig.supplies.map(s => `- ${s}`).join('\n')}

ASSESSMENT METHOD: ${opConfig.assessmentMethod}
COVERAGE TARGET: ${(opConfig.coverageTarget * 100).toFixed(0)}%

Provide detailed, actionable recommendations for this ${opConfig.name} operation:

1. **Clear Decision**: Confirm or refine the GO/NO-GO/DELAY recommendation with specific justification
2. **Mitigation Actions**: Specific steps to address each risk (be very specific - mention supplies, staff, protocols relevant to ${opConfig.name})
3. **Timeline Details**: When exactly should they proceed? What conditions to monitor?
4. **Resource Adjustments**: Extra supplies, staff, transport, or equipment needed (reference the supply list above)
5. **Alternative Approaches**: If primary facility unsafe, suggest alternatives (mobile teams, nearby facilities, etc.)
6. **Operation-Specific Considerations**:
   ${opConfig.id === 'malaria_control' ? `
   - ACT/RDT needs and stock adjustments
   - LLIN/ITN distribution strategy
   - Vector control coordination
   - Expected case surge predictions
   ` : opConfig.id === 'immunization' ? `
   - Cold chain integrity maintenance
   - Vaccine type-specific considerations
   - Target population coverage
   - Mobile vs fixed site strategies
   ` : opConfig.id === 'wash' ? `
   - Water quality testing protocols
   - Sanitation facility restoration
   - Hygiene promotion messaging
   - Cholera/disease outbreak prevention
   ` : opConfig.id === 'nutrition' ? `
   - MUAC screening protocols
   - RUTF distribution and storage
   - Integration with health services
   - Malnutrition case management
   ` : opConfig.id === 'shelter' ? `
   - Site selection and safety
   - NFI distribution priorities
   - Temporary vs transitional shelter
   - Weather/seasonal considerations
   ` : `
   - Context-specific operational guidance
   - Multi-sector coordination needs
   `}
7. **Assessment Planning** (${opConfig.assessmentMethod}):
   - Recommend appropriate monitoring and evaluation approach
   - Coverage/quality assessment methodology
   - Timing of assessments
8. **Digital Tools** (if applicable):
${opConfig.digitalTools.map(t => `   - ${t}`).join('\n')}

Be concrete and actionable. Use bullet points. Focus on practical field operations.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: `You are an expert in humanitarian operations planning during disasters, specializing in ${opConfig.name}. You follow ${opConfig.assessmentMethod} methodology and relevant sector-specific best practices (WHO, SPHERE, UNICEF, etc.). Provide specific, actionable recommendations for field operations tailored to ${opConfig.category} interventions.`
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
 * Build operation-specific context for AI prompts
 */
function buildOperationContext(opConfig) {
  const contexts = {
    'malaria_control': 'You follow Alliance for Malaria Prevention (AMP) best practices, including cLQAS assessment procedures, ITN/LLIN distribution protocols, and vector control strategies.',
    'immunization': 'You follow WHO immunization guidelines, EPI protocols, cold chain management standards, and LQAS coverage assessment methodologies.',
    'wash': 'You follow SPHERE Standards for WASH in emergencies, WHO water quality guidelines, and emergency sanitation protocols.',
    'nutrition': 'You follow SMART Survey methodology, CMAM protocols for SAM/MAM treatment, and nutrition cluster guidelines.',
    'medical_supply': 'You follow Interagency Emergency Health Kit guidelines, supply chain management best practices, and WHO essential medicines standards.',
    'shelter': 'You follow SPHERE Shelter Standards, NFI cluster guidelines, and site planning best practices for displaced populations.',
    'general': 'You follow humanitarian best practices and Multi-Cluster Initial Rapid Assessment (MIRA) methodology.'
  };

  return contexts[opConfig.id] || contexts['general'];
}

/**
 * Generate basic recommendations without AI
 */
function generateBasicRecommendations(assessment, opConfig) {
  let recommendations = `## ${opConfig.name} Viability Assessment\n\n`;
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

  recommendations += `### Key Supplies Needed\n`;
  opConfig.supplies.slice(0, 5).forEach(s => {
    recommendations += `- ${s}\n`;
  });

  return recommendations;
}

export default withRateLimit(handler);
