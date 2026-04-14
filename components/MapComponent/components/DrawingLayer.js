import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const truncateNote = (value = '', maxLength = 80) => (
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
);

const createAnnotationIcon = (text, color) => L.divIcon({
  className: 'map-annotation-icon',
  iconSize: [180, 42],
  iconAnchor: [16, 36],
  popupAnchor: [0, -32],
  html: `
    <div style="display:flex;align-items:flex-end;gap:8px;">
      <div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);flex-shrink:0;"></div>
      <div style="max-width:150px;background:rgba(255,255,255,0.96);border-left:4px solid ${color};padding:7px 10px;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,0.18);font:600 12px/1.35 'Inter',sans-serif;color:#0f172a;white-space:normal;">
        ${escapeHtml(truncateNote(text))}
      </div>
    </div>
  `
});

const applyAnnotationPresentation = (layer, text, color) => {
  layer.setIcon(createAnnotationIcon(text, color));
  layer.annotationText = text;
  layer.annotationColor = color;
  layer.bindPopup(
    `<div style="min-width:220px;font-family:'Inter',sans-serif;">
      <div style="font-weight:700;margin-bottom:8px;color:#0f172a;">Map Note</div>
      <div style="font-size:13px;line-height:1.5;color:#334155;">${escapeHtml(text).replace(/\n/g, '<br/>')}</div>
      <div style="margin-top:8px;font-size:11px;color:#64748b;">Click this note again to edit it.</div>
    </div>`
  );
};

const applyFreehandPresentation = (layer, color) => {
  if (!layer?.setStyle) return;

  layer.setStyle({
    color,
    weight: 3,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round'
  });
  layer.freehandColor = color;
};

// Leaflet.draw component for drawing functionality
const DrawingLayer = ({
  enabled,
  color,
  annotationMode,
  freehandMode,
  drawControlRef,
  drawnItemsRef,
  drawings,
  setDrawings
}) => {
  const map = useMap();
  const controlAddedRef = useRef(false);
  const annotationClickHandlerRef = useRef(null);
  const freehandStrokeRef = useRef(null);
  const freehandPointsRef = useRef([]);
  const isFreehandDrawingRef = useRef(false);

  const promptForAnnotation = () => {
    const text = window.prompt('Add a map note');
    return text ? text.trim() : '';
  };

  const createAnnotation = (latlng) => {
    const text = promptForAnnotation();
    if (!text) return;

    const layer = L.marker(latlng, {
      icon: createAnnotationIcon(text, color),
      draggable: false
    });

    applyAnnotationPresentation(layer, text, color);

    layer.on('click', () => {
      const updatedText = window.prompt('Edit map note', layer.annotationText || '');

      if (updatedText === null) {
        layer.openPopup();
        return;
      }

      const trimmed = updatedText.trim();
      if (!trimmed) {
        if (drawnItemsRef.current?.hasLayer(layer)) {
          drawnItemsRef.current.removeLayer(layer);
        }
        setDrawings(prev => prev.filter(drawing => drawing.layer !== layer));
        return;
      }

      applyAnnotationPresentation(layer, trimmed, layer.annotationColor || color);
      setDrawings(prev => prev.map((drawing) => (
        drawing.layer === layer
          ? { ...drawing, annotationText: trimmed }
          : drawing
      )));
      layer.openPopup();
    });

    drawnItemsRef.current.addLayer(layer);

    const newDrawing = {
      id: Date.now(),
      layer,
      color,
      type: 'annotation',
      source: 'leaflet-draw',
      annotationText: text
    };

    setDrawings(prev => [...prev, newDrawing]);
  };

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
          type: e.layerType,
          source: 'leaflet-draw'
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

  useEffect(() => {
    if (!map) return undefined;

    if (annotationClickHandlerRef.current) {
      map.off('click', annotationClickHandlerRef.current);
      annotationClickHandlerRef.current = null;
    }

    if (!enabled || !annotationMode) {
      map.getContainer().style.cursor = '';
      return undefined;
    }

    const handleAnnotationClick = (event) => {
      createAnnotation(event.latlng);
    };

    annotationClickHandlerRef.current = handleAnnotationClick;
    map.on('click', handleAnnotationClick);
    map.getContainer().style.cursor = 'crosshair';

    return () => {
      if (annotationClickHandlerRef.current) {
        map.off('click', annotationClickHandlerRef.current);
        annotationClickHandlerRef.current = null;
      }
      map.getContainer().style.cursor = '';
    };
  }, [map, enabled, annotationMode, color, setDrawings]);

  useEffect(() => {
    if (!map) return undefined;

    const finishFreehandStroke = () => {
      if (!isFreehandDrawingRef.current) return;

      map.dragging.enable();
      isFreehandDrawingRef.current = false;

      const stroke = freehandStrokeRef.current;
      const points = freehandPointsRef.current;

      freehandStrokeRef.current = null;
      freehandPointsRef.current = [];

      if (!stroke) return;

      if (points.length < 2) {
        drawnItemsRef.current?.removeLayer(stroke);
        return;
      }

      const newDrawing = {
        id: Date.now(),
        layer: stroke,
        color,
        type: 'freehand',
        source: 'leaflet-draw'
      };

      setDrawings(prev => [...prev, newDrawing]);
    };

    const handleMouseDown = (event) => {
      if (!enabled || !freehandMode || annotationMode) return;

      isFreehandDrawingRef.current = true;
      freehandPointsRef.current = [event.latlng];

      const stroke = L.polyline([event.latlng], {
        color,
        weight: 3,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      });

      freehandStrokeRef.current = stroke;
      drawnItemsRef.current.addLayer(stroke);
      map.dragging.disable();
    };

    const handleMouseMove = (event) => {
      if (!isFreehandDrawingRef.current || !freehandStrokeRef.current) return;

      freehandPointsRef.current = [...freehandPointsRef.current, event.latlng];
      freehandStrokeRef.current.setLatLngs(freehandPointsRef.current);
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', finishFreehandStroke);
    map.on('mouseout', finishFreehandStroke);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', finishFreehandStroke);
      map.off('mouseout', finishFreehandStroke);

      if (map.dragging && !map.dragging.enabled()) {
        map.dragging.enable();
      }
    };
  }, [map, enabled, freehandMode, annotationMode, color, drawnItemsRef, setDrawings]);

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

  useEffect(() => {
    drawings.forEach((drawing) => {
      if (drawing.type === 'annotation' && drawing.layer) {
        applyAnnotationPresentation(
          drawing.layer,
          drawing.annotationText || drawing.layer.annotationText || 'Map note',
          drawing.color || color
        );
      }

      if (drawing.type === 'freehand' && drawing.layer && drawing.color) {
        applyFreehandPresentation(drawing.layer, drawing.color);
      }
    });
  }, [drawings, color]);

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
