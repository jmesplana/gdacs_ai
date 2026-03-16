import React, { useState, useEffect } from 'react';
import FacilityDrawer from './FacilityDrawer';
import AnalysisDrawer from './AnalysisDrawer';
import SitrepDrawer from './SitrepDrawer';
import MapLayersDrawer from './MapLayersDrawer';

const UnifiedDrawer = ({
  isOpen,
  onClose,
  initialTab = 'facilities',

  // Facility drawer props
  impactedFacilities,
  onFacilitySelect,
  onFacilityViewOnMap,
  onFileUpload,
  onGenerateSitrep,
  sitrepLoading,
  facilities,
  onClearCache,
  acledData,
  acledEnabled,
  acledConfig,
  onAcledUpload,
  onClearAcledCache,
  onToggleAcled,
  onAcledConfigChange,
  districts,
  onDistrictsLoaded,

  // Analysis drawer props
  selectedFacility,
  analysis,
  analysisLoading,
  onViewRecommendations,
  osmData,

  // Sitrep drawer props
  sitrep,
  sitrepTimestamp,

  // Layers drawer props
  layerSettings,
  onLayerToggle,
  onLayerConfigChange,
  onOSMRefresh,
  onOSMToggle,
  onOSMLayerToggle,
  onOSMDistrictSelect,
  osmStats,
  osmLoading,
  osmLayerVisibility,
  onLoadOSM, // New: (selectedDistricts, selectedCategories) => void
  onToggleOSMLayerVisibility,
  onClearOSMCategory,

  // Additional props
  onTabChange,
  operationType = 'general',

  // Label control
  showLabels,
  setShowLabels,
  showDistrictLabels,
  setShowDistrictLabels,

  // District label field selection
  districtAvailableFields,
  districtLabelField,
  onDistrictLabelFieldChange
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync local activeTab with prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const tabs = [
    {
      id: 'facilities',
      label: 'Data Hub',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      ),
      badge: facilities?.length || 0
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      disabled: !selectedFacility
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
      ),
      disabled: !sitrep
    },
    {
      id: 'layers',
      label: 'Layers',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      )
    }
  ];

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div
        className={`drawer drawer-right ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          zIndex: 3000,
          width: '480px',
          maxWidth: '90vw'
        }}
      >
        {/* Header with Tabs */}
        <div style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          margin: '-20px -20px 0 -20px',
          padding: '0',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {/* Close button and title */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '15px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: '700',
              fontFamily: "'Space Grotesk', sans-serif",
              margin: 0
            }}>
              Data Hub
            </h3>
            <button
              className="drawer-close"
              onClick={(e) => {
                console.log('Close button clicked');
                e.stopPropagation();
                onClose();
              }}
              style={{
                color: 'white',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '4px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '24px',
                transition: 'background 0.2s',
                position: 'relative',
                zIndex: 9999,
                pointerEvents: 'auto'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
            >
              ×
            </button>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '0 12px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && handleTabChange(tab.id)}
                disabled={tab.disabled}
                style={{
                  flex: '1 1 auto',
                  minWidth: '80px',
                  padding: '12px 16px',
                  background: activeTab === tab.id
                    ? 'white'
                    : 'transparent',
                  color: activeTab === tab.id
                    ? 'var(--aidstack-navy)'
                    : 'rgba(255,255,255,0.7)',
                  border: 'none',
                  borderRadius: activeTab === tab.id ? '8px 8px 0 0' : '0',
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: "'Inter', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  opacity: tab.disabled ? 0.4 : 1,
                  position: 'relative',
                  marginTop: activeTab === tab.id ? '0' : '4px'
                }}
                onMouseEnter={(e) => {
                  if (!tab.disabled && activeTab !== tab.id) {
                    e.target.style.background = 'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.background = 'transparent';
                  }
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span style={{
                    backgroundColor: activeTab === tab.id
                      ? 'var(--aidstack-orange)'
                      : 'rgba(255,255,255,0.2)',
                    color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.9)',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div style={{
          padding: '0',
          height: 'calc(100vh - 130px)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {activeTab === 'facilities' && (
            <FacilityDrawer
              isOpen={true}
              onClose={() => {}} // Don't close, just switch tabs
              embedded={true} // Render content only, no wrapper
              impactedFacilities={impactedFacilities}
              onFacilitySelect={onFacilitySelect}
              onFacilityViewOnMap={onFacilityViewOnMap}
              onFileUpload={onFileUpload}
              onGenerateSitrep={onGenerateSitrep}
              sitrepLoading={sitrepLoading}
              facilities={facilities}
              onClearCache={onClearCache}
              acledData={acledData}
              acledEnabled={acledEnabled}
              acledConfig={acledConfig}
              onAcledUpload={onAcledUpload}
              onClearAcledCache={onClearAcledCache}
              onToggleAcled={onToggleAcled}
              onAcledConfigChange={onAcledConfigChange}
              districts={districts}
              onDistrictsLoaded={onDistrictsLoaded}
              showLabels={showLabels}
              setShowLabels={setShowLabels}
              showDistrictLabels={showDistrictLabels}
              setShowDistrictLabels={setShowDistrictLabels}
              districtAvailableFields={districtAvailableFields}
              districtLabelField={districtLabelField}
              onDistrictLabelFieldChange={onDistrictLabelFieldChange}
            />
          )}

          {activeTab === 'analysis' && (
            <div>
              {selectedFacility ? (
                <AnalysisDrawer
                  isOpen={false}
                  onClose={() => {}}
                  selectedFacility={selectedFacility}
                  analysisData={analysis}
                  analysisLoading={analysisLoading}
                  impactedFacilities={impactedFacilities}
                  acledData={acledData}
                  acledEnabled={acledEnabled}
                  operationType={operationType}
                  onViewRecommendations={onViewRecommendations}
                  osmData={osmData}
                />
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                  <p>Select a facility to view AI analysis</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div style={{ margin: '-20px' }}>
              {sitrep ? (
                <SitrepDrawer
                  isOpen={true}
                  onClose={() => {}}
                  sitrep={sitrep}
                  timestamp={sitrepTimestamp}
                />
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#666'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <p>No reports generated yet</p>
                  <p style={{ fontSize: '13px', marginTop: '8px' }}>
                    Upload facilities and generate a situation report from the Facilities tab
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'layers' && (
            <div style={{ margin: '-20px' }}>
              <MapLayersDrawer
                isOpen={true}
                onClose={() => {}}
                embedded={true}
                settings={layerSettings}
                onToggle={onLayerToggle}
                onConfigChange={onLayerConfigChange}
                districts={districts}
                osmData={osmData}
                osmStats={osmStats}
                osmLoading={osmLoading}
                osmLayerVisibility={osmLayerVisibility}
                onLoadOSM={onLoadOSM}
                onToggleOSMLayerVisibility={onToggleOSMLayerVisibility}
                onClearOSMCategory={onClearOSMCategory}
              />
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .drawer-backdrop {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2999;
          transition: opacity 0.3s ease;
        }
        .drawer-backdrop.open {
          display: block;
        }
        .drawer {
          position: fixed;
          top: 0;
          bottom: 0;
          background: white;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
          transition: transform 0.3s ease;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .drawer-right {
          right: 0;
          transform: translateX(100%);
        }
        .drawer.open {
          transform: translateX(0);
        }
        .drawer-content {
          flex: 1;
          overflow-y: auto;
        }
        /* Hide scrollbar for tab navigation */
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default UnifiedDrawer;
