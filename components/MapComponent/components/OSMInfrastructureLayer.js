/**
 * OSM Infrastructure Layer Component
 * Renders OSM infrastructure features on the map with marker clustering
 * Follows the pattern of DisasterMarkers.js
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getOSMIcon, getOSMColor } from '../utils/osmHelpers';

const OSMInfrastructureLayer = ({ osmData, layerVisibility, showOSMLayer }) => {
  const map = useMap();
  const clusterGroupRef = useRef(null);

  useEffect(() => {
    if (!osmData || !osmData.features || !showOSMLayer) {
      // Clear markers if no data or layer hidden
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
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
        maxClusterRadius: 50,
        iconCreateFunction: (cluster) => {
          const childCount = cluster.getChildCount();

          // Determine size based on cluster count
          const size = childCount < 10 ? 'small' : childCount < 50 ? 'medium' : 'large';
          const dimension = size === 'small' ? '32px' : size === 'medium' ? '42px' : '52px';
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
              border: 3px solid white;
              box-shadow: 0 3px 8px rgba(0,0,0,0.3);
              font-size: ${fontSize};
            ">
              ${childCount}
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

    // Add markers
    visibleFeatures.forEach((feature, index) => {
      if (feature.geometry.type === 'Point') {
        const [lng, lat] = feature.geometry.coordinates;

        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lng)) {
          console.warn('Invalid coordinates for OSM feature:', feature);
          return;
        }

        const { name, category, tags, color, icon } = feature.properties;

        // Create custom icon
        const iconHtml = `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            background-color: ${color};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
          ">
            <i class="fas ${getOSMIcon(category)}" style="font-size: 14px;"></i>
          </div>
        `;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: `osm-marker osm-${category}`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16]
        });

        // Create marker
        const marker = L.marker([lat, lng], {
          icon: customIcon,
          zIndexOffset: -500, // Below facilities but above disasters
        });

        // Build popup content
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

        marker.bindPopup(popupContent);

        // Add to cluster group
        clusterGroupRef.current.addLayer(marker);
      }
    });

    // Cleanup function
    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [osmData, layerVisibility, showOSMLayer, map]);

  return null; // This component doesn't render React elements
};

export default OSMInfrastructureLayer;
