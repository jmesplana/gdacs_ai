import { filterFacilitiesToDistricts, filterItemsToDistricts, getDistrictScopeKeys } from './analysisScope';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const EVIDENCE_LAYER_LABELS = {
  flood_context: 'Flood Context',
  drought_context: 'Drought Context'
};

function formatLayerLabel(layerKey) {
  return EVIDENCE_LAYER_LABELS[layerKey] || layerKey;
}

function getDistrictName(district = {}, index = 0) {
  const props = district.properties || {};
  return district.name || props.ADM2_EN || props.NAME_2 || props.NAME || props.name || props.district || `Selected Area ${index + 1}`;
}

function getDistrictCenter(district = {}) {
  if (district.bounds) {
    return {
      latitude: (district.bounds.minLat + district.bounds.maxLat) / 2,
      longitude: (district.bounds.minLng + district.bounds.maxLng) / 2
    };
  }

  const geometry = district.geometry;
  if (!geometry?.coordinates) return null;

  const coords = geometry.type === 'Polygon'
    ? geometry.coordinates[0]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates[0]?.[0]
      : null;

  if (!coords?.length) return null;

  const sums = coords.reduce((acc, [lng, lat]) => ({
    lat: acc.lat + lat,
    lng: acc.lng + lng
  }), { lat: 0, lng: 0 });

  return {
    latitude: sums.lat / coords.length,
    longitude: sums.lng / coords.length
  };
}

function getWorldPopEntry(district = {}, worldPopData = {}, index = 0) {
  const keys = getDistrictScopeKeys(district, index);

  for (const key of keys) {
    if (worldPopData[key]) return worldPopData[key];
  }

  return null;
}

function getPopulationEstimate(district = {}, worldPopData = {}, index = 0) {
  const worldPopEntry = getWorldPopEntry(district, worldPopData, index);
  if (worldPopEntry && typeof worldPopEntry === 'object') {
    const value = Math.round(
      toNumber(worldPopEntry.total) ||
      toNumber(worldPopEntry.population) ||
      toNumber(worldPopEntry.totalPopulation) ||
      toNumber(worldPopEntry.ageGroups?.total) ||
      0
    );
    if (value) return value;
  }

  const props = district.properties || {};
  return Math.round(
    toNumber(district.population) ||
    toNumber(props.population) ||
    toNumber(props.POP) ||
    0
  ) || null;
}

function summarizeWeather(weatherData = null) {
  const daily = weatherData?.daily;
  if (!daily?.time?.length) {
    return null;
  }

  const precipitation = daily.precipitation_sum || [];
  const maxTemps = daily.temperature_2m_max || [];
  const humidity = daily.relative_humidity_2m_mean || [];
  const wind = daily.windspeed_10m_max || [];

  const totalRain = precipitation.reduce((sum, value) => sum + (toNumber(value) || 0), 0);
  const maxDailyRain = precipitation.reduce((max, value) => Math.max(max, toNumber(value) || 0), 0);
  const heavyRainDays = precipitation.filter((value) => (toNumber(value) || 0) >= 25).length;
  const dryDays = precipitation.filter((value) => (toNumber(value) || 0) < 1).length;
  const maxTemp = maxTemps.reduce((max, value) => Math.max(max, toNumber(value) || 0), 0);
  const avgHumidity = humidity.length
    ? humidity.reduce((sum, value) => sum + (toNumber(value) || 0), 0) / humidity.length
    : null;
  const maxWind = wind.reduce((max, value) => Math.max(max, toNumber(value) || 0), 0);

  return {
    startDate: daily.time[0],
    endDate: daily.time[daily.time.length - 1],
    totalRainMm: Math.round(totalRain),
    maxDailyRainMm: Math.round(maxDailyRain),
    heavyRainDays,
    dryDays,
    maxTempC: Math.round(maxTemp * 10) / 10,
    avgHumidityPct: avgHumidity === null ? null : Math.round(avgHumidity),
    maxWindKmh: Math.round(maxWind)
  };
}

function getRainfallLevel(totalRainMm = 0, maxDailyRainMm = 0) {
  if (totalRainMm >= 120 || maxDailyRainMm >= 60) return 'high';
  if (totalRainMm >= 70 || maxDailyRainMm >= 35) return 'medium';
  return 'low';
}

function getFloodScore(weatherSummary, scopedDisasters = [], facilityCount = 0, floodEvidence = null) {
  if (!weatherSummary || !floodEvidence) return { score: 0, drivers: [] };

  const floodSignals = scopedDisasters.filter((item) => {
    const label = String(item.eventType || item.eventName || item.title || '').toLowerCase();
    return label.includes('flood') || label.includes('storm') || label.includes('cyclone');
  }).length;

  const rainComponent = clamp((weatherSummary.totalRainMm / 120) * 30, 0, 30);
  const peakRainComponent = clamp((weatherSummary.maxDailyRainMm / 60) * 20, 0, 20);
  const consecutiveComponent = clamp(weatherSummary.heavyRainDays * 5, 0, 15);
  const terrainWaterComponent = clamp((toNumber(floodEvidence.floodContextMean) || 0) * 20, 0, 20);
  const hazardComponent = clamp(floodSignals * 6, 0, 12);
  const exposureComponent = clamp(facilityCount * 1.5, 0, 8);

  const drivers = [
    {
      key: 'forecast_rain_total',
      label: 'Forecast rainfall total',
      value: weatherSummary.totalRainMm,
      unit: 'mm / 7d',
      weight: 0.3,
      source: 'Open-Meteo'
    },
    {
      key: 'peak_daily_rain',
      label: 'Peak daily rainfall',
      value: weatherSummary.maxDailyRainMm,
      unit: 'mm / day',
      weight: 0.2,
      source: 'Open-Meteo'
    },
    {
      key: 'heavy_rain_days',
      label: 'Heavy-rain days',
      value: weatherSummary.heavyRainDays,
      unit: 'days',
      weight: 0.15,
      source: 'Open-Meteo'
    },
    {
      key: 'flood_context',
      label: 'Flood-prone terrain and water context',
      value: Math.round((toNumber(floodEvidence.floodContextMean) || 0) * 100),
      unit: '/ 100',
      weight: 0.2,
      source: 'SRTM + JRC Surface Water'
    }
  ];

  if (floodSignals > 0) {
    drivers.push({
      key: 'current_hazard_signal',
      label: 'Current hazard signals in scope',
      value: floodSignals,
      unit: 'events',
      weight: 0.1,
      source: 'GDACS'
    });
  }

  if (facilityCount > 0) {
    drivers.push({
      key: 'facilities_in_scope',
      label: 'Facilities in scope',
      value: facilityCount,
      unit: 'facilities',
      weight: 0.06,
      source: 'User upload'
    });
  }

  return {
    score: Math.round(clamp(rainComponent + peakRainComponent + consecutiveComponent + terrainWaterComponent + hazardComponent + exposureComponent, 0, 100)),
    drivers
  };
}

function getDroughtScore(weatherSummary, scopedDisasters = [], droughtEvidence = null) {
  if (!weatherSummary || !droughtEvidence) return { score: 0, drivers: [] };

  const droughtSignals = scopedDisasters.filter((item) => {
    const label = String(item.eventType || item.eventName || item.title || '').toLowerCase();
    return label.includes('drought') || label.includes('dry');
  }).length;

  const dryComponent = clamp((weatherSummary.dryDays / 7) * 16, 0, 16);
  const rainDeficitComponent = clamp(((50 - (toNumber(droughtEvidence.rain30dMm) || 0)) / 50) * 24, 0, 24);
  const heatComponent = clamp((((toNumber(droughtEvidence.temp14dC) || weatherSummary.maxTempC) - 30) / 10) * 22, 0, 22);
  const contextComponent = clamp((toNumber(droughtEvidence.droughtContextMean) || 0) * 18, 0, 18);
  const hazardComponent = clamp(droughtSignals * 10, 0, 20);
  const persistenceBooster = weatherSummary.dryDays >= 6 && weatherSummary.totalRainMm <= 10 ? 6 : 0;
  const reinforcingSignalCount = [
    (toNumber(droughtEvidence.temp14dC) || weatherSummary.maxTempC) >= 34 ? 1 : 0,
    droughtSignals > 0 ? 1 : 0,
    (toNumber(droughtEvidence.rain30dMm) || weatherSummary.totalRainMm) <= 20 ? 1 : 0
  ].reduce((sum, value) => sum + value, 0);

  const drivers = [
    {
      key: 'dry_days',
      label: 'Dry days in forecast',
      value: weatherSummary.dryDays,
      unit: 'days',
      weight: 0.3,
      source: 'Open-Meteo'
    },
    {
      key: 'low_rain_total',
      label: 'Recent rainfall baseline',
      value: Math.round(toNumber(droughtEvidence.rain30dMm) || 0),
      unit: 'mm / 30d',
      weight: 0.24,
      source: 'CHIRPS'
    },
    {
      key: 'heat_stress',
      label: '14-day mean temperature',
      value: Math.round((toNumber(droughtEvidence.temp14dC) || weatherSummary.maxTempC) * 10) / 10,
      unit: '°C',
      weight: 0.24,
      source: 'ERA5-Land'
    },
    {
      key: 'drought_context',
      label: 'Drought context index',
      value: Math.round((toNumber(droughtEvidence.droughtContextMean) || 0) * 100),
      unit: '/ 100',
      weight: 0.18,
      source: 'CHIRPS + ERA5-Land'
    }
  ];

  if (droughtSignals > 0) {
    drivers.push({
      key: 'current_drought_signal',
      label: 'Current drought-related signals in scope',
      value: droughtSignals,
      unit: 'events',
      weight: 0.24,
      source: 'GDACS'
    });
  }

  if (persistenceBooster > 0) {
    drivers.push({
      key: 'multi_day_dry_pattern',
      label: 'Persistent dry pattern',
      value: `${weatherSummary.dryDays} dry days / ${weatherSummary.totalRainMm} mm`,
      unit: '',
      weight: 0.12,
      source: 'Open-Meteo'
    });
  }

  let score = dryComponent + rainDeficitComponent + heatComponent + contextComponent + hazardComponent + persistenceBooster;

  if (reinforcingSignalCount === 0) {
    score = Math.min(score, 28);
  } else if (reinforcingSignalCount === 1 && droughtSignals === 0) {
    score = Math.min(score, 45);
  }

  return {
    score: Math.round(clamp(score, 0, 100)),
    drivers
  };
}

function getHeatScore(weatherSummary) {
  if (!weatherSummary) return { score: 0, drivers: [] };

  const maxTempComponent = clamp(((weatherSummary.maxTempC - 30) / 12) * 70, 0, 70);
  const humidityComponent = clamp((((weatherSummary.avgHumidityPct || 0) - 55) / 30) * 30, 0, 30);

  return {
    score: Math.round(clamp(maxTempComponent + humidityComponent, 0, 100)),
    drivers: [
      {
        key: 'max_temperature',
        label: 'Maximum temperature',
        value: weatherSummary.maxTempC,
        unit: '°C',
        weight: 0.7,
        source: 'Open-Meteo'
      },
      {
        key: 'mean_humidity',
        label: 'Average humidity',
        value: weatherSummary.avgHumidityPct,
        unit: '%',
        weight: 0.3,
        source: 'Open-Meteo'
      }
    ]
  };
}

function getRiskLevel(score) {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function getHazardReadiness(type, enabledLayerSet) {
  const requiredLayers = type === 'flood'
    ? ['flood_context']
    : type === 'drought'
      ? ['drought_context']
      : [];
  const missingLayers = requiredLayers.filter((layer) => !enabledLayerSet.has(layer));

  return {
    ready: missingLayers.length === 0,
    requiredLayers,
    missingLayers
  };
}

function getResponseScale(score, populationEstimate = 0, facilityCount = 0, securitySignals = 0) {
  const exposurePressure = (
    clamp((populationEstimate / 1000000) * 8, 0, 8) +
    clamp(facilityCount * 0.4, 0, 6) +
    clamp(securitySignals * 2, 0, 6)
  );
  const responsePressure = score + exposurePressure;

  if (score < 45) return 'small';
  if (score < 65) {
    return responsePressure >= 62 ? 'moderate' : 'small';
  }
  if (score < 80) {
    return responsePressure >= 88 ? 'large' : 'moderate';
  }
  return responsePressure >= 92 ? 'large' : 'moderate';
}

function getConfidence({
  weatherSummary,
  populationEstimate,
  facilityCount,
  hasGeometry,
  disasterSignalCount = 0,
  securitySignalCount = 0
}) {
  let score = 0;
  if (hasGeometry) score += 1;
  if (weatherSummary) score += 1;
  if (populationEstimate) score += 1;
  if (facilityCount > 0) score += 1;
  if (disasterSignalCount > 0 || securitySignalCount > 0) score += 1;

  if (!weatherSummary || !hasGeometry) return 'low';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function getEvidenceBase({
  weatherSummary,
  disasterSignalCount = 0,
  securitySignalCount = 0,
  populationEstimate,
  facilityCount = 0,
  hasFloodEvidence = false,
  hasDroughtEvidence = false
}) {
  if (!weatherSummary) return 'limited';
  if (hasFloodEvidence || hasDroughtEvidence) return 'forecast plus GEE district evidence';
  if (disasterSignalCount > 0 || securitySignalCount > 0) return 'forecast plus active-context signals';
  if (populationEstimate || facilityCount > 0) return 'forecast plus exposure context';
  return 'forecast-only';
}

function getResponseScaleReasoning({
  responseScale,
  dominantHazardType,
  dominantHazardScore,
  populationEstimate,
  facilityCount,
  securitySignalCount
}) {
  const explanation = [
    `${dominantHazardType[0].toUpperCase()}${dominantHazardType.slice(1)} risk is ${dominantHazardScore}/100.`
  ];

  if (dominantHazardScore < 45) {
    explanation.push('The projected hazard signal is below the response-escalation threshold, so exposure does not push this case beyond a small response scale.');
  } else if (dominantHazardScore < 65) {
    explanation.push('Exposure can raise the response scale to moderate, but only when the hazard signal is already meaningful.');
  } else {
    explanation.push('A stronger projected hazard makes exposure and operational stress more relevant to the response scale.');
  }

  if (populationEstimate) {
    explanation.push(`Population exposure is treated as a modifier, not a primary trigger (${populationEstimate.toLocaleString()} people in scope).`);
  }

  if (facilityCount > 0) {
    explanation.push(`${facilityCount} facilities in scope add operational consequence but do not dominate the score.`);
  }

  if (securitySignalCount > 0) {
    explanation.push(`${securitySignalCount} ACLED events add operational pressure to the response estimate.`);
  }

  explanation.push(`Indicative response scale: ${responseScale}.`);
  return explanation.join(' ');
}

export function buildDistrictHazardAnalysis({
  districts = [],
  facilities = [],
  disasters = [],
  acledData = [],
  worldPopData = {},
  weatherByDistrict = {},
  geeEvidenceByDistrict = {},
  timeWindowDays = 7,
  enabledEvidenceLayers = []
}) {
  const enabledLayerSet = new Set(enabledEvidenceLayers);
  const analyzedDistricts = districts.map((district, index) => {
    const districtName = getDistrictName(district, index);
    const districtId = district.id ?? index;
    const scopedFacilities = filterFacilitiesToDistricts(facilities, [district]);
    const scopedDisasters = filterItemsToDistricts(disasters, [district]);
    const scopedAcled = filterItemsToDistricts(acledData, [district]);
    const populationEstimate = getPopulationEstimate(district, worldPopData, index);
    const weatherSummary = summarizeWeather(weatherByDistrict[districtId]);
    const districtEvidence = geeEvidenceByDistrict[String(districtId)] || geeEvidenceByDistrict[districtId] || {};
    const floodReadiness = getHazardReadiness('flood', enabledLayerSet);
    const droughtReadiness = getHazardReadiness('drought', enabledLayerSet);
    const floodResult = getFloodScore(weatherSummary, scopedDisasters, scopedFacilities.length, districtEvidence.flood);
    const droughtResult = getDroughtScore(weatherSummary, scopedDisasters, districtEvidence.drought);
    const heatResult = getHeatScore(weatherSummary);
    const hasExposureContext = Boolean(populationEstimate) || scopedFacilities.length > 0;
    const hazardAssessments = {
      flood: floodReadiness.ready && districtEvidence.flood?.floodContextMean !== undefined && districtEvidence.flood?.floodContextMean !== null
        ? {
            status: 'ready',
            score: floodResult.score,
            level: getRiskLevel(floodResult.score),
            drivers: floodResult.drivers,
            requiredLayers: floodReadiness.requiredLayers,
            missingLayers: []
          }
        : {
            status: floodReadiness.ready ? 'missing_evidence_data' : 'missing_required_layers',
            score: null,
            level: 'not-ready',
            drivers: [],
            requiredLayers: floodReadiness.requiredLayers,
            missingLayers: floodReadiness.missingLayers,
            message: floodReadiness.ready
              ? 'Flood Context was selected, but district-level GEE evidence could not be computed yet.'
              : `Enable ${floodReadiness.missingLayers.map(formatLayerLabel).join(' and ')} to assess projected flood risk.`
          },
      drought: droughtReadiness.ready && districtEvidence.drought?.droughtContextMean !== undefined && districtEvidence.drought?.droughtContextMean !== null
        ? {
            status: 'ready',
            score: droughtResult.score,
            level: getRiskLevel(droughtResult.score),
            drivers: droughtResult.drivers,
            requiredLayers: droughtReadiness.requiredLayers,
            missingLayers: []
          }
        : {
            status: droughtReadiness.ready ? 'missing_evidence_data' : 'missing_required_layers',
            score: null,
            level: 'not-ready',
            drivers: [],
            requiredLayers: droughtReadiness.requiredLayers,
            missingLayers: droughtReadiness.missingLayers,
            message: droughtReadiness.ready
              ? 'Drought Context was selected, but district-level GEE evidence could not be computed yet.'
              : `Enable ${droughtReadiness.missingLayers.map(formatLayerLabel).join(' and ')} to assess projected drought risk.`
          },
      heat: !weatherSummary
        ? {
            status: 'missing_weather',
            score: null,
            level: 'not-ready',
            drivers: [],
            requiredLayers: [],
            missingLayers: ['forecast weather'],
            message: 'Weather forecast is unavailable for this district.'
          }
        : {
            status: hasExposureContext ? 'limited_evidence' : 'forecast_only',
            score: heatResult.score,
            level: getRiskLevel(heatResult.score),
            drivers: heatResult.drivers,
            requiredLayers: [],
            missingLayers: [],
            message: hasExposureContext
              ? 'Heat assessment uses forecast weather plus exposure context only; it is not treated as a fully assessed hazard without stronger corroborating evidence.'
              : 'Heat assessment uses forecast weather only and is not treated as a fully assessed hazard.'
          }
    };
    const dominantHazard = [
      { type: 'flood', ...hazardAssessments.flood },
      { type: 'drought', ...hazardAssessments.drought },
      { type: 'heat', ...hazardAssessments.heat }
    ].filter((hazard) => hazard.status === 'ready' && typeof hazard.score === 'number')
      .sort((a, b) => b.score - a.score)[0] || {
        type: 'unavailable',
        score: null,
        level: 'not-ready',
        drivers: [],
        status: 'missing_required_layers'
      };

    const confidence = getConfidence({
      weatherSummary,
      populationEstimate,
      facilityCount: scopedFacilities.length,
      hasGeometry: Boolean(district.geometry),
      disasterSignalCount: scopedDisasters.length,
      securitySignalCount: scopedAcled.length
    });
    const responseScale = getResponseScale(
      dominantHazard.score || 0,
      populationEstimate || 0,
      scopedFacilities.length,
      scopedAcled.length
    );
    const evidenceBase = getEvidenceBase({
      weatherSummary,
      disasterSignalCount: scopedDisasters.length,
      securitySignalCount: scopedAcled.length,
      populationEstimate,
      facilityCount: scopedFacilities.length,
      hasFloodEvidence: districtEvidence.flood?.floodContextMean !== undefined && districtEvidence.flood?.floodContextMean !== null,
      hasDroughtEvidence: districtEvidence.drought?.droughtContextMean !== undefined && districtEvidence.drought?.droughtContextMean !== null
    });

    return {
      districtId,
      districtName,
      center: getDistrictCenter(district),
      timeWindow: `${timeWindowDays} days`,
      dominantHazard: {
        type: dominantHazard.type,
        score: dominantHazard.score,
        level: dominantHazard.score === null ? 'not-ready' : getRiskLevel(dominantHazard.score)
      },
      hazardScores: {
        flood: hazardAssessments.flood.score,
        drought: hazardAssessments.drought.score,
        heat: hazardAssessments.heat.score
      },
      hazardAssessments,
      weatherSummary,
      geeEvidence: districtEvidence,
      exposure: {
        populationEstimate,
        facilityCount: scopedFacilities.length,
        disasterSignalCount: scopedDisasters.length,
        securitySignalCount: scopedAcled.length
      },
      confidence,
      confidenceReasoning: evidenceBase === 'forecast plus active-context signals'
        ? 'Confidence is based on forecast weather, district geometry, exposure data, and currently loaded hazard or conflict signals.'
        : evidenceBase === 'forecast plus GEE district evidence'
          ? 'Confidence is based on forecast weather, district geometry, and district-level Earth Engine evidence derived from the enabled hazard context layers.'
        : evidenceBase === 'forecast plus exposure context'
          ? 'Confidence is based on forecast weather, district geometry, and loaded exposure context. It does not include observed impact confirmation.'
          : evidenceBase === 'forecast-only'
            ? 'Confidence is limited because the district score is driven mainly by forecast weather without observed impact or historical anomaly confirmation.'
            : 'Confidence is limited because key evidence inputs are missing.',
      evidenceBase,
      responseScale: dominantHazard.score === null ? 'not available' : responseScale,
      responseScaleReasoning: dominantHazard.score === null
        ? 'Response scale is not available because no hazard has enough evidence to be scored yet.'
        : getResponseScaleReasoning({
            responseScale,
            dominantHazardType: dominantHazard.type,
            dominantHazardScore: dominantHazard.score,
            populationEstimate,
            facilityCount: scopedFacilities.length,
            securitySignalCount: scopedAcled.length
          }),
      rationale: [
        weatherSummary ? `Forecast window ${weatherSummary.startDate} to ${weatherSummary.endDate}` : 'Weather forecast unavailable',
        populationEstimate ? `Population exposure ~${populationEstimate.toLocaleString()}` : 'Population exposure unknown',
        scopedFacilities.length > 0 ? `${scopedFacilities.length} facilities inside district scope` : 'No facilities in district scope',
        scopedDisasters.length > 0 ? `${scopedDisasters.length} current hazard signals inside district` : 'No current hazard signals inside district',
        scopedAcled.length > 0 ? `${scopedAcled.length} ACLED events inside district` : 'No ACLED events inside district',
        districtEvidence.flood?.floodContextMean !== undefined ? `Flood context index ${Math.round((toNumber(districtEvidence.flood.floodContextMean) || 0) * 100)}/100 from SRTM + surface water baseline` : null,
        districtEvidence.drought?.droughtContextMean !== undefined ? `Drought context index ${Math.round((toNumber(districtEvidence.drought.droughtContextMean) || 0) * 100)}/100 from CHIRPS + ERA5-Land` : null,
        hazardAssessments.flood.status !== 'ready' ? hazardAssessments.flood.message : null,
        hazardAssessments.drought.status !== 'ready' ? hazardAssessments.drought.message : null,
        hazardAssessments.heat.status !== 'ready' ? hazardAssessments.heat.message : null
      ].filter(Boolean),
      drivers: dominantHazard.drivers || [],
      limitations: [
        'Scores are directional and based on forecast weather plus currently loaded context.',
        'No observed flood extent or hydrologic model is included in this first-pass analysis.',
        evidenceBase === 'forecast-only' ? 'This district uses forecast-only evidence, so hazard confidence and response scale should be treated cautiously.' : null
      ].filter(Boolean),
      sources: [
        'Open-Meteo forecast',
        populationEstimate ? 'WorldPop or uploaded boundary attributes' : null,
        districtEvidence.flood?.floodContextMean !== undefined ? 'SRTM + JRC Surface Water district summary' : null,
        districtEvidence.drought?.droughtContextMean !== undefined ? 'CHIRPS + ERA5-Land district summary' : null,
        scopedDisasters.length > 0 ? 'GDACS event context' : null,
        scopedAcled.length > 0 ? 'ACLED event context' : null,
        scopedFacilities.length > 0 ? 'Uploaded facility dataset' : null
      ].filter(Boolean)
    };
  }).sort((a, b) => (b.dominantHazard.score ?? -1) - (a.dominantHazard.score ?? -1));

  const hasPopulationEvidence = analyzedDistricts.some((district) => Boolean(district.exposure.populationEstimate));
  const hasFloodEvidence = analyzedDistricts.some((district) => district.geeEvidence?.flood?.floodContextMean !== undefined);
  const hasDroughtEvidence = analyzedDistricts.some((district) => district.geeEvidence?.drought?.droughtContextMean !== undefined);
  const hasDisasterSignals = analyzedDistricts.some((district) => district.exposure.disasterSignalCount > 0);
  const hasAcledSignals = analyzedDistricts.some((district) => district.exposure.securitySignalCount > 0);
  const hasFacilityEvidence = analyzedDistricts.some((district) => district.exposure.facilityCount > 0);

  return {
    generatedAt: new Date().toISOString(),
    timeWindowDays,
    summary: {
      districtCount: analyzedDistricts.length,
      highestRiskDistricts: analyzedDistricts.slice(0, 5).map((district) => ({
        districtId: district.districtId,
        districtName: district.districtName,
        hazardType: district.dominantHazard.type,
        score: district.dominantHazard.score,
        level: district.dominantHazard.level
      })),
      methodology: [
        'Flood risk is only scored when Flood Context is enabled and district-level SRTM plus surface-water evidence is available.',
        'Drought risk is only scored when Drought Context is enabled and district-level CHIRPS plus ERA5-Land evidence is available.',
        'Drought score stays conservative on short forecast windows unless dry conditions are reinforced by heat, very low rainfall, or current drought-related signals.',
        'Response scale uses the dominant hazard score first, then adjusts it with exposure and operational pressure instead of letting population size drive the result by itself.',
        'Confidence is capped when the analysis lacks observed-impact confirmation, even when Earth Engine environmental evidence is available.'
      ],
      sources: [
        'Open-Meteo forecast',
        'Uploaded district boundaries',
        hasDroughtEvidence ? 'CHIRPS + ERA5-Land district summaries when Drought Context is enabled' : null,
        hasFloodEvidence ? 'SRTM + JRC Surface Water district summaries when Flood Context is enabled' : null,
        hasPopulationEvidence ? 'WorldPop or uploaded population attributes' : null,
        hasDisasterSignals ? 'GDACS event signals' : null,
        hasAcledSignals ? 'ACLED event signals' : null,
        hasFacilityEvidence ? 'Uploaded facility data' : null
      ]
        .filter(Boolean)
    },
    districts: analyzedDistricts
  };
}
