// Statistics panel component
const StatisticsPanel = ({ statistics }) => {
  if (!statistics) return null;

  // Function to stop event propagation for all mouse/touch events
  const stopPropagation = (e) => {
    e.stopPropagation();
    e.nativeEvent?.stopImmediatePropagation?.();
  };

  return (
    <div
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
      onMouseMove={stopPropagation}
      onTouchStart={stopPropagation}
      onTouchMove={stopPropagation}
      onWheel={stopPropagation}
      style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        width: '100%',
        maxHeight: '80vh',
        overflowY: 'auto',
        marginBottom: '10px',
        border: '1px solid rgba(244, 67, 54, 0.3)',
        pointerEvents: 'auto'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '15px',
        borderBottom: '2px solid #f5f5f5',
        paddingBottom: '10px'
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
            <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
          </svg>
          IMPACT ANALYSIS
        </div>
      </div>

      {/* Summary statistics */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '10px',
          backgroundColor: '#f9f9f9',
          padding: '10px',
          borderRadius: '6px'
        }}>
          <div style={{
            textAlign: 'center',
            flex: 1,
            borderRight: '1px solid #eee',
            padding: '0 10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>DISASTERS</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'var(--aidstack-navy)'
            }}>{statistics.totalDisasters}</div>
          </div>
          <div style={{
            textAlign: 'center',
            flex: 1,
            borderRight: '1px solid #eee',
            padding: '0 10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>FACILITIES</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#4CAF50'
            }}>{statistics.totalFacilities}</div>
          </div>
          <div style={{
            textAlign: 'center',
            flex: 1,
            padding: '0 10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>IMPACTED</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#F44336'
            }}>{statistics.impactedFacilityCount} ({statistics.percentageImpacted}%)</div>
          </div>
        </div>
      </div>

      {/* Disaster Statistics */}
      {statistics.disasterStats && statistics.disasterStats.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12" y2="16"></line>
            </svg>
            DISASTER IMPACT DETAILS
          </div>
          <div
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onTouchStart={stopPropagation}
            onTouchMove={stopPropagation}
            onWheel={stopPropagation}
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #eee',
              borderRadius: '4px'
            }}
          >
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead style={{
                position: 'sticky',
                top: 0,
                backgroundColor: '#f5f5f5'
              }}>
                <tr>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Disaster</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Type</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Severity</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Impact Area</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Facilities</th>
                </tr>
              </thead>
              <tbody>
                {statistics.disasterStats.map((disaster, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{disaster.name}</td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{disaster.type}</td>
                    <td style={{
                      padding: '8px',
                      textAlign: 'center',
                      borderBottom: '1px solid #eee',
                      color: disaster.alertLevel?.toLowerCase() === 'red' ? '#d32f2f' :
                        disaster.alertLevel?.toLowerCase() === 'orange' ? '#ff9800' :
                          disaster.alertLevel?.toLowerCase() === 'green' ? '#4caf50' : '#757575'
                    }}>{disaster.severity}</td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                      {disaster.impactArea} km²
                      {disaster.polygon && <span style={{
                        fontSize: '10px',
                        color: 'var(--aidstack-orange)',
                        backgroundColor: 'rgba(255, 107, 53, 0.1)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        marginLeft: '4px'
                      }}>POLYGON</span>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#F44336' }}>
                      {disaster.affectedFacilities}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overlapping Disasters */}
      {statistics.overlappingImpacts && statistics.overlappingImpacts.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 'bold',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            color: '#d32f2f'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
              <line x1="6" y1="9" x2="6" y2="21"></line>
            </svg>
            OVERLAPPING DISASTER IMPACTS ({statistics.overlappingImpacts.length})
          </div>
          <div
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onTouchStart={stopPropagation}
            onTouchMove={stopPropagation}
            onWheel={stopPropagation}
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              backgroundColor: '#ffebee'
            }}
          >
            {statistics.overlappingImpacts.map((overlap, index) => (
              <div key={index} style={{
                padding: '10px',
                borderBottom: index < statistics.overlappingImpacts.length - 1 ? '1px solid #ffcdd2' : 'none',
                fontSize: '12px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {overlap.disasters[0]} + {overlap.disasters[1]}
                </div>
                <div style={{ color: '#555' }}>
                  Impacting {overlap.facilities.length} {overlap.facilities.length === 1 ? 'facility' : 'facilities'}:
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '5px',
                  marginTop: '5px'
                }}>
                  {overlap.facilities.map((facility, fidx) => (
                    <span key={fidx} style={{
                      backgroundColor: '#fff',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      border: '1px solid #ffcdd2'
                    }}>{facility}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticsPanel;
