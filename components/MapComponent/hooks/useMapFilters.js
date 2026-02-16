import { useState, useCallback, useMemo } from 'react';
import { CAP_FILTERS } from '../constants/mapConstants';
import {
  getNormalizedSeverity,
  getNormalizedCertainty,
  getNormalizedUrgency
} from '../utils/disasterHelpers';

/**
 * Custom hook for managing all map filters
 * @param {Array} disasters - Array of disaster objects
 * @returns {Object} Filter state and handlers
 */
export const useMapFilters = (disasters = []) => {
  // Disaster type filters
  const [visibleDisasterTypes, setVisibleDisasterTypes] = useState({
    eq: true,
    tc: true,
    fl: true,
    vo: true,
    dr: true,
    wf: true,
    ts: true
  });

  // CAP filters
  const [severityFilters, setSeverityFilters] = useState({
    'Extreme': true,
    'Severe': true,
    'Moderate': true,
    'Minor': true,
    'Unknown': true
  });

  const [certaintyFilters, setCertaintyFilters] = useState({
    'Observed': true,
    'Likely': true,
    'Possible': true,
    'Unlikely': true,
    'Unknown': true
  });

  const [urgencyFilters, setUrgencyFilters] = useState({
    'Immediate': true,
    'Expected': true,
    'Future': true,
    'Past': true,
    'Unknown': true
  });

  // Timeline filter
  const [timelineFilteredDisasters, setTimelineFilteredDisasters] = useState(disasters);

  // Toggle functions
  const toggleDisasterType = useCallback((type) => {
    setVisibleDisasterTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  }, []);

  const toggleSeverityFilter = useCallback((severity) => {
    setSeverityFilters(prev => ({
      ...prev,
      [severity]: !prev[severity]
    }));
  }, []);

  const toggleCertaintyFilter = useCallback((certainty) => {
    setCertaintyFilters(prev => ({
      ...prev,
      [certainty]: !prev[certainty]
    }));
  }, []);

  const toggleUrgencyFilter = useCallback((urgency) => {
    setUrgencyFilters(prev => ({
      ...prev,
      [urgency]: !prev[urgency]
    }));
  }, []);

  // Handle timeline date change
  const handleTimelineChange = useCallback((date) => {
    if (!disasters || disasters.length === 0) return;

    const filtered = disasters.filter(disaster => {
      if (!disaster.pubDate) return false;
      const disasterDate = new Date(disaster.pubDate);
      return disasterDate <= date;
    });

    setTimelineFilteredDisasters(filtered);
  }, [disasters]);

  // Filter disasters based on all active filters
  const filteredDisasters = useMemo(() => {
    const disastersToFilter = timelineFilteredDisasters.length > 0
      ? timelineFilteredDisasters
      : disasters;

    return disastersToFilter.filter(disaster => {
      // Filter by disaster type
      const eventType = disaster.eventType?.toLowerCase();
      if (eventType && !visibleDisasterTypes[eventType]) {
        return false;
      }

      // Filter by severity
      const severity = getNormalizedSeverity(disaster);
      const severityKey = severity.charAt(0).toUpperCase() + severity.slice(1);
      if (!severityFilters[severityKey] && !severityFilters['Unknown']) {
        return false;
      }

      // Filter by certainty
      const certainty = getNormalizedCertainty(disaster);
      const certaintyKey = certainty.charAt(0).toUpperCase() + certainty.slice(1);
      if (!certaintyFilters[certaintyKey] && !certaintyFilters['Unknown']) {
        return false;
      }

      // Filter by urgency
      const urgency = getNormalizedUrgency(disaster);
      const urgencyKey = urgency.charAt(0).toUpperCase() + urgency.slice(1);
      if (!urgencyFilters[urgencyKey] && !urgencyFilters['Unknown']) {
        return false;
      }

      return true;
    });
  }, [
    disasters,
    timelineFilteredDisasters,
    visibleDisasterTypes,
    severityFilters,
    certaintyFilters,
    urgencyFilters
  ]);

  // Count disasters by alert level
  const alertLevelCounts = useMemo(() => {
    const counts = { red: 0, orange: 0, green: 0 };

    filteredDisasters.forEach(disaster => {
      const alertLevel = (disaster.alertLevel || disaster.severity || '').toLowerCase();
      if (alertLevel === 'red' || alertLevel === 'extreme' || alertLevel === 'severe') {
        counts.red++;
      } else if (alertLevel === 'orange' || alertLevel === 'moderate') {
        counts.orange++;
      } else if (alertLevel === 'green' || alertLevel === 'minor') {
        counts.green++;
      }
    });

    return counts;
  }, [filteredDisasters]);

  return {
    // State
    visibleDisasterTypes,
    severityFilters,
    certaintyFilters,
    urgencyFilters,
    timelineFilteredDisasters,
    filteredDisasters,
    alertLevelCounts,

    // Handlers
    toggleDisasterType,
    toggleSeverityFilter,
    toggleCertaintyFilter,
    toggleUrgencyFilter,
    handleTimelineChange,
    setTimelineFilteredDisasters
  };
};
