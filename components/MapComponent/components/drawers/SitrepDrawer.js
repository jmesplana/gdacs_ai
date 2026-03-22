import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../../../Toast';

const SitrepDrawer = ({
  isOpen,
  onClose,
  sitrep,
  timestamp,
  sitrepLoading,
  onGenerateSitrep,
  disasters,
  facilities,
  impactedFacilities = [],
  embedded = false
}) => {
  const { addToast } = useToast();
  const [progressMsg, setProgressMsg] = useState('');
  useEffect(() => {
    if (!sitrepLoading) { setProgressMsg(''); return; }
    const msgs = [
      'Analyzing disaster impacts...',
      'Reviewing facility exposure...',
      'Compiling situation data...',
      'Drafting situation report...',
      'Almost done...'
    ];
    let i = 0;
    setProgressMsg(msgs[0]);
    const interval = setInterval(() => {
      i = (i + 1) % msgs.length;
      setProgressMsg(msgs[i]);
    }, 4000);
    return () => clearInterval(interval);
  }, [sitrepLoading]);

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
        addToast('Report copied to clipboard', 'success');
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
      addToast('Report copied to clipboard', 'success');
    }
  };

  const isTableRow = (line) => {
    const trimmed = line.trim();
    return trimmed.includes('|') && !trimmed.startsWith('```');
  };

  const isTableSeparator = (line) => {
    const normalized = line.trim().replace(/\|/g, '').replace(/:/g, '').replace(/-/g, '').trim();
    return normalized.length === 0 && line.includes('-');
  };

  const parseTableRow = (line) => {
    return line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  };

  const renderSitrepContent = (content) => {
    if (!content) return null;

    const lines = content.split('\n');
    const blocks = [];
    let currentMarkdown = [];
    let i = 0;

    const flushMarkdown = () => {
      const markdown = currentMarkdown.join('\n').trim();
      if (markdown) {
        blocks.push({ type: 'markdown', content: markdown });
      }
      currentMarkdown = [];
    };

    while (i < lines.length) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];

      if (isTableRow(currentLine) && nextLine && isTableSeparator(nextLine)) {
        flushMarkdown();

        const header = parseTableRow(currentLine);
        const rows = [];
        i += 2;

        while (i < lines.length && isTableRow(lines[i])) {
          rows.push(parseTableRow(lines[i]));
          i += 1;
        }

        blocks.push({ type: 'table', header, rows });
        continue;
      }

      currentMarkdown.push(currentLine);
      i += 1;
    }

    flushMarkdown();

    return blocks.map((block, index) => {
      if (block.type === 'table') {
        return (
          <div key={`table-${index}`} className="sitrep-table-wrap">
            <table className="sitrep-table">
              <thead>
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={`th-${cellIndex}`}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`tr-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`td-${rowIndex}-${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      return (
        <ReactMarkdown
          key={`md-${index}`}
          components={{
            h1: ({ children }) => <h1>{children}</h1>,
            h2: ({ children }) => <h2>{children}</h2>,
            h3: ({ children }) => <h3>{children}</h3>,
            p: ({ children }) => <p>{children}</p>,
            ul: ({ children }) => <ul>{children}</ul>,
            ol: ({ children }) => <ol>{children}</ol>,
            li: ({ children }) => <li>{children}</li>,
            strong: ({ children }) => <strong>{children}</strong>
          }}
        >
          {block.content}
        </ReactMarkdown>
      );
    });
  };

  const reportBody = (
    <div className="drawer-content">
      <div className="drawer-section">
        <div style={{ padding: embedded ? '20px 0 8px 0' : '0' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '18px',
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--aidstack-navy)',
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: '6px'
              }}>
                Situation Report
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                Operational summary for current disasters, facility exposure, and response context.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{
                backgroundColor: '#eef2ff',
                color: '#334155',
                borderRadius: '999px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 700
              }}>
                {impactedFacilities.length} impacted facilities
              </div>
              {timestamp && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  borderRadius: '999px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  Updated {new Date(timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '18px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '12px'
            }}>
              <div style={{ maxWidth: '520px' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                  Generate or refresh the current report
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                  Uses the current disaster filter, impacted facilities, ACLED context, OSM context, and population data already loaded in the workspace.
                </div>
              </div>
              <button
                onClick={() => {
                  if (impactedFacilities.length > 0) {
                    onGenerateSitrep(true);
                  }
                }}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'var(--aidstack-navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: impactedFacilities.length > 0 && !sitrepLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: impactedFacilities.length > 0 && !sitrepLoading ? 1 : 0.5,
                  pointerEvents: impactedFacilities.length > 0 && !sitrepLoading ? 'auto' : 'none'
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
                    {progressMsg || 'Starting...'}
                  </>
                ) : (
                  sitrep ? 'Refresh Report' : 'Generate Report'
                )}
              </button>
            </div>

            {impactedFacilities.length === 0 && (
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Upload facilities and run impact assessment first.
              </div>
            )}
          </div>

          {sitrepLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', animation: 'spin 1s linear infinite' }}>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Generating report</div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>{progressMsg || 'Starting...'}</div>
            </div>
          ) : sitrep ? (
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 16px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                flexWrap: 'wrap'
              }}>
                <div style={{ fontSize: '13px', color: '#475569', fontWeight: 700 }}>
                  Report Output
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleCopyToClipboard}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'white',
                      color: 'var(--aidstack-navy)',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleDownloadDoc}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--aidstack-orange)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    Download .doc
                  </button>
                </div>
              </div>

              <div className="sitrep-rich-content">
                {renderSitrepContent(sitrep)}
              </div>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fff',
              border: '1px dashed #cbd5e1',
              borderRadius: '14px',
              padding: '28px',
              color: '#64748b',
              textAlign: 'center'
            }}>
              Generate a situation report to populate this panel.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .sitrep-rich-content {
          padding: 24px;
          line-height: 1.75;
          color: #1f2937;
          font-size: 14px;
        }

        .sitrep-rich-content :global(h1) {
          margin: 0 0 18px 0;
          font-size: 28px;
          line-height: 1.2;
          color: #0f172a;
          font-family: 'Space Grotesk', sans-serif;
        }

        .sitrep-rich-content :global(h2) {
          margin: 28px 0 12px 0;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          font-size: 18px;
          line-height: 1.3;
          color: var(--aidstack-navy);
          font-family: 'Space Grotesk', sans-serif;
        }

        .sitrep-rich-content :global(h3) {
          margin: 18px 0 8px 0;
          font-size: 15px;
          color: #334155;
          font-weight: 700;
        }

        .sitrep-rich-content :global(p) {
          margin: 0 0 12px 0;
        }

        .sitrep-rich-content :global(ul),
        .sitrep-rich-content :global(ol) {
          margin: 0 0 14px 0;
          padding-left: 20px;
        }

        .sitrep-rich-content :global(li) {
          margin-bottom: 8px;
        }

        .sitrep-rich-content :global(strong) {
          color: #0f172a;
        }

        .sitrep-table-wrap {
          overflow-x: auto;
          margin: 0 0 16px 0;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .sitrep-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          line-height: 1.5;
          background: white;
        }

        .sitrep-table th {
          background: #f8fafc;
          color: #0f172a;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 700;
          white-space: nowrap;
        }

        .sitrep-table td {
          padding: 10px 12px;
          border-top: 1px solid #e2e8f0;
          color: #334155;
          vertical-align: top;
        }
      `}</style>
    </div>
  );

  if (embedded) {
    return reportBody;
  }

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
            Situation Report
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        {reportBody}
      </div>
    </>
  );
};

export default SitrepDrawer;
