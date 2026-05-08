import { withRateLimit } from '../../lib/rateLimit';
import { assertEnum, sendApiError } from '../../lib/validation/apiValidation';
import { ALLOWED_WORLDPOP_DATA_TYPES, getAvailableWorldPopYears } from '../../lib/worldpop/worldpopYears';

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
        }, (error) => {
          reject(new Error(`EE init failed: ${error}`));
        });
      },
      (error) => {
        reject(new Error(`EE auth failed: ${error}`));
      }
    );
  });

  return eeInitPromise;
}

async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  if (!process.env.GEE_SERVICE_ACCOUNT_KEY) {
    return sendApiError(res, 503, 'GEE_NOT_CONFIGURED', 'Google Earth Engine is not configured on this server.');
  }

  try {
    const dataType = assertEnum(
      req.method === 'GET' ? (req.query?.dataType || 'total') : (req.body?.dataType || 'total'),
      'dataType',
      ALLOWED_WORLDPOP_DATA_TYPES
    );

    await initEE();
    const ee = require('@google/earthengine');
    const years = await getAvailableWorldPopYears(ee, dataType);

    if (years.length === 0) {
      return sendApiError(res, 404, 'NO_WORLDPOP_YEARS', `No WorldPop years are available for ${dataType}.`);
    }

    return res.status(200).json({
      success: true,
      dataType,
      years,
      latestYear: years[years.length - 1],
    });
  } catch (error) {
    console.error('[WorldPop Years] Error:', error.message);
    return sendApiError(res, error.status || 500, error.code || 'WORLDPOP_YEARS_ERROR', error.message || 'Failed to fetch WorldPop years.');
  }
}

export default withRateLimit(handler);
