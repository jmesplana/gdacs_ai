import { withRateLimit } from '../../lib/rateLimit';
import { groupAgeBands } from '../../utils/worldpopHelpers';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

// Cache EE initialization across warm invocations
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
      // Strip surrounding single quotes if present (common .env formatting)
      const cleaned = raw?.trim().replace(/^'([\s\S]*)'$/, '$1');
      privateKey = JSON.parse(cleaned);
    } catch (e) {
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

function districtToEEGeometry(ee, geometry) {
  if (!geometry) return null;
  try {
    if (geometry.type === 'Polygon') {
      return ee.Geometry.Polygon(geometry.coordinates);
    }
    if (geometry.type === 'MultiPolygon') {
      return ee.Geometry.MultiPolygon(geometry.coordinates);
    }
  } catch (_) {
    return null;
  }
  return null;
}

async function fetchWorldPopStats(districts, year, dataType) {
  await initEE();
  const ee = require('@google/earthengine');

  const collectionId = dataType === 'agesex'
    ? 'projects/sat-io/open-datasets/WORLDPOP/agesex'
    : 'projects/sat-io/open-datasets/WORLDPOP/pop';

  const collection = ee.ImageCollection(collectionId)
    .filterDate(`${year}-01-01`, `${year + 1}-01-01`);

  const collectionSize = await new Promise((resolve, reject) => {
    collection.size().getInfo((size, err) => {
      if (err) reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
      else resolve(size);
    });
  });

  if (collectionSize === 0) {
    throw new Error(`No WorldPop data available for year ${year}. Try a different year (e.g. 2020).`);
  }

  const image = collection.first();

  // Build EE FeatureCollection from district geometries
  const features = districts
    .map((district) => {
      const geom = districtToEEGeometry(ee, district.geometry);
      if (!geom) return null;
      return ee.Feature(geom, {
        districtId: String(district.id),
        districtName: district.name || `District ${district.id}`,
      });
    })
    .filter(Boolean);

  if (features.length === 0) {
    throw new Error('No valid geometries found in districts');
  }

  const featureCollection = ee.FeatureCollection(features);

  // Single reduceRegions call for all districts — one GEE computation
  const reduced = image.reduceRegions({
    collection: featureCollection,
    reducer: ee.Reducer.sum(),
    scale: 1000, // 1km for performance; close enough for population sums
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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({ error: 'Google Earth Engine is not configured on this server.' });
  }

  const { districts, year = 2020, dataType = 'total' } = req.body;

  if (!districts || !Array.isArray(districts) || districts.length === 0) {
    return res.status(400).json({ error: 'districts array is required' });
  }

  const parsedYear = parseInt(year, 10);
  if (parsedYear < 2015 || parsedYear > 2030) {
    return res.status(400).json({ error: 'year must be between 2015 and 2030' });
  }

  try {
    const geeResult = await fetchWorldPopStats(districts, parsedYear, dataType);

    const results = (geeResult.features || []).map((feature) => {
      const props = feature.properties || {};
      const districtId = props.districtId;

      if (dataType === 'agesex') {
        const ageGroups = groupAgeBands(props);
        return { districtId, total: ageGroups.total, ageGroups };
      } else {
        return { districtId, total: Math.round(props.population || 0) };
      }
    });

    return res.status(200).json({ success: true, results, year: parsedYear, dataType });
  } catch (error) {
    console.error('WorldPop GEE error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch population data from Earth Engine.' });
  }
}

export default withRateLimit(handler);
