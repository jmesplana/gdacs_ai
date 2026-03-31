/**
 * Weather Context Builder for Chat API
 * Fetches and formats weather data for AI chatbot context
 */

import { PREDICTION_CONFIG } from '../config/predictionConfig';

/**
 * Calculate bounding box center from facilities
 */
function calculateFacilityCenter(facilities) {
  if (!facilities || facilities.length === 0) return null;

  const validFacilities = facilities.filter(f =>
    f.latitude && f.longitude &&
    !isNaN(parseFloat(f.latitude)) && !isNaN(parseFloat(f.longitude))
  );

  if (validFacilities.length === 0) return null;

  const lats = validFacilities.map(f => parseFloat(f.latitude));
  const lngs = validFacilities.map(f => parseFloat(f.longitude));

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return {
    latitude: centerLat,
    longitude: centerLng,
    bounds: { minLat, maxLat, minLng, maxLng }
  };
}

/**
 * Calculate district centroid from GeoJSON feature
 */
function calculateDistrictCentroid(feature) {
  if (!feature || !feature.geometry || !feature.geometry.coordinates) return null;

  const geom = feature.geometry;

  try {
    let allCoords = [];

    // Handle different geometry types
    if (geom.type === 'Polygon') {
      allCoords = geom.coordinates[0]; // Outer ring
    } else if (geom.type === 'MultiPolygon') {
      allCoords = geom.coordinates[0][0]; // First polygon, outer ring
    } else {
      return null;
    }

    // Calculate centroid
    let sumLat = 0, sumLng = 0;
    allCoords.forEach(coord => {
      sumLng += coord[0];
      sumLat += coord[1];
    });

    return {
      latitude: sumLat / allCoords.length,
      longitude: sumLng / allCoords.length
    };
  } catch (error) {
    console.error('Error calculating district centroid:', error);
    return null;
  }
}

/**
 * Fetch weather data from API
 */
async function fetchWeatherData(latitude, longitude, days = 7) {
  try {
    const response = await fetch('/api/weather-forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude, days })
    });

    if (!response.ok) {
      let message = `Weather API returned ${response.status}`;
      try {
        const errorPayload = await response.json();
        if (errorPayload?.message) {
          message += `: ${errorPayload.message}`;
        }
      } catch (_) {
        // Ignore JSON parse failures on error responses.
      }
      console.warn('Weather fetch unavailable:', message);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Weather fetch error:', error?.message || error);
    return null;
  }
}

/**
 * Analyze weather data and generate warnings
 */
function analyzeWeatherData(weatherData) {
  if (!weatherData || !weatherData.daily) return null;

  const { precipitation_sum, temperature_2m_max, temperature_2m_min, windspeed_10m_max, relative_humidity_2m_mean, time } = weatherData.daily;

  // Calculate summary statistics
  const totalRainfall = precipitation_sum.reduce((sum, val) => sum + val, 0);
  const peakRainfall = Math.max(...precipitation_sum);
  const peakRainfallDay = time[precipitation_sum.indexOf(peakRainfall)];
  const minTemp = Math.min(...temperature_2m_min);
  const maxTemp = Math.max(...temperature_2m_max);
  const avgWindSpeed = Math.round(windspeed_10m_max.reduce((sum, val) => sum + val, 0) / windspeed_10m_max.length);
  const avgHumidity = Math.round(relative_humidity_2m_mean.reduce((sum, val) => sum + val, 0) / relative_humidity_2m_mean.length);

  // Generate warnings
  const warnings = [];
  const operationalImplications = [];

  // Flood risk (from predictionConfig)
  const floodThresholds = PREDICTION_CONFIG.disasterThresholds.flood;
  if (peakRainfall >= floodThresholds.criticalRainfall) {
    warnings.push(`CRITICAL flood risk: ${Math.round(peakRainfall)}mm expected on ${new Date(peakRainfallDay).toLocaleDateString()}`);
    operationalImplications.push('Flooding likely - consider postponing field activities and pre-positioning supplies');
  } else if (peakRainfall >= floodThresholds.warningRainfall) {
    warnings.push(`Moderate flood risk: ${Math.round(peakRainfall)}mm expected on ${new Date(peakRainfallDay).toLocaleDateString()}`);
    operationalImplications.push('Monitor flood conditions - roads may become impassable');
  }

  // Consecutive heavy rain days
  let consecutiveHeavyDays = 0;
  let maxConsecutive = 0;
  precipitation_sum.forEach(rain => {
    if (rain > floodThresholds.warningRainfall) {
      consecutiveHeavyDays++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveHeavyDays);
    } else {
      consecutiveHeavyDays = 0;
    }
  });

  if (maxConsecutive >= floodThresholds.soilSaturationDays) {
    warnings.push(`Soil saturation risk: ${maxConsecutive} consecutive days of heavy rain`);
    operationalImplications.push('Landslide and flash flood risk in hilly areas');
  }

  // Heatwave risk
  const heatThresholds = PREDICTION_CONFIG.disasterThresholds.heatwave;
  if (maxTemp >= heatThresholds.criticalTemp) {
    warnings.push(`Extreme heat: Up to ${Math.round(maxTemp)}°C expected`);
    operationalImplications.push('Heat stress risk for field teams - ensure adequate hydration and rest');
  } else if (maxTemp >= heatThresholds.warningTemp) {
    warnings.push(`High temperatures: Up to ${Math.round(maxTemp)}°C expected`);
    operationalImplications.push('Monitor heat-sensitive medical supplies (vaccines, cold chain)');
  }

  // Disease outbreak risk indicators
  // Cholera optimal temperature: 15-35°C
  const choleraModel = PREDICTION_CONFIG.diseaseModels.cholera;
  if (totalRainfall > 50 && maxTemp >= choleraModel.optimalTemp.min && maxTemp <= choleraModel.optimalTemp.max) {
    warnings.push('Cholera outbreak risk: Favorable temperature and rainfall conditions');
    operationalImplications.push('Increase AWD/cholera surveillance, check ORS stock levels');
  }

  // Malaria optimal: 20-30°C, 80-200mm rainfall/month
  const malariaModel = PREDICTION_CONFIG.diseaseModels.malaria;
  if (totalRainfall >= 80 && maxTemp >= malariaModel.optimalTemp.min && maxTemp <= malariaModel.optimalTemp.max) {
    warnings.push('Malaria risk increasing: Breeding site conditions favorable');
    operationalImplications.push('Vector control needed - stock ACTs/RDTs, distribute ITNs');
  }

  // Cold chain risk
  if (maxTemp >= 35) {
    operationalImplications.push('Cold chain at risk - ensure backup power and temperature monitoring');
  }

  return {
    summary: {
      totalRainfall: Math.round(totalRainfall),
      peakRainfall: Math.round(peakRainfall),
      peakRainfallDay: new Date(peakRainfallDay).toLocaleDateString(),
      minTemp: Math.round(minTemp),
      maxTemp: Math.round(maxTemp),
      avgWindSpeed,
      avgHumidity
    },
    warnings,
    operationalImplications
  };
}

/**
 * Build regional weather context (Option 1)
 */
export async function buildRegionalWeatherContext(facilities) {
  if (!facilities || facilities.length === 0) return null;

  const center = calculateFacilityCenter(facilities);
  if (!center) return null;

  console.log('Fetching regional weather for center:', center);

  const weatherData = await fetchWeatherData(center.latitude, center.longitude, 7);
  if (!weatherData) return null;

  const analysis = analyzeWeatherData(weatherData);

  return {
    location: 'Center of operational area',
    latitude: center.latitude,
    longitude: center.longitude,
    forecastDays: 7,
    ...analysis,
    rawData: weatherData // Include raw data for reference
  };
}

/**
 * Build district-level weather context (Option 3)
 */
export async function buildDistrictWeatherContext(districtFeatures, maxDistricts = 20) {
  if (!districtFeatures || districtFeatures.length === 0) return null;

  console.log(`Fetching weather for ${Math.min(districtFeatures.length, maxDistricts)} districts...`);

  // Limit to maxDistricts to avoid too many API calls
  const districtsToProcess = districtFeatures.slice(0, maxDistricts);

  const districtWeather = [];

  // Fetch weather for each district (in parallel)
  const weatherPromises = districtsToProcess.map(async (feature) => {
    const centroid = calculateDistrictCentroid(feature);
    if (!centroid) return null;

    const districtName = feature.properties?.name || feature.properties?.NAME || feature.properties?.DISTRICT || 'Unknown';

    const weatherData = await fetchWeatherData(centroid.latitude, centroid.longitude, 7);
    if (!weatherData) return null;

    const analysis = analyzeWeatherData(weatherData);

    return {
      name: districtName,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
      totalRainfall: analysis.summary.totalRainfall,
      avgTemp: Math.round((analysis.summary.minTemp + analysis.summary.maxTemp) / 2),
      warnings: analysis.warnings
    };
  });

  const results = await Promise.all(weatherPromises);

  // Filter out nulls
  return results.filter(r => r !== null);
}

/**
 * Build complete weather context for chat
 */
export async function buildWeatherContext(facilities, districtFeatures) {
  const weatherContext = {};

  // Option 1: Regional forecast (always if facilities loaded)
  if (facilities && facilities.length > 0) {
    const regional = await buildRegionalWeatherContext(facilities);
    if (regional) {
      weatherContext.regional = regional;
    }
  }

  // Option 3: District forecasts (only if districts loaded)
  if (districtFeatures && districtFeatures.length > 0) {
    const districts = await buildDistrictWeatherContext(districtFeatures, 20);
    if (districts && districts.length > 0) {
      weatherContext.districts = districts;
    }
  }

  // Return null if no weather data was fetched
  return Object.keys(weatherContext).length > 0 ? weatherContext : null;
}

export default buildWeatherContext;
