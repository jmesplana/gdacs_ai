/**
 * Custom hook for OSM infrastructure data management
 * Handles fetching, caching, and state management
 */

import { useState, useCallback, useEffect, useRef } from 'react';

function areBoundariesEqual(boundaryA, boundaryB) {
  if (!boundaryA || !boundaryB) return false;

  try {
    return JSON.stringify(boundaryA) === JSON.stringify(boundaryB);
  } catch (_) {
    return false;
  }
}

function mergeOsmData(existingData, incomingData) {
  if (!existingData) return incomingData;
  if (!incomingData) return existingData;

  const combinedFeatures = [...(existingData.features || [])];
  const seenKeys = new Set(
    combinedFeatures.map(feature => `${feature.properties?.category || 'unknown'}:${feature.properties?.id || feature.properties?.osm_id || feature.id || JSON.stringify(feature.geometry)}`)
  );

  (incomingData.features || []).forEach(feature => {
    const featureKey = `${feature.properties?.category || 'unknown'}:${feature.properties?.id || feature.properties?.osm_id || feature.id || JSON.stringify(feature.geometry)}`;
    if (!seenKeys.has(featureKey)) {
      seenKeys.add(featureKey);
      combinedFeatures.push(feature);
    }
  });

  const existingLayers = existingData.metadata?.byLayer || {};
  const incomingLayers = incomingData.metadata?.byLayer || {};
  const existingRequestedLayers = existingData.metadata?.requestedLayers || [];
  const incomingRequestedLayers = incomingData.metadata?.requestedLayers || [];

  return {
    ...incomingData,
    features: combinedFeatures,
    metadata: {
      ...(existingData.metadata || {}),
      ...(incomingData.metadata || {}),
      totalFeatures: combinedFeatures.length,
      byLayer: {
        ...existingLayers,
        ...incomingLayers
      },
      requestedLayers: Array.from(new Set([
        ...existingRequestedLayers,
        ...incomingRequestedLayers
      ]))
    }
  };
}

function removeOsmCategoryData(existingData, categoryId) {
  if (!existingData) return null;

  const remainingFeatures = (existingData.features || []).filter(
    feature => feature.properties?.category !== categoryId
  );
  const existingLayers = existingData.metadata?.byLayer || {};
  const nextByLayer = { ...existingLayers };
  delete nextByLayer[categoryId];

  const nextRequestedLayers = (existingData.metadata?.requestedLayers || []).filter(
    layer => layer !== categoryId
  );

  if (remainingFeatures.length === 0) {
    return null;
  }

  return {
    ...existingData,
    features: remainingFeatures,
    metadata: {
      ...(existingData.metadata || {}),
      totalFeatures: remainingFeatures.length,
      byLayer: nextByLayer,
      requestedLayers: nextRequestedLayers
    }
  };
}

export function useOSMInfrastructure() {
  const [osmData, setOsmData] = useState(null);
  const [osmLoading, setOsmLoading] = useState(false);
  const [osmError, setOsmError] = useState(null);
  const [osmStats, setOsmStats] = useState(null);
  const [osmTimestamp, setOsmTimestamp] = useState(null);
  const [osmBoundary, setOsmBoundary] = useState(null);
  const [osmWarning, setOsmWarning] = useState(null);
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
  const osmDataRef = useRef(null);
  const osmBoundaryRef = useRef(null);

  useEffect(() => {
    osmDataRef.current = osmData;
  }, [osmData]);

  useEffect(() => {
    osmBoundaryRef.current = osmBoundary;
  }, [osmBoundary]);

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
          setOsmWarning(parsed.warning || parsed.data?.metadata?.warnings?.join(' ') || null);
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
          boundary: osmBoundary,
          warning: osmWarning
        }));
      } catch (err) {
        console.warn('Failed to cache OSM data:', err);
        // Quota exceeded - clear old data
        localStorage.removeItem('osmData');
      }
    }
  }, [osmData, osmStats, osmTimestamp, osmBoundary, osmWarning]);

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
    setOsmWarning(null);

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

        const currentOsmData = osmDataRef.current;
        const currentBoundary = osmBoundaryRef.current;
        const shouldMergeWithExisting =
          Boolean(options.mergeWithExisting) || (
            selectedCategories &&
            Array.isArray(selectedCategories) &&
            selectedCategories.length > 0 &&
            currentOsmData &&
            areBoundariesEqual(currentBoundary, cleanBoundary)
          );

        const nextData = shouldMergeWithExisting
          ? mergeOsmData(currentOsmData, result.data)
          : result.data;

        setOsmData(nextData);
        setOsmStats(nextData.metadata.byLayer);
        setOsmTimestamp(nextData.metadata.timestamp);
        setOsmBoundary(shouldMergeWithExisting && currentBoundary ? currentBoundary : cleanBoundary);
        setOsmWarning(result.warning || result.data?.metadata?.warnings?.join(' ') || null);

        console.log('💾 OSM state updated');
        return nextData;
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
      return fetchOSMInfrastructure(osmBoundary, null, { forceRefresh });
    }
  }, [osmBoundary, fetchOSMInfrastructure]);

  // Clear OSM data
  const clearOSM = useCallback(() => {
    setOsmData(null);
    setOsmStats(null);
    setOsmTimestamp(null);
    setOsmBoundary(null);
    setOsmError(null);
    setOsmWarning(null);
    osmDataRef.current = null;
    osmBoundaryRef.current = null;
    localStorage.removeItem('osmData');
    console.log('OSM data cleared');
  }, []);

  const clearOSMCategory = useCallback((categoryId) => {
    if (!categoryId) return;

    setOsmData(prev => {
      const nextData = removeOsmCategoryData(prev, categoryId);

      if (!nextData) {
        setOsmStats(null);
        setOsmTimestamp(null);
        setOsmBoundary(null);
        setOsmWarning(null);
        osmDataRef.current = null;
        osmBoundaryRef.current = null;
        localStorage.removeItem('osmData');
        return null;
      }

      setOsmStats(nextData.metadata?.byLayer || null);
      setOsmTimestamp(nextData.metadata?.timestamp || null);
      setOsmWarning(nextData.metadata?.warnings?.join(' ') || null);
      osmDataRef.current = nextData;
      return nextData;
    });

    setOsmLayerVisibility(prev => ({
      ...prev,
      [categoryId]: true
    }));
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
    osmWarning,
    osmLayers,
    osmLayerVisibility,
    showOSMLayer,

    // Actions
    fetchOSMInfrastructure,
    refreshOSM,
    clearOSM,
    clearOSMCategory,
    toggleLayer,
    toggleLayerVisibility,
    toggleAllOSM,
    setOsmLayers,
    setOsmLayerVisibility,
  };
}
