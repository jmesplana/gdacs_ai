import { DRAWING_COLORS } from '../../constants/mapConstants';

const FloatingActionButtons = ({
  onFilterClick,
  onFacilitiesClick,
  onSitrepClick,
  onLayersClick,
  onHelpClick,
  drawingEnabled,
  onDrawClick,
  drawingColor,
  setDrawingColor,
  onUndoDrawing,
  onClearDrawings,
  drawingsCount
}) => {
  return (
    <>
      {/* Floating action buttons */}
      <button
        className="drawer-toggle drawer-toggle-right"
        onClick={onFilterClick}
        title="Filter Disasters"
        style={{
          backgroundColor: 'white',
          color: 'var(--aidstack-navy)',
          border: '2px solid var(--aidstack-navy)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        Filters
      </button>

      <button
        className="drawer-toggle drawer-toggle-facilities"
        onClick={onFacilitiesClick}
        title="Manage Facilities"
        style={{
          backgroundColor: 'white',
          color: 'var(--aidstack-navy)',
          border: '2px solid var(--aidstack-navy)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Facilities
      </button>

      <button
        className="drawer-toggle drawer-toggle-sitrep"
        onClick={onSitrepClick}
        title="Generate Report"
        style={{
          backgroundColor: 'white',
          color: 'var(--aidstack-navy)',
          border: '2px solid var(--aidstack-orange)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Sitrep
      </button>

      <button
        className="drawer-toggle drawer-toggle-layers"
        onClick={onLayersClick}
        title="Map Layers"
        style={{
          backgroundColor: 'white',
          color: 'var(--aidstack-navy)',
          border: '2px solid var(--aidstack-navy)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        Layers
      </button>

      <button
        type="button"
        className="drawer-toggle drawer-toggle-draw"
        onClick={onDrawClick}
        title={drawingEnabled ? "Hide Drawing Tools" : "Show Drawing Tools"}
        style={{
          backgroundColor: drawingEnabled ? 'var(--aidstack-orange)' : 'white',
          color: drawingEnabled ? 'white' : 'var(--aidstack-navy)',
          border: drawingEnabled ? '2px solid var(--aidstack-orange)' : '2px solid var(--aidstack-navy)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
        Draw
      </button>

      <button
        className="drawer-toggle drawer-toggle-help"
        onClick={onHelpClick}
        title="Help Guide"
        style={{
          backgroundColor: 'white',
          color: 'var(--aidstack-navy)',
          border: '2px solid var(--aidstack-orange)',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        Help
      </button>

      {/* Color Picker - appears below buttons when drawing enabled */}
      {drawingEnabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '10px',
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          border: '1px solid #e0e0e0',
          zIndex: 1000,
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
