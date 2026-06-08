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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatScalarAdminValue(value) {
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

function isSameAdminKey(a = '', b = '') {
  return normalizeAdminKey(a).replace(/_/g, '') === normalizeAdminKey(b).replace(/_/g, '');
}

function getMeaningfulObjectEntries(value = {}) {
  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== '');
}

function collapseRepeatedNestedLabel(entryKey, entryValue) {
  if (!isPlainObject(entryValue)) return entryValue;

  const nestedEntries = getMeaningfulObjectEntries(entryValue);
  if (nestedEntries.length !== 1) return entryValue;

  const [[nestedKey, nestedValue]] = nestedEntries;
  return isSameAdminKey(entryKey, nestedKey) ? nestedValue : entryValue;
}

function formatNestedAdminValue(value, depth = 0, parentKey = '') {
  if (value === null || value === undefined || value === '') return '';

  if (Array.isArray(value)) {
    const formattedItems = value
      .slice(0, 4)
      .map((item) => formatNestedAdminValue(item, depth + 1, parentKey))
      .filter(Boolean);
    const suffix = value.length > 4 ? `, +${value.length - 4} more` : '';
    return `${formattedItems.join(', ')}${suffix}`;
  }

  if (isPlainObject(value)) {
    const directEntries = getMeaningfulObjectEntries(value);
    if (directEntries.length === 1 && parentKey && isSameAdminKey(parentKey, directEntries[0][0])) {
      return formatNestedAdminValue(directEntries[0][1], depth + 1, parentKey);
    }

    const entries = directEntries
      .slice(0, depth > 0 ? 3 : 5)
      .map(([entryKey, entryValue]) => {
        const collapsedValue = collapseRepeatedNestedLabel(entryKey, entryValue);
        const formattedValue = formatNestedAdminValue(collapsedValue, depth + 1, entryKey);
        return formattedValue ? `${formatAdminLabel(entryKey)}: ${formattedValue}` : '';
      })
      .filter(Boolean);

    const totalEntries = directEntries.length;
    const suffix = totalEntries > entries.length ? `, +${totalEntries - entries.length} more` : '';
    return `${entries.join('; ')}${suffix}`;
  }

  return formatScalarAdminValue(value);
}

function formatAdminValue(value, key = '') {
  if (value === null || value === undefined || value === '') return '';

  if (Array.isArray(value) || isPlainObject(value)) {
    const formatted = formatNestedAdminValue(value, 0, key);
    return formatted.length > 300 ? `${formatted.slice(0, 297)}...` : formatted;
  }

  return formatScalarAdminValue(value);
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

    const formattedValue = formatAdminValue(value, key);
    if (!formattedValue) return;

    seenNormalizedKeys.add(normalizedKey);
    entries.push({
      key,
      normalizedKey,
      label: formatAdminLabel(key),
      value: formattedValue,
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

// Label decluttering state - shared across all district feature layers.
const labelPlacementCache = {
  layers: new Set(),
  placed: [],
  version: 0,
  updateScheduled: false
};

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
  labelMinZoom = 7,
  showDistrictBorders = true,
  showDistrictRiskFill = true,
  visibleDisasters = [],
  visibleAcledEvents = [],
  datasetStyle = null,
  isDrawingMode = false
}) {
  const { addToast } = useToast();
  const selectedIds = selectedAnalysisDistrictIds || new Set((selectedAnalysisDistricts || []).map(district => String(district.id)));
  const highlightedIds = useMemo(() => new Set((highlightedDistricts || []).map((id) => String(id))), [highlightedDistricts]);
  const highlightedDistrictKey = useMemo(
    () => (highlightedDistricts || []).map((id) => String(id)).sort().join('_'),
    [highlightedDistricts]
  );
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
      if (datasetStyle.scopeSelectedOnly && selectedIds.size > 0 && !selectedIds.has(String(feature.id))) {
        return {
          color: '#ffffff',
          opacity: 0
        };
      }

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
      key={`districts-${districts.length}-${visibleDisasters.length}-${visibleAcledEvents.length}-${highlightedDistrictKey}-selected-${selectedAnalysisDistricts.map(district => district.id).join('_')}-labels-${allowDistrictLabels}-labelzoom-${labelMinZoom}-borders-${showDistrictBorders}-fill-${datasetStyle?.mode || ADMIN_FILL_MODES.RISK}-${datasetStyle?.metricField || 'none'}-${datasetStyle?.scopeSelectedOnly ? 'scoped' : 'all'}-${datasetStyle?.legendKey || ''}-drawing-${isDrawingMode}`}
      data={featureCollection}
      pane="overlayPane"
      interactive={!isDrawingMode}
      style={(feature) => {
        const riskLevel = feature.properties.riskLevel || 'none';
        const isHighlighted = highlightedIds.has(String(feature.id));
        const isSelected = selectedIds.has(String(feature.id));
        const hasSelection = selectedIds.size > 0;
        const shouldShowBorder = showDistrictBorders || isHighlighted || isSelected;
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
          color: isHighlighted ? '#FF3B00' : (isSelected ? '#FFFF00' : getRiskBorderColor(riskLevel)),
          weight: shouldShowBorder ? (isHighlighted ? 7 : (isSelected ? 5 : 3)) : 0,
          opacity: shouldShowBorder ? (isHighlighted ? 1 : (hasSelection && !isSelected ? 0.3 : 1)) : 0,
          lineCap: 'round',
          lineJoin: 'round',
          fillColor: fill.color,
          fillOpacity: finalFillOpacity,
          className: isHighlighted ? 'highlighted-district' : ''
        };
      }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties;
        const displayName = getDistrictDisplayName(props);
        const isHighlightedFeature = highlightedIds.has(String(feature.id));
        if (isHighlightedFeature && typeof layer.bringToFront === 'function') {
          layer.on('add', () => {
            layer.bringToFront();
          });
        }
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

        const isSelectedForAnalysis = selectedIds.has(String(feature.id));
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

        // Only bind popup if not in drawing mode to prevent interference with drawing/annotation
        if (!isDrawingMode) {
          layer.bindPopup(popupContent);
        }

        if (allowDistrictLabels && mapInstance) {
          const minZoom = Number.isFinite(Number(labelMinZoom)) ? Number(labelMinZoom) : 7;

          layer.bindTooltip(displayName, {
            permanent: true,
            direction: 'center',
            className: 'district-label',
            opacity: 0.9
          });

          // Store label metadata for ranking and collision detection
          // This function updates metadata dynamically to reflect current selection state
          const updateLabelMetadata = () => {
            const isSelectedFeature = selectedIds.has(String(feature.id));
            const isHighlightedFeature = highlightedIds.has(String(feature.id));

            if (!layer._labelMetadata) {
              layer._labelMetadata = {};
            }

            layer._labelMetadata.featureId = feature.id;
            layer._labelMetadata.displayName = displayName;
            layer._labelMetadata.riskScore = props.riskScore || 0;
            layer._labelMetadata.metricValue = getDatasetMetric(feature.id)?.value;
            layer._labelMetadata.isSelected = isSelectedFeature;
            layer._labelMetadata.isHighlighted = isHighlightedFeature;
          };

          // Initialize metadata
          updateLabelMetadata();

          const updateTooltipVisibility = () => {
            // Refresh metadata to capture current selection/highlight state
            updateLabelMetadata();
            const zoom = mapInstance.getZoom();
            let isInView = true;
            let bounds = null;

            if (typeof layer.getBounds === 'function') {
              try {
                bounds = layer.getBounds();
                isInView = mapInstance.getBounds().pad(0.15).contains(bounds.getCenter());
              } catch (error) {
                isInView = true;
              }
            }

            // Quick pass: mark layer as not visible
            layer._labelMetadata.passedAreaFilter = false;

            if (zoom < minZoom || !isInView || !bounds) {
              layer.closeTooltip();
              return;
            }

            // 4-Layer Label Decluttering System
            // Layer 1: Area-based threshold (baseline filter)
            const nw = mapInstance.latLngToLayerPoint(bounds.getNorthWest());
            const se = mapInstance.latLngToLayerPoint(bounds.getSouthEast());
            const widthPx = Math.abs(se.x - nw.x);
            const heightPx = Math.abs(se.y - nw.y);
            const areaPx = widthPx * heightPx;

            const areaThresholds = {
              7: 15000,  8: 10000,  9: 5000,  10: 2000,
              11: 1000,  12: 500,   13: 200,  14: 50
            };
            const areaThreshold = areaThresholds[Math.floor(zoom)] || (zoom < 7 ? 20000 : (zoom >= 15 ? 0 : 50));

            if (areaPx < areaThreshold) {
              layer.closeTooltip();
              return;
            }

            // Store computed values for collision detection
            const centerPx = mapInstance.latLngToLayerPoint(bounds.getCenter());
            layer._labelMetadata.areaPx = areaPx;
            layer._labelMetadata.centerPx = centerPx;
            layer._labelMetadata.zoom = Math.floor(zoom);
            layer._labelMetadata.passedAreaFilter = true;
            return true;
          };

          // Debounced batch update for all labels
          const scheduleUpdateAllLabels = (immediate = false) => {
            if (immediate) {
              // Force immediate update (used when labels are toggled on)
              updateAllLabels();
              return;
            }

            if (labelPlacementCache.updateScheduled) return;

            labelPlacementCache.updateScheduled = true;
            requestAnimationFrame(() => {
              labelPlacementCache.updateScheduled = false;
              updateAllLabels();
            });
          };

          // Collect all layers and apply ranking, top-N, and collision detection
          const updateAllLabels = () => {
            const zoom = Math.floor(mapInstance.getZoom());
            const registeredLayers = Array.from(labelPlacementCache.layers)
              .filter((registeredLayer) => registeredLayer?._map === mapInstance && registeredLayer._labelMetadata);

            registeredLayers.forEach((registeredLayer) => {
              if (typeof registeredLayer._updateDistrictLabelCandidate === 'function') {
                registeredLayer._updateDistrictLabelCandidate();
              }
            });

            // Collect all candidate layers that passed area filter
            const candidateLayers = registeredLayers.filter((registeredLayer) =>
              registeredLayer._labelMetadata?.passedAreaFilter &&
              registeredLayer._labelMetadata.zoom === zoom
            );

            if (candidateLayers.length === 0) {
              registeredLayers.forEach((registeredLayer) => registeredLayer.closeTooltip());
              return;
            }

            // Reset cache for this update cycle
            labelPlacementCache.version++;
            labelPlacementCache.placed = [];

            // Layer 2: Rank by importance (selected/highlighted first, then area, then metric/risk score)
            candidateLayers.sort((a, b) => {
              // Priority 1: Selected districts always come first
              if (a._labelMetadata.isSelected !== b._labelMetadata.isSelected) {
                return b._labelMetadata.isSelected ? 1 : -1;
              }

              // Priority 2: Highlighted districts come next
              if (a._labelMetadata.isHighlighted !== b._labelMetadata.isHighlighted) {
                return b._labelMetadata.isHighlighted ? 1 : -1;
              }

              // Priority 3: Larger screen area = more prominent
              const areaDiff = (b._labelMetadata.areaPx || 0) - (a._labelMetadata.areaPx || 0);
              if (Math.abs(areaDiff) > 100) return areaDiff;

              // Priority 4: Metric value or risk score
              const aScore = a._labelMetadata.metricValue ?? a._labelMetadata.riskScore ?? 0;
              const bScore = b._labelMetadata.metricValue ?? b._labelMetadata.riskScore ?? 0;
              return bScore - aScore;
            });

            // Layer 3: Top-N per zoom level (but always include selected/highlighted)
            const selectedAndHighlighted = candidateLayers.filter(l =>
              l._labelMetadata.isSelected || l._labelMetadata.isHighlighted
            );
            const others = candidateLayers.filter(l =>
              !l._labelMetadata.isSelected && !l._labelMetadata.isHighlighted
            );

            const maxLabelsPerZoom = {
              7: 8,   8: 12,  9: 20,  10: 35,
              11: 60, 12: 100, 13: 200, 14: 400
            };
            const maxLabels = maxLabelsPerZoom[Math.floor(zoom)] || (zoom < 7 ? 5 : (zoom >= 15 ? 10000 : 800));

            // Always include selected/highlighted, then fill remaining slots with others
            const remainingSlots = Math.max(0, maxLabels - selectedAndHighlighted.length);
            const topCandidates = [...selectedAndHighlighted, ...others.slice(0, remainingSlots)];

            // Layer 4: Collision detection (simplified for performance)
            // At high zoom (15+), disable collision detection to show all labels
            const useCollisionDetection = zoom < 15;
            const LABEL_PADDING = 6; // px (reduced for smaller labels)
            const estimateLabelBox = (layer) => {
              const { centerPx, displayName } = layer._labelMetadata;
              // Updated for smaller font: ~6px per character (11px font), 14px height
              const estWidth = (displayName?.length || 10) * 6 + LABEL_PADDING * 2;
              const estHeight = 14 + LABEL_PADDING * 2;

              return {
                minX: centerPx.x - estWidth / 2,
                maxX: centerPx.x + estWidth / 2,
                minY: centerPx.y - estHeight / 2,
                maxY: centerPx.y + estHeight / 2
              };
            };

            const boxesOverlap = (box1, box2) => {
              return !(box1.maxX < box2.minX || box1.minX > box2.maxX ||
                       box1.maxY < box2.minY || box1.minY > box2.maxY);
            };

            topCandidates.forEach((layer) => {
              const candidateBox = estimateLabelBox(layer);
              const isImportant = layer._labelMetadata.isSelected || layer._labelMetadata.isHighlighted;

              // Selected/highlighted districts skip collision detection (always show)
              if (isImportant || !useCollisionDetection) {
                layer.openTooltip();
                labelPlacementCache.placed.push(candidateBox);
                return;
              }

              // Regular districts use collision detection at lower zoom levels
              const hasCollision = labelPlacementCache.placed.some((placedBox) =>
                boxesOverlap(candidateBox, placedBox)
              );

              if (!hasCollision) {
                layer.openTooltip();
                labelPlacementCache.placed.push(candidateBox);
              } else {
                layer.closeTooltip();
              }
            });

            // Close tooltips for layers beyond top-N
            const shownLayers = new Set(topCandidates);
            candidateLayers.forEach((layer) => {
              if (!shownLayers.has(layer)) layer.closeTooltip();
            });
          };

          // Single event handler setup per layer
          const handleMapUpdate = () => {
            scheduleUpdateAllLabels();
          };

          // Use a longer delay on initial add to ensure all layers are ready
          let isFirstAdd = true;
          layer.on('add', () => {
            labelPlacementCache.layers.add(layer);
            layer._updateDistrictLabelCandidate = updateTooltipVisibility;
            if (isFirstAdd) {
              isFirstAdd = false;
              // Longer delay for initial render to collect all layers
              setTimeout(() => scheduleUpdateAllLabels(true), 150);
            } else {
              scheduleUpdateAllLabels();
            }
          });

          mapInstance.on('zoomend', handleMapUpdate);
          mapInstance.on('moveend', handleMapUpdate);

          layer.on('remove', () => {
            mapInstance.off('zoomend', handleMapUpdate);
            mapInstance.off('moveend', handleMapUpdate);
            labelPlacementCache.layers.delete(layer);
            delete layer._updateDistrictLabelCandidate;
            layer._labelMetadata.passedAreaFilter = false;
          });
        }

        if (onAnalysisDistrictsChange || (canUseDistrictDecisionTools && (onDistrictClick || onDistrictOutlookClick))) {
          layer.on('popupopen', () => {
            if (onAnalysisDistrictsChange) {
              const selectBtn = document.getElementById(`district-select-btn-${feature.id}`);
              if (selectBtn) {
                selectBtn.onclick = () => {
                  const fullDistrict = districts.find(district => district.id === feature.id);
                  if (!fullDistrict) return;

                  const nextSelectedDistricts = selectedIds.has(String(feature.id))
                    ? selectedAnalysisDistricts.filter(district => String(district.id) !== String(feature.id))
                    : [...selectedAnalysisDistricts, fullDistrict];

                  onAnalysisDistrictsChange(nextSelectedDistricts);
                  addToast(
                    selectedIds.has(String(feature.id))
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
