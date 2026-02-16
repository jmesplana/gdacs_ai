import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Custom hook to access the map instance
const MapAccess = ({ onMapReady }) => {
  const map = useMap();

  useEffect(() => {
    if (map && onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  return null;
};

export default MapAccess;
