import { withRateLimit } from '../../lib/rateLimit';
import { groupAgeBands } from '../../utils/worldpopHelpers';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

// Cache EE initialization across warm invocations
let eeInitialized = false;
let eeInitPromise = null;

async function initEE() {
  if (eeInitialized) {
    console.log('[WorldPop] EE already initialized');
    return;
  }
  if (eeInitPromise) {
    console.log('[WorldPop] EE initialization in progress, waiting...');
    return eeInitPromise;
  }

  console.log('[WorldPop] Starting EE initialization...');

  eeInitPromise = new Promise((resolve, reject) => {
    const ee = require('@google/earthengine');
    let privateKey;
    try {
      const raw = process.env.GEE_SERVICE_ACCOUNT_KEY;
      // Strip surrounding single quotes if present (common .env formatting)
      const cleaned = raw?.trim().replace(/^'([\s\S]*)'$/, '$1');
      privateKey = JSON.parse(cleaned);
      console.log('[WorldPop] Service account parsed, project:', privateKey.project_id);
    } catch (e) {
      console.error('[WorldPop] Failed to parse GEE_SERVICE_ACCOUNT_KEY:', e.message);
      return reject(new Error('GEE_SERVICE_ACCOUNT_KEY is not valid JSON'));
    }

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        console.log('[WorldPop] EE authentication successful, initializing...');
        ee.initialize(null, null, () => {
          eeInitialized = true;
          console.log('[WorldPop] EE initialization complete');
          resolve();
        }, (err) => {
          console.error('[WorldPop] EE initialization failed:', err);
          reject(new Error(`EE init failed: ${err}`));
        });
      },
      (err) => {
        console.error('[WorldPop] EE authentication failed:', err);
        reject(new Error(`EE auth failed: ${err}`));
      }
    );
  });

  return eeInitPromise;
}

function districtToEEGeometry(ee, geometry) {
  if (!geometry) return null;
  try {
    let geom;
    if (geometry.type === 'Polygon') {
      geom = ee.Geometry.Polygon(geometry.coordinates, null, false); // geodesic=false for lat/lng
    } else if (geometry.type === 'MultiPolygon') {
      geom = ee.Geometry.MultiPolygon(geometry.coordinates, null, false);
    } else {
      return null;
    }

    // Explicitly ensure the geometry is in EPSG:4326 (WGS84)
    return geom;
  } catch (e) {
    console.error('[WorldPop] Geometry conversion error:', e.message);
    return null;
  }
}

async function fetchWorldPopStats(districts, year, dataType) {
  await initEE();
  const ee = require('@google/earthengine');

  console.log(`[WorldPop] Starting fetch: year=${year}, dataType=${dataType}, districts=${districts.length}`);

  const collectionId = dataType === 'agesex'
    ? 'projects/sat-io/open-datasets/WORLDPOP/agesex'
    : 'projects/sat-io/open-datasets/WORLDPOP/pop';

  console.log(`[WorldPop] Using collection: ${collectionId}`);

  const collection = ee.ImageCollection(collectionId)
    .filterDate(`${year}-01-01`, `${year + 1}-01-01`);

  const collectionSize = await new Promise((resolve, reject) => {
    collection.size().getInfo((size, err) => {
      if (err) reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
      else resolve(size);
    });
  });

  console.log(`[WorldPop] Collection size for ${year}: ${collectionSize}`);

  if (collectionSize === 0) {
    throw new Error(`No WorldPop data available for year ${year}. Try a different year (e.g. 2020).`);
  }

  // Use mosaic to combine all images in the collection for better coverage
  const image = collection.mosaic();

  // For total population, we need to select the correct band
  // The agesex dataset has all f_XX/m_XX bands, but total has just 'population'
  const selectedImage = dataType === 'agesex'
    ? image  // Use all bands for agesex
    : image.select(['population']); // Select only population band for total

  console.log('[WorldPop] Image selected, dataType:', dataType);

  // Build EE FeatureCollection from district geometries
  const features = districts
    .map((district, idx) => {
      const geom = districtToEEGeometry(ee, district.geometry);
      if (!geom) {
        console.warn(`[WorldPop] Invalid geometry for district ${district.id}: ${district.name}`);
        return null;
      }

      // Debug: log first geometry to check coordinates
      if (idx === 0) {
        console.log('[WorldPop] First district geometry sample:', JSON.stringify(district.geometry).substring(0, 200));
      }

      return ee.Feature(geom, {
        districtId: String(district.id),
        districtName: district.name || `District ${district.id}`,
      });
    })
    .filter(Boolean);

  if (features.length === 0) {
    throw new Error('No valid geometries found in districts');
  }

  console.log(`[WorldPop] Valid geometries: ${features.length}/${districts.length}`);

  const featureCollection = ee.FeatureCollection(features);

  // Single reduceRegions call for all districts — one GEE computation
  // Use bestEffort: true to let GEE automatically handle the appropriate scale
  const reduced = selectedImage.reduceRegions({
    collection: featureCollection,
    reducer: ee.Reducer.sum(),
    scale: 100, // WorldPop Global 2 is at 100m resolution
    tileScale: 4, // Increase tile size to handle larger areas without timeout
  });

  return new Promise((resolve, reject) => {
    reduced.getInfo((data, err) => {
      if (err) {
        console.error('[WorldPop] GEE getInfo error:', err);
        reject(new Error(typeof err === 'string' ? err : JSON.stringify(err)));
      } else {
        console.log(`[WorldPop] GEE returned ${data?.features?.length || 0} features`);
        // Log first feature properties to see what bands/properties GEE returns
        if (data?.features?.[0]) {
          const sampleProps = data.features[0].properties || {};
          console.log('[WorldPop] Sample properties from first feature:', Object.keys(sampleProps));
          // Log actual values for debugging
          console.log('[WorldPop] Sample raw values:', {
            districtId: sampleProps.districtId,
            districtName: sampleProps.districtName,
            f_00: sampleProps.f_00,
            m_00: sampleProps.m_00,
            population: sampleProps.population,
            sum: sampleProps.sum,
          });
        }
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

    const results = (geeResult.features || []).map((feature, index) => {
      const props = feature.properties || {};
      const districtId = props.districtId;

      if (dataType === 'agesex') {
        // Debug: log raw props for first district
        if (index === 0) {
          console.log('[WorldPop] Processing agesex data, raw props for first district:', {
            districtId,
            f_00: props.f_00,
            m_00: props.m_00,
            f_01: props.f_01,
            m_01: props.m_01,
          });
        }

        const ageGroups = groupAgeBands(props);

        if (index === 0) {
          console.log('[WorldPop] After groupAgeBands:', ageGroups);
        }

        return { districtId, total: ageGroups.total, ageGroups };
      } else {
        // When using reducer.sum() with a single selected band, GEE returns it as 'sum'
        const total = Math.round(props.sum || 0);

        if (index === 0) {
          console.log('[WorldPop] Processing total population, raw value for first district:', {
            districtId,
            districtName: props.districtName,
            sum: props.sum,
            rounded: total,
          });
        }

        if (total === 0) {
          console.warn(`[WorldPop] Zero population for district ${districtId}, available props:`, Object.keys(props), 'sum value:', props.sum);
        }

        return { districtId, total };
      }
    });

    console.log(`[WorldPop] Returning ${results.length} results, sample:`, results[0]);
    return res.status(200).json({ success: true, results, year: parsedYear, dataType });
  } catch (error) {
    console.error('WorldPop GEE error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to fetch population data from Earth Engine.' });
  }
}

export default withRateLimit(handler);
