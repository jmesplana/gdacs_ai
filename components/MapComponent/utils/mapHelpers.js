import L from 'leaflet';

/**
 * Zooms the map to fit all filtered disasters and facilities
 * @param {L.Map} mapInstance - Leaflet map instance
 * @param {Array} disasters - Array of disaster objects
 * @param {Array} facilities - Array of facility objects
 */
export const zoomToFilteredEvents = (mapInstance, disasters, facilities) => {
  console.log("Zoom to fit called");

  if (!mapInstance || !disasters || disasters.length === 0) {
    console.log("No map instance or no disasters to fit");
    return;
  }

  // Create bounds object
  const bounds = L.latLngBounds();
  let pointsAdded = 0;

  console.log(`Processing ${disasters.length} disasters for zoom bounds`);

  // Add all disaster points to bounds
  disasters.forEach(disaster => {
    if (disaster.latitude != null && disaster.longitude != null) {
      const lat = parseFloat(disaster.latitude);
      const lng = parseFloat(disaster.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        bounds.extend([lat, lng]);
        pointsAdded++;
      }
    }

    // If disaster has polygon, add all polygon points to bounds
    if (disaster.polygon && Array.isArray(disaster.polygon) && disaster.polygon.length > 0) {
      disaster.polygon.forEach(point => {
        if (Array.isArray(point) && point.length === 2) {
          const lat = parseFloat(point[0]);
          const lng = parseFloat(point[1]);

          if (!isNaN(lat) && !isNaN(lng)) {
            bounds.extend([lat, lng]);
            pointsAdded++;
          }
        }
      });
    }
  });

  // Also add facility locations to the bounds if any are impacted
  if (facilities && facilities.length > 0) {
    console.log(`Adding ${facilities.length} facilities to bounds`);

    facilities.forEach(facility => {
      if (facility.latitude != null && facility.longitude != null) {
        const lat = parseFloat(facility.latitude);
        const lng = parseFloat(facility.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend([lat, lng]);
          pointsAdded++;
        }
      }
    });
  }

  console.log(`Added ${pointsAdded} points to bounds`);

  // If we have valid bounds, fit the map to them
  if (bounds.isValid() && pointsAdded > 0) {
    console.log("Bounds are valid, fitting map");
    try {
      mapInstance.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 10,
        animate: true,
        duration: 1
      });
      console.log("Map fitted to bounds successfully");
    } catch (error) {
      console.error("Error fitting bounds:", error);
    }
  } else {
    console.log("Bounds are not valid or no points added");
  }
};

/**
 * Parse coordinates from CAP polygon string
 * @param {string} polygonString - CAP polygon coordinate string
 * @returns {Array} Array of [lat, lng] coordinates
 */
export const parseCapPolygon = (polygonString) => {
  if (!polygonString) return [];

  try {
    // Split by whitespace
    const coords = polygonString.trim().split(/\s+/);

    // Determine if format is "lat,lng" or "lng,lat"
    const parsedCoords = [];
    for (let i = 0; i < coords.length; i++) {
      const pair = coords[i].split(',');
      if (pair.length === 2) {
        const num1 = parseFloat(pair[0]);
        const num2 = parseFloat(pair[1]);

        if (!isNaN(num1) && !isNaN(num2)) {
          // Latitude is typically -90 to 90, longitude is -180 to 180
          // If first number is outside lat range, assume lng,lat format
          if (Math.abs(num1) > 90) {
            parsedCoords.push([num2, num1]); // lng,lat -> lat,lng
          } else {
            parsedCoords.push([num1, num2]); // lat,lng
          }
        }
      }
    }

    return parsedCoords;
  } catch (error) {
    console.error('Error parsing CAP polygon:', error);
    return [];
  }
};

/**
 * Toggle fullscreen mode for an element
 * @param {HTMLElement} element - Element to make fullscreen
 * @param {boolean} isCurrentlyFullscreen - Current fullscreen state
 */
export const toggleFullscreen = (element, isCurrentlyFullscreen) => {
  if (!isCurrentlyFullscreen) {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) { /* Firefox */
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
      element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { /* IE/Edge */
      element.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
      document.msExitFullscreen();
    }
  }
};

/**
 * Check if browser is currently in fullscreen mode
 * @returns {boolean} True if currently in fullscreen
 */
export const isFullscreenActive = () => {
  return !!(
    document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
};
