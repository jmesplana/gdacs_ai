import React from 'react';
import ReactMarkdown from 'react-markdown';

const SitrepGenerator = ({ sitrep, loading, onGenerate, hasImpactedFacilities, dateFilter }) => {
  return (
    <div>
      <h2>Situation Report</h2>
      
      {!hasImpactedFacilities ? (
        <div>
          <p>No impacted facilities detected. Upload facilities and assess impact first.</p>
        </div>
      ) : (
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <button 
                className="button" 
                onClick={onGenerate} 
                disabled={loading}
              >
                {loading ? 'Generating...' : (sitrep ? 'Regenerate' : 'Generate')} Situation Report
              </button>
              
              <div style={{
                backgroundColor: '#f0f4f8',
                color: '#516f90',
                padding: '6px 10px',
                borderRadius: '4px',
                marginLeft: '10px',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Period: {dateFilter === '24h' ? 'Last 24h' :
                         dateFilter === '48h' ? 'Last 48h' :
                         dateFilter === '72h' ? 'Last 72h' :
                         dateFilter === '7d' ? 'Last 7 days' :
                         dateFilter === '30d' ? 'Last 30 days' :
                         dateFilter === 'all' ? 'All time' : 'Custom'}
              </div>
            </div>
            
            <div style={{
              backgroundColor: '#e3f2fd', 
              padding: '8px 12px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
              </svg>
              <span style={{fontSize: '14px', color: '#0d47a1', fontWeight: 'bold'}}>
                AI-Generated Report
              </span>
            </div>
          </div>
          
          {loading ? (
            <div className="loading">
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px', animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Generating AI situation report...</span>
              </div>
            </div>
          ) : sitrep ? (
            <div className="sitrep-container">
              <ReactMarkdown>{sitrep}</ReactMarkdown>
              
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <button
                    className="button"
                    onClick={() => {
                      const blob = new Blob([sitrep], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.setAttribute('href', url);
                      const date = new Date().toISOString().split('T')[0];
                      a.setAttribute('download', `sitrep-${date}.md`);
                      a.click();
                    }}
                    style={{ marginRight: '10px' }}
                  >
                    Download as Markdown
                  </button>
                  
                  <button
                    className="button"
                    onClick={() => {
                      const element = document.createElement('a');
                      const file = new Blob([sitrep], {type: 'text/plain'});
                      element.href = URL.createObjectURL(file);
                      const date = new Date().toISOString().split('T')[0];
                      element.download = `sitrep-${date}.txt`;
                      document.body.appendChild(element);
                      element.click();
                    }}
                  >
                    Download as Text
                  </button>
                </div>
                
                <div style={{
                  backgroundColor: '#f5f5f5', 
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#666'
                }}>
                  Generated {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <p>Click the button above to generate a comprehensive situation report.</p>
          )}
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SitrepGenerator;