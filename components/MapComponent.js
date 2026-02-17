import { useEffect, useRef, useState } from 'react';
// GDACS Facilities Impact Assessment Tool
// Developed by John Mark Esplana (https://github.com/jmesplana)
import { MapContainer, TileLayer, CircleMarker, Marker as ReactLeafletMarker, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import ReactMarkdown from 'react-markdown';

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

import {
  FilterDrawer,
  FacilityDrawer,
  MapLayersDrawer,
  AnalysisDrawer,
  SitrepDrawer,
  ColumnSelectionModal,
  RecommendationsDrawer,
  ChatDrawer
} from './MapComponent/components/drawers';

import {
  FloatingActionButtons,
  MapLegend,
  CampaignDashboard
} from './MapComponent/components/overlays';

// Import hooks
import {
  useMapFilters,
  useDrawing,
  useFileUpload,
  useMapControls,
  useAIAnalysis
} from './MapComponent/hooks';

// Import utils
import {
  getDisasterInfo,
  getAlertColor,
  zoomToFilteredEvents,
  toggleFullscreen
} from './MapComponent/utils';

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

  .fade-in {
    animation: fadeIn 0.3s ease-out forwards;
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
  onAcledConfigChange
}) => {
  // Map refs - keep these in main component
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

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
  } = useFileUpload();

  const {
    showHeatmap,
    showImpactZones,
    showZoomIndicator,
    showTimeline,
    showStatistics,
    showLegend,
    showLabels,
    isFullscreen,
    filterDrawerOpen,
    facilityDrawerOpen,
    sitrepDrawerOpen,
    mapLayersDrawerOpen,
    showAnalysisDrawer,
    currentMapLayer,
    showRoads,
    setShowHeatmap,
    setShowImpactZones,
    setShowZoomIndicator,
    setShowTimeline,
    setShowStatistics,
    setShowLegend,
    setShowLabels,
    setIsFullscreen,
    setCurrentMapLayer,
    setShowRoads,
    toggleFilterDrawer,
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

  // Recommendations drawer state
  const [showRecommendationsDrawer, setShowRecommendationsDrawer] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsAIGenerated, setRecommendationsAIGenerated] = useState(false);
  const [recommendationsTimestamp, setRecommendationsTimestamp] = useState(null);
  const [recommendationsCache, setRecommendationsCache] = useState({}); // Cache by facility name

  // Sitrep timestamp
  const [sitrepTimestamp, setSitrepTimestamp] = useState(null);

  // Campaign Dashboard state
  const [showCampaignDashboard, setShowCampaignDashboard] = useState(false);

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
          useAI: true
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

  // Show zoom indicator when date filter changes
  useEffect(() => {
    if (dateFilter) {
      setShowZoomIndicator(true);
    }
  }, [dateFilter, setShowZoomIndicator]);

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
  }, [filterDrawerOpen, facilityDrawerOpen, sitrepDrawerOpen, mapLayersDrawerOpen, showAnalysisDrawer, mapInstance]);

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
  const isAnyDrawerOpen = filterDrawerOpen || facilityDrawerOpen || sitrepDrawerOpen ||
                          mapLayersDrawerOpen || showAnalysisDrawer;

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

      {/* Floating action buttons */}
      <FloatingActionButtons
        onFilterClick={toggleFilterDrawer}
        onFacilitiesClick={toggleFacilityDrawer}
        onSitrepClick={toggleSitrepDrawer}
        onLayersClick={toggleMapLayersDrawer}
        onHelpClick={() => setShowHelp(!showHelp)}
        drawingEnabled={drawingEnabled}
        onDrawClick={toggleDrawing}
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
        onZoomToFit={handleZoomToFit}
        showZoomIndicator={showZoomIndicator}
        disasters={disasters}
        dateFilter={dateFilter}
        handleDateFilterChange={handleDateFilterChange}
      />

      {/* Facility Drawer */}
      <FacilityDrawer
        isOpen={facilityDrawerOpen}
        onClose={toggleFacilityDrawer}
        facilities={facilities}
        impactedFacilities={impactedFacilities}
        impactStatistics={impactStatistics}
        onFileUpload={(file) => {
          console.log('File selected:', file);
          // Create a synthetic event for the hook
          const syntheticEvent = { target: { files: [file] } };
          handleFileUpload(syntheticEvent);
        }}
        onFacilitySelect={(facility) => {
          setSelectedFacility(facility);
          // Find the impacts for this specific facility
          const facilityImpacts = impactedFacilities.find(
            f => f.facility.name === facility.name
          )?.impacts || [];
          console.log('Facility impacts:', facilityImpacts);
          handleAnalyzeFacility(facility, facilityImpacts);
          toggleAnalysisDrawer();
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
      />

      {/* Map Layers Drawer */}
      <MapLayersDrawer
        isOpen={mapLayersDrawerOpen}
        onClose={toggleMapLayersDrawer}
        currentMapLayer={currentMapLayer}
        setCurrentMapLayer={setCurrentMapLayer}
        showRoads={showRoads}
        setShowRoads={setShowRoads}
      />

      {/* Analysis Drawer */}
      <AnalysisDrawer
        isOpen={showAnalysisDrawer}
        onClose={toggleAnalysisDrawer}
        selectedFacility={selectedFacility}
        analysisData={analysisData}
        analysisLoading={analysisLoading}
        isAIGenerated={isAIGenerated}
        timestamp={analysisTimestamp}
        onRefresh={() => {
          if (selectedFacility) {
            const facilityImpacts = impactedFacilities.find(
              f => f.facility.name === selectedFacility.name
            )?.impacts || [];
            handleAnalyzeFacility(selectedFacility, facilityImpacts, true); // true = force refresh
          }
        }}
        impactedFacilities={impactedFacilities}
        acledData={acledData}
        acledEnabled={acledEnabled}
        onViewRecommendations={(facility) => {
          toggleAnalysisDrawer(); // Close the analysis drawer
          handleGenerateRecommendations(facility); // Open recommendations drawer
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

      {/* Sitrep Drawer */}
      <SitrepDrawer
        isOpen={sitrepDrawerOpen}
        onClose={toggleSitrepDrawer}
        onGenerateSitrep={onGenerateSitrep}
        sitrepLoading={sitrepLoading}
        sitrep={sitrep}
        disasters={disasters}
        facilities={facilities}
        impactedFacilities={impactedFacilities}
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

        {/* Map access component for capturing map instance */}
        <MapAccess onMapReady={(map) => {
          setMapInstance(map);
          map.on('click', handleMapClick);
        }} />

        {/* Heatmap layer */}
        {showHeatmap && <HeatmapLayer disasters={filteredDisasters} />}

        {/* Disaster markers */}
        <DisasterMarkers
          disasters={filteredDisasters}
          showImpactZones={showImpactZones}
        />

        {/* ACLED conflict event markers */}
        <AcledMarkers
          acledData={acledData}
          acledEnabled={acledEnabled}
          acledConfig={acledConfig}
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
          <MarkerClusterGroup>
            {facilities.map((facility, idx) => {
              const isImpacted = impactedFacilities?.some(
                impacted => impacted.name === facility.name
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
                    border-radius: 50%;
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
                          toggleAnalysisDrawer();
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

      {/* Chat Drawer */}
      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        context={{
          selectedFacility: selectedFacility,
          totalFacilities: facilities?.length || 0,
          totalAcledEvents: acledData?.length || 0, // Total ACLED events available
          facilities: facilities?.slice(0, 50), // Limit to first 50 facilities to avoid payload size issues
          aiAnalysisFields: aiAnalysisFields, // Fields selected for AI analysis
          disasters: disasters?.slice(0, 30), // Limit to 30 most recent disasters
          impactedFacilities: impactedFacilities?.slice(0, 20), // Limit to 20 impacted facilities
          impactStatistics: impactStatistics,
          recentAnalysis: analysisData ? JSON.stringify(analysisData).substring(0, 200) : null,
          acledData: getFilteredAcledData().slice(0, 200), // Use filtered data (respects date, event type, country, region filters)
          acledEnabled: acledEnabled, // ACLED toggle status
          acledConfig: acledConfig // Include config to show active filters
        }}
      />

      {/* Campaign Dashboard */}
      <CampaignDashboard
        facilities={facilities}
        disasters={disasters}
        impactedFacilities={impactedFacilities}
        acledData={getFilteredAcledData()} // Use filtered ACLED data
        acledEnabled={acledEnabled}
        isOpen={showCampaignDashboard}
        onClose={() => setShowCampaignDashboard(false)}
      />

      {/* Dashboard Toggle Button - Shows when facilities are uploaded */}
      {facilities.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '20px',
          zIndex: 2500,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-end'
        }}>
          <button
            onClick={() => setShowCampaignDashboard(true)}
            style={{
              backgroundColor: 'var(--aidstack-orange)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 20px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 'bold',
              fontSize: '14px',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
            title="View Campaign Readiness Dashboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Campaign Dashboard</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
