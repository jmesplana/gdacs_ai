import React from 'react';

const MapLayersDrawer = ({
  isOpen,
  onClose,
  currentMapLayer,
  setCurrentMapLayer,
  showRoads,
  setShowRoads
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
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            Map Layers
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        <div className="drawer-content">
          <div style={{padding: '20px 0'}}>
            <h4 style={{marginBottom: '15px', color: '#333', fontSize: '16px'}}>Select Base Layer</h4>

            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '4px', backgroundColor: currentMapLayer === 'street' ? '#e3f2fd' : 'transparent'}}>
                <input
                  type="radio"
                  name="mapLayer"
                  value="street"
                  checked={currentMapLayer === 'street'}
                  onChange={() => setCurrentMapLayer('street')}
                  style={{marginRight: '10px'}}
                />
                <span>Street Map</span>
              </label>

              <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '4px', backgroundColor: currentMapLayer === 'satellite' ? '#e3f2fd' : 'transparent'}}>
                <input
                  type="radio"
                  name="mapLayer"
                  value="satellite"
                  checked={currentMapLayer === 'satellite'}
                  onChange={() => setCurrentMapLayer('satellite')}
                  style={{marginRight: '10px'}}
                />
                <span>Satellite Imagery</span>
              </label>

              <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '4px', backgroundColor: currentMapLayer === 'terrain' ? '#e3f2fd' : 'transparent'}}>
                <input
                  type="radio"
                  name="mapLayer"
                  value="terrain"
                  checked={currentMapLayer === 'terrain'}
                  onChange={() => setCurrentMapLayer('terrain')}
                  style={{marginRight: '10px'}}
                />
                <span>Terrain Map</span>
              </label>

              <div style={{borderTop: '1px solid #eee', margin: '15px 0', paddingTop: '15px'}}>
                <h4 style={{marginBottom: '10px', color: '#333', fontSize: '14px'}}>Overlay Options</h4>
                <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '4px', backgroundColor: showRoads ? '#e3f2fd' : 'transparent'}}>
                  <input
                    type="checkbox"
                    checked={showRoads}
                    onChange={() => setShowRoads(!showRoads)}
                    style={{marginRight: '10px'}}
                  />
                  <span>Show Road Network</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MapLayersDrawer;
