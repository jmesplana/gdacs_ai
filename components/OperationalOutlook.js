/**
 * Operational Outlook Dashboard
 * Displays forward-looking humanitarian analysis
 */

import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import {
  filterFacilitiesToDistricts,
  filterItemsToDistricts,
  filterOsmDataToDistricts,
  getScopedWorldPopData
} from '../lib/analysisScope';

const experimentalBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 9px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
};

const OperationalOutlook = ({
  facilities = [],
  disasters = [],
  acledData = [],
  districts = [],
  selectedDistrict = null, // If provided, analyze only this district/admin level
  worldPopData = {},
  worldPopYear = null,
  osmData = null,
  enabledEvidenceLayers = [],
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [outlook, setOutlook] = useState(null);
  const [error, setError] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const analysisDistricts = selectedDistrict ? [selectedDistrict] : districts;
  const scopedFacilities = analysisDistricts.length > 0
    ? filterFacilitiesToDistricts(facilities || [], analysisDistricts)
    : (facilities || []);
  const scopedDisasters = analysisDistricts.length > 0
    ? filterItemsToDistricts(disasters || [], analysisDistricts)
    : (disasters || []);
  const scopedAcledData = analysisDistricts.length > 0
    ? filterItemsToDistricts(acledData || [], analysisDistricts)
    : (acledData || []);
  const scopedWorldPopData = analysisDistricts.length > 0
    ? getScopedWorldPopData(worldPopData || {}, analysisDistricts)
    : (worldPopData || {});
  const scopedOsmData = analysisDistricts.length > 0
    ? filterOsmDataToDistricts(osmData, analysisDistricts)
    : osmData;

  useEffect(() => {
    generateOutlook();
  }, []);

  const generateOutlook = async () => {
    setLoading(true);
    setError(null);

    try {
      // If a single district is selected, focus the analysis on that district only
      let geoBounds = null;

      if (selectedDistrict) {
        // Admin-level analysis: use only the selected district
        console.log('Generating admin-level outlook for:', selectedDistrict.name);

        // Calculate bounds from just this district
        if (selectedDistrict.bounds) {
          geoBounds = selectedDistrict.bounds;
        } else if (selectedDistrict.geometry) {
          geoBounds = calculateBoundsFromGeometry(selectedDistrict.geometry);
        }
      } else {
        // Country-level analysis: use all districts
        console.log('Generating country-level outlook for all districts');
        if (analysisDistricts && analysisDistricts.length > 0) {
          geoBounds = calculateDistrictBounds(analysisDistricts);
        }
      }

      const filteredAcledData = scopedAcledData;
      let districtHazardAnalysis = null;

      try {
        const districtHazardResponse = await fetch('/api/district-hazard-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            districts: analysisDistricts,
            facilities: scopedFacilities,
            disasters: scopedDisasters,
            acledData: filteredAcledData,
            worldPopData: scopedWorldPopData,
            enabledEvidenceLayers,
            days: 7
          })
        });

        if (districtHazardResponse.ok) {
          districtHazardAnalysis = await districtHazardResponse.json();
        } else {
          console.warn('Could not fetch district hazard analysis for outlook');
        }
      } catch (err) {
        console.warn('Could not fetch district hazard analysis for outlook:', err);
      }

      // First, try to fetch predictions to include in the outlook
      let predictionsData = null;

      // Get center point for predictions
      if (scopedFacilities.length > 0 || analysisDistricts.length > 0) {
        const centerPoint = getCenterPoint();

        // Fetch disaster forecast
        try {
          const disasterForecastRes = await fetch('/api/disaster-forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: centerPoint.latitude,
              longitude: centerPoint.longitude,
              days: 14
            })
          });

          if (disasterForecastRes.ok) {
            const disasterData = await disasterForecastRes.json();
            predictionsData = { ...predictionsData, disaster: disasterData };
          }
        } catch (err) {
          console.warn('Could not fetch disaster forecast:', err);
        }

        // Fetch outbreak prediction if we have facility/population data
        if (scopedFacilities.length > 0) {
          try {
            const outbreakRes = await fetch('/api/outbreak-prediction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: centerPoint.latitude,
                longitude: centerPoint.longitude,
                disasters: scopedDisasters,
                populationEstimate: scopedFacilities.length * 10000, // Rough estimate
                forecastDays: 30
              })
            });

            if (outbreakRes.ok) {
              const outbreakData = await outbreakRes.json();
              predictionsData = { ...predictionsData, outbreak: outbreakData.predictions };
            }
          } catch (err) {
            console.warn('Could not fetch outbreak prediction:', err);
          }
        }

        // Fetch supply chain forecast
        try {
          const supplyChainRes = await fetch('/api/supply-chain-forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: centerPoint.latitude,
              longitude: centerPoint.longitude,
              disasters: scopedDisasters,
              forecastDays: 14
            })
          });

          if (supplyChainRes.ok) {
            const supplyChainData = await supplyChainRes.json();
            predictionsData = { ...predictionsData, supplyChain: supplyChainData };
          }
        } catch (err) {
          console.warn('Could not fetch supply chain forecast:', err);
        }
      }

      setPredictions(predictionsData);

      // Generate operational outlook with filtered data
      const response = await fetch('/api/operational-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilities: scopedFacilities,
          disasters: scopedDisasters,
          acledData: filteredAcledData, // Filtered to analysis area bounds
          districts: analysisDistricts, // Either single district or all districts
          predictions: predictionsData,
          districtHazardAnalysis,
          selectedDistrict: selectedDistrict ? selectedDistrict.name : null, // Signal to API if this is admin-level analysis
          worldPopData: scopedWorldPopData,
          worldPopYear: worldPopYear || null,
          osmData: scopedOsmData || null // Include OSM infrastructure data
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate outlook: ${response.statusText}`);
      }

      const data = await response.json();
      setOutlook(data.outlook);
    } catch (err) {
      console.error('Error generating operational outlook:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate bounding box from all districts
  const calculateDistrictBounds = (districts) => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    districts.forEach(district => {
      if (district.geometry && district.geometry.coordinates) {
        const coords = district.geometry.coordinates;

        const processCoord = (coord) => {
          const lng = coord[0];
          const lat = coord[1];
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        };

        if (district.geometry.type === 'Polygon') {
          coords[0].forEach(processCoord);
        } else if (district.geometry.type === 'MultiPolygon') {
          coords.forEach(polygon => {
            polygon[0].forEach(processCoord);
          });
        }
      }
    });

    return {
      minLat,
      maxLat,
      minLng,
      maxLng
    };
  };

  // Calculate bounding box from a single geometry object
  const calculateBoundsFromGeometry = (geometry) => {
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    if (!geometry || !geometry.coordinates) return null;

    const coords = geometry.coordinates;

    const processCoord = (coord) => {
      const lng = coord[0];
      const lat = coord[1];
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    };

    if (geometry.type === 'Polygon') {
      coords[0].forEach(processCoord);
    } else if (geometry.type === 'MultiPolygon') {
      coords.forEach(polygon => {
        polygon[0].forEach(processCoord);
      });
    }

    return {
      minLat,
      maxLat,
      minLng,
      maxLng
    };
  };

  const getCenterPoint = () => {
    // Prioritize districts, then facilities
    if (analysisDistricts && analysisDistricts.length > 0) {
      // Calculate center of all districts
      let totalLat = 0, totalLng = 0, count = 0;

      analysisDistricts.forEach(district => {
        if (district.geometry && district.geometry.coordinates) {
          const coords = district.geometry.coordinates;
          // Simple centroid calculation for polygons
          if (district.geometry.type === 'Polygon') {
            coords[0].forEach(coord => {
              totalLng += coord[0];
              totalLat += coord[1];
              count++;
            });
          } else if (district.geometry.type === 'MultiPolygon') {
            coords.forEach(polygon => {
              polygon[0].forEach(coord => {
                totalLng += coord[0];
                totalLat += coord[1];
                count++;
              });
            });
          }
        }
      });

      if (count > 0) {
        return {
          latitude: totalLat / count,
          longitude: totalLng / count
        };
      }
    }

    if (scopedFacilities && scopedFacilities.length > 0) {
      const totalLat = scopedFacilities.reduce((sum, f) => sum + parseFloat(f.latitude), 0);
      const totalLng = scopedFacilities.reduce((sum, f) => sum + parseFloat(f.longitude), 0);
      return {
        latitude: totalLat / scopedFacilities.length,
        longitude: totalLng / scopedFacilities.length
      };
    }

    return { latitude: 0, longitude: 0 };
  };

  const downloadOutlook = () => {
    if (!outlook) return;

    const blob = new Blob([outlook], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `operational-outlook-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '1200px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '2px solid var(--aidstack-orange)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <h2 style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--aidstack-navy)',
              fontFamily: "'Inter', sans-serif"
            }}>
              {selectedDistrict ? `${selectedDistrict.name} - Operational Outlook` : 'Operational Outlook'}
            </h2>
            <span style={{
              ...experimentalBadgeStyle,
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              color: '#C2410C',
            }}>
              Experimental
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {outlook && (
              <button
                onClick={downloadOutlook}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--aidstack-navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f0f0f0',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{
          padding: '12px 24px',
          background: '#FFF7ED',
          borderBottom: '1px solid #FED7AA',
          color: '#9A3412',
          fontSize: '13px',
          lineHeight: 1.5,
          fontFamily: "'Inter', sans-serif",
        }}>
          This outlook is experimental and intended as a planning aid. Confirm key assumptions with current field data, official advisories, and operational judgment.
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginBottom: '20px' }}>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
              <h3 style={{ color: 'var(--aidstack-navy)', marginBottom: '10px' }}>
                Generating Operational Outlook...
              </h3>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Analyzing current situation, identifying key signals, and forecasting possible developments
              </p>
            </div>
          )}

          {error && (
            <div style={{
              padding: '20px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '6px',
              color: '#c33'
            }}>
              <h3 style={{ marginTop: 0 }}>Error</h3>
              <p>{error}</p>
              <button
                onClick={generateOutlook}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--aidstack-orange)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Retry
              </button>
            </div>
          )}

          {outlook && (
            <div style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: '15px',
              lineHeight: '1.7',
              color: '#333'
            }}>
              <div dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(formatMarkdown(outlook)) : '' }} />
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Simple markdown formatter
function formatMarkdown(text) {
  if (!text) return '';

  // Split into lines for better processing
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let listItems = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      if (inList) {
        html += '<ul style="margin-left: 20px; margin-bottom: 16px; list-style-type: disc;">' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
      }
      html += '<div style="height: 12px;"></div>';
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) {
        html += '<ul style="margin-left: 20px; margin-bottom: 16px; list-style-type: disc;">' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
      }
      html += `<h3 style="color: var(--aidstack-navy); margin-top: 24px; margin-bottom: 12px; font-size: 18px; font-weight: 600;">${line.substring(4)}</h3>`;
    } else if (line.startsWith('## ')) {
      if (inList) {
        html += '<ul style="margin-left: 20px; margin-bottom: 16px; list-style-type: disc;">' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
      }
      html += `<h2 style="color: var(--aidstack-navy); margin-top: 28px; margin-bottom: 14px; font-size: 20px; font-weight: 700; border-bottom: 2px solid var(--aidstack-orange); padding-bottom: 8px;">${line.substring(3)}</h2>`;
    } else if (line.startsWith('# ')) {
      if (inList) {
        html += '<ul style="margin-left: 20px; margin-bottom: 16px; list-style-type: disc;">' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
      }
      html += `<h1 style="color: var(--aidstack-navy); margin-top: 0; margin-bottom: 20px; font-size: 24px; font-weight: 700;">${line.substring(2)}</h1>`;
    }
    // List items
    else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const content = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--aidstack-navy); font-weight: 600;">$1</strong>');
      listItems.push(`<li style="margin-bottom: 6px;">${content}</li>`);
      inList = true;
    }
    // Regular paragraph
    else {
      if (inList) {
        html += '<ul style="margin-left: 20px; margin-bottom: 16px; list-style-type: disc;">' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
      }
      const content = line.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--aidstack-navy); font-weight: 600;">$1</strong>');
      html += `<p style="margin-bottom: 12px; line-height: 1.6;">${content}</p>`;
    }
  }

  // Close any remaining list
  if (inList) {
    html += '<ul style="margin-left: 20px; margin-bottom: 16px; list-style-type: disc;">' + listItems.join('') + '</ul>';
  }

  return html;
}

export default OperationalOutlook;
