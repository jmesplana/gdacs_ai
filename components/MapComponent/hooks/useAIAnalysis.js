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

  const handleAnalyzeFacility = useCallback(async (facility, disasters, forceRefresh = false) => {
    if (!facility) return;

    // Check cache first
    const cacheKey = `${facility.name}_${disasters?.length || 0}`;
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
          impacts: disasters
        })
      });

      if (!response.ok) {
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
        error: 'Failed to generate analysis. Please try again.'
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
