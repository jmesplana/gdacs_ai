import { useState, useCallback, useEffect } from 'react';
import { isFullscreenActive } from '../utils/mapHelpers';
import {
  ADMIN_CLASSIFICATION_METHODS,
  ADMIN_FILL_MODES,
  ADMIN_METRIC_MEANINGS,
  NO_DATA_STYLES
} from '../utils/adminDatasetStyling';

/**
 * Custom hook for managing all map control states (drawers, overlays, etc.)
 * @returns {Object} Control states and handlers
 */
export const useMapControls = () => {
  // Visualization toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showImpactZones, setShowImpactZones] = useState(false);
  const [showDisasterIcons, setShowDisasterIcons] = useState(true);
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
  const [adminFillMode, setAdminFillMode] = useState(ADMIN_FILL_MODES.RISK);
  const [adminMetricField, setAdminMetricField] = useState('');
  const [adminMetricMeaning, setAdminMetricMeaning] = useState(ADMIN_METRIC_MEANINGS.WORSE_HIGH);
  const [adminClassification, setAdminClassification] = useState(ADMIN_CLASSIFICATION_METHODS.QUANTILE);
  const [adminClassCount, setAdminClassCount] = useState(5);
  const [adminNoDataStyle, setAdminNoDataStyle] = useState(NO_DATA_STYLES.TRANSPARENT);
  const [showLabels, setShowLabels] = useState(true);
  const [showDistrictLabels, setShowDistrictLabels] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawer states
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [unifiedDrawerOpen, setUnifiedDrawerOpen] = useState(false);
  const [mapLayersDrawerOpen, setMapLayersDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('facilities'); // facilities, analysis, logistics, reports
  const [drawerMode, setDrawerMode] = useState('workspace'); // workspace, datahub

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

  const openUnifiedDrawer = useCallback((tab = 'facilities', mode = 'workspace') => {
    setActiveDrawerTab(tab === 'layers' ? 'facilities' : tab);
    setDrawerMode(mode);
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
    showDisasterIcons,
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
    adminFillMode,
    adminMetricField,
    adminMetricMeaning,
    adminClassification,
    adminClassCount,
    adminNoDataStyle,
    showLabels,
    showDistrictLabels,
    isFullscreen,

    // Drawer states
    filterDrawerOpen,
    unifiedDrawerOpen,
    mapLayersDrawerOpen,
    activeDrawerTab,
    drawerMode,

    // Map layer states
    currentMapLayer,
    showRoads,

    // Setters
    setShowHeatmap,
    setShowImpactZones,
    setShowDisasterIcons,
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
    setAdminFillMode,
    setAdminMetricField,
    setAdminMetricMeaning,
    setAdminClassification,
    setAdminClassCount,
    setAdminNoDataStyle,
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
    setDrawerMode,
    toggleMapLayersDrawer,
    // Legacy toggle functions (for backward compatibility)
    toggleFacilityDrawer,
    toggleSitrepDrawer,
    toggleAnalysisDrawer,
    closeAllOverlays
  };
};
