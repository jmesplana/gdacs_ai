import React, { useState, useEffect } from 'react';
import FacilityDrawer from './FacilityDrawer';
import AnalysisDrawer from './AnalysisDrawer';
import SitrepDrawer from './SitrepDrawer';
import LogisticsDrawer from './LogisticsDrawer';

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
  recommendations,
  recommendationsLoading,
  recommendationsAIGenerated,
  recommendationsTimestamp,
  recommendationsFacilityKey,
  osmData,

  // Sitrep drawer props
  sitrep,
  sitrepTimestamp,
  logisticsData,
  logisticsLoading,
  logisticsError,
  onRunLogistics,

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
  selectedAnalysisDistricts = [],

  // Additional props
  onTabChange,
  operationType = 'general',
  worldPopData = {},

  // Label control
  showLabels,
  setShowLabels,
  showDistrictLabels,
  setShowDistrictLabels,

  // District label field selection
  districtAvailableFields,
  districtLabelField,
  onDistrictLabelFieldChange,
  adminNumericFields = [],
  adminFillMode,
  setAdminFillMode,
  adminMetricField,
  setAdminMetricField,
  adminMetricMeaning,
  setAdminMetricMeaning,
  adminClassification,
  setAdminClassification,
  adminClassCount,
  setAdminClassCount,
  adminNoDataStyle,
  setAdminNoDataStyle,
  adminDatasetJoinSummary,
  adminDatasetLegend = [],
  drawerMode = 'workspace'
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

  const hasFacilities = (facilities?.length || 0) > 0;
  const hasDistricts = (districts?.length || 0) > 0;
  const selectedDistrictCount = selectedAnalysisDistricts.length;
  const hasAcled = (acledData?.length || 0) > 0;
  const hasWorldPop = Object.keys(worldPopData || {}).length > 0;

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
      label: 'Site Analysis',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      disabled: !selectedFacility
    },
    {
      id: 'logistics',
      label: 'Logistics',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 3h1a4 4 0 0 1 4 4v9"></path>
          <path d="M2 7h15"></path>
          <path d="M6 3h7v18H6z"></path>
          <circle cx="9.5" cy="17.5" r="1.5"></circle>
          <path d="M13 17h8"></path>
        </svg>
      ),
      disabled: !hasDistricts && !logisticsData
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
      disabled: (impactedFacilities?.length || 0) === 0 && !sitrep
    },
  ];
  const visibleTabIdsByMode = {
    datahub: ['facilities'],
    analysis: ['analysis'],
    logistics: ['logistics'],
    reports: ['reports'],
    workspace: tabs.map((tab) => tab.id)
  };
  const visibleTabIds = visibleTabIdsByMode[drawerMode] || visibleTabIdsByMode.workspace;
  const visibleTabs = tabs.filter((tab) => visibleTabIds.includes(tab.id));

  const availableNow = [];

  if (hasDistricts) availableNow.push('district-based risk review');
  if (hasAcled) availableNow.push('security filtering');
  if (hasWorldPop) availableNow.push('population analysis');
  if (hasFacilities) availableNow.push('site impact analysis');

  const logisticsReadiness = [hasDistricts, hasAcled || hasFacilities].filter(Boolean).length;

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
              {drawerMode === 'datahub'
                ? 'Data Hub'
                : activeTab === 'analysis'
                  ? 'Site Analysis'
                  : activeTab === 'logistics'
                    ? 'Logistics Assessment'
                    : activeTab === 'reports'
                      ? 'Situation Report'
                      : 'Workspace'}
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
          {visibleTabs.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '4px',
              padding: '0 12px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}>
              {visibleTabs.map(tab => (
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
          )}
        </div>

        {/* Content Area */}
        <div style={{
          padding: '0',
          height: 'calc(100vh - 130px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: '10px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            background: '#F8FAFC'
          }}>
            {drawerMode === 'datahub' && (
              <div style={{
                background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)',
                border: '1px solid #fed7aa',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '11px',
                  color: '#9a3412',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                  marginBottom: '6px'
                }}>
                  Start Here
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#7c2d12',
                  lineHeight: '1.6',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  Upload sites, admin boundaries, and evidence layers here first. Analysis, logistics, and reports become useful after your data is loaded.
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '10px',
              marginBottom: '12px'
            }}>
              {[
                { label: 'Admin boundaries', loaded: hasDistricts },
                { label: 'Analysis scope', loaded: selectedDistrictCount > 0, value: selectedDistrictCount > 0 ? `${selectedDistrictCount} selected` : 'None selected' },
                { label: 'Sites', loaded: hasFacilities },
                { label: 'ACLED', loaded: hasAcled },
                { label: 'WorldPop', loaded: hasWorldPop }
              ].map((item) => (
                <div key={item.label} style={{
                  background: 'white',
                  border: `1px solid ${item.loaded ? '#A7F3D0' : '#E2E8F0'}`,
                  borderRadius: '10px',
                  padding: '10px 12px'
                }}>
                  <div style={{
                    fontSize: '10px',
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 700,
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: '4px'
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: item.loaded ? '#047857' : '#64748B',
                    fontWeight: 700,
                    fontFamily: "'Inter', sans-serif"
                  }}>
                    {item.value || (item.loaded ? 'Loaded' : 'Not loaded')}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: 'white',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '12px'
            }}>
              <div style={{
                fontSize: '11px',
                color: '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 700,
                fontFamily: "'Inter', sans-serif",
                marginBottom: '6px'
              }}>
                Available Now
              </div>
              <div style={{
                fontSize: '13px',
                color: '#334155',
                lineHeight: '1.6',
                fontFamily: "'Inter', sans-serif",
                marginBottom: '10px'
              }}>
                {availableNow.length > 0
                  ? `You can work with ${availableNow.join(', ')} using your current data.`
                  : 'Load any data source to start analyzing context. Sites are optional.'}
              </div>
              <div style={{
                fontSize: '12px',
                color: '#475569',
                fontFamily: "'Inter', sans-serif"
              }}>
                Logistics readiness: <strong>{logisticsReadiness}/2</strong> core inputs loaded
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748B',
                marginTop: '4px',
                fontFamily: "'Inter', sans-serif"
              }}>
                Requires admin boundaries plus either facilities or ACLED/security context.
              </div>
            </div>

          </div>

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
              adminNumericFields={adminNumericFields}
              adminFillMode={adminFillMode}
              setAdminFillMode={setAdminFillMode}
              adminMetricField={adminMetricField}
              setAdminMetricField={setAdminMetricField}
              adminMetricMeaning={adminMetricMeaning}
              setAdminMetricMeaning={setAdminMetricMeaning}
              adminClassification={adminClassification}
              setAdminClassification={setAdminClassification}
              adminClassCount={adminClassCount}
              setAdminClassCount={setAdminClassCount}
              adminNoDataStyle={adminNoDataStyle}
              setAdminNoDataStyle={setAdminNoDataStyle}
              adminDatasetJoinSummary={adminDatasetJoinSummary}
              adminDatasetLegend={adminDatasetLegend}
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
                  recommendations={recommendations}
                  recommendationsLoading={recommendationsLoading}
                  recommendationsAIGenerated={recommendationsAIGenerated}
                  recommendationsTimestamp={recommendationsTimestamp}
                  recommendationsFacilityKey={recommendationsFacilityKey}
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
                  <p>Select a site to view AI analysis</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div style={{ padding: '0 20px 24px 20px' }}>
              <SitrepDrawer
                embedded={true}
                isOpen={true}
                onClose={() => {}}
                sitrep={sitrep}
                timestamp={sitrepTimestamp}
                sitrepLoading={sitrepLoading}
                onGenerateSitrep={onGenerateSitrep}
                impactedFacilities={impactedFacilities}
                facilities={facilities}
              />
            </div>
          )}

          {activeTab === 'logistics' && (
            <div style={{ padding: '0 20px 24px 20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '20px 0 8px'
              }}>
                <div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--aidstack-navy)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    marginBottom: '6px'
                  }}>
                    Logistics Assessment
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                    Access, transport, fuel, airport, and security context for the current operational area.
                  </div>
                </div>
                <button
                  onClick={onRunLogistics}
                  disabled={!hasDistricts || logisticsLoading}
                  style={{
                    padding: '12px 18px',
                    backgroundColor: 'var(--aidstack-navy)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: !hasDistricts || logisticsLoading ? 'not-allowed' : 'pointer',
                    opacity: !hasDistricts || logisticsLoading ? 0.5 : 1
                  }}
                >
                  {logisticsLoading ? 'Running...' : 'Run Assessment'}
                </button>
              </div>

              {!hasDistricts && !logisticsData ? (
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '14px',
                  padding: '28px',
                  color: '#64748b',
                  textAlign: 'center'
                }}>
                  Upload admin boundaries and OSM context to enable logistics assessment.
                </div>
              ) : (
                <LogisticsDrawer
                  embedded={true}
                  isOpen={true}
                  onClose={() => {}}
                  data={logisticsData}
                  loading={logisticsLoading}
                  error={logisticsError}
                  onRetry={onRunLogistics}
                />
              )}
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
