/**
 * Custom hook for logistics assessment
 * Only triggers when districts/shapefile are uploaded (same behavior as OSM integration)
 * Requires: osmData, disasters
 */

import { useState, useCallback } from 'react';

export function useLogisticsAssessment() {
  const [logisticsData, setLogisticsData] = useState(null);
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  const [logisticsError, setLogisticsError] = useState(null);
  const [showLogisticsLayer, setShowLogisticsLayer] = useState(false);
  const [logisticsLayerVisibility, setLogisticsLayerVisibility] = useState({
    roads: true,
    bridges: true,
    fuel: true,
    airports: true
  });

  /**
   * Perform logistics assessment
   * @param {Object} osmData - OSM infrastructure data (from useOSMInfrastructure)
   * @param {Array} disasters - Active disasters (GDACS)
   * @param {Array} facilities - Optional user-uploaded facilities
   * @param {Array} acledEvents - Optional ACLED security incidents
   * @param {Object} options - Optional origin/destination for route analysis
   */
  const assessLogistics = useCallback(async (osmData, disasters, facilities = [], acledEvents = [], options = {}) => {
    console.log('🚚 assessLogistics called with:', {
      hasOsmData: !!osmData,
      disastersCount: disasters?.length || 0,
      facilitiesCount: facilities?.length || 0,
      acledEventsCount: acledEvents?.length || 0,
      options
    });

    // Validate required inputs - MUST have OSM data (disasters are optional for baseline assessment)
    if (!osmData || !osmData.features || osmData.features.length === 0) {
      console.error('❌ No OSM data available. Upload a shapefile/district to load infrastructure data first.');
      setLogisticsError('No infrastructure data available. Please upload a district shapefile first.');
      return null;
    }

    // Allow assessment even without disasters (shows baseline logistics status)
    const hasDisasters = disasters && disasters.length > 0;
    if (!hasDisasters) {
      console.log('⚠️ No disasters provided - running baseline logistics assessment');
    }

    setLogisticsLoading(true);
    setLogisticsError(null);

    try {
      console.log('✅ Starting logistics assessment...');
      console.log('📊 OSM features:', osmData.features.length);
      console.log('🌪️ Disasters:', hasDisasters ? disasters.length : 0);

      // Add timeout to fetch request (30 seconds for logistics assessment)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/logistics-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          osmData,
          disasters,
          facilities,
          acledEvents,
          options
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg;

        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || `API error (${response.status})`;
        } catch {
          errorMsg = `API error (${response.status}): ${errorText.substring(0, 100)}`;
        }

        setLogisticsError(errorMsg);
        console.error('❌ Logistics API error:', errorMsg);
        return null;
      }

      const result = await response.json();
      console.log('📦 API response:', { success: result.success, hasData: !!result.data });

      if (result.success && result.data) {
        console.log('✅ Logistics assessment completed successfully');
        console.log('📊 Access Score:', result.data.accessScore);
        console.log('📈 Rating:', result.data.rating);
        console.log('🛣️ Roads analyzed:', result.data.roadNetwork?.totalRoads || 0);
        console.log('⛽ Fuel stations:', result.data.fuelAccess?.totalStations || 0);
        console.log('✈️ Airports:', result.data.airAccess?.totalAirports || 0);

        setLogisticsData(result.data);
        setShowLogisticsLayer(true); // Auto-show layer when data is loaded

        console.log('💾 Logistics state updated');
        return result.data;
      } else {
        const errorMsg = result.error || 'Unknown error during logistics assessment';
        setLogisticsError(errorMsg);
        console.error('❌ Logistics assessment error:', errorMsg);
        return null;
      }
    } catch (err) {
      let errorMsg = 'Failed to perform logistics assessment';

      if (err.name === 'AbortError') {
        errorMsg = 'Request timeout - logistics assessment took too long (>30s)';
        console.error('⏱️ Logistics assessment timeout');
      } else {
        console.error('❌ Logistics assessment error:', err);
        console.error('❌ Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
      }

      setLogisticsError(errorMsg);
      return null;
    } finally {
      console.log('🏁 Assessment completed, setting loading to false');
      setLogisticsLoading(false);
    }
  }, []);

  /**
   * Assess logistics with route analysis (origin → destination)
   * @param {Object} osmData - OSM infrastructure data
   * @param {Array} disasters - Active disasters
   * @param {Array} origin - [lat, lon] starting point
   * @param {Array} destination - [lat, lon] destination point
   * @param {Array} facilities - Optional facilities
   * @param {Array} acledEvents - Optional ACLED events
   */
  const assessLogisticsWithRoute = useCallback(async (osmData, disasters, origin, destination, facilities = [], acledEvents = []) => {
    return assessLogistics(osmData, disasters, facilities, acledEvents, {
      origin,
      destination
    });
  }, [assessLogistics]);

  // Clear logistics data
  const clearLogistics = useCallback(() => {
    setLogisticsData(null);
    setLogisticsError(null);
    setShowLogisticsLayer(false);
    console.log('🧹 Logistics data cleared');
  }, []);

  // Toggle layer visibility
  const toggleLogisticsLayerVisibility = useCallback((layer) => {
    setLogisticsLayerVisibility(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  }, []);

  // Toggle all logistics layers
  const toggleAllLogistics = useCallback(() => {
    setShowLogisticsLayer(prev => !prev);
  }, []);

  // Retry assessment (useful for error recovery)
  const retryAssessment = useCallback((osmData, disasters, facilities, acledEvents, options) => {
    console.log('🔄 Retrying logistics assessment...');
    return assessLogistics(osmData, disasters, facilities, acledEvents, options);
  }, [assessLogistics]);

  return {
    // State
    logisticsData,
    logisticsLoading,
    logisticsError,
    showLogisticsLayer,
    logisticsLayerVisibility,

    // Actions
    assessLogistics,
    assessLogisticsWithRoute,
    clearLogistics,
    toggleLogisticsLayerVisibility,
    toggleAllLogistics,
    retryAssessment,
    setShowLogisticsLayer,
    setLogisticsLayerVisibility
  };
}
