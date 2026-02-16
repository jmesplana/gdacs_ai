import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

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

export default HeatmapLayer;
