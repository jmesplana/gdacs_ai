/**
 * Predictive Analytics Configuration
 * Uses FREE data sources: Open-Meteo (no API key required)
 */

export const PREDICTION_CONFIG = {
  // Weather API configuration
  weatherAPI: {
    baseURL: 'https://api.open-meteo.com/v1',
    maxForecastDays: 14,
    cacheHours: 6, // Cache weather data for 6 hours
  },

  // Disaster prediction thresholds
  disasterThresholds: {
    flood: {
      warningRainfall: 50, // mm in 24 hours
      criticalRainfall: 100, // mm in 24 hours
      riskElevation: 100, // meters (low-lying areas at risk)
      soilSaturationDays: 3, // consecutive heavy rain days
    },
    drought: {
      consecutiveDryDays: 30,
      criticalTemp: 35, // celsius
      minRainfall: 10, // mm in 30 days
    },
    tropical_cyclone: {
      warningWindSpeed: 63, // km/h (tropical storm threshold)
      criticalWindSpeed: 119, // km/h (Category 1 hurricane)
      seasonalMonths: {
        atlantic: [6, 7, 8, 9, 10, 11], // June-November
        pacific: [5, 6, 7, 8, 9, 10, 11], // May-November
        indian: [4, 5, 10, 11, 12], // April-May, Oct-Dec
      }
    },
    heatwave: {
      warningTemp: 35, // celsius
      criticalTemp: 40,
      consecutiveDays: 3,
    }
  },

  // Disease outbreak prediction models
  diseaseModels: {
    cholera: {
      name: 'Cholera',
      incubationPeriod: 5, // days
      riskFactors: {
        flooding: { weight: 0.4, lagDays: 3 },
        washInfrastructureDamage: { weight: 0.3, lagDays: 0 },
        temperature: { weight: 0.2, lagDays: 0 }, // 15-35°C optimal
        populationDensity: { weight: 0.1, lagDays: 0 },
      },
      optimalTemp: { min: 15, max: 35 },
      baselineRate: 0.0001, // cases per 1000 per day
      outbreakThreshold: 0.001,
      doublingTime: 4, // days
      peakDay: 14,
    },
    malaria: {
      name: 'Malaria',
      incubationPeriod: 10,
      riskFactors: {
        flooding: { weight: 0.35, lagDays: 14 }, // breeding sites form 2 weeks post-flood
        rainfall: { weight: 0.25, lagDays: 10 },
        temperature: { weight: 0.25, lagDays: 0 },
        displacement: { weight: 0.15, lagDays: 0 },
      },
      optimalTemp: { min: 20, max: 30 },
      optimalRainfall: { min: 80, max: 200 }, // mm/month
      baselineRate: 0.005,
      outbreakThreshold: 0.02,
      doublingTime: 7,
      peakDay: 30,
    },
    measles: {
      name: 'Measles',
      incubationPeriod: 14,
      riskFactors: {
        displacement: { weight: 0.5, lagDays: 7 },
        crowding: { weight: 0.3, lagDays: 0 },
        healthFacilityDamage: { weight: 0.2, lagDays: 0 },
      },
      baselineRate: 0.00005,
      outbreakThreshold: 0.0005,
      doublingTime: 10,
      peakDay: 21,
      r0: 12, // Highly contagious
    },
    diarrhea: {
      name: 'Acute Watery Diarrhea',
      incubationPeriod: 2,
      riskFactors: {
        flooding: { weight: 0.5, lagDays: 1 },
        washInfrastructureDamage: { weight: 0.3, lagDays: 0 },
        temperature: { weight: 0.2, lagDays: 0 },
      },
      baselineRate: 0.002,
      outbreakThreshold: 0.01,
      doublingTime: 3,
      peakDay: 7,
    }
  },

  // Supply chain disruption models
  supplyChainModels: {
    coldChain: {
      name: 'Cold Chain (Vaccines)',
      criticalTemp: { min: 2, max: 8 }, // celsius
      powerOutageThreshold: 4, // hours before risk
      disasterImpact: {
        earthquake: { probability: 0.7, durationDays: 7 },
        flood: { probability: 0.8, durationDays: 5 },
        cyclone: { probability: 0.9, durationDays: 10 },
      }
    },
    roadAccess: {
      name: 'Road Access',
      disasterImpact: {
        flood: { probability: 0.9, recoveryDays: 14 },
        earthquake: { probability: 0.6, recoveryDays: 30 },
        landslide: { probability: 0.7, recoveryDays: 21 },
      }
    }
  },

  // Forecast time windows
  forecastWindows: {
    immediate: { days: 3, label: '72-Hour Forecast' },
    shortTerm: { days: 7, label: '7-Day Forecast' },
    mediumTerm: { days: 14, label: '2-Week Forecast' },
  }
};

/**
 * Calculate disease outbreak risk score
 */
export function calculateEpidemicRisk(disease, factors) {
  const model = PREDICTION_CONFIG.diseaseModels[disease];
  if (!model) return null;

  let riskScore = 0;
  let totalWeight = 0;

  Object.entries(factors).forEach(([factor, value]) => {
    if (model.riskFactors[factor]) {
      const { weight } = model.riskFactors[factor];
      riskScore += value * weight;
      totalWeight += Math.abs(weight);
    }
  });

  const normalizedScore = totalWeight > 0 ? Math.max(0, Math.min(1, riskScore / totalWeight)) : 0;

  return {
    score: normalizedScore,
    level: normalizedScore > 0.7 ? 'CRITICAL' : normalizedScore > 0.5 ? 'HIGH' : normalizedScore > 0.3 ? 'MEDIUM' : 'LOW',
    confidence: normalizedScore > 0.6 ? 'HIGH' : normalizedScore > 0.3 ? 'MEDIUM' : 'LOW',
    peakDay: model.peakDay,
    doublingTime: model.doublingTime,
    diseaseName: model.name,
  };
}

/**
 * Predict epidemic cases using exponential growth model
 */
export function predictCases(baselineCases, population, riskScore, daysAhead, doublingTime) {
  const growthRate = Math.log(2) / doublingTime;
  const expectedCases = baselineCases * Math.exp(growthRate * daysAhead * riskScore);

  return {
    cases: Math.round(expectedCases),
    incidenceRate: Math.round((expectedCases / population) * 1000 * 10) / 10, // per 1000
    attackRate: Math.round((expectedCases / population) * 1000) / 10, // percentage
  };
}

/**
 * Analyze flood risk from weather data
 */
export function analyzeFloodRisk(weatherData) {
  const thresholds = PREDICTION_CONFIG.disasterThresholds.flood;

  if (!weatherData || !weatherData.daily) return null;

  const { precipitation_sum, time } = weatherData.daily;

  let maxDailyRain = 0;
  let peakDay = null;
  let consecutiveHeavyDays = 0;
  let totalRainfall = 0;

  precipitation_sum.forEach((rain, idx) => {
    totalRainfall += rain;
    if (rain > maxDailyRain) {
      maxDailyRain = rain;
      peakDay = time[idx];
    }
    if (rain > thresholds.warningRainfall) {
      consecutiveHeavyDays++;
    }
  });

  const riskScore = Math.min(1,
    (maxDailyRain / thresholds.criticalRainfall) * 0.6 +
    (consecutiveHeavyDays / thresholds.soilSaturationDays) * 0.4
  );

  return {
    riskLevel: riskScore > 0.7 ? 'CRITICAL' : riskScore > 0.5 ? 'HIGH' : riskScore > 0.3 ? 'MEDIUM' : 'LOW',
    probability: Math.round(riskScore * 100),
    peakDay,
    maxDailyRainfall: Math.round(maxDailyRain),
    totalRainfall: Math.round(totalRainfall),
    consecutiveHeavyDays,
  };
}

/**
 * Analyze drought risk
 */
export function analyzeDroughtRisk(weatherData) {
  const thresholds = PREDICTION_CONFIG.disasterThresholds.drought;

  if (!weatherData || !weatherData.daily) return null;

  const { precipitation_sum, temperature_2m_max } = weatherData.daily;

  let dryDays = 0;
  let totalRainfall = 0;
  let avgTemp = 0;

  precipitation_sum.forEach((rain, idx) => {
    totalRainfall += rain;
    avgTemp += temperature_2m_max[idx];
    if (rain < 1) dryDays++; // < 1mm = dry day
  });

  avgTemp /= temperature_2m_max.length;

  const riskScore = Math.min(1,
    (dryDays / thresholds.consecutiveDryDays) * 0.5 +
    (avgTemp / thresholds.criticalTemp) * 0.3 +
    (1 - totalRainfall / thresholds.minRainfall) * 0.2
  );

  return {
    riskLevel: riskScore > 0.7 ? 'CRITICAL' : riskScore > 0.5 ? 'HIGH' : riskScore > 0.3 ? 'MEDIUM' : 'LOW',
    probability: Math.round(riskScore * 100),
    consecutiveDryDays: dryDays,
    totalRainfall: Math.round(totalRainfall),
    avgTemperature: Math.round(avgTemp * 10) / 10,
  };
}

/**
 * Check if location is in cyclone season
 */
export function getCycloneSeasonalRisk(latitude, longitude) {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const thresholds = PREDICTION_CONFIG.disasterThresholds.tropical_cyclone;

  // Determine ocean basin
  let basin = 'atlantic';
  if (longitude > 120 && longitude < 180 && latitude > 0 && latitude < 40) {
    basin = 'pacific';
  } else if (longitude > 40 && longitude < 100 && latitude > -30 && latitude < 30) {
    basin = 'indian';
  }

  const isInSeason = thresholds.seasonalMonths[basin].includes(currentMonth);

  return {
    basin,
    isInSeason,
    currentMonth,
    peakMonths: thresholds.seasonalMonths[basin],
    riskMultiplier: isInSeason ? 3.0 : 0.5,
    riskLevel: isInSeason ? 'HIGH' : 'LOW',
  };
}

export default PREDICTION_CONFIG;
