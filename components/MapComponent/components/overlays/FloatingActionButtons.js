import { DRAWING_COLORS } from '../../constants/mapConstants';

const FloatingActionButtons = ({
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
      {/* Single Draw button - other controls moved to hamburger menu */}
      <button
        type="button"
        className="drawer-toggle drawer-toggle-draw"
        onClick={onDrawClick}
        title={drawingEnabled ? "Hide Drawing Tools" : "Show Drawing Tools"}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 1500,
          backgroundColor: drawingEnabled ? 'var(--aidstack-orange)' : 'white',
          color: drawingEnabled ? 'white' : 'var(--aidstack-navy)',
          border: drawingEnabled ? '2px solid var(--aidstack-orange)' : '2px solid var(--aidstack-navy)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize: '15px',
          padding: '12px 20px',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
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
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
        {drawingEnabled ? 'Hide Drawing' : 'Draw'}
      </button>

      {/* Color Picker - appears above draw button when drawing enabled */}
      {drawingEnabled && (
        <div style={{
          position: 'absolute',
          bottom: '80px',
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
