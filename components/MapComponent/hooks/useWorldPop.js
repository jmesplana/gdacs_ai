import { useState, useCallback } from 'react';
import { calculateBounds } from '../../../utils/worldpopHelpers';

export function useWorldPop() {
  // { [districtId]: { total, ageGroups } }
  const [worldPopData, setWorldPopData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchParams, setLastFetchParams] = useState(null); // { year, dataType }
  const [showWorldPopLayer, setShowWorldPopLayer] = useState(false);
  const [activeLayerType, setActiveLayerType] = useState('population1km');
  const [geeTileUrl, setGeeTileUrl] = useState(null); // GEE tile URL for raster visualization
  const [scopeToShapefile, setScopeToShapefile] = useState(true); // Whether to limit to shapefile bounds or show globally

  const fetchWorldPopData = useCallback(async (districts, year, dataType) => {
    if (!districts || districts.length === 0) {
      setError('No districts available. Please upload a shapefile first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Only send geometry + id + name to keep payload small
    const districtPayload = districts.map((d) => ({
      id: d.id,
      name: d.name,
      geometry: d.geometry,
    }));

    try {
      // Fetch district-level statistics
      const statsResponse = await fetch('/api/worldpop-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districts: districtPayload, year, dataType }),
      });

      const statsData = await statsResponse.json();

      if (!statsResponse.ok) {
        throw new Error(statsData.error || 'Failed to fetch population data');
      }

      // Index results by districtId
      const indexed = {};
      for (const result of statsData.results || []) {
        indexed[result.districtId] = {
          total: result.total,
          ageGroups: result.ageGroups || null,
        };
      }

      setWorldPopData(indexed);
      setLastFetchParams({ year, dataType });

      // Calculate bounds from districts (only if scoped)
      const bounds = scopeToShapefile ? calculateBounds(districts) : null;
      if (bounds) {
        console.log('[useWorldPop] District bounds (scoped to shapefile):', bounds);
      } else {
        console.log('[useWorldPop] No bounds restriction - showing global data');
      }

      // Fetch GEE tile URL for raster visualization
      console.log('[useWorldPop] Fetching GEE tile URL...');
      const tilesResponse = await fetch('/api/worldpop-tiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, dataType, bounds: scopeToShapefile ? bounds : null }),
      });

      const tilesData = await tilesResponse.json();

      if (tilesResponse.ok && tilesData.tileUrl) {
        console.log('[useWorldPop] GEE tile URL received:', tilesData.tileUrl);
        setGeeTileUrl(tilesData.tileUrl);
      } else {
        console.warn('[useWorldPop] Failed to get GEE tile URL:', tilesData.error);
      }

    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [scopeToShapefile]);

  const clearWorldPopData = useCallback(() => {
    setWorldPopData({});
    setError(null);
    setLastFetchParams(null);
    setShowWorldPopLayer(false);
    setGeeTileUrl(null);
    setScopeToShapefile(true);
  }, []);

  const toggleWorldPopLayer = useCallback(() => {
    setShowWorldPopLayer((prev) => {
      console.log('[WorldPop] Toggling layer visibility:', !prev);
      return !prev;
    });
  }, []);

  const toggleScopeToShapefile = useCallback(() => {
    setScopeToShapefile((prev) => !prev);
  }, []);

  return {
    worldPopData,
    isLoading,
    error,
    lastFetchParams,
    showWorldPopLayer,
    activeLayerType,
    setActiveLayerType,
    toggleWorldPopLayer,
    fetchWorldPopData,
    clearWorldPopData,
    geeTileUrl, // Export the GEE tile URL
    scopeToShapefile,
    toggleScopeToShapefile,
  };
}
