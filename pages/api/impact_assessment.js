import { withRateLimit } from '../../lib/rateLimit';
import { runImpactAssessment } from '../../lib/impactAssessment';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase from default 1mb to handle large datasets
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facilities, disasters, acledEvents = [] } = req.body;

    if (!facilities) {
      return res.status(400).json({ error: 'Missing facilities data' });
    }

    if ((!disasters || disasters.length === 0) && (!acledEvents || acledEvents.length === 0)) {
      console.log('No disasters or ACLED events provided - returning empty impact assessment');
      return res.status(200).json({
        impactedFacilities: [],
        statistics: { facilitiesImpacted: 0, totalImpacts: 0 }
      });
    }

    const assessmentResult = runImpactAssessment(req.body);

    res.status(200).json({
      impactedFacilities: assessmentResult.impactedFacilities,
      statistics: assessmentResult.statistics
    });
  } catch (error) {
    console.error('Error assessing impact:', error);
    res.status(500).json({ error: error.message });
  }
}
export default withRateLimit(handler);
