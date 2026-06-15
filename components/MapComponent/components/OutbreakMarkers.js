import { useEffect, useMemo, useRef, useState } from 'react';
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

function formatShortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function outbreakSortDate(outbreak = {}) {
  const ts = new Date(outbreak.reportDate || outbreak.filterDate || outbreak.updatedDate || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
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
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map]);

  const visibleOutbreaks = useMemo(() => {
    const detailedKeys = new Set();
    const countryKeys = new Set();

    (outbreaks || []).forEach((outbreak) => {
      const key = `${outbreak.reportId || outbreak.title || ''}__${outbreak.country || ''}`;
      if ((outbreak.locationType || '').toLowerCase() === 'country') {
        countryKeys.add(key);
      } else {
        detailedKeys.add(key);
      }
    });

    return (outbreaks || []).filter((outbreak) => {
      const isCountry = (outbreak.locationType || '').toLowerCase() === 'country';
      const key = `${outbreak.reportId || outbreak.title || ''}__${outbreak.country || ''}`;

      if (!isCountry) return zoom >= 5 || !countryKeys.has(key);

      return zoom < 5 || !detailedKeys.has(key);
    });
  }, [outbreaks, zoom]);

  useEffect(() => {
    const layer = showClustering
      ? L.markerClusterGroup({
          chunkedLoading: false,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: true,
          zoomToBoundsOnClick: false,
          maxClusterRadius: showClusterCounts ? 45 : 20,
          iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
            const dimension = count < 10 ? 38 : count < 50 ? 46 : 54;
            const children = cluster.getAllChildMarkers();
            const latest = children.reduce((max, marker) => {
              const ts = outbreakSortDate(marker.options.outbreakData || {});
              return ts > max ? ts : max;
            }, 0);
            const latestLabel = showClusterCounts && latest ? formatShortDate(latest) : '';
            const countFontSize = count < 10 ? 13 : 15;
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
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  line-height: 1;
                  font-weight: 800;
                ">
                  <div style="font-size: ${countFontSize}px;">${showClusterCounts ? count : ''}</div>
                  ${latestLabel ? `<div style="font-size: 9px; font-weight: 700; opacity: 0.95; margin-top: 2px; letter-spacing: 0.02em;">${escapeHtml(latestLabel)}</div>` : ''}
                </div>
              `
            });
          }
        })
      : L.layerGroup();

    if (showClustering) {
      layer.on('clusterclick', (event) => {
        const cluster = event.layer;
        const children = cluster.getAllChildMarkers();
        const sorted = children
          .map((marker) => marker.options.outbreakData)
          .filter(Boolean)
          .sort((a, b) => outbreakSortDate(b) - outbreakSortDate(a));

        if (sorted.length === 0) {
          cluster.zoomToBounds();
          return;
        }

        const rows = sorted.map((o) => {
          const dateLabel = formatDate(o.reportDate);
          const location = [
            o.locationName && o.locationName !== o.country ? o.locationName : null,
            o.admin1,
            o.country
          ].filter(Boolean).join(', ') || o.country || 'Unknown';
          const href = escapeHtml(o.sourceUrl || 'https://www.who.int/emergencies/disease-outbreak-news');
          return `
            <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
              <div style="font-size: 10px; font-weight: 700; color: #be185d; letter-spacing: 0.04em; text-transform: uppercase;">
                ${escapeHtml(dateLabel)}
              </div>
              <a href="${href}" target="_blank" rel="noopener noreferrer" style="display: block; margin-top: 2px; color: #111827; text-decoration: none; font-size: 12px; font-weight: 600; line-height: 1.3;">
                ${escapeHtml(o.title || 'WHO outbreak report')}
              </a>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">${escapeHtml(location)}</div>
            </li>
          `;
        }).join('');

        const popupHtml = `
          <div style="max-width: 320px;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #be185d; text-transform: uppercase; margin-bottom: 6px;">
              ${sorted.length} WHO reports · newest first
            </div>
            <ul style="margin: 0; padding: 0; list-style: none; max-height: 260px; overflow-y: auto;">
              ${rows}
            </ul>
            <button type="button" data-outbreak-zoom="1" style="margin-top: 10px; background: none; border: 1px solid #be185d; color: #be185d; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;">
              Zoom to cluster
            </button>
          </div>
        `;

        const popup = L.popup({ maxWidth: 340 })
          .setLatLng(cluster.getLatLng())
          .setContent(popupHtml)
          .openOn(map);

        setTimeout(() => {
          const node = popup.getElement()?.querySelector('[data-outbreak-zoom="1"]');
          if (node) {
            node.addEventListener('click', () => {
              map.closePopup(popup);
              cluster.zoomToBounds();
            });
          }
        }, 0);
      });
    }

    const icon = buildOutbreakIcon();

    (visibleOutbreaks || []).forEach((outbreak) => {
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
        zIndexOffset: -850,
        outbreakData: outbreak
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
  }, [map, visibleOutbreaks, showClusterCounts, showClustering]);

  return null;
};

export default OutbreakMarkers;
