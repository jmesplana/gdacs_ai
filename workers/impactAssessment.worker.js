import { runImpactAssessment } from '../lib/impactAssessment';

self.onmessage = (event) => {
  const { id, payload } = event.data || {};

  try {
    self.postMessage({
      id,
      type: 'progress',
      progress: {
        phase: 'starting',
        processedFacilities: 0,
        totalFacilities: payload?.facilities?.length || 0,
        impactedFacilities: 0
      }
    });

    const result = runImpactAssessment(payload, {
      progressInterval: 100,
      onProgress: (progress) => {
        self.postMessage({ id, type: 'progress', progress });
      }
    });

    self.postMessage({ id, type: 'complete', result });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: {
        message: error?.message || 'Impact assessment worker failed',
        stack: error?.stack || null
      }
    });
  }
};
