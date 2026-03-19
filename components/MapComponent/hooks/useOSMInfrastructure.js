/**
 * Custom hook for OSM infrastructure data management
 * Handles fetching, caching, and state management
 */

import { useState, useCallback, useEffect } from 'react';

export function useOSMInfrastructure() {
  const [osmData, setOsmData] = useState(null);
  const [osmLoading, setOsmLoading] = useState(false);
  const [osmError, setOsmError] = useState(null);
  const [osmStats, setOsmStats] = useState(null);
  const [osmTimestamp, setOsmTimestamp] = useState(null);
  const [osmBoundary, setOsmBoundary] = useState(null);
  const [osmLayers, setOsmLayers] = useState([
    'hospitals',
    'schools',
    'roads',
    'bridges',
    'water',
    'power',
    'fuel',
    'pharmacies',
    'airports'
  ]);
  const [osmLayerVisibility, setOsmLayerVisibility] = useState({
    hospital: true,
    clinic: true,
    school: true,
    road: true,
    water: true,
    power: true,
    fuel: true,
    pharmacy: true,
    bridge: true,
    airport: true,
  });
  const [showOSMLayer, setShowOSMLayer] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('osmData');
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - new Date(parsed.timestamp).getTime();

        if (age < 24 * 60 * 60 * 1000) { // 24h
          setOsmData(parsed.data);
          setOsmStats(parsed.stats);
          setOsmTimestamp(parsed.timestamp);
          setOsmBoundary(parsed.boundary);
          console.log('Loaded OSM data from cache:', parsed.stats);
        } else {
          localStorage.removeItem('osmData');
        }
      }
    } catch (err) {
      console.warn('Failed to load cached OSM data:', err);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    if (osmData) {
      try {
        localStorage.setItem('osmData', JSON.stringify({
          data: osmData,
          stats: osmStats,
          timestamp: osmTimestamp,
          boundary: osmBoundary
        }));
      } catch (err) {
        console.warn('Failed to cache OSM data:', err);
        // Quota exceeded - clear old data
        localStorage.removeItem('osmData');
      }
    }
  }, [osmData, osmStats, osmTimestamp, osmBoundary]);

  // Sanitize boundary to remove circular references
  const sanitizeBoundary = (boundary) => {
    if (!boundary) return null;

    // Handle already-sanitized GeoJSON
    if (boundary.type && boundary.coordinates) {
      // It's a GeoJSON geometry - make a clean copy
      return {
        type: boundary.type,
        coordinates: boundary.coordinates
      };
    }

    // Handle GeoJSON Feature
    if (boundary.type === 'Feature' && boundary.geometry) {
      return {
        type: boundary.geometry.type,
        coordinates: boundary.geometry.coordinates
      };
    }

    // Last resort: try to parse/stringify (will fail if circular)
    try {
      const str = JSON.stringify(boundary);
      return JSON.parse(str);
    } catch (err) {
      console.error('Failed to sanitize boundary - has circular references:', err);
      console.log('Boundary object:', boundary);
      return null;
    }
  };

  // Fetch OSM infrastructure
  const fetchOSMInfrastructure = useCallback(async (boundary, selectedCategories = null, options = {}) => {
    console.log('🔵 fetchOSMInfrastructure called with:', {
      boundaryProvided: !!boundary,
      selectedCategories,
      options
    });

    if (!boundary) {
      console.error('❌ No boundary provided');
      setOsmError('No boundary provided');
      return;
    }

    // Sanitize boundary to remove circular references
    const cleanBoundary = sanitizeBoundary(boundary);
    if (!cleanBoundary) {
      console.error('❌ Invalid boundary format');
      setOsmError('Invalid boundary format');
      return;
    }

    // Use selected categories if provided, otherwise use all osmLayers
    const layersToFetch = selectedCategories || osmLayers;

    setOsmLoading(true);
    setOsmError(null);

    try {
      console.log('✅ Fetching OSM infrastructure for boundary:', cleanBoundary);
      console.log('✅ Categories to fetch:', layersToFetch);

      // Add timeout to fetch request (60 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/osm-infrastructure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boundary: cleanBoundary,
          layers: layersToFetch,
          options: {
            maxFeatures: 5000,
            includeMetadata: true,
            ...options
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error (${response.status}): ${errorText.substring(0, 100)}`;
        setOsmError(errorMsg);
        console.error('❌ OSM API error:', errorMsg);
        return null;
      }

      const result = await response.json();
      console.log('📦 API response:', { success: result.success, hasData: !!result.data });

      if (result.success) {
        console.log('✅ OSM data loaded successfully:', result.data.metadata);
        console.log('📊 Features by category:', result.data.metadata.byLayer);
        console.log('📍 Total features:', result.data.features.length);
        console.log('🔍 Sample features:', result.data.features.slice(0, 5).map(f => ({
          category: f.properties.category,
          name: f.properties.name || f.properties.tags?.name,
          tags: f.properties.tags
        })));

        setOsmData(result.data);
        setOsmStats(result.data.metadata.byLayer);
        setOsmTimestamp(result.data.metadata.timestamp);
        setOsmBoundary(cleanBoundary); // Use sanitized boundary

        console.log('💾 OSM state updated');
        return result.data;
      } else {
        setOsmError(result.error?.message || 'Unknown error');
        console.error('❌ OSM fetch error:', result.error);
        return null;
      }
    } catch (err) {
      let errorMsg = 'Failed to fetch OSM infrastructure data';

      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout - OSM data fetch took too long (>60s)';
        console.error('⏱️ OSM fetch timeout');
      } else {
        console.error('❌ OSM fetch error:', err);
        console.error('❌ Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
      }

      setOsmError(errorMsg);
      return null;
    } finally {
      console.log('🏁 Fetch completed, setting loading to false');
      setOsmLoading(false);
    }
  }, [osmLayers]);

  // Refresh with current boundary
  const refreshOSM = useCallback((forceRefresh = false) => {
    if (osmBoundary) {
      return fetchOSMInfrastructure(osmBoundary, { forceRefresh });
    }
  }, [osmBoundary, fetchOSMInfrastructure]);

  // Clear OSM data
  const clearOSM = useCallback(() => {
    setOsmData(null);
    setOsmStats(null);
    setOsmTimestamp(null);
    setOsmBoundary(null);
    setOsmError(null);
    localStorage.removeItem('osmData');
    console.log('OSM data cleared');
  }, []);

  // Toggle layer in query
  const toggleLayer = useCallback((layer) => {
    setOsmLayers(prev => {
      if (prev.includes(layer)) {
        return prev.filter(l => l !== layer);
      } else {
        return [...prev, layer];
      }
    });
  }, []);

  // Toggle layer visibility on map
  const toggleLayerVisibility = useCallback((layer) => {
    setOsmLayerVisibility(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  }, []);

  // Toggle all OSM layers
  const toggleAllOSM = useCallback(() => {
    setShowOSMLayer(prev => !prev);
  }, []);

  return {
    // State
    osmData,
    osmLoading,
    osmError,
    osmStats,
    osmTimestamp,
    osmBoundary,
    osmLayers,
    osmLayerVisibility,
    showOSMLayer,

    // Actions
    fetchOSMInfrastructure,
    refreshOSM,
    clearOSM,
    toggleLayer,
    toggleLayerVisibility,
    toggleAllOSM,
    setOsmLayers,
    setOsmLayerVisibility,
  };
}
