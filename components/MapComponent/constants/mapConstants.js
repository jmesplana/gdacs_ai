// Map Configuration Constants

export const ZOOM_RADIUS_CONFIG = {
  WORLD_VIEW: { maxZoom: 2, radius: 500000 },
  CONTINENTAL: { maxZoom: 4, radius: 300000 },
  COUNTRY: { maxZoom: 6, radius: 200000 },
  REGIONAL: { maxZoom: 8, radius: 100000 },
  CITY: { maxZoom: Infinity, radius: 50000 }
};

export const MAP_LAYERS = {
  STREET: {
    id: 'street',
    name: 'Street Map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  SATELLITE: {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  TERRAIN: {
    id: 'terrain',
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
  }
};

export const ROAD_OVERLAY = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  opacity: 0.5
};

export const DISASTER_TYPES = {
  eq: { name: 'Earthquake', icon: '🏚️', color: '#8B4513' },
  tc: { name: 'Tropical Cyclone', icon: '🌀', color: '#4682B4' },
  fl: { name: 'Flood', icon: '🌊', color: '#1E90FF' },
  vo: { name: 'Volcano', icon: '🌋', color: '#FF4500' },
  dr: { name: 'Drought', icon: '☀️', color: '#FFD700' },
  wf: { name: 'Wildfire', icon: '🔥', color: '#FF6347' },
  ts: { name: 'Tsunami', icon: '🌊', color: '#00CED1' }
};

export const ALERT_LEVELS = {
  RED: { color: '#DC143C', label: 'Red Alert', severity: 'Extreme' },
  ORANGE: { color: '#FF8C00', label: 'Orange Alert', severity: 'Severe' },
  GREEN: { color: '#32CD32', label: 'Green Alert', severity: 'Moderate' }
};

export const CAP_FILTERS = {
  SEVERITY: ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'],
  CERTAINTY: ['Observed', 'Likely', 'Possible', 'Unlikely', 'Unknown'],
  URGENCY: ['Immediate', 'Expected', 'Future', 'Past', 'Unknown']
};

export const DEFAULT_MAP_CENTER = [20, 0];
export const DEFAULT_MAP_ZOOM = 2.5;
export const MIN_MAP_ZOOM = 2;
export const MAX_MAP_ZOOM = 18;

export const ANIMATION_SPEEDS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' }
];

export const DRAWING_COLORS = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080'
];
