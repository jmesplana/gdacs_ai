// Disaster Helper Functions

// Inline SVG icons for better rendering in Leaflet
const disasterIcons = {
  'eq': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12h4l3-9 4 18 3-9h4"/>
  </svg>`,
  'tc': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2c-3.9 0-7 3.1-7 7 0 2.2 1 4.2 2.6 5.5L12 22l4.4-7.5c1.6-1.3 2.6-3.3 2.6-5.5 0-3.9-3.1-7-7-7z"/>
    <circle cx="12" cy="9" r="3"/>
  </svg>`,
  'fl': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 18h18v3H3zM3 14c0-2 1-4 3-4 1 0 2 1 3 2 1-1 2-2 3-2s2 1 3 2c1-1 2-2 3-2 2 0 3 2 3 4"/>
  </svg>`,
  'vo': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2L4 10h5v10h6V10h5z"/>
    <path d="M2 22h20"/>
  </svg>`,
  'dr': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#f39c12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`,
  'wf': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2c-4 4-8 8-8 14 0 4 4 6 8 6s8-2 8-6c0-6-4-10-8-14z"/>
    <path d="M12 5c-3 3-5 6-5 9 0 3 2 5 5 5s5-2 5-5c0-3-2-6-5-9z" fill="#e74c3c" fill-opacity="0.3"/>
  </svg>`,
  'ts': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12h4c0 3 2 5 5 5s5-2 5-5h6"/>
    <path d="M2 12c0-3 2-5 5-5s5 2 5 5"/>
    <path d="M16 12c0 3 2 5 5 5"/>
  </svg>`,
  'default': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`
};

export const getDisasterInfo = (eventType) => {
  const disasterTypes = {
    'eq': {
      name: 'Earthquake',
      icon: '/images/gdacs/earthquake.svg',
      inlineSvg: disasterIcons.eq
    },
    'tc': {
      name: 'Tropical Cyclone',
      icon: '/images/gdacs/cyclone.svg',
      inlineSvg: disasterIcons.tc
    },
    'fl': {
      name: 'Flood',
      icon: '/images/gdacs/flood.svg',
      inlineSvg: disasterIcons.fl
    },
    'vo': {
      name: 'Volcanic Activity',
      icon: '/images/gdacs/volcano.svg',
      inlineSvg: disasterIcons.vo
    },
    'dr': {
      name: 'Drought',
      icon: '/images/gdacs/drought.svg',
      inlineSvg: disasterIcons.dr
    },
    'wf': {
      name: 'Wildfire',
      icon: '/images/gdacs/fire.svg',
      inlineSvg: disasterIcons.wf
    },
    'ts': {
      name: 'Tsunami',
      icon: '/images/gdacs/tsunami.svg',
      inlineSvg: disasterIcons.ts
    }
  };

  const type = eventType?.toLowerCase();
  return disasterTypes[type] || { name: eventType, icon: '/images/gdacs/warning.svg', inlineSvg: disasterIcons.default };
};

export const getDisasterTypeName = (eventType) => {
  return getDisasterInfo(eventType).name;
};

export const getDisasterTimelineDate = (disaster) => {
  if (!disaster) return null;

  const candidates = [
    disaster.lastModified,
    disaster.pubDate,
    disaster.fromDate,
    disaster.fromdate,
    disaster.pubdate,
    disaster.toDate,
    disaster.todate,
    disaster.date
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
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
