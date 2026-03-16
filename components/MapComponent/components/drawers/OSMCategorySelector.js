import React, { useState, useCallback } from 'react';

/**
 * OSMCategorySelector - UI for selecting and loading OSM infrastructure categories
 *
 * User flow:
 * 1. User checks categories they want (e.g., hospitals, water)
 * 2. User clicks "Load Selected" button
 * 3. Only selected categories are fetched from API
 * 4. Loaded categories appear in "Loaded Data" section with visibility controls
 */

const CATEGORY_DEFINITIONS = {
  'CRITICAL INFRASTRUCTURE': [
    { id: 'hospitals', name: 'Hospitals & Clinics', icon: '🏥', priority: 'critical' },
    { id: 'water', name: 'Water Sources', icon: '💧', priority: 'critical' },
    { id: 'airports', name: 'Airports & Helipads', icon: '✈️', priority: 'critical' },
    { id: 'power', name: 'Power Plants & Substations', icon: '⚡', priority: 'critical' },
  ],
  'HEALTH & EDUCATION': [
    { id: 'schools', name: 'Schools & Universities', icon: '🏫', priority: 'secondary' },
    { id: 'pharmacies', name: 'Pharmacies', icon: '💊', priority: 'secondary' },
  ],
  'UTILITIES & TRANSPORT': [
    { id: 'roads', name: 'Major Roads', icon: '🛣️', priority: 'secondary' },
    { id: 'bridges', name: 'Bridges', icon: '🌉', priority: 'secondary' },
    { id: 'fuel', name: 'Fuel Stations', icon: '⛽', priority: 'secondary' },
  ],
};

export default function OSMCategorySelector({
  // From useOSMInfrastructure hook
  osmDataByCategory = {},
  loadingByCategory = {},
  errorByCategory = {},
  osmLayerVisibility = {},

  // Functions
  fetchCategories,
  toggleLayerVisibility,
  clearCategory,

  // State
  hasBoundary,
}) {
  // Categories selected for loading (not yet loaded)
  const [selectedCategories, setSelectedCategories] = useState(new Set());

  // Toggle category selection
  const toggleSelection = useCallback((categoryId) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Load all selected categories
  const handleLoadSelected = useCallback(async () => {
    if (selectedCategories.size === 0) return;

    const categoriesToLoad = Array.from(selectedCategories);
    await fetchCategories(categoriesToLoad);

    // Clear selection after loading
    setSelectedCategories(new Set());
  }, [selectedCategories, fetchCategories]);

  // Quick load presets
  const loadCriticalOnly = useCallback(() => {
    const critical = CATEGORY_DEFINITIONS['CRITICAL INFRASTRUCTURE'].map(c => c.id);
    fetchCategories(critical);
  }, [fetchCategories]);

  const loadAll = useCallback(() => {
    const all = Object.values(CATEGORY_DEFINITIONS)
      .flat()
      .map(c => c.id);
    fetchCategories(all);
  }, [fetchCategories]);

  // Get loaded categories
  const loadedCategories = Object.keys(osmDataByCategory).filter(cat => osmDataByCategory[cat]);
  const hasLoadedData = loadedCategories.length > 0;
  const selectedCount = selectedCategories.size;

  if (!hasBoundary) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Upload a district shapefile to enable infrastructure data loading
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
        Infrastructure Data (OpenStreetMap)
      </h3>

      {/* Quick Actions */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={loadCriticalOnly}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Load Critical Infrastructure
        </button>
        <button
          onClick={loadAll}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Load All
        </button>
      </div>

      {/* Category Selection */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}>
        <h4 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>
          Select categories to load:
        </h4>

        {Object.entries(CATEGORY_DEFINITIONS).map(([groupName, categories]) => (
          <div key={groupName} style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {groupName}
            </div>

            {categories.map(category => {
              const isLoaded = osmDataByCategory[category.id];
              const isLoading = loadingByCategory[category.id];
              const isSelected = selectedCategories.has(category.id);

              return (
                <label
                  key={category.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    marginBottom: '4px',
                    cursor: isLoaded ? 'default' : 'pointer',
                    backgroundColor: isLoaded ? '#ecfdf5' : 'transparent',
                    borderRadius: '4px',
                    opacity: isLoaded || isLoading ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(category.id)}
                    disabled={isLoaded || isLoading}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ marginRight: '8px' }}>{category.icon}</span>
                  <span style={{ flex: 1, fontSize: '14px' }}>
                    {category.name}
                  </span>
                  {isLoaded && (
                    <span style={{
                      fontSize: '11px',
                      color: '#059669',
                      fontWeight: '500',
                    }}>
                      ✓ Loaded
                    </span>
                  )}
                  {isLoading && (
                    <span style={{
                      fontSize: '11px',
                      color: '#3b82f6',
                    }}>
                      Loading...
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        ))}

        {/* Load Button */}
        <button
          onClick={handleLoadSelected}
          disabled={selectedCount === 0}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '12px',
            fontSize: '14px',
            fontWeight: '600',
            backgroundColor: selectedCount > 0 ? '#10b981' : '#e5e7eb',
            color: selectedCount > 0 ? 'white' : '#9ca3af',
            border: 'none',
            borderRadius: '6px',
            cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {selectedCount > 0
            ? `Load Selected (${selectedCount} ${selectedCount === 1 ? 'category' : 'categories'})`
            : 'Select categories to load'}
        </button>
      </div>

      {/* Loaded Data Section */}
      {hasLoadedData && (
        <div style={{
          padding: '16px',
          backgroundColor: '#ecfdf5',
          borderRadius: '8px',
          border: '1px solid #d1fae5',
        }}>
          <h4 style={{
            marginTop: 0,
            marginBottom: '12px',
            fontSize: '14px',
            color: '#065f46',
          }}>
            Loaded Data ({loadedCategories.length})
          </h4>

          {loadedCategories.map(categoryId => {
            const categoryDef = Object.values(CATEGORY_DEFINITIONS)
              .flat()
              .find(c => c.id === categoryId);

            if (!categoryDef) return null;

            const data = osmDataByCategory[categoryId];
            const featureCount = data?.features?.length || 0;
            const isVisible = osmLayerVisibility[categoryId] !== false;
            const hasError = errorByCategory[categoryId];

            return (
              <div
                key={categoryId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px',
                  marginBottom: '6px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: '1px solid #d1fae5',
                }}
              >
                <span style={{ marginRight: '8px', fontSize: '18px' }}>
                  {categoryDef.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>
                    {categoryDef.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {featureCount} {featureCount === 1 ? 'feature' : 'features'}
                    {hasError && (
                      <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                        Error: {hasError}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => toggleLayerVisibility(categoryId)}
                  style={{
                    padding: '4px 10px',
                    marginRight: '6px',
                    fontSize: '12px',
                    backgroundColor: isVisible ? '#10b981' : '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {isVisible ? 'Hide' : 'Show'}
                </button>

                <button
                  onClick={() => clearCategory(categoryId)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
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
