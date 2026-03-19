import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';
import { getOperationType } from '../../config/operationTypes';

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
      districts,
      facilities,
      impactedFacilities,
      disasters,
      worldPopData = {},
      worldPopYear = null,
      operationType = 'general'
    } = req.body;

    if (!districts || districts.length === 0) {
      return res.status(400).json({ error: 'Missing districts data' });
    }

    console.log(`District-level campaign assessment: ${districts.length} districts, ${facilities?.length || 0} facilities`);
    const opConfig = getOperationType(operationType);

    const startTime = Date.now();

    // Aggregate facilities by district using point-in-polygon
    const districtData = districts.map(district => {
      const facilitiesInDistrict = facilities?.filter(facility => {
        return isPointInDistrict(
          parseFloat(facility.latitude),
          parseFloat(facility.longitude),
          district
        );
      }) || [];

      const impactedInDistrict = facilitiesInDistrict.filter(facility =>
        impactedFacilities?.some(imp => imp.facility.name === facility.name)
      );

      // Count disasters affecting this district
      const disastersInDistrict = disasters?.filter(disaster => {
        if (!disaster.latitude || !disaster.longitude) return false;
        return isPointInDistrict(
          parseFloat(disaster.latitude),
          parseFloat(disaster.longitude),
          district
        );
      }) || [];

      // Extract ACLED risk level and score from district properties
      const riskLevel = district.riskLevel || 'none';
      const riskScore = district.riskScore || 0;
      const eventCount = district.eventCount || 0;

      // Use WorldPop population if available, fall back to shapefile property
      const wpData = worldPopData[String(district.id)];
      const population = wpData?.total
        || district.properties?.population
        || district.properties?.POP
        || district.population
        || null;

      const ageGroups = wpData?.ageGroups || null;
      const disasterTypes = summarizeDisasterTypes(disastersInDistrict);

      return {
        district: district.name,
        country: district.country,
        region: district.region,
        totalFacilities: facilitiesInDistrict.length,
        impactedFacilities: impactedInDistrict.length,
        disasterCount: disastersInDistrict.length,
        impactRate: facilitiesInDistrict.length > 0
          ? Math.round((impactedInDistrict.length / facilitiesInDistrict.length) * 100)
          : 0,
        riskLevel: riskLevel,
        riskScore: riskScore,
        eventCount: eventCount,
        population: population,
        ageGroups: ageGroups,
        populationSource: wpData ? `WorldPop Global 2 (${worldPopYear || 'unknown year'})` : 'shapefile',
        disasterTypes
      };
    });

    // For campaign planning, assess ALL districts (facilities are optional)
    // Prioritize by: 1) disaster count (highest risk first), 2) facility count (if any)
    const relevantDistricts = [...districtData];

    console.log(`Assessing ${relevantDistricts.length} districts (${relevantDistricts.filter(d => d.totalFacilities > 0).length} have facilities)`);

    // Sort by ACLED risk score (highest first), then disaster count, then facilities
    relevantDistricts.sort((a, b) => {
      // First by ACLED risk score (descending) - districts with conflict are highest priority
      if (b.riskScore !== a.riskScore) {
        return b.riskScore - a.riskScore;
      }
      // Then by disaster count (descending)
      if (b.disasterCount !== a.disasterCount) {
        return b.disasterCount - a.disasterCount;
      }
      // Then by number of facilities (descending)
      if (b.totalFacilities !== a.totalFacilities) {
        return b.totalFacilities - a.totalFacilities;
      }
      // Then by impact rate (descending)
      return b.impactRate - a.impactRate;
    });

    // Limit to top 300 districts to avoid token limits (300 * 30 = 9000 tokens, well under 16384)
    const maxDistricts = 300;
    const districtsToAssess = relevantDistricts.slice(0, maxDistricts);
    const remainingDistricts = relevantDistricts.slice(maxDistricts);

    console.log(`Assessing top ${districtsToAssess.length} districts (${remainingDistricts.length} with basic assessment)`);

    // Use OpenAI for district-level assessment
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `District-level ${opConfig.name} viability assessment for top ${districtsToAssess.length} districts (sorted by ACLED conflict risk, then disaster count).

OPERATION CONTEXT:
- Program: ${opConfig.name}
- Description: ${opConfig.description}
- Key operational concerns: ${Object.values(opConfig.riskFactors || {}).map(risk => risk.label).slice(0, 4).join(', ')}

DISTRICTS:
${districtsToAssess.map((d, idx) =>
  `${idx + 1}|${d.district}|ACLED: ${d.riskLevel} (${d.eventCount} events)|${d.disasterCount} disasters${formatDisasterTypesForPrompt(d.disasterTypes)}|${d.totalFacilities} facilities${d.totalFacilities > 0 ? `|${d.impactedFacilities} impacted (${d.impactRate}%)` : ''}`
).join('\n')}

Assess each district for campaign feasibility. Consider:
- ACLED conflict risk: very-high/high = major security concern, medium = moderate risk, low/none = safe
- Disaster count (higher = more risk to operations)
- Impact rate on facilities if present (>30% = higher risk)
- District-wide operational viability for ${opConfig.name.toLowerCase()}
- Escalate districts where disaster types are especially disruptive for this program

Decision criteria:
- NO-GO: very-high ACLED risk OR 5+ disasters
- DELAY: high ACLED risk OR 3+ disasters OR >50% facility impact
- CAUTION: medium ACLED risk OR 1-2 disasters OR >20% facility impact
- GO: low/none ACLED risk AND <1 disaster AND <20% facility impact

Format: ID|GO/CAUTION/DELAY/NOGO|reason (max 30 words)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: Math.min(districtsToAssess.length * 30, 15000) // Cap at 15k tokens
      });

      const aiResponse = response.choices[0].message.content;

      // Parse AI response
      const lines = aiResponse.trim().split('\n');
      const assessments = {};

      lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length === 3) {
          const [id, decision, reason] = parts.map(p => p.trim());
          assessments[parseInt(id)] = {
            decision: decision.toUpperCase(),
            reason: reason
          };
        }
      });

      // Map assessments back to top districts
      const assessedResults = districtsToAssess.map((district, idx) => {
        const fallbackAssessment = buildDistrictAssessment(district, opConfig);

        const assessment = assessments[idx + 1] || {
          decision: fallbackAssessment.decision,
          reason: fallbackAssessment.reason
        };

        // Calculate viability score (0-100)
        let score = fallbackAssessment.score;
        if (assessment.decision === 'NO-GO') score = 0;
        else if (assessment.decision === 'DELAY') score = Math.min(score, 40);
        else if (assessment.decision === 'CAUTION') score = Math.min(score, 70);

        return {
          district: district.district,
          country: district.country,
          region: district.region,
          totalFacilities: district.totalFacilities,
          impactedFacilities: district.impactedFacilities,
          impactRate: district.impactRate,
          decision: assessment.decision,
          viabilityScore: Math.max(0, score),
          reason: assessment.reason,
          disasterCount: district.disasterCount,
          disasterTypes: district.disasterTypes,
          riskLevel: district.riskLevel,
          riskScore: district.riskScore,
          eventCount: district.eventCount,
          keyDrivers: fallbackAssessment.keyDrivers
        };
      });

      // Add remaining districts with basic assessment (no AI)
      const remainingResults = remainingDistricts.map(district => {
        const assessment = buildDistrictAssessment(district, opConfig);
        const score = assessment.decision === 'NO-GO' ? 0
          : assessment.decision === 'DELAY' ? Math.min(assessment.score, 40)
          : assessment.decision === 'CAUTION' ? Math.min(assessment.score, 70)
          : assessment.score;

        return {
          district: district.district,
          country: district.country,
          region: district.region,
          totalFacilities: district.totalFacilities,
          impactedFacilities: district.impactedFacilities,
          impactRate: district.impactRate,
          decision: assessment.decision,
          viabilityScore: Math.max(0, score),
          reason: `${assessment.reason} (auto-assessed)`,
          disasterCount: district.disasterCount,
          disasterTypes: district.disasterTypes,
          riskLevel: district.riskLevel,
          riskScore: district.riskScore,
          eventCount: district.eventCount,
          keyDrivers: assessment.keyDrivers
        };
      });

      const results = [...assessedResults, ...remainingResults];

      const duration = Date.now() - startTime;
      console.log(`✅ District assessment complete: ${assessedResults.length} AI-assessed + ${remainingResults.length} auto-assessed = ${results.length} total in ${duration}ms`);

      res.status(200).json({
        assessments: results,
        summary: {
          totalDistricts: districts.length,
          assessedDistricts: relevantDistricts.length,
          aiAssessedDistricts: assessedResults.length,
          autoAssessedDistricts: remainingResults.length,
          go: results.filter(r => r.decision === 'GO').length,
          caution: results.filter(r => r.decision === 'CAUTION').length,
          delay: results.filter(r => r.decision === 'DELAY').length,
          noGo: results.filter(r => r.decision === 'NO-GO').length,
          totalFacilities: relevantDistricts.reduce((sum, d) => sum + d.totalFacilities, 0),
          processingTime: duration
        }
      });

    } else {
      // Fallback without AI
      const results = relevantDistricts.map(district => {
        const assessment = buildDistrictAssessment(district, opConfig);
        const score = assessment.decision === 'NO-GO' ? 0
          : assessment.decision === 'DELAY' ? Math.min(assessment.score, 40)
          : assessment.decision === 'CAUTION' ? Math.min(assessment.score, 70)
          : assessment.score;

        return {
          district: district.district,
          country: district.country,
          region: district.region,
          totalFacilities: district.totalFacilities,
          impactedFacilities: district.impactedFacilities,
          impactRate: district.impactRate,
          decision: assessment.decision,
          viabilityScore: Math.max(0, score),
          reason: assessment.reason,
          disasterCount: district.disasterCount,
          disasterTypes: district.disasterTypes,
          riskLevel: district.riskLevel,
          riskScore: district.riskScore,
          eventCount: district.eventCount,
          keyDrivers: assessment.keyDrivers
        };
      });

      res.status(200).json({
        assessments: results,
        summary: {
          totalDistricts: districts.length,
          assessedDistricts: relevantDistricts.length,
          go: results.filter(r => r.decision === 'GO').length,
          caution: results.filter(r => r.decision === 'CAUTION').length,
          delay: results.filter(r => r.decision === 'DELAY').length,
          noGo: results.filter(r => r.decision === 'NO-GO').length
        }
      });
    }

  } catch (error) {
    console.error('Error in district campaign assessment:', error);
    res.status(500).json({ error: error.message });
  }
}

function isPointInDistrict(lat, lng, district) {
  const point = [lng, lat];
  const geometry = district?.geometry || district?.properties?.geometry;

  if (geometry?.type === 'Polygon') {
    return geometry.coordinates?.some(ring => pointInRing(point, ring));
  }

  if (geometry?.type === 'MultiPolygon') {
    return geometry.coordinates?.some(polygon =>
      polygon?.some(ring => pointInRing(point, ring))
    );
  }

  if (!district.bounds) return false;

  const { minLat, maxLat, minLng, maxLng } = district.bounds;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

function pointInRing(point, ring = []) {
  let inside = false;
  const [x, y] = point;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function summarizeDisasterTypes(disasters = []) {
  const counts = {};

  disasters.forEach(disaster => {
    const type = getDisasterTypeCode(disaster);
    if (!type) return;
    counts[type] = (counts[type] || 0) + 1;
  });

  return counts;
}

function getDisasterTypeCode(disaster) {
  return disaster?.eventType?.toUpperCase()
    || disaster?.eventtype?.toUpperCase()
    || disaster?.gdacs_eventtype?.toUpperCase()
    || disaster?.properties?.eventType?.toUpperCase()
    || null;
}

function formatDisasterTypesForPrompt(disasterTypes = {}) {
  const entries = Object.entries(disasterTypes);
  if (entries.length === 0) return '';
  return `|types: ${entries.map(([type, count]) => `${type}(${count})`).join(', ')}`;
}

function buildDistrictAssessment(district, opConfig) {
  let decision = 'GO';
  const reasons = [];
  const keyDrivers = [];
  let score = 100 - district.impactRate - (district.disasterCount * 15) - district.riskScore;

  if (district.riskLevel === 'very-high') {
    decision = 'NO-GO';
    reasons.push(`Very high conflict risk (${district.eventCount} events)`);
    keyDrivers.push(`ACLED risk: very high (${district.eventCount} events)`);
  } else if (district.riskLevel === 'high') {
    decision = 'DELAY';
    reasons.push(`High conflict risk (${district.eventCount} events)`);
    keyDrivers.push(`ACLED risk: high (${district.eventCount} events)`);
  } else if (district.riskLevel === 'medium') {
    decision = 'CAUTION';
    reasons.push(`Medium conflict risk (${district.eventCount} events)`);
    keyDrivers.push(`ACLED risk: medium (${district.eventCount} events)`);
  } else if (district.riskLevel === 'low') {
    decision = 'CAUTION';
    reasons.push(`Low conflict risk (${district.eventCount} events)`);
    keyDrivers.push(`ACLED risk: low (${district.eventCount} events)`);
  }

  if (district.disasterCount >= 5) {
    decision = 'NO-GO';
    reasons.push(`${district.disasterCount} disasters`);
    keyDrivers.push(`${district.disasterCount} active disasters`);
  } else if (district.disasterCount >= 3) {
    if (decision === 'GO' || decision === 'CAUTION') decision = 'DELAY';
    reasons.push(`${district.disasterCount} disasters`);
    keyDrivers.push(`${district.disasterCount} active disasters`);
  } else if (district.disasterCount >= 1) {
    if (decision === 'GO') decision = 'CAUTION';
    reasons.push(`${district.disasterCount} disaster${district.disasterCount > 1 ? 's' : ''}`);
    keyDrivers.push(`${district.disasterCount} active disaster${district.disasterCount > 1 ? 's' : ''}`);
  }

  const operationDisasterImpact = getStrongestOperationDisasterImpact(district.disasterTypes, opConfig);
  if (operationDisasterImpact) {
    if (operationDisasterImpact.severity === 'CRITICAL') {
      decision = decision === 'NO-GO' ? 'NO-GO' : 'DELAY';
      score -= 20;
    } else if (operationDisasterImpact.severity === 'HIGH' && decision === 'GO') {
      decision = 'CAUTION';
      score -= 10;
    }

    keyDrivers.push(`${operationDisasterImpact.type} is ${operationDisasterImpact.severity.toLowerCase()} for ${opConfig.name.toLowerCase()}`);
    reasons.push(operationDisasterImpact.reason);
  }

  if (district.totalFacilities > 0) {
    if (district.impactRate > 50) {
      if (decision === 'GO' || decision === 'CAUTION') decision = 'DELAY';
      reasons.push(`${district.impactRate}% facilities impacted`);
      keyDrivers.push(`${district.impactRate}% of facilities impacted`);
    } else if (district.impactRate > 20) {
      if (decision === 'GO') decision = 'CAUTION';
      reasons.push(`${district.impactRate}% facilities impacted`);
      keyDrivers.push(`${district.impactRate}% of facilities impacted`);
    }
  }

  if (keyDrivers.length === 0) {
    keyDrivers.push('No major active operational threats detected');
  }

  return {
    decision,
    reason: reasons.length > 0 ? reasons.join(', ') : 'No active threats detected',
    keyDrivers: keyDrivers.slice(0, 3),
    score: Math.max(0, score)
  };
}

function getStrongestOperationDisasterImpact(disasterTypes = {}, opConfig) {
  const severityRank = {
    CRITICAL: 3,
    HIGH: 2,
    MEDIUM: 1
  };

  let strongest = null;

  Object.keys(disasterTypes).forEach(type => {
    const impact = opConfig?.disasterImpacts?.[type] || opConfig?.disasterImpacts?.ALL;
    if (!impact) return;

    if (!strongest || severityRank[impact.severity] > severityRank[strongest.severity]) {
      strongest = {
        type,
        severity: impact.severity,
        reason: impact.reason
      };
    }
  });

  return strongest;
}

export default withRateLimit(handler);
