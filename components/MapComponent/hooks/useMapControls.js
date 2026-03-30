import { useState, useCallback, useEffect } from 'react';
import { isFullscreenActive } from '../utils/mapHelpers';

/**
 * Custom hook for managing all map control states (drawers, overlays, etc.)
 * @returns {Object} Control states and handlers
 */
export const useMapControls = () => {
  // Visualization toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showImpactZones, setShowImpactZones] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showContextStatusBar, setShowContextStatusBar] = useState(true);
  const [showClusterCounts, setShowClusterCounts] = useState(true);
  const [showClustering, setShowClustering] = useState(true);
  const [showFacilitiesLayer, setShowFacilitiesLayer] = useState(true);
  const [showAcledLayer, setShowAcledLayer] = useState(true);
  const [showFloodContextLayer, setShowFloodContextLayer] = useState(false);
  const [showDroughtContextLayer, setShowDroughtContextLayer] = useState(false);
  const [showDistrictRiskFill, setShowDistrictRiskFill] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showDistrictLabels, setShowDistrictLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer states
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [unifiedDrawerOpen, setUnifiedDrawerOpen] = useState(false);
  const [mapLayersDrawerOpen, setMapLayersDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('facilities'); // facilities, analysis, logistics, reports

  // Map layer states
  const [currentMapLayer, setCurrentMapLayer] = useState('street');
  const [showRoads, setShowRoads] = useState(false);

  // Handle fullscreen change events
  useEffect(() => {
    const fullscreenChangeHandler = () => {
      setIsFullscreen(isFullscreenActive());
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
  }, []);

  // Toggle functions
  const toggleFilterDrawer = useCallback(() => {
    setFilterDrawerOpen(prev => !prev);
    setUnifiedDrawerOpen(false); // Close unified drawer
    setMapLayersDrawerOpen(false);
  }, []);

  const openUnifiedDrawer = useCallback((tab = 'facilities') => {
    setActiveDrawerTab(tab === 'layers' ? 'facilities' : tab);
    setUnifiedDrawerOpen(true);
    setFilterDrawerOpen(false); // Close filter drawer
    setMapLayersDrawerOpen(false);
  }, []);

  const toggleUnifiedDrawer = useCallback(() => {
    setUnifiedDrawerOpen(prev => !prev);
    setFilterDrawerOpen(false);
    setMapLayersDrawerOpen(false);
  }, []);

  const toggleMapLayersDrawer = useCallback(() => {
    setMapLayersDrawerOpen(prev => !prev);
    setFilterDrawerOpen(false);
    setUnifiedDrawerOpen(false);
  }, []);

  // Legacy functions for backward compatibility
  const toggleFacilityDrawer = useCallback(() => openUnifiedDrawer('facilities'), [openUnifiedDrawer]);
  const toggleSitrepDrawer = useCallback(() => openUnifiedDrawer('reports'), [openUnifiedDrawer]);
  const toggleAnalysisDrawer = useCallback(() => openUnifiedDrawer('analysis'), [openUnifiedDrawer]);

  const closeAllOverlays = useCallback(() => {
    setShowLegend(false);
    setShowTimeline(false);
    setShowStatistics(false);
    setFilterDrawerOpen(false);
    setUnifiedDrawerOpen(false);
    setMapLayersDrawerOpen(false);
  }, []);

  return {
    // Visualization states
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
    showFloodContextLayer,
    showDroughtContextLayer,
    showDistrictRiskFill,
    showLabels,
    showDistrictLabels,
    isFullscreen,

    // Drawer states
    filterDrawerOpen,
    unifiedDrawerOpen,
    mapLayersDrawerOpen,
    activeDrawerTab,

    // Map layer states
    currentMapLayer,
    showRoads,

    // Setters
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
    setShowFloodContextLayer,
    setShowDroughtContextLayer,
    setShowDistrictRiskFill,
    setShowLabels,
    setShowDistrictLabels,
    setIsFullscreen,
    setCurrentMapLayer,
    setShowRoads,

    // Toggle functions
    toggleFilterDrawer,
    openUnifiedDrawer,
    toggleUnifiedDrawer,
    setActiveDrawerTab,
    toggleMapLayersDrawer,
    // Legacy toggle functions (for backward compatibility)
    toggleFacilityDrawer,
    toggleSitrepDrawer,
    toggleAnalysisDrawer,
    closeAllOverlays
  };
};
