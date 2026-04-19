import React from 'react';

export default function NarrativePanel({ narrative, loading, error, onRegenerate }) {
  if (loading) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--aidstack-navy)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--aidstack-navy)',
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            Generating AI Analysis...
          </div>
        </div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          fontFamily: "'Inter', sans-serif"
        }}>
          Analyzing trends and generating strategic insights
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#fee2e2',
        border: '1px solid #fecaca',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          fontSize: '13px',
          color: '#991b1b',
          marginBottom: '8px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <strong>Failed to generate narrative:</strong> {error}
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif"
            }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!narrative) {
    return null;
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid #bae6fd',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
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
            style={{ color: '#0284c7' }}
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#0c4a6e',
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            AI Strategic Analysis
          </div>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            style={{
              background: 'white',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Refresh
          </button>
        )}
      </div>

      {/* Narrative Content */}
      <div
        style={{
          fontSize: '13px',
          lineHeight: '1.7',
          color: '#0c4a6e',
          fontFamily: "'Inter', sans-serif",
          whiteSpace: 'pre-wrap'
        }}
        dangerouslySetInnerHTML={{
          __html: narrative
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n- /g, '\n• ')
            .replace(/\n/g, '<br/>')
        }}
      />

      {/* AI Badge */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid #bae6fd',
        fontSize: '10px',
        color: '#0369a1',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h-2a5 5 0 0 0-5-5h-1v1.27c.6.35 1 .99 1 1.73 0 1.1-.9 2-2 2s-2-.9-2-2c0-.74.4-1.38 1-1.73V9h-1a5 5 0 0 0-5 5H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          <path d="M12 16v6"/>
        </svg>
        Generated by GPT-4o
      </div>
    </div>
  );
}
