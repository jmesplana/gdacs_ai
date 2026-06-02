import { useEffect } from 'react';
import { CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import { formatMetricValue } from '../utils/adminDatasetStyling';

const METRIC_BUBBLE_PANE = 'metricBubblePane';

export default function MetricBubblesLayer({
  features = [],
  field = '',
  color = '#2563eb',
  scale = null,
  isPercent = false
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const pane = map.getPane(METRIC_BUBBLE_PANE) || map.createPane(METRIC_BUBBLE_PANE);
    pane.style.zIndex = '520';
    pane.style.pointerEvents = 'auto';
  }, [map]);

  if (!field || !scale || !features.length) return null;

  return (
    <>
      {features.map((feature) => (
        <CircleMarker
          key={`chat-metric-bubble-${field}-${feature.id}`}
          center={[feature.latitude, feature.longitude]}
          radius={scale.radiusForValue(feature.value)}
          pane={METRIC_BUBBLE_PANE}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: color,
            fillOpacity: 0.48,
            opacity: 0.95
          }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {feature.name}: {formatMetricValue(feature.value, { isPercent })}
          </Tooltip>
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
              <strong>{feature.name}</strong>
              <div style={{ marginTop: 8, color: '#334155', fontWeight: 700 }}>
                {field}
              </div>
              <div style={{ marginTop: 4, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>
                {formatMetricValue(feature.value, { isPercent })}
              </div>
              <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                {feature.count > 1 ? `Average from ${feature.count} matched rows` : 'From 1 matched row'}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
