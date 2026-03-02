import OpenAI from 'openai';
import { getDistance } from 'geolib';
import { getOperationType, calculateOperationSpecificScore } from '../../config/operationTypes';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * Universal Operation Viability Assessment API
 * Supports multiple operation types: malaria, immunization, WASH, nutrition, medical supply, shelter
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facility, impacts, disasters, acledData, acledEnabled, operationType = 'general' } = req.body;

    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }

    const opConfig = getOperationType(operationType);
    console.log(`Assessing ${opConfig.name} viability for:`, facility.name);

    // Calculate viability score with operation-specific logic
    const assessment = calculateViability(facility, impacts || [], disasters || [], opConfig);

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
          const securityAdjustments = {
            'CRITICAL': -40,
            'HIGH': -25,
            'MEDIUM': -10,
            'LOW': 0
          };

          const adjustment = securityAdjustments[securityData.securityLevel] || 0;
          assessment.viabilityScore = Math.max(0, assessment.viabilityScore + adjustment);

          if (adjustment < 0) {
            assessment.risks.push({
              factor: `${securityData.securityLevel} Security Risk`,
              severity: securityData.securityLevel,
              detail: securityData.securityLevel === 'CRITICAL'
                ? 'Area assessed as critical security risk - operations may be unsafe'
                : 'Elevated security concerns requiring enhanced protocols',
              icon: securityData.securityLevel === 'CRITICAL' ? '🚨' : '⚠️'
            });
          }

          // Recalculate decision based on new score
          assessment.decision = getDecision(assessment.viabilityScore);
        }
      } catch (securityError) {
        console.error('Error fetching security assessment:', securityError);
      }
    }

    // Generate AI recommendations if OpenAI is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const aiRecommendations = await generateAIRecommendations(
          facility,
          assessment,
          impacts,
          disasters,
          opConfig
        );
        assessment.aiRecommendations = aiRecommendations;
        assessment.isAIGenerated = true;
      } catch (aiError) {
        console.error('Error generating AI recommendations:', aiError);
        assessment.aiRecommendations = generateBasicRecommendations(assessment, opConfig);
        assessment.isAIGenerated = false;
      }
    } else {
      assessment.aiRecommendations = generateBasicRecommendations(assessment, opConfig);
      assessment.isAIGenerated = false;
    }

    assessment.operationType = operationType;
    assessment.operationName = opConfig.name;

    res.status(200).json(assessment);
  } catch (error) {
    console.error('Error in operation viability assessment:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Calculate viability score based on operation type and disaster impacts
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

      // Get operation-specific disaster impact
      const disasterImpact = opConfig.disasterImpacts[disasterType] || opConfig.disasterImpacts['ALL'];

      // Proximity-based scoring
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
          strategy: `Postpone ${opConfig.name.toLowerCase()} until ${getDisasterName(disasterType)} threat subsides. Monitor situation daily.`
        });
      } else if (distance < 50) {
        viabilityScore -= 20;
        risks.push({
          factor: 'Disaster Proximity',
          severity: 'HIGH',
          detail: `${getDisasterName(disasterType)} ${distance}km away - may impact operations`,
          icon: '🟠',
          disasterType: disasterType
        });
      } else if (distance < 100) {
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
      } else if (alertLevel === 'orange') {
        viabilityScore -= 15;
      }

      // Add operation-specific disaster risks
      if (disasterImpact) {
        addOperationSpecificRisks(
          disasterType,
          disasterImpact,
          opConfig,
          risks,
          mitigationStrategies,
          distance
        );
      }
    }
  }

  // Apply operation-specific risk factors
  applyOperationRiskFactors(facility, impacts, disasters, opConfig, viabilityScore, risks, mitigationStrategies);

  // Ensure score doesn't go below 0
  viabilityScore = Math.max(0, viabilityScore);

  const decision = getDecision(viabilityScore);
  const timeline = estimateTimeline(viabilityScore, risks, opConfig);

  return {
    viabilityScore,
    decision,
    risks,
    mitigationStrategies,
    timeline,
    alternativeSites: [],
    facilityName: facility.name,
    operationType: opConfig.id,
    coverageTarget: opConfig.coverageTarget
  };
}

/**
 * Add operation-specific disaster risks
 */
function addOperationSpecificRisks(disasterType, disasterImpact, opConfig, risks, mitigations, distance) {
  const severityMap = {
    'CRITICAL': { icon: '🔴', score: -35 },
    'HIGH': { icon: '🟠', score: -25 },
    'MEDIUM': { icon: '🟡', score: -15 },
    'LOW': { icon: '🟢', score: -5 }
  };

  const severityInfo = severityMap[disasterImpact.severity] || severityMap['MEDIUM'];

  risks.push({
    factor: `${opConfig.name} Impact`,
    severity: disasterImpact.severity,
    detail: disasterImpact.reason,
    icon: severityInfo.icon,
    disasterType: disasterType
  });

  // Add supply adjustment recommendations
  if (disasterImpact.supplyAdjustment) {
    const adjustments = Object.entries(disasterImpact.supplyAdjustment)
      .map(([item, multiplier]) => `${item}: ${(multiplier * 100).toFixed(0)}%`)
      .join(', ');

    mitigations.push({
      risk: `${opConfig.name} Supply Needs`,
      strategy: `Adjust supply levels: ${adjustments}. Pre-position critical items.`
    });
  }

  // Add standard mitigation based on priority
  if (disasterImpact.mitigationPriority === 'CRITICAL') {
    mitigations.push({
      risk: `${disasterType} ${opConfig.name} Response`,
      strategy: `URGENT: Deploy emergency response protocol. Coordinate with ${opConfig.category} cluster. Monitor conditions hourly.`
    });
  }
}

/**
 * Apply operation-specific risk assessment
 */
function applyOperationRiskFactors(facility, impacts, disasters, opConfig, baseScore, risks, mitigations) {
  // Cold chain assessment (for immunization, some medical supplies)
  if (opConfig.riskFactors.coldChain && opConfig.riskFactors.coldChain.weight > 0.2) {
    const hasPowerRisk = impacts.some(impact => {
      const type = impact.disaster?.eventType?.toUpperCase();
      return ['EQ', 'TC', 'FL'].includes(type) && impact.distance < 50;
    });

    if (hasPowerRisk) {
      risks.push({
        factor: opConfig.riskFactors.coldChain.label,
        severity: 'CRITICAL',
        detail: opConfig.riskFactors.coldChain.critical,
        icon: '❄️'
      });
      mitigations.push({
        risk: opConfig.riskFactors.coldChain.label,
        strategy: 'Pre-position supplies at unaffected facility. Bring backup power/ice packs. Check generator fuel. Have temperature monitoring devices.'
      });
    }
  }

  // Access and infrastructure (universal)
  const hasAccessRisk = impacts.some(impact => {
    const type = impact.disaster?.eventType?.toUpperCase();
    return ['FL', 'EQ', 'TC'].includes(type) && impact.distance < 30;
  });

  if (hasAccessRisk) {
    risks.push({
      factor: 'Access Constraints',
      severity: 'HIGH',
      detail: 'Roads may be impassable due to flooding, debris, or structural damage',
      icon: '🚧'
    });
    mitigations.push({
      risk: 'Access Constraints',
      strategy: 'Scout alternative routes. Use 4x4 vehicles or motorcycles. Consider postponing until roads cleared. Deploy mobile teams if facility unreachable.'
    });
  }

  // Population displacement (relevant for most operations)
  if (opConfig.riskFactors.displacement || opConfig.riskFactors.populationDensity) {
    const severeImpacts = impacts.filter(impact => {
      const type = impact.disaster?.eventType?.toUpperCase();
      return impact.distance < 20 && ['FL', 'TC', 'EQ', 'VO'].includes(type);
    });

    if (severeImpacts.length > 0) {
      risks.push({
        factor: 'Population Displacement',
        severity: 'HIGH',
        detail: `Target population may have fled to safer areas or camps`,
        icon: '🏕️'
      });
      mitigations.push({
        risk: 'Population Displacement',
        strategy: 'Deploy mobile teams to IDP camps and displacement sites. Coordinate with camp managers. Adjust target numbers. Track population movements.'
      });
    }
  }
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
 * Estimate timeline for safe operation execution
 */
function estimateTimeline(score, risks, opConfig) {
  if (score >= 70) {
    return {
      recommendation: 'Proceed immediately',
      waitTime: '0 days',
      rationale: `Conditions are favorable for ${opConfig.name.toLowerCase()} execution`
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
      recommendation: `Delay ${opConfig.name.toLowerCase()}`,
      waitTime: '2-3 weeks',
      rationale: 'Significant risks present. Wait for disaster impacts to subside and conditions to improve.'
    };
  }

  return {
    recommendation: `Postpone ${opConfig.name.toLowerCase()}`,
    waitTime: '1-2 months',
    rationale: 'Severe risks make operation unsafe or ineffective. Major recovery needed before proceeding.'
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
 * Generate AI-powered recommendations using OpenAI
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
  const suppliesContext = opConfig.supplies.slice(0, 10).join(', ');
  const digitalToolsContext = opConfig.digitalTools?.join(', ') || 'Standard monitoring tools';

  const prompt = `You are a humanitarian operations expert specializing in ${opConfig.name} in disaster-affected areas. You follow ${opConfig.assessmentMethod} methodology and international humanitarian standards.

OPERATION TYPE: ${opConfig.name}
FACILITY: ${facility.name}
VIABILITY SCORE: ${assessment.viabilityScore}/100
DECISION: ${assessment.decision}
COVERAGE TARGET: ${(opConfig.coverageTarget * 100).toFixed(0)}%

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
${suppliesContext}

DIGITAL TOOLS AVAILABLE:
${digitalToolsContext}

Provide detailed, actionable recommendations for this ${opConfig.name.toLowerCase()}:

1. **Clear Decision**: Confirm or refine the GO/NO-GO/DELAY recommendation with specific justification
2. **Mitigation Actions**: Specific steps to address each risk (mention exact supplies, staff, protocols)
3. **Timeline Details**: When exactly should they proceed? What conditions to monitor?
4. **Resource Adjustments**: Extra supplies, staff, transport, or equipment needed for ${opConfig.name.toLowerCase()}
5. **Alternative Approaches**: If primary facility unsafe, suggest alternatives (mobile teams, nearby facilities, etc.)
6. **Operation-Specific Considerations**:
   ${getOperationSpecificGuidance(opConfig)}
7. **Assessment Planning** (${opConfig.assessmentMethod}):
   - Recommend in-process or end-process evaluation
   - Suggest rapid assessment if operation delayed
   - Coverage assessment methodology
8. **Digital Tools** (if applicable):
   - Mobile data collection approaches
   - Real-time monitoring dashboards
   - Supply chain tracking systems

Be concrete and actionable. Use bullet points. Focus on practical field operations following ${opConfig.assessmentMethod} guidance.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: `You are an expert in ${opConfig.name} during disasters. You follow ${opConfig.assessmentMethod} best practices and provide specific, actionable recommendations for field operations. Target coverage is ${(opConfig.coverageTarget * 100).toFixed(0)}%.`
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
 * Get operation-specific AI guidance prompts
 */
function getOperationSpecificGuidance(opConfig) {
  const guidance = {
    'malaria_control': `
   - ACT/RDT needs and stock levels
   - LLIN/ITN distribution strategy (mass campaign vs routine)
   - Vector control coordination with WASH teams
   - Expected case surge scenarios
   - Supply chain considerations (pre-positioning, tracking)`,

    'immunization': `
   - Cold chain integrity and backup plans
   - Vaccine types and dosing schedules
   - Target populations (children, pregnant women, etc.)
   - Mobile vs fixed-post strategy
   - Wastage minimization`,

    'wash': `
   - Water quality testing and treatment protocols
   - Sanitation facility needs (latrines, handwashing stations)
   - Hygiene promotion messaging
   - Coordination with health cluster on disease surveillance`,

    'nutrition': `
   - MUAC screening and SAM/MAM identification
   - RUTF supply calculations
   - Integration with health services
   - Beneficiary registration and tracking`,

    'medical_supply': `
   - IEHK and trauma kit deployment
   - Essential medicines prioritization
   - Last-mile delivery logistics
   - Inventory management and tracking`,

    'shelter': `
   - Site selection and safety assessment
   - Shelter kit vs tent distribution
   - Winterization or weatherproofing needs
   - NFI distribution planning`,

    'general': `
   - Multi-sector coordination
   - Needs assessment priorities
   - Beneficiary targeting criteria`
  };

  return guidance[opConfig.id] || guidance['general'];
}

/**
 * Generate basic recommendations without AI
 */
function generateBasicRecommendations(assessment, opConfig) {
  let recommendations = `## ${opConfig.name} Viability Assessment\n\n`;
  recommendations += `**Decision**: ${assessment.decision}\n`;
  recommendations += `**Viability Score**: ${assessment.viabilityScore}/100\n`;
  recommendations += `**Coverage Target**: ${(opConfig.coverageTarget * 100).toFixed(0)}%\n\n`;

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
  opConfig.supplies.slice(0, 5).forEach(supply => {
    recommendations += `- ${supply}\n`;
  });

  return recommendations;
}
