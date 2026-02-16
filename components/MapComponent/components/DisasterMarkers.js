import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getDisasterInfo, getAlertColor } from '../utils/disasterHelpers';

// Component to add disaster markers directly to the map
const DisasterMarkers = ({ disasters, showImpactZones }) => {
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
              <a href="${disaster.webUrl || disaster.link}" target="_blank" style="display: inline-block; margin-top: 8px; color: var(--aidstack-orange); text-decoration: none; font-weight: bold;">
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
              // Only create polygon if impact zones are enabled
              if (showImpactZones) {
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
                // Store the polygon to remove on cleanup
                markers.push(disasterPolygon);
              }
            } catch (e) {
              console.error("Error creating polygon:", e);
              // Fall back to circle on error (only if impact zones enabled)
              if (showImpactZones) {
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
              }
              return;
            }

            // Debug markers were removed since polygons are working properly now
          } else {
            // Fallback to circle if no polygon data (only if impact zones enabled)
            if (showImpactZones) {
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
  }, [map, disasters, showImpactZones]);

  return null;
};

export default DisasterMarkers;
