import { withRateLimit } from '../../lib/rateLimit';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

// Cache EE initialization across warm invocations
let eeInitialized = false;
let eeInitPromise = null;

async function initEE() {
  if (eeInitialized) {
    console.log('[WorldPop Tiles] EE already initialized');
    return;
  }
  if (eeInitPromise) {
    console.log('[WorldPop Tiles] EE initialization in progress, waiting...');
    return eeInitPromise;
  }

  console.log('[WorldPop Tiles] Starting EE initialization...');

  eeInitPromise = new Promise((resolve, reject) => {
    const ee = require('@google/earthengine');
    let privateKey;
    try {
      const raw = process.env.GEE_SERVICE_ACCOUNT_KEY;
      const cleaned = raw?.trim().replace(/^'([\s\S]*)'$/, '$1');
      privateKey = JSON.parse(cleaned);
      console.log('[WorldPop Tiles] Service account parsed, project:', privateKey.project_id);
    } catch (e) {
      console.error('[WorldPop Tiles] Failed to parse GEE_SERVICE_ACCOUNT_KEY:', e.message);
      return reject(new Error('GEE_SERVICE_ACCOUNT_KEY is not valid JSON'));
    }

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        console.log('[WorldPop Tiles] EE authentication successful, initializing...');
        ee.initialize(null, null, () => {
          eeInitialized = true;
          console.log('[WorldPop Tiles] EE initialization complete');
          resolve();
        }, (err) => {
          console.error('[WorldPop Tiles] EE initialization failed:', err);
          reject(new Error(`EE init failed: ${err}`));
        });
      },
      (err) => {
        console.error('[WorldPop Tiles] EE authentication failed:', err);
        reject(new Error(`EE auth failed: ${err}`));
      }
    );
  });

  return eeInitPromise;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEE_SERVICE_ACCOUNT_KEY) {
    return res.status(503).json({ error: 'Google Earth Engine is not configured on this server.' });
  }

  const { year = 2020, dataType = 'total', bounds } = req.body;

  const parsedYear = parseInt(year, 10);
  if (parsedYear < 2015 || parsedYear > 2030) {
    return res.status(400).json({ error: 'year must be between 2015 and 2030' });
  }

  try {
    await initEE();
    const ee = require('@google/earthengine');

    console.log(`[WorldPop Tiles] Generating tile URL for year=${year}, dataType=${dataType}`);

    // Select the appropriate collection
    const collectionId = dataType === 'agesex'
      ? 'projects/sat-io/open-datasets/WORLDPOP/agesex'
      : 'projects/sat-io/open-datasets/WORLDPOP/pop';

    console.log(`[WorldPop Tiles] Using collection: ${collectionId}`);

    const collection = ee.ImageCollection(collectionId)
      .filterDate(`${parsedYear}-01-01`, `${parsedYear + 1}-01-01`);

    // Get the mosaic image
    const image = collection.mosaic();

    // For total population, select the population band
    let selectedImage = dataType === 'agesex'
      ? image  // Use all bands for agesex
      : image.select(['population']); // Select only population band for total

    // Clip to bounds if provided
    if (bounds) {
      console.log('[WorldPop Tiles] Clipping to bounds:', bounds);
      const geometry = ee.Geometry.Rectangle([
        bounds.west,
        bounds.south,
        bounds.east,
        bounds.north
      ]);
      selectedImage = selectedImage.clip(geometry);
    } else {
      console.log('[WorldPop Tiles] No bounds provided - showing global/regional data');
    }

    // Define visualization parameters
    const visParams = dataType === 'agesex'
      ? {
          // For agesex, we'll sum all bands and visualize
          min: 0,
          max: 1000, // Adjust based on your needs
          palette: ['#0571b0', '#92c5de', '#f7f7f7', '#f4a582', '#ca0020']
        }
      : {
          // For total population density
          min: 0,
          max: 500, // people per 100m pixel
          palette: ['#0571b0', '#92c5de', '#f7f7f7', '#f4a582', '#ca0020']
        };

    // If agesex, sum all male and female bands for visualization
    let visualizationImage;
    if (dataType === 'agesex') {
      // Sum all f_* and m_* bands to get total population
      // List all 38 age-sex bands explicitly and sum them
      visualizationImage = selectedImage
        .select(['f_00', 'm_00', 'f_01', 'm_01', 'f_05', 'm_05', 'f_10', 'm_10',
                 'f_15', 'm_15', 'f_20', 'm_20', 'f_25', 'm_25', 'f_30', 'm_30',
                 'f_35', 'm_35', 'f_40', 'm_40', 'f_45', 'm_45', 'f_50', 'm_50',
                 'f_55', 'm_55', 'f_60', 'm_60', 'f_65', 'm_65', 'f_70', 'm_70',
                 'f_75', 'm_75', 'f_80', 'm_80', 'f_85', 'm_85', 'f_90', 'm_90'])
        .reduce(ee.Reducer.sum())
        .rename('total_pop');
    } else {
      visualizationImage = selectedImage;
    }

    // Get the tile URL using getMapId
    const mapIdPromise = new Promise((resolve, reject) => {
      visualizationImage.getMapId(visParams, (mapId, error) => {
        if (error) {
          console.error('[WorldPop Tiles] getMapId error:', error);
          reject(new Error(typeof error === 'string' ? error : JSON.stringify(error)));
        } else {
          console.log('[WorldPop Tiles] MapId obtained:', mapId);
          resolve(mapId);
        }
      });
    });

    const mapId = await mapIdPromise;

    // Use the urlFormat provided by GEE (it has the correct URL structure)
    // GEE returns a urlFormat field with the proper tile URL template
    const tileUrl = mapId.urlFormat || `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/{z}/{x}/{y}`;

    console.log('[WorldPop Tiles] Tile URL generated successfully:', tileUrl);

    return res.status(200).json({
      success: true,
      tileUrl,
      mapId: mapId.mapid,
      token: mapId.token,
      year: parsedYear,
      dataType,
      visParams
    });

  } catch (error) {
    console.error('[WorldPop Tiles] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to generate tile URL from Earth Engine.' });
  }
}

export default withRateLimit(handler);
