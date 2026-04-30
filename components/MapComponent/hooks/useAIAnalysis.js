import { useState, useCallback } from 'react';

/**
 * Custom hook for managing AI analysis functionality
 * @returns {Object} AI analysis state and handlers
 */
export const useAIAnalysis = () => {
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [analysisTimestamp, setAnalysisTimestamp] = useState(null);
  const [analysisCache, setAnalysisCache] = useState({});

  const handleAnalyzeFacility = useCallback(async (facility, disasters, options = {}) => {
    if (!facility) return;

    const forceRefresh = typeof options === 'boolean' ? options : Boolean(options.forceRefresh);
    const contextualInputs = typeof options === 'object' && options !== null ? options : {};
    const evidenceKey = Array.isArray(contextualInputs.enabledEvidenceLayers)
      ? [...contextualInputs.enabledEvidenceLayers].sort().join('|')
      : '';

    // Check cache first
    const cacheKey = `${facility.name}_${disasters?.length || 0}_${contextualInputs.activeMapLayerName || 'no-layer'}_${evidenceKey}`;
    if (!forceRefresh && analysisCache[cacheKey]) {
      console.log('Using cached analysis for:', facility.name);
      setSelectedFacility(facility);
      setAnalysisData(analysisCache[cacheKey].analysis);
      setIsAIGenerated(analysisCache[cacheKey].isAIGenerated);
      setAnalysisTimestamp(analysisCache[cacheKey].timestamp);
      return;
    }

    console.log('Analyzing facility:', facility.name, 'with', disasters?.length || 0, 'disasters');
    setSelectedFacility(facility);
    setAnalysisLoading(true);

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facility,
          impacts: disasters,
          acledData: contextualInputs.acledData || [],
          worldPopData: contextualInputs.worldPopData || {},
          selectedDistricts: contextualInputs.selectedDistricts || [],
          operationType: contextualInputs.operationType || 'general',
          nighttimeLightsLoaded: Boolean(contextualInputs.nighttimeLightsLoaded),
          enabledEvidenceLayers: contextualInputs.enabledEvidenceLayers || [],
          activeMapLayerName: contextualInputs.activeMapLayerName || null,
          activeMapLayerNote: contextualInputs.activeMapLayerNote || null
        })
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('Analysis request was too large for the deployed server');
        }
        throw new Error('Failed to analyze facility');
      }

      const data = await response.json();
      console.log('AI Analysis response:', data);

      const timestamp = Date.now();

      // Cache the analysis
      setAnalysisCache(prev => ({
        ...prev,
        [cacheKey]: {
          analysis: data.analysis,
          isAIGenerated: data.isAIGenerated,
          timestamp
        }
      }));

      setAnalysisData(data.analysis);  // Extract the analysis object
      setIsAIGenerated(data.isAIGenerated);
      setAnalysisTimestamp(timestamp);
    } catch (error) {
      console.error('Error analyzing facility:', error);
      setAnalysisData({
        error: error?.message === 'Analysis request was too large for the deployed server'
          ? 'The analysis request was too large for the deployed server. The request has been reduced in the app, but if this persists, narrow the analysis scope and try again.'
          : 'Failed to generate analysis. Please try again.'
      });
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    setSelectedFacility(null);
    setAnalysisData(null);
    setAnalysisLoading(false);
    setIsAIGenerated(false);
    setAnalysisTimestamp(null);
  }, []);

  return {
    // State
    selectedFacility,
    analysisData,
    analysisLoading,
    isAIGenerated,
    analysisTimestamp,

    // Handlers
    handleAnalyzeFacility,
    resetAnalysis,
    setSelectedFacility,
    setAnalysisData
  };
};
