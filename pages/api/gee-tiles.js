import { withRateLimit } from '../../lib/rateLimit';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

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

function buildGeometry(ee, bounds) {
  if (!bounds) return null;

  return ee.Geometry.Rectangle([
    bounds.west,
    bounds.south,
    bounds.east,
    bounds.north
  ]);
}

function buildSentinel2RecentClear(ee, geometry) {
  const endDate = ee.Date(Date.now());
  const startDate = endDate.advance(-10, 'day');

  const s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70));

  const cloudScore = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED')
    .filterDate(startDate, endDate);

  const joined = ee.Join.saveFirst('cloud_score').apply({
    primary: s2,
    secondary: cloudScore,
    condition: ee.Filter.equals({
      leftField: 'system:index',
      rightField: 'system:index'
    })
  });

  const masked = ee.ImageCollection(joined).map((image) => {
    const scoreImage = ee.Image(image.get('cloud_score'));
    const clearMask = ee.Algorithms.If(
      scoreImage,
      scoreImage.select('cs_cdf').gte(0.6),
      ee.Image(1)
    );

    return ee.Image(image)
      .updateMask(ee.Image(clearMask))
      .select(['B4', 'B3', 'B2'])
      .divide(10000);
  });

  let composite = masked.median();
  if (geometry) composite = composite.clip(geometry);

  return {
    image: composite,
    visParams: { min: 0.02, max: 0.35, gamma: 1.15 },
  };
}

function buildSentinel1RecentChange(ee, geometry) {
  const endDate = ee.Date(Date.now());
  const recentStart = endDate.advance(-12, 'day');
  const baselineStart = endDate.advance(-36, 'day');
  const baselineEnd = endDate.advance(-18, 'day');

  const baseCollection = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));

  const applyGeometry = (collection) => geometry ? collection.filterBounds(geometry) : collection;

  const recent = applyGeometry(baseCollection)
    .filterDate(recentStart, endDate)
    .select('VV')
    .median();

  const baseline = applyGeometry(baseCollection)
    .filterDate(baselineStart, baselineEnd)
    .select('VV')
    .median();

  let change = recent.subtract(baseline).rename('change');
  if (geometry) change = change.clip(geometry);

  return {
    image: change,
    visParams: {
      min: -3,
      max: 3,
      palette: ['#2166ac', '#f7f7f7', '#b2182b']
    },
  };
}

function buildFloodContext(ee, geometry) {
  const dem = ee.Image('USGS/SRTMGL1_003');
  const slope = ee.Terrain.slope(dem);
  const lowSlope = ee.Image(1).subtract(slope.divide(20).clamp(0, 1));
  const waterOccurrence = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
    .select('occurrence')
    .divide(100)
    .clamp(0, 1);

  let floodContext = lowSlope.multiply(0.6).add(waterOccurrence.multiply(0.4)).rename('flood_context');
  if (geometry) floodContext = floodContext.clip(geometry);

  return {
    image: floodContext,
    visParams: {
      min: 0,
      max: 1,
      palette: ['#fff7ed', '#fed7aa', '#fb923c', '#2563eb', '#0f172a']
    },
  };
}

function buildDroughtContext(ee, geometry) {
  const chirpsCollection = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY');
  const chirpsLatest = ee.Image(chirpsCollection.sort('system:time_start', false).first());
  const chirpsEndDate = ee.Date(chirpsLatest.get('system:time_start')).advance(1, 'day');
  const rainStart = chirpsEndDate.advance(-30, 'day');
  const chirpsRain = chirpsCollection
    .filterDate(rainStart, chirpsEndDate)
    .select('precipitation')
    .sum();

  const era5Collection = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR');
  const era5Latest = ee.Image(era5Collection.sort('system:time_start', false).first());
  const era5EndDate = ee.Date(era5Latest.get('system:time_start')).advance(1, 'day');
  const tempStart = era5EndDate.advance(-14, 'day');
  const era5Temp = era5Collection
    .filterDate(tempStart, era5EndDate)
    .select('temperature_2m')
    .mean()
    .subtract(273.15);

  const lowRain = ee.Image(1).subtract(chirpsRain.divide(120).clamp(0, 1));
  const heatStress = era5Temp.subtract(28).divide(12).clamp(0, 1);

  let droughtContext = lowRain.multiply(0.65).add(heatStress.multiply(0.35)).rename('drought_context');
  if (geometry) droughtContext = droughtContext.clip(geometry);

  return {
    image: droughtContext,
    visParams: {
      min: 0,
      max: 1,
      palette: ['#1d4ed8', '#60a5fa', '#fef3c7', '#f59e0b', '#92400e']
    },
  };
}

function buildDataset(ee, dataset, geometry) {
  switch (dataset) {
    case 'sentinel2_recent_clear':
      return buildSentinel2RecentClear(ee, geometry);
    case 'sentinel1_recent_change':
      return buildSentinel1RecentChange(ee, geometry);
    case 'flood_context':
      return buildFloodContext(ee, geometry);
    case 'drought_context':
      return buildDroughtContext(ee, geometry);
    default:
      throw new Error(`Unsupported dataset: ${dataset}`);
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({ error: 'Google Earth Engine is not configured on this server.' });
  }

  const { dataset, bounds } = req.body || {};
  if (!dataset) {
    return res.status(400).json({ error: 'dataset is required' });
  }

  try {
    await initEE();
    const ee = require('@google/earthengine');
    const geometry = buildGeometry(ee, bounds);
    const { image, visParams } = buildDataset(ee, dataset, geometry);

    const mapId = await new Promise((resolve, reject) => {
      image.getMapId(visParams, (result, error) => {
        if (error) {
          reject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
        } else {
          resolve(result);
        }
      });
    });

    const tileUrl = mapId.urlFormat || `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/{z}/{x}/{y}`;

    return res.status(200).json({
      success: true,
      dataset,
      tileUrl,
      visParams,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate Earth Engine tiles.' });
  }
}

export default withRateLimit(handler);
