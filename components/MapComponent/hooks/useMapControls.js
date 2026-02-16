import { useState, useCallback, useEffect } from 'react';
import { isFullscreenActive } from '../utils/mapHelpers';

/**
 * Custom hook for managing all map control states (drawers, overlays, etc.)
 * @returns {Object} Control states and handlers
 */
export const useMapControls = () => {
  // Visualization toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showImpactZones, setShowImpactZones] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer states
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [facilityDrawerOpen, setFacilityDrawerOpen] = useState(false);
  const [sitrepDrawerOpen, setSitrepDrawerOpen] = useState(false);
  const [mapLayersDrawerOpen, setMapLayersDrawerOpen] = useState(false);
  const [showAnalysisDrawer, setShowAnalysisDrawer] = useState(false);

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
    // Close other drawers
    setFacilityDrawerOpen(false);
    setSitrepDrawerOpen(false);
    setMapLayersDrawerOpen(false);
    setShowAnalysisDrawer(false);
  }, []);

  const toggleFacilityDrawer = useCallback(() => {
    setFacilityDrawerOpen(prev => !prev);
    // Close other drawers
    setFilterDrawerOpen(false);
    setSitrepDrawerOpen(false);
    setMapLayersDrawerOpen(false);
    setShowAnalysisDrawer(false);
  }, []);

  const toggleSitrepDrawer = useCallback(() => {
    setSitrepDrawerOpen(prev => !prev);
    // Close other drawers
    setFilterDrawerOpen(false);
    setFacilityDrawerOpen(false);
    setMapLayersDrawerOpen(false);
    setShowAnalysisDrawer(false);
  }, []);

  const toggleMapLayersDrawer = useCallback(() => {
    setMapLayersDrawerOpen(prev => !prev);
    // Close other drawers
    setFilterDrawerOpen(false);
    setFacilityDrawerOpen(false);
    setSitrepDrawerOpen(false);
    setShowAnalysisDrawer(false);
  }, []);

  const toggleAnalysisDrawer = useCallback(() => {
    setShowAnalysisDrawer(prev => !prev);
    // Close other drawers
    setFilterDrawerOpen(false);
    setFacilityDrawerOpen(false);
    setSitrepDrawerOpen(false);
    setMapLayersDrawerOpen(false);
  }, []);

  const closeAllOverlays = useCallback(() => {
    setShowLegend(false);
    setShowTimeline(false);
    setShowStatistics(false);
    setFilterDrawerOpen(false);
    setFacilityDrawerOpen(false);
    setSitrepDrawerOpen(false);
    setMapLayersDrawerOpen(false);
    setShowAnalysisDrawer(false);
  }, []);

  return {
    // Visualization states
    showHeatmap,
    showImpactZones,
    showZoomIndicator,
    showTimeline,
    showStatistics,
    showLegend,
    showLabels,
    isFullscreen,

    // Drawer states
    filterDrawerOpen,
    facilityDrawerOpen,
    sitrepDrawerOpen,
    mapLayersDrawerOpen,
    showAnalysisDrawer,

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
    setShowLabels,
    setIsFullscreen,
    setCurrentMapLayer,
    setShowRoads,

    // Toggle functions
    toggleFilterDrawer,
    toggleFacilityDrawer,
    toggleSitrepDrawer,
    toggleMapLayersDrawer,
    toggleAnalysisDrawer,
    closeAllOverlays
  };
};
