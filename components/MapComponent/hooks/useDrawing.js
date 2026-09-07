import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for managing drawing functionality
 * @returns {Object} Drawing state and handlers
 */
export const useDrawing = () => {
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#FF0000');
  const [drawings, setDrawings] = useState([]);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [freehandMode, setFreehandMode] = useState(false);

  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const toggleDrawing = useCallback(() => {
    setDrawingEnabled(prev => {
      const nextEnabled = !prev;

      if (!nextEnabled) {
        setAnnotationMode(false);
        setFreehandMode(false);
      }

      return nextEnabled;
    });
  }, []);

  const setColor = useCallback((color) => {
    setDrawingColor(color);
  }, []);

  const clearAllDrawings = useCallback(() => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }

    setDrawings([]);
  }, []);

  const undoLastDrawing = useCallback(() => {
    if (drawings.length > 0) {
      const lastDrawing = drawings[drawings.length - 1];

      if (lastDrawing.layer && drawnItemsRef.current) {
        drawnItemsRef.current.removeLayer(lastDrawing.layer);
      }

      setDrawings(prev => prev.slice(0, -1));
    }
  }, [drawings]);

  const addDrawing = useCallback((drawing) => {
    setDrawings(prev => [...prev, drawing]);
  }, []);

  const toggleAnnotationMode = useCallback(() => {
    setFreehandMode(false);
    setAnnotationMode(prev => {
      const next = !prev;
      // Turning a mode ON enables drawing; turning the last mode OFF disables it
      // again so districts don't stay non-interactive with no visible tool active.
      setDrawingEnabled(next);
      return next;
    });
  }, []);

  const toggleFreehandMode = useCallback(() => {
    setAnnotationMode(false);
    setFreehandMode(prev => {
      const next = !prev;
      setDrawingEnabled(next);
      return next;
    });
  }, []);

  return {
    // State
    drawingEnabled,
    drawingColor,
    drawings,
    annotationMode,
    freehandMode,
    drawControlRef,
    drawnItemsRef,

    // Handlers
    toggleDrawing,
    toggleAnnotationMode,
    toggleFreehandMode,
    setColor,
    clearAllDrawings,
    undoLastDrawing,
    addDrawing,
    setDrawings
  };
};
