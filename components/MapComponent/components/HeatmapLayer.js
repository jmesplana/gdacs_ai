import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Base radius gets larger as zoom level decreases (zoomed out).
function getBaseRadius(zoom) {
  if (zoom <= 2) return 500000;       // Very zoomed out (world view)
  if (zoom <= 4) return 300000;       // Continental view
  if (zoom <= 6) return 200000;       // Country view
  if (zoom <= 8) return 100000;       // Regional view
  return 50000;                       // City view or closer
}

// Custom Heatmap component
const HeatmapLayer = ({ disasters }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);
  // Circles are created once and their radii updated on zoom, rather than
  // being torn down and rebuilt every zoom. Each entry carries the circle and
  // its per-circle multiplier so setRadius() is a cheap arithmetic update.
  const circleEntriesRef = useRef([]);
  // Shared canvas renderer so all heat circles draw on one canvas instead of
  // thousands of individual SVG nodes.
  const rendererRef = useRef(null);

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

    const renderer = L.canvas({ padding: 0.5 });
    rendererRef.current = renderer;
    const heatLayer = L.featureGroup();
    const circleEntries = [];
    const initialBase = getBaseRadius(map.getZoom());

    // Build the circles once. Each point gets three stacked circles; the
    // `factor` is the multiplier applied to the zoom-dependent base radius.
    const circleSpecs = [
      { factor: 2.5, fillColor: '#ff9500', fillOpacity: 0.1 },
      { factor: 1.5, fillColor: '#ff7800', fillOpacity: 0.2 },
      { factor: 1.0, fillColor: '#ff5500', fillOpacity: 0.4 },
    ];

    points.forEach(([lat, lng, intensity]) => {
      circleSpecs.forEach(({ factor, fillColor, fillOpacity }) => {
        const circle = L.circle([lat, lng], {
          radius: initialBase * factor * intensity,
          color: 'rgba(255, 0, 0, 0)',
          fillColor,
          fillOpacity: fillOpacity * intensity,
          stroke: false,
          interactive: false,
          renderer,
        });
        heatLayer.addLayer(circle);
        circleEntries.push({ circle, radiusMultiplier: factor * intensity });
      });
    });

    heatLayer.addTo(map);
    heatLayerRef.current = heatLayer;
    circleEntriesRef.current = circleEntries;

    // On zoom, just rescale the existing circles — no teardown/rebuild.
    const handleZoom = () => {
      const base = getBaseRadius(map.getZoom());
      circleEntriesRef.current.forEach(({ circle, radiusMultiplier }) => {
        circle.setRadius(base * radiusMultiplier);
      });
    };

    map.on('zoomend', handleZoom);

    // Cleanup function
    return () => {
      map.off('zoomend', handleZoom);
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      circleEntriesRef.current = [];
    };
  }, [map, disasters]);

  return null;
};

export default HeatmapLayer;
