import React, { useEffect, useMemo, useState } from 'react';

/**
 * OSM Infrastructure Selector Component
 *
 * User flow:
 * 1. Select which admin areas to load
 * 2. Select which infrastructure types to load (hospitals, schools, water, etc.)
 * 3. Click "Load Selected Data" button
 * 4. Data is fetched only for selected admin areas and categories
 */

const INFRASTRUCTURE_CATEGORIES = [
  { id: 'hospitals', name: 'Hospitals & Clinics', icon: '🏥', priority: 'critical' },
  { id: 'water', name: 'Water Sources', icon: '💧', priority: 'critical' },
  { id: 'schools', name: 'Schools', icon: '🏫', priority: 'secondary' },
  { id: 'power', name: 'Power Stations', icon: '⚡', priority: 'critical' },
  { id: 'pharmacies', name: 'Pharmacies', icon: '💊', priority: 'secondary' },
  { id: 'airports', name: 'Airports', icon: '✈️', priority: 'critical' },
  { id: 'roads', name: 'Major Roads', icon: '🛣️', priority: 'secondary' },
  { id: 'fuel', name: 'Fuel Stations', icon: '⛽', priority: 'secondary' },
  { id: 'bridges', name: 'Bridges', icon: '🌉', priority: 'secondary' }
];

export default function OSMInfrastructureSelector({
  districts = [],
  selectedAnalysisDistricts = [],
  osmLoading = false,
  osmData = null,
  osmStats = null,
  osmWarning = null,
  osmLayerVisibility = {},
  onLoadOSM, // Callback: (selectedDistricts, selectedCategories) => void
  onSelectionChange, // Callback: (selectedDistricts) => void
  onToggleLayerVisibility, // Callback: (category) => void
  onClearCategory, // Callback: (category) => void
}) {
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [requestStartedAt, setRequestStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastCompletedLoad, setLastCompletedLoad] = useState(null);
  const districtSignature = useMemo(
    () => districts.map((district, idx) => district.id || district.name || idx).join('|'),
    [districts]
  );
  const selectedAnalysisDistrictIds = useMemo(
    () => selectedAnalysisDistricts.map((district, idx) => district.id || idx),
    [selectedAnalysisDistricts]
  );
  const layerCounts = useMemo(
    () => osmData?.metadata?.byLayer || osmStats?.byLayer || osmStats || {},
    [osmData, osmStats]
  );

  useEffect(() => {
    if (!osmLoading && activeRequest) {
      const loadedBreakdown = activeRequest.categoryIds.map(categoryId => {
        const category = INFRASTRUCTURE_CATEGORIES.find(item => item.id === categoryId);
        const featureCount = layerCounts?.[categoryId] || 0;
        return {
          id: categoryId,
          name: category?.name || categoryId,
          featureCount
        };
      });

      setLastCompletedLoad({
        districtCount: activeRequest.districtCount,
        categoryCount: activeRequest.categoryCount,
        elapsedSeconds,
        loadedBreakdown,
        totalFeatures: loadedBreakdown.reduce((sum, item) => sum + item.featureCount, 0),
        completedAt: new Date().toISOString()
      });

      setActiveRequest(null);
      setRequestStartedAt(null);
      setElapsedSeconds(0);
    }
  }, [osmLoading, activeRequest, layerCounts, elapsedSeconds]);

  useEffect(() => {
    setSelectedDistricts([]);
    setSelectedCategories([]);
    setActiveRequest(null);
    setLastCompletedLoad(null);
  }, [districtSignature]);

  useEffect(() => {
    setSelectedDistricts(selectedAnalysisDistrictIds);
  }, [selectedAnalysisDistrictIds]);

  useEffect(() => {
    if (!osmLoading || !requestStartedAt) return undefined;

    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(1, Math.floor((Date.now() - requestStartedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [osmLoading, requestStartedAt]);

  useEffect(() => {
    if (!onSelectionChange) return;

    const selectedDistrictRecords = districts.filter((district, idx) =>
      selectedDistricts.includes(district.id || idx)
    );

    onSelectionChange(selectedDistrictRecords);
  }, [districts, onSelectionChange, selectedDistricts]);

  const estimatedTimeLabel = useMemo(() => {
    if (!activeRequest) return 'Usually 10-60 seconds depending on admin area size and selected layers.';
    if (activeRequest.districtCount >= 10 || activeRequest.categoryCount >= 5) {
      return 'This is a larger OSM request. Wait time can reach 30-60 seconds.';
    }
    return 'Most OSM requests complete in around 10-30 seconds.';
  }, [activeRequest]);

  // No admin boundaries uploaded yet
  if (!districts || districts.length === 0) {
    return (
      <div style={{
        padding: '16px',
        fontSize: '13px',
        color: '#666',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
        textAlign: 'center',
        border: '1px solid #e0e0e0'
      }}>
        📍 Upload an admin boundary shapefile to enable infrastructure data loading
      </div>
    );
  }

  // Sort uploaded admin areas alphabetically by name
  const sortedDistricts = [...districts].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const handleLoadData = () => {
    console.log('🔘 Load button clicked!', {
      selectedDistricts: selectedDistricts.length,
      selectedCategories: selectedCategories.length
    });

    if (selectedDistricts.length === 0 || selectedCategories.length === 0) {
      console.warn('⚠️ Cannot load: missing admin areas or categories');
      return;
    }

    const districtsToLoad = districts.filter((d, idx) =>
      selectedDistricts.includes(d.id || idx)
    );

    console.log('📦 Districts to load:', districtsToLoad.map(d => d.name || 'Unnamed'));
    console.log('📦 Categories to load:', selectedCategories);

    setActiveRequest({
      districtCount: selectedDistricts.length,
      categoryCount: selectedCategories.length,
      categoryIds: selectedCategories,
      categoryNames: selectedCategories
        .map(categoryId => INFRASTRUCTURE_CATEGORIES.find(category => category.id === categoryId)?.name || categoryId)
    });
    setLastCompletedLoad(null);
    setRequestStartedAt(Date.now());
    setElapsedSeconds(0);

    if (onLoadOSM) {
      console.log('✅ Calling onLoadOSM callback...');
      onLoadOSM(districtsToLoad, selectedCategories);
    } else {
      console.error('❌ onLoadOSM callback is not defined!');
    }
  };

  // Get loaded categories
  const loadedCategories = layerCounts
    ? Object.keys(layerCounts).filter(cat => layerCounts[cat] > 0)
    : [];

  // Debug logging
  console.log('🔍 OSMInfrastructureSelector render:', {
    osmLoading,
    hasOsmData: !!osmData,
    osmDataFeatures: osmData?.features?.length,
    osmStats,
    selectedDistricts: selectedDistricts.length,
    selectedCategories: selectedCategories.length
  });

  return (
    <div style={{ padding: '0' }}>
      <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px', color: '#333' }}>
        OpenStreetMap Infrastructure
      </h4>

      {osmWarning && !osmLoading && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #f59e0b',
          backgroundColor: '#fffbeb',
          color: '#92400e',
          fontSize: '12px',
          lineHeight: 1.5
        }}>
          {osmWarning}
        </div>
      )}

      {osmLoading && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 107, 53, 0.28)',
          background: 'linear-gradient(135deg, rgba(255, 247, 237, 0.98) 0%, rgba(255, 237, 213, 0.98) 100%)',
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#9a3412' }}>
              Loading OpenStreetMap infrastructure
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#1B3A5C',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(26, 54, 93, 0.12)',
              borderRadius: '999px',
              padding: '5px 10px'
            }}>
              {elapsedSeconds > 0 ? `${elapsedSeconds}s elapsed` : 'Starting request...'}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: '#7c2d12', lineHeight: 1.55 }}>
            {activeRequest
              ? `Fetching ${activeRequest.categoryCount} infrastructure ${activeRequest.categoryCount === 1 ? 'type' : 'types'} for ${activeRequest.districtCount} ${activeRequest.districtCount === 1 ? 'admin area' : 'admin areas'}.`
              : 'Fetching the selected infrastructure layers for the selected admin areas.'}
          </div>
          {activeRequest?.categoryNames?.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#9a3412', fontWeight: 600 }}>
              {activeRequest.categoryNames.join(', ')}
            </div>
          )}
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#7c2d12' }}>
            {estimatedTimeLabel}
          </div>
          <div style={{
            marginTop: '12px',
            height: '8px',
            borderRadius: '999px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255, 107, 53, 0.14)'
          }}>
            <div style={{
              width: '35%',
              height: '100%',
              borderRadius: '999px',
              background: 'linear-gradient(90deg, var(--aidstack-orange) 0%, #ff9a5f 100%)',
              animation: 'osm-loading-slide 1.4s ease-in-out infinite'
            }} />
          </div>
        </div>
      )}

      {!osmLoading && lastCompletedLoad && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(16, 185, 129, 0.22)',
          background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.98) 0%, rgba(209, 250, 229, 0.98) 100%)',
          boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#065f46', marginBottom: '6px' }}>
            OSM infrastructure loaded
          </div>
          <div style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.55 }}>
            Loaded {lastCompletedLoad.totalFeatures.toLocaleString()} features across {lastCompletedLoad.categoryCount} {lastCompletedLoad.categoryCount === 1 ? 'category' : 'categories'} for {lastCompletedLoad.districtCount} {lastCompletedLoad.districtCount === 1 ? 'admin area' : 'admin areas'}.
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#047857' }}>
            Completed in {Math.max(lastCompletedLoad.elapsedSeconds, 1)}s
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#047857' }}>
            {lastCompletedLoad.loadedBreakdown
              .filter(item => item.featureCount > 0)
              .map(item => `${item.name}: ${item.featureCount}`)
              .join(' | ') || 'Data loaded. Use the controls below to show or hide layers.'}
          </div>
        </div>
      )}

      {/* Step 1: Select Admin Areas */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span>Step 1: Select Admin Areas</span>
          {osmLoading && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#92400e',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '999px',
              padding: '4px 8px'
            }}>
              Loading in progress
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px' }}>
          Choose which admin areas to load ({sortedDistricts.length} available):
        </div>

        <div style={{
          maxHeight: '140px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: 'white',
          padding: '4px',
          marginBottom: '10px'
        }}>
          {sortedDistricts.slice(0, 100).map((district, idx) => {
            // Find the original index from the unsorted districts array
            const originalIdx = districts.findIndex(d => d === district);
            const districtId = district.id || originalIdx;

            return (
              <label
                key={districtId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderBottom: idx < Math.min(99, sortedDistricts.length - 1) ? '1px solid #f0f0f0' : 'none',
                  backgroundColor: selectedDistricts.includes(districtId) ? '#e3f2fd' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedDistricts.includes(districtId)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDistricts([...selectedDistricts, districtId]);
                    } else {
                      setSelectedDistricts(selectedDistricts.filter(id => id !== districtId));
                    }
                  }}
                  style={{ marginRight: '8px' }}
                />
                <span>{district.name || `Admin Area ${originalIdx + 1}`}</span>
              </label>
            );
          })}
          {sortedDistricts.length > 100 && (
            <div style={{ padding: '8px', fontSize: '11px', color: '#666', textAlign: 'center', backgroundColor: '#fafafa' }}>
              Showing first 100 of {sortedDistricts.length} admin areas
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => {
              const first10 = sortedDistricts.slice(0, Math.min(10, sortedDistricts.length)).map(d => {
                const originalIdx = districts.findIndex(orig => orig === d);
                return d.id || originalIdx;
              });
              setSelectedDistricts(first10);
            }}
            disabled={osmLoading}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              background: 'white',
              color: '#3b82f6',
              cursor: osmLoading ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            Select First 10
          </button>
          <button
            onClick={() => {
              const all = sortedDistricts.map(d => {
                const originalIdx = districts.findIndex(orig => orig === d);
                return d.id || originalIdx;
              });
              setSelectedDistricts(all);
            }}
            disabled={osmLoading}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              border: '1px solid #10b981',
              borderRadius: '4px',
              background: 'white',
              color: '#10b981',
              cursor: osmLoading ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedDistricts([])}
            disabled={osmLoading || selectedDistricts.length === 0}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              color: '#666',
              cursor: (osmLoading || selectedDistricts.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            Clear
          </button>
        </div>

        {selectedDistricts.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#059669', fontWeight: 500 }}>
            ✓ {selectedDistricts.length} {selectedDistricts.length === 1 ? 'admin area' : 'admin areas'} selected
          </div>
        )}
      </div>

      {/* Step 2: Select Infrastructure Types */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        opacity: selectedDistricts.length === 0 ? 0.5 : 1
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
          Step 2: Select Infrastructure Types
        </div>
        {selectedDistricts.length === 0 && (
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', fontStyle: 'italic' }}>
            Select admin areas first ↑
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
          {INFRASTRUCTURE_CATEGORIES.map(category => {
            const isSelected = selectedCategories.includes(category.id);
            const isLoaded = loadedCategories.includes(category.id);

            return (
              <label
                key={category.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  cursor: selectedDistricts.length === 0 ? 'not-allowed' : 'pointer',
                  borderRadius: '4px',
                  backgroundColor: isLoaded ? '#ecfdf5' : (isSelected ? '#e3f2fd' : 'white'),
                  border: '1px solid ' + (isLoaded ? '#10b981' : (isSelected ? '#3b82f6' : '#e5e7eb')),
                  fontSize: '12px',
                  opacity: selectedDistricts.length === 0 ? 0.7 : 1
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected || isLoaded}
                  onChange={(e) => {
                    if (selectedDistricts.length > 0) {
                      if (e.target.checked) {
                        setSelectedCategories(prev => Array.from(new Set([...prev, category.id])));
                      } else {
                        setSelectedCategories(prev => prev.filter(id => id !== category.id));
                        if (isLoaded && onClearCategory) {
                          onClearCategory(category.id);
                        }
                      }
                    }
                  }}
                  disabled={selectedDistricts.length === 0 || osmLoading}
                  style={{ marginRight: '6px' }}
                />
                <span style={{ marginRight: '4px' }}>{category.icon}</span>
                <span style={{ fontSize: '11px', flex: 1 }}>{category.name}</span>
                {isLoaded && (
                  <span style={{ fontSize: '10px', color: '#059669', fontWeight: 500 }}>✓</span>
                )}
              </label>
            );
          })}
        </div>

        {/* Quick select buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => {
              const critical = INFRASTRUCTURE_CATEGORIES
                .filter(c => c.priority === 'critical')
                .map(c => c.id);
              setSelectedCategories(critical);
            }}
            disabled={osmLoading || selectedDistricts.length === 0}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              border: '1px solid #3b82f6',
              borderRadius: '4px',
              background: 'white',
              color: '#3b82f6',
              cursor: (osmLoading || selectedDistricts.length === 0) ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            Critical Only
          </button>
          <button
            onClick={() => setSelectedCategories([])}
            disabled={osmLoading || selectedCategories.length === 0}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '11px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: 'white',
              color: '#666',
              cursor: (osmLoading || selectedCategories.length === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            Clear
          </button>
        </div>

        {selectedCategories.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#059669', fontWeight: 500 }}>
            ✓ {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
          </div>
        )}
      </div>

      {/* Load Button */}
      <button
        onClick={handleLoadData}
        disabled={osmLoading || selectedDistricts.length === 0 || selectedCategories.length === 0}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '14px',
          fontWeight: 600,
          border: 'none',
          borderRadius: '6px',
          background: (osmLoading || selectedDistricts.length === 0 || selectedCategories.length === 0)
            ? '#ccc'
            : 'linear-gradient(135deg, var(--aidstack-orange) 0%, #ff6b35 100%)',
          color: 'white',
          cursor: (osmLoading || selectedDistricts.length === 0 || selectedCategories.length === 0) ? 'not-allowed' : 'pointer',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s'
        }}
      >
        {osmLoading ? (
          activeRequest
            ? `Loading ${activeRequest.categoryCount} ${activeRequest.categoryCount === 1 ? 'Type' : 'Types'} for ${activeRequest.districtCount} ${activeRequest.districtCount === 1 ? 'Admin Area' : 'Admin Areas'}...`
            : 'Loading Infrastructure Data...'
        ) : selectedDistricts.length === 0 ? (
          'Select Admin Areas to Continue'
        ) : selectedCategories.length === 0 ? (
          'Select Infrastructure Types to Continue'
        ) : (
          `Load ${selectedCategories.length} ${selectedCategories.length === 1 ? 'Type' : 'Types'} for ${selectedDistricts.length} ${selectedDistricts.length === 1 ? 'Admin Area' : 'Admin Areas'}`
        )}
      </button>

      {/* Loaded Data Section */}
      {loadedCategories.length > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: '#ecfdf5',
          borderRadius: '6px',
          border: '1px solid #d1fae5'
        }}>
          <h4 style={{
            marginTop: 0,
            marginBottom: '10px',
            fontSize: '13px',
            color: '#065f46',
            fontWeight: 600
          }}>
            Loaded Infrastructure ({loadedCategories.length})
          </h4>

          {loadedCategories.map(categoryId => {
            const categoryDef = INFRASTRUCTURE_CATEGORIES.find(c => c.id === categoryId);
            if (!categoryDef) return null;

            const count = layerCounts?.[categoryId] || 0;
            const isVisible = osmLayerVisibility[categoryId] !== false;

            return (
              <div
                key={categoryId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  marginBottom: '4px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid #d1fae5'
                }}
              >
                <span style={{ marginRight: '8px', fontSize: '16px' }}>
                  {categoryDef.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>
                    {categoryDef.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    {count} {count === 1 ? 'feature' : 'features'}
                  </div>
                </div>

                <button
                  onClick={() => onToggleLayerVisibility && onToggleLayerVisibility(categoryId)}
                  style={{
                    padding: '4px 10px',
                    marginRight: '6px',
                    fontSize: '11px',
                    backgroundColor: isVisible ? '#10b981' : '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {isVisible ? 'Hide' : 'Show'}
                </button>

                <button
                  onClick={() => onClearCategory && onClearCategory(categoryId)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  title="Remove this category data"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes osm-loading-slide {
          0% { transform: translateX(-100%); opacity: 0.5; }
          50% { transform: translateX(120%); opacity: 1; }
          100% { transform: translateX(260%); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
