import React from 'react';
import OSMInfrastructureSelector from './OSMInfrastructureSelector';

const MapLayersDrawer = ({
  isOpen,
  onClose,
  currentMapLayer,
  setCurrentMapLayer,
  showRoads,
  setShowRoads,
  // Support alternative prop format from UnifiedDrawer
  settings,
  onToggle,
  onConfigChange,
  embedded = false, // New prop for when embedded in UnifiedDrawer
  // OSM Infrastructure props
  districts,
  osmData,
  osmStats,
  osmLoading,
  osmLayerVisibility,
  onLoadOSM, // (selectedDistricts, selectedCategories) => void
  onOSMSelectionChange,
  onToggleOSMLayerVisibility,
  onClearOSMCategory
}) => {
  console.log('🗺️ MapLayersDrawer render:', {
    isOpen,
    embedded,
    hasDistricts: !!districts?.length,
    districtsCount: districts?.length,
    osmLoading,
    hasOnLoadOSM: !!onLoadOSM
  });
  // Use either direct props or settings object
  const activeMapLayer = currentMapLayer || settings?.currentMapLayer || 'street';
  const activeShowRoads = showRoads !== undefined ? showRoads : (settings?.showRoads || false);

  const handleMapLayerChange = (layer) => {
    if (setCurrentMapLayer) {
      setCurrentMapLayer(layer);
    } else if (onToggle) {
      onToggle('currentMapLayer', layer);
    } else if (onConfigChange) {
      onConfigChange({ currentMapLayer: layer });
    }
  };

  const handleShowRoadsChange = (value) => {
    if (setShowRoads) {
      setShowRoads(value);
    } else if (onToggle) {
      onToggle('showRoads', value);
    } else if (onConfigChange) {
      onConfigChange({ showRoads: value });
    }
  };

  // Content that will be shown (either embedded or in full drawer)
  const content = (
    <div style={{padding: '20px'}}>
      <h4 style={{marginBottom: '15px', color: '#333', fontSize: '16px'}}>Select Base Layer</h4>

      <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '4px', backgroundColor: activeMapLayer === 'street' ? '#e3f2fd' : 'transparent'}}>
          <input
            type="radio"
            name="mapLayer"
            value="street"
            checked={activeMapLayer === 'street'}
            onChange={() => handleMapLayerChange('street')}
            style={{marginRight: '10px'}}
          />
          <span>Street Map</span>
        </label>

        <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '4px', backgroundColor: activeMapLayer === 'satellite' ? '#e3f2fd' : 'transparent'}}>
          <input
            type="radio"
            name="mapLayer"
            value="satellite"
            checked={activeMapLayer === 'satellite'}
            onChange={() => handleMapLayerChange('satellite')}
            style={{marginRight: '10px'}}
          />
          <span>Satellite Imagery</span>
        </label>

        <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '4px', backgroundColor: activeMapLayer === 'terrain' ? '#e3f2fd' : 'transparent'}}>
          <input
            type="radio"
            name="mapLayer"
            value="terrain"
            checked={activeMapLayer === 'terrain'}
            onChange={() => handleMapLayerChange('terrain')}
            style={{marginRight: '10px'}}
          />
          <span>Terrain Map</span>
        </label>

        <div style={{borderTop: '1px solid #eee', margin: '15px 0', paddingTop: '15px'}}>
          <h4 style={{marginBottom: '10px', color: '#333', fontSize: '14px'}}>Overlay Options</h4>
          <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '4px', backgroundColor: activeShowRoads ? '#e3f2fd' : 'transparent'}}>
            <input
              type="checkbox"
              checked={activeShowRoads}
              onChange={() => handleShowRoadsChange(!activeShowRoads)}
              style={{marginRight: '10px'}}
            />
            <span>Show Road Network</span>
          </label>
        </div>

        {/* OSM Infrastructure Section */}
        <div style={{borderTop: '1px solid #eee', margin: '15px 0', paddingTop: '15px'}}>
          <OSMInfrastructureSelector
            districts={districts}
            osmData={osmData}
            osmStats={osmStats}
            osmLoading={osmLoading}
            osmLayerVisibility={osmLayerVisibility}
            onLoadOSM={onLoadOSM}
            onSelectionChange={onOSMSelectionChange}
            onToggleLayerVisibility={onToggleOSMLayerVisibility}
            onClearCategory={onClearOSMCategory}
          />
        </div>
      </div>
    </div>
  );

  // Return embedded content or full drawer
  if (embedded) {
    return content;
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
          {content}
        </div>
      </div>
    </>
  );
};

export default MapLayersDrawer;
