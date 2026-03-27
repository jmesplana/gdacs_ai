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

function buildDataset(ee, dataset, geometry) {
  switch (dataset) {
    case 'sentinel2_recent_clear':
      return buildSentinel2RecentClear(ee, geometry);
    case 'sentinel1_recent_change':
      return buildSentinel1RecentChange(ee, geometry);
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
