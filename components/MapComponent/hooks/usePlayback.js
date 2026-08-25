import { useState, useEffect, useRef, useCallback } from 'react';
import { getDisasterTimelineDate } from '../utils/disasterHelpers';

/**
 * Hook for managing timeline playback functionality
 * Handles play/pause, date scrubbing, speed controls, and temporal filtering
 */
const usePlayback = (disasters = [], acledData = [], outbreaks = []) => {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [dateRange, setDateRange] = useState({ minDate: null, maxDate: null });

  const playbackIntervalRef = useRef(null);

  // Calculate date range from disasters and ACLED data
  useEffect(() => {
    const disasterCount = disasters?.length || 0;
    const acledCount = acledData?.length || 0;
    const outbreakCount = outbreaks?.length || 0;

    const allDates = [];

    // Initial app load often mounts playback before async data arrives.
    // Treat that as a neutral empty state rather than a warning condition.
    if (disasterCount === 0 && acledCount === 0 && outbreakCount === 0) {
      setDateRange({ minDate: null, maxDate: null });
      if (!playbackEnabled) {
        setCurrentDate(null);
      }
      return;
    }

    // Get dates from disasters using the same date precedence as the top-level filter.
    disasters?.forEach((disaster) => {
      const date = getDisasterTimelineDate(disaster);
      if (date) {
        allDates.push(date);
      }
    });

    // Get dates from ACLED events
    acledData?.forEach((event) => {
      const dateStr = event.event_date || event.date || null;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          allDates.push(date);
        }
      }
    });

    outbreaks?.forEach((outbreak) => {
      const dateStr = outbreak.filterDate || outbreak.updatedDate || outbreak.reportDate || outbreak.date;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          allDates.push(date);
        }
      }
    });

    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));

      setDateRange({
        minDate: minDate.toISOString().split('T')[0],
        maxDate: maxDate.toISOString().split('T')[0]
      });

      // Set initial current date to min date
      if (!currentDate) {
        setCurrentDate(minDate.toISOString().split('T')[0]);
      }
    } else {
      console.warn('Playback: No valid dates found in non-empty data set!');
    }
  }, [disasters, acledData, outbreaks, currentDate, playbackEnabled]); // Added currentDate to dependencies, but with conditional check inside

  // Auto-advance playback
  useEffect(() => {
    if (isPlaying && currentDate && dateRange.maxDate) {
      const advanceDate = () => {
        const current = new Date(currentDate);
        const max = new Date(dateRange.maxDate);

        if (current >= max) {
          // Reached the end, stop playing
          setIsPlaying(false);
          return;
        }

        // Advance by 1 day
        current.setDate(current.getDate() + 1);
        setCurrentDate(current.toISOString().split('T')[0]);
      };

      // Calculate interval based on speed (1x = 1 second per day)
      const interval = 1000 / playbackSpeed;
      playbackIntervalRef.current = setInterval(advanceDate, interval);

      return () => {
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
        }
      };
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }
  }, [isPlaying, currentDate, dateRange.maxDate, playbackSpeed]);

  // Toggle playback mode
  const togglePlayback = useCallback(() => {
    setPlaybackEnabled(prev => {
      const newState = !prev;
      if (!newState) {
        // Stopped playback mode, reset everything
        setIsPlaying(false);
        if (dateRange.minDate) {
          setCurrentDate(dateRange.minDate);
        }
      } else {
        // Enabled playback mode, initialize to min date
        if (dateRange.minDate) {
          setCurrentDate(dateRange.minDate);
        }
      }
      return newState;
    });
  }, [dateRange.minDate]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Change playback speed
  const changeSpeed = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  // Jump to specific date
  const jumpToDate = useCallback((date) => {
    setCurrentDate(date);
  }, []);

  // Filter disasters by current playback date
  const filterByPlaybackDate = useCallback((items, dateField = 'pubDate') => {
    if (!playbackEnabled || !currentDate) {
      return items;
    }

    const playbackDate = new Date(currentDate);
    playbackDate.setHours(23, 59, 59, 999); // End of the playback day

    const windowDays = 30; // Show events from the past 30 days (trailing window)

    const filtered = items?.filter(item => {
      let itemDate = null;

      if (item[dateField]) {
        itemDate = new Date(item[dateField]);
      } else if (item.event_date) {
        itemDate = new Date(item.event_date);
      } else {
        itemDate = getDisasterTimelineDate(item);
      }

      if (!itemDate || isNaN(itemDate.getTime())) {
        return false;
      }

      // Show only events that have occurred up to the current playback date
      // With a trailing window (show events from the past X days)
      const daysDiff = Math.floor((playbackDate - itemDate) / (1000 * 60 * 60 * 24));

      // Show events that occurred in the past up to windowDays ago
      return daysDiff >= 0 && daysDiff <= windowDays;
    }) || [];

    return filtered;
  }, [playbackEnabled, currentDate]);

  return {
    playbackEnabled,
    isPlaying,
    currentDate,
    playbackSpeed,
    dateRange,
    togglePlayback,
    togglePlayPause,
    changeSpeed,
    jumpToDate,
    filterByPlaybackDate
  };
};

export default usePlayback;
