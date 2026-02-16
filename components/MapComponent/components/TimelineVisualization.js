import { useState, useMemo, useRef, useEffect } from 'react';

// Timeline component for disaster progression
const TimelineVisualization = ({ disasters, onTimeChange }) => {
  const [timelinePosition, setTimelinePosition] = useState(100); // Default to 100% (present)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef(null);

  // Extract dates and sort them
  const timelineDates = useMemo(() => {
    if (!disasters || disasters.length === 0) return [];

    return disasters
      .filter(d => d.pubDate)
      .map(d => new Date(d.pubDate))
      .sort((a, b) => a - b);
  }, [disasters]);

  // Get earliest and latest dates
  const earliestDate = useMemo(() =>
    timelineDates.length > 0 ? timelineDates[0] : new Date(),
    [timelineDates]);

  const latestDate = useMemo(() =>
    timelineDates.length > 0 ? timelineDates[timelineDates.length - 1] : new Date(),
    [timelineDates]);

  // Calculate current date based on timeline position
  const currentDate = useMemo(() => {
    if (timelineDates.length === 0) return new Date();

    // Calculate date based on position percentage
    const timeSpan = latestDate - earliestDate;
    const timeOffset = timeSpan * (timelinePosition / 100);
    return new Date(earliestDate.getTime() + timeOffset);
  }, [earliestDate, latestDate, timelinePosition, timelineDates]);

  // Handle slider change
  const handleTimelineChange = (e) => {
    // Stop event propagation to prevent map dragging
    e.stopPropagation();

    const newPosition = parseFloat(e.target.value);
    setTimelinePosition(newPosition);

    // Filter disasters up to current date
    if (onTimeChange) {
      onTimeChange(currentDate);
    }
  };

  // Handle play/pause
  const togglePlay = (e) => {
    // Stop map interaction
    if (e) e.stopPropagation();
    setPlaying(!playing);
  };

  // Play timeline animation effect
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setTimelinePosition(prev => {
          const next = prev + (0.2 * speed);
          if (next >= 100) {
            setPlaying(false);
            return 100;
          }
          return next;
        });
      }, 50);
    } else if (playRef.current) {
      clearInterval(playRef.current);
    }

    return () => {
      if (playRef.current) {
        clearInterval(playRef.current);
      }
    };
  }, [playing, speed]);

  // Update filtered disasters when timeline changes
  useEffect(() => {
    if (onTimeChange) {
      onTimeChange(currentDate);
    }
  }, [currentDate, onTimeChange]);

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        width: '100%',
        marginBottom: '10px',
        border: '1px solid rgba(26, 54, 93, 0.3)',
        pointerEvents: 'auto'
      }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          DISASTER TIMELINE
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <button
            onClick={(e) => togglePlay(e)}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              backgroundColor: playing ? '#f44336' : '#4CAF50',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {playing ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                PAUSE
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                PLAY
              </>
            )}
          </button>
          <select
            value={speed}
            onChange={(e) => {
              e.stopPropagation();
              setSpeed(Number(e.target.value));
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '4px',
              fontSize: '12px'
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
          </select>
        </div>
      </div>

      <div style={{
        position: 'relative',
        marginBottom: '8px'
      }}>
        <input
          type="range"
          min="0"
          max="100"
          value={timelinePosition}
          onChange={handleTimelineChange}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '16px', /* Increased height for better touch target */
            background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, var(--aidstack-orange) 100%)',
            appearance: 'none',
            outline: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#666'
        }}>
          <span>{formatDate(earliestDate)}</span>
          <span style={{
            fontWeight: 'bold',
            color: '#F44336',
            position: 'absolute',
            left: `${timelinePosition}%`,
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            padding: '1px 4px',
            borderRadius: '3px',
            border: '1px solid #f44336',
            fontSize: '11px',
            top: '-20px'
          }}>
            {formatDate(currentDate)}
          </span>
          <span>{formatDate(latestDate)}</span>
        </div>
      </div>
    </div>
  );
};

export default TimelineVisualization;
