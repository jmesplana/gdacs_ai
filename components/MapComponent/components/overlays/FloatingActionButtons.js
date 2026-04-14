import { DRAWING_COLORS } from '../../constants/mapConstants';

const FloatingActionButtons = ({
  onLayersClick,
  onFilterClick,
  drawingEnabled,
  onDrawClick,
  annotationMode,
  freehandMode,
  onAddAnnotation,
  onToggleFreehand,
  drawingColor,
  setDrawingColor,
  onUndoDrawing,
  onClearDrawings,
  drawingsCount,
  onLogisticsClick,
  hasDistricts = false,
  logisticsLoading = false
}) => {
  return (
    <>
      {/* Layers FAB - map-native access similar to consumer maps */}
      {onLayersClick && (
        <button
          type="button"
          onClick={onLayersClick}
          title="Map Layers"
          style={{
            position: 'absolute',
            top: '76px',
            right: '20px',
            zIndex: 1500,
            backgroundColor: 'white',
            color: 'var(--aidstack-navy)',
            border: '2px solid rgba(15, 23, 42, 0.08)',
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8FAFC';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </button>
      )}

      {onFilterClick && (
        <button
          type="button"
          onClick={onFilterClick}
          title="Filters"
          style={{
            position: 'absolute',
            top: '132px',
            right: '20px',
            zIndex: 1500,
            backgroundColor: 'white',
            color: 'var(--aidstack-navy)',
            border: '2px solid rgba(15, 23, 42, 0.08)',
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F8FAFC';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
        </button>
      )}

      {/* Logistics Assessment FAB - appears when districts are loaded */}
      {hasDistricts && onLogisticsClick && (
        <button
          type="button"
          onClick={onLogisticsClick}
          disabled={logisticsLoading}
          title="Assess Logistics Accessibility"
          style={{
            position: 'absolute',
            bottom: '20px',
            right: drawingEnabled ? '220px' : '140px', // Position to left of draw button
            zIndex: 1500,
            backgroundColor: 'white',
            color: 'var(--aidstack-navy)',
            border: '2px solid rgba(15, 23, 42, 0.08)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: '14px',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: logisticsLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.3s ease',
            opacity: logisticsLoading ? 0.7 : 1
          }}
          onMouseEnter={(e) => {
            if (!logisticsLoading) {
              e.currentTarget.style.backgroundColor = '#F8FAFC';
              e.currentTarget.style.borderColor = 'var(--aidstack-orange)';
              e.currentTarget.style.color = 'var(--aidstack-orange)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!logisticsLoading) {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = 'rgba(15, 23, 42, 0.08)';
              e.currentTarget.style.color = 'var(--aidstack-navy)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {logisticsLoading ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', animation: 'spin 1s linear infinite'}}>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M16 3h1a4 4 0 0 1 4 4v9"></path>
                <path d="M2 7h15"></path>
                <path d="M6 3h7v18H6z"></path>
                <circle cx="9.5" cy="17.5" r="1.5"></circle>
                <path d="M13 17h8"></path>
              </svg>
              Logistics
            </>
          )}
        </button>
      )}

      {/* Draw button */}
      <button
        type="button"
        className="drawer-toggle drawer-toggle-draw"
        onClick={onDrawClick}
        title={drawingEnabled ? "Hide Drawing Tools" : "Show Drawing Tools"}
        style={{
          position: 'absolute',
          top: '188px',
          right: '20px',
          zIndex: 1500,
          backgroundColor: drawingEnabled ? 'var(--aidstack-orange)' : 'white',
          color: drawingEnabled ? 'white' : 'var(--aidstack-navy)',
          border: drawingEnabled ? '2px solid var(--aidstack-orange)' : '2px solid var(--aidstack-navy)',
          width: '48px',
          height: '48px',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          if (!drawingEnabled) {
            e.currentTarget.style.backgroundColor = 'var(--aidstack-orange)';
            e.currentTarget.style.color = 'white';
          }
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          if (!drawingEnabled) {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.color = 'var(--aidstack-navy)';
          }
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
      </button>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Color Picker - appears above draw button when drawing enabled */}
      {drawingEnabled && (
        <div style={{
          position: 'absolute',
          top: '244px',
          right: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid #e0e0e0',
          zIndex: 1500,
          minWidth: '200px'
        }}>
          <div style={{
            marginBottom: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--aidstack-navy)',
            textTransform: 'uppercase',
            fontFamily: "'Inter', sans-serif"
          }}>
            Drawing Color
          </div>
          <div style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            marginBottom: '12px'
          }}>
            {DRAWING_COLORS.map(color => (
              <button
                type="button"
                key={color}
                onClick={() => setDrawingColor(color)}
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: color,
                  border: drawingColor === color ? '3px solid #333' : '1px solid #ccc',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title={`Select ${color}`}
              />
            ))}
          </div>
          <div style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '8px'
          }}>
            <button
              type="button"
              onClick={onToggleFreehand}
              title="Freehand Draw"
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: freehandMode ? 'var(--aidstack-orange)' : 'white',
                color: freehandMode ? 'white' : 'var(--aidstack-navy)',
                border: `1px solid ${freehandMode ? 'var(--aidstack-orange)' : 'var(--aidstack-slate-light)'}`,
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {freehandMode ? 'Freehand Active' : 'Freehand'}
            </button>
          </div>
          <div style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '8px'
          }}>
            <button
              type="button"
              onClick={onAddAnnotation}
              title="Add Note to Map"
              style={{
                width: '100%',
                padding: '6px 8px',
                backgroundColor: annotationMode ? 'var(--aidstack-orange)' : 'white',
                color: annotationMode ? 'white' : 'var(--aidstack-navy)',
                border: `1px solid ${annotationMode ? 'var(--aidstack-orange)' : 'var(--aidstack-slate-light)'}`,
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {annotationMode ? 'Click Map To Place Note' : 'Add Note'}
            </button>
          </div>
          <div style={{
            display: 'flex',
            gap: '6px'
          }}>
            <button
              type="button"
              onClick={onUndoDrawing}
              disabled={drawingsCount === 0}
              title="Undo Last Drawing"
              style={{
                flex: 1,
                padding: '6px 8px',
                backgroundColor: drawingsCount > 0 ? 'var(--aidstack-light-gray)' : '#f8f8f8',
                color: drawingsCount > 0 ? 'var(--aidstack-navy)' : '#999',
                border: `1px solid ${drawingsCount > 0 ? 'var(--aidstack-slate-light)' : '#ddd'}`,
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                cursor: drawingsCount > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onClearDrawings}
              disabled={drawingsCount === 0}
              title="Clear All Drawings"
              style={{
                flex: 1,
                padding: '6px 8px',
                backgroundColor: drawingsCount > 0 ? 'var(--color-error)' : '#f8f8f8',
                color: drawingsCount > 0 ? 'white' : '#999',
                border: `1px solid ${drawingsCount > 0 ? 'var(--color-error)' : '#ddd'}`,
                borderRadius: '4px',
                fontSize: '11px',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                cursor: drawingsCount > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FloatingActionButtons;
