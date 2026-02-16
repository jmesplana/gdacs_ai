import React from 'react';
import ReactMarkdown from 'react-markdown';

const SitrepDrawer = ({
  isOpen,
  onClose,
  sitrep,
  sitrepLoading,
  onGenerateSitrep,
  disasters,
  facilities,
  impactedFacilities = []
}) => {
  const handleDownloadDoc = () => {
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
            h1 { font-size: 16pt; color: #1A365D; margin-top: 24pt; margin-bottom: 6pt; }
            h2 { font-size: 14pt; color: #2D5A7B; margin-top: 18pt; margin-bottom: 6pt; }
            h3 { font-size: 12pt; color: #333; margin-top: 12pt; margin-bottom: 3pt; }
            p { margin: 6pt 0; }
            ul { margin-left: 20pt; }
            li { margin-bottom: 3pt; }
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

    // Create a blob with correct MIME type
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    const date = new Date().toISOString().split('T')[0];
    a.setAttribute('download', `sitrep-${date}.doc`);

    // Trigger download
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const handleCopyToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sitrep).then(() => {
        alert('Report copied to clipboard');
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = sitrep;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Report copied to clipboard');
    }
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Situation Report
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-section">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                backgroundColor: '#F44336',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 15px auto'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div style={{
                fontWeight: 'bold',
                marginBottom: '5px',
                color: '#D32F2F',
                fontSize: '18px'
              }}>
                Generate Situation Report
              </div>
              <div style={{ fontSize: '14px', color: '#666', maxWidth: '80%', margin: '0 auto' }}>
                Generate a comprehensive situation report for all active disasters and impacted facilities.
              </div>

              <button
                onClick={() => {
                  if (impactedFacilities.length > 0) {
                    onGenerateSitrep();
                    // Do not close the drawer - we'll show the report here
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  marginTop: '20px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: impactedFacilities.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: impactedFacilities.length > 0 ? 1 : 0.5,
                  pointerEvents: impactedFacilities.length > 0 ? 'auto' : 'none'
                }}
                disabled={impactedFacilities.length === 0 || sitrepLoading}
              >
                {sitrepLoading ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', animation: 'spin 1s linear infinite'}}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Generate Report
                  </>
                )}
              </button>

              {impactedFacilities.length === 0 && (
                <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
                  Upload facilities and assess impact first
                </div>
              )}

              {/* Display the sitrep if available */}
              {sitrep && !sitrepLoading && (
                <div style={{
                  marginTop: '25px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e0e0e0',
                    color: '#D32F2F'
                  }}>
                    Situation Report
                  </div>

                  <div className="sitrep-container" style={{ textAlign: 'left' }}>
                    <ReactMarkdown>
                      {sitrep}
                    </ReactMarkdown>
                  </div>

                  <div style={{
                    marginTop: '15px',
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={handleDownloadDoc}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Download Report (.doc)
                    </button>

                    <button
                      onClick={handleCopyToClipboard}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--aidstack-navy)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copy to Clipboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SitrepDrawer;
