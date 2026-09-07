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
  LIGHT_MINIMAL: {
    id: 'light_minimal',
    name: 'Light Minimal',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  },
  DARK: {
    id: 'dark',
    name: 'Dark Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  },
  NIGHTTIME_LIGHTS: {
    id: 'nighttime_lights',
    name: 'Nighttime Lights (GEE)',
    type: 'gee',
    dataset: 'nighttime_lights',
    baseLayer: 'dark', // Use dark basemap underneath
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG">Google Earth Engine</a> / VIIRS DNB',
    note: 'VIIRS Day/Night Band nighttime lights overlay on dark basemap - shows population centers, infrastructure, and power availability.'
  },
  SATELLITE: {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  RECENT_CLEAR: {
    id: 'recent_clear',
    name: 'Recent Clear (GEE)',
    type: 'gee',
    dataset: 'sentinel2_recent_clear',
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED">Google Earth Engine</a> / Sentinel-2',
    note: 'Cloud-masked Sentinel-2 composite from the last 10 days. Best free clear-looking recent imagery.'
  },
  RADAR_CHANGE: {
    id: 'radar_change',
    name: 'Radar Change (GEE)',
    type: 'gee',
    dataset: 'sentinel1_recent_change',
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD">Google Earth Engine</a> / Sentinel-1',
    note: 'Recent radar change layer for cloudy conditions and flood/change detection. Not photographic imagery.'
  },
  FLOOD_CONTEXT: {
    id: 'flood_context',
    name: 'Flood Context (GEE)',
    type: 'gee',
    dataset: 'flood_context',
    overlayOnBase: true,
    overlayOpacity: 0.62,
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003">Google Earth Engine</a> / SRTM, <a href="https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater">JRC Global Surface Water</a>',
    note: 'Combines terrain and long-term surface water context to identify districts more prone to flood impacts.'
  },
  DROUGHT_CONTEXT: {
    id: 'drought_context',
    name: 'Drought Context (GEE)',
    type: 'gee',
    dataset: 'drought_context',
    overlayOnBase: true,
    overlayOpacity: 0.62,
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/UCSB_CHG_CHIRPS_DAILY">Google Earth Engine</a> / CHIRPS, <a href="https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR">ERA5-Land</a>',
    note: 'Combines recent rainfall and heat context to support drought-readiness screening before scoring districts.'
  },
  ACCESSIBILITY_CONTEXT: {
    id: 'accessibility_context',
    name: 'Accessibility Context (GEE)',
    type: 'gee',
    dataset: 'accessibility_context',
    overlayOnBase: true,
    overlayOpacity: 0.72,
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/Oxford_MAP_accessibility_to_healthcare_2019">Google Earth Engine</a> / Oxford MAP accessibility to healthcare',
    note: 'Shows modeled travel time to the nearest hospital or clinic. Blue means easier access, yellow to dark red means harder to reach.'
  },
  ACTIVE_FIRES: {
    id: 'active_fires',
    name: 'Active Fires (GEE)',
    type: 'gee',
    dataset: 'active_fires',
    baseLayer: 'dark', // Hotspots read best over a dark basemap
    attribution: '&copy; <a href="https://developers.google.com/earth-engine/datasets/catalog/FIRMS">Google Earth Engine</a> / NASA FIRMS VIIRS + MODIS',
    note: 'NASA FIRMS active fire / thermal anomaly detections from the last 7 days. Brighter points indicate stronger thermal signal. Useful for wildfire spread, active burning, and agricultural fires. Not a fire-perimeter product.'
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
