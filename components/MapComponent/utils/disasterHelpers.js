// Disaster Helper Functions

export const getDisasterInfo = (eventType) => {
  const disasterTypes = {
    'eq': {
      name: 'Earthquake',
      icon: '/images/gdacs/earthquake.svg'
    },
    'tc': {
      name: 'Tropical Cyclone',
      icon: '/images/gdacs/cyclone.svg'
    },
    'fl': {
      name: 'Flood',
      icon: '/images/gdacs/flood.svg'
    },
    'vo': {
      name: 'Volcanic Activity',
      icon: '/images/gdacs/volcano.svg'
    },
    'dr': {
      name: 'Drought',
      icon: '/images/gdacs/drought.svg'
    },
    'wf': {
      name: 'Wildfire',
      icon: '/images/gdacs/fire.svg'
    },
    'ts': {
      name: 'Tsunami',
      icon: '/images/gdacs/tsunami.svg'
    }
  };

  const type = eventType?.toLowerCase();
  return disasterTypes[type] || { name: eventType, icon: '/images/gdacs/warning.svg' };
};

export const getDisasterTypeName = (eventType) => {
  return getDisasterInfo(eventType).name;
};

export const getAlertColor = (alertLevel) => {
  if (!alertLevel) return '#1A365D'; // Aidstack navy

  const level = alertLevel.toLowerCase();

  if (level === 'red' || level === 'extreme' || level === 'severe') {
    return '#ff4444';
  } else if (level === 'orange' || level === 'moderate') {
    return '#ffa500';
  } else if (level === 'green' || level === 'minor') {
    return '#4CAF50';
  } else {
    return '#1A365D'; // Aidstack navy
  }
};

export const getNormalizedSeverity = (disaster) => {
  const severity = (disaster.severity || disaster.alertLevel || '').toLowerCase();
  if (!severity) return 'unknown';
  return severity;
};

export const getNormalizedCertainty = (disaster) => {
  const certainty = (disaster.certainty || '').toLowerCase();
  if (!certainty) return 'unknown';
  return certainty;
};

export const getNormalizedUrgency = (disaster) => {
  const urgency = (disaster.urgency || '').toLowerCase();
  if (!urgency) return 'unknown';
  return urgency;
};

export const getAvailableDisasterTypes = (disasters) => {
  const types = new Set();
  if (disasters && Array.isArray(disasters)) {
    disasters.forEach(disaster => {
      if (disaster.eventType) {
        types.add(disaster.eventType.toLowerCase());
      }
    });
  }
  return Array.from(types);
};

export const getHeatmapIntensity = (disaster) => {
  let intensity = 0.5; // Default
  const severity = (disaster.severity || disaster.alertLevel || '').toLowerCase();

  if (severity.includes('extreme')) intensity = 1.0;
  else if (severity.includes('severe')) intensity = 0.8;
  else if (severity.includes('moderate')) intensity = 0.6;
  else if (severity.includes('minor')) intensity = 0.4;

  return intensity;
};

export const getBaseRadiusForZoom = (zoom) => {
  if (zoom <= 2) return 500000;       // Very zoomed out (world view)
  if (zoom <= 4) return 300000;       // Continental view
  if (zoom <= 6) return 200000;       // Country view
  if (zoom <= 8) return 100000;       // Regional view
  return 50000;                       // City view or closer
};
