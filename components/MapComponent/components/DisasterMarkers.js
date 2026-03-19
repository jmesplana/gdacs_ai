import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylinedecorator';
import { getDisasterInfo, getAlertColor } from '../utils/disasterHelpers';

// Component to add disaster markers directly to the map
const DisasterMarkers = ({ disasters, showImpactZones }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const geometryCacheRef = useRef(new Map()); // Cache for fetched geometries: key = eventid_episodeid, value = {geojson, timestamp, failed}
  const geometryLayersRef = useRef(new Map()); // Track geometry layers for cleanup

  // Helper function to fetch geometry from API
  const fetchGeometry = async (disaster) => {
    const cacheKey = `${disaster.eventId}_${disaster.episodeId}`;

    // Check in-memory cache first
    const cached = geometryCacheRef.current.get(cacheKey);
    if (cached) {
      // Return cached data if it's less than 1 hour old
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - cached.timestamp < oneHour) {
        return cached.failed ? null : cached.geojson;
      }
    }

    // Check localStorage cache
    try {
      const localStorageKey = `gdacs_geometry_${cacheKey}`;
      const localCached = localStorage.getItem(localStorageKey);
      if (localCached) {
        const parsed = JSON.parse(localCached);
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp < oneHour) {
          console.log(`Using localStorage cache for ${cacheKey}`);
          // Store in memory cache for faster access
          geometryCacheRef.current.set(cacheKey, parsed);
          return parsed.failed ? null : parsed.geojson;
        }
      }
    } catch (error) {
      console.log('Error reading from localStorage:', error.message);
    }

    // Parse eventtype, eventid, episodeid from geometryUrl
    const urlParams = new URLSearchParams(disaster.geometryUrl.split('?')[1]);
    const eventtype = urlParams.get('eventtype');
    const eventid = urlParams.get('eventid');
    const episodeid = urlParams.get('episodeid') || '1';

    try {
      console.log(`Fetching geometry for ${eventtype} event ${eventid}, episode ${episodeid}`);

      const response = await fetch(
        `/api/gdacs-geometry?eventtype=${eventtype}&eventid=${eventid}&episodeid=${episodeid}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const geojson = await response.json();

      if (!geojson.features || geojson.features.length === 0) {
        console.log(`No geometry features found for ${eventtype} event ${eventid}`);
        geometryCacheRef.current.set(cacheKey, { failed: true, timestamp: Date.now() });
        return null;
      }

      console.log(`Successfully fetched ${geojson.features.length} geometry features for ${eventtype} event ${eventid}`);

      // Cache the result in memory
      const cacheData = { geojson, timestamp: Date.now() };
      geometryCacheRef.current.set(cacheKey, cacheData);

      // Also cache in localStorage
      try {
        const localStorageKey = `gdacs_geometry_${cacheKey}`;
        localStorage.setItem(localStorageKey, JSON.stringify(cacheData));
      } catch (error) {
        console.log('Error saving to localStorage:', error.message);
      }

      return geojson;
    } catch (error) {
      console.error(`Failed to fetch geometry for ${eventtype} event ${eventid}:`, error.message);

      // Cache the failure to avoid repeated requests
      const failureData = { failed: true, timestamp: Date.now() };
      geometryCacheRef.current.set(cacheKey, failureData);

      // Also cache failure in localStorage
      try {
        const localStorageKey = `gdacs_geometry_${cacheKey}`;
        localStorage.setItem(localStorageKey, JSON.stringify(failureData));
      } catch (error) {
        console.log('Error saving failure to localStorage:', error.message);
      }

      return null;
    }
  };

  // Helper function to render geometry features on the map
  const renderGeometry = (geojson, disaster, alertColor, markers) => {
    if (!geojson || !geojson.features) return;

    const cacheKey = `${disaster.eventId}_${disaster.episodeId}`;
    const layerGroup = L.layerGroup();

    geojson.features.forEach((feature, idx) => {
      const geom = feature.geometry;
      const props = feature.properties || {};

      if (!geom || !geom.coordinates) return;

      try {
        switch (geom.type) {
          case 'Point': {
            // Point geometries (e.g., cyclone positions)
            const [lng, lat] = geom.coordinates;

            // Determine if this is a forecast vs observed position
            const isForecast = props.Class === 'FORECAST' || props.class === 'FORECAST';
            const pointColor = isForecast ? '#FFD700' : alertColor; // Gold for forecast, alert color for observed

            // Create a circle marker for track positions
            const circleMarker = L.circleMarker([lat, lng], {
              radius: 5,
              color: pointColor,
              fillColor: pointColor,
              fillOpacity: isForecast ? 0.6 : 0.8,
              weight: 2,
              opacity: 0.8,
              zIndexOffset: -1500,
              pane: 'shadowPane'
            });

            // Add popup with timestamp if available
            if (props.Date || props.date) {
              circleMarker.bindPopup(`
                <div style="font-size: 12px;">
                  <strong>${isForecast ? 'Forecast' : 'Observed'} Position</strong><br/>
                  Date: ${props.Date || props.date}
                  ${props.MaxWind ? `<br/>Max Wind: ${props.MaxWind} kt` : ''}
                </div>
              `);
            }

            layerGroup.addLayer(circleMarker);
            break;
          }

          case 'LineString': {
            // LineString geometries (e.g., cyclone track paths)
            const coords = geom.coordinates.map(([lng, lat]) => [lat, lng]);

            const isForecast = props.Class === 'FORECAST' || props.class === 'FORECAST';
            const lineColor = isForecast ? '#FFD700' : alertColor;

            const polyline = L.polyline(coords, {
              color: lineColor,
              weight: isForecast ? 2 : 3,
              opacity: isForecast ? 0.6 : 0.8,
              dashArray: isForecast ? '5, 10' : null, // Dashed for forecast
              zIndexOffset: -1500,
              pane: 'shadowPane'
            });

            // Add arrows to show direction of movement
            if (!isForecast && coords.length > 1 && L.polylineDecorator) {
              try {
                const decorator = L.polylineDecorator(polyline, {
                  patterns: [
                    {
                      offset: '50%',
                      repeat: 100,
                      symbol: L.Symbol.arrowHead({
                        pixelSize: 12,
                        polygon: false,
                        pathOptions: {
                          color: lineColor,
                          weight: 2,
                          opacity: 0.8
                        }
                      })
                    }
                  ]
                });
                layerGroup.addLayer(decorator);
              } catch (error) {
                console.log('Polyline decorator not available:', error.message);
              }
            }

            layerGroup.addLayer(polyline);
            break;
          }

          case 'Polygon': {
            // Polygon geometries (e.g., affected areas, shakemaps)
            const coords = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);

            const polygon = L.polygon(coords, {
              color: alertColor,
              fillColor: alertColor,
              fillOpacity: 0.15,
              weight: 2,
              opacity: 0.6,
              interactive: false,
              zIndexOffset: -1800,
              pane: 'shadowPane'
            });

            layerGroup.addLayer(polygon);
            break;
          }

          case 'MultiPolygon': {
            // MultiPolygon geometries (e.g., multiple affected areas)
            const polygons = geom.coordinates.map(poly =>
              poly[0].map(([lng, lat]) => [lat, lng])
            );

            const multiPolygon = L.polygon(polygons, {
              color: alertColor,
              fillColor: alertColor,
              fillOpacity: 0.15,
              weight: 2,
              opacity: 0.6,
              interactive: false,
              zIndexOffset: -1800,
              pane: 'shadowPane'
            });

            layerGroup.addLayer(multiPolygon);
            break;
          }

          default:
            console.log(`Unsupported geometry type: ${geom.type}`);
        }
      } catch (error) {
        console.error(`Error rendering geometry feature ${idx}:`, error);
      }
    });

    // Add the layer group to the map and track it for cleanup
    layerGroup.addTo(map);
    geometryLayersRef.current.set(cacheKey, layerGroup);
    markers.push(layerGroup);
  };

  useEffect(() => {
    let isActive = true;

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
            let bgColor = 'rgba(76, 175, 80, 0.9)'; // Green with transparency
            if (redCount > 0) {
              color = '#ff4444'; // Red
              bgColor = 'rgba(255, 68, 68, 0.9)';
            } else if (orangeCount > 0) {
              color = '#ffa500'; // Orange
              bgColor = 'rgba(255, 165, 0, 0.9)';
            }

            // Determine size based on cluster count
            const size = childCount < 10 ? 'small' : childCount < 50 ? 'medium' : 'large';
            const dimension = size === 'small' ? '36px' : size === 'medium' ? '46px' : '56px';
            const fontSize = size === 'small' ? '13px' : size === 'medium' ? '15px' : '18px';

            // Create the cluster icon with warning symbol and count
            return L.divIcon({
              html: `<div style="
                background: ${bgColor};
                width: ${dimension};
                height: ${dimension};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-weight: bold;
                color: white;
                border: 3px solid white;
                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                position: relative;
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 2px;">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span style="font-size: ${fontSize}; line-height: 1;">${childCount}</span>
              </div>`,
              className: 'disaster-cluster',
              iconSize: L.point(parseInt(dimension), parseInt(dimension))
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

          // Create a div icon with a colored border based on alert level and inline SVG
          const iconHtml = `
            <div style="position: relative; width: 44px; height: 44px;">
              <div style="position: absolute; border-radius: 50%; border: 4px solid ${alertColor}; width: 44px; height: 44px; top: 0; left: 0; background-color: white;"></div>
              <div style="position: relative; z-index: 10; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                ${disasterInfo.inlineSvg}
              </div>
            </div>
          `;

          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'gdacs-icon',
            iconSize: [44, 44],
            zIndexOffset: -1000, // Keep disasters below facilities
            iconAnchor: [22, 22]
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

          // First, try to fetch and render GDACS geometry data (tracks, shakemaps, etc.)
          if (showImpactZones && disaster.geometryUrl) {
            const cacheKey = `${disaster.eventId}_${disaster.episodeId}`;
            const cached = geometryCacheRef.current.get(cacheKey);

            if (cached && !cached.failed) {
              // Render cached geometry immediately
              renderGeometry(cached.geojson, disaster, alertColor, markers);
            } else if (!cached) {
              // Fetch geometry asynchronously
              fetchGeometry(disaster).then(geojson => {
                if (isActive && geojson) {
                  // Re-render to show the newly fetched geometry
                  renderGeometry(geojson, disaster, alertColor, markers);
                  // Note: We don't force update here to avoid re-rendering the entire component
                  // The geometry will appear on next natural re-render or when impact zones toggle
                }
              });
            }
            // If geometry exists or is being fetched, don't render fallback circle yet
            // Fall through to polygon check below as additional overlay
          }

          // Check if we have polygon data available (from CAP format)
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
      isActive = false;

      // Clean up individual markers
      markers.forEach(marker => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });

      // Clean up geometry layers
      geometryLayersRef.current.forEach((layerGroup) => {
        if (map.hasLayer(layerGroup)) {
          map.removeLayer(layerGroup);
        }
      });
      geometryLayersRef.current.clear();

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
