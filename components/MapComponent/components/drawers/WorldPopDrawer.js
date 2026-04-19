import React, { useState } from 'react';
import { WORLDPOP_YEARS, AGE_GROUPS, WORLDPOP_TILE_LAYERS, extractCountryFromDistricts, formatPopNumber } from '../../../../utils/worldpopHelpers';

const WorldPopDrawer = ({
  isOpen,
  onClose,
  districts = [],
  selectedDistricts = [],
  worldPopData = {},
  isLoading = false,
  error = null,
  lastFetchParams = null,
  showWorldPopLayer,
  activeLayerType,
  setActiveLayerType,
  toggleWorldPopLayer,
  fetchWorldPopData,
  clearWorldPopData,
  scopeToShapefile,
  toggleScopeToShapefile,
}) => {
  const [selectedYear, setSelectedYear] = useState(2020);
  const [selectedDataType, setSelectedDataType] = useState('total');
  const [loadAllDistricts, setLoadAllDistricts] = useState(false);

  const country = extractCountryFromDistricts(districts);
  const hasData = Object.keys(worldPopData).length > 0;
  const totalPop = hasData
    ? Object.values(worldPopData).reduce((sum, d) => sum + (d.total || 0), 0)
    : 0;

  const handleFetch = () => {
    const districtsToLoad = loadAllDistricts ? districts : selectedDistricts;
    if (!loadAllDistricts && selectedDistricts.length === 0) {
      // Show error if trying to load selected districts but none are selected
      return;
    }
    fetchWorldPopData(districtsToLoad, selectedYear, selectedDataType);
  };

  const sortedDistricts = hasData
    ? [...districts].sort((a, b) => {
        const popA = worldPopData[String(a.id)]?.total || 0;
        const popB = worldPopData[String(b.id)]?.total || 0;
        return popB - popA;
      })
    : [];

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div
        className={`drawer drawer-right ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 3000, width: '380px' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 20px -20px',
          padding: '20px',
        }}>
          <h3 className="drawer-title" style={{ color: 'white', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Population Data
          </h3>
          <button className="drawer-close" onClick={onClose} style={{ color: 'white' }}>×</button>
        </div>

        <div className="drawer-content" style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Source badge */}
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>WorldPop Global 2</span>
            <span>via Google Earth Engine · 100m resolution</span>
          </div>

          {/* No districts warning */}
          {districts.length === 0 && (
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#92400E', marginBottom: '16px' }}>
              Upload a shapefile first to load population data by admin boundary.
            </div>
          )}

          {/* Configuration */}
          {districts.length > 0 && (
            <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', marginBottom: '16px', border: '1px solid #E2E8F0' }}>
              {country && (
                <div style={{ marginBottom: '10px', fontSize: '13px', color: '#475569' }}>
                  <strong>Country:</strong> {country} &nbsp;·&nbsp; <strong>{districts.length}</strong> admin units
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', background: 'white' }}
                  >
                    {WORLDPOP_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Data Type</label>
                  <select
                    value={selectedDataType}
                    onChange={(e) => setSelectedDataType(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px', background: 'white' }}
                  >
                    <option value="total">Total Population</option>
                    <option value="agesex">Age &amp; Sex Breakdown</option>
                  </select>
                </div>
              </div>

              {/* District selection toggle */}
              <div style={{ marginBottom: '12px', padding: '10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={loadAllDistricts}
                    onChange={() => setLoadAllDistricts(!loadAllDistricts)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '12px', color: '#1E40AF' }}>
                    <div style={{ fontWeight: 600 }}>Load all districts</div>
                    <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>
                      {loadAllDistricts
                        ? `Loading population for all ${districts.length} districts`
                        : selectedDistricts.length > 0
                          ? `Loading population for ${selectedDistricts.length} selected district${selectedDistricts.length > 1 ? 's' : ''} only`
                          : 'No districts selected - select districts on the map first'}
                    </div>
                  </div>
                </label>
              </div>

              {/* Geographic scope toggle */}
              <div style={{ marginBottom: '12px', padding: '10px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={scopeToShapefile}
                    onChange={toggleScopeToShapefile}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '12px', color: '#92400E' }}>
                    <div style={{ fontWeight: 600 }}>Limit to shapefile area</div>
                    <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>
                      {scopeToShapefile
                        ? 'Showing population only within uploaded boundaries'
                        : 'Showing global population (including neighboring regions)'}
                    </div>
                  </div>
                </label>
              </div>

              {!loadAllDistricts && selectedDistricts.length === 0 && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '6px', padding: '10px', fontSize: '12px', color: '#92400E', marginBottom: '12px' }}>
                  Select one or more districts on the map first, or check "Load all districts" above.
                </div>
              )}

              <button
                onClick={handleFetch}
                disabled={isLoading || (!loadAllDistricts && selectedDistricts.length === 0)}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: (isLoading || (!loadAllDistricts && selectedDistricts.length === 0)) ? '#94A3B8' : 'var(--aidstack-navy, #1B3A5C)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (isLoading || (!loadAllDistricts && selectedDistricts.length === 0)) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Fetching from Earth Engine…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Load Population Data
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#991B1B', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* Results */}
          {hasData && !isLoading && (
            <>
              {/* Summary card */}
              <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F0FDF4 100%)', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1D4ED8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Population · {lastFetchParams?.year}
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#1B3A5C', lineHeight: 1 }}>
                  {formatPopNumber(totalPop)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                  across {sortedDistricts.length} admin units
                </div>
              </div>

              {/* Map overlay toggle */}
              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Map Overlay</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={showWorldPopLayer}
                    onChange={() => {
                      console.log('[WorldPopDrawer] Checkbox clicked, current:', showWorldPopLayer, 'calling toggle');
                      toggleWorldPopLayer();
                    }}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', color: '#374151' }}>Show population density heatmap</span>
                </label>
                {showWorldPopLayer && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    {Object.values(WORLDPOP_TILE_LAYERS).map((layer) => (
                      <button
                        key={layer.id}
                        onClick={() => setActiveLayerType(layer.id)}
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '5px',
                          border: `1.5px solid ${activeLayerType === layer.id ? '#1D4ED8' : '#D1D5DB'}`,
                          background: activeLayerType === layer.id ? '#EFF6FF' : 'white',
                          color: activeLayerType === layer.id ? '#1D4ED8' : '#6B7280',
                          cursor: 'pointer',
                        }}
                      >
                        {layer.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Age group legend (if agesex) */}
              {lastFetchParams?.dataType === 'agesex' && (
                <div style={{ marginBottom: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {AGE_GROUPS.map((g) => (
                    <span key={g.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#374151' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: g.color, display: 'inline-block' }} />
                      {g.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Per-district table */}
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Districts ({sortedDistricts.length})
              </div>
              <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                {sortedDistricts.map((district) => {
                  const data = worldPopData[String(district.id)];
                  if (!data) return null;
                  const pct = totalPop > 0 ? Math.round((data.total / totalPop) * 100) : 0;

                  return (
                    <div key={district.id} style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>{district.name || `District ${district.id}`}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1B3A5C' }}>{formatPopNumber(data.total)}</span>
                      </div>

                      {/* Population bar */}
                      <div style={{ background: '#F1F5F9', borderRadius: '99px', height: '4px', margin: '6px 0' }}>
                        <div style={{ background: '#3B82F6', borderRadius: '99px', height: '4px', width: `${pct}%` }} />
                      </div>

                      {/* Age groups */}
                      {data.ageGroups && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {AGE_GROUPS.map((g) => (
                            <span key={g.key} style={{ fontSize: '10px', color: '#64748B' }}>
                              <span style={{ color: g.color, fontWeight: 700 }}>{formatPopNumber(data.ageGroups[g.key])}</span>
                              {' '}{g.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Clear button */}
              <button
                onClick={clearWorldPopData}
                style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'white', color: '#EF4444', border: '1px solid #FECACA', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear Population Data
              </button>
            </>
          )}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
};

export default WorldPopDrawer;
