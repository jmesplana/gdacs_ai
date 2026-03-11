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
  const [showLabels, setShowLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer states
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [unifiedDrawerOpen, setUnifiedDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('facilities'); // facilities, analysis, chat, reports, layers

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
  }, []);

  const openUnifiedDrawer = useCallback((tab = 'facilities') => {
    setActiveDrawerTab(tab);
    setUnifiedDrawerOpen(true);
    setFilterDrawerOpen(false); // Close filter drawer
  }, []);

  const toggleUnifiedDrawer = useCallback(() => {
    setUnifiedDrawerOpen(prev => !prev);
    setFilterDrawerOpen(false);
  }, []);

  // Legacy functions for backward compatibility
  const toggleFacilityDrawer = useCallback(() => openUnifiedDrawer('facilities'), [openUnifiedDrawer]);
  const toggleSitrepDrawer = useCallback(() => openUnifiedDrawer('reports'), [openUnifiedDrawer]);
  const toggleMapLayersDrawer = useCallback(() => openUnifiedDrawer('layers'), [openUnifiedDrawer]);
  const toggleAnalysisDrawer = useCallback(() => openUnifiedDrawer('analysis'), [openUnifiedDrawer]);

  const closeAllOverlays = useCallback(() => {
    setShowLegend(false);
    setShowTimeline(false);
    setShowStatistics(false);
    setFilterDrawerOpen(false);
    setUnifiedDrawerOpen(false);
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
    unifiedDrawerOpen,
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
    setShowLabels,
    setIsFullscreen,
    setCurrentMapLayer,
    setShowRoads,

    // Toggle functions
    toggleFilterDrawer,
    openUnifiedDrawer,
    toggleUnifiedDrawer,
    setActiveDrawerTab,
    // Legacy toggle functions (for backward compatibility)
    toggleFacilityDrawer,
    toggleSitrepDrawer,
    toggleMapLayersDrawer,
    toggleAnalysisDrawer,
    closeAllOverlays
  };
};
