import { useEffect, useState } from 'react';

const TimelineScrubber = ({
  isEnabled,
  minDate,
  maxDate,
  currentDate,
  onDateChange,
  onPlayPause,
  isPlaying,
  playbackSpeed,
  onSpeedChange,
  onClose
}) => {
  const [localDate, setLocalDate] = useState(currentDate);

  useEffect(() => {
    setLocalDate(currentDate);
  }, [currentDate]);

  if (!isEnabled) return null;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSliderChange = (e) => {
    const value = parseInt(e.target.value);
    const totalDays = Math.floor((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));
    const selectedDate = new Date(minDate);
    selectedDate.setDate(selectedDate.getDate() + value);

    setLocalDate(selectedDate.toISOString().split('T')[0]);
    onDateChange(selectedDate.toISOString().split('T')[0]);
  };

  const getCurrentSliderValue = () => {
    const totalDays = Math.floor((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));
    const currentDays = Math.floor((new Date(currentDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(totalDays, currentDays));
  };

  const totalDays = Math.floor((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderTop: '2px solid var(--aidstack-navy)',
        boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1500,
        padding: '16px 24px',
        fontFamily: "'Inter', sans-serif",
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      {/* Top Row: Current Date Display, Speed Controls, and Close Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        {/* Current Date Display */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--aidstack-navy)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Viewing
          </div>
          <div style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--aidstack-teal)',
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            {formatDate(currentDate)}
          </div>
        </div>

        {/* Speed Controls and Close Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Speed Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#666',
              marginRight: '4px'
            }}>
              Speed:
            </span>
            {[1, 2, 5, 10].map(speed => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: playbackSpeed === speed ? 'var(--aidstack-teal)' : 'white',
                  color: playbackSpeed === speed ? 'white' : 'var(--aidstack-navy)',
                  border: `2px solid ${playbackSpeed === speed ? 'var(--aidstack-teal)' : '#ddd'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minWidth: '40px'
                }}
                onMouseEnter={(e) => {
                  if (playbackSpeed !== speed) {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playbackSpeed !== speed) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            title="Close Timeline Playback"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#999',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
              e.currentTarget.style.color = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#999';
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Middle Row: Slider with Date Labels */}
      <div style={{
        marginBottom: '12px'
      }}>
        {/* Timeline with tick marks */}
        <div style={{
          position: 'relative',
          height: '50px',
          marginBottom: '8px'
        }}>
          {/* Date labels and tick marks */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: 0,
            right: 0,
            height: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 1
          }}>
            {(() => {
              const tickCount = Math.min(10, totalDays + 1);
              const ticks = [];
              for (let i = 0; i < tickCount; i++) {
                const dayOffset = Math.floor((totalDays / (tickCount - 1)) * i);
                const tickDate = new Date(minDate);
                tickDate.setDate(tickDate.getDate() + dayOffset);

                ticks.push(
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: i === 0 || i === tickCount - 1 ? '0 0 auto' : '1',
                    }}
                  >
                    {/* Date label */}
                    <div style={{
                      fontSize: '9px',
                      color: '#666',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      marginBottom: '4px'
                    }}>
                      {tickDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    {/* Tick mark extending down */}
                    <div style={{
                      width: '2px',
                      height: '14px',
                      backgroundColor: '#999'
                    }} />
                  </div>
                );
              }
              return ticks;
            })()}
          </div>

          {/* Horizontal timeline line - positioned where tick marks end */}
          <div style={{
            position: 'absolute',
            top: '28px',
            left: '0',
            right: '0',
            height: '4px',
            background: `linear-gradient(to right, #00BABC 0%, #00BABC ${(getCurrentSliderValue() / totalDays) * 100}%, #ddd ${(getCurrentSliderValue() / totalDays) * 100}%, #ddd 100%)`,
            borderRadius: '2px',
            pointerEvents: 'none'
          }} />

          {/* Slider input - blue dot moves on the line */}
          <input
            type="range"
            min="0"
            max={totalDays}
            value={getCurrentSliderValue()}
            onChange={handleSliderChange}
            style={{
              position: 'absolute',
              top: '18px',
              width: '100%',
              height: '20px',
              outline: 'none',
              WebkitAppearance: 'none',
              background: 'transparent',
              cursor: 'pointer',
              zIndex: 2
            }}
          />
        </div>
      </div>

      {/* Bottom Row: Play/Pause Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
      }}>
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          style={{
            padding: '12px 32px',
            backgroundColor: '#14466E',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#00BABC';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#14466E';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isPlaying ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Play
            </>
          )}
        </button>

        {/* Reset Button */}
        <button
          onClick={() => onDateChange(minDate)}
          style={{
            padding: '12px 24px',
            backgroundColor: 'white',
            color: '#14466E',
            border: '2px solid #14466E',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#14466E';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = '#14466E';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          Reset
        </button>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(20, 70, 110, 0.85);
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s, background 0.2s;
        }

        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(20, 70, 110, 0.85);
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s, background 0.2s;
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          background: rgba(20, 70, 110, 0.95);
        }

        input[type="range"]::-moz-range-thumb:hover {
          transform: scale(1.2);
          background: rgba(20, 70, 110, 0.95);
        }
      `}</style>
    </div>
  );
};

export default TimelineScrubber;
