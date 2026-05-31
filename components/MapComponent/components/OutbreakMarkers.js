import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatMetric(value) {
  if (value === null || value === undefined || value === '') return 'Unknown';
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString() : String(value);
}

function buildOutbreakIcon() {
  return L.divIcon({
    className: 'who-outbreak-icon',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `
      <div style="
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #be185d;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v4"></path>
          <path d="M12 18v4"></path>
          <path d="m4.93 4.93 2.83 2.83"></path>
          <path d="m16.24 16.24 2.83 2.83"></path>
          <path d="M2 12h4"></path>
          <path d="M18 12h4"></path>
          <path d="m4.93 19.07 2.83-2.83"></path>
          <path d="m16.24 7.76 2.83-2.83"></path>
        </svg>
      </div>
    `
  });
}

const OutbreakMarkers = ({ outbreaks = [], showClusterCounts = true, showClustering = true }) => {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = showClustering
      ? L.markerClusterGroup({
          chunkedLoading: false,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: true,
          zoomToBoundsOnClick: true,
          maxClusterRadius: showClusterCounts ? 45 : 20,
          iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
            const dimension = count < 10 ? 34 : count < 50 ? 42 : 50;
            return L.divIcon({
              className: 'who-outbreak-cluster',
              iconSize: L.point(dimension, dimension),
              html: `
                <div style="
                  width: ${dimension}px;
                  height: ${dimension}px;
                  border-radius: 50%;
                  background: rgba(190, 24, 93, 0.92);
                  border: 3px solid white;
                  box-shadow: 0 3px 9px rgba(15, 23, 42, 0.35);
                  color: white;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: ${count < 10 ? 13 : 15}px;
                  font-weight: 800;
                ">${showClusterCounts ? count : ''}</div>
              `
            });
          }
        })
      : L.layerGroup();

    const icon = buildOutbreakIcon();

    (outbreaks || []).forEach((outbreak) => {
      const lat = Number(outbreak.latitude);
      const lng = Number(outbreak.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const metrics = outbreak.metrics || {};
      const sourceUrl = escapeHtml(outbreak.sourceUrl || 'https://www.who.int/emergencies/disease-outbreak-news');
      const affectedCountries = Array.isArray(outbreak.affectedCountries) && outbreak.affectedCountries.length > 0
        ? outbreak.affectedCountries.join(', ')
        : outbreak.country || 'Unknown';
      const locationLabel = [
        outbreak.locationName && outbreak.locationName !== outbreak.country ? outbreak.locationName : null,
        outbreak.admin1,
        outbreak.country
      ].filter(Boolean).join(', ') || outbreak.country || 'Unknown';
      const confidenceLabel = outbreak.locationType || outbreak.locationConfidence || 'country';

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: -850
      });

      marker.bindPopup(`
        <div style="max-width: 300px;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #be185d; text-transform: uppercase; margin-bottom: 6px;">
            WHO Disease Outbreak News
          </div>
          <h3 style="margin: 0 0 8px; color: #111827; font-size: 15px; line-height: 1.25;">
            ${escapeHtml(outbreak.title || 'WHO outbreak report')}
          </h3>
          <div style="display: grid; grid-template-columns: 92px 1fr; row-gap: 5px; column-gap: 8px; font-size: 12px; color: #374151;">
            <strong>Disease</strong><span>${escapeHtml(outbreak.disease || 'Unknown')}</span>
            <strong>Report date</strong><span>${escapeHtml(formatDate(outbreak.reportDate))}</span>
            <strong>Location</strong><span>${escapeHtml(locationLabel)}</span>
            <strong>Precision</strong><span>${escapeHtml(confidenceLabel)}</span>
            <strong>Affected</strong><span>${escapeHtml(affectedCountries)}</span>
            <strong>Cases</strong><span>${escapeHtml(formatMetric(metrics.cases))}</span>
            <strong>Deaths</strong><span>${escapeHtml(formatMetric(metrics.deaths))}</span>
            <strong>CFR</strong><span>${metrics.cfr === null || metrics.cfr === undefined ? 'Unknown' : `${escapeHtml(metrics.cfr)}%`}</span>
          </div>
          ${outbreak.locationSnippet ? `<p style="margin: 8px 0 0; font-size: 12px; color: #475569; line-height: 1.4;"><strong>Location evidence:</strong> ${escapeHtml(outbreak.locationSnippet).slice(0, 220)}${outbreak.locationSnippet.length > 220 ? '...' : ''}</p>` : ''}
          ${outbreak.summary ? `<p style="margin: 8px 0 0; font-size: 12px; color: #4b5563; line-height: 1.4;">${escapeHtml(outbreak.summary).slice(0, 260)}${outbreak.summary.length > 260 ? '...' : ''}</p>` : ''}
          <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 10px; color: #be185d; text-decoration: none; font-weight: 800; font-size: 12px;">
            Open WHO report →
          </a>
        </div>
      `);

      layer.addLayer(marker);
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
      layerRef.current = null;
    };
  }, [map, outbreaks, showClusterCounts, showClustering]);

  return null;
};

export default OutbreakMarkers;
