import { useState, useCallback } from 'react';

export function useWorldPop() {
  // { [districtId]: { total, ageGroups } }
  const [worldPopData, setWorldPopData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchParams, setLastFetchParams] = useState(null); // { year, dataType }
  const [showWorldPopLayer, setShowWorldPopLayer] = useState(false);
  const [activeLayerType, setActiveLayerType] = useState('population1km');

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
      const response = await fetch('/api/worldpop-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districts: districtPayload, year, dataType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch population data');
      }

      // Index results by districtId
      const indexed = {};
      for (const result of data.results || []) {
        indexed[result.districtId] = {
          total: result.total,
          ageGroups: result.ageGroups || null,
        };
      }

      setWorldPopData(indexed);
      setLastFetchParams({ year, dataType });
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearWorldPopData = useCallback(() => {
    setWorldPopData({});
    setError(null);
    setLastFetchParams(null);
    setShowWorldPopLayer(false);
  }, []);

  const toggleWorldPopLayer = useCallback(() => {
    setShowWorldPopLayer((prev) => !prev);
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
  };
}
