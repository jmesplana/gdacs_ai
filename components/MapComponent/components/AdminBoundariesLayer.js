import { useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import { useToast } from '../../Toast';
import {
  ADMIN_FILL_MODES,
  NO_DATA_STYLES,
  formatMetricValue,
  getRiskBorderColor,
  getRiskColor
} from '../utils/adminDatasetStyling';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRiskLabel(level) {
  switch (level) {
    case 'very-high': return 'VERY HIGH';
    case 'high': return 'HIGH';
    case 'medium': return 'MEDIUM';
    case 'low': return 'LOW';
    case 'none':
    default: return 'NO RISK';
  }
}

function getRiskBadgeColor(level) {
  switch (level) {
    case 'very-high': return '#d32f2f';
    case 'high': return '#f57c00';
    case 'medium': return '#fbc02d';
    case 'low': return '#7cb342';
    case 'none':
    default: return '#90a4ae';
  }
}

function getDistrictDisplayName(props = {}) {
  return props.name || props.NAME || props.DISTRICT || props.District || 'Unnamed Admin Area';
}

const ADMIN_EXCLUDED_KEYS = new Set(['name', 'NAME', 'geometry', 'bounds', 'riskLevel', 'riskScore', 'eventCount']);
const ADMIN_PREFERRED_KEYS = [
  'country',
  'region',
  'province',
  'provincec',
  'district',
  'tehsil',
  'uc',
  'display_name',
  'displayname',
  'population'
];
const ADMIN_TECHNICAL_KEY_PATTERNS = [
  /^shape[_\s-]?len/i,
  /^shape[_\s-]?length/i,
  /^shape[_\s-]?area/i,
  /^objectid$/i,
  /^fid$/i,
  /^id$/i
];

function normalizeAdminKey(key = '') {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function formatAdminLabel(key = '') {
  const normalized = normalizeAdminKey(key);
  const compact = normalized.replace(/_/g, '');

  if (compact === 'uc') return 'UC';
  if (compact === 'id') return 'ID';

  return normalized
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatAdminValue(value) {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(value) < 10 ? 3 : 1
    });
  }

  const numericValue = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isNaN(numericValue) && String(value).trim() !== '') {
    return numericValue.toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(numericValue) < 10 ? 3 : 1
    });
  }

  return String(value);
}

function isTechnicalAdminKey(key = '') {
  return ADMIN_TECHNICAL_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function buildAdminPropertySections(props = {}) {
  const entries = [];
  const seenNormalizedKeys = new Set();

  Object.entries(props).forEach(([key, value]) => {
    const normalizedKey = normalizeAdminKey(key);

    if (ADMIN_EXCLUDED_KEYS.has(key) || ADMIN_EXCLUDED_KEYS.has(normalizedKey)) return;
    if (value === null || value === undefined || value === '') return;
    if (seenNormalizedKeys.has(normalizedKey)) return;

    seenNormalizedKeys.add(normalizedKey);
    entries.push({
      key,
      normalizedKey,
      label: formatAdminLabel(key),
      value: formatAdminValue(value),
      technical: isTechnicalAdminKey(key) || isTechnicalAdminKey(normalizedKey)
    });
  });

  const preferredOrder = new Map(ADMIN_PREFERRED_KEYS.map((key, index) => [key, index]));
  const primaryFields = [];
  const secondaryFields = [];
  const technicalFields = [];

  entries.forEach((entry) => {
    if (entry.technical) {
      technicalFields.push(entry);
      return;
    }

    if (preferredOrder.has(entry.normalizedKey)) {
      primaryFields.push(entry);
      return;
    }

    secondaryFields.push(entry);
  });

  const sortByPreferredOrder = (a, b) => (
    (preferredOrder.get(a.normalizedKey) ?? Number.MAX_SAFE_INTEGER) -
    (preferredOrder.get(b.normalizedKey) ?? Number.MAX_SAFE_INTEGER)
  ) || a.label.localeCompare(b.label);

  primaryFields.sort(sortByPreferredOrder);
  secondaryFields.sort((a, b) => a.label.localeCompare(b.label));
  technicalFields.sort((a, b) => a.label.localeCompare(b.label));

  return { primaryFields, secondaryFields, technicalFields };
}

function renderAdminFields(fields = []) {
  return fields.map((field) => `
    <p style="margin: 6px 0; font-size: 13px;">
      <strong style="color: #475569;">${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}
    </p>
  `).join('');
}

function buildDatasetPopupBlock(datasetStyle, featureId) {
  if (datasetStyle?.mode !== ADMIN_FILL_MODES.DATASET || !datasetStyle.metricField) return '';

  const entry = datasetStyle.byDistrictId?.[featureId];
  const metric = entry?.aggregated?.[datasetStyle.metricField];
  const valueLabel = metric
    ? formatMetricValue(metric.value, { isPercent: datasetStyle.isPercent })
    : 'No data';

  const supportingText = metric?.count > 1
    ? `Average from ${metric.count} matched rows`
    : metric?.count === 1
      ? 'From 1 matched row'
      : 'No uploaded row matched this admin area';

  return `
    <div style="margin: 10px 0; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
      <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">Uploaded data</div>
      <div style="display: flex; justify-content: space-between; gap: 10px; align-items: center;">
        <span style="font-size: 13px; color: #334155;">${escapeHtml(datasetStyle.metricField)}</span>
        <span style="font-size: 16px; color: #0f172a; font-weight: 800;">${escapeHtml(valueLabel)}</span>
      </div>
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${escapeHtml(supportingText)}</div>
    </div>
  `;
}

export default function AdminBoundariesLayer({
  districts = [],
  displayDistricts = [],
  districtRisks = {},
  highlightedDistricts = [],
  selectedAnalysisDistricts = [],
  selectedAnalysisDistrictIds,
  onAnalysisDistrictsChange,
  canUseDistrictDecisionTools = false,
  onDistrictClick,
  onDistrictOutlookClick,
  mapInstance,
  allowDistrictLabels = false,
  showDistrictRiskFill = true,
  visibleDisasters = [],
  visibleAcledEvents = [],
  datasetStyle = null
}) {
  const { addToast } = useToast();
  const selectedIds = selectedAnalysisDistrictIds || new Set((selectedAnalysisDistricts || []).map(district => district.id));
  const highlightedIds = useMemo(() => new Set(highlightedDistricts), [highlightedDistricts]);
  const featureCollection = useMemo(() => ({
    type: 'FeatureCollection',
    features: displayDistricts
      .filter((district) => district.displayGeometry)
      .map((district) => {
        const risk = districtRisks[district.id] || { level: 'none', score: 0, eventCount: 0 };
        return {
          type: 'Feature',
          properties: {
            country: district.country,
            region: district.region,
            population: district.population,
            riskLevel: risk.level,
            riskScore: risk.score,
            eventCount: risk.eventCount,
            ...district.properties,
            name: district.name
          },
          geometry: district.displayGeometry,
          id: district.id
        };
      })
  }), [displayDistricts, districtRisks]);

  const getDatasetMetric = (featureId) => {
    if (datasetStyle?.mode !== ADMIN_FILL_MODES.DATASET || !datasetStyle.metricField) return null;
    return datasetStyle.byDistrictId?.[featureId]?.aggregated?.[datasetStyle.metricField] || null;
  };

  const getFill = (feature, riskLevel) => {
    if (datasetStyle?.mode === ADMIN_FILL_MODES.DATASET) {
      const metric = getDatasetMetric(feature.id);
      if (!metric) {
        return {
          color: datasetStyle.noDataStyle === NO_DATA_STYLES.GRAY ? '#cbd5e1' : '#ffffff',
          opacity: datasetStyle.noDataStyle === NO_DATA_STYLES.GRAY ? 0.45 : 0
        };
      }

      return {
        color: datasetStyle.scale?.getColor(metric.value) || '#94a3b8',
        opacity: 0.62
      };
    }

    // For NONE or RISK mode, use risk-based coloring and respect showDistrictRiskFill toggle
    return {
      color: getRiskColor(riskLevel),
      opacity: showDistrictRiskFill ? null : 0
    };
  };

  return (
    <GeoJSON
      key={`districts-${districts.length}-${visibleDisasters.length}-${visibleAcledEvents.length}-${highlightedDistricts.length}-selected-${selectedAnalysisDistricts.map(district => district.id).join('_')}-labels-${allowDistrictLabels}-fill-${datasetStyle?.mode || ADMIN_FILL_MODES.RISK}-${datasetStyle?.metricField || 'none'}-${datasetStyle?.legendKey || ''}`}
      data={featureCollection}
      pane="overlayPane"
      interactive={true}
      style={(feature) => {
        const riskLevel = feature.properties.riskLevel || 'none';
        const isHighlighted = highlightedIds.has(feature.id);
        const isSelected = selectedIds.has(feature.id);
        const hasSelection = selectedIds.size > 0;
        const fill = getFill(feature, riskLevel);
        const baseFillOpacity = fill.opacity === null
          ? (isHighlighted ? 0.7 : (isSelected ? 0.7 : (hasSelection ? 0.15 : (riskLevel === 'none' ? 0.2 : 0.5))))
          : fill.opacity;

        // If showDistrictRiskFill is false and not in DATASET mode, respect the toggle
        const isFillDisabled = !showDistrictRiskFill && datasetStyle?.mode !== ADMIN_FILL_MODES.DATASET;
        const finalFillOpacity = isFillDisabled
          ? 0
          : (isHighlighted ? Math.max(baseFillOpacity, 0.7) : (isSelected ? Math.max(baseFillOpacity, 0.7) : baseFillOpacity));

        return {
          color: isHighlighted ? '#FF6B35' : (isSelected ? '#FFFF00' : getRiskBorderColor(riskLevel)),
          weight: isHighlighted ? 4 : (isSelected ? 5 : 3),
          opacity: isHighlighted ? 1 : (hasSelection && !isSelected ? 0.3 : 1),
          fillColor: fill.color,
          fillOpacity: finalFillOpacity,
          className: isHighlighted ? 'highlighted-district' : ''
        };
      }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties;
        const displayName = getDistrictDisplayName(props);
        const riskLevel = props.riskLevel || 'none';
        const riskScore = props.riskScore || 0;
        const eventCount = props.eventCount || 0;
        const { primaryFields, secondaryFields, technicalFields } = buildAdminPropertySections(props);

        let popupContent = `
          <div style="font-family: 'Inter', sans-serif; max-width: 300px;">
            <h4 style="margin: 0 0 10px 0; color: var(--aidstack-navy); font-size: 16px; border-bottom: 2px solid #2D5A7B; padding-bottom: 6px;">
              ${escapeHtml(displayName)}
            </h4>
        `;

        if (eventCount > 0) {
          popupContent += `
            <div style="margin: 10px 0; padding: 10px; background: ${getRiskBadgeColor(riskLevel)}; color: white; border-radius: 6px; text-align: center;">
              <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">RISK LEVEL</div>
              <div style="font-size: 18px; font-weight: bold;">${getRiskLabel(riskLevel)}</div>
              <div style="font-size: 11px; margin-top: 4px; opacity: 0.9;">${eventCount} event${eventCount > 1 ? 's' : ''} detected (Score: ${riskScore})</div>
            </div>
          `;
        }

        popupContent += buildDatasetPopupBlock(datasetStyle, feature.id);

        if (primaryFields.length > 0) {
          popupContent += `
            <div style="margin-top: 10px;">
              ${renderAdminFields(primaryFields)}
            </div>
          `;
        }

        const isSelectedForAnalysis = selectedIds.has(feature.id);
        if (onAnalysisDistrictsChange) {
          popupContent += `
            <button
              id="district-select-btn-${feature.id}"
              style="
                width: 100%;
                margin-top: 10px;
                padding: 10px 12px;
                background: ${isSelectedForAnalysis ? '#0f766e' : '#ffffff'};
                color: ${isSelectedForAnalysis ? '#ffffff' : '#0f766e'};
                border: 1px solid #0f766e;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
              "
            >
              ${isSelectedForAnalysis ? 'Remove From Analysis Scope' : 'Select For Analysis'}
            </button>
          `;
        }

        if (secondaryFields.length > 0) {
          popupContent += `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Attributes</div>
              ${renderAdminFields(secondaryFields)}
            </div>
          `;
        }

        if (technicalFields.length > 0) {
          popupContent += `
            <details style="margin-top: 12px;">
              <summary style="cursor: pointer; font-size: 12px; color: #64748b; font-weight: 600;">Technical fields</summary>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                ${renderAdminFields(technicalFields)}
              </div>
            </details>
          `;
        }

        if (canUseDistrictDecisionTools && (onDistrictClick || onDistrictOutlookClick)) {
          popupContent += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">`;

          if (onDistrictClick) {
            popupContent += `
              <button
                id="district-forecast-btn-${feature.id}"
                style="
                  padding: 10px 12px;
                  background: var(--aidstack-navy);
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  font-family: 'Inter', sans-serif;
                "
              >
                Forecast
              </button>
            `;
          }

          if (onDistrictOutlookClick) {
            popupContent += `
              <button
                id="district-outlook-btn-${feature.id}"
                style="
                  padding: 10px 12px;
                  background: var(--aidstack-orange);
                  color: white;
                  border: none;
                  border-radius: 6px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                  font-family: 'Inter', sans-serif;
                "
              >
                Outlook
              </button>
            `;
          }

          popupContent += `</div>`;
        }

        popupContent += '</div>';
        layer.bindPopup(popupContent);

        if (allowDistrictLabels && mapInstance) {
          const minZoom = 7;

          layer.bindTooltip(displayName, {
            permanent: true,
            direction: 'center',
            className: 'district-label',
            opacity: 0.9
          });

          layer.on('add', () => {
            if (mapInstance.getZoom() < minZoom) {
              layer.closeTooltip();
            }
          });

          const onZoomEnd = () => {
            const zoom = mapInstance.getZoom();
            if (zoom >= minZoom) {
              layer.openTooltip();
            } else {
              layer.closeTooltip();
            }
          };

          mapInstance.on('zoomend', onZoomEnd);
          layer._zoomEndHandler = onZoomEnd;
        }

        if (onAnalysisDistrictsChange || (canUseDistrictDecisionTools && (onDistrictClick || onDistrictOutlookClick))) {
          layer.on('popupopen', () => {
            if (onAnalysisDistrictsChange) {
              const selectBtn = document.getElementById(`district-select-btn-${feature.id}`);
              if (selectBtn) {
                selectBtn.onclick = () => {
                  const fullDistrict = districts.find(district => district.id === feature.id);
                  if (!fullDistrict) return;

                  const nextSelectedDistricts = selectedIds.has(feature.id)
                    ? selectedAnalysisDistricts.filter(district => district.id !== feature.id)
                    : [...selectedAnalysisDistricts, fullDistrict];

                  onAnalysisDistrictsChange(nextSelectedDistricts);
                  addToast(
                    selectedIds.has(feature.id)
                      ? `${displayName} removed from analysis scope.`
                      : `${displayName} added to analysis scope.`,
                    'success'
                  );
                  layer.closePopup();
                };
              }
            }

            if (canUseDistrictDecisionTools && onDistrictClick) {
              const forecastBtn = document.getElementById(`district-forecast-btn-${feature.id}`);
              if (forecastBtn) {
                forecastBtn.onclick = () => {
                  const fullDistrict = districts.find(district => district.id === feature.id);
                  if (fullDistrict) onDistrictClick(fullDistrict);
                };
              }
            }

            if (canUseDistrictDecisionTools && onDistrictOutlookClick) {
              const outlookBtn = document.getElementById(`district-outlook-btn-${feature.id}`);
              if (outlookBtn) {
                outlookBtn.onclick = () => {
                  const fullDistrict = districts.find(district => district.id === feature.id);
                  if (fullDistrict) onDistrictOutlookClick(fullDistrict);
                };
              }
            }
          });
        }
      }}
    />
  );
}
