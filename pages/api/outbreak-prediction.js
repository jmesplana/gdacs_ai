/**
 * Disease Outbreak Prediction API
 * Predicts epidemic risk based on disasters, weather, and facility damage
 */

import { calculateEpidemicRisk, predictCases, PREDICTION_CONFIG } from '../../config/predictionConfig';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
    washFacilitiesDamaged = 0,
    healthFacilitiesDamaged = 0,
    displacedPopulation = 0,
  } = req.body;

  const populationEstimate = Math.max(1, parseInt(req.body.populationEstimate) || 10000);
  const forecastDays = Math.min(Math.max(1, parseInt(req.body.forecastDays) || 30), 90);

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Missing latitude or longitude' });
  }

  try {
    // Get weather forecast
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const weatherResponse = await fetch(`${baseUrl}/api/weather-forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, days: 14 }),
    });

    const weatherData = weatherResponse.ok ? await weatherResponse.json() : null;

    // Calculate risk factors for each disease
    const diseases = ['cholera', 'malaria', 'measles', 'diarrhea'];
    const predictions = {};

    diseases.forEach(disease => {
      const riskFactors = calculateDiseaseRiskFactors(
        disease,
        disasters,
        weatherData,
        washFacilitiesDamaged,
        healthFacilitiesDamaged,
        displacedPopulation,
        populationEstimate
      );

      const risk = calculateEpidemicRisk(disease, riskFactors);

      if (risk) {
        // Predict cases over time
        const model = PREDICTION_CONFIG.diseaseModels[disease];
        const baselineCases = model.baselineRate * populationEstimate;
        const casePredictions = [];

        for (let day = 0; day <= forecastDays; day += 7) {
          const prediction = predictCases(
            baselineCases,
            populationEstimate,
            risk.score,
            day,
            risk.doublingTime
          );
          casePredictions.push({
            day,
            ...prediction,
          });
        }

        predictions[disease] = {
          disease: risk.diseaseName,
          risk: risk.level,
          confidence: risk.confidence,
          probability: Math.round(risk.score * 100),
          peakDay: risk.peakDay,
          casePredictions,
          riskFactors: Object.keys(riskFactors).filter(k => riskFactors[k] > 0),
        };
      }
    });

    // Sort by risk level
    const sortedPredictions = Object.entries(predictions)
      .sort((a, b) => b[1].probability - a[1].probability);

    // Generate AI-enhanced analysis if OpenAI available
    let aiAnalysis = null;
    if (openai && sortedPredictions.length > 0) {
      aiAnalysis = await generateAIAnalysis(sortedPredictions, disasters, populationEstimate);
    }

    return res.status(200).json({
      location: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
      population: populationEstimate,
      forecastPeriod: forecastDays,
      timestamp: new Date().toISOString(),
      predictions: Object.fromEntries(sortedPredictions),
      topThreats: sortedPredictions.slice(0, 3).map(([disease, data]) => ({
        disease,
        level: data.risk,
        probability: data.probability,
      })),
      aiAnalysis,
    });

  } catch (error) {
    console.error('Outbreak prediction error:', error);
    return res.status(500).json({
      error: 'Failed to generate outbreak predictions',
      message: error.message,
    });
  }
}

/**
 * Calculate disease-specific risk factors
 */
function calculateDiseaseRiskFactors(
  disease,
  disasters,
  weatherData,
  washDamaged,
  healthDamaged,
  displaced,
  population
) {
  const factors = {};

  // Check for flooding disasters
  const hasFlood = disasters.some(d => d.eventType && d.eventType.toLowerCase().includes('flood'));
  factors.flooding = hasFlood ? 1.0 : 0.0;

  // WASH infrastructure damage factor
  factors.washInfrastructureDamage = washDamaged > 0 ? Math.min(1, washDamaged / 10) : 0;

  // Health facility damage
  factors.healthFacilityDamage = healthDamaged > 0 ? Math.min(1, healthDamaged / 5) : 0;

  // Displacement/crowding
  const displacementRate = displaced / population;
  factors.displacement = Math.min(1, displacementRate * 2);
  factors.crowding = displacementRate > 0.1 ? Math.min(1, displacementRate * 3) : 0;

  // Population density (approximate)
  factors.populationDensity = population > 50000 ? 0.8 : population > 10000 ? 0.5 : 0.2;

  // Weather-based factors
  if (weatherData && weatherData.daily) {
    // Temperature factor
    const avgTemp = weatherData.daily.temperature_2m_max.reduce((a, b) => a + b, 0) / weatherData.daily.temperature_2m_max.length;
    const model = PREDICTION_CONFIG.diseaseModels[disease];

    if (model.optimalTemp) {
      const { min, max } = model.optimalTemp;
      factors.temperature = (avgTemp >= min && avgTemp <= max) ? 0.8 : 0.3;
    }

    // Rainfall factor
    const totalRain = weatherData.daily.precipitation_sum.reduce((a, b) => a + b, 0);
    if (model.optimalRainfall) {
      const { min, max } = model.optimalRainfall;
      factors.rainfall = (totalRain >= min && totalRain <= max) ? 0.8 : 0.3;
    }
  }

  return factors;
}

/**
 * Generate AI-enhanced outbreak analysis
 */
async function generateAIAnalysis(predictions, disasters, population) {
  if (!openai) return null;

  try {
    const topDiseases = predictions.slice(0, 3).map(([disease, data]) =>
      `${data.disease}: ${data.probability}% risk (${data.risk} level)`
    ).join('\n');

    const disasterContext = disasters.length > 0
      ? disasters.map(d => `${d.eventType} (${d.alertLevel || 'Unknown'} alert)`).join(', ')
      : 'No active disasters';

    const prompt = `As a public health epidemiologist, provide a brief outbreak risk assessment:

Population: ${population.toLocaleString()}
Current Disasters: ${disasterContext}

Predicted Disease Risks:
${topDiseases}

Provide:
1. Primary concerns (2-3 sentences)
2. Immediate actions (3-4 bullet points)
3. Monitoring priorities

Keep response concise and actionable for field coordinators.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    return completion.choices[0].message.content;

  } catch (error) {
    console.warn('AI analysis failed:', error.message);
    return null;
  }
}
