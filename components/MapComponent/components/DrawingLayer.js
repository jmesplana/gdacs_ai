import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

// Leaflet.draw component for drawing functionality
const DrawingLayer = ({ enabled, color, drawControlRef, drawnItemsRef, drawings, setDrawings }) => {
  const map = useMap();
  const controlAddedRef = useRef(false);

  // Initialize drawnItems if not provided
  if (!drawnItemsRef.current) {
    drawnItemsRef.current = new L.FeatureGroup();
  }

  useEffect(() => {
    if (!map) return;

    // Add the drawn items layer to the map
    map.addLayer(drawnItemsRef.current);

    // Initialize drawing controls if not exists
    if (!drawControlRef.current) {
      console.log('Initializing Leaflet.draw with color:', color);

      drawControlRef.current = new L.Control.Draw({
        draw: {
          polygon: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.2
            }
          },
          polyline: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8
            }
          },
          rectangle: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.2
            }
          },
          circle: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.2
            }
          },
          marker: true,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItemsRef.current,
          remove: true
        }
      });

      // Event handlers for drawing
      map.on(L.Draw.Event.CREATED, (e) => {
        console.log('Drawing created:', e);
        const layer = e.layer;
        drawnItemsRef.current.addLayer(layer);

        // Update drawings state
        const newDrawing = {
          id: Date.now(),
          layer: layer,
          color: color,
          type: e.layerType
        };

        setDrawings(prev => [...prev, newDrawing]);
      });

      map.on(L.Draw.Event.EDITED, (e) => {
        console.log('Drawing edited:', e);
        // Could update the drawings state here if needed
      });

      map.on(L.Draw.Event.DELETED, (e) => {
        console.log('Drawing deleted:', e);
        const deletedLayers = e.layers;

        setDrawings(prev =>
          prev.filter(drawing => !deletedLayers.getLayers().includes(drawing.layer))
        );
      });
    }

    // Add or remove controls based on enabled state
    if (enabled && !controlAddedRef.current && drawControlRef.current) {
      map.addControl(drawControlRef.current);
      controlAddedRef.current = true;
    } else if (!enabled && controlAddedRef.current && drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      controlAddedRef.current = false;
    }

  }, [map, enabled, color, setDrawings]);

  // Update drawing colors when color changes
  useEffect(() => {
    if (drawControlRef.current && map) {
      console.log('Updating drawing color to:', color);

      // Remove and re-add control with new color
      if (controlAddedRef.current && drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        controlAddedRef.current = false;
      }

      // Create new control with updated color
      drawControlRef.current = new L.Control.Draw({
        draw: {
          polygon: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.2
            }
          },
          polyline: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8
            }
          },
          rectangle: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.2
            }
          },
          circle: {
            shapeOptions: {
              color: color,
              weight: 3,
              opacity: 0.8,
              fillColor: color,
              fillOpacity: 0.2
            }
          },
          marker: true,
          circlemarker: false
        },
        edit: {
          featureGroup: drawnItemsRef.current,
          remove: true
        }
      });

      if (enabled) {
        map.addControl(drawControlRef.current);
        controlAddedRef.current = true;
      }
    }
  }, [color, map, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (drawControlRef.current && map) {
        if (controlAddedRef.current) {
          map.removeControl(drawControlRef.current);
          controlAddedRef.current = false;
        }
        if (map.hasLayer(drawnItemsRef.current)) {
          map.removeLayer(drawnItemsRef.current);
        }
        drawControlRef.current = null;
      }
    };
  }, [map]);

  return null;
};

export default DrawingLayer;
