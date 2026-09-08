import { useEffect, useMemo } from 'react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import bbox from '@turf/bbox';
import 'leaflet/dist/leaflet.css';

function Fit({ geometry }) {
  const map = useMap();
  useEffect(() => {
    if (!geometry.features.length) return;
    const [west, south, east, north] = bbox(geometry);
    if ([west, south, east, north].every(Number.isFinite)) map.fitBounds([[south, west], [north, east]], { padding: [18, 18], maxZoom: 12 });
  }, [map, geometry]);
  return null;
}

export default function PlanningMap({ districts, areas, selectedArea, onSelect }) {
  const geometry = useMemo(() => ({ type: 'FeatureCollection', features: districts.map((district) => ({ type: 'Feature', id: String(district.id), properties: { name: district.name }, geometry: district.renderGeometry || district.geometry })) }), [districts]);
  const byId = new Map(areas.map((area) => [area.id, area]));
  return <MapContainer center={[0, 0]} zoom={2} style={{ height: '100%', width: '100%' }} preferCanvas>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
    <GeoJSON data={geometry} style={(feature) => {
      const area = byId.get(feature.id);
      return { color: selectedArea === feature.id ? '#182f26' : '#738d81', weight: selectedArea === feature.id ? 3 : 1,
        fillColor: !area ? '#ccd4d0' : area.remaining > 0 ? '#e6a24b' : '#279a80', fillOpacity: .5 };
    }} onEachFeature={(feature, layer) => {
      const label = document.createElement('span');
      label.textContent = feature.properties.name;
      layer.bindTooltip(label);
      layer.on('click', () => onSelect(feature.id));
    }} />
    <Fit geometry={geometry} />
  </MapContainer>;
}
