import { useEffect, useMemo, useRef, useState } from 'react';
// GDACS Facilities Impact Assessment Tool
// Developed by John Mark Esplana (https://github.com/jmesplana)
import { MapContainer, TileLayer, WMSTileLayer, CircleMarker, Marker as ReactLeafletMarker, Popup, Tooltip, GeoJSON } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import ReactMarkdown from 'react-markdown';
import ShapefileUploader from './ShapefileUploader';

// Fix for default markers in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Import extracted components
import {
  HeatmapLayer,
  MapAccess,
  DrawingLayer,
  DisasterMarkers,
  StatisticsPanel,
  TimelineVisualization,
  AcledMarkers
} from './MapComponent/components';
import OSMInfrastructureLayer from './MapComponent/components/OSMInfrastructureLayer';
import LogisticsOverlaysLayer from './MapComponent/components/LogisticsOverlaysLayer';
import { calculateBounds } from '../utils/worldpopHelpers';

import {
  FilterDrawer,
  UnifiedDrawer,
  ColumnSelectionModal,
  ChatDrawer,
  WorldPopDrawer,
  MapLayersDrawer
} from './MapComponent/components/drawers';

import {
  FloatingActionButtons,
  MapLegend,
  CampaignDashboard,
  HamburgerMenu,
  TimelineScrubber
} from './MapComponent/components/overlays';

// Import hooks
import {
  useMapFilters,
  useDrawing,
  useFileUpload,
  useMapControls,
  useAIAnalysis,
  usePlayback,
  useWorldPop
} from './MapComponent/hooks';
import { useOSMInfrastructure } from './MapComponent/hooks/useOSMInfrastructure';
import { useLogisticsAssessment } from './MapComponent/hooks/useLogisticsAssessment';

// Import utils
import {
  getDisasterInfo,
  getAlertColor,
  zoomToFilteredEvents,
  toggleFullscreen
} from './MapComponent/utils';

import buildWeatherContext from '../utils/weatherContextBuilder';
// import { WORLDPOP_TILE_LAYERS } from '../utils/worldpopHelpers'; // Not needed - using GEE tiles
import { useToast } from './Toast';
import { getOperationType } from '../config/operationTypes';
import { buildDistrictRiskIndex, isPointInDistricts } from '../lib/districtRiskScoring';

// Import constants
import {
  MAP_LAYERS,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM
} from './MapComponent/constants';

// Custom styles for animations and labels
const customStyles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      stroke-width: 4;
      stroke-opacity: 1;
    }
    50% {
      stroke-width: 6;
      stroke-opacity: 0.7;
    }
  }

  .fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }

  .highlighted-district {
    animation: pulse 2s ease-in-out infinite;
  }

  .facility-label {
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    pointer-events: none;
    z-index: 1000;
  }

  .facility-label.impacted {
    background: rgba(255, 68, 68, 0.95);
    color: white;
    border-color: #d32f2f;
  }

  .facility-label.safe {
    background: rgba(76, 175, 80, 0.95);
    color: white;
    border-color: #388e3c;
  }

  .district-label {
    background: rgba(33, 150, 243, 0.9) !important;
    border: 2px solid rgba(25, 118, 210, 0.9) !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-size: 13px !important;
    font-weight: 700 !important;
    font-family: 'Inter', sans-serif !important;
    color: white !important;
    white-space: nowrap !important;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3) !important;
    pointer-events: none !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
  }

  .drawer-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 998;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .drawer-backdrop.open {
    opacity: 1;
    pointer-events: all;
  }

  .drawer {
    position: fixed;
    top: 0;
    height: 100vh;
    width: 400px;
    background: white;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
    z-index: 999;
    overflow-y: auto;
    transition: transform 0.3s ease;
  }

  .drawer-right {
    right: 0;
    transform: translateX(100%);
  }

  .drawer-right.open {
    transform: translateX(0);
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
    background: linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%);
    color: white;
  }

  .drawer-title {
    margin: 0;
    font-size: 18px;
    font-weight: bold;
    display: flex;
    align-items: center;
  }

  .drawer-close {
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: white;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }

  .drawer-close:hover {
    transform: scale(1.2);
  }

  .drawer-content {
    padding: 20px;
  }

  .drawer-section {
    margin-bottom: 20px;
  }

  .leaflet-top.leaflet-left {
    top: 110px;
  }
`;

function simplifyRing(ring = [], maxPoints = 250) {
  if (!Array.isArray(ring) || ring.length <= maxPoints) return ring;

  const closed = ring.length > 2 &&
    ring[0]?.[0] === ring[ring.length - 1]?.[0] &&
    ring[0]?.[1] === ring[ring.length - 1]?.[1];
  const workingRing = closed ? ring.slice(0, -1) : ring.slice();
  const stride = Math.max(1, Math.ceil(workingRing.length / maxPoints));
  const simplified = workingRing.filter((_, index) => index === 0 || index === workingRing.length - 1 || index % stride === 0);

  if (closed) {
    simplified.push(simplified[0]);
  }

  return simplified;
}

function simplifyGeometry(geometry = null) {
  if (!geometry?.type || !geometry?.coordinates) return geometry;

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring, index) => simplifyRing(ring, index === 0 ? 250 : 100))
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring, index) => simplifyRing(ring, index === 0 ? 250 : 100))
      )
    };
  }

  return geometry;
}

function compactDistrictForContext(district = {}, index = 0) {
  const props = district.properties || {};

  return {
    id: district.id || index,
    name: district.name || props.ADM2_EN || props.NAME_2 || props.NAME || props.name || props.district || `Selected Area ${index + 1}`,
    country: district.country,
    region: district.region,
    geometry: simplifyGeometry(district.geometry || null),
    bounds: district.bounds || null,
    properties: {
      ADM2_EN: props.ADM2_EN,
      NAME_2: props.NAME_2,
      NAME: props.NAME,
      name: props.name,
      district: props.district,
      population: props.population,
      POP: props.POP
    }
  };
}

const LARGE_DISTRICT_COUNT = 80;
const MAX_DISTRICT_LABELS = 60;

function buildAcledAggregateSummary(events = [], selectedDistricts = []) {
  const scopedEvents = selectedDistricts.length > 0
    ? events.filter((event) => isPointInDistricts(event.latitude, event.longitude, selectedDistricts))
    : events;

  const byEventType = scopedEvents.reduce((acc, event) => {
    const key = event?.event_type || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const bySubEventType = scopedEvents.reduce((acc, event) => {
    const key = event?.sub_event_type || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byActor1 = scopedEvents.reduce((acc, event) => {
    const key = event?.actor1 || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    totalEvents: scopedEvents.length,
    byEventType,
    bySubEventType,
    byActor1,
    latestEventDate: scopedEvents[0]?.event_date || null,
    selectedDistrictCount: selectedDistricts.length
  };
}

function extractLocationFromDistrict(district) {
  const props = district?.properties || district || {};
  const countryFields = [
    'NAME_0', 'ADM0_EN', 'COUNTRY', 'Country', 'country',
    'admin0Name', 'ADM0_NAME', 'ADMIN0', 'name_0'
  ];
  const regionFields = [
    'NAME_1', 'ADM1_EN', 'REGION', 'Region', 'region',
    'admin1Name', 'ADM1_NAME', 'ADMIN1', 'name_1'
  ];

  let country = district?.country || null;
  let region = district?.region || null;

  if (!country) {
    for (const field of countryFields) {
      if (props[field]) {
        country = props[field];
        break;
      }
    }
  }

  if (!region) {
    for (const field of regionFields) {
      if (props[field]) {
        region = props[field];
        break;
      }
    }
  }

  if (!country && props.name) {
    const parts = props.name.split(',');
    if (parts.length > 1) {
      country = parts[parts.length - 1].trim();
    }
  }

  return { country, region };
}

const STATUS_PILL_STYLES = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 600,
  fontFamily: "'Inter', sans-serif",
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(27, 58, 92, 0.12)',
  color: '#1f2937',
  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
  backdropFilter: 'blur(8px)'
};

const formatDateFilterLabel = (dateFilter) => {
  switch (dateFilter) {
    case '24h': return 'Last 24h';
    case '48h': return 'Last 48h';
    case '72h': return 'Last 72h';
    case '7d': return 'Last 7d';
    case '30d': return 'Last 30d';
    case 'all': return 'All time';
    default: return dateFilter || 'Unknown';
  }
};

const ContextStatusBar = ({
  operationType,
  dateFilter,
  filteredDisasters,
  alertLevelCounts,
  districts,
  acledEnabled,
  acledCount,
  osmData,
  worldPopData
}) => {
  const hasOperationType = Boolean(operationType);
  const opConfig = hasOperationType ? getOperationType(operationType) : null;
  const requestedLayers = osmData?.metadata?.requestedLayers || [];
  const loadedLayerCount = requestedLayers.length > 0
    ? requestedLayers.length
    : Object.keys(osmData?.metadata?.byLayer || {}).filter(layer => (osmData.metadata.byLayer[layer] || 0) > 0).length;
  const worldPopDistricts = worldPopData ? Object.keys(worldPopData).length : 0;

  const pills = [
    {
      key: 'operation',
      label: hasOperationType ? `${opConfig.icon} ${opConfig.name}` : 'Select operation type',
      tone: hasOperationType ? '#1B3A5C' : '#92400e',
      background: hasOperationType ? 'rgba(27, 58, 92, 0.10)' : 'rgba(245, 158, 11, 0.12)'
    },
    {
      key: 'window',
      label: `Window: ${formatDateFilterLabel(dateFilter)}`,
      tone: '#0f766e',
      background: 'rgba(20, 184, 166, 0.12)'
    },
    {
      key: 'disasters',
      label: `Disasters: ${filteredDisasters.length} (${alertLevelCounts.red || 0}R/${alertLevelCounts.orange || 0}O/${alertLevelCounts.green || 0}G)`,
      tone: '#9a3412',
      background: 'rgba(249, 115, 22, 0.12)'
    },
    {
      key: 'districts',
      label: `Admin Areas: ${districts?.length || 0}`,
      tone: '#1d4ed8',
      background: 'rgba(59, 130, 246, 0.12)'
    },
    {
      key: 'acled',
      label: acledEnabled ? `Security: ${acledCount || 0} ACLED events` : 'Security: off',
      tone: acledEnabled ? '#7c2d12' : '#6b7280',
      background: acledEnabled ? 'rgba(194, 65, 12, 0.12)' : 'rgba(107, 114, 128, 0.10)'
    },
    {
      key: 'osm',
      label: osmData ? `OSM: ${loadedLayerCount} layer${loadedLayerCount === 1 ? '' : 's'} loaded` : 'OSM: not loaded',
      tone: osmData ? '#166534' : '#6b7280',
      background: osmData ? 'rgba(34, 197, 94, 0.12)' : 'rgba(107, 114, 128, 0.10)'
    },
    {
      key: 'population',
      label: worldPopDistricts > 0 ? `Population: ${worldPopDistricts} admin area${worldPopDistricts === 1 ? '' : 's'}` : 'Population: not loaded',
      tone: worldPopDistricts > 0 ? '#4338ca' : '#6b7280',
      background: worldPopDistricts > 0 ? 'rgba(99, 102, 241, 0.12)' : 'rgba(107, 114, 128, 0.10)'
    }
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '88px',
        zIndex: 1500,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        pointerEvents: 'none'
      }}
    >
      {pills.map(pill => (
        <div
          key={pill.key}
          style={{
            ...STATUS_PILL_STYLES,
            color: pill.tone,
            backgroundColor: pill.background
          }}
        >
          {pill.label}
        </div>
      ))}
    </div>
  );
};

const MapComponent = ({
  disasters,
  gdacsDiagnostics = null,
  facilities,
  impactedFacilities,
  impactStatistics,
  onFacilitySelect,
  loading,
  dateFilter,
  handleDateFilterChange,
  onDrawerState,
  onGenerateSitrep,
  sitrepLoading,
  sitrep,
  sitrepTimestamp,
  showHelp,
  setShowHelp,
  showChatDrawer,
  setShowChatDrawer,
  aiAnalysisFields = [],
  onClearCache,
  acledData = [],
  acledEnabled = true,
  acledConfig = {},
  onAcledUpload,
  onClearAcledCache,
  onToggleAcled,
  onAcledConfigChange,
  operationType = '',
  onOperationTypeChange,
  districts = [],
  onDistrictsLoaded,
  districtAvailableFields = [],
  districtLabelField = null,
  onDistrictLabelFieldChange,
  onDistrictClick,
  onDistrictOutlookClick,
  onWorldPopDataChange,
  onOSMDataChange,
  onAnalysisDistrictsChange,
  onMapLayerChange,
  selectedAnalysisDistricts = [],
  prioritizationBoard = null
}) => {
  // Map refs - keep these in main component
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const { addToast } = useToast();

  // Use custom hooks
  const {
    visibleDisasterTypes,
    severityFilters,
    certaintyFilters,
    urgencyFilters,
    timelineFilteredDisasters,
    filteredDisasters,
    alertLevelCounts,
    toggleDisasterType,
    toggleSeverityFilter,
    toggleCertaintyFilter,
    toggleUrgencyFilter,
    handleTimelineChange,
    setTimelineFilteredDisasters
  } = useMapFilters(disasters);

  const {
    drawingEnabled,
    drawingColor,
    drawings,
    annotationMode,
    drawControlRef,
    drawnItemsRef,
    toggleDrawing,
    toggleAnnotationMode,
    setColor: setDrawingColor,
    clearAllDrawings,
    undoLastDrawing,
    setDrawings
  } = useDrawing();

  const {
    showColumnModal,
    fileData,
    fileColumns,
    selectedColumns,
    handleFileUpload,
    processExcelData,
    resetFileUpload,
    setShowColumnModal,
    setSelectedColumns
  } = useFileUpload(addToast);

  const {
    showHeatmap,
    showImpactZones,
    showZoomIndicator,
    showTimeline,
    showStatistics,
    showLegend,
    showContextStatusBar,
    showClusterCounts,
    showClustering,
    showFacilitiesLayer,
    showAcledLayer,
    showDistrictRiskFill,
    showLabels,
    showDistrictLabels,
    isFullscreen,
    filterDrawerOpen,
    unifiedDrawerOpen,
    mapLayersDrawerOpen,
    activeDrawerTab,
    currentMapLayer,
    showRoads,
    setShowHeatmap,
    setShowImpactZones,
    setShowZoomIndicator,
    setShowTimeline,
    setShowStatistics,
    setShowLegend,
    setShowContextStatusBar,
    setShowClusterCounts,
    setShowClustering,
    setShowFacilitiesLayer,
    setShowAcledLayer,
    setShowDistrictRiskFill,
    setShowLabels,
    setShowDistrictLabels,
    setIsFullscreen,
    setCurrentMapLayer,
    setShowRoads,
    toggleFilterDrawer,
    openUnifiedDrawer,
    toggleUnifiedDrawer,
    setActiveDrawerTab,
    toggleFacilityDrawer,
    toggleSitrepDrawer,
    toggleMapLayersDrawer,
    toggleAnalysisDrawer,
    closeAllOverlays
  } = useMapControls();

  const {
    selectedFacility,
    analysisData,
    analysisLoading,
    isAIGenerated,
    analysisTimestamp,
    handleAnalyzeFacility,
    setSelectedFacility,
    setAnalysisData
  } = useAIAnalysis();

  // Playback hook - must come after filteredDisasters is defined
  const {
    playbackEnabled,
    isPlaying,
    currentDate,
    playbackSpeed,
    dateRange,
    togglePlayback,
    togglePlayPause,
    changeSpeed,
    jumpToDate,
    filterByPlaybackDate
  } = usePlayback(filteredDisasters, acledData);

  // WorldPop hook
  const {
    worldPopData,
    isLoading: worldPopLoading,
    error: worldPopError,
    lastFetchParams: worldPopLastFetch,
    showWorldPopLayer,
    activeLayerType: worldPopLayerType,
    setActiveLayerType: setWorldPopLayerType,
    toggleWorldPopLayer,
    fetchWorldPopData,
    clearWorldPopData,
    geeTileUrl, // GEE tile URL for raster visualization
    scopeToShapefile,
    toggleScopeToShapefile,
  } = useWorldPop();
  const [showWorldPopDrawer, setShowWorldPopDrawer] = useState(false);

  // Lift worldPopData to parent when it changes
  useEffect(() => {
    if (onWorldPopDataChange) {
      onWorldPopDataChange(worldPopData, worldPopLastFetch);
    }
  }, [worldPopData, worldPopLastFetch]);

  // OSM Infrastructure hook
  const {
    osmData,
    osmLoading,
    osmError,
    osmStats,
    osmTimestamp,
    osmBoundary,
    osmWarning,
    osmLayers,
    osmLayerVisibility,
    showOSMLayer,
    fetchOSMInfrastructure,
    refreshOSM,
    clearOSM,
    clearOSMCategory,
    toggleLayer,
    toggleLayerVisibility,
    toggleAllOSM,
  } = useOSMInfrastructure();
  const [showOSMDrawer, setShowOSMDrawer] = useState(false);

  // Lift osmData to parent when it changes
  useEffect(() => {
    if (onOSMDataChange) {
      onOSMDataChange(osmData);
    }
  }, [osmData, onOSMDataChange]);

  // Logistics Assessment hook
  const {
    logisticsData,
    logisticsLoading,
    logisticsError,
    showLogisticsLayer,
    logisticsLayerVisibility,
    assessLogistics,
    clearLogistics,
    toggleLogisticsLayerVisibility,
    toggleAllLogistics,
    retryAssessment
  } = useLogisticsAssessment();

  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsAIGenerated, setRecommendationsAIGenerated] = useState(false);
  const [recommendationsTimestamp, setRecommendationsTimestamp] = useState(null);
  const [recommendationsCache, setRecommendationsCache] = useState({}); // Cache by facility name
  const [recommendationsFacilityKey, setRecommendationsFacilityKey] = useState(null);

  // Campaign Dashboard state
  const [showCampaignDashboard, setShowCampaignDashboard] = useState(false);

  // District boundaries state (districts is now passed as prop)
  const [showDistricts, setShowDistricts] = useState(true);
  const [highlightedDistricts, setHighlightedDistricts] = useState([]);

  // Weather context state for chatbot
  const [weatherContext, setWeatherContext] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Auto-zoom to fit districts when loaded (only once when first loaded)
  const hasZoomedToDistricts = useRef(false);
  useEffect(() => {
    if (districts && districts.length > 0 && mapRef.current && !hasZoomedToDistricts.current) {
      console.log('Auto-zooming to fit', districts.length, 'districts');

      // Calculate bounds from all districts
      const bounds = L.latLngBounds();
      let hasValidBounds = false;

      districts.forEach(district => {
        if (district.bounds) {
          bounds.extend([
            [district.bounds.minLat, district.bounds.minLng],
            [district.bounds.maxLat, district.bounds.maxLng]
          ]);
          hasValidBounds = true;
        }
      });

      if (hasValidBounds && bounds.isValid()) {
        console.log('Fitting map to district bounds:', bounds);
        // Use animate: false to make it instant and less jarring
        // Don't set maxZoom so it can zoom appropriately based on bounds
        mapRef.current.fitBounds(bounds, {
          padding: [50, 50],
          animate: false
        });
        hasZoomedToDistricts.current = true;
      }
    }
  }, [districts]);

  // Fetch weather context when chat drawer opens or data changes
  useEffect(() => {
    // Only fetch if chat drawer is open and we have facilities
    if (!showChatDrawer || !facilities || facilities.length === 0) {
      return;
    }

    // Avoid refetching if we already have weather data
    if (weatherContext) {
      return;
    }

    const fetchWeather = async () => {
      setWeatherLoading(true);
      console.log('Fetching weather context for chatbot...');

      try {
        // Extract GeoJSON features from districts for weather context
        const districtFeatures = districts && districts.length > 0
          ? districts.map(d => ({
              geometry: d.geometry,
              properties: {
                name: d.name,
                NAME: d.name,
                DISTRICT: d.name
              }
            }))
          : null;

        const weather = await buildWeatherContext(facilities, districtFeatures);

        if (weather) {
          console.log('Weather context loaded:', weather);
          setWeatherContext(weather);
        } else {
          console.log('No weather data available');
        }
      } catch (error) {
        console.error('Failed to fetch weather context:', error);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [showChatDrawer, facilities, districts, weatherContext]);

  // Function to highlight districts based on criteria from AI chat
  const handleHighlightDistricts = (criteria) => {
    console.log('Highlighting districts with criteria:', criteria);

    if (!districts || districts.length === 0) {
      console.warn('No districts available to highlight');
      return;
    }

    // Calculate risk levels first
    const districtRisks = calculateDistrictRisks(districts, filteredDisasters, filteredAcledData);

    let matchingDistricts = [];

    // Filter based on risk level
    if (criteria.riskLevels && criteria.riskLevels.length > 0) {
      matchingDistricts = districts.filter(district => {
        const risk = districtRisks[district.id];
        return risk && criteria.riskLevels.includes(risk.level);
      });
    }

    // Filter based on district names
    if (criteria.names && criteria.names.length > 0) {
      const nameMatches = districts.filter(district => {
        const districtName = (district.name || '').toLowerCase();
        return criteria.names.some(name => districtName.includes(name.toLowerCase()));
      });
      matchingDistricts = [...matchingDistricts, ...nameMatches];
    }

    // Filter based on event count threshold
    if (criteria.minEventCount !== undefined) {
      const eventCountMatches = districts.filter(district => {
        const risk = districtRisks[district.id];
        return risk && risk.eventCount >= criteria.minEventCount;
      });
      matchingDistricts = [...matchingDistricts, ...eventCountMatches];
    }

    // Remove duplicates
    matchingDistricts = [...new Set(matchingDistricts)];

    console.log(`Found ${matchingDistricts.length} districts matching criteria:`, matchingDistricts.map(d => d.name));
    setHighlightedDistricts(matchingDistricts.map(d => d.id));

    // Zoom to highlighted districts if any found
    if (matchingDistricts.length > 0 && mapInstance) {
      const bounds = L.latLngBounds();
      matchingDistricts.forEach(district => {
        if (district.bounds) {
          bounds.extend([
            [district.bounds.minLat, district.bounds.minLng],
            [district.bounds.maxLat, district.bounds.maxLng]
          ]);
        }
      });
      if (bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  };

  // Calculate district risk levels based on disasters and ACLED events
  const calculateDistrictRisks = (districts, disasters, acledData) => {
    if (!districts || districts.length === 0) return {};
    return buildDistrictRiskIndex(districts, { disasters, acledData });
  };

  const getRecommendationsCacheKey = (facility) => {
    const facilityImpacts = impactedFacilities.find(
      f => f.facility.name === facility?.name
    )?.impacts || [];

    return `${facility?.name || 'unknown'}_${facilityImpacts.length}`;
  };

  // Generate recommendations for a facility
  const handleGenerateRecommendations = async (facility, forceRefresh = false) => {
    const facilityImpacts = impactedFacilities.find(
      f => f.facility.name === facility.name
    )?.impacts || [];

    // Check if we have cached recommendations for this facility
    const cacheKey = getRecommendationsCacheKey(facility);
    if (!forceRefresh && recommendationsCache[cacheKey]) {
      console.log('Using cached recommendations for:', facility.name);
      setRecommendations(recommendationsCache[cacheKey].recommendations);
      setRecommendationsAIGenerated(recommendationsCache[cacheKey].isAIGenerated);
      setRecommendationsTimestamp(recommendationsCache[cacheKey].timestamp);
      setRecommendationsFacilityKey(cacheKey);
      return;
    }

    setRecommendationsLoading(true);
    setRecommendationsFacilityKey(cacheKey);

    try {
      console.log('Generating recommendations for:', facility.name, 'with', facilityImpacts.length, 'impacts');
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facility,
          impacts: facilityImpacts,
          useAI: true,
          osmData: osmData
        })
      });

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Recommendations received:', data);

      const timestamp = Date.now();

      // Cache the recommendations
      setRecommendationsCache(prev => ({
        ...prev,
        [cacheKey]: {
          recommendations: data.recommendations,
          isAIGenerated: data.isAIGenerated || false,
          timestamp
        }
      }));

      setRecommendations(data.recommendations || null);
      setRecommendationsAIGenerated(data.isAIGenerated || false);
      setRecommendationsTimestamp(timestamp);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setRecommendations({ error: 'Failed to generate recommendations. Please try again.' });
      setRecommendationsAIGenerated(false);
      setRecommendationsTimestamp(Date.now());
    } finally {
      setRecommendationsLoading(false);
    }
  };

  // Filter ACLED data based on config (same logic as AcledMarkers.js)
  const filteredAcledData = useMemo(() => {
    if (!acledData || acledData.length === 0 || !acledEnabled) {
      return [];
    }

    // Find the most recent date in the dataset
    const allDates = acledData
      .map(e => new Date(e.event_date))
      .filter(d => !isNaN(d.getTime()));

    const mostRecentDate = allDates.length > 0
      ? new Date(Math.max(...allDates))
      : new Date();

    // Calculate cutoff date from the most recent event
    const dateRange = acledConfig.dateRange || 60;
    const cutoffDate = new Date(mostRecentDate);
    cutoffDate.setDate(cutoffDate.getDate() - dateRange);

    // Get filters from config
    const eventTypeFilter = acledConfig.eventTypes || [];
    const selectedCountries = acledConfig.selectedCountries || [];
    const selectedRegions = acledConfig.selectedRegions || [];

    // Filter ACLED data
    return acledData.filter(event => {
      // Date filter
      const eventDate = new Date(event.event_date);
      if (eventDate < cutoffDate) return false;

      // Event type filter (if specified)
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(event.event_type)) {
        return false;
      }

      // Country filter (if countries are selected)
      if (selectedCountries.length > 0 && !selectedCountries.includes(event.country)) {
        return false;
      }

      // Region filter (if regions are selected)
      if (selectedRegions.length > 0 && !selectedRegions.includes(event.admin1)) {
        return false;
      }

      // Ensure valid coordinates
      if (!event.latitude || !event.longitude) return false;

      return true;
    }).sort((a, b) => {
      const aTime = new Date(a.event_date).getTime() || 0;
      const bTime = new Date(b.event_date).getTime() || 0;
      return bTime - aTime;
    });
  }, [acledData, acledEnabled, acledConfig]);

  // Removed: Auto-showing zoom indicator when date filter changes
  // useEffect(() => {
  //   if (dateFilter) {
  //     setShowZoomIndicator(true);
  //   }
  // }, [dateFilter, setShowZoomIndicator]);

  // Initialize timeline with all disasters
  useEffect(() => {
    setTimelineFilteredDisasters(disasters || []);
  }, [disasters, setTimelineFilteredDisasters]);

  // Handle fullscreen change events from the browser
  useEffect(() => {
    const fullscreenChangeHandler = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);

    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('mozfullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('webkitfullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('MSFullscreenChange', fullscreenChangeHandler);
    };
  }, [setIsFullscreen]);

  // Effect to clean up map resources when component unmounts
  useEffect(() => {
    return () => {
      if (mapInstance) {
        mapInstance.off('click', handleMapClick);
      }
    };
  }, [mapInstance]);

  // Handle map click to close overlays
  const handleMapClick = () => {
    closeAllOverlays();
  };

  // Invalidate map size when drawer opens/closes
  useEffect(() => {
    if (mapInstance) {
      // Add a small delay to allow CSS transition to complete
      const timer = setTimeout(() => {
        mapInstance.invalidateSize();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [filterDrawerOpen, unifiedDrawerOpen, showChatDrawer, mapInstance]);

  // Zoom to fit all filtered events
  const handleZoomToFit = () => {
    if (mapInstance && filteredDisasters.length > 0) {
      zoomToFilteredEvents(mapInstance, filteredDisasters, facilities);
    }
  };

  // Handle logistics assessment
  const handleLogisticsAssessment = async () => {
    // Only require OSM data - disasters are optional (baseline assessment)
    if (!osmData) {
      addToast('Please upload an admin boundary shapefile to enable logistics assessment', 'warning');
      return;
    }

    const hasDisasters = filteredDisasters && filteredDisasters.length > 0;
    console.log('🚚 Starting logistics assessment...', hasDisasters ? 'with disasters' : 'baseline mode');

    let logisticsWeatherData = weatherContext?.regional?.rawData || null;

    if (!logisticsWeatherData && facilities && facilities.length > 0) {
      try {
        const weather = await buildWeatherContext(facilities, null);
        if (weather?.regional?.rawData) {
          logisticsWeatherData = weather.regional.rawData;
          setWeatherContext(prev => prev || weather);
        }
      } catch (error) {
        console.warn('Could not fetch weather context for logistics assessment:', error);
      }
    }

    // Calculate bounding box from districts or OSM metadata
    let bounds = osmData.metadata?.boundingBox;

    // OSM metadata boundingBox is [minLon, minLat, maxLon, maxLat].
    if (Array.isArray(bounds) && bounds.length === 4) {
      bounds = {
        west: bounds[0],
        south: bounds[1],
        east: bounds[2],
        north: bounds[3]
      };
    }

    // If no metadata bounds, calculate from districts
    if (!bounds && districts && districts.length > 0) {
      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;

      districts.forEach(district => {
        if (district.geometry && district.geometry.coordinates) {
          const coords = district.geometry.type === 'Polygon'
            ? district.geometry.coordinates[0]
            : district.geometry.coordinates.flat(2);

          coords.forEach(coord => {
            const [lon, lat] = coord;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
          });
        }
      });

      if (minLat !== Infinity) {
        bounds = { north: maxLat, south: minLat, east: maxLon, west: minLon };
        console.log('📦 Calculated bounds from districts:', bounds);
      }
    }

    const nearbyAcledEvents = filteredAcledData.filter(event => {
      const eventLat = parseFloat(event.latitude);
      const eventLon = parseFloat(event.longitude);

      if (isNaN(eventLat) || isNaN(eventLon)) return false;
      if (!bounds) return true;

      const buffer = 2;
      return (
        eventLat >= bounds.south - buffer &&
        eventLat <= bounds.north + buffer &&
        eventLon >= bounds.west - buffer &&
        eventLon <= bounds.east + buffer
      );
    });

    // Filter disasters to only those near the region (within 200km)
    // This prevents AI from analyzing irrelevant disasters from other regions
    const nearbyDisasters = !hasDisasters ? [] : filteredDisasters.filter(disaster => {
      const disasterLat = parseFloat(disaster.latitude ?? disaster.lat);
      const disasterLon = parseFloat(disaster.longitude ?? disaster.lon);

      if (isNaN(disasterLat) || isNaN(disasterLon)) return false; // Skip disasters without coordinates
      if (!bounds) return true; // If we still can't determine bounds, include all

      // Simple bounding box check with 200km buffer (~2 degrees)
      const buffer = 2;
      const isNearby = (
        disasterLat >= bounds.south - buffer &&
        disasterLat <= bounds.north + buffer &&
        disasterLon >= bounds.west - buffer &&
        disasterLon <= bounds.east + buffer
      );

      if (!isNearby) {
        console.log(`🚫 Filtered out disaster: ${disaster.title || disaster.eventName} at [${disasterLat}, ${disasterLon}]`);
      }

      return isNearby;
    });

    console.log(`📍 Filtered disasters from ${hasDisasters ? filteredDisasters.length : 0} to ${nearbyDisasters.length} within region`);

    // Allow assessment even without disasters - shows baseline logistics status
    if (nearbyDisasters.length === 0) {
      console.log('⚠️ No disasters found near region - will show baseline logistics assessment');
      addToast('No active disasters near this region. Showing baseline logistics status.', 'info');
      // Continue with empty disasters array to show baseline assessment
    }

    // Open the workspace logistics tab immediately to show loading state
    openUnifiedDrawer('logistics');

    const locationContext = districts && districts.length > 0
      ? extractLocationFromDistrict(districts[0])
      : null;

    // Perform assessment with nearby disasters only
    const result = await assessLogistics(
      osmData,
      nearbyDisasters,
      facilities,
      nearbyAcledEvents,
      {
        weatherData: logisticsWeatherData,
        locationContext
      }
    );

    if (result) {
      addToast('Logistics assessment completed successfully', 'success');
    } else if (logisticsError) {
      addToast(`Logistics assessment failed: ${logisticsError}`, 'error');
    }
  };

  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    if (mapContainerRef.current) {
      toggleFullscreen(mapContainerRef.current, isFullscreen);
    }
  };

  // Get current map layer configuration
  const currentLayer = MAP_LAYERS[currentMapLayer.toUpperCase()] || MAP_LAYERS.STREET;
  const [geeBaseLayerUrl, setGeeBaseLayerUrl] = useState(null);
  const [geeBaseLayerError, setGeeBaseLayerError] = useState(null);
  const geeBounds = useMemo(
    () => calculateBounds(selectedAnalysisDistricts?.length ? selectedAnalysisDistricts : districts),
    [selectedAnalysisDistricts, districts]
  );
  const filteredAcledCount = filteredAcledData.length;
  const selectedDistrictAcledSummary = useMemo(
    () => buildAcledAggregateSummary(filteredAcledData, selectedAnalysisDistricts),
    [filteredAcledData, selectedAnalysisDistricts]
  );
  const visibleDisasters = useMemo(
    () => (playbackEnabled ? filterByPlaybackDate(filteredDisasters, 'pubDate') : filteredDisasters),
    [playbackEnabled, filterByPlaybackDate, filteredDisasters]
  );
  const visibleAcledEvents = useMemo(
    () => (playbackEnabled ? filterByPlaybackDate(filteredAcledData, 'event_date') : filteredAcledData),
    [playbackEnabled, filterByPlaybackDate, filteredAcledData]
  );

  useEffect(() => {
    if (onMapLayerChange) {
      onMapLayerChange(currentMapLayer);
    }
  }, [currentMapLayer, onMapLayerChange]);

  useEffect(() => {
    let cancelled = false;

    if (currentLayer.type !== 'gee') {
      setGeeBaseLayerUrl(null);
      setGeeBaseLayerError(null);
      return undefined;
    }

    const loadGeeBaseLayer = async () => {
      try {
        setGeeBaseLayerError(null);
        const response = await fetch('/api/gee-tiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataset: currentLayer.dataset,
            bounds: geeBounds || null
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load Earth Engine imagery');
        }

        if (!cancelled) {
          setGeeBaseLayerUrl(data.tileUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setGeeBaseLayerUrl(null);
          setGeeBaseLayerError(error.message || 'Failed to load Earth Engine imagery');
          console.error('[MapComponent] GEE baselayer error:', error);
        }
      }
    };

    loadGeeBaseLayer();
    return () => {
      cancelled = true;
    };
  }, [currentLayer, geeBounds]);

  useEffect(() => {
    if (geeBaseLayerError && currentLayer.type === 'gee') {
      addToast(`Earth Engine layer unavailable: ${geeBaseLayerError}`, 'warning');
    }
  }, [geeBaseLayerError, currentLayer.type, addToast]);
  const districtRisks = useMemo(
    () => calculateDistrictRisks(districts, visibleDisasters, visibleAcledEvents),
    [districts, visibleDisasters, visibleAcledEvents]
  );
  const selectedAnalysisDistrictIds = useMemo(
    () => new Set((selectedAnalysisDistricts || []).map(district => district.id)),
    [selectedAnalysisDistricts]
  );
  const allowDistrictLabels = showDistrictLabels && districts.length <= MAX_DISTRICT_LABELS;
  const displayDistricts = useMemo(() => {
    const shouldSimplifyForDisplay = districts.length >= LARGE_DISTRICT_COUNT;

    return districts.map(district => ({
      ...district,
      displayGeometry: shouldSimplifyForDisplay
        ? simplifyGeometry(district.geometry || null)
        : district.geometry
    }));
  }, [districts]);
  const districtSummary = useMemo(() => {
    if (!districts || districts.length === 0) return null;

    const riskCounts = {
      'very-high': 0,
      'high': 0,
      'medium': 0,
      'low': 0,
      'none': 0
    };
    const samplesByRisk = {
      'very-high': [],
      'high': [],
      'medium': [],
      'low': [],
      'none': []
    };
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    districts.forEach(district => {
      const risk = districtRisks[district.id];
      if (risk) {
        riskCounts[risk.level]++;
        if (samplesByRisk[risk.level].length < 3) {
          samplesByRisk[risk.level].push({
            name: district.name,
            eventCount: risk.eventCount,
            score: risk.score
          });
        }
      }

      if (district.bounds) {
        minLat = Math.min(minLat, district.bounds.minLat);
        maxLat = Math.max(maxLat, district.bounds.maxLat);
        minLng = Math.min(minLng, district.bounds.minLng);
        maxLng = Math.max(maxLng, district.bounds.maxLng);
      }
    });

    return {
      totalCount: districts.length,
      country: districts[0]?.country || 'Unknown',
      region: districts[0]?.region || 'Unknown',
      geographicBounds: Number.isFinite(minLat) ? {
        minLat: minLat.toFixed(2),
        maxLat: maxLat.toFixed(2),
        minLng: minLng.toFixed(2),
        maxLng: maxLng.toFixed(2),
        centerLat: ((minLat + maxLat) / 2).toFixed(2),
        centerLng: ((minLng + maxLng) / 2).toFixed(2)
      } : null,
      riskBreakdown: riskCounts,
      sampleDistricts: samplesByRisk
    };
  }, [districts, districtRisks]);
  const enrichedDistricts = useMemo(
    () => districts.map(district => {
      const risk = districtRisks[district.id] || { level: 'none', score: 0, eventCount: 0 };
      return {
        ...district,
        riskLevel: risk.level,
        riskScore: risk.score,
        eventCount: risk.eventCount
      };
    }),
    [districts, districtRisks]
  );
  const hasSelectedAnalysisDistricts = selectedAnalysisDistricts.length > 0;

  const runFacilityAnalysis = (facility) => {
    if (!facility) return;

    if (!hasSelectedAnalysisDistricts) {
      addToast('Select one or more districts before running analysis.', 'warning');
      setActiveDrawerTab('layers');
      if (!unifiedDrawerOpen) {
        toggleUnifiedDrawer();
      }
      return;
    }

    setSelectedFacility(facility);
    const facilityImpacts = impactedFacilities.find(
      f => f.facility.name === facility.name
    )?.impacts || [];

    handleAnalyzeFacility(facility, facilityImpacts, {
      acledData: acledEnabled ? filteredAcledData : [],
      worldPopData,
      selectedDistricts: selectedAnalysisDistricts.map(compactDistrictForContext),
      operationType
    });

    setActiveDrawerTab('analysis');
    if (!unifiedDrawerOpen) {
      toggleUnifiedDrawer();
    }
  };

  // Check if any drawer is open
  const isAnyDrawerOpen = filterDrawerOpen || unifiedDrawerOpen || mapLayersDrawerOpen || showChatDrawer;

  // Drawer width (should match the drawer width in CSS)
  const drawerWidth = 400;

  return (
    <div
      className="map-container"
      ref={mapContainerRef}
      style={{
        position: 'relative',
        transition: 'margin-right 0.3s ease, width 0.3s ease',
        marginRight: isAnyDrawerOpen ? `${drawerWidth}px` : '0',
        width: isAnyDrawerOpen ? `calc(100% - ${drawerWidth}px)` : '100%',
        ...(isFullscreen && {
          height: '100vh',
          width: '100vw',
          margin: 0,
          padding: 0,
          borderRadius: 0,
          overflow: 'hidden'
        })
      }}
    >
      <style>{customStyles}</style>

      {showContextStatusBar && (
        <ContextStatusBar
          operationType={operationType}
          dateFilter={dateFilter}
          filteredDisasters={filteredDisasters}
          alertLevelCounts={alertLevelCounts}
          districts={districts}
          acledEnabled={acledEnabled}
          acledCount={filteredAcledCount}
          osmData={osmData}
          worldPopData={worldPopData}
        />
      )}

      {/* Hamburger Menu - high-level workspace and analysis actions */}
      <HamburgerMenu
        onControlPanelClick={toggleUnifiedDrawer}
        onFilterClick={toggleFilterDrawer}
        onCampaignDashboardClick={() => setShowCampaignDashboard(true)}
        onLogisticsClick={handleLogisticsAssessment}
        onHelpClick={() => setShowHelp(!showHelp)}
        drawingEnabled={drawingEnabled}
        onDrawClick={toggleDrawing}
        annotationMode={annotationMode}
        onAddAnnotation={toggleAnnotationMode}
        drawingColor={drawingColor}
        setDrawingColor={setDrawingColor}
        onUndoDrawing={undoLastDrawing}
        onClearDrawings={clearAllDrawings}
        drawingsCount={drawings.length}
        operationType={operationType}
        onOperationTypeChange={onOperationTypeChange}
        playbackEnabled={playbackEnabled}
        onPlaybackClick={togglePlayback}
        logisticsEnabled={activeDrawerTab === 'logistics' && unifiedDrawerOpen}
        hasDistricts={districts && districts.length > 0}
      />

      <FloatingActionButtons
        onLayersClick={toggleMapLayersDrawer}
        onFilterClick={toggleFilterDrawer}
        drawingEnabled={drawingEnabled}
        onDrawClick={toggleDrawing}
        annotationMode={annotationMode}
        onAddAnnotation={toggleAnnotationMode}
        drawingColor={drawingColor}
        setDrawingColor={setDrawingColor}
        onUndoDrawing={undoLastDrawing}
        onClearDrawings={clearAllDrawings}
        drawingsCount={drawings.length}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={toggleFilterDrawer}
        visibleDisasterTypes={visibleDisasterTypes}
        toggleDisasterType={toggleDisasterType}
        severityFilters={severityFilters}
        toggleSeverityFilter={toggleSeverityFilter}
        certaintyFilters={certaintyFilters}
        toggleCertaintyFilter={toggleCertaintyFilter}
        urgencyFilters={urgencyFilters}
        toggleUrgencyFilter={toggleUrgencyFilter}
        showHeatmap={showHeatmap}
        setShowHeatmap={setShowHeatmap}
        showImpactZones={showImpactZones}
        setShowImpactZones={setShowImpactZones}
        showLegend={showLegend}
        setShowLegend={setShowLegend}
        showContextStatusBar={showContextStatusBar}
        setShowContextStatusBar={setShowContextStatusBar}
        showClusterCounts={showClusterCounts}
        setShowClusterCounts={setShowClusterCounts}
        showClustering={showClustering}
        setShowClustering={setShowClustering}
        showFacilitiesLayer={showFacilitiesLayer}
        setShowFacilitiesLayer={setShowFacilitiesLayer}
        showAcledLayer={showAcledLayer}
        setShowAcledLayer={setShowAcledLayer}
        showDistrictRiskFill={showDistrictRiskFill}
        setShowDistrictRiskFill={setShowDistrictRiskFill}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        showDistrictLabels={showDistrictLabels}
        setShowDistrictLabels={setShowDistrictLabels}
        onZoomToFit={handleZoomToFit}
        showZoomIndicator={showZoomIndicator}
        disasters={disasters}
        dateFilter={dateFilter}
        handleDateFilterChange={handleDateFilterChange}
      />

      {/* Unified Drawer - Consolidates Facilities, Analysis, Chat, Reports, and Layers */}
      <UnifiedDrawer
        isOpen={unifiedDrawerOpen}
        onClose={toggleUnifiedDrawer}
        initialTab={activeDrawerTab}
        onTabChange={setActiveDrawerTab}

        // Facility tab props
        facilities={facilities}
        impactedFacilities={impactedFacilities}
        impactStatistics={impactStatistics}
        districts={districts}
        onDistrictsLoaded={onDistrictsLoaded}
        districtAvailableFields={districtAvailableFields}
        districtLabelField={districtLabelField}
        onDistrictLabelFieldChange={onDistrictLabelFieldChange}
        selectedAnalysisDistricts={selectedAnalysisDistricts}
        onFileUpload={(file) => {
          console.log('File selected:', file);
          const syntheticEvent = { target: { files: [file] } };
          handleFileUpload(syntheticEvent);
        }}
        onFacilitySelect={(facility) => {
          runFacilityAnalysis(facility);
        }}
        onFacilityViewOnMap={(facility) => {
          if (mapRef.current && facility.latitude && facility.longitude) {
            mapRef.current.setView([facility.latitude, facility.longitude], 12, {
              animate: true,
              duration: 1
            });
          }
        }}
        onGenerateSitrep={onGenerateSitrep}
        sitrepLoading={sitrepLoading}
        onClearCache={onClearCache}
        acledData={acledData}
        acledEnabled={acledEnabled}
        acledConfig={acledConfig}
        onAcledUpload={onAcledUpload}
        onClearAcledCache={onClearAcledCache}
        onToggleAcled={onToggleAcled}
        onAcledConfigChange={onAcledConfigChange}

        // Analysis tab props
        selectedFacility={selectedFacility}
        analysis={analysisData}
        analysisLoading={analysisLoading}
        operationType={operationType}
        onViewRecommendations={handleGenerateRecommendations}
        recommendations={recommendations}
        recommendationsLoading={recommendationsLoading}
        recommendationsAIGenerated={recommendationsAIGenerated}
        recommendationsTimestamp={recommendationsTimestamp}
        recommendationsFacilityKey={recommendationsFacilityKey}
        osmData={osmData}
        worldPopData={worldPopData}
        logisticsData={logisticsData}
        logisticsLoading={logisticsLoading}
        logisticsError={logisticsError}
        onRunLogistics={handleLogisticsAssessment}

        // Label control
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        showDistrictLabels={showDistrictLabels}
        setShowDistrictLabels={setShowDistrictLabels}

        // Reports tab props
        sitrep={sitrep}
        sitrepTimestamp={sitrepTimestamp}

      />

      <MapLayersDrawer
        isOpen={mapLayersDrawerOpen}
        onClose={toggleMapLayersDrawer}
        currentMapLayer={currentMapLayer}
        setCurrentMapLayer={setCurrentMapLayer}
        showRoads={showRoads}
        setShowRoads={setShowRoads}
        districts={districts}
        selectedAnalysisDistricts={selectedAnalysisDistricts}
        osmData={osmData}
        osmStats={osmStats}
        osmWarning={osmWarning}
        osmLoading={osmLoading}
        osmLayerVisibility={osmLayerVisibility}
        onOSMSelectionChange={onAnalysisDistrictsChange}
        onLoadOSM={async (selectedDistricts, selectedCategories) => {
          console.log('🚀 onLoadOSM called!', {
            districtsCount: selectedDistricts?.length,
            categoriesCount: selectedCategories?.length,
            districts: selectedDistricts,
            categories: selectedCategories
          });

          const districtsWithGeometry = selectedDistricts.filter((district) =>
            district?.geometry?.coordinates
          );

          if (districtsWithGeometry.length === 0) {
            console.error('❌ No coordinates collected from districts!');
            return;
          }

          clearOSM();

          for (let index = 0; index < districtsWithGeometry.length; index += 1) {
            const district = districtsWithGeometry[index];
            await fetchOSMInfrastructure(district.geometry, selectedCategories, {
              mergeWithExisting: index > 0
            });
          }
        }}
        onToggleOSMLayerVisibility={toggleLayerVisibility}
        onClearOSMCategory={clearOSMCategory}
      />

      {/* Column Selection Modal */}
      <ColumnSelectionModal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        fileColumns={fileColumns}
        selectedColumns={selectedColumns}
        setSelectedColumns={setSelectedColumns}
        onProcessData={() => {
          processExcelData((processedFile, columnSelections) => {
            // After processing, pass the CSV data and column selections to the parent
            console.log('Processing with column selections:', columnSelections);
            const reader = new FileReader();
            reader.onload = (e) => {
              onDrawerState(e.target.result, columnSelections);
              toggleFacilityDrawer();
            };
            reader.readAsText(processedFile);
          });
        }}
      />

      {/* Map Legend */}
      {showLegend && (
        <MapLegend
          showLegend={showLegend}
          setShowLegend={setShowLegend}
          showTimeline={showTimeline}
          setShowTimeline={setShowTimeline}
          showStatistics={showStatistics}
          setShowStatistics={setShowStatistics}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          hasFacilities={facilities && facilities.length > 0}
          hasStatistics={!!impactStatistics}
          hasAcledData={acledEnabled && acledData && acledData.length > 0}
          hasDistricts={districts && districts.length > 0}
          showDistricts={showDistricts}
          setShowDistricts={setShowDistricts}
          currentMapLayer={currentMapLayer}
          gdacsDiagnostics={gdacsDiagnostics}
        />
      )}

      {/* Statistics Panel */}
      {showStatistics && impactStatistics && (
        <StatisticsPanel
          statistics={impactStatistics}
        />
      )}

      {/* Timeline Visualization */}
      {showTimeline && (
        <TimelineVisualization
          disasters={filteredDisasters}
          onTimeChange={handleTimelineChange}
        />
      )}

      {/* Zoom Indicator */}
      {showZoomIndicator && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer'
          }}
          onClick={() => {
            handleZoomToFit();
            setShowZoomIndicator(false);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          Click to zoom to filtered events
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowZoomIndicator(false);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
              marginLeft: '10px'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        ref={mapRef}
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        style={{
          height: isFullscreen ? '100vh' : '100%',
          width: '100%',
          zIndex: 1
        }}
        zoomControl={true}
      >
        {/* Base map layer */}
        {currentLayer.type === 'gee' && currentLayer.overlayOnBase ? (
          <TileLayer
            key="context-basemap"
            url={MAP_LAYERS.LIGHT_MINIMAL.url}
            attribution={MAP_LAYERS.LIGHT_MINIMAL.attribution}
          />
        ) : currentLayer.type === 'gee' ? (
          <TileLayer
            key={geeBaseLayerUrl || currentLayer.id}
            url={geeBaseLayerUrl || MAP_LAYERS.SATELLITE.url}
            attribution={geeBaseLayerUrl ? currentLayer.attribution : MAP_LAYERS.SATELLITE.attribution}
          />
        ) : currentLayer.type === 'wms' ? (
          <WMSTileLayer
            url={currentLayer.url}
            layers={currentLayer.layers}
            format={currentLayer.format || 'image/png'}
            transparent={false}
            attribution={currentLayer.attribution}
          />
        ) : (
          <TileLayer
            url={currentLayer.url}
            attribution={currentLayer.attribution}
          />
        )}

        {currentLayer.type === 'gee' && currentLayer.overlayOnBase && geeBaseLayerUrl && (
          <TileLayer
            key={geeBaseLayerUrl}
            url={geeBaseLayerUrl}
            attribution={currentLayer.attribution}
            opacity={currentLayer.overlayOpacity || 0.6}
          />
        )}

        {/* Road overlay (optional) */}
        {showRoads && currentMapLayer !== 'street' && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            opacity={0.5}
          />
        )}

        {/* WorldPop population density overlay - using GEE tiles */}
        {showWorldPopLayer && geeTileUrl && (() => {
          console.log('[WorldPop] Rendering GEE tile layer:', {
            showWorldPopLayer,
            geeTileUrl
          });
          return (
            <TileLayer
              key={geeTileUrl}
              url={geeTileUrl}
              attribution='&copy; <a href="https://www.worldpop.org">WorldPop</a> via Google Earth Engine'
              opacity={0.65}
              pane="overlayPane"
              zIndex={650}
              eventHandlers={{
                tileerror: (error) => {
                  console.error('[WorldPop] GEE tile load error:', error);
                },
                tileload: () => {
                  console.log('[WorldPop] GEE tile loaded successfully');
                },
                loading: () => {
                  console.log('[WorldPop] GEE tiles loading...');
                }
              }}
            />
          );
        })()}

        {/* Map access component for capturing map instance */}
        <MapAccess onMapReady={(map) => {
          setMapInstance(map);
          map.on('click', handleMapClick);
        }} />

        {/* District boundaries layer - use single GeoJSON for better performance */}
        {showDistricts && districts && districts.length > 0 && (() => {
          console.log(`Rendering ${districts.length} districts on map`);

          // Risk level colors (nice gradient)
          const getRiskColor = (level) => {
            switch (level) {
              case 'very-high': return '#d32f2f'; // Deep Red
              case 'high': return '#f57c00'; // Deep Orange
              case 'medium': return '#fbc02d'; // Yellow/Amber
              case 'low': return '#7cb342'; // Light Green
              case 'none':
              default: return '#89CFF0'; // Light Blue (default)
            }
          };

          const getBorderColor = (level) => {
            switch (level) {
              case 'very-high': return '#b71c1c';
              case 'high': return '#e65100';
              case 'medium': return '#f9a825';
              case 'low': return '#558b2f';
              case 'none':
              default: return '#2D5A7B';
            }
          };

          // Create a FeatureCollection from all districts
          const featureCollection = {
            type: 'FeatureCollection',
            features: displayDistricts
              .filter(d => {
                if (!d.displayGeometry) {
                  console.warn('District missing geometry:', d.name);
                  return false;
                }
                return true;
              })
              .map(district => {
                const risk = districtRisks[district.id] || { level: 'none', score: 0, eventCount: 0 };
                return {
                  type: 'Feature',
                  properties: {
                    name: district.name,
                    country: district.country,
                    region: district.region,
                    population: district.population,
                    riskLevel: risk.level,
                    riskScore: risk.score,
                    eventCount: risk.eventCount,
                    ...district.properties
                  },
                  geometry: district.displayGeometry,
                  id: district.id
                };
              })
          };

          console.log(`Created FeatureCollection with ${featureCollection.features.length} features`);
          console.log('Sample district with risk:', featureCollection.features[0]?.properties);

          // Debug: Check coordinate ranges
          if (featureCollection.features.length > 0) {
            const firstFeature = featureCollection.features[0];
            const coords = firstFeature.geometry?.coordinates;
            console.log('First feature geometry type:', firstFeature.geometry?.type);
            console.log('First few coordinates:', JSON.stringify(coords).substring(0, 200));
            console.log('District bounds:', districts[0]?.bounds);
          }

          return (
            <GeoJSON
              key={`districts-${districts.length}-${visibleDisasters.length}-${visibleAcledEvents.length}-${highlightedDistricts.length}-selected-${selectedAnalysisDistricts.map(district => district.id).join('_')}-labels-${allowDistrictLabels}-field-${districtLabelField}`}
              data={featureCollection}
              pane="overlayPane"
              interactive={true}
              style={(feature) => {
                const riskLevel = feature.properties.riskLevel || 'none';
                const isHighlighted = highlightedDistricts.includes(feature.id);
                const isSelected = selectedAnalysisDistrictIds.has(feature.id);

                return {
                  color: isHighlighted ? '#FF6B35' : (isSelected ? '#0f766e' : getBorderColor(riskLevel)),
                  weight: isHighlighted ? 4 : (isSelected ? 4 : 3),
                  opacity: isHighlighted ? 1 : 1, // Changed from 0.8 to 1 for fully visible borders
                  fillColor: getRiskColor(riskLevel),
                  fillOpacity: showDistrictRiskFill
                    ? (isHighlighted ? 0.7 : (isSelected ? 0.65 : (riskLevel === 'none' ? 0.2 : 0.5)))
                    : 0,
                  className: isHighlighted ? 'highlighted-district' : ''
                };
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties;

                // Build popup HTML with all available properties
                const displayName = props.name || props.NAME || props.DISTRICT || props.District || 'Unnamed Admin Area';

                // Risk level display
                const riskLevel = props.riskLevel || 'none';
                const riskScore = props.riskScore || 0;
                const eventCount = props.eventCount || 0;

                const getRiskLabel = (level) => {
                  switch (level) {
                    case 'very-high': return 'VERY HIGH';
                    case 'high': return 'HIGH';
                    case 'medium': return 'MEDIUM';
                    case 'low': return 'LOW';
                    case 'none':
                    default: return 'NO RISK';
                  }
                };

                const getRiskBadgeColor = (level) => {
                  switch (level) {
                    case 'very-high': return '#d32f2f';
                    case 'high': return '#f57c00';
                    case 'medium': return '#fbc02d';
                    case 'low': return '#7cb342';
                    case 'none':
                    default: return '#90a4ae';
                  }
                };

                let popupContent = `
                  <div style="font-family: 'Inter', sans-serif; max-width: 300px;">
                    <h4 style="margin: 0 0 10px 0; color: var(--aidstack-navy); font-size: 16px; border-bottom: 2px solid #2D5A7B; padding-bottom: 6px;">
                      ${displayName}
                    </h4>
                `;

                // Add risk level badge
                if (eventCount > 0) {
                  popupContent += `
                    <div style="margin: 10px 0; padding: 10px; background: ${getRiskBadgeColor(riskLevel)}; color: white; border-radius: 6px; text-align: center;">
                      <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">RISK LEVEL</div>
                      <div style="font-size: 18px; font-weight: bold;">${getRiskLabel(riskLevel)}</div>
                      <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">${eventCount} event${eventCount > 1 ? 's' : ''} detected (Score: ${riskScore})</div>
                    </div>
                  `;
                }

                const isSelectedForAnalysis = selectedAnalysisDistrictIds.has(feature.id);
                if (onAnalysisDistrictsChange) {
                  popupContent += `
                    <button
                      id="district-select-btn-${feature.id}"
                      style="
                        width: 100%;
                        margin-top: 10px;
                        padding: 10px 12px;
                        background: ${isSelectedForAnalysis ? '#0f766e' : '#ffffff'};
                        color: ${isSelectedForAnalysis ? '#ffffff' : '#0f766e'};
                        border: 1px solid #0f766e;
                        border-radius: 6px;
                        font-size: 13px;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: 'Inter', sans-serif;
                      "
                    >
                      ${isSelectedForAnalysis ? 'Remove From Analysis Scope' : 'Select For Analysis'}
                    </button>
                  `;
                }

                // Add all non-null properties (excluding geometry-related and risk-related ones)
                const excludeKeys = ['name', 'NAME', 'geometry', 'bounds', 'riskLevel', 'riskScore', 'eventCount'];
                Object.entries(props).forEach(([key, value]) => {
                  if (value && !excludeKeys.includes(key)) {
                    // Format the key to be more readable
                    const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                    const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

                    // Format the value
                    let formattedValue = value;
                    if (typeof value === 'number' && value > 1000) {
                      formattedValue = value.toLocaleString();
                    }

                    popupContent += `
                      <p style="margin: 6px 0; font-size: 13px;">
                        <strong style="color: #666;">${capitalizedKey}:</strong> ${formattedValue}
                      </p>
                    `;
                  }
                });

                // Add action buttons if handlers provided
                if (onDistrictClick || onDistrictOutlookClick) {
                  popupContent += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">`;

                  // View Forecast button
                  if (onDistrictClick) {
                    popupContent += `
                      <button
                        id="district-forecast-btn-${feature.id}"
                        style="
                          padding: 10px 12px;
                          background: var(--aidstack-navy);
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 13px;
                          font-weight: 600;
                          cursor: pointer;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          gap: 6px;
                          font-family: 'Inter', sans-serif;
                          transition: background 0.2s;
                        "
                        onmouseover="this.style.background='#2D5A7B'"
                        onmouseout="this.style.background='var(--aidstack-navy)'"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                          <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                        Forecast
                      </button>
                    `;
                  }

                  // Operational Outlook button
                  if (onDistrictOutlookClick) {
                    popupContent += `
                      <button
                        id="district-outlook-btn-${feature.id}"
                        style="
                          padding: 10px 12px;
                          background: var(--aidstack-orange);
                          color: white;
                          border: none;
                          border-radius: 6px;
                          font-size: 13px;
                          font-weight: 600;
                          cursor: pointer;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          gap: 6px;
                          font-family: 'Inter', sans-serif;
                          transition: background 0.2s;
                        "
                        onmouseover="this.style.background='#E55A2B'"
                        onmouseout="this.style.background='var(--aidstack-orange)'"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Outlook
                      </button>
                    `;
                  }

                  popupContent += `</div>`;
                }

                popupContent += '</div>';

                layer.bindPopup(popupContent);

                // Add zoom-dependent label (tooltip) if showDistrictLabels is true
                if (allowDistrictLabels && mapInstance) {
                  const minZoom = 7;

                  layer.bindTooltip(displayName, {
                    permanent: true,
                    direction: 'center',
                    className: 'district-label',
                    opacity: 0.9
                  });

                  // closeTooltip() is a no-op during onEachFeature because the tooltip
                  // DOM hasn't been created yet. Use the layer 'add' event instead, which
                  // fires after the layer is actually rendered on the map.
                  layer.on('add', () => {
                    if (mapInstance.getZoom() < minZoom) {
                      layer.closeTooltip();
                    }
                  });

                  const onZoomEnd = () => {
                    const zoom = mapInstance.getZoom();
                    if (zoom >= minZoom) {
                      layer.openTooltip();
                    } else {
                      layer.closeTooltip();
                    }
                  };

                  mapInstance.on('zoomend', onZoomEnd);
                  layer._zoomEndHandler = onZoomEnd;
                }

                // Add click event listeners for popup buttons
                if (onAnalysisDistrictsChange || onDistrictClick || onDistrictOutlookClick) {
                  layer.on('popupopen', () => {
                    if (onAnalysisDistrictsChange) {
                      const selectBtn = document.getElementById(`district-select-btn-${feature.id}`);
                      if (selectBtn) {
                        selectBtn.onclick = () => {
                          const fullDistrict = districts.find(d => d.id === feature.id);
                          if (!fullDistrict) return;

                          const nextSelectedDistricts = selectedAnalysisDistrictIds.has(feature.id)
                            ? selectedAnalysisDistricts.filter(district => district.id !== feature.id)
                            : [...selectedAnalysisDistricts, fullDistrict];

                          onAnalysisDistrictsChange(nextSelectedDistricts);
                          addToast(
                            selectedAnalysisDistrictIds.has(feature.id)
                              ? `${displayName} removed from analysis scope.`
                              : `${displayName} added to analysis scope.`,
                            'success'
                          );
                          layer.closePopup();
                        };
                      }
                    }

                    // Forecast button handler
                    if (onDistrictClick) {
                      const forecastBtn = document.getElementById(`district-forecast-btn-${feature.id}`);
                      if (forecastBtn) {
                        forecastBtn.onclick = () => {
                          const fullDistrict = districts.find(d => d.id === feature.id);
                          if (fullDistrict) {
                            onDistrictClick(fullDistrict);
                          }
                        };
                      }
                    }

                    // Outlook button handler
                    if (onDistrictOutlookClick) {
                      const outlookBtn = document.getElementById(`district-outlook-btn-${feature.id}`);
                      if (outlookBtn) {
                        outlookBtn.onclick = () => {
                          const fullDistrict = districts.find(d => d.id === feature.id);
                          if (fullDistrict) {
                            onDistrictOutlookClick(fullDistrict);
                          }
                        };
                      }
                    }
                  });
                }
              }}
            />
          );
        })()}

        {/* Heatmap layer */}
        {showHeatmap && <HeatmapLayer disasters={visibleDisasters} />}

        {/* Disaster markers */}
        <DisasterMarkers
          key={`disaster-markers-${visibleDisasters.length}-${visibleDisasters[0]?.eventId || 'none'}-${visibleDisasters[visibleDisasters.length - 1]?.eventId || 'none'}`}
          disasters={visibleDisasters}
          showImpactZones={showImpactZones}
          showClusterCounts={showClusterCounts}
        />

        {/* ACLED conflict event markers */}
        {showAcledLayer && (
          <AcledMarkers
            key={`acled-markers-${showClusterCounts ? 'counts' : 'no-counts'}-${showClustering ? 'clustered' : 'plain'}-${visibleAcledEvents.length}`}
            acledData={visibleAcledEvents}
            acledEnabled={acledEnabled}
            acledConfig={acledConfig}
            showClusterCounts={showClusterCounts}
            showClustering={showClustering}
          />
        )}

        {/* OSM Infrastructure layer */}
        <OSMInfrastructureLayer
          osmData={osmData}
          layerVisibility={osmLayerVisibility}
          showOSMLayer={showOSMLayer}
          showClusterCounts={showClusterCounts}
        />

        {/* Logistics Overlays Layer */}
        <LogisticsOverlaysLayer
          data={logisticsData}
          visible={showLogisticsLayer}
          showRoads={logisticsLayerVisibility.roads}
          showBridges={logisticsLayerVisibility.bridges}
          showFuel={logisticsLayerVisibility.fuel}
          showAirports={logisticsLayerVisibility.airports}
        />

        {/* Drawing layer */}
        <DrawingLayer
          enabled={drawingEnabled}
          color={drawingColor}
          annotationMode={annotationMode}
          drawControlRef={drawControlRef}
          drawnItemsRef={drawnItemsRef}
          drawings={drawings}
          setDrawings={setDrawings}
        />

        {/* Facility markers */}
        {showFacilitiesLayer && facilities && facilities.length > 0 && (
          <MarkerClusterGroup
            key={`facility-clusters-${showClusterCounts ? 'counts' : 'no-counts'}-${showClustering ? 'clustered' : 'plain'}-${facilities.length}`}
            showCoverageOnHover={false}
            maxClusterRadius={showClusterCounts ? 50 : 22}
            iconCreateFunction={(cluster) => {
              const count = cluster.getChildCount();
              const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';

              // Check if any facilities in the cluster are impacted
              const markers = cluster.getAllChildMarkers();
              const hasImpacted = markers.some(marker => {
                const facilityName = marker.options.title; // We'll set this in the marker
                return impactedFacilities?.some(
                  impacted => impacted.facility?.name === facilityName
                );
              });

              const bgColor = hasImpacted ? 'rgba(255, 68, 68, 0.9)' : 'rgba(76, 175, 80, 0.9)';
              const dimension = showClusterCounts
                ? (size === 'small' ? '36px' : size === 'medium' ? '46px' : '56px')
                : '16px';
              const fontSize = size === 'small' ? '13px' : size === 'medium' ? '15px' : '18px';

              return L.divIcon({
                html: `<div style="
                  background: ${bgColor};
                  color: white;
                  border-radius: ${showClusterCounts ? '4px' : '50%'};
                  width: ${dimension};
                  height: ${dimension};
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  border: ${showClusterCounts ? '3px solid white' : '2px solid white'};
                  box-shadow: ${showClusterCounts ? '0 3px 8px rgba(0,0,0,0.4)' : '0 2px 5px rgba(0,0,0,0.25)'};
                ">
                  ${showClusterCounts ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 2px;">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>` : ''}
                  <span style="font-size: ${fontSize}; line-height: 1;">${showClusterCounts ? count : ''}</span>
                </div>`,
                className: 'facility-cluster',
                iconSize: [parseInt(dimension), parseInt(dimension)]
              });
            }}
          >
            {showClustering && facilities.map((facility, idx) => {
              // Fix: impactedFacilities has structure { facility: {...}, impacts: [...] }
              const isImpacted = impactedFacilities?.some(
                impacted => impacted.facility?.name === facility.name
              );

              const markerColor = isImpacted ? '#ff4444' : '#4CAF50';

              const customIcon = L.divIcon({
                className: 'custom-facility-icon',
                html: `
                  <div style="
                    width: 12px;
                    height: 12px;
                    background-color: ${markerColor};
                    border: 2px solid white;
                    border-radius: 2px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                  "></div>
                `,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
              });

              return (
                <ReactLeafletMarker
                  key={`facility-${idx}`}
                  position={[parseFloat(facility.latitude), parseFloat(facility.longitude)]}
                  icon={customIcon}
                  title={facility.name}
                  eventHandlers={{
                    click: () => {
                      setSelectedFacility(facility);
                      // Just set the selected facility, don't open analysis drawer
                      // The popup will open automatically and user can click "Analyze Facility" button
                    }
                  }}
                >
                  {showLabels && (
                    <Tooltip
                      permanent
                      direction="top"
                      offset={[0, -10]}
                      className={`facility-label ${isImpacted ? 'impacted' : 'safe'}`}
                    >
                      {facility.name}
                    </Tooltip>
                  )}
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                        {facility.name}
                      </h4>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: markerColor, fontWeight: 'bold' }}>
                          {isImpacted ? 'IMPACTED' : 'Safe'}
                        </span>
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '13px' }}>
                        <strong>Location:</strong> {facility.latitude}, {facility.longitude}
                      </p>
                      {Object.entries(facility).map(([key, value]) => {
                        if (!['name', 'latitude', 'longitude'].includes(key) && value) {
                          return (
                            <p key={key} style={{ margin: '5px 0', fontSize: '13px' }}>
                              <strong>{key}:</strong> {value}
                            </p>
                          );
                        }
                        return null;
                      })}
                      <button
                        onClick={() => runFacilityAnalysis(facility)}
                        style={{
                          marginTop: '10px',
                          padding: '8px 16px',
                          background: hasSelectedAnalysisDistricts
                            ? 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)'
                            : 'var(--aidstack-slate-light)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: hasSelectedAnalysisDistricts ? 'pointer' : 'not-allowed',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          width: '100%'
                        }}
                      >
                        {hasSelectedAnalysisDistricts ? 'Analyze Facility' : 'Select Districts First'}
                      </button>
                    </div>
                  </Popup>
                </ReactLeafletMarker>
              );
            })}
          </MarkerClusterGroup>
        )}
        {showFacilitiesLayer && facilities && facilities.length > 0 && !showClustering && facilities.map((facility, idx) => {
          const isImpacted = impactedFacilities?.some(
            impacted => impacted.facility?.name === facility.name
          );

          const markerColor = isImpacted ? '#ff4444' : '#4CAF50';

          const customIcon = L.divIcon({
            className: 'custom-facility-icon',
            html: `
              <div style="
                width: 12px;
                height: 12px;
                background-color: ${markerColor};
                border: 2px solid white;
                border-radius: 2px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>
            `,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });

          return (
            <ReactLeafletMarker
              key={`facility-plain-${idx}`}
              position={[parseFloat(facility.latitude), parseFloat(facility.longitude)]}
              icon={customIcon}
              title={facility.name}
              eventHandlers={{
                click: () => {
                  setSelectedFacility(facility);
                }
              }}
            >
              {showLabels && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className={`facility-label ${isImpacted ? 'impacted' : 'safe'}`}
                >
                  {facility.name}
                </Tooltip>
              )}
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
                    {facility.name}
                  </h4>
                  <p style={{ margin: '5px 0', fontSize: '13px' }}>
                    <strong>Status:</strong>{' '}
                    <span style={{ color: markerColor, fontWeight: 'bold' }}>
                      {isImpacted ? 'IMPACTED' : 'Safe'}
                    </span>
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '13px' }}>
                    <strong>Location:</strong> {facility.latitude}, {facility.longitude}
                  </p>
                  {Object.entries(facility).map(([key, value]) => {
                    if (!['name', 'latitude', 'longitude'].includes(key) && value) {
                      return (
                        <p key={key} style={{ margin: '5px 0', fontSize: '13px' }}>
                          <strong>{key}:</strong> {value}
                        </p>
                      );
                    }
                    return null;
                  })}
                  <button
                    onClick={() => runFacilityAnalysis(facility)}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      background: hasSelectedAnalysisDistricts
                        ? 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)'
                        : 'var(--aidstack-slate-light)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: hasSelectedAnalysisDistricts ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      width: '100%'
                    }}
                  >
                    {hasSelectedAnalysisDistricts ? 'Analyze Facility' : 'Select Districts First'}
                  </button>
                </div>
              </Popup>
            </ReactLeafletMarker>
          );
        })}
      </MapContainer>

      {/* Chat Drawer - Kept separate due to complex context management */}
      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        onHighlightDistricts={districts && districts.length > 0 ? handleHighlightDistricts : null}
        context={{
          selectedFacility: selectedFacility,
          totalFacilities: facilities?.length || 0,
          totalImpactedFacilities: impactedFacilities?.length || 0,
          totalAcledEvents: acledData?.length || 0,
          scopedAcledEvents: prioritizationBoard?.summary?.totalAcledEvents ?? filteredAcledData.length,
          totalDistricts: districts?.length || 0,
          selectedAnalysisDistricts: selectedAnalysisDistricts?.map(compactDistrictForContext) || [],
          hasDistricts: districts && districts.length > 0,
          districts: districtSummary,
          // Send a compact facility sample to keep chat fast
          facilities: facilities?.slice(0, 75).map(f => ({
            name: f.name,
            latitude: f.latitude,
            longitude: f.longitude,
            type: f.type || f.facilityType,
            country: f.country,
            // Include AI analysis fields
            ...(aiAnalysisFields?.reduce((acc, field) => {
              if (f[field]) acc[field] = f[field];
              return acc;
            }, {}))
          })),
          aiAnalysisFields: aiAnalysisFields,
          disasters: disasters?.slice(0, 30),
          impactedFacilities: impactedFacilities?.slice(0, 20),
          selectedFacilityImpacts: selectedFacility
            ? (impactedFacilities.find((item) => item?.facility?.name === selectedFacility.name)?.impacts || []).slice(0, 10)
            : [],
          impactStatistics: impactStatistics,
          recentAnalysis: analysisData ? JSON.stringify(analysisData).substring(0, 200) : null,
          acledData: filteredAcledData.slice(0, 30), // Reduced ACLED to 30 for performance
          acledDeepPool: filteredAcledData.slice(0, 200),
          acledEnabled: acledEnabled,
          acledConfig: acledConfig,
          operationType: operationType || 'general',
          weatherForecast: weatherContext, // Add weather context for chatbot
          worldPopData: worldPopData, // Add WorldPop population data
          worldPopYear: worldPopLastFetch?.year || null, // Add WorldPop year
          // Send simplified districts array (just name and id) for WorldPop context formatting
          districtsForWorldPop: districts && districts.length > 0 ? districts.map(d => ({
            id: d.id,
            name: d.name,
            country: d.country,
            region: d.region
          })) : null,
          // OpenStreetMap Infrastructure data
          osmData: osmData,
          prioritizationBoard: prioritizationBoard
        }}
      />

      {/* WorldPop Population Drawer */}
      <WorldPopDrawer
        isOpen={showWorldPopDrawer}
        onClose={() => setShowWorldPopDrawer(false)}
        districts={districts}
        worldPopData={worldPopData}
        isLoading={worldPopLoading}
        error={worldPopError}
        lastFetchParams={worldPopLastFetch}
        showWorldPopLayer={showWorldPopLayer}
        activeLayerType={worldPopLayerType}
        setActiveLayerType={setWorldPopLayerType}
        toggleWorldPopLayer={toggleWorldPopLayer}
        fetchWorldPopData={fetchWorldPopData}
        clearWorldPopData={clearWorldPopData}
        scopeToShapefile={scopeToShapefile}
        toggleScopeToShapefile={toggleScopeToShapefile}
      />

      {/* Campaign Dashboard */}
      <CampaignDashboard
        facilities={facilities}
        disasters={visibleDisasters}
        impactedFacilities={impactedFacilities}
        acledData={filteredAcledData}
        acledEnabled={acledEnabled}
        districts={enrichedDistricts}
        selectedDistricts={selectedAnalysisDistricts}
        worldPopData={worldPopData}
        worldPopYear={worldPopLastFetch?.year}
        isOpen={showCampaignDashboard}
        onClose={() => setShowCampaignDashboard(false)}
        operationType={operationType}
      />

      {/* Campaign Dashboard button moved to hamburger menu for cleaner UI */}

      {/* WorldPop Population Button - visible when districts are loaded */}
      {districts && districts.length > 0 && (
        <button
          onClick={() => setShowWorldPopDrawer(true)}
          title="Population Data (WorldPop)"
          style={{
            position: 'absolute',
            bottom: '116px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: Object.keys(worldPopData).length > 0 ? '#059669' : 'var(--aidstack-navy, #1B3A5C)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
            transition: 'all 0.3s ease',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 5px 16px rgba(0,0,0,0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.25)';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span style={{ fontSize: '9px', marginTop: '2px', fontWeight: 700 }}>POP</span>
        </button>
      )}

      {/* AI Chat Button - Positioned at bottom-right of map */}
      {(
      <button
        onClick={() => setShowChatDrawer(true)}
        title="Ask AI Assistant"
        style={{
          position: 'absolute',
          bottom: '50px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: 'var(--aidstack-orange)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
          transition: 'all 0.3s ease',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 5px 16px rgba(0,0,0,0.35)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.25)';
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span style={{fontSize: '11px', marginTop: '2px', fontWeight: 700}}>AI</span>
      </button>
      )}

      {/* Timeline Scrubber - Bottom playback controls */}
      <TimelineScrubber
        isEnabled={playbackEnabled}
        minDate={dateRange.minDate}
        maxDate={dateRange.maxDate}
        currentDate={currentDate}
        onDateChange={jumpToDate}
        onPlayPause={togglePlayPause}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onSpeedChange={changeSpeed}
        onClose={togglePlayback}
      />

      {/* Loading / empty state overlay */}
      {facilities.length === 0 && disasters.length === 0 && (() => {
        try { return !!localStorage.getItem('gdacs_onboarding_done'); } catch (_) { return false; }
      })() && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(4px)',
            borderRadius: '12px',
            padding: '32px 40px',
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            maxWidth: '320px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {loading ? '⏳' : '🗺️'}
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--aidstack-navy)',
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: '8px'
            }}>
              {loading ? 'Loading live GDACS data' : 'No data loaded yet'}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#666',
              fontFamily: "'Inter', sans-serif",
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>
              {loading
                ? 'Fetching the latest disaster events from GDACS.'
                : 'Upload facility data or load live disasters to get started'}
            </div>
            <button
              onClick={() => {
                if (!loading) {
                  openUnifiedDrawer('facilities');
                }
              }}
              style={{
                backgroundColor: loading ? '#cbd5e1' : 'var(--aidstack-orange)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              {loading ? 'Loading…' : 'Get Started'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
