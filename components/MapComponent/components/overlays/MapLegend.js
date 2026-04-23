import { useState } from 'react';
import { ADMIN_FILL_MODES, RISK_COLORS } from '../../utils/adminDatasetStyling';

const MapLegend = ({
  showLegend,
  setShowLegend,
  showStatistics,
  setShowStatistics,
  showLabels,
  setShowLabels,
  hasFacilities,
  hasStatistics,
  hasAcledData = false,
  hasDistricts = false,
  showDistricts,
  setShowDistricts,
  currentMapLayer = 'street',
  gdacsDiagnostics = null,
  adminFillMode = ADMIN_FILL_MODES.RISK,
  adminDatasetLegend = [],
  adminMetricField = '',
  adminDatasetJoinSummary = null
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const showHazardContextLegend = currentMapLayer === 'drought_context' || currentMapLayer === 'flood_context';
  const contextLegendTitle = currentMapLayer === 'drought_context' ? 'DROUGHT CONTEXT' : 'FLOOD CONTEXT';
  const contextLegendDescription = currentMapLayer === 'drought_context'
    ? 'Blue tones indicate wetter or lower-stress conditions. Yellow to brown tones indicate drier and warmer context.'
    : 'Light tones indicate lower flood susceptibility. Darker blue tones indicate flatter terrain and stronger surface-water context.';
  const contextLegendItems = currentMapLayer === 'drought_context'
    ? [
        { color: '#1d4ed8', label: 'Lower drought stress' },
        { color: '#60a5fa', label: 'Mild drought signal' },
        { color: '#fef3c7', label: 'Transition zone' },
        { color: '#f59e0b', label: 'Elevated drought context' },
        { color: '#92400e', label: 'Highest drought context' }
      ]
    : [
        { color: '#fff7ed', label: 'Lower flood context' },
        { color: '#fed7aa', label: 'Mild flood context' },
        { color: '#fb923c', label: 'Moderate flood context' },
        { color: '#2563eb', label: 'High flood context' },
        { color: '#0f172a', label: 'Highest flood context' }
      ];
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '10px',
      zIndex: 1000, // Below hamburger menu (2000) and draw button (1500)
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

      {/* Admin boundaries toggle button */}
      {hasDistricts && (
        <button
          onClick={() => setShowDistricts(!showDistricts)}
          style={{
            backgroundColor: showDistricts ? '#e3f2fd' : 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            border: showDistricts ? '1px solid #2D5A7B' : 'none',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: '#2D5A7B'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            <line x1="8" y1="2" x2="8" y2="18"></line>
            <line x1="16" y1="6" x2="16" y2="22"></line>
          </svg>
          {showDistricts ? 'Hide Admin Areas' : 'Show Admin Areas'}
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
          padding: isMinimized ? '10px' : '15px',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          maxWidth: isMinimized ? '250px' : '300px',
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            marginBottom: isMinimized ? '0' : '15px',
            fontWeight: 'bold',
            fontSize: '14px',
            borderBottom: isMinimized ? 'none' : '2px solid #f0f0f0',
            paddingBottom: isMinimized ? '0' : '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
              </svg>
              MAP LEGEND
            </div>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? 'Expand Legend' : 'Minimize Legend'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--aidstack-navy)',
                transition: 'transform 0.3s ease'
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isMinimized ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }}
              >
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>

          {!isMinimized && (
            <>

          {hasDistricts && showDistricts && (
            <>
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
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                  <line x1="8" y1="2" x2="8" y2="18"></line>
                  <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
                ADMIN FILL
              </div>

              {adminFillMode === ADMIN_FILL_MODES.DATASET && adminDatasetLegend.length > 0 ? (
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    {adminMetricField || 'Uploaded data'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {adminDatasetLegend.map((item) => (
                      <div key={`${item.color}-${item.label}`} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#334155' }}>
                        <div style={{ width: '18px', height: '16px', borderRadius: '4px', backgroundColor: item.color, border: '1px solid rgba(15,23,42,0.14)', marginRight: '8px' }} />
                        <span>{item.label}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                      <div style={{ width: '18px', height: '16px', borderRadius: '4px', backgroundColor: '#cbd5e1', border: '1px solid rgba(15,23,42,0.14)', marginRight: '8px', opacity: 0.7 }} />
                      <span>No data</span>
                    </div>
                  </div>
                  {adminDatasetJoinSummary && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                      {adminDatasetJoinSummary.matchedRows} of {adminDatasetJoinSummary.totalRows} uploaded rows matched {adminDatasetJoinSummary.matchedDistricts} admin areas
                    </div>
                  )}
                </div>
              ) : adminFillMode === ADMIN_FILL_MODES.RISK ? (
                <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { level: 'none', label: 'No risk' },
                    { level: 'low', label: 'Low' },
                    { level: 'medium', label: 'Medium' },
                    { level: 'high', label: 'High' },
                    { level: 'very-high', label: 'Very high' }
                  ].map((item) => (
                    <div key={item.level} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#334155' }}>
                      <div style={{ width: '18px', height: '16px', borderRadius: '4px', backgroundColor: RISK_COLORS[item.level], border: '1px solid rgba(15,23,42,0.14)', marginRight: '8px' }} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginBottom: '15px', fontSize: '12px', color: '#64748b' }}>
                  Admin fill is off.
                </div>
              )}
            </>
          )}

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

          {showHazardContextLegend && (
            <>
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
                  <path d="M4 19h16"></path>
                  <path d="M4 15h16"></path>
                  <path d="M4 11h16"></path>
                  <path d="M4 7h16"></path>
                </svg>
                {contextLegendTitle}
              </div>

              <div style={{ marginBottom: '10px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                {contextLegendDescription}
              </div>

              <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contextLegendItems.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#334155' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: item.color, border: '1px solid rgba(15,23,42,0.12)', marginRight: '8px' }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

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
            SITE STATUS
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

          {gdacsDiagnostics && (
            <>
              <div style={{
                marginTop: '15px',
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
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4"></path>
                  <path d="M12 8h.01"></path>
                </svg>
                GDACS SOURCE DIAGNOSTICS
              </div>

              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #dbe3ee',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#475569',
                lineHeight: '1.7'
              }}>
                <div><strong>Fetched:</strong> {gdacsDiagnostics.fetchedTotal} events</div>
                <div><strong>After filter:</strong> {gdacsDiagnostics.filteredTotal} events ({gdacsDiagnostics.dateFilter})</div>
                <div><strong>{gdacsDiagnostics.primarySourceLabel || 'Primary feed'} only:</strong> {gdacsDiagnostics.primaryOnly}</div>
                <div><strong>JSON only:</strong> {gdacsDiagnostics.jsonOnly}</div>
                <div><strong>{gdacsDiagnostics.primarySourceLabel || 'Primary feed'} + JSON enriched:</strong> {gdacsDiagnostics.enriched}</div>
                <div><strong>With geometry URL:</strong> {gdacsDiagnostics.withGeometryUrl}</div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                  If GDACS website totals differ, compare this with `/api/gdacs` first.
                </div>
              </div>
            </>
          )}

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

          {hasAcledData && (
            <>
              <div style={{
                marginTop: '15px',
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
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                ACLED CONFLICT DATA
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(211, 47, 47, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(211, 47, 47, 0.2)'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#d32f2f',
                    border: '2px solid white',
                    marginRight: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}></div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Battles</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 111, 0, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 111, 0, 0.2)'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#ff6f00',
                    border: '2px solid white',
                    marginRight: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}></div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Explosions/Remote violence</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(198, 40, 40, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(198, 40, 40, 0.2)'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#c62828',
                    border: '2px solid white',
                    marginRight: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}></div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Violence against civilians</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(251, 192, 45, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(251, 192, 45, 0.2)'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#fbc02d',
                    border: '2px solid white',
                    marginRight: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}></div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Protests</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(245, 124, 0, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 124, 0, 0.2)'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#f57c00',
                    border: '2px solid white',
                    marginRight: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}></div>
                  <span style={{ fontSize: '12px', color: '#666' }}>Riots</span>
                </div>
              </div>
            </>
          )}

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
          </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapLegend;
