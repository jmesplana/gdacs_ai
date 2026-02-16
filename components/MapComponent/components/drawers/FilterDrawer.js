import React from 'react';
import { getDisasterInfo, getAvailableDisasterTypes, getNormalizedSeverity, getNormalizedCertainty, getNormalizedUrgency } from '../../utils/disasterHelpers';

const FilterDrawer = ({
  isOpen,
  onClose,
  showHeatmap,
  setShowHeatmap,
  showImpactZones,
  setShowImpactZones,
  showLegend,
  setShowLegend,
  visibleDisasterTypes,
  toggleDisasterType,
  severityFilters,
  toggleSeverityFilter,
  certaintyFilters,
  toggleCertaintyFilter,
  urgencyFilters,
  toggleUrgencyFilter,
  onZoomToFit,
  showZoomIndicator,
  disasters,
  dateFilter,
  handleDateFilterChange
}) => {
  const availableTypes = getAvailableDisasterTypes(disasters);

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div
        className={`drawer drawer-right ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 3000 }}
      >
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 20px -20px',
          padding: '20px'
        }}>
          <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Disaster Filters
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        <div className="drawer-content">
          {/* Visualization Options */}
          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M21 2H3v16h5v4l4-4h5l4-4V2zM11 11V7M16 11V7"></path>
              </svg>
              VISUALIZATION OPTIONS
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              marginBottom: '15px',
              overflow: 'hidden'
            }}>
              {/* Heatmap Toggle Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                borderBottom: showHeatmap ? '1px dashed #e0e0e0' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <circle cx="15.5" cy="8.5" r="1.5"></circle>
                    <circle cx="15.5" cy="15.5" r="1.5"></circle>
                    <circle cx="8.5" cy="15.5" r="1.5"></circle>
                  </svg>
                  <span style={{ fontWeight: 'bold' }}>Heatmap View</span>
                </div>
                <div
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: showHeatmap ? '#FF9800' : '#e0e0e0',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'background-color 0.3s',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: showHeatmap ? '22px' : '2px',
                      transition: 'left 0.3s'
                    }}
                  ></div>
                </div>
              </div>

              {/* Heatmap explanation - shown only when heatmap is active */}
              {showHeatmap && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fff8e1',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#795548'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>About Heatmap Visualization:</div>
                  <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    <li>Shows disaster concentration areas</li>
                    <li>Larger, brighter spots indicate more severe events</li>
                    <li>Circles automatically resize based on zoom level</li>
                    <li>Intensity varies by event severity:<br />
                      <span style={{ color: '#d32f2f' }}>■</span> Extreme
                      <span style={{ color: '#f57c00', marginLeft: '5px' }}>■</span> Severe
                      <span style={{ color: '#ffa000', marginLeft: '5px' }}>■</span> Moderate
                      <span style={{ color: '#ffc107', marginLeft: '5px' }}>■</span> Minor
                    </li>
                  </ul>
                </div>
              )}

              {/* Impact Zones Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                borderTop: '1px solid #f0f0f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                  <span style={{ fontWeight: 'bold' }}>Impact Zones</span>
                </div>
                <div
                  onClick={() => setShowImpactZones(!showImpactZones)}
                  style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: showImpactZones ? 'var(--aidstack-orange)' : '#e0e0e0',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'background-color 0.3s',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: showImpactZones ? '22px' : '2px',
                    transition: 'left 0.3s'
                  }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Map Legend Control */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(26, 54, 93, 0.05)',
              borderRadius: '8px',
              marginBottom: '15px',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px',
                borderBottom: showLegend ? '1px dashed #e0e0e0' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  <span style={{ fontWeight: 'bold' }}>Map Legend</span>
                </div>
                <div
                  onClick={() => setShowLegend(!showLegend)}
                  style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: showLegend ? 'var(--aidstack-navy)' : '#e0e0e0',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'background-color 0.3s',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: showLegend ? '22px' : '2px',
                      transition: 'left 0.3s'
                    }}
                  ></div>
                </div>
              </div>

              {/* Legend explanation - shown only when legend is active */}
              {showLegend && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fff',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#555'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Disaster Representation:</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '3px solid #ff5722',
                        marginRight: '8px',
                        position: 'relative'
                      }}>
                        <div style={{ position: 'absolute', top: '2px', left: '2px', width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '50%' }}></div>
                      </div>
                      <span>Disaster point location</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        width: '24px',
                        height: '18px',
                        backgroundColor: 'rgba(255, 87, 34, 0.2)',
                        border: '1px solid rgba(255, 87, 34, 0.5)',
                        marginRight: '8px',
                        borderRadius: '3px'
                      }}></div>
                      <span>Impact polygon (from official data)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '1px dashed rgba(255, 87, 34, 0.7)',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}></div>
                      <span>Estimated impact radius (when polygon unavailable)</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Facility Status:</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#4CAF50',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}></div>
                      <span>Safe facility</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ff4444',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}></div>
                      <span>Impacted facility</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Alert Levels:</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ff4444',
                        marginRight: '8px'
                      }}></div>
                      <span>Red alert (severe impact)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ffa500',
                        marginRight: '8px'
                      }}></div>
                      <span>Orange alert (moderate impact)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#4CAF50',
                        marginRight: '8px'
                      }}></div>
                      <span>Green alert (minor impact)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Zoom to Fit Control */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px',
              backgroundColor: '#f1f8e9',
              borderRadius: '8px',
              marginBottom: '15px',
              border: '1px solid #dcedc8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                </svg>
                <span style={{ fontWeight: 'bold' }}>Zoom to Filtered Events</span>
              </div>
              <button
                onClick={onZoomToFit}
                style={{
                  backgroundColor: showZoomIndicator ? '#FF9800' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background-color 0.3s'
                }}
              >
                {showZoomIndicator && (
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 100%)',
                    animation: 'pulse 1.5s infinite',
                    zIndex: 0
                  }}></span>
                )}
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <path d="M15 3h6v6"></path>
                    <path d="M10 14L21 3"></path>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  </svg>
                  {showZoomIndicator ? 'Update View' : 'Fit View'}
                </span>
              </button>
            </div>
          </div>

          {/* Disaster Type Filters */}
          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              DISASTER TYPE FILTERS
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              {availableTypes.map(type => {
                const info = getDisasterInfo(type);
                const isActive = visibleDisasterTypes[type];

                return (
                  <button
                    key={type}
                    onClick={() => toggleDisasterType(type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: '1px solid #ddd',
                      backgroundColor: isActive ? 'rgba(26, 54, 93, 0.1)' : '#f5f5f5',
                      cursor: 'pointer',
                      opacity: isActive ? 1 : 0.65,
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 2px 5px rgba(26, 54, 93, 0.2)' : 'none',
                      position: 'relative',
                      width: 'calc(50% - 5px)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: isActive ? 'var(--aidstack-navy)' : '#e0e0e0',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px'
                    }}>
                      <img
                        src={info.icon}
                        alt={info.name}
                        width="16"
                        height="16"
                        style={{
                          filter: isActive ? 'brightness(10)' : 'none'
                        }}
                      />
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: isActive ? 'bold' : 'normal',
                      color: isActive ? 'var(--aidstack-navy)' : '#666'
                    }}>
                      {info.name}
                    </span>
                    {isActive && (
                      <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        width: '16px',
                        height: '16px',
                        backgroundColor: 'var(--aidstack-orange)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {availableTypes.length > 0 && (
              <button
                onClick={() => {
                  const allActive = Object.values(visibleDisasterTypes).every(Boolean);
                  const newState = {};

                  availableTypes.forEach(type => {
                    newState[type] = !allActive;
                  });

                  toggleDisasterType(newState);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: '#f0f0f0',
                  cursor: 'pointer',
                  fontSize: '13px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  color: '#666',
                  marginTop: '5px'
                }}
              >
                {Object.values(visibleDisasterTypes).every(Boolean) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                  </svg>
                )}
                {Object.values(visibleDisasterTypes).every(Boolean) ? 'Hide All Disaster Types' : 'Show All Disaster Types'}
              </button>
            )}

            <div style={{
              marginTop: '15px',
              borderTop: '1px solid #f5f5f5',
              paddingTop: '10px',
              fontSize: '12px',
              color: '#757575',
              textAlign: 'center'
            }}>
              <span>
                {Object.values(visibleDisasterTypes).filter(Boolean).length} of {availableTypes.length} disaster types visible
              </span>
            </div>
          </div>

          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              TIME FILTER
            </div>

            <div style={{ marginBottom: '15px' }}>
              <select
                value={dateFilter}
                onChange={handleDateFilterChange}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#f9f9f9',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="48h">Last 48 Hours</option>
                <option value="72h">Last 72 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Events</option>
              </select>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <button
                onClick={() => handleDateFilterChange({ target: { value: '24h' }})}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: dateFilter === '24h' ? '2px solid var(--aidstack-navy)' : '1px solid #e0e0e0',
                  backgroundColor: dateFilter === '24h' ? 'rgba(26, 54, 93, 0.1)' : '#f9f9f9',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'rgba(26, 54, 93, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Last 24 Hours</span>
                </div>
                <span style={{
                  fontSize: '12px',
                  color: '#666',
                  backgroundColor: 'rgba(26, 54, 93, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: 'var(--aidstack-navy)'
                }}>
                  {disasters.filter(d => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    return new Date(d.pubDate) >= cutoff;
                  }).length}
                </span>
              </button>

              <button
                onClick={() => handleDateFilterChange({ target: { value: '72h' }})}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: dateFilter === '72h' ? '2px solid var(--aidstack-navy)' : '1px solid #e0e0e0',
                  backgroundColor: dateFilter === '72h' ? 'rgba(26, 54, 93, 0.1)' : '#f9f9f9',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'rgba(26, 54, 93, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Last 72 Hours</span>
                </div>
                <span style={{
                  fontSize: '12px',
                  color: '#666',
                  backgroundColor: 'rgba(26, 54, 93, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: 'var(--aidstack-navy)'
                }}>
                  {disasters.filter(d => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
                    return new Date(d.pubDate) >= cutoff;
                  }).length}
                </span>
              </button>

              <button
                onClick={() => handleDateFilterChange({ target: { value: 'all' }})}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: dateFilter === 'all' ? '2px solid var(--aidstack-navy)' : '1px solid #e0e0e0',
                  backgroundColor: dateFilter === 'all' ? 'rgba(26, 54, 93, 0.1)' : '#f9f9f9',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'rgba(26, 54, 93, 0.1)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>All Events</span>
                </div>
                <span style={{
                  fontSize: '12px',
                  color: '#666',
                  backgroundColor: 'rgba(26, 54, 93, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: 'var(--aidstack-navy)'
                }}>
                  {disasters.length}
                </span>
              </button>
            </div>
          </div>

          {/* Severity Filter Section */}
          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px',
              marginTop: '20px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              SEVERITY FILTER
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(severityFilters).map(severity => (
                <div key={severity} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                  <div
                    onClick={() => toggleSeverityFilter(severity)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '4px',
                      marginRight: '10px',
                      backgroundColor: severityFilters[severity] ? 'var(--aidstack-navy)' : 'transparent',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {severityFilters[severity] && (
                      <span style={{
                        position: 'absolute',
                        color: 'white',
                        fontSize: '16px',
                        top: '-2px',
                        left: '2px'
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{severity}</span>
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: 'rgba(26, 54, 93, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      color: 'var(--aidstack-navy)'
                    }}>
                      {disasters.filter(d => {
                        const normSeverity = getNormalizedSeverity(d);
                        return severity.toLowerCase() === normSeverity;
                      }).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Certainty Filter Section */}
          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px',
              marginTop: '20px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              CERTAINTY FILTER
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(certaintyFilters).map(certainty => (
                <div key={certainty} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                  <div
                    onClick={() => toggleCertaintyFilter(certainty)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '4px',
                      marginRight: '10px',
                      backgroundColor: certaintyFilters[certainty] ? 'var(--aidstack-navy)' : 'transparent',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {certaintyFilters[certainty] && (
                      <span style={{
                        position: 'absolute',
                        color: 'white',
                        fontSize: '16px',
                        top: '-2px',
                        left: '2px'
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{certainty}</span>
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: 'rgba(26, 54, 93, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      color: 'var(--aidstack-navy)'
                    }}>
                      {disasters.filter(d => {
                        const normCertainty = getNormalizedCertainty(d);
                        return certainty.toLowerCase() === normCertainty;
                      }).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Urgency Filter Section */}
          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px',
              marginTop: '20px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="6" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              URGENCY FILTER
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(urgencyFilters).map(urgency => (
                <div key={urgency} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                  <div
                    onClick={() => toggleUrgencyFilter(urgency)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '4px',
                      marginRight: '10px',
                      backgroundColor: urgencyFilters[urgency] ? 'var(--aidstack-navy)' : 'transparent',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {urgencyFilters[urgency] && (
                      <span style={{
                        position: 'absolute',
                        color: 'white',
                        fontSize: '16px',
                        top: '-2px',
                        left: '2px'
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{urgency}</span>
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: 'rgba(26, 54, 93, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      color: 'var(--aidstack-navy)'
                    }}>
                      {disasters.filter(d => {
                        const normUrgency = getNormalizedUrgency(d);
                        return urgency.toLowerCase() === normUrgency;
                      }).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterDrawer;
