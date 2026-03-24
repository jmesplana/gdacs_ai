import { useEffect, useMemo, useState } from 'react';

const LOCAL_WORKFLOW_KEY = 'gdacs_prioritization_workflow';

const levelColors = {
  Urgent: { bg: '#fee2e2', text: '#991b1b' },
  High: { bg: '#ffedd5', text: '#9a3412' },
  Medium: { bg: '#fef3c7', text: '#92400e' },
  Monitor: { bg: '#e0f2fe', text: '#0c4a6e' }
};

const statusOptions = ['Unassigned', 'In Review', 'In Progress', 'Done'];

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

function getScoreMeaning(score) {
  if (score >= 75) return 'Immediate operational attention';
  if (score >= 55) return 'High near-term priority';
  if (score >= 35) return 'Moderate priority';
  return 'Low current priority';
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

export default function PrioritizationBoard({
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
  onViewFacility = null
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [board, setBoard] = useState(null);
  const [activeView, setActiveView] = useState('districts');
  const [levelFilter, setLevelFilter] = useState('All');
  const [workflowState, setWorkflowState] = useState({});
  const [expandedAdminLevels, setExpandedAdminLevels] = useState({});

  useEffect(() => {
    setWorkflowState(loadWorkflowState());
  }, []);

  useEffect(() => {
    saveWorkflowState(workflowState);
  }, [workflowState]);

  useEffect(() => {
    setActiveView(facilities.length > 0 ? 'facilities' : 'districts');
  }, [facilities.length]);

  useEffect(() => {
    if (!board?.districtRows?.length) return;

    setExpandedAdminLevels((prev) => {
      const next = {};
      board.districtRows.forEach((row, index) => {
        const id = getAdminLevelId(row);
        next[id] = Object.prototype.hasOwnProperty.call(prev, id) ? prev[id] : index === 0;
      });
      return next;
    });
  }, [board]);

  const loadBoard = async () => {
    if (!isOpen || selectedDistricts.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/prioritization-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilities,
          impactedFacilities,
          disasters,
          acledData,
          districts,
          selectedDistricts,
          worldPopData,
          osmData,
          operationType
        })
      });

      const data = await parseResponse(response, 'Prioritization board');
      setBoard(data);
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
  }, [isOpen]);

  const visibleFacilities = useMemo(() => {
    const rows = board?.facilityRows || [];
    return rows.filter((row) => levelFilter === 'All' || row.priorityLevel === levelFilter);
  }, [board, levelFilter]);

  const visibleDistricts = useMemo(() => {
    const rows = board?.districtRows || [];
    return rows.filter((row) => levelFilter === 'All' || row.priorityLevel === levelFilter);
  }, [board, levelFilter]);
  const summaryCards = useMemo(
    () => getSummaryCards(board, facilities, impactedFacilities),
    [board, facilities, impactedFacilities]
  );

  const areAllAdminLevelsExpanded = useMemo(() => {
    if (!visibleDistricts.length) return false;
    return visibleDistricts.every((row) => expandedAdminLevels[getAdminLevelId(row)]);
  }, [visibleDistricts, expandedAdminLevels]);

  const updateWorkflow = (id, patch) => {
    setWorkflowState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch
      }
    }));
  };

  const toggleAdminLevel = (id) => {
    setExpandedAdminLevels((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const setAllAdminLevelsExpanded = (expanded) => {
    setExpandedAdminLevels((prev) => {
      const next = { ...prev };
      visibleDistricts.forEach((row) => {
        next[getAdminLevelId(row)] = expanded;
      });
      return next;
    });
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
              Prioritization Board
            </h2>
            <div style={{ marginTop: '6px', fontSize: '14px', opacity: 0.88 }}>
              Ranked actions for the next 24-72 hours
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
                {signal}
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
            {board?.summary?.aiEnhanced && (
              <span style={{
                background: '#ede9fe',
                color: '#5b21b6',
                borderRadius: '999px',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700
              }}>
                AI synthesis + recent web context
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <SectionTab active={activeView === 'facilities'} onClick={() => setActiveView('facilities')} label="Facilities" count={board?.facilityRows?.length || facilities.length} />
              <SectionTab active={activeView === 'districts'} onClick={() => setActiveView('districts')} label="Admin Levels" count={board?.districtRows?.length || 0} />
            </div>

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

          {!loading && !error && activeView === 'facilities' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              {visibleFacilities.length === 0 && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', color: '#64748b' }}>
                  {board?.summary?.hasFacilityData
                    ? 'No facilities match the current filter.'
                    : 'No facility dataset is loaded for this area. Switch to the Admin Levels view for area-based prioritization.'}
                </div>
              )}

              {visibleFacilities.map((row) => {
                const workflow = workflowState[row.id] || {};
                const levelStyle = levelColors[row.priorityLevel] || levelColors.Monitor;

                return (
                  <div
                    key={row.id}
                    style={{
                      background: 'white',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      padding: '16px 18px',
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <span style={{
                            width: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '999px',
                            background: '#e2e8f0',
                            color: '#0f172a',
                            fontWeight: 800
                          }}>
                            {row.rank}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                            {row.facility?.name || 'Unnamed facility'}
                          </h3>
                          <span style={{
                            background: levelStyle.bg,
                            color: levelStyle.text,
                            borderRadius: '999px',
                            padding: '6px 10px',
                            fontWeight: 800,
                            fontSize: '12px'
                          }}>
                            {row.priorityLevel}
                          </span>
                          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 700 }}>
                            Score {row.priorityScore}/100
                          </span>
                        </div>

                        <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
                          {getScoreMeaning(row.priorityScore)}
                        </div>

                        <div style={{ color: '#334155', fontSize: '14px', lineHeight: 1.55, marginBottom: '10px' }}>
                          <strong>Next action:</strong> {row.recommendedAction}
                        </div>

                        <div style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
                          {row.rationale}
                        </div>
                      </div>

                      <div style={{ minWidth: '240px', display: 'grid', gap: '10px' }}>
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '12px'
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', fontSize: '13px' }}>
                            <div><strong>Admin level:</strong> {row.district}</div>
                            <div><strong>Type:</strong> {row.facilityType}</div>
                            <div><strong>Threats:</strong> {row.impactSummary.impactCount}</div>
                            <div><strong>ACLED:</strong> {row.securitySummary.nearbyCount}</div>
                            <div><strong>Nearest:</strong> {row.impactSummary.nearestDistance !== null ? `${row.impactSummary.nearestDistance.toFixed(1)} km` : 'None'}</div>
                            <div><strong>Population:</strong> {row.populationEstimate ? row.populationEstimate.toLocaleString() : 'Unknown'}</div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: '8px' }}>
                          <input
                            type="text"
                            value={workflow.owner || ''}
                            placeholder="Owner"
                            onChange={(e) => updateWorkflow(row.id, { owner: e.target.value })}
                            style={{
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              fontSize: '13px'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                              value={workflow.status || 'Unassigned'}
                              onChange={(e) => updateWorkflow(row.id, { status: e.target.value })}
                              style={{
                                flex: 1,
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '13px',
                                background: 'white'
                              }}
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>

                            {onViewFacility && (
                              <button
                                type="button"
                                onClick={() => onViewFacility(row.facility)}
                                style={{
                                  border: 'none',
                                  background: 'var(--aidstack-navy)',
                                  color: 'white',
                                  borderRadius: '8px',
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: 700
                                }}
                              >
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && activeView === 'districts' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {visibleDistricts.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setAllAdminLevelsExpanded(!areAllAdminLevelsExpanded)}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: 'white',
                      color: '#334155',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700
                    }}
                  >
                    {areAllAdminLevelsExpanded ? 'Collapse all admin levels' : 'Expand all admin levels'}
                  </button>
                </div>
              )}

              {visibleDistricts.length === 0 && (
                <div style={{ background: 'white', borderRadius: '12px', padding: '24px', color: '#64748b' }}>
                  No admin levels match the current filter.
                </div>
              )}

              {visibleDistricts.map((row) => {
                const levelStyle = levelColors[row.priorityLevel] || levelColors.Monitor;
                const adminLevelId = getAdminLevelId(row);
                const isExpanded = !!expandedAdminLevels[adminLevelId];

                return (
                  <div
                    key={adminLevelId}
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '16px 18px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <span style={{
                            width: '32px',
                            height: '32px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '999px',
                            background: '#e2e8f0',
                            color: '#0f172a',
                            fontWeight: 800
                          }}>
                            {row.rank}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{row.district}</h3>
                          <span style={{
                            background: levelStyle.bg,
                            color: levelStyle.text,
                            borderRadius: '999px',
                            padding: '6px 10px',
                            fontWeight: 800,
                            fontSize: '12px'
                          }}>
                            {row.priorityLevel}
                          </span>
                          <span style={{ fontSize: '13px', color: '#475569', fontWeight: 700 }}>
                            Score {row.priorityScore}/100
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAdminLevel(adminLevelId)}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: 'white',
                              color: '#334155',
                              borderRadius: '999px',
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        </div>

                        <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
                          {getScoreMeaning(row.priorityScore)}
                        </div>

                        <div style={{ color: '#334155', fontSize: '14px', lineHeight: 1.55, marginBottom: isExpanded ? '10px' : 0 }}>
                          <strong>Posture:</strong> {row.posture}
                        </div>

                        {!isExpanded && (
                          <div style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
                            <strong>Next step:</strong> {renderLinkedText(row.recommendedAction || row.actions.join(' • '))}
                          </div>
                        )}

                        {isExpanded && (
                          <>
                            <div style={{ color: '#334155', fontSize: '14px', lineHeight: 1.6, marginBottom: '10px' }}>
                              <strong>So what:</strong> {renderLinkedText(row.soWhat)}
                            </div>

                            <div style={{ color: '#334155', fontSize: '14px', lineHeight: 1.55 }}>
                              <strong>Recommended action:</strong> {renderLinkedText(row.recommendedAction || row.actions.join(' • '))}
                            </div>

                            {row.keyGaps?.length > 0 && (
                              <div style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, marginTop: '10px' }}>
                                <strong>Key gaps:</strong> {row.keyGaps.join(' | ')}
                              </div>
                            )}

                            {row.leadershipNote && (
                              <div style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6, marginTop: '10px' }}>
                                <strong>Leadership note:</strong> {renderLinkedText(row.leadershipNote)}
                              </div>
                            )}

                            {row.recentContext && (
                              <div style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6, marginTop: '10px' }}>
                                <strong>Recent context:</strong> {renderLinkedText(row.recentContext)}
                              </div>
                            )}

                            {row.recentSourceUrl && (
                              <div style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6, marginTop: '6px' }}>
                                <strong>Source:</strong>{' '}
                                <a
                                  href={row.recentSourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#1d4ed8', textDecoration: 'underline' }}
                                >
                                  {row.recentSourceLabel || row.recentSourceUrl}
                                </a>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))',
                        gap: '8px 16px',
                        minWidth: '340px',
                        fontSize: '13px',
                        color: '#334155'
                      }}>
                        <div><strong>Facilities:</strong> {row.facilityCount}</div>
                        <div><strong>Urgent:</strong> {row.urgentCount}</div>
                        <div><strong>Highest score:</strong> {row.highestPriorityScore}</div>
                        <div><strong>Population:</strong> {row.populationEstimate ? row.populationEstimate.toLocaleString() : 'Unknown'}</div>
                        <div><strong>Under 5:</strong> {row.ageGroups?.under5 ? row.ageGroups.under5.toLocaleString() : 'Unknown'}</div>
                        <div><strong>60+:</strong> {row.ageGroups?.age60plus ? row.ageGroups.age60plus.toLocaleString() : 'Unknown'}</div>
                        <div><strong>Hospitals:</strong> {row.hospitals ?? 0}</div>
                        <div><strong>Clinics:</strong> {row.clinics ?? 0}</div>
                        <div><strong>GDACS:</strong> {row.disasterCount ?? 0}</div>
                        <div><strong>ACLED:</strong> {row.acledCount ?? 0}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
