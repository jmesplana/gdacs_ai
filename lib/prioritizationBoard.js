import { getDistance } from 'geolib';
import { calculateOperationSpecificScore, getOperationType } from '../config/operationTypes';
import { hasUsableGeometry, isPointInDistricts, scoreDistrictRisk } from './districtRiskScoring';

const POPULATION_FIELDS = [
  'population',
  'target_population',
  'catchment_population',
  'catchment',
  'beneficiaries',
  'people_served',
  'children_u5',
  'districtPopulation'
];

const FACILITY_TYPE_FIELDS = ['facility_type', 'type', 'category', 'service_type'];

const STATUS_BUCKETS = {
  urgent: { min: 75, label: 'Urgent' },
  high: { min: 55, label: 'High' },
  medium: { min: 35, label: 'Medium' },
  low: { min: 0, label: 'Monitor' }
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeDistrictLabel(value, fallback = '') {
  if (value === null || value === undefined) return fallback;

  const cleaned = String(value)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function getFacilityId(facility = {}) {
  return [
    facility.name || 'unnamed',
    facility.latitude ?? 'na',
    facility.longitude ?? 'na'
  ].join('__');
}

function getScopedWorldPopData(worldPopData = {}, selectedDistricts = []) {
  if (!worldPopData || !selectedDistricts.length) return {};

  const scoped = {};
  selectedDistricts.forEach((district, idx) => {
    const props = district.properties || {};
    const keys = [
      String(district.id || idx),
      district.name,
      props.ADM2_EN,
      props.NAME_2,
      props.NAME,
      props.name,
      props.district,
      district.id || idx
    ].filter(Boolean);

    keys.forEach((key) => {
      if (worldPopData[key] && !scoped[key]) {
        scoped[key] = worldPopData[key];
      }
    });
  });

  return scoped;
}

function getDistrictName(facility = {}) {
  return sanitizeDistrictLabel(
    facility.district || facility.admin2 || facility.region || facility.admin1,
    'Unassigned'
  );
}

function normalizeDistrictKey(value) {
  return sanitizeDistrictLabel(value).toLowerCase();
}

function getDistrictCandidateKeys(district = {}, fallback = 'Selected Area') {
  const props = district.properties || {};
  return [
    district.name,
    props.ADM2_EN,
    props.NAME_2,
    props.NAME,
    props.name,
    props.district,
    fallback
  ]
    .filter(Boolean)
    .map(normalizeDistrictKey);
}

function normalizeHazardTypeLabel(type = '') {
  const normalized = String(type || '').trim().toLowerCase();
  if (!normalized || normalized === 'unavailable') return 'Hazard';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getDistrictHazardEntry(district = {}, districtHazardAnalysis = null, index = 0) {
  const hazardDistricts = districtHazardAnalysis?.districts || [];
  if (!hazardDistricts.length) return null;

  const districtId = String(district.id ?? index);
  const districtName = getDistrictLabel(district, `Selected Area ${index + 1}`);
  const candidateKeys = new Set([districtId, normalizeDistrictKey(districtName)]);

  const matched = hazardDistricts.find((row) =>
    String(row?.districtId ?? '') === districtId ||
    candidateKeys.has(normalizeDistrictKey(row?.districtName || ''))
  );

  return matched || null;
}

function getProjectedHazardModifier(hazardEntry = null) {
  const profile = getProjectedHazardProfile(hazardEntry);
  if (!profile) return 0;
  return clamp(Math.round(profile.combinedScore * 0.42), 0, 34);
}

function getProjectedHazardProfile(hazardEntry = null) {
  if (!hazardEntry?.hazardAssessments) return null;

  const readyHazards = Object.entries(hazardEntry.hazardAssessments)
    .filter(([, assessment]) => typeof assessment?.score === 'number')
    .map(([type, assessment]) => ({
      type,
      score: assessment.score,
      level: assessment.level
    }))
    .sort((a, b) => b.score - a.score);

  if (!readyHazards.length) return null;

  const primary = readyHazards[0];
  const secondary = readyHazards[1] || null;
  const combinedScore = clamp(
    Math.round(primary.score + ((secondary?.score || 0) * 0.35)),
    0,
    100
  );

  return {
    readyHazards,
    primary,
    secondary,
    combinedScore,
    label: readyHazards.length > 1
      ? `Multi-hazard (${readyHazards.map((hazard) => normalizeHazardTypeLabel(hazard.type)).join(' + ')})`
      : normalizeHazardTypeLabel(primary.type)
  };
}

function getProjectedHazardKeyGaps(hazardEntry = null) {
  if (!hazardEntry?.hazardAssessments) return [];

  return Object.entries(hazardEntry.hazardAssessments)
    .filter(([, assessment]) => assessment?.status !== 'ready')
    .map(([hazardType, assessment]) => {
      if (assessment?.status === 'missing_required_layers' && assessment?.missingLayers?.length) {
        const missing = assessment.missingLayers
          .map((layer) => layer === 'flood_context'
            ? 'Flood Context'
            : layer === 'drought_context'
              ? 'Drought Context'
              : layer
          )
          .join(' + ');
        return `${normalizeHazardTypeLabel(hazardType)} evidence not ready: enable ${missing}`;
      }

      if (assessment?.status === 'missing_evidence_data') {
        return `${normalizeHazardTypeLabel(hazardType)} evidence was requested but district-level GEE summaries could not be computed`;
      }

      return null;
    })
    .filter(Boolean);
}

function resolveFacilityDistrict(facility = {}, districts = []) {
  const latitude = toNumber(facility.latitude);
  const longitude = toNumber(facility.longitude);

  if (latitude !== null && longitude !== null) {
    const matchedDistrict = districts.find((district) =>
      isPointInDistricts(latitude, longitude, [district])
    );

    if (matchedDistrict) {
      return getDistrictLabel(matchedDistrict);
    }
  }

  return getDistrictName(facility);
}

function getFacilityType(facility = {}) {
  for (const field of FACILITY_TYPE_FIELDS) {
    if (facility[field]) {
      return String(facility[field]);
    }
  }
  return '';
}

function getPopulationEstimate(facility = {}, worldPopData = {}) {
  for (const field of POPULATION_FIELDS) {
    const value = toNumber(facility[field]);
    if (value) return Math.round(value);
  }

  const districtName = getDistrictName(facility);
  const districtPop = worldPopData?.[districtName];

  if (districtPop && typeof districtPop === 'object') {
    return Math.round(
      toNumber(districtPop.total) ||
      toNumber(districtPop.ageGroups?.total) ||
      toNumber(districtPop.population) ||
      toNumber(districtPop.totalPopulation) ||
      toNumber(districtPop.value) ||
      0
    ) || null;
  }

  return null;
}

function getDistrictPopulationEstimate(district = {}, worldPopData = {}) {
  const props = district.properties || {};
  const keys = [
    String(district.id || ''),
    district.name,
    props.ADM2_EN,
    props.NAME_2,
    props.NAME,
    props.name,
    props.district,
    district.id
  ].filter(Boolean);

  for (const key of keys) {
    const source = worldPopData[key];
    if (source && typeof source === 'object') {
      const value = Math.round(
        toNumber(source.total) ||
        toNumber(source.ageGroups?.total) ||
        toNumber(source.population) ||
        toNumber(source.totalPopulation) ||
        toNumber(source.value) ||
        0
      );
      if (value) return value;
    }
  }

  return Math.round(
    toNumber(props.population) ||
    toNumber(props.POP) ||
    0
  ) || null;
}

function getNighttimeLightsEvidence(district = {}, districtHazardAnalysis = null, index = 0) {
  const districtId = district.id ?? index;
  const districtName = getDistrictLabel(district, `Selected Area ${index + 1}`);
  const match = (districtHazardAnalysis?.districts || []).find((entry) =>
    String(entry?.districtId) === String(districtId) || entry?.districtName === districtName
  );

  return match?.geeEvidence?.nighttimeLights || null;
}

function classifyNighttimeLights(nighttimeLights = null) {
  const avgRad = toNumber(nighttimeLights?.avgRadMean) || 0;
  const litAreaShare = toNumber(nighttimeLights?.litAreaShare) || 0;

  if (avgRad >= 15 || litAreaShare >= 0.35) {
    return {
      intensity: 'high',
      supportContext: 'concentrated',
      summary: 'Strong nighttime-light intensity suggests a concentrated settlement and infrastructure environment.'
    };
  }
  if (avgRad >= 5 || litAreaShare >= 0.12) {
    return {
      intensity: 'medium',
      supportContext: 'mixed',
      summary: 'Moderate nighttime-light intensity suggests a mixed settlement and support environment.'
    };
  }
  return {
    intensity: 'low',
    supportContext: 'sparse',
    summary: 'Low nighttime-light intensity suggests sparse settlement and a thinner support environment.'
  };
}

function getAlertWeight(disaster = {}) {
  const alert = String(disaster.alertLevel || '').toLowerCase();
  const severity = String(disaster.severity || '').toLowerCase();

  if (alert === 'red' || severity.includes('extreme') || severity.includes('severe')) return 10;
  if (alert === 'orange' || severity.includes('moderate')) return 7;
  if (alert === 'green' || severity.includes('minor')) return 4;
  return 5;
}

function getCriticalityBoost(facilityType = '') {
  const normalized = facilityType.toLowerCase();

  if (!normalized) return 2;
  if (normalized.includes('hospital')) return 10;
  if (normalized.includes('clinic') || normalized.includes('health')) return 8;
  if (normalized.includes('warehouse') || normalized.includes('store')) return 9;
  if (normalized.includes('water') || normalized.includes('wash')) return 8;
  if (normalized.includes('shelter') || normalized.includes('camp')) return 7;
  if (normalized.includes('school')) return 5;
  return 3;
}

function summarizeImpacts(impacts = []) {
  const disasterTypes = new Set();
  let nearestDistance = null;
  let securityImpactCount = 0;
  let hazardPressure = 0;

  impacts.forEach((impact) => {
    const disaster = impact.disaster || {};
    const distance = toNumber(impact.distance) ?? 999;
    nearestDistance = nearestDistance === null ? distance : Math.min(nearestDistance, distance);

    const type = String(disaster.eventType || disaster.eventName || 'unknown').toUpperCase();
    disasterTypes.add(type);

    if (String(disaster.source || '').toUpperCase() === 'ACLED') {
      securityImpactCount += 1;
    }

    const proximityFactor =
      distance <= 5 ? 1 :
      distance <= 20 ? 0.8 :
      distance <= 50 ? 0.55 :
      0.3;

    hazardPressure += getAlertWeight(disaster) * proximityFactor;
  });

  return {
    disasterTypes: Array.from(disasterTypes),
    impactCount: impacts.length,
    securityImpactCount,
    nearestDistance,
    hazardPressure: clamp(hazardPressure, 0, 35)
  };
}

function summarizeSecurity(facility = {}, acledData = []) {
  if (!facility.latitude || !facility.longitude || !Array.isArray(acledData) || acledData.length === 0) {
    return { nearbyCount: 0, fatalities: 0, score: 0 };
  }

  let nearbyCount = 0;
  let fatalities = 0;

  acledData.forEach((event) => {
    const latitude = toNumber(event.latitude);
    const longitude = toNumber(event.longitude);
    if (latitude === null || longitude === null) return;

    const distanceKm = getDistance(
      { latitude: facility.latitude, longitude: facility.longitude },
      { latitude, longitude }
    ) / 1000;

    if (distanceKm <= 50) {
      nearbyCount += 1;
      fatalities += toNumber(event.fatalities) || 0;
    }
  });

  const score = clamp((nearbyCount * 3) + Math.min(fatalities / 10, 8), 0, 20);

  return { nearbyCount, fatalities, score };
}

function getOperationPenalty(operationTypeId, impacts = []) {
  if (!impacts.length) return 0;

  let score = 100;
  impacts.forEach((impact) => {
    score = calculateOperationSpecificScore(
      score,
      operationTypeId,
      impact.disaster || {},
      toNumber(impact.distance) || 0
    );
  });

  return clamp(100 - score, 0, 20);
}

function getPopulationScore(populationEstimate) {
  if (!populationEstimate) return 0;
  if (populationEstimate >= 500000) return 15;
  if (populationEstimate >= 100000) return 12;
  if (populationEstimate >= 50000) return 9;
  if (populationEstimate >= 10000) return 6;
  return 3;
}

function getPriorityLevel(score) {
  if (score >= STATUS_BUCKETS.urgent.min) return STATUS_BUCKETS.urgent.label;
  if (score >= STATUS_BUCKETS.high.min) return STATUS_BUCKETS.high.label;
  if (score >= STATUS_BUCKETS.medium.min) return STATUS_BUCKETS.medium.label;
  return STATUS_BUCKETS.low.label;
}

function getTopDriver({ impactSummary, securitySummary, populationScore, criticalityBoost, operationPenalty }) {
  const drivers = [
    { key: 'hazard', score: impactSummary.hazardPressure },
    { key: 'security', score: securitySummary.score },
    { key: 'population', score: populationScore },
    { key: 'criticality', score: criticalityBoost },
    { key: 'operation', score: operationPenalty }
  ];

  drivers.sort((a, b) => b.score - a.score);
  return drivers[0]?.key || 'hazard';
}

function getRecommendedAction(topDriver, facility, impactSummary, operationConfig) {
  const facilityType = getFacilityType(facility).toLowerCase();

  if (topDriver === 'security') {
    return 'Pause movement and verify access constraints';
  }

  if (topDriver === 'population') {
    return 'Prioritize service continuity for high-exposure population';
  }

  if (topDriver === 'criticality' && facilityType.includes('warehouse')) {
    return 'Pre-position stock and verify outbound routes';
  }

  if (topDriver === 'criticality' && (facilityType.includes('hospital') || facilityType.includes('clinic'))) {
    return 'Dispatch rapid assessment and confirm facility functionality';
  }

  if (impactSummary.disasterTypes.includes('FL')) {
    return 'Check flood access and stage mobile response capacity';
  }

  if (impactSummary.disasterTypes.includes('TC')) {
    return 'Pre-position supplies before further access degradation';
  }

  if (impactSummary.disasterTypes.includes('EQ')) {
    return 'Verify structural safety and assess service interruption';
  }

  return `Review ${operationConfig.name.toLowerCase()} readiness in the next 24-72h`;
}

function getRationale({ impactSummary, securitySummary, populationEstimate, operationConfig }) {
  const parts = [];

  if (impactSummary.impactCount > 0) {
    parts.push(`${impactSummary.impactCount} nearby hazard signal${impactSummary.impactCount > 1 ? 's' : ''}`);
  }

  if (impactSummary.nearestDistance !== null) {
    parts.push(`nearest hazard ${impactSummary.nearestDistance.toFixed(1)} km away`);
  }

  if (securitySummary.nearbyCount > 0) {
    parts.push(`${securitySummary.nearbyCount} nearby ACLED event${securitySummary.nearbyCount > 1 ? 's' : ''} within 50 km`);
  }

  if (populationEstimate) {
    parts.push(`population exposure ~${populationEstimate.toLocaleString()}`);
  }

  parts.push(`${operationConfig.name} lens applied`);

  return parts.join(' | ');
}

function getDistrictLabel(district = {}, fallback = 'Selected Area') {
  const props = district.properties || {};
  return sanitizeDistrictLabel(
    district.name || props.ADM2_EN || props.NAME_2 || props.NAME || props.name || props.district,
    fallback
  );
}

function getDistrictAgeGroups(district = {}, worldPopData = {}) {
  const props = district.properties || {};
  const keys = [
    String(district.id || ''),
    district.name,
    props.ADM2_EN,
    props.NAME_2,
    props.NAME,
    props.name,
    props.district,
    district.id
  ].filter(Boolean);

  for (const key of keys) {
    const source = worldPopData[key];
    if (source?.ageGroups) {
      return source.ageGroups;
    }
  }

  return null;
}

function getDistrictHospitalStats(district = {}, osmData = null) {
  const features = osmData?.features || [];
  if (!features.length || !hasUsableGeometry(district)) {
    return { hospitals: 0, clinics: 0, hasHospitalCoverage: false };
  }

  let hospitals = 0;
  let clinics = 0;

  features.forEach((feature) => {
    const category = String(feature.properties?.category || '').toLowerCase();
    const geometry = feature.geometry;
    if (!geometry) return;

    let isInside = false;
    try {
      if (geometry.type === 'Point') {
        isInside = isPointInDistricts(geometry.coordinates[1], geometry.coordinates[0], [district]);
      } else {
        const coords = geometry.type === 'LineString'
          ? geometry.coordinates[0]
          : geometry.type === 'Polygon'
            ? geometry.coordinates[0]?.[0]
            : null;
        if (coords) {
          isInside = isPointInDistricts(coords[1], coords[0], [district]);
        }
      }
    } catch (_) {
      isInside = false;
    }

    if (!isInside) return;

    if (category === 'hospital') hospitals += 1;
    if (category === 'clinic') clinics += 1;
  });

  return {
    hospitals,
    clinics,
    hasHospitalCoverage: hospitals + clinics > 0
  };
}

function getUploadedFacilityTypeStats(facilityRows = []) {
  return facilityRows.reduce((totals, row) => {
    const facilityType = String(row.facilityType || '').toLowerCase();

    if (facilityType.includes('hospital')) {
      totals.hospitals += 1;
    }

    if (facilityType.includes('clinic')) {
      totals.clinics += 1;
    }

    return totals;
  }, { hospitals: 0, clinics: 0 });
}

function getDistrictPosture(priorityScore, disasterCount, acledCount, districtRiskLevel) {
  if (districtRiskLevel === 'very-high' || (disasterCount > 0 && acledCount > 0)) return 'Escalate attention';
  if (districtRiskLevel === 'high' || priorityScore >= 55) return 'Prepare for action';
  if (priorityScore >= 35) return 'Validate and monitor';
  return 'Monitor with readiness';
}

function getFacilityPosture(priorityScore) {
  if (priorityScore >= 75) return 'Escalate attention';
  if (priorityScore >= 55) return 'Prepare for action';
  if (priorityScore >= 35) return 'Validate and monitor';
  return 'Monitor with readiness';
}

function getDistrictRecommendedAction(disasterCount, acledCount, hasFacilityData, hasHospitalCoverage, operationConfig, districtRiskLevel) {
  if (districtRiskLevel === 'very-high') {
    return 'Escalate security, access, and response review before movement decisions';
  }
  if (disasterCount > 0 && acledCount > 0) {
    return 'Escalate access, needs, and response review before deployment decisions';
  }
  if (acledCount > 0) {
    return 'Validate security constraints before movement or engagement decisions';
  }
  if (disasterCount > 0) {
    return 'Review hazard impacts and prepare area-based response options';
  }
  if (!hasHospitalCoverage) {
    return 'Verify referral pathways and health-service coverage before escalation';
  }
  if (!hasFacilityData) {
    return `Maintain readiness and validate ${operationConfig.name.toLowerCase()} service continuity in this area`;
  }
  return `Review ${operationConfig.name.toLowerCase()} readiness in this area`;
}

function buildDistrictSoWhat({
  populationEstimate,
  ageGroups,
  hospitals,
  clinics,
  nighttimeLights = null,
  disasterCount,
  acledCount,
  hasFacilityData,
  districtRiskLevel,
  districtRiskScore,
  hazardEntry = null
}) {
  const messages = [];
  const hazardType = normalizeHazardTypeLabel(hazardEntry?.dominantHazard?.type);
  const hazardScore = toNumber(hazardEntry?.dominantHazard?.score);
  const responseScale = hazardEntry?.responseScale;

  if (populationEstimate) {
    messages.push(`A large population is present in the selected area (${populationEstimate.toLocaleString()}).`);
  }
  if (ageGroups?.under5 || ageGroups?.age60plus) {
    messages.push(`Vulnerable groups are material, including ${ageGroups?.under5?.toLocaleString?.() || ageGroups.under5} children under 5 and ${ageGroups?.age60plus?.toLocaleString?.() || ageGroups.age60plus} people aged 60+.`);
  }
  if ((hospitals || 0) + (clinics || 0) > 0) {
    messages.push(`Mapped health-service presence exists in the area (${hospitals} hospitals, ${clinics} clinics), but mapped presence does not confirm functionality or access.`);
  }
  if (nighttimeLights) {
    const classification = classifyNighttimeLights(nighttimeLights);
    messages.push(`${classification.summary}`);
  }
  if (acledCount > 0) {
    messages.push(`Current scoped conflict severity is ${districtRiskLevel.replace('-', ' ')} (score ${districtRiskScore}) based on mapped ACLED events inside the selected area.`);
  }
  if (hazardScore !== null) {
    messages.push(`Projected ${hazardType.toLowerCase()} signal is ${hazardScore}/100 with an indicative ${responseScale || 'not available'} response scale based on the current forecast and enabled environmental evidence.`);
  } else if (hazardEntry?.hazardAssessments) {
    const readinessGaps = getProjectedHazardKeyGaps(hazardEntry);
    if (readinessGaps.length > 0) {
      messages.push(`${readinessGaps[0]}.`);
    }
  }
  if (disasterCount === 0 && acledCount === 0) {
    messages.push('No currently loaded GDACS or ACLED trigger is in scope, so the case for immediate escalation is weak based on current signals alone.');
  } else if (disasterCount > 0 && acledCount === 0) {
    messages.push('Hazard signals are in scope, but no security signal is currently loaded for this area.');
  } else if (disasterCount === 0 && acledCount > 0) {
    messages.push('Security incidents are in scope, which raises movement and engagement considerations even without a current GDACS trigger.');
  } else {
    messages.push('Combined hazard and security signals suggest a more complex operating picture that may require tighter coordination and review.');
  }
  if (!hasFacilityData) {
    messages.push('No facility dataset is loaded, so prioritization is area-based rather than service-point-specific.');
  }

  return messages.join(' ');
}

function buildDistrictKeyGaps({ hasFacilityData, hasWorldPop, hasHospitalCoverage, disasterCount, acledCount, hazardEntry = null }) {
  const gaps = [];
  if (!hasFacilityData) gaps.push('Facility status and service-point coverage are not loaded');
  if (!hasWorldPop) gaps.push('Full population exposure context is incomplete');
  if (!hasHospitalCoverage) gaps.push('Health-service presence is not confirmed from current OSM data');
  if (disasterCount === 0) gaps.push('No current GDACS signal is in scope');
  if (acledCount === 0) gaps.push('No ACLED signal is in scope');
  gaps.push(...getProjectedHazardKeyGaps(hazardEntry));
  return gaps;
}

function buildDistrictLeadershipNote({ disasterCount, acledCount, populationEstimate, districtRiskLevel, hazardEntry = null }) {
  const hazardType = normalizeHazardTypeLabel(hazardEntry?.dominantHazard?.type);
  const hazardScore = toNumber(hazardEntry?.dominantHazard?.score);

  if (hazardScore !== null && hazardScore >= 65) {
    return `Leadership attention should focus on whether projected ${hazardType.toLowerCase()} conditions justify anticipatory action, pre-positioning, and tighter cross-district coordination before impacts peak.`;
  }
  if (districtRiskLevel === 'very-high') {
    return 'Leadership attention should focus on whether severe in-area security conditions require movement restrictions, elevated representation, or rapid coordination with partners.';
  }
  if (disasterCount > 0 && acledCount > 0) {
    return 'Leadership attention should focus on whether the combined hazard and security picture requires escalation, movement restrictions, or external engagement.';
  }
  if (acledCount > 0) {
    return 'The main leadership question is whether security context changes internal movement posture or external positioning.';
  }
  if (disasterCount > 0) {
    return 'The main leadership question is whether the hazard signal warrants operational escalation or anticipatory support.';
  }
  if (populationEstimate) {
    return 'This area remains strategically important because a large population could be affected quickly if conditions deteriorate, even though current loaded triggers do not justify escalation on their own.';
  }
  return 'Current signals support routine monitoring rather than escalation.';
}

function calibrateAdminLevelPriorityScore(baseScore, {
  districtRiskLevel,
  districtRiskScore,
  populationEstimate,
  disasterCount,
  acledCount,
  projectedHazardScore = null,
  projectedResponseScale = null,
  facilityCount = 0
}) {
  let calibratedScore = baseScore;

  if (districtRiskLevel === 'very-high') {
    calibratedScore = Math.max(calibratedScore, 55);
  }

  if (districtRiskLevel === 'very-high' && populationEstimate >= 100000) {
    calibratedScore = Math.max(calibratedScore, 75);
  }

  if (districtRiskLevel === 'high' && populationEstimate >= 100000) {
    calibratedScore = Math.max(calibratedScore, 55);
  }

  if (districtRiskScore >= 50) {
    calibratedScore = Math.max(calibratedScore, 75);
  }

  if (districtRiskLevel === 'very-high' && disasterCount > 0 && acledCount > 0) {
    calibratedScore = Math.max(calibratedScore, 80);
  }

  if (projectedHazardScore !== null) {
    const lowEndHazardFloor = clamp(
      Math.round((projectedHazardScore * 0.45) + Math.min(facilityCount * 0.12, 4)),
      0,
      24
    );

    if (projectedHazardScore >= 15) {
      calibratedScore = Math.max(calibratedScore, lowEndHazardFloor);
    }

    if (projectedHazardScore >= 75) {
      calibratedScore = Math.max(calibratedScore, 72);
    } else if (projectedHazardScore >= 60) {
      calibratedScore = Math.max(calibratedScore, 56);
    } else if (projectedHazardScore >= 45) {
      calibratedScore = Math.max(calibratedScore, 40);
    } else if (projectedHazardScore >= 30) {
      calibratedScore = Math.max(calibratedScore, 24);
    }
  }

  if (projectedResponseScale === 'large') {
    calibratedScore = Math.max(calibratedScore, 70);
  } else if (projectedResponseScale === 'moderate') {
    calibratedScore = Math.max(calibratedScore, 50);
  }

  return clamp(Math.round(calibratedScore), 0, 100);
}

function buildDistrictOnlyRows(selectedDistricts, scopedDisasters, scopedAcledData, scopedWorldPopData, operationConfig, districtHazardAnalysis = null) {
  return selectedDistricts.map((district, index) => {
    const districtName = getDistrictLabel(district, `Selected Area ${index + 1}`);
    const populationEstimate = getDistrictPopulationEstimate(district, scopedWorldPopData);
    const nighttimeLights = getNighttimeLightsEvidence(district, districtHazardAnalysis, index);
    const nighttimeLightsClassification = nighttimeLights ? classifyNighttimeLights(nighttimeLights) : null;
    const hazardEntry = getDistrictHazardEntry(district, districtHazardAnalysis, index);
    const hazardProfile = getProjectedHazardProfile(hazardEntry);
    const projectedHazardScore = toNumber(hazardProfile?.combinedScore ?? hazardEntry?.dominantHazard?.score);
    const projectedHazardModifier = getProjectedHazardModifier(hazardEntry);
    const districtRisk = scoreDistrictRisk(district, {
      disasters: scopedDisasters,
      acledData: scopedAcledData
    });
    const hazardScore = clamp(districtRisk.disasterScore, 0, 35);
    const securityScore = clamp(districtRisk.securityScore, 0, 40);
    const populationScore = getPopulationScore(populationEstimate);
    const weightedScore = calibrateAdminLevelPriorityScore(
      clamp(hazardScore + securityScore + populationScore + projectedHazardModifier, 0, 100),
      {
        districtRiskLevel: districtRisk.level,
        districtRiskScore: districtRisk.score,
        populationEstimate,
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        projectedHazardScore,
        projectedResponseScale: hazardEntry?.responseScale || null,
        facilityCount: 0
      }
    );
    const priorityLevel = getPriorityLevel(weightedScore);
    const recommendedAction = getDistrictRecommendedAction(
      districtRisk.disasterCount,
      districtRisk.acledCount,
      false,
      false,
      operationConfig,
      districtRisk.level
    );

    return {
      district: districtName,
      facilityCount: 0,
      urgentCount: priorityLevel === 'Urgent' ? 1 : 0,
      highestPriorityScore: Math.round(weightedScore),
      totalPriorityScore: Math.round(weightedScore),
      populationEstimate,
      nighttimeLights,
      nighttimeLightsIntensity: nighttimeLightsClassification?.intensity || null,
      nighttimeSupportContext: nighttimeLightsClassification?.supportContext || null,
      actions: [recommendedAction],
      posture: getDistrictPosture(weightedScore, districtRisk.disasterCount, districtRisk.acledCount, districtRisk.level),
      soWhat: buildDistrictSoWhat({
        populationEstimate,
        ageGroups: null,
        hospitals: 0,
        clinics: 0,
        nighttimeLights,
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        hasFacilityData: false,
        districtRiskLevel: districtRisk.level,
        districtRiskScore: districtRisk.score,
        hazardEntry
      }),
      recommendedAction,
      keyGaps: buildDistrictKeyGaps({
        hasFacilityData: false,
        hasWorldPop: Boolean(populationEstimate || nighttimeLights),
        hasHospitalCoverage: false,
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        hazardEntry
      }),
      leadershipNote: buildDistrictLeadershipNote({
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        populationEstimate,
        districtRiskLevel: districtRisk.level,
        hazardEntry
      }),
      disasterCount: districtRisk.disasterCount,
      acledCount: districtRisk.acledCount,
      districtRiskLevel: districtRisk.level,
      districtRiskScore: districtRisk.score,
      projectedHazardType: normalizeHazardTypeLabel(hazardEntry?.dominantHazard?.type),
      projectedHazardScore,
      projectedHazardLevel: hazardEntry?.dominantHazard?.level || 'not-ready',
      projectedHazardLabel: hazardProfile?.label || normalizeHazardTypeLabel(hazardEntry?.dominantHazard?.type),
      projectedCombinedHazardScore: hazardProfile?.combinedScore ?? projectedHazardScore,
      projectedFloodScore: hazardEntry?.hazardScores?.flood ?? null,
      projectedDroughtScore: hazardEntry?.hazardScores?.drought ?? null,
      projectedHeatScore: hazardEntry?.hazardScores?.heat ?? null,
      projectedResponseScale: hazardEntry?.responseScale || 'not available',
      projectedConfidence: hazardEntry?.confidence || 'low',
      projectedEvidenceBase: hazardEntry?.evidenceBase || 'limited',
      projectedTopDrivers: Array.isArray(hazardEntry?.drivers) ? hazardEntry.drivers.slice(0, 3) : [],
      projectedHazardSummary: hazardEntry?.responseScaleReasoning || null,
      hazardReadinessGaps: getProjectedHazardKeyGaps(hazardEntry),
      priorityScore: Math.round(weightedScore),
      priorityLevel,
      rank: index + 1
    };
  })
  .sort((a, b) => b.priorityScore - a.priorityScore)
  .map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildDistrictRowsFromScope(selectedDistricts, scopedDisasters, scopedAcledData, scopedWorldPopData, osmData, operationConfig, facilityRows = [], districtHazardAnalysis = null) {
  const facilityRowsByDistrict = facilityRows.reduce((acc, row) => {
    const key = normalizeDistrictKey(row.district || 'Unassigned');
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(row);
    return acc;
  }, new Map());

  const rows = selectedDistricts.map((district) => {
    const districtName = getDistrictLabel(district);
    const districtFacilities = Array.from(new Map(
      getDistrictCandidateKeys(district, districtName)
        .flatMap((key) => facilityRowsByDistrict.get(key) || [])
        .map((row) => [row.id, row])
    ).values());
    const uploadedFacilityTypeStats = getUploadedFacilityTypeStats(districtFacilities);
    const populationEstimate = getDistrictPopulationEstimate(district, scopedWorldPopData);
    const ageGroups = getDistrictAgeGroups(district, scopedWorldPopData);
    const nighttimeLights = getNighttimeLightsEvidence(district, districtHazardAnalysis);
    const nighttimeLightsClassification = nighttimeLights ? classifyNighttimeLights(nighttimeLights) : null;
    const hospitalStats = getDistrictHospitalStats(district, osmData);
    const hazardEntry = getDistrictHazardEntry(district, districtHazardAnalysis);
    const hazardProfile = getProjectedHazardProfile(hazardEntry);
    const projectedHazardScore = toNumber(hazardProfile?.combinedScore ?? hazardEntry?.dominantHazard?.score);
    const projectedHazardModifier = getProjectedHazardModifier(hazardEntry);
    const districtRisk = scoreDistrictRisk(district, {
      disasters: scopedDisasters,
      acledData: scopedAcledData
    });

    let priorityScore;
    let urgentCount;
    let highestPriorityScore;
    let actions;
    let recommendedAction;

    if (districtFacilities.length > 0) {
      const totalPriorityScore = districtFacilities.reduce((sum, row) => sum + row.priorityScore, 0);
      const averageScore = totalPriorityScore / districtFacilities.length;
      urgentCount = districtFacilities.filter((row) => row.priorityLevel === 'Urgent').length;
      highestPriorityScore = Math.max(...districtFacilities.map((row) => row.priorityScore));
      priorityScore = calibrateAdminLevelPriorityScore(
        clamp(averageScore + Math.min(urgentCount * 6, 18) + Math.min(districtRisk.securityScore / 4, 12) + projectedHazardModifier, 0, 100),
        {
          districtRiskLevel: districtRisk.level,
          districtRiskScore: districtRisk.score,
          populationEstimate,
          disasterCount: districtRisk.disasterCount,
          acledCount: districtRisk.acledCount,
          projectedHazardScore,
          projectedResponseScale: hazardEntry?.responseScale || null,
          facilityCount: districtFacilities.length
        }
      );
      actions = Array.from(new Set(districtFacilities.map((row) => row.recommendedAction))).slice(0, 3);
      recommendedAction = actions[0] || getDistrictRecommendedAction(districtRisk.disasterCount, districtRisk.acledCount, true, hospitalStats.hasHospitalCoverage, operationConfig, districtRisk.level);
    } else {
      const baseRows = buildDistrictOnlyRows([district], scopedDisasters, scopedAcledData, scopedWorldPopData, operationConfig, districtHazardAnalysis);
      priorityScore = baseRows[0]?.priorityScore || 0;
      urgentCount = baseRows[0]?.urgentCount || 0;
      highestPriorityScore = baseRows[0]?.highestPriorityScore || priorityScore;
      actions = baseRows[0]?.actions || [];
      recommendedAction = baseRows[0]?.recommendedAction || actions[0];
    }

    return {
      district: districtName,
      facilityCount: districtFacilities.length,
      uploadedHospitals: uploadedFacilityTypeStats.hospitals,
      uploadedClinics: uploadedFacilityTypeStats.clinics,
      urgentCount,
      highestPriorityScore,
      totalPriorityScore: priorityScore,
      populationEstimate,
      nighttimeLights,
      nighttimeLightsIntensity: nighttimeLightsClassification?.intensity || null,
      nighttimeSupportContext: nighttimeLightsClassification?.supportContext || null,
      ageGroups,
      hospitals: hospitalStats.hospitals,
      clinics: hospitalStats.clinics,
      hasHospitalCoverage: hospitalStats.hasHospitalCoverage,
      disasterCount: districtRisk.disasterCount,
      acledCount: districtRisk.acledCount,
      districtRiskLevel: districtRisk.level,
      districtRiskScore: districtRisk.score,
      actions,
      posture: getDistrictPosture(priorityScore, districtRisk.disasterCount, districtRisk.acledCount, districtRisk.level),
      soWhat: buildDistrictSoWhat({
        populationEstimate,
        ageGroups,
        hospitals: hospitalStats.hospitals,
        clinics: hospitalStats.clinics,
        nighttimeLights,
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        hasFacilityData: districtFacilities.length > 0,
        districtRiskLevel: districtRisk.level,
        districtRiskScore: districtRisk.score,
        hazardEntry
      }),
      recommendedAction,
      keyGaps: buildDistrictKeyGaps({
        hasFacilityData: districtFacilities.length > 0,
        hasWorldPop: Boolean(populationEstimate || ageGroups || nighttimeLights),
        hasHospitalCoverage: hospitalStats.hasHospitalCoverage,
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        hazardEntry
      }),
      leadershipNote: buildDistrictLeadershipNote({
        disasterCount: districtRisk.disasterCount,
        acledCount: districtRisk.acledCount,
        populationEstimate,
        districtRiskLevel: districtRisk.level,
        hazardEntry
      }),
      projectedHazardType: normalizeHazardTypeLabel(hazardEntry?.dominantHazard?.type),
      projectedHazardScore,
      projectedHazardLevel: hazardEntry?.dominantHazard?.level || 'not-ready',
      projectedHazardLabel: hazardProfile?.label || normalizeHazardTypeLabel(hazardEntry?.dominantHazard?.type),
      projectedCombinedHazardScore: hazardProfile?.combinedScore ?? projectedHazardScore,
      projectedFloodScore: hazardEntry?.hazardScores?.flood ?? null,
      projectedDroughtScore: hazardEntry?.hazardScores?.drought ?? null,
      projectedHeatScore: hazardEntry?.hazardScores?.heat ?? null,
      projectedResponseScale: hazardEntry?.responseScale || 'not available',
      projectedConfidence: hazardEntry?.confidence || 'low',
      projectedEvidenceBase: hazardEntry?.evidenceBase || 'limited',
      projectedTopDrivers: Array.isArray(hazardEntry?.drivers) ? hazardEntry.drivers.slice(0, 3) : [],
      projectedHazardSummary: hazardEntry?.responseScaleReasoning || null,
      hazardReadinessGaps: getProjectedHazardKeyGaps(hazardEntry),
      priorityScore,
      priorityLevel: getPriorityLevel(priorityScore)
    };
  });

  return rows
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildPrioritizationBoard({
  facilities = [],
  impactedFacilities = [],
  disasters = [],
  acledData = [],
  districts = [],
  selectedDistricts = [],
  worldPopData = {},
  osmData = null,
  operationType = 'general',
  districtHazardAnalysis = null,
  enabledEvidenceLayers = []
}) {
  if (!Array.isArray(selectedDistricts) || selectedDistricts.length === 0) {
    throw new Error('selectedDistricts is required');
  }

  const operationConfig = getOperationType(operationType);
  const scopedFacilities = facilities.filter((facility) =>
    isPointInDistricts(facility.latitude, facility.longitude, selectedDistricts)
  );
  const scopedFacilityIds = new Set(scopedFacilities.map((facility) => getFacilityId(facility)));
  const scopedImpactedFacilities = impactedFacilities.filter((item) =>
    scopedFacilityIds.has(getFacilityId(item.facility))
  );
  const scopedDisasters = disasters.filter((disaster) =>
    isPointInDistricts(disaster.latitude, disaster.longitude, selectedDistricts)
  );
  const scopedAcledData = acledData.filter((event) =>
    isPointInDistricts(event.latitude, event.longitude, selectedDistricts)
  );
  const scopedWorldPopData = getScopedWorldPopData(worldPopData, selectedDistricts);
  const impactMap = new Map(
    scopedImpactedFacilities.map((item) => [getFacilityId(item.facility), item])
  );

  const facilityRows = scopedFacilities.map((facility) => {
    const impactRecord = impactMap.get(getFacilityId(facility));
    const impacts = impactRecord?.impacts || [];
    const impactSummary = summarizeImpacts(impacts);
    const securitySummary = summarizeSecurity(facility, scopedAcledData);
    const populationEstimate = getPopulationEstimate(
      impactRecord?.facility || facility,
      scopedWorldPopData
    );
    const populationScore = getPopulationScore(populationEstimate);
    const criticalityBoost = getCriticalityBoost(getFacilityType(facility));
    const operationPenalty = getOperationPenalty(operationType, impacts);

    const rawScore = clamp(
      impactSummary.hazardPressure +
      securitySummary.score +
      populationScore +
      criticalityBoost +
      operationPenalty,
      0,
      100
    );

    const priorityScore = Math.round(rawScore);
    const priorityLevel = getPriorityLevel(priorityScore);
    const topDriver = getTopDriver({
      impactSummary,
      securitySummary,
      populationScore,
      criticalityBoost,
      operationPenalty
    });

    return {
      id: getFacilityId(facility),
      facility,
      district: resolveFacilityDistrict(impactRecord?.facility || facility, selectedDistricts),
      facilityType: getFacilityType(facility) || 'Unspecified',
      populationEstimate,
      priorityScore,
      priorityLevel,
      topDriver,
      recommendedAction: getRecommendedAction(topDriver, facility, impactSummary, operationConfig),
      rationale: getRationale({
        impactSummary,
        securitySummary,
        populationEstimate,
        operationConfig
      }),
      impactSummary,
      securitySummary
    };
  })
  .sort((a, b) => b.priorityScore - a.priorityScore)
  .map((row, index) => ({ ...row, rank: index + 1 }));

  const fallbackDistrictRows = buildDistrictRowsFromScope(
    selectedDistricts,
    scopedDisasters,
    scopedAcledData,
    scopedWorldPopData,
    osmData,
    operationConfig,
    facilityRows,
    districtHazardAnalysis
  );

  const readyDistrictHazardCount = (districtHazardAnalysis?.districts || []).filter((district) =>
    Object.values(district?.hazardAssessments || {}).some((assessment) => assessment?.status === 'ready')
  ).length;
  const hasNighttimeLights = enabledEvidenceLayers.includes('nighttime_lights');
  const availableSignals = [
    selectedDistricts.length > 0 ? 'district boundary' : null,
    scopedDisasters.length > 0 ? 'GDACS disasters' : null,
    scopedAcledData.length > 0 ? 'ACLED security' : null,
    Object.keys(scopedWorldPopData).length > 0 ? 'WorldPop population' : null,
    (osmData?.features?.length || 0) > 0 ? 'OSM infrastructure' : null,
    hasNighttimeLights ? 'Nighttime lights context' : null,
    districtHazardAnalysis?.districts?.length > 0 ? 'district hazard analysis' : null
  ].filter(Boolean);

  const missingSignals = [];
  if (scopedAcledData.length === 0) missingSignals.push('ACLED security');
  if (Object.keys(scopedWorldPopData).length === 0) missingSignals.push('WorldPop population');
  if ((osmData?.features?.length || 0) === 0) missingSignals.push('OSM infrastructure');
  if (!hasNighttimeLights) missingSignals.push('Nighttime lights context');
  if (!(districtHazardAnalysis?.districts?.length > 0)) missingSignals.push('district hazard analysis');

  let confidenceLevel =
    availableSignals.length >= 5 ? 'High' :
    availableSignals.length >= 3 ? 'Medium' :
    'Low';

  if (readyDistrictHazardCount === 0) {
    confidenceLevel = 'Low';
  } else if (
    scopedAcledData.length === 0 ||
    Object.keys(scopedWorldPopData).length === 0 ||
    (osmData?.features?.length || 0) === 0
  ) {
    confidenceLevel = confidenceLevel === 'High' ? 'Medium' : confidenceLevel;
  }

  const summary = {
    operationName: operationConfig.name,
    selectedAreaCount: selectedDistricts.length,
    totalFacilities: facilityRows.length,
    urgentFacilities: facilityRows.filter((row) => row.priorityLevel === 'Urgent').length,
    highFacilities: facilityRows.filter((row) => row.priorityLevel === 'High').length,
    impactedFacilities: scopedImpactedFacilities.length,
    totalDisasters: scopedDisasters.length,
    totalAcledEvents: scopedAcledData.length,
    districtCount: districts.length || fallbackDistrictRows.length,
    hasFacilityData: facilityRows.length > 0,
    districtHazardSummary: districtHazardAnalysis?.summary || null,
    confidence: {
      level: confidenceLevel,
      availableSignals,
      missingSignals,
      readyDistrictHazardCount
    }
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    facilityRows,
    districtRows: fallbackDistrictRows
  };
}

export function buildFacilityContextualAnalysis({
  facility = {},
  impacts = [],
  acledData = [],
  selectedDistricts = [],
  worldPopData = {},
  operationType = 'general'
}) {
  if (!facility || (!facility.latitude && !facility.longitude && !facility.name)) {
    throw new Error('facility is required');
  }

  const operationConfig = getOperationType(operationType);
  const scopedAcledData = Array.isArray(selectedDistricts) && selectedDistricts.length > 0
    ? acledData.filter((event) => isPointInDistricts(event.latitude, event.longitude, selectedDistricts))
    : acledData;
  const scopedWorldPopData = Array.isArray(selectedDistricts) && selectedDistricts.length > 0
    ? getScopedWorldPopData(worldPopData, selectedDistricts)
    : worldPopData;

  const impactSummary = summarizeImpacts(impacts);
  const securitySummary = summarizeSecurity(facility, scopedAcledData);
  const populationEstimate = getPopulationEstimate(facility, scopedWorldPopData);
  const populationScore = getPopulationScore(populationEstimate);
  const criticalityBoost = getCriticalityBoost(getFacilityType(facility));
  const operationPenalty = getOperationPenalty(operationType, impacts);
  const priorityScore = Math.round(clamp(
    impactSummary.hazardPressure +
    securitySummary.score +
    populationScore +
    criticalityBoost +
    operationPenalty,
    0,
    100
  ));
  const priorityLevel = getPriorityLevel(priorityScore);
  const topDriver = getTopDriver({
    impactSummary,
    securitySummary,
    populationScore,
    criticalityBoost,
    operationPenalty
  });

  const availableSignals = [
    impacts.length > 0 ? 'hazard exposure' : null,
    scopedAcledData.length > 0 ? 'ACLED security' : null,
    populationEstimate ? 'population exposure' : null,
    getFacilityType(facility) ? 'facility criticality' : null
  ].filter(Boolean);
  const missingSignals = [];
  if (impacts.length === 0) missingSignals.push('hazard exposure');
  if (scopedAcledData.length === 0) missingSignals.push('ACLED security');
  if (!populationEstimate) missingSignals.push('population exposure');

  return {
    generatedAt: new Date().toISOString(),
    scopeType: 'facility',
    facilityName: facility.name || 'Unnamed facility',
    district: resolveFacilityDistrict(facility, selectedDistricts),
    facilityType: getFacilityType(facility) || 'Unspecified',
    operationName: operationConfig.name,
    priorityScore,
    priorityLevel,
    posture: getFacilityPosture(priorityScore),
    topDriver,
    recommendedAction: getRecommendedAction(topDriver, facility, impactSummary, operationConfig),
    rationale: getRationale({
      impactSummary,
      securitySummary,
      populationEstimate,
      operationConfig
    }),
    populationEstimate,
    signals: {
      hazardPressure: Math.round(impactSummary.hazardPressure),
      hazardCount: impactSummary.impactCount,
      hazardTypes: impactSummary.disasterTypes,
      nearestHazardKm: impactSummary.nearestDistance,
      securityEventCount50km: securitySummary.nearbyCount,
      securityFatalities50km: securitySummary.fatalities,
      securityScore: Math.round(securitySummary.score),
      populationScore,
      criticalityBoost,
      operationPenalty
    },
    confidence: {
      level: availableSignals.length >= 3 ? 'High' : availableSignals.length >= 2 ? 'Medium' : 'Low',
      availableSignals,
      missingSignals
    }
  };
}
