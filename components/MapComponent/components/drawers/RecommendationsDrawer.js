import React from 'react';
import ReactMarkdown from 'react-markdown';

const RecommendationsDrawer = ({
  isOpen,
  onClose,
  onBack,
  facility,
  recommendations,
  loading,
  isAIGenerated
}) => {
  const formatRecommendationContent = (content) => {
    if (Array.isArray(content)) {
      return (
        <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
          {content.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '8px', lineHeight: '1.5' }}>
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof content === 'object' && content !== null) {
      return (
        <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', marginTop: '10px' }}>
          {Object.entries(content).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '8px' }}>
              <strong>{key}:</strong> {typeof value === 'string' ? value : JSON.stringify(value)}
            </div>
          ))}
        </div>
      );
    }

    return <div style={{ lineHeight: '1.6', color: '#555' }}>{String(content)}</div>;
  };

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
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Recommendations
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>

        <div className="drawer-content">
          {loading ? (
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
                <span style={{fontFamily: "'Inter', sans-serif"}}>Generating recommendations...</span>
              </div>
            </div>
          ) : facility && recommendations ? (
            <div>
              {/* Back button */}
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    color: 'var(--aidstack-navy)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    marginBottom: '15px',
                    padding: '8px 0'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Back to Analysis
                </button>
              )}

              {/* Facility Info */}
              <div style={{marginBottom: '20px', padding: '15px', backgroundColor: 'var(--aidstack-light-gray)', borderRadius: '8px', borderLeft: '4px solid var(--aidstack-orange)'}}>
                <h2 style={{margin: '0 0 5px 0', fontSize: '18px', color: 'var(--aidstack-navy)', fontFamily: "'Space Grotesk', sans-serif"}}>{facility.name}</h2>
                {facility.type && <p style={{margin: '0', fontSize: '14px', color: 'var(--aidstack-slate-medium)', fontFamily: "'Inter', sans-serif"}}>Type: {facility.type}</p>}
              </div>

              {/* AI Generated Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: isAIGenerated ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                color: isAIGenerated ? '#2e7d32' : '#e65100',
                marginBottom: '20px',
                fontFamily: "'Inter', sans-serif"
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                {isAIGenerated ? 'AI-Generated Recommendations' : 'Standard Recommendations'}
              </div>

              {/* Recommendations Content */}
              {Object.entries(recommendations).map(([category, content]) => {
                // Skip certain metadata fields
                if (['error', 'Credits', 'About'].includes(category)) return null;

                return (
                  <div key={category} style={{marginBottom: '25px', borderBottom: '1px solid #f0f0f0', paddingBottom: '20px'}}>
                    <h3 style={{
                      fontSize: '16px',
                      color: 'var(--aidstack-orange)',
                      marginBottom: '12px',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700
                    }}>
                      {category}
                    </h3>
                    {formatRecommendationContent(content)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '40px 0', color: '#666', fontFamily: "'Inter', sans-serif"}}>
              No recommendations available
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RecommendationsDrawer;
