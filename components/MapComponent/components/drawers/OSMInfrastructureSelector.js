import React, { useState } from 'react';

/**
 * OSM Infrastructure Selector Component
 *
 * User flow:
 * 1. Select which districts/admin areas to load
 * 2. Select which infrastructure types to load (hospitals, schools, water, etc.)
 * 3. Click "Load Selected Data" button
 * 4. Data is fetched only for selected districts and categories
 */

const INFRASTRUCTURE_CATEGORIES = [
  { id: 'hospitals', name: 'Hospitals & Clinics', icon: '🏥', priority: 'critical' },
  { id: 'water', name: 'Water Sources', icon: '💧', priority: 'critical' },
  { id: 'schools', name: 'Schools', icon: '🏫', priority: 'secondary' },
  { id: 'power', name: 'Power Stations', icon: '⚡', priority: 'critical' },
  { id: 'pharmacies', name: 'Pharmacies', icon: '💊', priority: 'secondary' },
  { id: 'airports', name: 'Airports', icon: '✈️', priority: 'critical' },
  { id: 'roads', name: 'Major Roads', icon: '🛣️', priority: 'secondary' },
  { id: 'bridges', name: 'Bridges', icon: '🌉', priority: 'secondary' }
];

export default function OSMInfrastructureSelector({
  districts = [],
  osmLoading = false,
  osmData = null,
  osmStats = null,
  osmLayerVisibility = {},
  onLoadOSM, // Callback: (selectedDistricts, selectedCategories) => void
  onToggleLayerVisibility, // Callback: (category) => void
  onClearCategory, // Callback: (category) => void
}) {
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // No districts uploaded yet
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
        📍 Upload a district shapefile to enable infrastructure data loading
      </div>
    );
  }

  // Sort districts alphabetically by name
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
      console.warn('⚠️ Cannot load: missing districts or categories');
      return;
    }

    const districtsToLoad = districts.filter((d, idx) =>
      selectedDistricts.includes(d.id || idx)
    );

    console.log('📦 Districts to load:', districtsToLoad.map(d => d.name || 'Unnamed'));
    console.log('📦 Categories to load:', selectedCategories);

    if (onLoadOSM) {
      console.log('✅ Calling onLoadOSM callback...');
      onLoadOSM(districtsToLoad, selectedCategories);
    } else {
      console.error('❌ onLoadOSM callback is not defined!');
    }

    // Clear selections after loading
    setSelectedDistricts([]);
    setSelectedCategories([]);
  };

  // Get loaded categories
  const loadedCategories = osmStats?.byLayer
    ? Object.keys(osmStats.byLayer).filter(cat => osmStats.byLayer[cat] > 0)
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
        {osmLoading && <span style={{ color: '#f59e0b', marginLeft: '8px', fontSize: '12px' }}>⏳ Loading...</span>}
      </h4>

      {/* Step 1: Select Districts */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#333' }}>
          Step 1: Select Districts
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
                <span>{district.name || `District ${originalIdx + 1}`}</span>
              </label>
            );
          })}
          {sortedDistricts.length > 100 && (
            <div style={{ padding: '8px', fontSize: '11px', color: '#666', textAlign: 'center', backgroundColor: '#fafafa' }}>
              Showing first 100 of {sortedDistricts.length} districts
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
            ✓ {selectedDistricts.length} {selectedDistricts.length === 1 ? 'district' : 'districts'} selected
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
            Select districts first ↑
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
                  cursor: (selectedDistricts.length === 0 || isLoaded) ? 'not-allowed' : 'pointer',
                  borderRadius: '4px',
                  backgroundColor: isLoaded ? '#ecfdf5' : (isSelected ? '#e3f2fd' : 'white'),
                  border: '1px solid ' + (isLoaded ? '#10b981' : (isSelected ? '#3b82f6' : '#e5e7eb')),
                  fontSize: '12px',
                  opacity: (isLoaded || selectedDistricts.length === 0) ? 0.7 : 1
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected || isLoaded}
                  onChange={(e) => {
                    if (!isLoaded && selectedDistricts.length > 0) {
                      if (e.target.checked) {
                        setSelectedCategories([...selectedCategories, category.id]);
                      } else {
                        setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                      }
                    }
                  }}
                  disabled={selectedDistricts.length === 0 || isLoaded || osmLoading}
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
          'Loading Infrastructure Data...'
        ) : selectedDistricts.length === 0 ? (
          'Select Districts to Continue'
        ) : selectedCategories.length === 0 ? (
          'Select Infrastructure Types to Continue'
        ) : (
          `Load ${selectedCategories.length} ${selectedCategories.length === 1 ? 'Type' : 'Types'} for ${selectedDistricts.length} ${selectedDistricts.length === 1 ? 'District' : 'Districts'}`
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

            const count = osmStats?.byLayer?.[categoryId] || 0;
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
    </div>
  );
}
