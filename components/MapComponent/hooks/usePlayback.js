import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for managing timeline playback functionality
 * Handles play/pause, date scrubbing, speed controls, and temporal filtering
 */
const usePlayback = (disasters = [], acledData = []) => {
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [dateRange, setDateRange] = useState({ minDate: null, maxDate: null });

  const playbackIntervalRef = useRef(null);

  // Calculate date range from disasters and ACLED data
  useEffect(() => {
    const allDates = [];

    console.log('Playback: Processing disasters:', disasters?.length || 0);
    console.log('Playback: Processing ACLED:', acledData?.length || 0);

    // Log first disaster to see what fields are available
    if (disasters && disasters.length > 0) {
      console.log('Playback: First disaster object:', disasters[0]);
      console.log('Playback: Available keys:', Object.keys(disasters[0]));
    }

    // Get dates from disasters - try multiple date fields
    disasters?.forEach((disaster, idx) => {
      let dateStr = null;

      // Try different date field names (GDACS uses 'pubDate' with capital D)
      if (disaster.pubDate) {
        dateStr = disaster.pubDate;
      } else if (disaster.fromdate) {
        dateStr = disaster.fromdate;
      } else if (disaster.pubdate) {
        dateStr = disaster.pubdate;
      } else if (disaster.todate) {
        dateStr = disaster.todate;
      } else if (disaster.date) {
        dateStr = disaster.date;
      }

      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          allDates.push(date);
          if (idx === 0) console.log('Playback: Successfully parsed date:', dateStr, '→', date);
        } else {
          if (idx === 0) console.log('Playback: Invalid disaster date format:', dateStr);
        }
      }
    });

    // Get dates from ACLED events
    acledData?.forEach((event, idx) => {
      let dateStr = null;

      if (event.event_date) {
        dateStr = event.event_date;
      } else if (event.date) {
        dateStr = event.date;
      }

      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          allDates.push(date);
        } else {
          if (idx === 0) console.log('Playback: Invalid ACLED date format:', dateStr);
        }
      } else {
        if (idx === 0) console.log('Playback: Sample ACLED object:', event);
      }
    });

    console.log('Playback: Total valid dates found:', allDates.length);
    console.log('Playback: Disaster dates found:', disasters?.filter(d => d.pubDate).length || 0);
    console.log('Playback: ACLED dates found:', acledData?.filter(a => a.event_date).length || 0);

    if (allDates.length > 0) {
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));

      console.log('Playback: Date range:', minDate.toISOString(), 'to', maxDate.toISOString());
      console.log('Playback: Min date:', minDate.toLocaleDateString());
      console.log('Playback: Max date:', maxDate.toLocaleDateString());

      setDateRange({
        minDate: minDate.toISOString().split('T')[0],
        maxDate: maxDate.toISOString().split('T')[0]
      });

      // Set initial current date to min date
      if (!currentDate) {
        setCurrentDate(minDate.toISOString().split('T')[0]);
      }
    } else {
      console.warn('Playback: No valid dates found in data!');
    }
  }, [disasters, acledData, currentDate]); // Added currentDate to dependencies, but with conditional check inside

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

      // Handle different date field names (GDACS uses pubDate with capital D)
      if (item.pubDate) {
        itemDate = new Date(item.pubDate);
      } else if (item[dateField]) {
        itemDate = new Date(item[dateField]);
      } else if (item.event_date) {
        itemDate = new Date(item.event_date);
      } else if (item.fromdate) {
        itemDate = new Date(item.fromdate);
      } else if (item.pubdate) {
        itemDate = new Date(item.pubdate);
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

    // Log filtering results periodically
    if (Math.random() < 0.1) { // Only log 10% of the time to avoid spam
      console.log(`Playback filter: ${items?.length || 0} items → ${filtered.length} filtered (date: ${currentDate}, field: ${dateField})`);
    }

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
