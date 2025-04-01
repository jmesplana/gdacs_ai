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
                      // Create Word document format using basic HTML with MS Word-specific XML
                      const htmlContent = `
                        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
                              xmlns:w="urn:schemas-microsoft-com:office:word" 
                              xmlns="http://www.w3.org/TR/REC-html40">
                          <head>
                            <meta charset="utf-8">
                            <meta name="ProgId" content="Word.Document">
                            <meta name="Generator" content="Microsoft Word 15">
                            <meta name="Originator" content="Microsoft Word 15">
                            <title>Situation Report</title>
                            <!--[if gte mso 9]>
                            <xml>
                              <w:WordDocument>
                                <w:View>Print</w:View>
                                <w:Zoom>90</w:Zoom>
                                <w:DoNotOptimizeForBrowser/>
                              </w:WordDocument>
                            </xml>
                            <![endif]-->
                            <style>
                              body { font-family: 'Calibri', sans-serif; margin: 1cm; }
                              h1, h2, h3 { font-family: 'Calibri', sans-serif; }
                              h1 { font-size: 16pt; color: #2196F3; margin-top: 24pt; margin-bottom: 6pt; }
                              h2 { font-size: 14pt; color: #0d47a1; margin-top: 18pt; margin-bottom: 6pt; }
                              h3 { font-size: 12pt; color: #333; margin-top: 12pt; margin-bottom: 3pt; }
                              p { margin: 6pt 0; }
                              ul { margin-left: 20pt; }
                              li { margin-bottom: 3pt; }
                              .highlight { color: #d32f2f; font-weight: bold; background-color: #ffebee; padding: 2pt; }
                              .footer { font-style: italic; color: #666; margin-top: 24pt; border-top: 1pt solid #ccc; padding-top: 12pt; text-align: center; }
                            </style>
                          </head>
                          <body>
                            ${sitrep
                              .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
                              .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
                              .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\*(.*?)\*/g, '<em>$1</em>')
                              .replace(/\n- (.*?)$/gm, '<ul><li>$1</li></ul>')
                              .replace(/<\/ul>\s*<ul>/g, '')  // Combine adjacent lists
                              .replace(/\n\n/g, '<p></p>')
                              .replace(/\n/g, '<br>')
                              .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')}
                              
                            <div class="footer">
                              Generated on ${new Date().toLocaleDateString()} | Developed by <a href="https://github.com/jmesplana">John Mark Esplana</a>
                            </div>
                          </body>
                        </html>
                      `;
                      
                      try {
                        // Create a blob with correct MIME type
                        const blob = new Blob([htmlContent], { type: 'application/msword' });
                        const date = new Date().toISOString().split('T')[0];
                        const filename = `sitrep-${date}.doc`;
                        
                        // For Edge/IE
                        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                          window.navigator.msSaveOrOpenBlob(blob, filename);
                        } 
                        // For Chrome/Firefox/Safari
                        else {
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.download = filename;
                          link.style.display = 'none';
                          document.body.appendChild(link);
                          link.click();
                          setTimeout(() => {
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(link.href);
                          }, 100);
                        }
                      } catch (e) {
                        console.error('Error downloading Word document:', e);
                        // Try again with a simpler HTML structure
                        try {
                          const simpleHtml = `<html><head><title>Situation Report</title></head><body>${sitrep.replace(/\n/g, '<br>')}</body></html>`;
                          const simpleBlob = new Blob([simpleHtml], { type: 'application/msword' });
                          const date = new Date().toISOString().split('T')[0];
                          const filename = `sitrep-${date}.doc`;
                          
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(simpleBlob);
                          link.download = filename;
                          link.style.display = 'none';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        } catch (finalError) {
                          console.error('Final error trying to download Word document:', finalError);
                          alert('Unable to download Word document. Please try again or copy the content manually.');
                        }
                      }
                    }}
                  >
                    Download Report (.doc)
                  </button>
                </div>
                
                <div style={{
                  backgroundColor: '#f5f5f5', 
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#666',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()} | Developed by <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer" style={{color: '#0d47a1', textDecoration: 'none'}}>John Mark Esplana</a>
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
        
        .button-secondary {
          background-color: #e0e0e0;
          color: #333;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .button-secondary:hover {
          background-color: #d0d0d0;
        }
      `}</style>
    </div>
  );
};

export default SitrepGenerator;