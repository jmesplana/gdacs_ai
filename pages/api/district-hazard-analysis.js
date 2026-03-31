import { withRateLimit } from '../../lib/rateLimit';
import { buildDistrictHazardAnalysis } from '../../lib/districtHazardAnalysis';
import { PREDICTION_CONFIG } from '../../config/predictionConfig';

const weatherCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_DISTRICTS_PER_REQUEST = 20;
let eeInitialized = false;
let eeInitPromise = null;

async function initEE() {
  if (eeInitialized) return;
  if (eeInitPromise) return eeInitPromise;

  eeInitPromise = new Promise((resolve, reject) => {
    const ee = require('@google/earthengine');
    let privateKey;

    try {
      const raw = process.env.GEE_SERVICE_ACCOUNT_KEY;
      const cleaned = raw?.trim().replace(/^'([\s\S]*)'$/, '$1');
      privateKey = JSON.parse(cleaned);
    } catch (error) {
      return reject(new Error('GEE_SERVICE_ACCOUNT_KEY is not valid JSON'));
    }

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        ee.initialize(null, null, () => {
          eeInitialized = true;
          resolve();
        }, (err) => reject(new Error(`EE init failed: ${err}`)));
      },
      (err) => reject(new Error(`EE auth failed: ${err}`))
    );
  });

  return eeInitPromise;
}

function getWeatherCacheKey(latitude, longitude, days) {
  const roundedLat = Math.round(latitude * 10) / 10;
  const roundedLng = Math.round(longitude * 10) / 10;
  return `${roundedLat}:${roundedLng}:${days}`;
}

async function fetchDistrictWeather(latitude, longitude, days) {
  const cacheKey = getWeatherCacheKey(latitude, longitude, days);
  const cached = weatherCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const params = new URLSearchParams({
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'windspeed_10m_max',
      'relative_humidity_2m_mean',
    ].join(','),
    forecast_days: Math.min(parseInt(days, 10) || 7, PREDICTION_CONFIG.weatherAPI.maxForecastDays),
    timezone: 'auto',
  });

  const response = await fetch(
    `${PREDICTION_CONFIG.weatherAPI.baseURL}/forecast?${params}`,
    { signal: AbortSignal.timeout(10000) }
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  weatherCache.set(cacheKey, {
    data,
    expiry: Date.now() + CACHE_TTL_MS
  });

  return data;
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

  const aggregate = coords.reduce((acc, [lng, lat]) => ({
    lat: acc.lat + lat,
    lng: acc.lng + lng
  }), { lat: 0, lng: 0 });

  return {
    latitude: aggregate.lat / coords.length,
    longitude: aggregate.lng / coords.length
  };
}

function districtToEEGeometry(ee, geometry) {
  if (!geometry) return null;
  try {
    if (geometry.type === 'Polygon') {
      return ee.Geometry.Polygon(geometry.coordinates, null, false);
    }
    if (geometry.type === 'MultiPolygon') {
      return ee.Geometry.MultiPolygon(geometry.coordinates, null, false);
    }
    return null;
  } catch (_error) {
    return null;
  }
}

async function getRegionStats(image, featureCollection, scale) {
  const reduced = image.reduceRegions({
    collection: featureCollection,
    reducer: require('@google/earthengine').Reducer.mean(),
    scale,
    tileScale: 4
  });

  return new Promise((resolve, reject) => {
    reduced.getInfo((data, err) => {
      if (err) {
        reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
      } else {
        resolve(data);
      }
    });
  });
}

async function fetchGeeEvidenceSummaries(districts, enabledEvidenceLayers = []) {
  if (!process.env.GEE_SERVICE_ACCOUNT_KEY) {
    return { evidenceByDistrict: {}, warnings: ['Google Earth Engine is not configured, so flood and drought evidence could not be computed.'] };
  }

  const requested = new Set(enabledEvidenceLayers || []);
  if (!requested.has('flood_context') && !requested.has('drought_context') && !requested.has('nighttime_lights')) {
    return { evidenceByDistrict: {}, warnings: [] };
  }

  await initEE();
  const ee = require('@google/earthengine');
  const features = districts.map((district, index) => {
    const geom = districtToEEGeometry(ee, district.geometry);
    if (!geom) return null;
    return ee.Feature(geom, {
      districtId: String(district.id ?? index),
      districtName: district.name || `District ${district.id ?? index}`
    });
  }).filter(Boolean);

  if (features.length === 0) {
    return { evidenceByDistrict: {}, warnings: ['Earth Engine evidence could not be computed because district geometries were invalid.'] };
  }

  const featureCollection = ee.FeatureCollection(features);
  const evidenceByDistrict = {};
  const warnings = [];

  if (requested.has('flood_context')) {
    try {
      const dem = ee.Image('USGS/SRTMGL1_003');
      const slope = ee.Terrain.slope(dem).rename('slope_deg');
      const waterOccurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
        .select('occurrence')
        .rename('water_occurrence');
      const floodContext = ee.Image(1)
        .subtract(slope.divide(20).clamp(0, 1))
        .multiply(0.6)
        .add(waterOccurrence.divide(100).clamp(0, 1).multiply(0.4))
        .rename('flood_context');
      const image = floodContext.addBands(slope).addBands(waterOccurrence);
      const result = await getRegionStats(image, featureCollection, 90);

      (result.features || []).forEach((feature) => {
        const props = feature.properties || {};
        const districtId = props.districtId;
        evidenceByDistrict[districtId] = {
          ...(evidenceByDistrict[districtId] || {}),
          flood: {
            floodContextMean: props.flood_context,
            slopeMeanDeg: props.slope_deg,
            waterOccurrenceMeanPct: props.water_occurrence
          }
        };
      });
    } catch (error) {
      warnings.push(`Flood evidence could not be computed from GEE: ${error.message}`);
    }
  }

  if (requested.has('drought_context')) {
    try {
      const chirpsCollection = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY');
      const chirpsLatest = ee.Image(chirpsCollection.sort('system:time_start', false).first());
      const chirpsEndDate = ee.Date(chirpsLatest.get('system:time_start')).advance(1, 'day');
      const rainStart = chirpsEndDate.advance(-30, 'day');
      const chirpsRain = chirpsCollection
        .filterDate(rainStart, chirpsEndDate)
        .select('precipitation')
        .sum()
        .rename('rain_30d_mm');
      const era5Collection = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR');
      const era5Latest = ee.Image(era5Collection.sort('system:time_start', false).first());
      const era5EndDate = ee.Date(era5Latest.get('system:time_start')).advance(1, 'day');
      const tempStart = era5EndDate.advance(-14, 'day');
      const era5Temp = era5Collection
        .filterDate(tempStart, era5EndDate)
        .select('temperature_2m')
        .mean()
        .subtract(273.15)
        .rename('temp_14d_c');
      const droughtContext = ee.Image(1)
        .subtract(chirpsRain.divide(120).clamp(0, 1))
        .multiply(0.65)
        .add(era5Temp.subtract(28).divide(12).clamp(0, 1).multiply(0.35))
        .rename('drought_context');
      const image = droughtContext.addBands(chirpsRain).addBands(era5Temp);
      const result = await getRegionStats(image, featureCollection, 5500);

      (result.features || []).forEach((feature) => {
        const props = feature.properties || {};
        const districtId = props.districtId;
        evidenceByDistrict[districtId] = {
          ...(evidenceByDistrict[districtId] || {}),
          drought: {
            droughtContextMean: props.drought_context,
            rain30dMm: props.rain_30d_mm,
            temp14dC: props.temp_14d_c
          }
        };
      });
    } catch (error) {
      warnings.push(`Drought evidence could not be computed from GEE: ${error.message}`);
    }
  }

  if (requested.has('nighttime_lights')) {
    try {
      const viirs = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG');
      const latest = ee.Image(viirs.sort('system:time_start', false).first());
      const avgRad = latest.select('avg_rad').rename('night_lights_avg_rad');
      const litMask = latest.select('avg_rad').gt(1.5).rename('night_lights_lit_mask');
      const image = avgRad.addBands(litMask);
      const result = await getRegionStats(image, featureCollection, 500);

      (result.features || []).forEach((feature) => {
        const props = feature.properties || {};
        const districtId = props.districtId;
        evidenceByDistrict[districtId] = {
          ...(evidenceByDistrict[districtId] || {}),
          nighttimeLights: {
            avgRadMean: props.night_lights_avg_rad,
            litAreaShare: props.night_lights_lit_mask
          }
        };
      });
    } catch (error) {
      warnings.push(`Nighttime lights evidence could not be computed from GEE: ${error.message}`);
    }
  }

  return { evidenceByDistrict, warnings };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    districts = [],
    facilities = [],
    disasters = [],
    acledData = [],
    worldPopData = {},
    days = 7,
    enabledEvidenceLayers = []
  } = req.body;

  if (!Array.isArray(districts) || districts.length === 0) {
    return res.status(400).json({ error: 'At least one district is required' });
  }

  const scopedDistricts = districts.slice(0, MAX_DISTRICTS_PER_REQUEST);
  const weatherByDistrict = {};
  const warnings = [];
  let geeEvidenceByDistrict = {};

  for (let index = 0; index < scopedDistricts.length; index += 1) {
    const district = scopedDistricts[index];
    const districtId = district.id ?? index;
    const center = getDistrictCenter(district);

    if (!center?.latitude || !center?.longitude) {
      warnings.push(`Weather forecast unavailable for district ${district.name || districtId}: no usable center point.`);
      continue;
    }

    try {
      weatherByDistrict[districtId] = await fetchDistrictWeather(center.latitude, center.longitude, days);
    } catch (error) {
      warnings.push(`Weather forecast unavailable for district ${district.name || districtId}: ${error.message}`);
    }
  }

  try {
    const geeEvidenceResult = await fetchGeeEvidenceSummaries(scopedDistricts, enabledEvidenceLayers);
    geeEvidenceByDistrict = geeEvidenceResult.evidenceByDistrict;
    warnings.push(...geeEvidenceResult.warnings);
  } catch (error) {
    warnings.push(`Earth Engine district evidence failed: ${error.message}`);
  }

  const analysis = buildDistrictHazardAnalysis({
    districts: scopedDistricts,
    facilities,
    disasters,
    acledData,
    worldPopData,
    weatherByDistrict,
    geeEvidenceByDistrict,
    timeWindowDays: days,
    enabledEvidenceLayers
  });

  return res.status(200).json({
    ...analysis,
    warnings: [
      ...warnings,
      districts.length > MAX_DISTRICTS_PER_REQUEST
        ? `Analysis was limited to the first ${MAX_DISTRICTS_PER_REQUEST} districts for performance. Narrow the selection to review more districts in detail.`
        : null
    ].filter(Boolean)
  });
}

export default withRateLimit(handler);
