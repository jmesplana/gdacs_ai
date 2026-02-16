import React from 'react';
import ReactMarkdown from 'react-markdown';
import TimestampBadge from '../TimestampBadge';

const AnalysisDrawer = ({
  isOpen,
  onClose,
  selectedFacility,
  analysisData,
  analysisLoading,
  onViewRecommendations,
  impactedFacilities = [],
  isAIGenerated,
  timestamp,
  onRefresh
}) => {
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
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6" y2="6"></line>
              <line x1="6" y1="18" x2="6" y2="18"></line>
            </svg>
            AI Facility Analysis
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        <div className="drawer-content">
          {analysisLoading ? (
            <div style={{textAlign: 'center', padding: '40px 0'}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px', animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Generating AI analysis...</span>
              </div>
            </div>
          ) : selectedFacility && analysisData ? (
            <div>
              <TimestampBadge
                timestamp={timestamp}
                onRefresh={onRefresh}
                loading={analysisLoading}
              />

              <div style={{marginBottom: '15px'}}>
                <h2 style={{margin: '0 0 10px 0', fontSize: '18px'}}>{selectedFacility.name}</h2>
                <div style={{
                  backgroundColor: isAIGenerated ? 'rgba(26, 54, 93, 0.1)' : '#f5f5f5',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  {isAIGenerated ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                      <span style={{color: 'var(--aidstack-navy)', fontWeight: 'bold'}}>AI-Generated Analysis</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#757575" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span style={{color: '#757575'}}>Standard Analysis</span>
                    </>
                  )}
                </div>
              </div>

              {Object.entries(analysisData).map(([section, content]) => (
                <div key={section} style={{marginBottom: '20px'}}>
                  <h3 style={{
                    fontSize: '16px',
                    marginBottom: '10px',
                    paddingBottom: '5px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>{section}</h3>

                  {Array.isArray(content) ? (
                    <ul style={{paddingLeft: '20px', margin: '10px 0'}}>
                      {content.map((item, idx) => (
                        <li key={idx} style={{marginBottom: '8px'}}>
                          {typeof item === 'object' ? JSON.stringify(item) : item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{lineHeight: '1.5'}}>
                      {typeof content === 'object' ? JSON.stringify(content) : content}
                    </p>
                  )}
                </div>
              ))}

              <div style={{marginTop: '30px', borderTop: '1px solid #f0f0f0', paddingTop: '15px'}}>
                {(() => {
                  const impacts = impactedFacilities.find(
                    impacted => impacted.facility.name === selectedFacility.name
                  )?.impacts || [];
                  const hasImpacts = impacts.length > 0;

                  return (
                    <>
                      <button
                        className="button"
                        onClick={() => {
                          if (onViewRecommendations) {
                            onViewRecommendations(selectedFacility);
                          }
                        }}
                        style={{
                          backgroundColor: hasImpacts ? 'var(--aidstack-orange)' : 'var(--aidstack-navy)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '10px 15px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto',
                          transition: 'all 0.2s'
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                          {hasImpacts ? (
                            <>
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </>
                          ) : (
                            <>
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </>
                          )}
                        </svg>
                        {hasImpacts ? 'View Response Recommendations' : 'View Preparedness Recommendations'}
                      </button>
                      <p style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--aidstack-slate-medium)',
                        marginTop: '8px',
                        fontStyle: 'italic'
                      }}>
                        {hasImpacts
                          ? `Active disaster impacts detected - Get immediate response guidance`
                          : `No active threats - Get preparedness and mitigation guidance`
                        }
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '40px 0', color: '#666'}}>
              Select a facility to analyze its disaster risk profile
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AnalysisDrawer;
