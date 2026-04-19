import { withRateLimit } from '../../lib/rateLimit';
import {
  aggregateAcledByTime,
  aggregateDisastersByTime,
  calculateFacilityRiskTrends,
  calculateDistrictComparison,
  getSummaryMetrics
} from '../../lib/trendAnalysis';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      districts = [],
      selectedDistricts = [],
      facilities = [],
      acledData = [],
      disasters = [],
      timeWindowDays = 30
    } = req.body || {};

    // Validation
    if (!Array.isArray(selectedDistricts) || selectedDistricts.length === 0) {
      return res.status(400).json({ error: 'At least one district must be selected' });
    }

    if (!Array.isArray(districts) || districts.length === 0) {
      return res.status(400).json({ error: 'Districts data is required' });
    }

    // Check if at least one data source is available
    const hasData = (facilities?.length > 0) || (acledData?.length > 0) || (disasters?.length > 0);
    if (!hasData) {
      return res.status(400).json({ error: 'At least one data source (facilities, ACLED, or disasters) is required' });
    }

    // Calculate summary metrics
    const summary = getSummaryMetrics(
      selectedDistricts,
      facilities || [],
      acledData || [],
      disasters || [],
      timeWindowDays
    );

    // Calculate ACLED trends (returns null if no data)
    const acledTrends = aggregateAcledByTime(
      acledData || [],
      selectedDistricts,
      'daily',
      timeWindowDays
    );

    // Calculate facility risk trends (returns null if no data)
    const facilityRiskTrends = calculateFacilityRiskTrends(
      facilities || [],
      disasters || [],
      acledData || [],
      selectedDistricts,
      timeWindowDays
    );

    // Calculate disaster trends (returns null if no data)
    const disasterTrends = aggregateDisastersByTime(
      disasters || [],
      selectedDistricts,
      'weekly'
    );

    // Calculate district comparison (scoped to time window for consistency)
    const districtComparison = calculateDistrictComparison(
      selectedDistricts,
      facilities || [],
      acledData || [],
      disasters || [],
      timeWindowDays
    );

    // Build warnings array
    const warnings = [];
    if (!acledTrends) warnings.push(`No ACLED data in the last ${timeWindowDays} days for selected districts`);
    if (!facilityRiskTrends) warnings.push('No facility data available for selected districts');
    if (!disasterTrends) warnings.push(`No disaster data in the last ${timeWindowDays} days for selected districts`);

    // Return response
    return res.status(200).json({
      success: true,
      summary,
      acledTrends,
      facilityRiskTrends,
      disasterTrends,
      districtComparison,
      warnings: warnings.length > 0 ? warnings : null
    });

  } catch (error) {
    console.error('Error generating trend analysis:', error);
    return res.status(500).json({ error: 'Failed to generate trend analysis' });
  }
}

export default withRateLimit(handler);
