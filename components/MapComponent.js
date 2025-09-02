import { useEffect, useRef, useState, useMemo } from 'react';
// GDACS Facilities Impact Assessment Tool
// Developed by John Mark Esplana (https://github.com/jmesplana)
import { MapContainer, TileLayer, CircleMarker, Marker as ReactLeafletMarker, Popup, useMap, ZIndex, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';

// Custom Heatmap component
const HeatmapLayer = ({ disasters }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);
  
  useEffect(() => {
    if (!disasters || disasters.length === 0) return;
    
    // Create points array for the heatmap
    const points = disasters
      .filter(d => d.latitude && d.longitude)
      .map(disaster => {
        // Determine intensity based on severity
        let intensity = 0.5; // Default
        const severity = (disaster.severity || disaster.alertLevel || '').toLowerCase();
        
        if (severity.includes('extreme')) intensity = 1.0;
        else if (severity.includes('severe')) intensity = 0.8;
        else if (severity.includes('moderate')) intensity = 0.6;
        else if (severity.includes('minor')) intensity = 0.4;
        
        return [
          parseFloat(disaster.latitude),
          parseFloat(disaster.longitude),
          intensity // Weight value
        ];
      });
    
    // Create the heatmap layer and update when zoom changes
    const updateHeatmap = () => {
      if (heatLayerRef.current) {
        // Remove old layer
        map.removeLayer(heatLayerRef.current);
      }
      
      // Get current zoom level to scale the circles appropriately
      const zoom = map.getZoom();
      
      // Base radius gets larger as zoom level decreases (zoomed out)
      // At zoom level 2 (world view), use large circles
      // At zoom level 10 (city view), use smaller circles
      const getBaseRadius = () => {
        if (zoom <= 2) return 500000;       // Very zoomed out (world view)
        if (zoom <= 4) return 300000;       // Continental view
        if (zoom <= 6) return 200000;       // Country view
        if (zoom <= 8) return 100000;       // Regional view
        return 50000;                       // City view or closer
      };
      
      // Create a feature group to hold all the heat circles
      const heatLayer = L.featureGroup();
      
      // Add circles for each point
      points.forEach(point => {
        const [lat, lng, intensity] = point;
        
        // For better visibility at all zoom levels, add multiple circles
        // with different sizes and opacities
        
        // Large, very transparent outer circle
        const outerCircle = L.circle([lat, lng], {
          radius: getBaseRadius() * 2.5 * intensity,
          color: 'rgba(255, 0, 0, 0)',
          fillColor: '#ff9500',
          fillOpacity: 0.1 * intensity,
          stroke: false,
          interactive: false
        });
        
        // Medium, semi-transparent middle circle
        const midCircle = L.circle([lat, lng], {
          radius: getBaseRadius() * 1.5 * intensity,
          color: 'rgba(255, 0, 0, 0)',
          fillColor: '#ff7800',
          fillOpacity: 0.2 * intensity,
          stroke: false,
          interactive: false
        });
        
        // Small, more opaque inner circle for the hotspot
        const innerCircle = L.circle([lat, lng], {
          radius: getBaseRadius() * intensity,
          color: 'rgba(255, 0, 0, 0)',
          fillColor: '#ff5500',
          fillOpacity: 0.4 * intensity,
          stroke: false,
          interactive: false
        });
        
        heatLayer.addLayer(outerCircle);
        heatLayer.addLayer(midCircle);
        heatLayer.addLayer(innerCircle);
      });
      
      // Add the heatmap to the map
      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;
    };
    
    // Initial creation
    updateHeatmap();
    
    // Update when zoom changes
    map.on('zoomend', updateHeatmap);
    
    // Cleanup function
    return () => {
      map.off('zoomend', updateHeatmap);
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, disasters]);
  
  return null;
};

// Custom hook to access the map instance
const MapAccess = ({ onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map && onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return null;
};

// Component to add disaster markers directly to the map
const DisasterMarkers = ({ disasters, getDisasterInfo, getAlertColor }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  
  useEffect(() => {
    // Create markers for each disaster directly with Leaflet
    const markers = [];
    
    if (disasters && disasters.length > 0) {
      console.log(`Adding ${disasters.length} disaster markers directly to map`);
      
      // Debug: Check if any disasters have polygon data
      const disastersWithPolygons = disasters.filter(d => d.polygon && d.polygon.length > 2);
      console.log(`Found ${disastersWithPolygons.length} disasters with polygon data out of ${disasters.length} total`);
      
      // Create cluster group if it doesn't exist
      if (!clusterGroupRef.current) {
        clusterGroupRef.current = L.markerClusterGroup({
          chunkedLoading: true,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: true,
          zoomToBoundsOnClick: true,
          maxClusterRadius: 50,
          iconCreateFunction: (cluster) => {
            // Custom icon for disaster clusters
            const childCount = cluster.getChildCount();
            
            // Count disasters by alert level within the cluster
            let redCount = 0;
            let orangeCount = 0;
            let greenCount = 0;
            
            cluster.getAllChildMarkers().forEach(marker => {
              const alertLevel = marker.options.alertLevel.toLowerCase();
              if (alertLevel === 'red') redCount++;
              else if (alertLevel === 'orange') orangeCount++;
              else if (alertLevel === 'green') greenCount++;
            });
            
            // Determine cluster color based on highest alert level present
            let color = '#4CAF50'; // Green default
            if (redCount > 0) color = '#ff4444'; // Red
            else if (orangeCount > 0) color = '#ffa500'; // Orange
            
            // Create the cluster icon with the count
            return L.divIcon({
              html: `<div style="background-color: ${color}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; color: white;">${childCount}</div>`,
              className: 'disaster-cluster-icon',
              iconSize: L.point(34, 34)
            });
          }
        });
        map.addLayer(clusterGroupRef.current);
      } else {
        // Clear previous markers from the cluster group
        clusterGroupRef.current.clearLayers();
      }
      
      disasters.forEach((disaster, index) => {
        if (disaster.latitude && disaster.longitude) {
          const lat = parseFloat(disaster.latitude);
          const lng = parseFloat(disaster.longitude);
          
          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lng)) {
            console.log(`Invalid coordinates for disaster: ${disaster.title}`);
            return;
          }
          
          console.log(`Adding disaster marker at [${lat}, ${lng}]: ${disaster.title}`);
          
          // Get disaster type info (for icon)
          const disasterInfo = getDisasterInfo(disaster.eventType);
          // Use severity from CAP data if available, otherwise fall back to alertLevel
          const alertColor = getAlertColor(disaster.severity || disaster.alertLevel);
          
          // Create a custom GDACS-style icon
          const iconUrl = disasterInfo.icon;
          const iconSize = [36, 36]; // Size of the icon
          
          // Create a div icon with a colored border based on alert level
          const iconHtml = `
            <div style="position: relative;">
              <div style="position: absolute; border-radius: 50%; border: 4px solid ${alertColor}; width: 44px; height: 44px; top: -6px; left: -6px; background-color: white;"></div>
              <img src="${iconUrl}" width="36" height="36" style="position: relative; z-index: 10;">
            </div>
          `;
          
          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'gdacs-icon',
            iconSize: [36, 36],
            zIndexOffset: -1000, // Keep disasters below facilities
            iconAnchor: [18, 18]
          });
          
          // Create a marker instead of circle
          const marker = L.marker([lat, lng], {
            icon: customIcon,
            zIndexOffset: -1000, // Keep disasters below facilities
            alertLevel: disaster.alertLevel || 'green' // Store alert level for cluster coloring
          });
          
          // Add to cluster group instead of directly to map
          clusterGroupRef.current.addLayer(marker);
          
          // Add popup
          const popupContent = `
            <div style="max-width: 280px;">
              <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid ${alertColor}; padding-bottom: 6px;">
                ${disaster.title}
              </h3>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Event Type:</strong>
                <span>${disasterInfo.name}</span>
              </div>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Severity:</strong>
                <span style="color: ${alertColor}; font-weight: bold;">${disaster.severity || disaster.alertLevel || 'Unknown'}</span>
              </div>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Certainty:</strong>
                <span>${disaster.certainty || 'Unknown'}</span>
              </div>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Urgency:</strong>
                <span>${disaster.urgency || 'Unknown'}</span>
              </div>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Date:</strong>
                <span>${disaster.pubDate}</span>
              </div>
              <p style="margin-top: 8px;">${disaster.description}</p>
              <a href="${disaster.webUrl || disaster.link}" target="_blank" style="display: inline-block; margin-top: 8px; color: #2196F3; text-decoration: none; font-weight: bold;">
                View on GDACS →
              </a>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          // Store markers to remove on cleanup
          markers.push(marker);
          
          // Add a transparent circle for the impact radius
          let impactRadius = 50; // Default radius in km
          if (disaster.eventType) {
            const eventType = disaster.eventType.toLowerCase();
            if (eventType === 'eq') {
              // For earthquakes, use magnitude-based radius
              const magnitude = parseFloat(disaster.title.match(/\d+\.\d+/)?.[0] || '5.0');
              impactRadius = magnitude * 25; // km
            } else if (eventType === 'tc') {
              impactRadius = 200; // 200km for tropical cyclones
            } else if (eventType === 'fl') {
              impactRadius = 70; // 70km for floods
            } else if (eventType === 'vo') {
              impactRadius = 50; // 50km for volcanic activity
            } else if (eventType === 'dr') {
              impactRadius = 250; // 250km for drought
            } else if (eventType === 'wf') {
              impactRadius = 30; // 30km for wildfire
            } else if (eventType === 'ts') {
              impactRadius = 100; // 100km for tsunami
            }
          }
          
          // Check if we have polygon data available
          if (disaster.polygon && Array.isArray(disaster.polygon) && disaster.polygon.length > 2) {
            // Rendering polygon using CAP format data
            
            // Try to detect if coordinates need swapping (Leaflet uses [lat, lng] format)
            let needsSwap = false;
            if (disaster.polygon.length > 0) {
              const sampleCoord = disaster.polygon[0];
              // If first coordinate is way outside normal latitude range (-90 to 90), 
              // it's probably a longitude value that needs to be swapped
              if (Array.isArray(sampleCoord) && sampleCoord.length === 2) {
                if (Math.abs(sampleCoord[0]) > 90) {
                  needsSwap = true;
                  // Auto-detection of coordinate format
                }
              }
            }
            
            // Convert the polygon coordinates array to Leaflet format
            // Make sure each coord is an array of [lat, lng]
            const polygonCoords = disaster.polygon.map(coord => {
              // Handle different possible formats
              if (Array.isArray(coord) && coord.length === 2) {
                // Trim excessive precision that might cause rendering issues
                let lat, lng;
                if (needsSwap) {
                  // Swap coordinates if they appear to be in [lng, lat] format
                  lat = parseFloat(parseFloat(coord[1]).toFixed(6));
                  lng = parseFloat(parseFloat(coord[0]).toFixed(6));
                } else {
                  lat = parseFloat(parseFloat(coord[0]).toFixed(6));
                  lng = parseFloat(parseFloat(coord[1]).toFixed(6));
                }
                return [lat, lng];
              } else if (typeof coord === 'object' && coord !== null) {
                if (coord.lat && coord.lng) {
                  // Object with explicit lat/lng properties
                  const lat = parseFloat(parseFloat(coord.lat).toFixed(6));
                  const lng = parseFloat(parseFloat(coord.lng).toFixed(6));
                  return [lat, lng];
                } else {
                  // Treat as array-like
                  let lat, lng;
                  if (needsSwap) {
                    lat = parseFloat(parseFloat(coord[1]).toFixed(6));
                    lng = parseFloat(parseFloat(coord[0]).toFixed(6));
                  } else {
                    lat = parseFloat(parseFloat(coord[0]).toFixed(6));
                    lng = parseFloat(parseFloat(coord[1]).toFixed(6));
                  }
                  return [lat, lng];
                }
              } else {
                console.error(`Invalid polygon coordinate format:`, coord);
                return null;
              }
            }).filter(coord => coord !== null);
            
            // Make sure coordinates are valid for Leaflet
            const validPolygonCoords = polygonCoords.filter(coord => {
              return !isNaN(coord[0]) && !isNaN(coord[1]) && 
                     coord[0] >= -90 && coord[0] <= 90 && 
                     coord[1] >= -180 && coord[1] <= 180;
            });
            
            // Final polygon coordinates are ready for rendering
            
            if (validPolygonCoords.length < 3) {
              console.error(`Not enough valid polygon coordinates: ${validPolygonCoords.length}`);
              // Fall back to circle
              const radiusInMeters = impactRadius * 1000;
              const circle = L.circle([lat, lng], {
                radius: radiusInMeters,
                color: alertColor,
                fillColor: alertColor,
                fillOpacity: 0.1,
                weight: 1,
                opacity: 0.5,
                interactive: false,
                zIndexOffset: -2000,
                pane: 'shadowPane'
              }).addTo(map);
              markers.push(circle);
              return;
            }
            
            let disasterPolygon = null;
            
            try {
              // Test polygon removed since real polygons are working properly now
              
              // Create the actual polygon with the CAP data
              disasterPolygon = L.polygon(validPolygonCoords, {
                color: alertColor,
                fillColor: alertColor,
                fillOpacity: 0.1,
                weight: 1,
                opacity: 0.5,
                interactive: false, // Don't interact with the polygon
                zIndexOffset: -2000, // Keep impact area below everything
                pane: 'shadowPane' // Use the shadow pane which is below markers
              }).addTo(map);
              // Polygon added successfully
              
              // Store the polygon to remove on cleanup
              markers.push(disasterPolygon);
            } catch (e) {
              console.error("Error creating polygon:", e);
              // Fall back to circle on error
              const radiusInMeters = impactRadius * 1000;
              const circle = L.circle([lat, lng], {
                radius: radiusInMeters,
                color: alertColor,
                fillColor: alertColor,
                fillOpacity: 0.1,
                weight: 1,
                opacity: 0.5,
                interactive: false,
                zIndexOffset: -2000,
                pane: 'shadowPane'
              }).addTo(map);
              markers.push(circle);
              return;
            }
            
            // Debug markers were removed since polygons are working properly now
          } else {
            // Fallback to circle if no polygon data
            console.log(`No polygon data, using circle for disaster: ${disaster.title}`);
            
            // Convert km to meters for the circle
            const radiusInMeters = impactRadius * 1000;
            
            // Create the circle
            const circle = L.circle([lat, lng], {
              radius: radiusInMeters,
              color: alertColor,
              fillColor: alertColor,
              fillOpacity: 0.1,
              weight: 1,
              opacity: 0.5,
              interactive: false, // Don't interact with the circle
              zIndexOffset: -2000, // Keep impact radius below everything
              pane: 'shadowPane' // Use the shadow pane which is below markers
            }).addTo(map);
            
            // Store the circle to remove on cleanup
            markers.push(circle);
          }
        }
      });
    }
    
    // Cleanup function to remove markers when component unmounts
    return () => {
      // Clean up individual markers
      markers.forEach(marker => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
      
      // Clean up cluster group if it exists
      if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map, disasters]);
  
  return null;
};

// Statistics panel component 
const StatisticsPanel = ({ statistics }) => {
  if (!statistics) return null;
  
  // Function to stop event propagation for all mouse/touch events
  const stopPropagation = (e) => {
    e.stopPropagation();
    e.nativeEvent?.stopImmediatePropagation?.();
  };
  
  return (
    <div 
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
      onMouseMove={stopPropagation}
      onTouchStart={stopPropagation}
      onTouchMove={stopPropagation}
      onWheel={stopPropagation}
      style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        width: '100%',
        maxHeight: '80vh',
        overflowY: 'auto',
        marginBottom: '10px',
        border: '1px solid rgba(244, 67, 54, 0.3)',
        pointerEvents: 'auto'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '15px',
        borderBottom: '2px solid #f5f5f5',
        paddingBottom: '10px'
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
            <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
          </svg>
          IMPACT ANALYSIS
        </div>
      </div>
      
      {/* Summary statistics */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '10px',
          backgroundColor: '#f9f9f9',
          padding: '10px',
          borderRadius: '6px'
        }}>
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            borderRight: '1px solid #eee',
            padding: '0 10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>DISASTERS</div>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: 'bold',
              color: '#2196F3'
            }}>{statistics.totalDisasters}</div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            borderRight: '1px solid #eee',
            padding: '0 10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>FACILITIES</div>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: 'bold',
              color: '#4CAF50'
            }}>{statistics.totalFacilities}</div>
          </div>
          <div style={{ 
            textAlign: 'center', 
            flex: 1,
            padding: '0 10px'
          }}>
            <div style={{ fontSize: '12px', color: '#666' }}>IMPACTED</div>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: 'bold',
              color: '#F44336'
            }}>{statistics.impactedFacilityCount} ({statistics.percentageImpacted}%)</div>
          </div>
        </div>
      </div>
      
      {/* Disaster Statistics */}
      {statistics.disasterStats && statistics.disasterStats.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 'bold', 
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12" y2="16"></line>
            </svg>
            DISASTER IMPACT DETAILS
          </div>
          <div 
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onTouchStart={stopPropagation}
            onTouchMove={stopPropagation}
            onWheel={stopPropagation}
            style={{ 
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #eee',
              borderRadius: '4px'
            }}
          >
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead style={{ 
                position: 'sticky',
                top: 0,
                backgroundColor: '#f5f5f5'
              }}>
                <tr>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Disaster</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Type</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Severity</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Impact Area</th>
                  <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Facilities</th>
                </tr>
              </thead>
              <tbody>
                {statistics.disasterStats.map((disaster, index) => (
                  <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{disaster.name}</td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #eee' }}>{disaster.type}</td>
                    <td style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      borderBottom: '1px solid #eee',
                      color: disaster.alertLevel?.toLowerCase() === 'red' ? '#d32f2f' : 
                            disaster.alertLevel?.toLowerCase() === 'orange' ? '#ff9800' : 
                            disaster.alertLevel?.toLowerCase() === 'green' ? '#4caf50' : '#757575'
                    }}>{disaster.severity}</td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                      {disaster.impactArea} km²
                      {disaster.polygon && <span style={{ 
                        fontSize: '10px', 
                        color: '#2196F3',
                        backgroundColor: '#e3f2fd',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        marginLeft: '4px'
                      }}>POLYGON</span>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#F44336' }}>
                      {disaster.affectedFacilities}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Overlapping Disasters */}
      {statistics.overlappingImpacts && statistics.overlappingImpacts.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 'bold', 
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            color: '#d32f2f'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
              <line x1="6" y1="9" x2="6" y2="21"></line>
            </svg>
            OVERLAPPING DISASTER IMPACTS ({statistics.overlappingImpacts.length})
          </div>
          <div 
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
            onMouseMove={stopPropagation}
            onTouchStart={stopPropagation}
            onTouchMove={stopPropagation}
            onWheel={stopPropagation}
            style={{ 
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #ffcdd2',
              borderRadius: '4px',
              backgroundColor: '#ffebee'
            }}
          >
            {statistics.overlappingImpacts.map((overlap, index) => (
              <div key={index} style={{ 
                padding: '10px', 
                borderBottom: index < statistics.overlappingImpacts.length - 1 ? '1px solid #ffcdd2' : 'none',
                fontSize: '12px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {overlap.disasters[0]} + {overlap.disasters[1]}
                </div>
                <div style={{ color: '#555' }}>
                  Impacting {overlap.facilities.length} {overlap.facilities.length === 1 ? 'facility' : 'facilities'}:
                </div>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '5px',
                  marginTop: '5px'
                }}>
                  {overlap.facilities.map((facility, fidx) => (
                    <span key={fidx} style={{
                      backgroundColor: '#fff',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      border: '1px solid #ffcdd2'
                    }}>{facility}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Timeline component for disaster progression
const TimelineVisualization = ({ disasters, onTimeChange }) => {
  const [timelinePosition, setTimelinePosition] = useState(100); // Default to 100% (present)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef(null);
  
  // Extract dates and sort them
  const timelineDates = useMemo(() => {
    if (!disasters || disasters.length === 0) return [];
    
    return disasters
      .filter(d => d.pubDate)
      .map(d => new Date(d.pubDate))
      .sort((a, b) => a - b);
  }, [disasters]);
  
  // Get earliest and latest dates
  const earliestDate = useMemo(() => 
    timelineDates.length > 0 ? timelineDates[0] : new Date(), 
  [timelineDates]);
  
  const latestDate = useMemo(() => 
    timelineDates.length > 0 ? timelineDates[timelineDates.length - 1] : new Date(), 
  [timelineDates]);
  
  // Calculate current date based on timeline position
  const currentDate = useMemo(() => {
    if (timelineDates.length === 0) return new Date();
    
    // Calculate date based on position percentage
    const timeSpan = latestDate - earliestDate;
    const timeOffset = timeSpan * (timelinePosition / 100);
    return new Date(earliestDate.getTime() + timeOffset);
  }, [earliestDate, latestDate, timelinePosition, timelineDates]);
  
  // Handle slider change
  const handleTimelineChange = (e) => {
    // Stop event propagation to prevent map dragging
    e.stopPropagation();
    
    const newPosition = parseFloat(e.target.value);
    setTimelinePosition(newPosition);
    
    // Filter disasters up to current date
    if (onTimeChange) {
      onTimeChange(currentDate);
    }
  };
  
  // Handle play/pause
  const togglePlay = (e) => {
    // Stop map interaction
    if (e) e.stopPropagation();
    setPlaying(!playing);
  };
  
  // Play timeline animation effect
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setTimelinePosition(prev => {
          const next = prev + (0.2 * speed);
          if (next >= 100) {
            setPlaying(false);
            return 100;
          }
          return next;
        });
      }, 50);
    } else if (playRef.current) {
      clearInterval(playRef.current);
    }
    
    return () => {
      if (playRef.current) {
        clearInterval(playRef.current);
      }
    };
  }, [playing, speed]);
  
  // Update filtered disasters when timeline changes
  useEffect(() => {
    if (onTimeChange) {
      onTimeChange(currentDate);
    }
  }, [currentDate, onTimeChange]);
  
  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      style={{
        backgroundColor: 'white',
        padding: '15px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        width: '100%',
        marginBottom: '10px',
        border: '1px solid rgba(33, 150, 243, 0.3)',
        pointerEvents: 'auto'
      }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          DISASTER TIMELINE
        </div>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <button 
            onClick={(e) => togglePlay(e)}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              backgroundColor: playing ? '#f44336' : '#4CAF50',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {playing ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                PAUSE
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                PLAY
              </>
            )}
          </button>
          <select
            value={speed}
            onChange={(e) => {
              e.stopPropagation();
              setSpeed(Number(e.target.value));
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '4px',
              fontSize: '12px'
            }}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
          </select>
        </div>
      </div>
      
      <div style={{
        position: 'relative',
        marginBottom: '8px'
      }}>
        <input
          type="range"
          min="0"
          max="100"
          value={timelinePosition}
          onChange={handleTimelineChange}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '16px', /* Increased height for better touch target */
            background: 'linear-gradient(to right, #2196F3, #f44336)',
            appearance: 'none',
            outline: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#666'
        }}>
          <span>{formatDate(earliestDate)}</span>
          <span style={{
            fontWeight: 'bold', 
            color: '#F44336',
            position: 'absolute',
            left: `${timelinePosition}%`,
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            padding: '1px 4px',
            borderRadius: '3px',
            border: '1px solid #f44336',
            fontSize: '11px',
            top: '-20px'
          }}>
            {formatDate(currentDate)}
          </span>
          <span>{formatDate(latestDate)}</span>
        </div>
      </div>
    </div>
  );
};

const MapComponent = ({ disasters, facilities, impactedFacilities, impactStatistics, onFacilitySelect, loading, dateFilter, handleDateFilterChange, onDrawerState, onGenerateSitrep, sitrepLoading, sitrep }) => {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timelineFilteredDisasters, setTimelineFilteredDisasters] = useState([]);
  const [visibleDisasterTypes, setVisibleDisasterTypes] = useState({
    eq: true,
    tc: true,
    fl: true,
    vo: true,
    dr: true,
    wf: true,
    ts: true
  });
  
  // Show zoom indicator when date filter changes
  // This useEffect runs when dateFilter prop changes
  useEffect(() => {
    // Don't show on initial render
    if (dateFilter) {
      setShowZoomIndicator(true);
    }
  }, [dateFilter]);
  
  // Effect to clean up map resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up map resources
      if (mapInstance) {
        mapInstance.off('click', handleMapClick);
      }
    };
  }, [mapInstance]);
  
  // Handle fullscreen change events from the browser
  useEffect(() => {
    const fullscreenChangeHandler = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      
      setIsFullscreen(isCurrentlyFullscreen);
    };
    
    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
    
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('mozfullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('webkitfullscreenchange', fullscreenChangeHandler);
      document.removeEventListener('MSFullscreenChange', fullscreenChangeHandler);
    };
  }, []);
  
  // Initialize timeline with all disasters
  useEffect(() => {
    if (disasters && disasters.length > 0) {
      setTimelineFilteredDisasters(disasters);
    }
  }, [disasters]);
  
  // Handler for timeline date change
  const handleTimelineChange = (date) => {
    if (!disasters || disasters.length === 0) return;
    
    // Filter disasters that occurred before or on the selected date
    const filtered = disasters.filter(disaster => {
      if (!disaster.pubDate) return false;
      
      const disasterDate = new Date(disaster.pubDate);
      return disasterDate <= date;
    });
    
    setTimelineFilteredDisasters(filtered);
  };
  // Add CAP filters
  const [severityFilters, setSeverityFilters] = useState({
    'Extreme': true,
    'Severe': true,
    'Moderate': true,
    'Minor': true,
    'Unknown': true
  });
  const [certaintyFilters, setCertaintyFilters] = useState({
    'Observed': true,
    'Likely': true,
    'Possible': true,
    'Unlikely': true,
    'Unknown': true
  });
  const [urgencyFilters, setUrgencyFilters] = useState({
    'Immediate': true,
    'Expected': true,
    'Future': true,
    'Past': true,
    'Unknown': true
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [facilityDrawerOpen, setFacilityDrawerOpen] = useState(false);
  const [sitrepDrawerOpen, setSitrepDrawerOpen] = useState(false);
  const [mapLayersDrawerOpen, setMapLayersDrawerOpen] = useState(false);
  const [currentMapLayer, setCurrentMapLayer] = useState('street'); // 'street', 'satellite', 'terrain'
  const [showRoads, setShowRoads] = useState(false); // Toggle for road overlay
  const [showLegend, setShowLegend] = useState(false); // Default to hidden
  const [showLabels, setShowLabels] = useState(false); // Toggle for facility labels
  
  // For AI analysis
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showAnalysisDrawer, setShowAnalysisDrawer] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  
  // Function to handle click outside of overlays to close them
  const handleMapClick = (e) => {
    // We don't need to check the target - if the map is clicked, close the overlays
    // Leaflet event handling will ensure this only triggers for map clicks
    if (showLegend) setShowLegend(false);
    if (showTimeline) setShowTimeline(false);
    if (showStatistics) setShowStatistics(false);
    
    // Also close any open drawers
    if (filterDrawerOpen) setFilterDrawerOpen(false);
    if (facilityDrawerOpen) setFacilityDrawerOpen(false);
    if (sitrepDrawerOpen) setSitrepDrawerOpen(false);
    if (mapLayersDrawerOpen) setMapLayersDrawerOpen(false);
    if (showAnalysisDrawer) setShowAnalysisDrawer(false);
  };
  
  // States for column selection modal
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [fileColumns, setFileColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState({
    name: '',
    latitude: '',
    longitude: '',
    aiAnalysisFields: [],
    displayFields: []
  });
  
  // Helper function to get severity normalized
  const getNormalizedSeverity = (disaster) => {
    const severity = (disaster.severity || disaster.alertLevel || '').toLowerCase();
    if (!severity) return 'unknown';
    return severity;
  };
  
  // Helper function to get certainty normalized
  const getNormalizedCertainty = (disaster) => {
    const certainty = (disaster.certainty || '').toLowerCase();
    if (!certainty) return 'unknown';
    return certainty;
  };
  
  // Helper function to get urgency normalized
  const getNormalizedUrgency = (disaster) => {
    const urgency = (disaster.urgency || '').toLowerCase();
    if (!urgency) return 'unknown';
    return urgency;
  };
  
  // Handler function for when the map instance is ready
  const handleMapReady = (map) => {
    console.log("Map instance is ready");
    setMapInstance(map);
    
    // Add click handler to close overlays when clicking outside
    map.on('click', handleMapClick);
  };
  
  // Toggle full-screen mode
  const toggleFullscreen = () => {
    const element = mapContainerRef.current;
    
    if (!isFullscreen) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) { /* Firefox */
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) { /* IE/Edge */
        element.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE/Edge */
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };
  
  // Function to zoom the map to fit all filtered disasters
  const zoomToFilteredEvents = (disasters) => {
    console.log("Zoom to fit called");
    
    if (!mapInstance || !disasters || disasters.length === 0) {
      console.log("No map instance or no disasters to fit");
      return;
    }
    
    // Create bounds object
    const bounds = L.latLngBounds();
    let pointsAdded = 0;
    
    console.log(`Processing ${disasters.length} disasters for zoom bounds`);
    
    // Add all disaster points to bounds
    disasters.forEach(disaster => {
      if (disaster.latitude != null && disaster.longitude != null) {
        const lat = parseFloat(disaster.latitude);
        const lng = parseFloat(disaster.longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend([lat, lng]);
          pointsAdded++;
        }
      }
      
      // If disaster has polygon, add all polygon points to bounds
      if (disaster.polygon && Array.isArray(disaster.polygon) && disaster.polygon.length > 0) {
        disaster.polygon.forEach(point => {
          if (Array.isArray(point) && point.length === 2) {
            const lat = parseFloat(point[0]);
            const lng = parseFloat(point[1]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              bounds.extend([lat, lng]);
              pointsAdded++;
            }
          }
        });
      }
    });
    
    // Also add facility locations to the bounds if any are impacted
    if (facilities && facilities.length > 0) {
      console.log(`Adding ${facilities.length} facilities to bounds`);
      
      facilities.forEach(facility => {
        if (facility.latitude != null && facility.longitude != null) {
          const lat = parseFloat(facility.latitude);
          const lng = parseFloat(facility.longitude);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            bounds.extend([lat, lng]);
            pointsAdded++;
          }
        }
      });
    }
    
    console.log(`Added ${pointsAdded} points to bounds`);
    
    // Check if bounds are valid
    if (bounds.isValid()) {
      console.log("Bounds are valid, fitting map to bounds");
      
      try {
        // Use the direct map instance from our state
        mapInstance.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 8,
          animate: true,
          duration: 0.5
        });
        console.log("Map fitted to bounds");
      } catch (error) {
        console.error("Error fitting bounds:", error);
      }
    } else {
      console.log("Bounds are not valid, cannot fit map");
      
      // If no valid bounds but we have disasters, at least center on the first one
      if (disasters.length > 0 && disasters[0].latitude && disasters[0].longitude) {
        const center = [
          parseFloat(disasters[0].latitude),
          parseFloat(disasters[0].longitude)
        ];
        
        if (!isNaN(center[0]) && !isNaN(center[1])) {
          mapInstance.setView(center, 5);
          console.log("Centered map on first disaster");
        }
      }
    }
  };
  
  // Filter disasters based on all selected filters
  // Use timeline-filtered disasters if timeline is active, otherwise use regular disasters
  const disastersToFilter = showTimeline ? timelineFilteredDisasters : disasters;
  
  const filteredDisasters = disastersToFilter.filter(disaster => {
    // Filter by disaster type
    if (!visibleDisasterTypes[disaster.eventType?.toLowerCase()]) return false;
    
    // Filter by severity
    const severityKey = Object.keys(severityFilters)
      .find(k => k.toLowerCase() === getNormalizedSeverity(disaster)) || 'Unknown';
    if (!severityFilters[severityKey]) return false;
    
    // Filter by certainty
    const certaintyKey = Object.keys(certaintyFilters)
      .find(k => k.toLowerCase() === getNormalizedCertainty(disaster)) || 'Unknown';
    if (!certaintyFilters[certaintyKey]) return false;
    
    // Filter by urgency
    const urgencyKey = Object.keys(urgencyFilters)
      .find(k => k.toLowerCase() === getNormalizedUrgency(disaster)) || 'Unknown';
    if (!urgencyFilters[urgencyKey]) return false;
    
    return true;
  });
  
  // Count disasters by alert level (for the summary card)
  const alertLevelCounts = {
    red: 0,
    orange: 0,
    green: 0
  };
  
  filteredDisasters.forEach(disaster => {
    const severity = (disaster.severity || disaster.alertLevel || '').toLowerCase();
    if (severity.includes('red') || severity.includes('extreme') || severity.includes('severe')) {
      alertLevelCounts.red++;
    } else if (severity.includes('orange') || severity.includes('moderate')) {
      alertLevelCounts.orange++;
    } else {
      alertLevelCounts.green++;
    }
  });

  // Effect to refresh map view when data changes
  useEffect(() => {
    if (mapRef.current && mapRef.current._map) {
      console.log('Updating map view after data change (disasters or facilities)');
      
      // Wait for map to be ready
      setTimeout(() => {
        try {
          // Fit bounds if we have data
          if ((filteredDisasters && filteredDisasters.length > 0) || 
              (facilities && facilities.length > 0)) {
            
            // Create bounds from points
            const points = [];
            
            // Add disaster points
            filteredDisasters.forEach(disaster => {
              if (disaster.latitude && disaster.longitude) {
                const lat = parseFloat(disaster.latitude);
                const lng = parseFloat(disaster.longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                  points.push([lat, lng]);
                }
              }
            });
            
            // Add facility points
            facilities.forEach(facility => {
              if (facility.latitude && facility.longitude) {
                const lat = parseFloat(facility.latitude);
                const lng = parseFloat(facility.longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                  points.push([lat, lng]);
                }
              }
            });
            
            // If we have points, create bounds and fit
            if (points.length > 0) {
              const bounds = L.latLngBounds(points);
              mapRef.current._map.fitBounds(bounds, { 
                padding: [50, 50],
                maxZoom: 12
              });
            }
          }
        } catch (error) {
          console.error('Error fitting map to data bounds:', error);
        }
      }, 100);
    }
  }, [filteredDisasters, facilities]);
  
  // Handle file uploads
  const handleFileUpload = (file) => {
    if (!file) return;
    
    // Check file extension
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    if (fileExt === 'csv') {
      // Process CSV directly
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvData = e.target.result;
        onDrawerState(csvData);
        toggleFacilityDrawer();
      };
      reader.readAsText(file);
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      // Process Excel file
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Identify columns (first row)
        if (jsonData.length > 0) {
          const columns = jsonData[0];
          setFileColumns(columns);
          setFileData({
            workbook,
            jsonData,
            fileName: file.name
          });
          
          // Auto-detect location columns
          let nameCol = '';
          let latCol = '';
          let longCol = '';
          
          columns.forEach(col => {
            const colLower = col.toLowerCase();
            if (colLower.includes('name') || colLower.includes('facility')) {
              nameCol = col;
            } else if (colLower.includes('lat') || colLower === 'y') {
              latCol = col;
            } else if (colLower.includes('long') || colLower.includes('lng') || colLower === 'x') {
              longCol = col;
            }
          });
          
          setSelectedColumns(prev => ({
            ...prev,
            name: nameCol,
            latitude: latCol,
            longitude: longCol
          }));
          
          // Show column selection modal
          setShowColumnModal(true);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)');
    }
  };
  
  // Process the Excel data after column selection
  const processExcelData = () => {
    if (!fileData || !selectedColumns.name || !selectedColumns.latitude || !selectedColumns.longitude) {
      alert('Please select the required columns (Name, Latitude, Longitude)');
      return;
    }
    
    // Convert Excel data to CSV
    const { jsonData } = fileData;
    const headers = jsonData[0];
    
    // Find column indexes
    const nameIdx = headers.indexOf(selectedColumns.name);
    const latIdx = headers.indexOf(selectedColumns.latitude);
    const longIdx = headers.indexOf(selectedColumns.longitude);
    
    // Prepare additional data columns
    const additionalCols = [...selectedColumns.aiAnalysisFields, ...selectedColumns.displayFields];
    const additionalIdxs = additionalCols.map(col => headers.indexOf(col));
    
    // Create CSV data
    let csvData = 'name,latitude,longitude';
    
    // Add additional columns to header
    additionalCols.forEach(col => {
      csvData += `,${col}`;
    });
    
    csvData += '\n';
    
    // Add data rows
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row[nameIdx] && !isNaN(parseFloat(row[latIdx])) && !isNaN(parseFloat(row[longIdx]))) {
        csvData += `${row[nameIdx]},${row[latIdx]},${row[longIdx]}`;
        
        // Add additional fields
        additionalIdxs.forEach(idx => {
          csvData += `,${row[idx] || ''}`;
        });
        
        csvData += '\n';
      }
    }
    
    // Process the CSV data
    onDrawerState(csvData);
    
    // Close modal and drawer
    setShowColumnModal(false);
    toggleFacilityDrawer();
  };
  
  // Toggle drawers
  const toggleFilterDrawer = () => {
    setFilterDrawerOpen(!filterDrawerOpen);
    if (!filterDrawerOpen) {
      setFacilityDrawerOpen(false);
      setSitrepDrawerOpen(false);
      setMapLayersDrawerOpen(false);
    }
  };
  
  const toggleFacilityDrawer = () => {
    setFacilityDrawerOpen(!facilityDrawerOpen);
    if (!facilityDrawerOpen) {
      setFilterDrawerOpen(false);
      setSitrepDrawerOpen(false);
      setMapLayersDrawerOpen(false);
    }
  };
  
  const toggleSitrepDrawer = () => {
    setSitrepDrawerOpen(!sitrepDrawerOpen);
    if (!sitrepDrawerOpen) {
      setFilterDrawerOpen(false);
      setFacilityDrawerOpen(false);
      setMapLayersDrawerOpen(false);
      setShowAnalysisDrawer(false);
    }
  };
  
  const toggleMapLayersDrawer = () => {
    setMapLayersDrawerOpen(!mapLayersDrawerOpen);
    if (!mapLayersDrawerOpen) {
      setFilterDrawerOpen(false);
      setFacilityDrawerOpen(false);
      setSitrepDrawerOpen(false);
      setShowAnalysisDrawer(false);
    }
  };
  
  const toggleAnalysisDrawer = () => {
    setShowAnalysisDrawer(!showAnalysisDrawer);
    if (!showAnalysisDrawer) {
      setFilterDrawerOpen(false);
      setFacilityDrawerOpen(false);
      setSitrepDrawerOpen(false);
      setMapLayersDrawerOpen(false);
    }
  };
  
  // Function to handle AI analysis of a facility
  const handleAnalyzeFacility = async (facility, impacts) => {
    // Call the parent component's onFacilitySelect to ensure consistency
    onFacilitySelect(facility);
    
    // Set our local state for analysis
    setSelectedFacility(facility);
    setAnalysisLoading(true);
    setAnalysisData(null);
    setShowAnalysisDrawer(true);
    
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ facility, impacts }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data.analysis);
        setIsAIGenerated(data.isAIGenerated);
      } else {
        console.error('Failed to fetch AI analysis');
      }
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };
  
  // Setup effect
  useEffect(() => {
    // Initialization code if needed
  }, [disasters, facilities]);

  // Helper function to determine disaster type name and appropriate icon
  const getDisasterInfo = (eventType) => {
    const disasterTypes = {
      'eq': {
        name: 'Earthquake',
        icon: '/images/gdacs/earthquake.svg'
      },
      'tc': {
        name: 'Tropical Cyclone',
        icon: '/images/gdacs/cyclone.svg'
      },
      'fl': {
        name: 'Flood',
        icon: '/images/gdacs/flood.svg'
      },
      'vo': {
        name: 'Volcanic Activity',
        icon: '/images/gdacs/volcano.svg'
      },
      'dr': {
        name: 'Drought',
        icon: '/images/gdacs/drought.svg'
      },
      'wf': {
        name: 'Wildfire',
        icon: '/images/gdacs/fire.svg'
      },
      'ts': {
        name: 'Tsunami',
        icon: '/images/gdacs/tsunami.svg'
      }
    };
    
    const type = eventType?.toLowerCase();
    return disasterTypes[type] || { name: eventType, icon: '/images/gdacs/warning.svg' };
  };
  
  // Helper function to get just the name for backward compatibility
  const getDisasterTypeName = (eventType) => {
    return getDisasterInfo(eventType).name;
  };

  // Helper function to determine marker color based on alert level or severity
  const getAlertColor = (alertLevel) => {
    if (!alertLevel) return '#2196F3'; // Default blue
    
    // Convert both traditional alert levels and CAP severity levels
    const level = alertLevel.toLowerCase();
    
    if (level === 'red' || level === 'extreme' || level === 'severe') {
      return '#ff4444';
    } else if (level === 'orange' || level === 'moderate') {
      return '#ffa500';
    } else if (level === 'green' || level === 'minor') {
      return '#4CAF50';
    } else {
      return '#2196F3'; // Default blue
    }
  };

  // Helper function to toggle a disaster type filter
  const toggleDisasterType = (type) => {
    setVisibleDisasterTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
    setShowZoomIndicator(true); // Show zoom indicator when filter changes
  };
  
  // Helper functions for CAP filters
  const toggleSeverityFilter = (severity) => {
    setSeverityFilters(prev => ({
      ...prev,
      [severity]: !prev[severity]
    }));
    setShowZoomIndicator(true); // Show zoom indicator when filter changes
  };
  
  const toggleCertaintyFilter = (certainty) => {
    setCertaintyFilters(prev => ({
      ...prev,
      [certainty]: !prev[certainty]
    }));
    setShowZoomIndicator(true); // Show zoom indicator when filter changes
  };
  
  const toggleUrgencyFilter = (urgency) => {
    setUrgencyFilters(prev => ({
      ...prev,
      [urgency]: !prev[urgency]
    }));
    setShowZoomIndicator(true); // Show zoom indicator when filter changes
  };
  
  // Get available disaster types from current disaster data
  const getAvailableDisasterTypes = () => {
    const types = new Set();
    disasters.forEach(disaster => {
      if (disaster.eventType) {
        types.add(disaster.eventType.toLowerCase());
      }
    });
    return Array.from(types);
  };
  
  const availableTypes = getAvailableDisasterTypes();
  
  if (loading) {
    return <div className="loading">Loading disaster data...</div>;
  }

  // Add CSS animation for the pulsing effect and facility label styles
  const customStyles = `
    @keyframes pulse {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
    
    /* Style for facility labels */
    .facility-label .leaflet-tooltip-content {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }
    
    .facility-label {
      background-color: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
    
    /* Fullscreen mode adjustments */
    .map-container:fullscreen,
    .map-container:-webkit-full-screen,
    .map-container:-moz-full-screen,
    .map-container:-ms-fullscreen {
      height: 100vh !important;
      width: 100vw !important;
      padding: 0 !important;
      margin: 0 !important;
      border-radius: 0 !important;
    }
    
    .map-container:fullscreen .leaflet-container,
    .map-container:-webkit-full-screen .leaflet-container,
    .map-container:-moz-full-screen .leaflet-container,
    .map-container:-ms-fullscreen .leaflet-container {
      height: 100vh !important;
      width: 100vw !important;
    }
    
    /* Fix Leaflet control positions in fullscreen */
    .map-container:fullscreen .leaflet-control-container .leaflet-top,
    .map-container:-webkit-full-screen .leaflet-control-container .leaflet-top,
    .map-container:-moz-full-screen .leaflet-control-container .leaflet-top,
    .map-container:-ms-fullscreen .leaflet-control-container .leaflet-top {
      top: 10px;
    }
    
    .map-container:fullscreen .leaflet-control-container .leaflet-bottom,
    .map-container:-webkit-full-screen .leaflet-control-container .leaflet-bottom,
    .map-container:-moz-full-screen .leaflet-control-container .leaflet-bottom,
    .map-container:-ms-fullscreen .leaflet-control-container .leaflet-bottom {
      bottom: 10px;
    }
    
  `;
  
  return (
    <div 
      className="map-container" 
      ref={mapContainerRef}
      style={{
        position: 'relative',
        ...(isFullscreen && {
          height: '100vh',
          width: '100vw',
          margin: 0,
          padding: 0,
          borderRadius: 0,
          overflow: 'hidden'
        })
      }}
    >
      {/* Add style for animations and facility labels */}
      <style>{customStyles}</style>
      
      {/* Floating action buttons */}
      <button 
        className="drawer-toggle drawer-toggle-right"
        onClick={toggleFilterDrawer}
        title="Filter Disasters"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        Filters
      </button>
      
      <button 
        className="drawer-toggle drawer-toggle-facilities"
        onClick={toggleFacilityDrawer}
        title="Manage Facilities"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Facilities
      </button>
      
      <button 
        className="drawer-toggle drawer-toggle-sitrep"
        onClick={toggleSitrepDrawer}
        title="Generate Report"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Sitrep
      </button>
      
      <button 
        className="drawer-toggle drawer-toggle-layers"
        onClick={toggleMapLayersDrawer}
        title="Map Layers"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        Layers
      </button>
      
      {/* Filter drawer */}
      <div className={`drawer-backdrop ${filterDrawerOpen ? 'open' : ''}`} onClick={toggleFilterDrawer}></div>
      <div className={`drawer drawer-right ${filterDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Disaster Filters
          </h3>
          <button className="drawer-close" onClick={toggleFilterDrawer}>×</button>
        </div>
        <div className="drawer-content">
          {/* Visualization Options */}
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M21 2H3v16h5v4l4-4h5l4-4V2zM11 11V7M16 11V7"></path>
              </svg>
              VISUALIZATION OPTIONS
            </div>
            
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              marginBottom: '15px',
              overflow: 'hidden'
            }}>
              {/* Heatmap Toggle Row */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '10px',
                borderBottom: showHeatmap ? '1px dashed #e0e0e0' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <circle cx="15.5" cy="8.5" r="1.5"></circle>
                    <circle cx="15.5" cy="15.5" r="1.5"></circle>
                    <circle cx="8.5" cy="15.5" r="1.5"></circle>
                  </svg>
                  <span style={{ fontWeight: 'bold' }}>Heatmap View</span>
                </div>
                <div 
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: showHeatmap ? '#FF9800' : '#e0e0e0',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'background-color 0.3s',
                    cursor: 'pointer'
                  }}
                >
                  <div 
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: showHeatmap ? '22px' : '2px',
                      transition: 'left 0.3s'
                    }}
                  ></div>
                </div>
              </div>
              
              {/* Heatmap explanation - shown only when heatmap is active */}
              {showHeatmap && (
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#fff8e1',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#795548'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>About Heatmap Visualization:</div>
                  <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    <li>Shows disaster concentration areas</li>
                    <li>Larger, brighter spots indicate more severe events</li>
                    <li>Circles automatically resize based on zoom level</li>
                    <li>Intensity varies by event severity:<br />
                      <span style={{ color: '#d32f2f' }}>■</span> Extreme 
                      <span style={{ color: '#f57c00', marginLeft: '5px' }}>■</span> Severe 
                      <span style={{ color: '#ffa000', marginLeft: '5px' }}>■</span> Moderate 
                      <span style={{ color: '#ffc107', marginLeft: '5px' }}>■</span> Minor
                    </li>
                  </ul>
                </div>
              )}
            </div>
            
            {/* Map Legend Control */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              marginBottom: '15px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '10px',
                borderBottom: showLegend ? '1px dashed #e0e0e0' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  <span style={{ fontWeight: 'bold' }}>Map Legend</span>
                </div>
                <div 
                  onClick={() => setShowLegend(!showLegend)}
                  style={{
                    width: '40px',
                    height: '20px',
                    backgroundColor: showLegend ? '#2196F3' : '#e0e0e0',
                    borderRadius: '10px',
                    position: 'relative',
                    transition: 'background-color 0.3s',
                    cursor: 'pointer'
                  }}
                >
                  <div 
                    style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: showLegend ? '22px' : '2px',
                      transition: 'left 0.3s'
                    }}
                  ></div>
                </div>
              </div>
              
              {/* Legend explanation - shown only when legend is active */}
              {showLegend && (
                <div style={{ 
                  padding: '12px',
                  backgroundColor: '#fff',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#555'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Disaster Representation:</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ 
                        width: '20px', 
                        height: '20px', 
                        borderRadius: '50%', 
                        border: '3px solid #ff5722',
                        marginRight: '8px',
                        position: 'relative'
                      }}>
                        <div style={{ position: 'absolute', top: '2px', left: '2px', width: '12px', height: '12px', backgroundColor: 'white', borderRadius: '50%' }}></div>
                      </div>
                      <span>Disaster point location</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ 
                        width: '24px', 
                        height: '18px', 
                        backgroundColor: 'rgba(255, 87, 34, 0.2)',
                        border: '1px solid rgba(255, 87, 34, 0.5)',
                        marginRight: '8px',
                        borderRadius: '3px'
                      }}></div>
                      <span>Impact polygon (from official data)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        width: '20px', 
                        height: '20px', 
                        border: '1px dashed rgba(255, 87, 34, 0.7)',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}></div>
                      <span>Estimated impact radius (when polygon unavailable)</span>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Facility Status:</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#4CAF50',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}></div>
                      <span>Safe facility</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#ff4444',
                        borderRadius: '50%',
                        marginRight: '8px'
                      }}></div>
                      <span>Impacted facility</span>
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#333' }}>Alert Levels:</div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#ff4444',
                        marginRight: '8px'
                      }}></div>
                      <span>Red alert (severe impact)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#ffa500',
                        marginRight: '8px'
                      }}></div>
                      <span>Orange alert (moderate impact)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#4CAF50',
                        marginRight: '8px'
                      }}></div>
                      <span>Green alert (minor impact)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Zoom to Fit Control */}
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px',
              backgroundColor: '#f1f8e9',
              borderRadius: '8px',
              marginBottom: '15px',
              border: '1px solid #dcedc8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                </svg>
                <span style={{ fontWeight: 'bold' }}>Zoom to Filtered Events</span>
              </div>
              <button 
                onClick={() => {
                  zoomToFilteredEvents(filteredDisasters);
                  setShowZoomIndicator(false); // Hide indicator after zooming
                }}
                style={{
                  backgroundColor: showZoomIndicator ? '#FF9800' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background-color 0.3s'
                }}
              >
                {showZoomIndicator && (
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.1) 100%)',
                    animation: 'pulse 1.5s infinite',
                    zIndex: 0
                  }}></span>
                )}
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <path d="M15 3h6v6"></path>
                    <path d="M10 14L21 3"></path>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  </svg>
                  {showZoomIndicator ? 'Update View' : 'Fit View'}
                </span>
              </button>
            </div>
          </div>
          
          {/* Disaster Type Filters */}
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              DISASTER TYPE FILTERS
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              {availableTypes.map(type => {
                const info = getDisasterInfo(type);
                const isActive = visibleDisasterTypes[type];
                
                return (
                  <button
                    key={type}
                    onClick={() => toggleDisasterType(type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: '1px solid #ddd',
                      backgroundColor: isActive ? '#e3f2fd' : '#f5f5f5',
                      cursor: 'pointer',
                      opacity: isActive ? 1 : 0.65,
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 2px 5px rgba(33, 150, 243, 0.2)' : 'none',
                      position: 'relative',
                      width: 'calc(50% - 5px)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: isActive ? '#2196F3' : '#e0e0e0',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px'
                    }}>
                      <img 
                        src={info.icon} 
                        alt={info.name}
                        width="16" 
                        height="16" 
                        style={{
                          filter: isActive ? 'brightness(10)' : 'none'
                        }}
                      />
                    </div>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: isActive ? 'bold' : 'normal',
                      color: isActive ? '#1976D2' : '#666'
                    }}>
                      {info.name}
                    </span>
                    {isActive && (
                      <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#2196F3',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {availableTypes.length > 0 && (
              <button
                onClick={() => {
                  const allActive = Object.values(visibleDisasterTypes).every(Boolean);
                  const newState = {};
                  
                  availableTypes.forEach(type => {
                    newState[type] = !allActive;
                  });
                  
                  setVisibleDisasterTypes(prev => ({
                    ...prev,
                    ...newState
                  }));
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: '#f0f0f0',
                  cursor: 'pointer',
                  fontSize: '13px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  color: '#666',
                  marginTop: '5px'
                }}
              >
                {Object.values(visibleDisasterTypes).every(Boolean) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                  </svg>
                )}
                {Object.values(visibleDisasterTypes).every(Boolean) ? 'Hide All Disaster Types' : 'Show All Disaster Types'}
              </button>
            )}
            
            <div style={{ 
              marginTop: '15px', 
              borderTop: '1px solid #f5f5f5', 
              paddingTop: '10px', 
              fontSize: '12px', 
              color: '#757575',
              textAlign: 'center'
            }}>
              <span>
                {Object.values(visibleDisasterTypes).filter(Boolean).length} of {availableTypes.length} disaster types visible
              </span>
            </div>
          </div>
          
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              TIME FILTER
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <select 
                value={dateFilter} 
                onChange={handleDateFilterChange}
                style={{ 
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#f9f9f9',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="48h">Last 48 Hours</option>
                <option value="72h">Last 72 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Events</option>
              </select>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px' 
            }}>
              <button 
                onClick={() => handleDateFilterChange({ target: { value: '24h' }})}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: dateFilter === '24h' ? '2px solid #2196F3' : '1px solid #e0e0e0',
                  backgroundColor: dateFilter === '24h' ? '#e3f2fd' : '#f9f9f9',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Last 24 Hours</span>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: '#1976D2'
                }}>
                  {disasters.filter(d => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    return new Date(d.pubDate) >= cutoff;
                  }).length}
                </span>
              </button>
              
              <button 
                onClick={() => handleDateFilterChange({ target: { value: '72h' }})}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: dateFilter === '72h' ? '2px solid #2196F3' : '1px solid #e0e0e0',
                  backgroundColor: dateFilter === '72h' ? '#e3f2fd' : '#f9f9f9',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Last 72 Hours</span>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: '#1976D2'
                }}>
                  {disasters.filter(d => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
                    return new Date(d.pubDate) >= cutoff;
                  }).length}
                </span>
              </button>
              
              <button 
                onClick={() => handleDateFilterChange({ target: { value: 'all' }})}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '8px',
                  border: dateFilter === 'all' ? '2px solid #2196F3' : '1px solid #e0e0e0',
                  backgroundColor: dateFilter === 'all' ? '#e3f2fd' : '#f9f9f9',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left'
                }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>All Events</span>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: '#1976D2'
                }}>
                  {disasters.length}
                </span>
              </button>
            </div>
          </div>
          
          {/* Severity Filter Section */}
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px',
              marginTop: '20px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              SEVERITY FILTER
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(severityFilters).map(severity => (
                <div key={severity} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                  <div 
                    onClick={() => toggleSeverityFilter(severity)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '4px',
                      marginRight: '10px',
                      backgroundColor: severityFilters[severity] ? '#2196F3' : 'transparent',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {severityFilters[severity] && (
                      <span style={{ 
                        position: 'absolute', 
                        color: 'white', 
                        fontSize: '16px', 
                        top: '-2px', 
                        left: '2px' 
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{severity}</span>
                    <span style={{ 
                      fontSize: '12px', 
                      backgroundColor: '#e3f2fd', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      color: '#1976D2'
                    }}>
                      {disasters.filter(d => {
                        const normSeverity = getNormalizedSeverity(d);
                        return severity.toLowerCase() === normSeverity;
                      }).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Certainty Filter Section */}
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px',
              marginTop: '20px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              CERTAINTY FILTER
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(certaintyFilters).map(certainty => (
                <div key={certainty} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                  <div 
                    onClick={() => toggleCertaintyFilter(certainty)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '4px',
                      marginRight: '10px',
                      backgroundColor: certaintyFilters[certainty] ? '#2196F3' : 'transparent',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {certaintyFilters[certainty] && (
                      <span style={{ 
                        position: 'absolute', 
                        color: 'white', 
                        fontSize: '16px', 
                        top: '-2px', 
                        left: '2px' 
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{certainty}</span>
                    <span style={{ 
                      fontSize: '12px', 
                      backgroundColor: '#e3f2fd', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      color: '#1976D2'
                    }}>
                      {disasters.filter(d => {
                        const normCertainty = getNormalizedCertainty(d);
                        return certainty.toLowerCase() === normCertainty;
                      }).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Urgency Filter Section */}
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px',
              marginTop: '20px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffa500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="6" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              URGENCY FILTER
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.keys(urgencyFilters).map(urgency => (
                <div key={urgency} style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
                  <div 
                    onClick={() => toggleUrgencyFilter(urgency)}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '4px',
                      marginRight: '10px',
                      backgroundColor: urgencyFilters[urgency] ? '#2196F3' : 'transparent',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                  >
                    {urgencyFilters[urgency] && (
                      <span style={{ 
                        position: 'absolute', 
                        color: 'white', 
                        fontSize: '16px', 
                        top: '-2px', 
                        left: '2px' 
                      }}>✓</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{urgency}</span>
                    <span style={{ 
                      fontSize: '12px', 
                      backgroundColor: '#e3f2fd', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      color: '#1976D2'
                    }}>
                      {disasters.filter(d => {
                        const normUrgency = getNormalizedUrgency(d);
                        return urgency.toLowerCase() === normUrgency;
                      }).length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Facility Management Drawer */}
      <div className={`drawer-backdrop ${facilityDrawerOpen ? 'open' : ''}`} onClick={toggleFacilityDrawer}></div>
      <div className={`drawer drawer-right ${facilityDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Facility Management
          </h3>
          <button className="drawer-close" onClick={toggleFacilityDrawer}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-section">
            <div style={{ margin: '10px 0 20px 0', textAlign: 'center' }}>
              <div 
                onClick={() => {
                  // Create a file input element
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.xlsx,.xls';
                  
                  // Add event listener for when a file is selected
                  input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  });
                  
                  // Trigger click on file input
                  input.click();
                }}
                style={{ 
                  border: '2px dashed #4CAF50', 
                  borderRadius: '8px', 
                  padding: '30px 20px',
                  backgroundColor: 'rgba(76, 175, 80, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.05)'}
              >
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  backgroundColor: '#4CAF50', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 15px auto'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#2E7D32' }}>Upload Facility Data</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  CSV or Excel files (.csv, .xlsx, .xls)
                </div>
              </div>
              
              <button 
                onClick={() => {
                  // Create a file input element
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.xlsx,.xls';
                  
                  // Add event listener for when a file is selected
                  input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  });
                  
                  // Trigger click on file input
                  input.click();
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  marginTop: '20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                  <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"></path>
                </svg>
                Upload Facility Data
              </button>
              
              <div style={{ fontSize: '12px', marginTop: '10px', color: '#666', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    const csvContent = "name,latitude,longitude,description,type,capacity,risk_level,last_inspection\nHeadquarters,40.7128,-74.006,Main office building,Office,250,Low,2023-10-15\nRegional Office A,34.0522,-118.2437,Western region headquarters,Office,120,Medium,2023-09-20\nWarehouse B,51.5074,-0.1278,Storage facility for European operations,Warehouse,N/A,High,2023-08-05\nField Station C,35.6762,139.6503,Asian operations center,Field Station,45,Medium,2023-11-01\nDistribution Center D,19.4326,-99.1332,Latin American distribution hub,Distribution,500,High,2023-07-12";
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('href', url);
                    a.setAttribute('download', 'sample_facilities.csv');
                    a.click();
                  }}
                  style={{ color: '#2196F3', textDecoration: 'underline' }}
                >
                  CSV Sample
                </a>
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    // Create a workbook with sample data
                    const wb = XLSX.utils.book_new();
                    const wsData = [
                      ['name', 'latitude', 'longitude', 'description', 'type', 'capacity', 'risk_level', 'last_inspection', 'emergency_contact', 'supplies_available'],
                      ['Headquarters', 40.7128, -74.006, 'Main office building', 'Office', 250, 'Low', '2023-10-15', '555-123-4567', 'Water, Food, Medical'],
                      ['Regional Office A', 34.0522, -118.2437, 'Western region headquarters', 'Office', 120, 'Medium', '2023-09-20', '555-234-5678', 'Medical supplies only'],
                      ['Warehouse B', 51.5074, -0.1278, 'Storage facility for European operations', 'Warehouse', 'N/A', 'High', '2023-08-05', '555-345-6789', 'Large food stockpile, water'],
                      ['Field Station C', 35.6762, 139.6503, 'Asian operations center', 'Field Station', 45, 'Medium', '2023-11-01', '555-456-7890', 'Limited supplies'],
                      ['Distribution Center D', 19.4326, -99.1332, 'Latin American distribution hub', 'Distribution', 500, 'High', '2023-07-12', '555-567-8901', 'Full emergency supplies']
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    XLSX.utils.book_append_sheet(wb, ws, 'Facilities');
                    
                    // Generate and download the Excel file
                    XLSX.writeFile(wb, 'sample_facilities.xlsx');
                  }}
                  style={{ color: '#2196F3', textDecoration: 'underline' }}
                >
                  Excel Sample
                </a>
              </div>
            </div>
          </div>
          
          <div className="drawer-section">
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '12px', 
              fontSize: '15px', 
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              FACILITIES IMPACTED
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px' 
            }}>
              {facilities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#666' }}>
                  No facilities uploaded yet.
                </div>
              ) : impactedFacilities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#4CAF50', fontWeight: 'bold' }}>
                  All facilities safe!
                </div>
              ) : (
                impactedFacilities.map((impacted, index) => (
                  <div key={index} style={{
                    backgroundColor: 'rgba(244, 67, 54, 0.05)',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid rgba(244, 67, 54, 0.1)'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {impacted.facility.name}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666', 
                      display: 'flex', 
                      alignItems: 'center' 
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Impacted by {impacted.impacts?.length || 0} disasters
                    </div>
                    <button style={{
                      backgroundColor: '#F44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      marginTop: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      View Recommendations
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <button 
            onClick={() => {
              if (impactedFacilities.length > 0) {
                toggleSitrepDrawer();
              }
            }}
            style={{
              width: '100%',
              padding: '12px 20px',
              marginTop: '20px',
              backgroundColor: '#F44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: impactedFacilities.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: impactedFacilities.length > 0 ? 1 : 0.5,
              pointerEvents: impactedFacilities.length > 0 ? 'auto' : 'none'
            }}
            disabled={impactedFacilities.length === 0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Generate Situation Report
          </button>
        </div>
      </div>
      
      {/* Situation Report Drawer */}
      <div className={`drawer-backdrop ${sitrepDrawerOpen ? 'open' : ''}`} onClick={toggleSitrepDrawer}></div>
      
      {/* Map Layers Drawer */}
      <div className={`drawer-backdrop ${mapLayersDrawerOpen ? 'open' : ''}`} onClick={toggleMapLayersDrawer}></div>
      <div className={`drawer drawer-right ${mapLayersDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            Map Layers
          </h3>
          <button className="drawer-close" onClick={toggleMapLayersDrawer}>×</button>
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
      
      {/* AI Analysis Drawer */}
      <div className={`drawer-backdrop ${showAnalysisDrawer ? 'open' : ''}`} onClick={toggleAnalysisDrawer}></div>
      <div className={`drawer drawer-right ${showAnalysisDrawer ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6" y2="6"></line>
              <line x1="6" y1="18" x2="6" y2="18"></line>
            </svg>
            AI Facility Analysis
          </h3>
          <button className="drawer-close" onClick={toggleAnalysisDrawer}>×</button>
        </div>
        <div className="drawer-content">
          {analysisLoading ? (
            <div style={{textAlign: 'center', padding: '40px 0'}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px', animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>Generating AI analysis...</span>
              </div>
            </div>
          ) : selectedFacility && analysisData ? (
            <div>
              <div style={{marginBottom: '15px'}}>
                <h2 style={{margin: '0 0 10px 0', fontSize: '18px'}}>{selectedFacility.name}</h2>
                <div style={{
                  backgroundColor: isAIGenerated ? '#e3f2fd' : '#f5f5f5', 
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  {isAIGenerated ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                      <span style={{color: '#0d47a1', fontWeight: 'bold'}}>AI-Generated Analysis</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#757575" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span style={{color: '#757575'}}>Standard Analysis</span>
                    </>
                  )}
                </div>
              </div>
              
              {Object.entries(analysisData).map(([section, content]) => (
                <div key={section} style={{marginBottom: '20px'}}>
                  <h3 style={{
                    fontSize: '16px', 
                    marginBottom: '10px',
                    paddingBottom: '5px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>{section}</h3>
                  
                  {Array.isArray(content) ? (
                    <ul style={{paddingLeft: '20px', margin: '10px 0'}}>
                      {content.map((item, idx) => (
                        <li key={idx} style={{marginBottom: '8px'}}>
                          {typeof item === 'object' ? JSON.stringify(item) : item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{lineHeight: '1.5'}}>
                      {typeof content === 'object' ? JSON.stringify(content) : content}
                    </p>
                  )}
                </div>
              ))}
              
              <div style={{marginTop: '30px', borderTop: '1px solid #f0f0f0', paddingTop: '15px'}}>
                <button 
                  className="button"
                  onClick={() => {
                    // Trigger AI recommendations based on this analysis
                    const impacts = impactedFacilities.find(
                      impacted => impacted.facility.name === selectedFacility.name
                    )?.impacts || [];
                    
                    if (impacts.length > 0) {
                      onFacilitySelect(selectedFacility);
                    }
                  }}
                  style={{
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '10px 15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  View Recommendations
                </button>
              </div>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '40px 0', color: '#666'}}>
              Select a facility to analyze its disaster risk profile
            </div>
          )}
        </div>
      </div>
      <div className={`drawer drawer-right ${sitrepDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Situation Report
          </h3>
          <button className="drawer-close" onClick={toggleSitrepDrawer}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-section">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ 
                width: '70px', 
                height: '70px', 
                borderRadius: '50%', 
                backgroundColor: '#F44336', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 15px auto'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '5px', 
                color: '#D32F2F',
                fontSize: '18px'
              }}>
                Generate Situation Report
              </div>
              <div style={{ fontSize: '14px', color: '#666', maxWidth: '80%', margin: '0 auto' }}>
                Generate a comprehensive situation report for all active disasters and impacted facilities.
              </div>
              
              <button 
                onClick={() => {
                  if (impactedFacilities.length > 0) {
                    onGenerateSitrep();
                    // Do not close the drawer - we'll show the report here
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  marginTop: '20px',
                  backgroundColor: '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: impactedFacilities.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: impactedFacilities.length > 0 ? 1 : 0.5,
                  pointerEvents: impactedFacilities.length > 0 ? 'auto' : 'none'
                }}
                disabled={impactedFacilities.length === 0 || sitrepLoading}
              >
                {sitrepLoading ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', animation: 'spin 1s linear infinite'}}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Generate Report
                  </>
                )}
              </button>
              
              {impactedFacilities.length === 0 && (
                <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
                  Upload facilities and assess impact first
                </div>
              )}
              
              {/* Display the sitrep if available */}
              {sitrep && !sitrepLoading && (
                <div style={{ 
                  marginTop: '25px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e0e0e0',
                    color: '#D32F2F'
                  }}>
                    Situation Report
                  </div>
                  
                  <div className="sitrep-container" style={{ textAlign: 'left' }}>
                    <ReactMarkdown>
                      {sitrep}
                    </ReactMarkdown>
                  </div>
                  
                  <div style={{ 
                    marginTop: '15px',
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => {
                        // Create Word document format using basic HTML with MS Word-specific XML
                        const htmlContent = `
                          <html xmlns:o="urn:schemas-microsoft-com:office:office" 
                                xmlns:w="urn:schemas-microsoft-com:office:word" 
                                xmlns="http://www.w3.org/TR/REC-html40">
                            <head>
                              <meta charset="utf-8">
                              <meta name="ProgId" content="Word.Document">
                              <meta name="Generator" content="Microsoft Word 15">
                              <meta name="Originator" content="Microsoft Word 15">
                              <title>Situation Report</title>
                              <!--[if gte mso 9]>
                              <xml>
                                <w:WordDocument>
                                  <w:View>Print</w:View>
                                  <w:Zoom>90</w:Zoom>
                                  <w:DoNotOptimizeForBrowser/>
                                </w:WordDocument>
                              </xml>
                              <![endif]-->
                              <style>
                                body { font-family: 'Calibri', sans-serif; margin: 1cm; }
                                h1, h2, h3 { font-family: 'Calibri', sans-serif; }
                                h1 { font-size: 16pt; color: #2196F3; margin-top: 24pt; margin-bottom: 6pt; }
                                h2 { font-size: 14pt; color: #0d47a1; margin-top: 18pt; margin-bottom: 6pt; }
                                h3 { font-size: 12pt; color: #333; margin-top: 12pt; margin-bottom: 3pt; }
                                p { margin: 6pt 0; }
                                ul { margin-left: 20pt; }
                                li { margin-bottom: 3pt; }
                                .footer { font-style: italic; color: #666; margin-top: 24pt; border-top: 1pt solid #ccc; padding-top: 12pt; text-align: center; }
                              </style>
                            </head>
                            <body>
                              ${sitrep
                                .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
                                .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
                                .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/\n- (.*?)$/gm, '<ul><li>$1</li></ul>')
                                .replace(/<\/ul>\s*<ul>/g, '')  // Combine adjacent lists
                                .replace(/\n\n/g, '<p></p>')
                                .replace(/\n/g, '<br>')
                                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')}
                                
                              <div class="footer">
                                Generated on ${new Date().toLocaleDateString()} | Developed by <a href="https://github.com/jmesplana">John Mark Esplana</a>
                              </div>
                            </body>
                          </html>
                        `;
                        
                        // Create a blob with correct MIME type
                        const blob = new Blob([htmlContent], { type: 'application/msword' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.setAttribute('href', url);
                        const date = new Date().toISOString().split('T')[0];
                        a.setAttribute('download', `sitrep-${date}.doc`);
                        
                        // Trigger download
                        document.body.appendChild(a);
                        a.click();
                        
                        // Clean up
                        setTimeout(() => {
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        }, 100);
                      }}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Download Report (.doc)
                    </button>
                    
                    <button
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(sitrep).then(() => {
                            alert('Report copied to clipboard');
                          }).catch(err => {
                            console.error('Could not copy text: ', err);
                          });
                        } else {
                          const textArea = document.createElement('textarea');
                          textArea.value = sitrep;
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textArea);
                          alert('Report copied to clipboard');
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copy to Clipboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <MapContainer 
        center={[0, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
        ref={mapRef}
      >
        {/* Get access to map instance */}
        <MapAccess onMapReady={handleMapReady} />
        
        {/* Fullscreen button */}
        <div 
          onClick={toggleFullscreen}
          style={{
            position: 'absolute',
            bottom: '25px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            width: '44px',
            height: '44px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          }}
          title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
          )}
        </div>
        
        {/* Dynamic TileLayer based on currentMapLayer */}
        {currentMapLayer === 'street' && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        
        {currentMapLayer === 'satellite' && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        
        {currentMapLayer === 'terrain' && (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        
        {/* Road Network Overlay */}
        {showRoads && (
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png"
            opacity={0.8}
          />
        )}
        
        {/* Heatmap layer for disaster concentration */}
        {showHeatmap && filteredDisasters.length > 0 && (
          <HeatmapLayer disasters={filteredDisasters} />
        )}
        
        {/* Add disaster markers directly to the map */}
        {!showHeatmap && (
          <DisasterMarkers 
            disasters={filteredDisasters}
            getDisasterInfo={getDisasterInfo}
            getAlertColor={getAlertColor}
          />
        )}
        
        {/* No need to render duplicate disaster markers - the DisasterMarkers component handles this */}
        
        {/* Render facility markers with clustering */}
        <MarkerClusterGroup
          chunkedLoading={true}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={true}
          zoomToBoundsOnClick={true}
          maxClusterRadius={40}
          iconCreateFunction={(cluster) => {
            // Count impacted vs safe facilities in this cluster
            let impactedCount = 0;
            let safeCount = 0;
            
            cluster.getAllChildMarkers().forEach(marker => {
              if (marker.options.isImpacted) {
                impactedCount++;
              } else {
                safeCount++;
              }
            });
            
            const totalCount = cluster.getChildCount();
            let clusterColor = '#4CAF50'; // Default green for all safe
            
            // If any are impacted, use red color
            if (impactedCount > 0) {
              clusterColor = '#ff4444';
            }
            
            // Create a custom divIcon with impacted status
            return L.divIcon({
              html: `<div style="background-color: ${clusterColor}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; color: white;">${totalCount}</div>`,
              className: 'facility-cluster-icon',
              iconSize: L.point(36, 36)
            });
          }}
        >
          {facilities.map((facility, index) => {
            if (!facility.latitude || !facility.longitude) return null;
            
            const isImpacted = impactedFacilities.some(
              impacted => impacted.facility.name === facility.name
            );
            
            // Create a custom divIcon for each facility
            const facilityIcon = L.divIcon({
              html: `<div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${isImpacted ? '#ff4444' : '#4CAF50'}; border: 1.5px solid black; display: flex; align-items: center; justify-content: center;"></div>`,
              className: 'facility-icon',
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });
            
            // Use Marker instead of CircleMarker for better clustering
            return (
              <ReactLeafletMarker
                key={`facility-${index}`}
                position={[parseFloat(facility.latitude), parseFloat(facility.longitude)]}
                icon={facilityIcon}
                isImpacted={isImpacted} // Custom property for cluster coloring
                zIndexOffset={1000} // Ensure facilities are on top of other markers
                eventHandlers={{
                click: () => onFacilitySelect(facility)
              }}
            >
              {showLabels && (
                <Tooltip permanent direction="top" offset={[0, -15]} className="facility-label">
                  <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '11px',
                    padding: '2px 6px',
                    backgroundColor: isImpacted ? 'rgba(255, 68, 68, 0.9)' : 'rgba(76, 175, 80, 0.9)',
                    borderRadius: '3px',
                    color: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}>
                    {facility.name}
                  </div>
                </Tooltip>
              )}
              <Popup>
                <div className="popup-content" style={{ maxWidth: '300px', padding: '5px' }}>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    padding: '0 0 8px 0', 
                    borderBottom: `2px solid ${isImpacted ? '#ff4444' : '#4CAF50'}`,
                    color: isImpacted ? '#d32f2f' : '#2e7d32'
                  }}>
                    {facility.name}
                  </h3>
                  
                  <div style={{ 
                    margin: '8px 0', 
                    padding: '5px 8px', 
                    backgroundColor: isImpacted ? 'rgba(255, 68, 68, 0.08)' : 'rgba(76, 175, 80, 0.08)',
                    borderRadius: '4px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: isImpacted ? '#ff4444' : '#4CAF50',
                      textAlign: 'center',
                      lineHeight: '20px',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {isImpacted ? '!' : '✓'}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      {isImpacted ? 'Potentially Impacted' : 'Not Impacted'}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '13px', margin: '8px 0' }}>
                    <strong>Location:</strong> {facility.latitude}, {facility.longitude}
                  </p>
                  
                  {/* Display additional fields if available */}
                  {Object.keys(facility).filter(key => 
                    key !== 'name' && key !== 'latitude' && key !== 'longitude' && facility[key]
                  ).length > 0 && (
                    <div style={{ 
                      margin: '10px 0', 
                      padding: '8px 10px', 
                      backgroundColor: '#f5f5f5',
                      borderRadius: '4px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '13px', 
                        marginBottom: '5px',
                        borderBottom: '1px solid #e0e0e0',
                        paddingBottom: '5px',
                        color: '#555'
                      }}>
                        Additional Information
                      </div>
                      
                      {Object.keys(facility).filter(key => 
                        key !== 'name' && key !== 'latitude' && key !== 'longitude' && facility[key]
                      ).map((key, idx) => (
                        <p key={idx} style={{ fontSize: '13px', margin: '5px 0', color: '#333' }}>
                          <strong style={{ color: '#2196F3' }}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:</strong> {facility[key]}
                        </p>
                      ))}
                    </div>
                  )}
                  
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginTop: '12px',
                    justifyContent: 'space-between' 
                  }}>
                    {isImpacted && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          
                          // Close popup
                          if (mapRef.current && mapRef.current._map) {
                            mapRef.current._map.closePopup();
                          }
                          
                          // Display recommendations for this facility
                          onFacilitySelect(facility);
                        }}
                        style={{
                          flex: '1',
                          padding: '6px 10px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        View Recommendations
                      </button>
                    )}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Close popup
                        if (mapRef.current && mapRef.current._map) {
                          mapRef.current._map.closePopup();
                        }
                        
                        // Find impacts for this facility
                        const facilityImpacts = impactedFacilities.find(
                          impacted => impacted.facility.name === facility.name
                        )?.impacts || [];
                        
                        // Call AI Analysis API
                        handleAnalyzeFacility(facility, facilityImpacts);
                      }}
                      style={{
                        flex: '1',
                        padding: '6px 10px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                      </svg>
                      Analyze with AI
                    </button>
                  </div>
                </div>
              </Popup>
            </ReactLeafletMarker>
          );
        })}
        </MarkerClusterGroup>
        
        {/* Timeline component - shown at top of map */}
        {showTimeline && (
          <div 
            style={{
              position: 'absolute',
              top: '10px', /* Moved to top since disaster count card is removed */
              left: '10px',
              right: '10px',
              zIndex: 1000
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <TimelineVisualization 
              disasters={disasters} 
              onTimeChange={handleTimelineChange} 
            />
          </div>
        )}
        
        {/* Statistics panel - shown at top of map */}
        {showStatistics && impactStatistics && (
          <div 
            style={{
              position: 'absolute',
              top: showTimeline ? '240px' : '130px', /* Adjusted to be below disaster count card and timeline */
              left: '10px',
              right: '10px',
              zIndex: 1500 /* Increased z-index to be above buttons (1000) */
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <StatisticsPanel statistics={impactStatistics} />
          </div>
        )}
        
        {/* Legend controls */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '10px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          {/* Legend toggle button */}
          <button 
            onClick={() => setShowLegend(!showLegend)}
            style={{
              backgroundColor: 'white',
              borderRadius: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              border: 'none',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#2196F3'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
            </svg>
            {showLegend ? 'Hide Legend' : 'Show Legend'}
          </button>
          
          {/* Timeline toggle button */}
          <button 
            onClick={() => setShowTimeline(!showTimeline)}
            style={{
              backgroundColor: showTimeline ? '#e3f2fd' : 'white',
              borderRadius: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              border: showTimeline ? '1px solid #2196F3' : 'none',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#F44336'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            {showTimeline ? 'Hide Timeline' : 'Show Timeline'}
          </button>
          
          {/* Facility labels toggle button */}
          {facilities.length > 0 && (
            <button 
              onClick={() => setShowLabels(!showLabels)}
              style={{
                backgroundColor: showLabels ? '#e8f5e9' : 'white',
                borderRadius: '4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                border: showLabels ? '1px solid #4CAF50' : 'none',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#4CAF50'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <path d="M9 3v18"></path>
              </svg>
              {showLabels ? 'Hide Labels' : 'Show Labels'}
            </button>
          )}
          
          {/* Statistics toggle button - only show if we have impactStatistics */}
          {impactStatistics && (
            <button 
              onClick={() => setShowStatistics(!showStatistics)}
              style={{
                backgroundColor: showStatistics ? '#fff8e1' : 'white',
                borderRadius: '4px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                border: showStatistics ? '1px solid #FFC107' : 'none',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#795548'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
              </svg>
              {showStatistics ? 'Hide Statistics' : 'Show Statistics'}
            </button>
          )}
          
          {/* Collapsible legend panel */}
          {showLegend && (
            <div className="map-legend" style={{
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
              maxWidth: '300px',
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
          <div style={{ 
            marginBottom: '15px', 
            fontWeight: 'bold', 
            fontSize: '14px', 
            borderBottom: '2px solid #f0f0f0', 
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center' 
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
            </svg>
            MAP LEGEND
          </div>
          
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold', 
            fontSize: '13px', 
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            DISASTER EVENT TYPES
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/earthquake.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Earthquake</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/cyclone.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Cyclone</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/flood.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Flood</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/volcano.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Volcano</span>
            </div>
          </div>
          
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold', 
            fontSize: '13px', 
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            ALERT SEVERITY LEVELS
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '12px',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#ff4444', 
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>Red Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Severe Impact</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '12px',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 165, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#ffa500', 
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef6c00' }}>Orange Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Moderate Impact</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '15px',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#4CAF50', 
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>Green Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Minor Impact</span>
          </div>
          
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold', 
            fontSize: '13px', 
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            FACILITY STATUS
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '8px',
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#4CAF50', 
                border: '1.5px dashed #1b5e20',
                marginRight: '8px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>Safe</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>No impact detected</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#ff4444', 
                border: '1.5px dashed #b71c1c',
                marginRight: '8px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>Impacted</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Response needed</span>
          </div>
          
          <div style={{ 
            marginTop: '15px', 
            fontSize: '12px', 
            color: '#757575', 
            borderTop: '1px solid #f0f0f0', 
            paddingTop: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Click any marker for detailed information
          </div>
            </div>
          )}
        </div>
      </MapContainer>

      {/* Display a message if no markers are visible */}
      {disasters.length === 0 && facilities.length === 0 && (
        <div style={{
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255,255,255,0.8)',
          padding: '15px',
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <p><strong>No data to display on the map.</strong></p>
          <p>Try refreshing GDACS data or uploading facilities.</p>
        </div>
      )}
      
      {/* Column Selection Modal */}
      {showColumnModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #eee',
              paddingBottom: '10px'
            }}>
              <h3 style={{ margin: 0, color: '#2196F3' }}>Configure Facility Data</h3>
              <button 
                onClick={() => setShowColumnModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >×</button>
            </div>
            
            <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
              Select which columns from your Excel file correspond to facility information.
              This helps us correctly map and analyze your facility data.
            </p>
            
            {/* Required Fields */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#F44336', marginBottom: '10px' }}>Required Fields</h4>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                  Facility Name Column:
                </label>
                <select 
                  value={selectedColumns.name}
                  onChange={(e) => setSelectedColumns({...selectedColumns, name: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">-- Select Column --</option>
                  {fileColumns.map((col, idx) => (
                    <option key={idx} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                  Latitude Column:
                </label>
                <select 
                  value={selectedColumns.latitude}
                  onChange={(e) => setSelectedColumns({...selectedColumns, latitude: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">-- Select Column --</option>
                  {fileColumns.map((col, idx) => (
                    <option key={idx} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                  Longitude Column:
                </label>
                <select 
                  value={selectedColumns.longitude}
                  onChange={(e) => setSelectedColumns({...selectedColumns, longitude: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                >
                  <option value="">-- Select Column --</option>
                  {fileColumns.map((col, idx) => (
                    <option key={idx} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Additional Fields */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#4CAF50', marginBottom: '10px' }}>Additional Fields</h4>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                  Fields for AI Analysis:
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                  Select columns that contain information for AI to analyze when generating recommendations
                </p>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '10px',
                  border: '1px solid #eee',
                  borderRadius: '4px'
                }}>
                  {fileColumns.filter(col => 
                    col !== selectedColumns.name && 
                    col !== selectedColumns.latitude && 
                    col !== selectedColumns.longitude
                  ).map((col, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: selectedColumns.aiAnalysisFields.includes(col) ? '#e3f2fd' : '#f5f5f5',
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selectedColumns.aiAnalysisFields.includes(col) ? '#2196F3' : '#ddd'
                    }}
                    onClick={() => {
                      if (selectedColumns.aiAnalysisFields.includes(col)) {
                        setSelectedColumns({
                          ...selectedColumns,
                          aiAnalysisFields: selectedColumns.aiAnalysisFields.filter(c => c !== col)
                        });
                      } else {
                        setSelectedColumns({
                          ...selectedColumns,
                          aiAnalysisFields: [...selectedColumns.aiAnalysisFields, col]
                        });
                      }
                    }}>
                      {col}
                      {selectedColumns.aiAnalysisFields.includes(col) && (
                        <span style={{ marginLeft: '5px', color: '#2196F3' }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                  Fields to Display on Map:
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                  Select columns that should be shown when clicking on a facility
                </p>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '10px',
                  border: '1px solid #eee',
                  borderRadius: '4px'
                }}>
                  {fileColumns.filter(col => 
                    col !== selectedColumns.name && 
                    col !== selectedColumns.latitude && 
                    col !== selectedColumns.longitude
                  ).map((col, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: selectedColumns.displayFields.includes(col) ? '#e8f5e9' : '#f5f5f5',
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selectedColumns.displayFields.includes(col) ? '#4CAF50' : '#ddd'
                    }}
                    onClick={() => {
                      if (selectedColumns.displayFields.includes(col)) {
                        setSelectedColumns({
                          ...selectedColumns,
                          displayFields: selectedColumns.displayFields.filter(c => c !== col)
                        });
                      } else {
                        setSelectedColumns({
                          ...selectedColumns,
                          displayFields: [...selectedColumns.displayFields, col]
                        });
                      }
                    }}>
                      {col}
                      {selectedColumns.displayFields.includes(col) && (
                        <span style={{ marginLeft: '5px', color: '#4CAF50' }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={() => setShowColumnModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: '#f5f5f5',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={processExcelData}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Process Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;