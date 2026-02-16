import { getDisasterInfo } from '../../utils/disasterHelpers';

const MapLegend = ({
  showLegend,
  setShowLegend,
  showTimeline,
  setShowTimeline,
  showStatistics,
  setShowStatistics,
  showLabels,
  setShowLabels,
  hasFacilities,
  hasStatistics
}) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '10px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '10px'
    }}>
      {/* Legend toggle button */}
      <button
        onClick={() => setShowLegend(!showLegend)}
        style={{
          backgroundColor: 'white',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          border: 'none',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--aidstack-orange)'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
          <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
        </svg>
        {showLegend ? 'Hide Legend' : 'Show Legend'}
      </button>

      {/* Timeline toggle button */}
      <button
        onClick={() => setShowTimeline(!showTimeline)}
        style={{
          backgroundColor: showTimeline ? 'rgba(255, 107, 53, 0.1)' : 'white',
          borderRadius: '4px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          border: showTimeline ? '1px solid var(--aidstack-orange)' : 'none',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: '#F44336'
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
      </button>

      {/* Facility labels toggle button */}
      {hasFacilities && (
        <button
          onClick={() => setShowLabels(!showLabels)}
          style={{
            backgroundColor: showLabels ? '#e8f5e9' : 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            border: showLabels ? '1px solid #4CAF50' : 'none',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#4CAF50'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <path d="M9 3v18"></path>
          </svg>
          {showLabels ? 'Hide Labels' : 'Show Labels'}
        </button>
      )}

      {/* Statistics toggle button - only show if we have impactStatistics */}
      {hasStatistics && (
        <button
          onClick={() => setShowStatistics(!showStatistics)}
          style={{
            backgroundColor: showStatistics ? '#fff8e1' : 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            border: showStatistics ? '1px solid #FFC107' : 'none',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#795548'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
            <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
          </svg>
          {showStatistics ? 'Hide Statistics' : 'Show Statistics'}
        </button>
      )}

      {/* Collapsible legend panel */}
      {showLegend && (
        <div className="map-legend" style={{
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          maxWidth: '300px',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <div style={{
            marginBottom: '15px',
            fontWeight: 'bold',
            fontSize: '14px',
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
            </svg>
            MAP LEGEND
          </div>

          <div style={{
            marginBottom: '10px',
            fontWeight: 'bold',
            fontSize: '13px',
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            DISASTER EVENT TYPES
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'rgba(26, 54, 93, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/earthquake.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Earthquake</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'rgba(26, 54, 93, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/cyclone.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Cyclone</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'rgba(26, 54, 93, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/flood.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Flood</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: 'rgba(26, 54, 93, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/volcano.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Volcano</span>
            </div>
          </div>

          <div style={{
            marginBottom: '10px',
            fontWeight: 'bold',
            fontSize: '13px',
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            ALERT SEVERITY LEVELS
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '12px',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#ff4444',
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>Red Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Severe Impact</span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '12px',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 165, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#ffa500',
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef6c00' }}>Orange Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Moderate Impact</span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '15px',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>Green Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Minor Impact</span>
          </div>

          <div style={{
            marginBottom: '10px',
            fontWeight: 'bold',
            fontSize: '13px',
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            FACILITY STATUS
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '8px',
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#4CAF50',
                border: '1.5px dashed #1b5e20',
                marginRight: '8px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>Safe</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>No impact detected</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#ff4444',
                border: '1.5px dashed #b71c1c',
                marginRight: '8px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>Impacted</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Response needed</span>
          </div>

          <div style={{
            marginTop: '15px',
            fontSize: '12px',
            color: '#757575',
            borderTop: '1px solid #f0f0f0',
            paddingTop: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Click any marker for detailed information
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLegend;
