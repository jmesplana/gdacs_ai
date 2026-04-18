/**
 * OSM Infrastructure Layer Component
 * Renders OSM infrastructure features on the map with marker clustering
 * Follows the pattern of DisasterMarkers.js
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const FACILITY_MARKER_CATEGORIES = new Set([
  'hospital',
  'clinic',
  'school',
  'water',
  'power',
  'fuel',
  'pharmacy',
  'airport'
]);

const getIconSymbol = (category) => {
  const symbols = {
    hospital: '🏥',
    clinic: '⚕️',
    school: '🏫',
    road: '🛣️',
    bridge: '🌉',
    water: '💧',
    power: '⚡',
    fuel: '⛽',
    pharmacy: '💊',
    airport: '✈️',
  };

  return symbols[category] || '📍';
};

const OSMInfrastructureLayer = ({ osmData, layerVisibility, showOSMLayer, showClusterCounts = true }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const lineLayerGroupRef = useRef(null); // For LineString/Polygon features

  useEffect(() => {
    if (!osmData || !osmData.features || !showOSMLayer) {
      // Clear all layers if no data or layer hidden
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
      if (lineLayerGroupRef.current) {
        map.removeLayer(lineLayerGroupRef.current);
        lineLayerGroupRef.current = null;
      }
      return;
    }

    console.log(`Rendering ${osmData.features.length} OSM infrastructure features`);

    // Create cluster group if it doesn't exist
    if (!clusterGroupRef.current) {
      clusterGroupRef.current = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: showClusterCounts ? 50 : 20,
        iconCreateFunction: (cluster) => {
          const childCount = cluster.getChildCount();

          // Determine size based on cluster count
          const size = childCount < 10 ? 'small' : childCount < 50 ? 'medium' : 'large';
          const dimension = showClusterCounts
            ? (size === 'small' ? '32px' : size === 'medium' ? '42px' : '52px')
            : '14px';
          const fontSize = size === 'small' ? '12px' : size === 'medium' ? '14px' : '17px';

          // OSM cluster icon (blue theme for infrastructure)
          return L.divIcon({
            html: `<div style="
              background: rgba(37, 99, 235, 0.9);
              width: ${dimension};
              height: ${dimension};
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              font-weight: bold;
              color: white;
              border: ${showClusterCounts ? '3px solid white' : '1.5px solid white'};
              box-shadow: ${showClusterCounts ? '0 3px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.2)'};
              font-size: ${fontSize};
            ">
              ${showClusterCounts ? childCount : ''}
            </div>`,
            className: 'osm-cluster',
            iconSize: L.point(parseInt(dimension), parseInt(dimension))
          });
        }
      });
      map.addLayer(clusterGroupRef.current);
    } else {
      // Clear previous markers
      clusterGroupRef.current.clearLayers();
    }

    // Filter features by visibility settings
    const visibleFeatures = osmData.features.filter(feature => {
      const category = feature.properties.category;
      return layerVisibility[category] !== false;
    });

    console.log(`Filtered to ${visibleFeatures.length} visible features`);

    // Create line layer group for non-Point geometries
    if (!lineLayerGroupRef.current) {
      lineLayerGroupRef.current = L.layerGroup();
      map.addLayer(lineLayerGroupRef.current);
    } else {
      lineLayerGroupRef.current.clearLayers();
    }

    // Count features by geometry type for debugging
    let pointCount = 0;
    let lineCount = 0;
    let polygonCount = 0;
    let centroidMarkerCount = 0;

    const addInfrastructureMarker = (lat, lng, feature, popupContent, isCentroid = false) => {
      const { category, color } = feature.properties;

      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates for OSM feature:', feature);
        return;
      }

      const size = isCentroid ? 28 : 32;
      const iconHtml = `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isCentroid ? 14 : 16}px;
        ">
          ${getIconSymbol(category)}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: `osm-marker osm-${category}${isCentroid ? ' osm-area-marker' : ''}`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2)]
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        zIndexOffset: isCentroid ? -450 : -500,
      });

      marker.bindPopup(popupContent);
      clusterGroupRef.current.addLayer(marker);
    };

    // Add features based on geometry type
    visibleFeatures.forEach((feature, index) => {
      const { name, category, tags, color } = feature.properties;
      const geometryType = feature.geometry.type;

      // Build popup content (shared for all geometry types)
      const popupContent = `
        <div style="max-width: 280px; font-family: 'Inter', sans-serif;">
          <h3 style="
            margin: 0 0 10px 0;
            color: ${color};
            font-size: 16px;
            font-weight: 600;
            border-bottom: 2px solid ${color};
            padding-bottom: 6px;
          ">
            ${name}
          </h3>
          <div style="margin-bottom: 8px;">
            <span style="
              display: inline-block;
              background: ${color};
              color: white;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            ">${category}</span>
          </div>
          ${tags.operator ? `
            <div style="margin-bottom: 6px;">
              <strong style="color: #64748b;">Operator:</strong> ${tags.operator}
            </div>
          ` : ''}
          ${tags.capacity || tags.beds ? `
            <div style="margin-bottom: 6px;">
              <strong style="color: #64748b;">Capacity:</strong> ${tags.capacity || tags.beds} ${tags.beds ? 'beds' : ''}
            </div>
          ` : ''}
          ${tags.emergency === 'yes' ? `
            <div style="margin-bottom: 6px; color: #dc2626; font-weight: 600;">
              ⚡ Emergency Services Available
            </div>
          ` : ''}
          ${tags.amenity ? `
            <div style="margin-bottom: 6px;">
              <strong style="color: #64748b;">Type:</strong> ${tags.amenity}
            </div>
          ` : ''}
          ${tags.highway ? `
            <div style="margin-bottom: 6px;">
              <strong style="color: #64748b;">Road Type:</strong> ${tags.highway}
            </div>
          ` : ''}
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <a
              href="https://www.openstreetmap.org/${feature.properties.osmType}/${feature.properties.osmId}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                color: #2563eb;
                text-decoration: none;
                font-size: 12px;
                font-weight: 500;
              "
            >
              📍 View on OpenStreetMap →
            </a>
          </div>
        </div>
      `;

      if (geometryType === 'Point') {
        pointCount++;
        const [lng, lat] = feature.geometry.coordinates;
        addInfrastructureMarker(lat, lng, feature, popupContent);

      } else if (geometryType === 'LineString') {
        lineCount++;
        const coords = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        // Create polyline
        const polyline = L.polyline(coords, {
          color: color,
          weight: 4,
          opacity: 0.8,
          className: `osm-line osm-${category}`
        });

        polyline.bindPopup(popupContent);

        // Add to line layer group
        lineLayerGroupRef.current.addLayer(polyline);

      } else if (geometryType === 'Polygon') {
        polygonCount++;
        const coords = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);

        // Create polygon with subtle styling (building outlines)
        const polygon = L.polygon(coords, {
          color: color,
          fillColor: color,
          fillOpacity: 0.1,  // Very subtle fill
          weight: 1.5,       // Thinner border
          opacity: 0.4,      // More transparent border
          className: `osm-polygon osm-${category}`
        });

        polygon.bindPopup(popupContent);

        // Add to line layer group
        lineLayerGroupRef.current.addLayer(polygon);

        if (FACILITY_MARKER_CATEGORIES.has(category)) {
          const center = polygon.getBounds().getCenter();
          addInfrastructureMarker(center.lat, center.lng, feature, popupContent, true);
          centroidMarkerCount++;
        }
      }
    });

    console.log(`Rendered ${pointCount} points, ${lineCount} lines, ${polygonCount} polygons, ${centroidMarkerCount} area markers`);

    // Cleanup function
    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
      if (lineLayerGroupRef.current) {
        map.removeLayer(lineLayerGroupRef.current);
        lineLayerGroupRef.current = null;
      }
    };
  }, [osmData, layerVisibility, showOSMLayer, showClusterCounts, map]);

  return null; // This component doesn't render React elements
};

export default OSMInfrastructureLayer;
