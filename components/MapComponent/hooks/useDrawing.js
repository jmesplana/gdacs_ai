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

  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const toggleDrawing = useCallback(() => {
    setDrawingEnabled(prev => !prev);
    setAnnotationMode(false);
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

  const toggleAnnotationMode = useCallback(() => {
    setDrawingEnabled(true);
    setAnnotationMode(prev => !prev);
  }, []);

  return {
    // State
    drawingEnabled,
    drawingColor,
    drawings,
    annotationMode,
    drawControlRef,
    drawnItemsRef,

    // Handlers
    toggleDrawing,
    toggleAnnotationMode,
    setColor,
    clearAllDrawings,
    undoLastDrawing,
    addDrawing,
    setDrawings
  };
};
