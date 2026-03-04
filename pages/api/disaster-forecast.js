/**
 * Disaster Trend Forecast API
 * Predicts future disaster risks based on weather forecasts
 */

import { PREDICTION_CONFIG, analyzeFloodRisk, analyzeDroughtRisk, getCycloneSeasonalRisk } from '../../config/predictionConfig';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { latitude, longitude, days = 7 } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Missing latitude or longitude' });
  }

  try {
    // Get weather forecast
    const weatherResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/weather-forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, days }),
    });

    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const weatherData = await weatherResponse.json();

    // Analyze different disaster risks
    const predictions = {
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      forecastPeriod: {
        days: parseInt(days),
        startDate: weatherData.daily?.time[0],
        endDate: weatherData.daily?.time[weatherData.daily?.time.length - 1],
      },
      timestamp: new Date().toISOString(),

      // Flood risk analysis
      flood: analyzeFloodRisk(weatherData),

      // Drought risk analysis
      drought: analyzeDroughtRisk(weatherData),

      // Cyclone seasonal risk
      cyclone: getCycloneSeasonalRisk(latitude, longitude),

      // Heatwave risk
      heatwave: analyzeHeatwaveRisk(weatherData),

      // Overall risk summary
      summary: null, // Will be populated below

      // Raw weather data (optional)
      weatherData: weatherData.cached ? null : weatherData, // Only include if freshly fetched
    };

    // Calculate overall risk summary
    predictions.summary = calculateOverallRisk(predictions);

    return res.status(200).json(predictions);

  } catch (error) {
    console.error('Disaster forecast error:', error);
    return res.status(500).json({
      error: 'Failed to generate disaster forecast',
      message: error.message,
    });
  }
}

/**
 * Analyze heatwave risk
 */
function analyzeHeatwaveRisk(weatherData) {
  const thresholds = PREDICTION_CONFIG.disasterThresholds.heatwave;

  if (!weatherData || !weatherData.daily) return null;

  const { temperature_2m_max, time } = weatherData.daily;

  let consecutiveHotDays = 0;
  let maxConsecutive = 0;
  let peakTemp = 0;
  let peakDay = null;

  temperature_2m_max.forEach((temp, idx) => {
    if (temp > peakTemp) {
      peakTemp = temp;
      peakDay = time[idx];
    }

    if (temp >= thresholds.warningTemp) {
      consecutiveHotDays++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveHotDays);
    } else {
      consecutiveHotDays = 0;
    }
  });

  const riskScore = Math.min(1,
    (peakTemp / thresholds.criticalTemp) * 0.6 +
    (maxConsecutive / thresholds.consecutiveDays) * 0.4
  );

  return {
    riskLevel: riskScore > 0.7 ? 'CRITICAL' : riskScore > 0.5 ? 'HIGH' : riskScore > 0.3 ? 'MEDIUM' : 'LOW',
    probability: Math.round(riskScore * 100),
    peakTemperature: Math.round(peakTemp * 10) / 10,
    peakDay,
    consecutiveHotDays: maxConsecutive,
  };
}

/**
 * Calculate overall risk summary
 */
function calculateOverallRisk(predictions) {
  const risks = [];

  // Collect all risk levels
  if (predictions.flood) risks.push(predictions.flood);
  if (predictions.drought) risks.push(predictions.drought);
  if (predictions.heatwave) risks.push(predictions.heatwave);
  if (predictions.cyclone && predictions.cyclone.isInSeason) risks.push(predictions.cyclone);

  if (risks.length === 0) {
    return {
      overallRisk: 'LOW',
      primaryThreats: [],
      recommendedActions: ['Continue routine monitoring'],
    };
  }

  // Determine highest risk
  const riskLevels = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const highestRiskLevel = risks.reduce((max, risk) => {
    const level = riskLevels[risk.riskLevel] || 0;
    return level > riskLevels[max] ? risk.riskLevel : max;
  }, 'LOW');

  // Identify primary threats
  const primaryThreats = [];
  if (predictions.flood && predictions.flood.riskLevel === highestRiskLevel) {
    primaryThreats.push({
      type: 'Flooding',
      level: predictions.flood.riskLevel,
      probability: predictions.flood.probability,
      peakDay: predictions.flood.peakDay,
    });
  }
  if (predictions.drought && predictions.drought.riskLevel === highestRiskLevel) {
    primaryThreats.push({
      type: 'Drought',
      level: predictions.drought.riskLevel,
      probability: predictions.drought.probability,
    });
  }
  if (predictions.heatwave && predictions.heatwave.riskLevel === highestRiskLevel) {
    primaryThreats.push({
      type: 'Heatwave',
      level: predictions.heatwave.riskLevel,
      probability: predictions.heatwave.probability,
      peakDay: predictions.heatwave.peakDay,
    });
  }
  if (predictions.cyclone && predictions.cyclone.isInSeason && predictions.cyclone.riskLevel === highestRiskLevel) {
    primaryThreats.push({
      type: 'Tropical Cyclone (Seasonal)',
      level: predictions.cyclone.riskLevel,
      basin: predictions.cyclone.basin,
    });
  }

  // Generate recommendations
  const recommendedActions = generateRecommendations(highestRiskLevel, primaryThreats);

  return {
    overallRisk: highestRiskLevel,
    primaryThreats,
    recommendedActions,
    timeHorizon: predictions.forecastPeriod.days + ' days',
  };
}

/**
 * Generate recommendations based on risk
 */
function generateRecommendations(riskLevel, threats) {
  const recommendations = [];

  if (riskLevel === 'CRITICAL') {
    recommendations.push('⚠️ URGENT: Activate emergency response protocols');
    recommendations.push('Notify all field teams and facilities');
    recommendations.push('Preposi tion emergency supplies');
  }

  if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    recommendations.push('Increase monitoring frequency to every 6 hours');
    recommendations.push('Review and update contingency plans');
  }

  threats.forEach(threat => {
    switch (threat.type) {
      case 'Flooding':
        recommendations.push('🌊 Move equipment to higher ground');
        recommendations.push('Check drainage systems at all facilities');
        recommendations.push('Prepare WASH emergency supplies');
        break;
      case 'Drought':
        recommendations.push('🌡️ Secure water supply reserves');
        recommendations.push('Monitor vector breeding sites');
        break;
      case 'Heatwave':
        recommendations.push('☀️ Ensure cold chain backup power systems');
        recommendations.push('Increase hydration supplies');
        break;
      case 'Tropical Cyclone (Seasonal)':
        recommendations.push('🌀 Monitor tropical cyclone forecasts daily');
        recommendations.push('Secure loose equipment and materials');
        break;
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('Continue routine disaster monitoring');
  }

  return recommendations;
}
