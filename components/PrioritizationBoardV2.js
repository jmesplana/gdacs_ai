import { useEffect, useMemo, useState } from 'react';
import { buildPrioritizationBoard } from '../lib/prioritizationBoard';
import { DecisionBadge, RiskBar } from './DecisionSupport';
import {
  filterFacilitiesToDistricts,
  filterImpactedFacilitiesToDistricts,
  filterItemsToDistricts,
  getScopedWorldPopData
} from '../lib/analysisScope';

const LOCAL_WORKFLOW_KEY = 'gdacs_prioritization_workflow';

const levelColors = {
  Urgent: { bg: '#fee2e2', text: '#991b1b', icon: '🔴' },
  High: { bg: '#ffedd5', text: '#9a3412', icon: '🟨' },
  Medium: { bg: '#fef3c7', text: '#92400e', icon: '🟦' },
  Monitor: { bg: '#e0f2fe', text: '#0c4a6e', icon: '⚪' }
};

const statusOptions = ['Unassigned', 'In Review', 'In Progress', 'Done'];
const POPULATION_FIELDS = [
  'population',
  'target_population',
  'catchment_population',
  'catchment',
  'beneficiaries',
  'people_served',
  'children_u5',
  'districtPopulation'
];
const FACILITY_TYPE_FIELDS = ['facility_type', 'type', 'category', 'service_type'];

function parseResponse(response, label) {
  return response.text().then((raw) => {
    if (!response.ok) {
      throw new Error(`${label} failed (${response.status})${raw ? `: ${raw.slice(0, 140)}` : ''}`);
    }
    return raw ? JSON.parse(raw) : {};
  });
}

function loadWorkflowState() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(LOCAL_WORKFLOW_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Unable to load prioritization workflow state:', error);
    return {};
  }
}

function saveWorkflowState(state) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCAL_WORKFLOW_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to save prioritization workflow state:', error);
  }
}

function simplifyRing(ring = [], maxPoints = 250) {
  if (!Array.isArray(ring) || ring.length <= maxPoints) return ring;

  const closed = ring.length > 2 &&
    ring[0]?.[0] === ring[ring.length - 1]?.[0] &&
    ring[0]?.[1] === ring[ring.length - 1]?.[1];
  const workingRing = closed ? ring.slice(0, -1) : ring.slice();
  const stride = Math.max(1, Math.ceil(workingRing.length / maxPoints));
  const simplified = workingRing.filter((_, index) => index === 0 || index === workingRing.length - 1 || index % stride === 0);

  if (closed) {
    simplified.push(simplified[0]);
  }

  return simplified;
}

function simplifyGeometry(geometry = null) {
  if (!geometry?.type || !geometry?.coordinates) return geometry;

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring, index) => simplifyRing(ring, index === 0 ? 250 : 100))
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring, index) => simplifyRing(ring, index === 0 ? 250 : 100))
      )
    };
  }

  return geometry;
}

function sanitizeDistrictLabel(value, fallback = '') {
  if (value === null || value === undefined) return fallback;

  const cleaned = String(value)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function compactDistrict(district = {}, index = 0) {
  const props = district.properties || {};

  return {
    id: district.id || index,
    name: sanitizeDistrictLabel(
      district.name || props.ADM2_EN || props.NAME_2 || props.NAME || props.name || props.district,
      `Selected Area ${index + 1}`
    ),
    geometry: simplifyGeometry(district.geometry || null),
    bounds: district.bounds || null,
    properties: {
      ADM2_EN: props.ADM2_EN,
      NAME_2: props.NAME_2,
      NAME: props.NAME,
      name: props.name,
      district: props.district,
      population: props.population,
      POP: props.POP
    }
  };
}

function compactFacility(facility = {}) {
  const compact = {
    name: facility.name,
    latitude: facility.latitude,
    longitude: facility.longitude,
    district: facility.district,
    admin2: facility.admin2,
    region: facility.region,
    admin1: facility.admin1
  };

  FACILITY_TYPE_FIELDS.forEach((field) => {
    if (facility[field] !== undefined) compact[field] = facility[field];
  });

  POPULATION_FIELDS.forEach((field) => {
    if (facility[field] !== undefined) compact[field] = facility[field];
  });

  return compact;
}

function compactImpactRecord(record = {}) {
  return {
    facility: compactFacility(record.facility || {}),
    impacts: Array.isArray(record.impacts)
      ? record.impacts.map((impact) => ({
          distance: impact.distance,
          disaster: {
            eventType: impact.disaster?.eventType,
            eventName: impact.disaster?.eventName,
            title: impact.disaster?.title,
            alertLevel: impact.disaster?.alertLevel,
            severity: impact.disaster?.severity,
            source: impact.disaster?.source
          }
        }))
      : []
  };
}

function compactOsmData(osmData = null) {
  const features = osmData?.features || [];
  const filteredFeatures = features
    .filter((feature) => {
      const category = String(feature.properties?.category || '').toLowerCase();
      return category === 'hospital' || category === 'clinic';
    })
    .map((feature) => ({
      geometry: feature.geometry,
      properties: {
        category: feature.properties?.category
      }
    }));

  return {
    type: 'FeatureCollection',
    features: filteredFeatures
  };
}

function SummaryCard({ label, value, tone }) {
  return (
    <div style={{
      background: 'white',
      border: `1px solid ${tone}22`,
      borderLeft: `4px solid ${tone}`,
      borderRadius: '10px',
      padding: '14px 16px',
      minWidth: '150px'
    }}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', color: '#0f172a', fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}

function SectionTab({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        background: active ? 'var(--aidstack-navy)' : '#e2e8f0',
        color: active ? 'white' : '#334155',
        borderRadius: '999px',
        padding: '8px 14px',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer'
      }}
    >
      {label} ({count})
    </button>
  );
}

function getDecisionLabel(score) {
  if (score >= 75) return 'Deploy';
  if (score >= 55) return 'Pre-position';
  if (score >= 35) return 'Prepare';
  return 'Monitor';
}

function getDistrictDecision(row) {
  if ((row?.districtRiskLevel === 'very-high' && (row?.acledCount || 0) > 0) || (row?.districtRiskScore || 0) >= 65) {
    return 'Delay';
  }
  return getDecisionLabel(row?.priorityScore || 0);
}

function getAdminLevelId(row) {
  return row?.district || row?.adminLevel || `admin-level-${row?.rank || 0}`;
}

function renderLinkedText(text) {
  if (!text) return null;

  const parts = [];
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = markdownLinkRegex.exec(text)) !== null) {
    const [fullMatch, label, url] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    parts.push(
      <a
        key={`${url}-${start}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#1d4ed8', textDecoration: 'underline' }}
      >
        {label}
      </a>
    );

    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function DistrictCardCompact({ row, onExpand, onViewFacility }) {
  const levelStyle = levelColors[row.priorityLevel] || levelColors.Monitor;
  const decisionLabel = getDistrictDecision(row);

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${levelStyle.text}`,
        borderRadius: '14px',
        padding: '18px 20px',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onClick={onExpand}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#64748b'
            }}>
              #{row.rank}
            </span>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 700 }}>
              {row.district}
            </h3>
            <DecisionBadge label={decisionLabel} />
          </div>

          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            color: levelStyle.text,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{levelStyle.icon}</span>
            <span>{row.priorityLevel} Priority: {row.priorityScore}/100</span>
          </div>

          <div style={{
            fontSize: '15px',
            color: '#334155',
            lineHeight: 1.6,
            marginBottom: '12px',
            fontWeight: 500
          }}>
            {renderLinkedText(row.soWhat)}
          </div>

          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
              RECOMMENDED ACTION
            </div>
            <div style={{ fontSize: '14px', color: '#0f172a', lineHeight: 1.5 }}>
              {renderLinkedText(row.recommendedAction)}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#64748b' }}>
            <span><strong>{row.facilityCount}</strong> facilities</span>
            <span><strong>{row.acledCount || 0}</strong> security events</span>
            <span><strong>{row.disasterCount || 0}</strong> GDACS</span>
            {row.populationEstimate && (
              <span><strong>{row.populationEstimate.toLocaleString()}</strong> population</span>
            )}
          </div>
        </div>

        <div style={{
          fontSize: '24px',
          color: '#cbd5e1',
          fontWeight: 700
        }}>
          ▶
        </div>
      </div>
    </div>
  );
}

function DistrictCardExpanded({ row, onCollapse, onViewFacility }) {
  const levelStyle = levelColors[row.priorityLevel] || levelColors.Monitor;
  const decisionLabel = getDistrictDecision(row);

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderLeft: `4px solid ${levelStyle.text}`,
        borderRadius: '14px',
        padding: '22px 24px',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#64748b'
            }}>
              #{row.rank}
            </span>
            <h3 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: 700 }}>
              {row.district}
            </h3>
            <DecisionBadge label={decisionLabel} />
          </div>

          <div style={{
            fontSize: '32px',
            fontWeight: 800,
            color: levelStyle.text,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span>{levelStyle.icon}</span>
            <span>{row.priorityLevel} Priority</span>
          </div>

          <RiskBar
            value={row.priorityScore}
            label="Risk Score"
            sublabel={`${row.priorityScore}/100`}
          />
        </div>

        <button
          type="button"
          onClick={onCollapse}
          style={{
            border: '1px solid #cbd5e1',
            background: 'white',
            color: '#334155',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700
          }}
        >
          Collapse
        </button>
      </div>

      <div style={{
        background: `${levelStyle.bg}`,
        border: `1px solid ${levelStyle.text}33`,
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', color: levelStyle.text, fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          WHY THIS DECISION
        </div>
        <div style={{ fontSize: '15px', color: '#0f172a', lineHeight: 1.7 }}>
          {renderLinkedText(row.soWhat)}
        </div>
      </div>

      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ✓ RECOMMENDED ACTION
        </div>
        <div style={{ fontSize: '15px', color: '#0f172a', lineHeight: 1.7, fontWeight: 600 }}>
          {renderLinkedText(row.recommendedAction)}
        </div>
      </div>

      {row.board?.summary?.confidence && (
        <div style={{
          background: row.keyGaps?.length > 0 ? '#fff7ed' : '#dcfce7',
          border: `1px solid ${row.keyGaps?.length > 0 ? '#fed7aa' : '#bbf7d0'}`,
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠️ CONFIDENCE: {row.projectedConfidence || 'MEDIUM'}
          </div>
          {row.keyGaps?.length > 0 && (
            <div style={{ fontSize: '14px', color: '#9a3412', lineHeight: 1.6 }}>
              <strong>Missing data:</strong> {row.keyGaps.join(' • ')}
            </div>
          )}
        </div>
      )}

      <details style={{ marginBottom: '20px' }}>
        <summary style={{
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 700,
          color: '#475569',
          padding: '12px',
          background: '#f8fafc',
          borderRadius: '8px',
          userSelect: 'none'
        }}>
          ▸ View detailed breakdown
        </summary>
        <div style={{
          marginTop: '12px',
          padding: '16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          {typeof row.projectedHazardScore === 'number' && (
            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                PROJECTED HAZARD
              </div>
              <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                {row.projectedHazardLabel || row.projectedHazardType} {row.projectedHazardLevel} ({row.projectedHazardScore}/100)
              </div>
              {row.projectedHazardSummary && (
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', lineHeight: 1.6 }}>
                  {renderLinkedText(row.projectedHazardSummary)}
                </div>
              )}
            </div>
          )}

          {(typeof row.projectedFloodScore === 'number' || typeof row.projectedDroughtScore === 'number' || typeof row.projectedHeatScore === 'number') && (
            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                HAZARD BREAKDOWN
              </div>
              <div style={{ fontSize: '13px', color: '#334155', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {typeof row.projectedFloodScore === 'number' && (
                  <span>Flood: <strong>{row.projectedFloodScore}/100</strong></span>
                )}
                {typeof row.projectedDroughtScore === 'number' && (
                  <span>Drought: <strong>{row.projectedDroughtScore}/100</strong></span>
                )}
                {typeof row.projectedHeatScore === 'number' && (
                  <span>Heat: <strong>{row.projectedHeatScore}/100</strong></span>
                )}
              </div>
            </div>
          )}

          {row.projectedTopDrivers?.length > 0 && (
            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                TOP RISK DRIVERS
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                {row.projectedTopDrivers.map((driver) =>
                  `${driver.label}${driver.value !== null && driver.value !== undefined ? ` (${driver.value}${driver.unit ? ` ${driver.unit}` : ''})` : ''}`
                ).join(' • ')}
              </div>
            </div>
          )}

          {row.leadershipNote && (
            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                WHAT COULD CHANGE THIS
              </div>
              <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                {renderLinkedText(row.leadershipNote)}
              </div>
            </div>
          )}

          {row.recentContext && (
            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                RECENT CONTEXT
              </div>
              <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                {renderLinkedText(row.recentContext)}
              </div>
              {row.recentSourceUrl && (
                <div style={{ marginTop: '6px' }}>
                  <a
                    href={row.recentSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1d4ed8', textDecoration: 'underline', fontSize: '13px' }}
                  >
                    Source: {row.recentSourceLabel || row.recentSourceUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          <div style={{
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            fontSize: '13px'
          }}>
            <div><strong>Facilities:</strong> {row.facilityCount}</div>
            <div><strong>Population:</strong> {row.populationEstimate ? row.populationEstimate.toLocaleString() : 'Unknown'}</div>
            <div><strong>GDACS:</strong> {row.disasterCount ?? 0}</div>
            <div><strong>ACLED:</strong> {row.acledCount ?? 0}</div>
            <div><strong>OSM Hospitals:</strong> {row.hospitals ?? 0}</div>
            <div><strong>OSM Clinics:</strong> {row.clinics ?? 0}</div>
            {row.ageGroups?.under5 && (
              <div><strong>Under 5:</strong> {row.ageGroups.under5.toLocaleString()}</div>
            )}
            {row.ageGroups?.age60plus && (
              <div><strong>60+:</strong> {row.ageGroups.age60plus.toLocaleString()}</div>
            )}
          </div>
        </div>
      </details>

      {row.analysisSource?.toLowerCase?.().includes('ai') && (
        <div style={{
          marginTop: '16px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '8px',
          padding: '10px 12px',
          color: '#9a3412',
          fontSize: '12px',
          lineHeight: 1.5
        }}>
          <strong>AI-generated:</strong> This analysis uses AI synthesis. Verify against loaded data and sources before acting.
        </div>
      )}
    </div>
  );
}

function getSummaryCards(board, facilities, impactedFacilities) {
  if (!board?.summary?.hasFacilityData) {
    return [
      { label: 'Admin Areas', value: board?.summary?.selectedAreaCount || 0, tone: '#1d4ed8' },
      { label: 'Urgent Areas', value: board?.districtRows?.filter((row) => row.priorityLevel === 'Urgent').length || 0, tone: '#dc2626' },
      { label: 'High Areas', value: board?.districtRows?.filter((row) => row.priorityLevel === 'High').length || 0, tone: '#ea580c' },
      { label: 'Facility Data', value: 'Not Loaded', tone: '#0f766e' }
    ];
  }

  return [
    { label: 'Facilities', value: board?.summary?.totalFacilities || facilities.length, tone: '#1d4ed8' },
    { label: 'Urgent', value: board?.summary?.urgentFacilities || 0, tone: '#dc2626' },
    { label: 'High', value: board?.summary?.highFacilities || 0, tone: '#ea580c' },
    { label: 'Impacted', value: board?.summary?.impactedFacilities || impactedFacilities.length, tone: '#0f766e' }
  ];
}

export default function PrioritizationBoardV2({
  isOpen,
  onClose,
  facilities = [],
  impactedFacilities = [],
  disasters = [],
  acledData = [],
  districts = [],
  selectedDistricts = [],
  worldPopData = {},
  osmData = null,
  operationType = 'general',
  enabledEvidenceLayers = [],
  onBoardLoaded = null,
  onViewFacility = null
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [board, setBoard] = useState(null);
  const [activeView, setActiveView] = useState('districts');
  const [levelFilter, setLevelFilter] = useState('All');
  const [workflowState, setWorkflowState] = useState({});
  const [expandedAdminLevels, setExpandedAdminLevels] = useState({});

  const scopedFacilities = useMemo(
    () => (selectedDistricts.length > 0 ? filterFacilitiesToDistricts(facilities, selectedDistricts) : facilities),
    [facilities, selectedDistricts]
  );
  const scopedImpactedFacilities = useMemo(
    () => (selectedDistricts.length > 0 ? filterImpactedFacilitiesToDistricts(impactedFacilities, selectedDistricts) : impactedFacilities),
    [impactedFacilities, selectedDistricts]
  );
  const scopedDisasters = useMemo(
    () => (selectedDistricts.length > 0 ? filterItemsToDistricts(disasters, selectedDistricts) : disasters),
    [disasters, selectedDistricts]
  );
  const scopedAcledData = useMemo(
    () => (selectedDistricts.length > 0 ? filterItemsToDistricts(acledData, selectedDistricts) : acledData),
    [acledData, selectedDistricts]
  );
  const scopedWorldPop = useMemo(
    () => getScopedWorldPopData(worldPopData, selectedDistricts),
    [worldPopData, selectedDistricts]
  );

  useEffect(() => {
    setWorkflowState(loadWorkflowState());
  }, []);

  useEffect(() => {
    saveWorkflowState(workflowState);
  }, [workflowState]);

  useEffect(() => {
    setActiveView(scopedFacilities.length > 0 ? 'facilities' : 'districts');
  }, [scopedFacilities.length]);

  const loadBoard = async () => {
    if (!isOpen) return;
    if (selectedDistricts.length === 0) {
      setBoard(null);
      setActiveView('districts');
      setError('Select one or more admin areas before running the prioritization board.');
      if (onBoardLoaded) {
        onBoardLoaded(null);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const compactSelectedDistricts = selectedDistricts.map(compactDistrict);
      const compactScopedWorldPop = getScopedWorldPopData(scopedWorldPop, compactSelectedDistricts);
      const districtHazardAnalysisResponse = await fetch('/api/district-hazard-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districts: compactSelectedDistricts,
          facilities: scopedFacilities.map(compactFacility),
          disasters: scopedDisasters.map((item) => ({
            eventType: item.eventType,
            eventName: item.eventName,
            title: item.title,
            latitude: item.latitude,
            longitude: item.longitude,
            alertLevel: item.alertLevel,
            severity: item.severity,
            source: item.source
          })),
          acledData: scopedAcledData.map((item) => ({
            event_type: item.event_type,
            latitude: item.latitude,
            longitude: item.longitude,
            fatalities: item.fatalities
          })),
          worldPopData: compactScopedWorldPop,
          enabledEvidenceLayers,
          days: 7
        })
      });
      const districtHazardAnalysis = await parseResponse(districtHazardAnalysisResponse, 'District hazard analysis');
      const localBoard = buildPrioritizationBoard({
        facilities: scopedFacilities.map(compactFacility),
        impactedFacilities: scopedImpactedFacilities.map(compactImpactRecord),
        disasters: scopedDisasters.map((item) => ({
          eventType: item.eventType,
          eventName: item.eventName,
          title: item.title,
          latitude: item.latitude,
          longitude: item.longitude,
          alertLevel: item.alertLevel,
          severity: item.severity,
          source: item.source
        })),
        acledData: scopedAcledData.map((item) => ({
          event_type: item.event_type,
          latitude: item.latitude,
          longitude: item.longitude,
          fatalities: item.fatalities
        })),
        districts: [],
        selectedDistricts: compactSelectedDistricts,
        worldPopData: compactScopedWorldPop,
        osmData: compactOsmData(osmData),
        operationType,
        districtHazardAnalysis,
        enabledEvidenceLayers
      });
      const requestPayload = {
        board: localBoard,
        operationType,
        selectedDistricts: compactSelectedDistricts.map((district) => ({
          id: district.id,
          name: district.name
        })),
        facilities: scopedFacilities.length > 0 ? [{ loaded: true }] : []
      };
      const payloadJson = JSON.stringify(requestPayload);

      console.log('Prioritization board payload summary:', {
        districtRows: localBoard.districtRows?.length || 0,
        facilityRows: localBoard.facilityRows?.length || 0,
        selectedDistricts: requestPayload.selectedDistricts.length,
        bytes: payloadJson.length
      });

      const response = await fetch('/api/prioritization-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadJson
      });

      const data = await parseResponse(response, 'Prioritization board');
      setBoard(data);
      if (onBoardLoaded) {
        onBoardLoaded(data);
      }
    } catch (err) {
      console.error('Error loading prioritization board:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBoard();
    }
  }, [
    isOpen,
    selectedDistricts.length,
    selectedDistricts.map((district) => district.id).join('|'),
    scopedFacilities.length,
    scopedImpactedFacilities.length,
    scopedDisasters.length,
    scopedAcledData.length,
    Object.keys(scopedWorldPop || {}).length,
    osmData?.features?.length || 0,
    operationType,
    enabledEvidenceLayers.join('|')
  ]);

  useEffect(() => {
    if (selectedDistricts.length > 0) return;

    setBoard(null);
    setActiveView('districts');
    setExpandedAdminLevels({});
    if (isOpen) {
      setError('Select one or more admin areas before running the prioritization board.');
    }
  }, [selectedDistricts.length, isOpen]);

  const visibleDistricts = useMemo(() => {
    const rows = board?.districtRows || [];
    return rows.filter((row) => levelFilter === 'All' || row.priorityLevel === levelFilter);
  }, [board, levelFilter]);

  const summaryCards = useMemo(
    () => getSummaryCards(board, scopedFacilities, scopedImpactedFacilities),
    [board, scopedFacilities, scopedImpactedFacilities]
  );

  const toggleAdminLevel = (id) => {
    setExpandedAdminLevels((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.48)',
          zIndex: 4000
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(1180px, 94vw)',
          height: 'min(86vh, 900px)',
          background: '#f8fafc',
          borderRadius: '18px',
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
          zIndex: 4001,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8, fontWeight: 700 }}>
              Decision Support
            </div>
            <h2 style={{ margin: '6px 0 0', fontSize: '28px', fontFamily: "'Space Grotesk', sans-serif" }}>
              Prioritization Board V2
            </h2>
            <div style={{ marginTop: '6px', fontSize: '14px', opacity: 0.88 }}>
              Clear, actionable priorities for the next 24-72 hours
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={loadBoard}
              disabled={loading || selectedDistricts.length === 0}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                borderRadius: '8px',
                padding: '10px 14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                fontSize: '24px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: '18px 24px 8px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <span style={{
              background: '#e2e8f0',
              color: '#334155',
              borderRadius: '999px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 700
            }}>
              Scope: {selectedDistricts.length} {selectedDistricts.length === 1 ? 'admin area' : 'admin areas'}
            </span>
            {board?.summary?.confidence?.availableSignals?.map((signal) => (
              <span
                key={signal}
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                ✓ {signal}
              </span>
            ))}
            {board?.summary?.confidence?.missingSignals?.map((signal) => (
              <span
                key={signal}
                style={{
                  background: '#f1f5f9',
                  color: '#64748b',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                Missing: {signal}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#475569', fontWeight: 700 }}>Filter</span>
              {['All', 'Urgent', 'High', 'Medium', 'Monitor'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLevelFilter(level)}
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    padding: '7px 12px',
                    background: levelFilter === level ? 'var(--aidstack-orange)' : '#e2e8f0',
                    color: levelFilter === level ? 'white' : '#334155',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '8px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
              Building ranked operational priorities...
            </div>
          )}

          {!loading && selectedDistricts.length === 0 && (
            <div style={{
              background: 'white',
              border: '1px solid #cbd5e1',
              borderLeft: '4px solid #f59e0b',
              borderRadius: '10px',
              padding: '18px',
              color: '#475569'
            }}>
              Select one or more admin areas before running the prioritization board.
            </div>
          )}

          {!loading && error && (
            <div style={{
              background: '#fff',
              border: '1px solid #fecaca',
              borderLeft: '4px solid #ef4444',
              borderRadius: '10px',
              padding: '16px',
              color: '#7f1d1d'
            }}>
              {error}
            </div>
          )}

          {!loading && !error && visibleDistricts.length > 0 && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {visibleDistricts.map((row) => {
                const adminLevelId = getAdminLevelId(row);
                const isExpanded = !!expandedAdminLevels[adminLevelId];

                return isExpanded ? (
                  <DistrictCardExpanded
                    key={adminLevelId}
                    row={row}
                    onCollapse={() => toggleAdminLevel(adminLevelId)}
                    onViewFacility={onViewFacility}
                  />
                ) : (
                  <DistrictCardCompact
                    key={adminLevelId}
                    row={row}
                    onExpand={() => toggleAdminLevel(adminLevelId)}
                    onViewFacility={onViewFacility}
                  />
                );
              })}
            </div>
          )}

          {!loading && !error && visibleDistricts.length === 0 && selectedDistricts.length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', color: '#64748b' }}>
              No admin levels match the current filter.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
