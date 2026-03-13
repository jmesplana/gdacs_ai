/**
 * Supply Chain Disruption Forecast API
 * Predicts logistical challenges based on disasters and weather
 */

import { PREDICTION_CONFIG } from '../../config/predictionConfig';

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

  const {
    latitude,
    longitude,
    disasters = [],
    forecastDays = 14,
  } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Missing latitude or longitude' });
  }

  try {
    // Get weather forecast
    const weatherParams = new URLSearchParams({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      daily: ['temperature_2m_max','temperature_2m_min','precipitation_sum','precipitation_probability_max','windspeed_10m_max','relative_humidity_2m_mean'].join(','),
      forecast_days: Math.min(parseInt(forecastDays) || 14, PREDICTION_CONFIG.weatherAPI.maxForecastDays),
      timezone: 'auto',
    });
    const weatherResponse = await fetch(
      `${PREDICTION_CONFIG.weatherAPI.baseURL}/forecast?${weatherParams}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const weatherData = weatherResponse.ok ? await weatherResponse.json() : null;

    // Analyze different supply chain components
    const predictions = {
      location: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      forecastPeriod: forecastDays,
      timestamp: new Date().toISOString(),

      coldChain: predictColdChainDisruption(disasters, weatherData),
      roadAccess: predictRoadAccessDisruption(disasters, weatherData),
      airTransport: predictAirTransportDisruption(disasters, weatherData),

      overallAssessment: null, // Populated below
    };

    // Generate overall assessment
    predictions.overallAssessment = generateSupplyChainAssessment(predictions);

    return res.status(200).json(predictions);

  } catch (error) {
    console.error('Supply chain forecast error:', error);
    return res.status(500).json({
      error: 'Failed to generate supply chain forecast',
      message: error.message,
    });
  }
}

/**
 * Predict cold chain disruption risk
 */
function predictColdChainDisruption(disasters, weatherData) {
  const model = PREDICTION_CONFIG.supplyChainModels.coldChain;
  let disruptionProbability = 0;
  let estimatedDuration = 0;
  const threats = [];

  // Check disaster impacts
  disasters.forEach(disaster => {
    const eventType = (disaster.eventType || '').toLowerCase();

    Object.entries(model.disasterImpact).forEach(([type, impact]) => {
      if (eventType.includes(type)) {
        disruptionProbability = Math.max(disruptionProbability, impact.probability);
        estimatedDuration = Math.max(estimatedDuration, impact.durationDays);
        threats.push({
          source: disaster.eventType,
          probability: Math.round(impact.probability * 100),
          expectedDuration: impact.durationDays,
        });
      }
    });
  });

  // Check temperature extremes from weather
  if (weatherData && weatherData.daily) {
    const { temperature_2m_max, temperature_2m_min } = weatherData.daily;
    const maxTemp = Math.max(...temperature_2m_max);
    const minTemp = Math.min(...temperature_2m_min);

    if (maxTemp > 40 || minTemp < 0) {
      disruptionProbability = Math.max(disruptionProbability, 0.6);
      threats.push({
        source: 'Extreme Temperature',
        probability: 60,
        expectedDuration: 3,
      });
    }
  }

  const riskLevel = disruptionProbability > 0.7 ? 'CRITICAL' :
    disruptionProbability > 0.5 ? 'HIGH' :
      disruptionProbability > 0.3 ? 'MEDIUM' : 'LOW';

  return {
    riskLevel,
    probability: Math.round(disruptionProbability * 100),
    estimatedDurationDays: estimatedDuration,
    threats,
    recommendations: generateColdChainRecommendations(riskLevel, threats),
  };
}

/**
 * Predict road access disruption
 */
function predictRoadAccessDisruption(disasters, weatherData) {
  const model = PREDICTION_CONFIG.supplyChainModels.roadAccess;
  let disruptionProbability = 0;
  let recoveryDays = 0;
  const threats = [];

  // Check disaster impacts
  disasters.forEach(disaster => {
    const eventType = (disaster.eventType || '').toLowerCase();

    Object.entries(model.disasterImpact).forEach(([type, impact]) => {
      if (eventType.includes(type)) {
        disruptionProbability = Math.max(disruptionProbability, impact.probability);
        recoveryDays = Math.max(recoveryDays, impact.recoveryDays);
        threats.push({
          source: disaster.eventType,
          probability: Math.round(impact.probability * 100),
          recoveryTime: impact.recoveryDays,
        });
      }
    });
  });

  // Check for heavy rainfall (flooding risk)
  if (weatherData && weatherData.daily) {
    const heavyRainDays = weatherData.daily.precipitation_sum.filter(r => r > 50).length;
    if (heavyRainDays > 0) {
      const floodProb = Math.min(0.9, heavyRainDays * 0.2);
      disruptionProbability = Math.max(disruptionProbability, floodProb);
      threats.push({
        source: 'Heavy Rainfall',
        probability: Math.round(floodProb * 100),
        recoveryTime: 7,
      });
    }
  }

  const riskLevel = disruptionProbability > 0.7 ? 'CRITICAL' :
    disruptionProbability > 0.5 ? 'HIGH' :
      disruptionProbability > 0.3 ? 'MEDIUM' : 'LOW';

  return {
    riskLevel,
    probability: Math.round(disruptionProbability * 100),
    estimatedRecoveryDays: recoveryDays,
    threats,
    recommendations: generateRoadAccessRecommendations(riskLevel, threats),
  };
}

/**
 * Predict air transport disruption
 */
function predictAirTransportDisruption(disasters, weatherData) {
  let disruptionProbability = 0;
  const threats = [];

  // Check for cyclones, volcanic activity
  disasters.forEach(disaster => {
    const eventType = (disaster.eventType || '').toLowerCase();

    if (eventType.includes('cyclone') || eventType.includes('tropical')) {
      disruptionProbability = Math.max(disruptionProbability, 1.0);
      threats.push({
        source: disaster.eventtype,
        probability: 100,
        expectedDuration: 3,
      });
    } else if (eventType.includes('volcano')) {
      disruptionProbability = Math.max(disruptionProbability, 0.9);
      threats.push({
        source: 'Volcanic Ash',
        probability: 90,
        expectedDuration: 14,
      });
    }
  });

  // Check for extreme winds
  if (weatherData && weatherData.daily && weatherData.daily.windspeed_10m_max) {
    const maxWind = Math.max(...weatherData.daily.windspeed_10m_max);
    if (maxWind > 75) {
      disruptionProbability = Math.max(disruptionProbability, 0.8);
      threats.push({
        source: 'High Winds',
        probability: 80,
        expectedDuration: 1,
      });
    }
  }

  const riskLevel = disruptionProbability > 0.7 ? 'CRITICAL' :
    disruptionProbability > 0.5 ? 'HIGH' :
      disruptionProbability > 0.3 ? 'MEDIUM' : 'LOW';

  return {
    riskLevel,
    probability: Math.round(disruptionProbability * 100),
    threats,
    recommendations: generateAirTransportRecommendations(riskLevel),
  };
}

/**
 * Generate overall supply chain assessment
 */
function generateSupplyChainAssessment(predictions) {
  const risks = [
    { component: 'Cold Chain', level: predictions.coldChain.riskLevel, prob: predictions.coldChain.probability },
    { component: 'Road Access', level: predictions.roadAccess.riskLevel, prob: predictions.roadAccess.probability },
    { component: 'Air Transport', level: predictions.airTransport.riskLevel, prob: predictions.airTransport.probability },
  ];

  const highestRisk = risks.reduce((max, r) => r.prob > max.prob ? r : max, risks[0]);

  const criticalComponents = risks.filter(r => r.level === 'CRITICAL' || r.level === 'HIGH');

  return {
    overallRisk: highestRisk.level,
    criticalComponents: criticalComponents.map(c => c.component),
    primaryThreat: highestRisk.component,
    recommendations: [
      ...generateOverallRecommendations(highestRisk.level, criticalComponents),
    ],
  };
}

// Recommendation generators
function generateColdChainRecommendations(riskLevel, threats) {
  const recs = [];
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    recs.push('🔋 Test backup generators immediately');
    recs.push('⛽ Secure 7-day fuel supply for generators');
    recs.push('📦 Consider moving temperature-sensitive supplies to safer locations');
    recs.push('🌡️ Increase temperature monitoring frequency to hourly');
  }
  if (threats.some(t => t.source.includes('Temperature'))) {
    recs.push('Install additional insulation or cooling systems');
  }
  return recs.length > 0 ? recs : ['Continue routine cold chain monitoring'];
}

function generateRoadAccessRecommendations(riskLevel, threats) {
  const recs = [];
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    recs.push('🚗 Identify alternative routes now');
    recs.push('📍 Preposition supplies at multiple locations');
    recs.push('🛒 Stock up critical supplies for 2-3 week isolation');
  }
  if (threats.some(t => t.source.includes('Flood') || t.source.includes('Rainfall'))) {
    recs.push('🌊 Prepare for potential flooding: relocate vehicles to higher ground');
  }
  return recs.length > 0 ? recs : ['Roads expected to remain accessible'];
}

function generateAirTransportRecommendations(riskLevel) {
  const recs = [];
  if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
    recs.push('✈️ Coordinate air shipments immediately before disruption');
    recs.push('📦 Plan for extended ground transportation only');
    recs.push('⏰ Expect 3-14 day delays for urgent air cargo');
  }
  return recs.length > 0 ? recs : ['Air transport expected to operate normally'];
}

function generateOverallRecommendations(riskLevel, criticalComponents) {
  const recs = [];
  if (riskLevel === 'CRITICAL') {
    recs.push('⚠️ URGENT: Activate supply chain contingency plan');
    recs.push('Notify all supply chain partners of impending disruption');
  }
  if (criticalComponents.length >= 2) {
    recs.push('⚡ Multiple supply chain components at risk - diversify logistics approaches');
  }
  return recs;
}
