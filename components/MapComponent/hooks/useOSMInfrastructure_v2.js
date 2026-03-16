/**
 * Custom hook for OSM infrastructure data management (v2 - Per-Category Loading)
 *
 * Key improvements over v1:
 * - Per-category state management (osmDataByCategory)
 * - Per-category loading states
 * - Per-category error handling
 * - Per-category localStorage caching
 * - fetchCategories() - load only selected categories
 * - Backwards compatible - still provides aggregate osmData
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

// Generate stable hash for boundary (for cache keys)
function generateBoundaryHash(boundary) {
  if (!boundary) return null;

  // Use JSON stringify for simplicity (could use more sophisticated hash)
  const str = JSON.stringify(boundary);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function useOSMInfrastructure() {
  // Per-category data storage
  const [osmDataByCategory, setOsmDataByCategory] = useState({});
  const [loadingByCategory, setLoadingByCategory] = useState({});
  const [errorByCategory, setErrorByCategory] = useState({});

  // Global state
  const [osmBoundary, setOsmBoundary] = useState(null);
  const [osmLayerVisibility, setOsmLayerVisibility] = useState({
    hospitals: true,
    schools: true,
    roads: true,
    water: true,
    power: true,
    fuel: true,
    pharmacies: true,
    bridges: true,
    airports: true,
  });
  const [showOSMLayer, setShowOSMLayer] = useState(true);

  // Track boundary hash for cache invalidation
  const boundaryHashRef = useRef(null);

  // Compute aggregate osmData (backwards compatible)
  const osmData = useMemo(() => {
    const allFeatures = Object.values(osmDataByCategory)
      .filter(Boolean)
      .flatMap(data => data.features || []);

    if (allFeatures.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features: allFeatures,
      metadata: {
        totalFeatures: allFeatures.length,
        byLayer: Object.fromEntries(
          Object.entries(osmDataByCategory)
            .filter(([_, data]) => data)
            .map(([cat, data]) => [cat, data.features?.length || 0])
        ),
        timestamp: new Date().toISOString(),
      }
    };
  }, [osmDataByCategory]);

  // Compute aggregate loading state
  const osmLoading = useMemo(() => {
    return Object.values(loadingByCategory).some(loading => loading);
  }, [loadingByCategory]);

  // Compute aggregate error state
  const osmError = useMemo(() => {
    const errors = Object.entries(errorByCategory)
      .filter(([_, err]) => err)
      .map(([cat, err]) => `${cat}: ${err}`);
    return errors.length > 0 ? errors.join('; ') : null;
  }, [errorByCategory]);

  // Compute aggregate stats
  const osmStats = useMemo(() => {
    return Object.fromEntries(
      Object.entries(osmDataByCategory)
        .filter(([_, data]) => data)
        .map(([cat, data]) => [cat, data.features?.length || 0])
    );
  }, [osmDataByCategory]);

  // Load per-category cache from localStorage on mount
  useEffect(() => {
    if (!osmBoundary) return;

    const hash = generateBoundaryHash(osmBoundary);
    boundaryHashRef.current = hash;

    try {
      // Load each category from localStorage
      const categories = ['hospitals', 'schools', 'roads', 'water', 'power', 'fuel', 'pharmacies', 'bridges', 'airports'];
      const loaded = {};

      categories.forEach(category => {
        const key = `osm_${hash}_${category}`;
        const cached = localStorage.getItem(key);

        if (cached) {
          const parsed = JSON.parse(cached);
          const age = Date.now() - new Date(parsed.timestamp).getTime();

          if (age < 24 * 60 * 60 * 1000) { // 24h
            loaded[category] = parsed.data;
          } else {
            localStorage.removeItem(key);
          }
        }
      });

      if (Object.keys(loaded).length > 0) {
        setOsmDataByCategory(loaded);
        console.log('Loaded OSM data from cache:', Object.keys(loaded));
      }
    } catch (err) {
      console.warn('Failed to load cached OSM data:', err);
    }
  }, [osmBoundary]);

  // Save per-category data to localStorage
  const saveCategoryToCache = useCallback((category, data) => {
    if (!osmBoundary || !data) return;

    const hash = generateBoundaryHash(osmBoundary);
    const key = `osm_${hash}_${category}`;

    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      console.warn(`Failed to cache ${category}:`, err);

      // Quota exceeded - try to clear oldest category
      if (err.name === 'QuotaExceededError') {
        const osmKeys = Object.keys(localStorage).filter(k => k.startsWith('osm_'));
        if (osmKeys.length > 0) {
          // Clear oldest
          const oldest = osmKeys
            .map(k => {
              try {
                const data = JSON.parse(localStorage.getItem(k));
                return { key: k, timestamp: new Date(data.timestamp).getTime() };
              } catch {
                return { key: k, timestamp: 0 };
              }
            })
            .sort((a, b) => a.timestamp - b.timestamp)[0];

          localStorage.removeItem(oldest.key);
          console.log(`Cleared old cache: ${oldest.key}`);

          // Retry
          try {
            localStorage.setItem(key, JSON.stringify({
              data,
              timestamp: new Date().toISOString(),
            }));
          } catch {
            console.warn('Still failed to cache after cleanup');
          }
        }
      }
    }
  }, [osmBoundary]);

  // Sanitize boundary to remove circular references
  const sanitizeBoundary = (boundary) => {
    if (!boundary) return null;

    // Handle already-sanitized GeoJSON geometry
    if (boundary.type && boundary.coordinates) {
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

    // Last resort: try to parse/stringify
    try {
      const str = JSON.stringify(boundary);
      return JSON.parse(str);
    } catch (err) {
      console.error('Failed to sanitize boundary - has circular references:', err);
      return null;
    }
  };

  // Fetch specific categories
  const fetchCategories = useCallback(async (categories, options = {}) => {
    if (!osmBoundary) {
      console.warn('No boundary set - cannot fetch OSM data');
      return;
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      console.warn('No categories specified');
      return;
    }

    // Sanitize boundary to remove circular references
    const cleanBoundary = sanitizeBoundary(osmBoundary);
    if (!cleanBoundary) {
      console.error('Invalid boundary format');
      return;
    }

    // Filter out already loaded categories (unless forceRefresh)
    const categoriesToFetch = options.forceRefresh
      ? categories
      : categories.filter(cat => !osmDataByCategory[cat]);

    if (categoriesToFetch.length === 0) {
      console.log('All requested categories already loaded');
      return;
    }

    console.log(`Fetching OSM categories: ${categoriesToFetch.join(', ')}`);

    // Set loading states
    const loadingStates = {};
    categoriesToFetch.forEach(cat => { loadingStates[cat] = true; });
    setLoadingByCategory(prev => ({ ...prev, ...loadingStates }));

    // Clear errors
    const clearedErrors = {};
    categoriesToFetch.forEach(cat => { clearedErrors[cat] = null; });
    setErrorByCategory(prev => ({ ...prev, ...clearedErrors }));

    try {
      const response = await fetch('/api/osm-infrastructure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boundary: cleanBoundary,
          layers: categoriesToFetch,
          options: {
            maxFeatures: 5000,
            includeMetadata: true,
            incremental: categoriesToFetch.length === 1,
            ...options
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error (${response.status}): ${errorText.substring(0, 100)}`;

        // Set error for all requested categories
        const errors = {};
        categoriesToFetch.forEach(cat => { errors[cat] = errorMsg; });
        setErrorByCategory(prev => ({ ...prev, ...errors }));

        console.error('OSM API error:', errorMsg);
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Split features by category
        const byCategory = {};
        result.data.features.forEach(feature => {
          const cat = feature.properties.category;
          if (!byCategory[cat]) {
            byCategory[cat] = {
              type: 'FeatureCollection',
              features: [],
              metadata: {
                category: cat,
                timestamp: result.data.metadata.timestamp,
              }
            };
          }
          byCategory[cat].features.push(feature);
        });

        // Update state for each category
        setOsmDataByCategory(prev => ({ ...prev, ...byCategory }));

        // Cache each category
        Object.entries(byCategory).forEach(([cat, data]) => {
          saveCategoryToCache(cat, data);
        });

        console.log('OSM categories loaded:', Object.keys(byCategory));
      } else {
        const errorMsg = result.error?.message || 'Unknown error';
        const errors = {};
        categoriesToFetch.forEach(cat => { errors[cat] = errorMsg; });
        setErrorByCategory(prev => ({ ...prev, ...errors }));

        console.error('OSM fetch error:', result.error);
      }
    } catch (err) {
      const errorMsg = err.message || 'Network error';
      const errors = {};
      categoriesToFetch.forEach(cat => { errors[cat] = errorMsg; });
      setErrorByCategory(prev => ({ ...prev, ...errors }));

      console.error('OSM fetch error:', err);
    } finally {
      // Clear loading states
      const clearedLoading = {};
      categoriesToFetch.forEach(cat => { clearedLoading[cat] = false; });
      setLoadingByCategory(prev => ({ ...prev, ...clearedLoading }));
    }
  }, [osmBoundary, osmDataByCategory, saveCategoryToCache]);

  // Fetch single category (convenience wrapper)
  const fetchCategory = useCallback((category, options = {}) => {
    return fetchCategories([category], options);
  }, [fetchCategories]);

  // Clear specific category
  const clearCategory = useCallback((category) => {
    setOsmDataByCategory(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });

    setErrorByCategory(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });

    // Clear from localStorage
    if (osmBoundary) {
      const hash = generateBoundaryHash(osmBoundary);
      const key = `osm_${hash}_${category}`;
      localStorage.removeItem(key);
    }

    console.log(`Cleared category: ${category}`);
  }, [osmBoundary]);

  // Clear all OSM data
  const clearOSM = useCallback(() => {
    setOsmDataByCategory({});
    setErrorByCategory({});
    setLoadingByCategory({});

    // Clear all localStorage entries for this boundary
    if (osmBoundary) {
      const hash = generateBoundaryHash(osmBoundary);
      const osmKeys = Object.keys(localStorage).filter(k => k.startsWith(`osm_${hash}_`));
      osmKeys.forEach(key => localStorage.removeItem(key));
    }

    console.log('OSM data cleared');
  }, [osmBoundary]);

  // Refresh category (force re-fetch)
  const refreshCategory = useCallback((category) => {
    return fetchCategory(category, { forceRefresh: true });
  }, [fetchCategory]);

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

  // Set boundary (and clear data if boundary changed)
  const setBoundary = useCallback((boundary) => {
    const newHash = generateBoundaryHash(boundary);
    const oldHash = boundaryHashRef.current;

    if (newHash !== oldHash) {
      console.log('Boundary changed, clearing OSM data');
      setOsmDataByCategory({});
      setErrorByCategory({});
      setLoadingByCategory({});
    }

    setOsmBoundary(boundary);
    boundaryHashRef.current = newHash;
  }, []);

  return {
    // Per-category state
    osmDataByCategory,
    loadingByCategory,
    errorByCategory,

    // Aggregate state (backwards compatible)
    osmData,
    osmLoading,
    osmError,
    osmStats,

    // Global state
    osmBoundary,
    osmLayerVisibility,
    showOSMLayer,

    // Actions - Category-specific
    fetchCategories,
    fetchCategory,
    clearCategory,
    refreshCategory,

    // Actions - Global
    clearOSM,
    toggleLayerVisibility,
    toggleAllOSM,
    setBoundary,
    setOsmLayerVisibility,
  };
}
