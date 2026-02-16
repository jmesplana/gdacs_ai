import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for managing drawing functionality
 * @returns {Object} Drawing state and handlers
 */
export const useDrawing = () => {
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#FF0000');
  const [drawings, setDrawings] = useState([]);

  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const toggleDrawing = useCallback(() => {
    setDrawingEnabled(prev => !prev);
  }, []);

  const setColor = useCallback((color) => {
    setDrawingColor(color);
  }, []);

  const clearAllDrawings = useCallback(() => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      setDrawings([]);
    }
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

  return {
    // State
    drawingEnabled,
    drawingColor,
    drawings,
    drawControlRef,
    drawnItemsRef,

    // Handlers
    toggleDrawing,
    setColor,
    clearAllDrawings,
    undoLastDrawing,
    addDrawing,
    setDrawings
  };
};
