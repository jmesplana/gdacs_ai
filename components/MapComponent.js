import { useEffect, useRef, useState } from 'react';
// GDACS Facilities Impact Assessment Tool
// Developed by John Mark Esplana (https://github.com/jmesplana)
import { MapContainer, TileLayer, CircleMarker, Marker as ReactLeafletMarker, Popup, Tooltip, GeoJSON } from 'react-leaflet';
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

import {
  FilterDrawer,
  UnifiedDrawer,
  ColumnSelectionModal,
  RecommendationsDrawer,
  ChatDrawer,
  WorldPopDrawer
} from './MapComponent/components/drawers';

import {
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
`;

const MapComponent = ({
  disasters,
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
  operationType = 'malaria_control',
  onOperationTypeChange,
  districts = [],
  onDistrictsLoaded,
  districtAvailableFields = [],
  districtLabelField = null,
  onDistrictLabelFieldChange,
  onDistrictClick,
  onDistrictOutlookClick,
  onWorldPopDataChange
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
    drawControlRef,
    drawnItemsRef,
    toggleDrawing,
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
    showLabels,
    showDistrictLabels,
    isFullscreen,
    filterDrawerOpen,
    unifiedDrawerOpen,
    activeDrawerTab,
    currentMapLayer,
    showRoads,
    setShowHeatmap,
    setShowImpactZones,
    setShowZoomIndicator,
    setShowTimeline,
    setShowStatistics,
    setShowLegend,
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
    osmLayers,
    osmLayerVisibility,
    showOSMLayer,
    fetchOSMInfrastructure,
    refreshOSM,
    clearOSM,
    toggleLayer,
    toggleLayerVisibility,
    toggleAllOSM,
  } = useOSMInfrastructure();
  const [showOSMDrawer, setShowOSMDrawer] = useState(false);

  // Auto-fetch OSM data when districts loaded
  useEffect(() => {
    if (districts && districts.length > 0 && !osmData && !osmLoading && !osmError) {
      // Calculate boundary from districts
      const allCoords = [];
      districts.forEach(district => {
        if (district.geometry && district.geometry.coordinates) {
          const coords = district.geometry.type === 'Polygon'
            ? district.geometry.coordinates[0]
            : district.geometry.coordinates[0][0];
          allCoords.push(...coords);
        }
      });

      if (allCoords.length > 0) {
        // Create bounding polygon
        const lons = allCoords.map(c => c[0]);
        const lats = allCoords.map(c => c[1]);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        const boundary = {
          type: 'Polygon',
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat]
          ]]
        };

        console.log('Auto-fetching OSM infrastructure for districts...');
        fetchOSMInfrastructure(boundary);
      }
    }
  }, [districts, osmData, osmLoading, osmError, fetchOSMInfrastructure]);

  // Recommendations drawer state
  const [showRecommendationsDrawer, setShowRecommendationsDrawer] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsAIGenerated, setRecommendationsAIGenerated] = useState(false);
  const [recommendationsTimestamp, setRecommendationsTimestamp] = useState(null);
  const [recommendationsCache, setRecommendationsCache] = useState({}); // Cache by facility name

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
    const districtRisks = calculateDistrictRisks(districts, filteredDisasters, getFilteredAcledData());

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

    const risks = {};

    districts.forEach(district => {
      let riskScore = 0;
      let eventCount = 0;

      // Check for disasters in this district
      disasters?.forEach(disaster => {
        if (disaster.latitude && disaster.longitude) {
          const lat = parseFloat(disaster.latitude);
          const lng = parseFloat(disaster.longitude);

          // Check if disaster is within district bounds
          if (district.bounds) {
            const { minLat, maxLat, minLng, maxLng } = district.bounds;
            if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
              eventCount++;
              // Weight by severity
              if (disaster.severity === 'Extreme' || disaster.alertLevel === 'Red') {
                riskScore += 10;
              } else if (disaster.severity === 'Severe' || disaster.alertLevel === 'Orange') {
                riskScore += 7;
              } else if (disaster.severity === 'Moderate' || disaster.alertLevel === 'Yellow') {
                riskScore += 5;
              } else {
                riskScore += 3;
              }
            }
          }
        }
      });

      // Check for ACLED events in this district
      acledData?.forEach(event => {
        if (event.latitude && event.longitude) {
          const lat = parseFloat(event.latitude);
          const lng = parseFloat(event.longitude);

          if (district.bounds) {
            const { minLat, maxLat, minLng, maxLng } = district.bounds;
            if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
              eventCount++;
              // Weight by event type
              if (event.event_type === 'Battles' || event.event_type === 'Explosions/Remote violence') {
                riskScore += 8;
              } else if (event.event_type === 'Violence against civilians') {
                riskScore += 10;
              } else if (event.event_type === 'Riots' || event.event_type === 'Protests') {
                riskScore += 4;
              } else {
                riskScore += 2;
              }
            }
          }
        }
      });

      // Determine risk level
      let level = 'none';
      if (riskScore === 0) {
        level = 'none';
      } else if (riskScore < 10) {
        level = 'low';
      } else if (riskScore < 20) {
        level = 'medium';
      } else if (riskScore < 40) {
        level = 'high';
      } else {
        level = 'very-high';
      }

      risks[district.id] = {
        level,
        score: riskScore,
        eventCount
      };
    });

    return risks;
  };

  // Generate recommendations for a facility
  const handleGenerateRecommendations = async (facility, forceRefresh = false) => {
    const facilityImpacts = impactedFacilities.find(
      f => f.facility.name === facility.name
    )?.impacts || [];

    // Check if we have cached recommendations for this facility
    const cacheKey = `${facility.name}_${facilityImpacts.length}`;
    if (!forceRefresh && recommendationsCache[cacheKey]) {
      console.log('Using cached recommendations for:', facility.name);
      setRecommendations(recommendationsCache[cacheKey].recommendations);
      setRecommendationsAIGenerated(recommendationsCache[cacheKey].isAIGenerated);
      setRecommendationsTimestamp(recommendationsCache[cacheKey].timestamp);
      setShowRecommendationsDrawer(true);
      return;
    }

    setRecommendationsLoading(true);
    setShowRecommendationsDrawer(true);

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
    } finally {
      setRecommendationsLoading(false);
    }
  };

  // Filter ACLED data based on config (same logic as AcledMarkers.js)
  const getFilteredAcledData = () => {
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
    });
  };

  // Removed: Auto-showing zoom indicator when date filter changes
  // useEffect(() => {
  //   if (dateFilter) {
  //     setShowZoomIndicator(true);
  //   }
  // }, [dateFilter, setShowZoomIndicator]);

  // Initialize timeline with all disasters
  useEffect(() => {
    if (disasters && disasters.length > 0) {
      setTimelineFilteredDisasters(disasters);
    }
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

  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    if (mapContainerRef.current) {
      toggleFullscreen(mapContainerRef.current, isFullscreen);
    }
  };

  // Get current map layer configuration
  const currentLayer = MAP_LAYERS[currentMapLayer.toUpperCase()] || MAP_LAYERS.STREET;

  // Check if any drawer is open
  const isAnyDrawerOpen = filterDrawerOpen || unifiedDrawerOpen || showChatDrawer;

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

      {/* Hamburger Menu - Contains all controls: Control Panel, Filter, Campaign Dashboard, Draw, Help */}
      <HamburgerMenu
        onControlPanelClick={toggleUnifiedDrawer}
        onFilterClick={toggleFilterDrawer}
        onCampaignDashboardClick={() => setShowCampaignDashboard(true)}
        onHelpClick={() => setShowHelp(!showHelp)}
        drawingEnabled={drawingEnabled}
        onDrawClick={toggleDrawing}
        drawingColor={drawingColor}
        setDrawingColor={setDrawingColor}
        onUndoDrawing={undoLastDrawing}
        onClearDrawings={clearAllDrawings}
        drawingsCount={drawings.length}
        operationType={operationType}
        onOperationTypeChange={onOperationTypeChange}
        playbackEnabled={playbackEnabled}
        onPlaybackClick={togglePlayback}
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
        onFileUpload={(file) => {
          console.log('File selected:', file);
          const syntheticEvent = { target: { files: [file] } };
          handleFileUpload(syntheticEvent);
        }}
        onFacilitySelect={(facility) => {
          setSelectedFacility(facility);
          const facilityImpacts = impactedFacilities.find(
            f => f.facility.name === facility.name
          )?.impacts || [];
          console.log('Facility impacts:', facilityImpacts);
          handleAnalyzeFacility(facility, facilityImpacts);
          setActiveDrawerTab('analysis'); // Switch to analysis tab
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
        osmData={osmData}

        // Label control
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        showDistrictLabels={showDistrictLabels}
        setShowDistrictLabels={setShowDistrictLabels}

        // Reports tab props
        sitrep={sitrep}
        sitrepTimestamp={sitrepTimestamp}

        // Layers tab props
        layerSettings={{
          currentMapLayer,
          showRoads,
          osmData,
          osmStats,
          osmLoading,
          osmError,
          osmLayerVisibility,
          showOSMLayer
        }}
        onLayerToggle={(setting, value) => {
          if (setting === 'currentMapLayer') setCurrentMapLayer(value);
          if (setting === 'showRoads') setShowRoads(value);
        }}
        onLayerConfigChange={(config) => {
          if (config.currentMapLayer) setCurrentMapLayer(config.currentMapLayer);
          if (config.showRoads !== undefined) setShowRoads(config.showRoads);
        }}
        onOSMRefresh={refreshOSM}
        onOSMToggle={toggleAllOSM}
        onOSMLayerToggle={toggleLayerVisibility}
        osmStats={osmStats}
        osmLoading={osmLoading}
        osmLayerVisibility={osmLayerVisibility}
        onLoadOSM={(selectedDistricts, selectedCategories) => {
          console.log('🚀 onLoadOSM called!', {
            districtsCount: selectedDistricts?.length,
            categoriesCount: selectedCategories?.length,
            districts: selectedDistricts,
            categories: selectedCategories
          });

          // Clear old cached data first to prevent stale data from showing
          clearOSM();

          // Calculate combined boundary from selected districts
          const allCoords = [];
          selectedDistricts.forEach(district => {
            if (district.geometry && district.geometry.coordinates) {
              const coords = district.geometry.type === 'Polygon'
                ? district.geometry.coordinates[0]
                : district.geometry.coordinates[0][0];
              allCoords.push(...coords);
            }
          });

          console.log('📍 Collected coordinates from districts:', allCoords.length);

          if (allCoords.length > 0) {
            const lons = allCoords.map(c => c[0]);
            const lats = allCoords.map(c => c[1]);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            const boundary = {
              type: 'Polygon',
              coordinates: [[
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat]
              ]]
            };

            console.log(`✅ Loading OSM: ${selectedCategories.length} categories for ${selectedDistricts.length} district(s)...`);
            console.log('✅ Selected categories:', selectedCategories);
            console.log('✅ Boundary:', boundary);

            // Fetch OSM data for selected categories only
            fetchOSMInfrastructure(boundary, selectedCategories);
          } else {
            console.error('❌ No coordinates collected from districts!');
          }
        }}
        onToggleOSMLayerVisibility={toggleLayerVisibility}
        onClearOSMCategory={(category) => {
          console.log(`Clear OSM category: ${category}`);
          // TODO: Implement category clearing in hook
        }}
        onOSMDistrictSelect={(selectedDistricts) => {
          // Old callback - keeping for backward compatibility
          const allCoords = [];
          selectedDistricts.forEach(district => {
            if (district.geometry && district.geometry.coordinates) {
              const coords = district.geometry.type === 'Polygon'
                ? district.geometry.coordinates[0]
                : district.geometry.coordinates[0][0];
              allCoords.push(...coords);
            }
          });

          if (allCoords.length > 0) {
            const lons = allCoords.map(c => c[0]);
            const lats = allCoords.map(c => c[1]);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            const boundary = {
              type: 'Polygon',
              coordinates: [[
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat]
              ]]
            };

            console.log(`Loading OSM for ${selectedDistricts.length} selected district(s)...`);
            fetchOSMInfrastructure(boundary);
          }
        }}
      />

      {/* Recommendations Drawer */}
      <RecommendationsDrawer
        isOpen={showRecommendationsDrawer}
        onClose={() => setShowRecommendationsDrawer(false)}
        facility={selectedFacility}
        recommendations={recommendations}
        loading={recommendationsLoading}
        isAIGenerated={recommendationsAIGenerated}
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
          disasters={disasters}
          onDateChange={handleTimelineChange}
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
        <TileLayer
          url={currentLayer.url}
          attribution={currentLayer.attribution}
        />

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

          // Calculate risk levels for all districts (use playback-filtered data if enabled)
          const disastersForRisk = playbackEnabled ? filterByPlaybackDate(filteredDisasters, 'pubDate') : filteredDisasters;
          const acledForRisk = playbackEnabled ? filterByPlaybackDate(getFilteredAcledData(), 'event_date') : getFilteredAcledData();
          const districtRisks = calculateDistrictRisks(districts, disastersForRisk, acledForRisk);

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
            features: districts
              .filter(d => {
                if (!d.geometry) {
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
                  geometry: district.geometry,
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
              key={`districts-${districts.length}-${filteredDisasters.length}-${getFilteredAcledData().length}-${highlightedDistricts.length}-labels-${showDistrictLabels}-field-${districtLabelField}`}
              data={featureCollection}
              pane="overlayPane"
              interactive={true}
              style={(feature) => {
                const riskLevel = feature.properties.riskLevel || 'none';
                const isHighlighted = highlightedDistricts.includes(feature.id);

                return {
                  color: isHighlighted ? '#FF6B35' : getBorderColor(riskLevel),
                  weight: isHighlighted ? 4 : 3, // Increased from 2 to 3
                  opacity: isHighlighted ? 1 : 1, // Changed from 0.8 to 1 for fully visible borders
                  fillColor: getRiskColor(riskLevel),
                  fillOpacity: isHighlighted ? 0.7 : (riskLevel === 'none' ? 0.2 : 0.5), // Minimum 0.2 opacity for all districts to ensure clickability
                  className: isHighlighted ? 'highlighted-district' : ''
                };
              }}
              onEachFeature={(feature, layer) => {
                const props = feature.properties;

                // Build popup HTML with all available properties
                const displayName = props.name || props.NAME || props.DISTRICT || props.District || 'Unnamed District';

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
                if (showDistrictLabels && mapInstance) {
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

                // Add click event listeners for buttons
                if (onDistrictClick || onDistrictOutlookClick) {
                  layer.on('popupopen', () => {
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
        {showHeatmap && <HeatmapLayer disasters={playbackEnabled ? filterByPlaybackDate(filteredDisasters, 'pubDate') : filteredDisasters} />}

        {/* Disaster markers */}
        <DisasterMarkers
          disasters={playbackEnabled ? filterByPlaybackDate(filteredDisasters, 'pubDate') : filteredDisasters}
          showImpactZones={showImpactZones}
        />

        {/* ACLED conflict event markers */}
        <AcledMarkers
          acledData={playbackEnabled ? filterByPlaybackDate(getFilteredAcledData(), 'event_date') : getFilteredAcledData()}
          acledEnabled={acledEnabled}
          acledConfig={acledConfig}
        />

        {/* OSM Infrastructure layer */}
        <OSMInfrastructureLayer
          osmData={osmData}
          layerVisibility={osmLayerVisibility}
          showOSMLayer={showOSMLayer}
        />

        {/* Drawing layer */}
        <DrawingLayer
          enabled={drawingEnabled}
          color={drawingColor}
          drawControlRef={drawControlRef}
          drawnItemsRef={drawnItemsRef}
          drawings={drawings}
          setDrawings={setDrawings}
        />

        {/* Facility markers */}
        {facilities && facilities.length > 0 && (
          <MarkerClusterGroup
            showCoverageOnHover={false}
            maxClusterRadius={50}
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
              const dimension = size === 'small' ? '36px' : size === 'medium' ? '46px' : '56px';
              const fontSize = size === 'small' ? '13px' : size === 'medium' ? '15px' : '18px';

              return L.divIcon({
                html: `<div style="
                  background: ${bgColor};
                  color: white;
                  border-radius: 4px;
                  width: ${dimension};
                  height: ${dimension};
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  border: 3px solid white;
                  box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                ">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 2px;">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                  <span style="font-size: ${fontSize}; line-height: 1;">${count}</span>
                </div>`,
                className: 'facility-cluster',
                iconSize: [parseInt(dimension), parseInt(dimension)]
              });
            }}
          >
            {facilities.map((facility, idx) => {
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
                        onClick={() => {
                          setSelectedFacility(facility);
                          // Find the impacts for this specific facility
                          const facilityImpacts = impactedFacilities.find(
                            f => f.facility.name === facility.name
                          )?.impacts || [];
                          handleAnalyzeFacility(facility, facilityImpacts);
                          // Open unified drawer and switch to analysis tab
                          setActiveDrawerTab('analysis');
                          if (!unifiedDrawerOpen) {
                            toggleUnifiedDrawer();
                          }
                        }}
                        style={{
                          marginTop: '10px',
                          padding: '8px 16px',
                          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          width: '100%'
                        }}
                      >
                        Analyze Facility
                      </button>
                    </div>
                  </Popup>
                </ReactLeafletMarker>
              );
            })}
          </MarkerClusterGroup>
        )}
      </MapContainer>

      {/* Chat Drawer - Kept separate due to complex context management */}
      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        onHighlightDistricts={districts && districts.length > 0 ? handleHighlightDistricts : null}
        context={{
          selectedFacility: selectedFacility,
          totalFacilities: facilities?.length || 0,
          totalAcledEvents: acledData?.length || 0,
          totalDistricts: districts?.length || 0,
          hasDistricts: districts && districts.length > 0,
          districts: districts && districts.length > 0 ? (() => {
            // Calculate risk levels for all districts
            const districtRisks = calculateDistrictRisks(districts, filteredDisasters, getFilteredAcledData());

            // Count districts by risk level
            const riskCounts = {
              'very-high': 0,
              'high': 0,
              'medium': 0,
              'low': 0,
              'none': 0
            };

            // Get sample district names by risk level (top 3 for each)
            const samplesByRisk = {
              'very-high': [],
              'high': [],
              'medium': [],
              'low': [],
              'none': []
            };

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
            });

            // Get geographic bounds of the shapefile area
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            districts.forEach(d => {
              if (d.bounds) {
                minLat = Math.min(minLat, d.bounds.minLat);
                maxLat = Math.max(maxLat, d.bounds.maxLat);
                minLng = Math.min(minLng, d.bounds.minLng);
                maxLng = Math.max(maxLng, d.bounds.maxLng);
              }
            });

            const country = districts[0]?.country || 'Unknown';
            const region = districts[0]?.region || 'Unknown';

            return {
              totalCount: districts.length,
              country: country,
              region: region,
              geographicBounds: {
                minLat: minLat.toFixed(2),
                maxLat: maxLat.toFixed(2),
                minLng: minLng.toFixed(2),
                maxLng: maxLng.toFixed(2),
                centerLat: ((minLat + maxLat) / 2).toFixed(2),
                centerLng: ((minLng + maxLng) / 2).toFixed(2)
              },
              riskBreakdown: riskCounts,
              sampleDistricts: samplesByRisk
            };
          })() : null,
          // Send 200 facilities with only essential fields to keep payload reasonable
          facilities: facilities?.slice(0, 200).map(f => ({
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
          impactStatistics: impactStatistics,
          recentAnalysis: analysisData ? JSON.stringify(analysisData).substring(0, 200) : null,
          acledData: getFilteredAcledData().slice(0, 30), // Reduced ACLED to 30 for performance
          acledEnabled: acledEnabled,
          acledConfig: acledConfig,
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
          osmData: osmData
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
        disasters={disasters}
        impactedFacilities={impactedFacilities}
        acledData={getFilteredAcledData()} // Use filtered ACLED data
        acledEnabled={acledEnabled}
        districts={(() => {
          // Enrich districts with risk data before passing to dashboard
          const districtRisks = calculateDistrictRisks(districts, filteredDisasters, getFilteredAcledData());
          return districts.map(district => {
            const risk = districtRisks[district.id] || { level: 'none', score: 0, eventCount: 0 };
            return {
              ...district,
              riskLevel: risk.level,
              riskScore: risk.score,
              eventCount: risk.eventCount
            };
          });
        })()} // Pass enriched districts with risk data
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

      {/* Empty state overlay — shown when no data is loaded and onboarding is complete */}
      {facilities.length === 0 && disasters.length === 0 && !loading && (() => {
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
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--aidstack-navy)',
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: '8px'
            }}>No data loaded yet</div>
            <div style={{
              fontSize: '13px',
              color: '#666',
              fontFamily: "'Inter', sans-serif",
              marginBottom: '20px',
              lineHeight: '1.5'
            }}>Upload facility data or load live disasters to get started</div>
            <button
              onClick={() => openUnifiedDrawer('facilities')}
              style={{
                backgroundColor: 'var(--aidstack-orange)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
