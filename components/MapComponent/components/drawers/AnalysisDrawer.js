import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getDistance } from 'geolib';
import TimestampBadge from '../TimestampBadge';
import { useToast } from '../../../Toast';

const provenanceBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  fontFamily: "'Inter', sans-serif"
};

const ProvenanceBadge = ({ label, tone = '#475569', background = '#f1f5f9' }) => (
  <span style={{ ...provenanceBadgeStyle, color: tone, backgroundColor: background }}>
    {label}
  </span>
);

const FACILITY_OSM_RADIUS_KM = 50;
const FACILITY_ACLED_RADIUS_KM = 150;
const MAX_ACLED_EVENTS_PER_FACILITY = 500;

const getFacilityCoords = (facility) => ({
  latitude: Number(facility?.lat ?? facility?.latitude),
  longitude: Number(facility?.lng ?? facility?.longitude)
});

const isValidCoords = ({ latitude, longitude }) =>
  Number.isFinite(latitude) && Number.isFinite(longitude);

const buildScopedOsmData = (facility, osmData) => {
  if (!osmData?.features?.length) return null;

  const facilityCoords = getFacilityCoords(facility);
  if (!isValidCoords(facilityCoords)) return null;

  const features = osmData.features.filter((feature) => {
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) {
      return false;
    }

    const [longitude, latitude] = feature.geometry.coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

    const distanceKm = getDistance(facilityCoords, { latitude, longitude }) / 1000;
    return distanceKm <= FACILITY_OSM_RADIUS_KM;
  }).map((feature) => ({
    type: 'Feature',
    geometry: feature.geometry,
    properties: {
      category: feature.properties?.category,
      name: feature.properties?.name,
      osmId: feature.properties?.osmId,
      tags: feature.properties?.tags
    }
  }));

  return {
    type: 'FeatureCollection',
    features
  };
};

const buildScopedAcledData = (facility, acledData = []) => {
  if (!Array.isArray(acledData) || acledData.length === 0) return [];

  const facilityCoords = getFacilityCoords(facility);
  if (!isValidCoords(facilityCoords)) return [];

  return acledData
    .filter((event) => Number.isFinite(Number(event?.latitude)) && Number.isFinite(Number(event?.longitude)))
    .map((event) => ({
      ...event,
      _distanceKm: getDistance(facilityCoords, {
        latitude: Number(event.latitude),
        longitude: Number(event.longitude)
      }) / 1000
    }))
    .filter((event) => event._distanceKm <= FACILITY_ACLED_RADIUS_KM)
    .sort((a, b) => {
      const dateA = new Date(a.event_date || 0).getTime();
      const dateB = new Date(b.event_date || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, MAX_ACLED_EVENTS_PER_FACILITY)
    .map(({ _distanceKm, ...event }) => event);
};

const buildAssessmentConfidence = ({ impacts = [], acledEnabled, acledData = [], osmData, operationType, operationViability }) => {
  const signals = [
    { label: 'Facility impact data', available: impacts.length > 0 },
    { label: 'Security context', available: acledEnabled && acledData.length > 0 },
    { label: 'OSM infrastructure', available: Boolean(osmData?.features?.length) },
    { label: 'Operation type', available: Boolean(operationType) },
    { label: 'Viability assessment', available: Boolean(operationViability) }
  ];

  const availableCount = signals.filter(signal => signal.available).length;
  const totalCount = signals.length;
  const ratio = totalCount > 0 ? availableCount / totalCount : 0;

  let level = 'Low';
  if (ratio >= 0.8) level = 'High';
  else if (ratio >= 0.5) level = 'Medium';

  return {
    level,
    availableCount,
    totalCount,
    missingSignals: signals.filter(signal => !signal.available).map(signal => signal.label)
  };
};

const AnalysisDrawer = ({
  isOpen,
  onClose,
  selectedFacility,
  analysisData,
  analysisLoading,
  onViewRecommendations,
  impactedFacilities = [],
  isAIGenerated,
  timestamp,
  onRefresh,
  recommendations = null,
  recommendationsLoading = false,
  recommendationsAIGenerated = false,
  recommendationsTimestamp = null,
  recommendationsFacilityKey = null,
  acledData = [],
  acledEnabled = false,
  operationType = 'general',
  osmData = null
}) => {
  const { addToast } = useToast();
  const [progressMsg, setProgressMsg] = useState('');
  useEffect(() => {
    if (!analysisLoading) { setProgressMsg(''); return; }
    const msgs = [
      'Fetching disaster data...',
      'Assessing facility exposure...',
      'Running AI analysis...',
      'Compiling risk profile...',
      'Almost done...'
    ];
    let i = 0;
    setProgressMsg(msgs[0]);
    const interval = setInterval(() => {
      i = (i + 1) % msgs.length;
      setProgressMsg(msgs[i]);
    }, 4000);
    return () => clearInterval(interval);
  }, [analysisLoading]);
  const [operationViability, setOperationViability] = useState(null);
  const [viabilityLoading, setViabilityLoading] = useState(false);
  const [showViability, setShowViability] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    setShowRecommendations(false);
  }, [selectedFacility?.name]);

  const parseApiResponse = async (response, label) => {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!response.ok) {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`${label} failed with status ${response.status}${preview ? `: ${preview}` : ''}`);
    }

    if (!contentType.includes('application/json')) {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`${label} returned ${contentType || 'non-JSON content'}${preview ? `: ${preview}` : ''}`);
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`${label} returned invalid JSON${preview ? `: ${preview}` : ''}`);
    }
  };

  const formatRecommendationContent = (content) => {
    if (Array.isArray(content)) {
      return (
        <ul style={{ paddingLeft: '18px', margin: '8px 0' }}>
          {content.map((item, index) => (
            <li key={index} style={{ marginBottom: '8px', lineHeight: '1.5' }}>
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof content === 'object' && content !== null) {
      return (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px'
        }}>
          {Object.entries(content).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '8px', lineHeight: '1.5' }}>
              <strong>{key}:</strong> {typeof value === 'string' ? value : JSON.stringify(value)}
            </div>
          ))}
        </div>
      );
    }

    return <div style={{ lineHeight: '1.6' }}>{String(content)}</div>;
  };

  // Fetch operation viability when facility is selected
  useEffect(() => {
    if (selectedFacility && showViability) {
      fetchOperationViability();
    }
  }, [selectedFacility, showViability]);

  const fetchOperationViability = async () => {
    setViabilityLoading(true);
    try {
      const impacts = impactedFacilities.find(
        impacted => impacted.facility.name === selectedFacility.name
      )?.impacts || [];

      const disasters = impacts.map(impact => impact.disaster);
      const scopedOsmData = buildScopedOsmData(selectedFacility, osmData);
      const scopedAcledData = acledEnabled ? buildScopedAcledData(selectedFacility, acledData) : null;

      const response = await fetch('/api/campaign-viability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facility: selectedFacility,
          impacts: impacts,
          disasters: disasters,
          acledData: scopedAcledData,
          acledEnabled,
          operationType,
          osmData: scopedOsmData
        }),
      });

      const data = await parseApiResponse(response, 'Operation viability');
      setOperationViability(data);
    } catch (error) {
      console.error('Error fetching operation viability:', error);
      addToast(error.message || 'Failed to fetch operation viability', 'error');
    } finally {
      setViabilityLoading(false);
    }
  };

  const selectedFacilityRecommendationsKey = selectedFacility
    ? `${selectedFacility.name}_${(impactedFacilities.find(
        impacted => impacted.facility.name === selectedFacility.name
      )?.impacts || []).length}`
    : null;
  const hasCurrentRecommendations = selectedFacilityRecommendationsKey === recommendationsFacilityKey;

  const handleExportFacilityBrief = async () => {
    if (!selectedFacility || !operationViability) return;

    try {
      // Get impact data for this facility
      const impacts = impactedFacilities.find(
        impacted => impacted.facility.name === selectedFacility.name
      )?.impacts || [];

      const response = await fetch('/api/export-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefType: 'facility',
          data: {
            facility: selectedFacility,
            viability: operationViability,
            security: operationViability.security,
            impact: impacts.length > 0 ? {
              nearestDisaster: impacts[0].disaster
            } : null,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (response.ok) {
        const { html } = await response.json();

        // Open the HTML in a new window for printing/saving
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();

        // Trigger print dialog after content loads
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        addToast('Failed to generate decision brief', 'error');
      }
    } catch (error) {
      console.error('Error exporting brief:', error);
      addToast('Error generating decision brief', 'error');
    }
  };

  // When isOpen is false, render as embedded content (no drawer wrapper)
  if (!isOpen) {
    return (
      <div style={{ padding: '20px' }}>
          {analysisLoading ? (
            <div style={{textAlign: 'center', padding: '40px 0'}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '15px', animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
                <span>{progressMsg || 'Starting...'}</span>
              </div>
            </div>
          ) : selectedFacility && analysisData ? (
            <div>
              {(() => {
                const impacts = impactedFacilities.find(
                  impacted => impacted.facility.name === selectedFacility.name
                )?.impacts || [];
                const confidence = buildAssessmentConfidence({
                  impacts,
                  acledEnabled,
                  acledData,
                  osmData,
                  operationType,
                  operationViability
                });

                return (
                  <div style={{
                    marginBottom: '14px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #dbe3ee',
                    backgroundColor: '#f8fafc'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        Confidence: {confidence.level}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                        {confidence.availableCount}/{confidence.totalCount} signals
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      Facility analysis is strongest when impact, security, infrastructure, and operation context are all present.
                    </div>
                    {confidence.missingSignals.length > 0 && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                        Missing: {confidence.missingSignals.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })()}
              <TimestampBadge
                timestamp={timestamp}
                onRefresh={onRefresh}
                loading={analysisLoading}
              />

              <div style={{marginBottom: '15px'}}>
                <h2 style={{margin: '0 0 10px 0', fontSize: '18px'}}>{selectedFacility.name}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <ProvenanceBadge
                    label="Observed: facility + disaster exposure"
                    tone="#1d4ed8"
                    background="rgba(59, 130, 246, 0.12)"
                  />
                  {acledEnabled && acledData.length > 0 && (
                    <ProvenanceBadge
                      label="Observed: ACLED security context"
                      tone="#9a3412"
                      background="rgba(249, 115, 22, 0.12)"
                    />
                  )}
                  {osmData && (
                    <ProvenanceBadge
                      label="Observed: OSM infrastructure context"
                      tone="#166534"
                      background="rgba(34, 197, 94, 0.12)"
                    />
                  )}
                  <ProvenanceBadge
                    label={isAIGenerated ? 'AI: narrative analysis' : 'Derived: rules-based analysis'}
                    tone={isAIGenerated ? '#1B3A5C' : '#6b7280'}
                    background={isAIGenerated ? 'rgba(27, 58, 92, 0.12)' : 'rgba(107, 114, 128, 0.12)'}
                  />
                </div>
                <div style={{
                  backgroundColor: isAIGenerated ? 'rgba(26, 54, 93, 0.1)' : '#f5f5f5',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  {isAIGenerated ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                      <span style={{color: 'var(--aidstack-navy)', fontWeight: 'bold'}}>AI-Generated Analysis</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#757575" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span style={{color: '#757575'}}>Standard Analysis</span>
                    </>
                  )}
                </div>
              </div>

              {Object.entries(analysisData).map(([section, content]) => (
                <div key={section} style={{marginBottom: '20px'}}>
                  <h3 style={{
                    fontSize: '16px',
                    marginBottom: '10px',
                    paddingBottom: '5px',
                    borderBottom: '1px solid #e0e0e0'
                  }}>{section}</h3>

                  {Array.isArray(content) ? (
                    <ul style={{paddingLeft: '20px', margin: '10px 0'}}>
                      {content.map((item, idx) => (
                        <li key={idx} style={{marginBottom: '8px'}}>
                          {typeof item === 'object' ? JSON.stringify(item) : item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{lineHeight: '1.5'}}>
                      {typeof content === 'object' ? JSON.stringify(content) : content}
                    </p>
                  )}
                </div>
              ))}

              {/* Operation Viability Assessment Section */}
              <div style={{marginTop: '30px', borderTop: '2px solid var(--aidstack-orange)', paddingTop: '15px', marginBottom: '20px'}}>
                <button
                  onClick={() => {
                    setShowViability(!showViability);
                    if (!showViability && !operationViability) {
                      fetchOperationViability();
                    }
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: showViability ? 'var(--aidstack-orange)' : 'white',
                    color: showViability ? 'white' : 'var(--aidstack-navy)',
                    border: `2px solid var(--aidstack-orange)`,
                    borderRadius: '4px',
                    padding: '12px 15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                  {showViability ? 'Hide' : 'Show'} Operation Viability Assessment
                </button>

                {showViability && (
                  <div style={{marginTop: '15px'}}>
                    {viabilityLoading ? (
                      <div style={{textAlign: 'center', padding: '20px 0'}}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px', animation: 'spin 1s linear infinite' }}>
                          <line x1="12" y1="2" x2="12" y2="6"></line>
                          <line x1="12" y1="18" x2="12" y2="22"></line>
                          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                          <line x1="2" y1="12" x2="6" y2="12"></line>
                          <line x1="18" y1="12" x2="22" y2="12"></line>
                          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                        <p>Assessing operation viability...</p>
                      </div>
                    ) : operationViability ? (
                      <div className="operation-viability-section">
                        {/* Decision Badge */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                          <ProvenanceBadge
                            label="Derived: viability score + decision"
                            tone="#7c2d12"
                            background="rgba(249, 115, 22, 0.12)"
                          />
                          {operationViability.aiRecommendations && (
                            <ProvenanceBadge
                              label="AI: recommendations"
                              tone="#1B3A5C"
                              background="rgba(27, 58, 92, 0.12)"
                            />
                          )}
                        </div>
                        <div style={{
                          backgroundColor:
                            operationViability.decision === 'GO' ? '#4CAF50' :
                            operationViability.decision === 'PROCEED WITH CAUTION' ? '#FF9800' :
                            operationViability.decision === 'DELAY RECOMMENDED' ? '#FFC107' :
                            '#F44336',
                          color: 'white',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          fontWeight: 'bold',
                          fontSize: '16px',
                          textAlign: 'center',
                          marginBottom: '15px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}>
                          <span style={{fontSize: '20px'}}>
                            {operationViability.decision === 'GO' ? '✅' :
                             operationViability.decision === 'PROCEED WITH CAUTION' ? '⚠️' :
                             operationViability.decision === 'DELAY RECOMMENDED' ? '⏸️' :
                             '🛑'}
                          </span>
                          <span>{operationViability.decision}</span>
                        </div>

                        {/* Viability Score */}
                        <div style={{marginBottom: '20px'}}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <span style={{fontWeight: 'bold', fontSize: '14px'}}>Viability Score</span>
                            <span style={{
                              fontWeight: 'bold',
                              fontSize: '18px',
                              color: operationViability.viabilityScore >= 70 ? '#4CAF50' :
                                     operationViability.viabilityScore >= 40 ? '#FF9800' :
                                     operationViability.viabilityScore >= 20 ? '#FFC107' : '#F44336'
                            }}>
                              {operationViability.viabilityScore}/100
                            </span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '12px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '6px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${operationViability.viabilityScore}%`,
                              height: '100%',
                              backgroundColor: operationViability.viabilityScore >= 70 ? '#4CAF50' :
                                             operationViability.viabilityScore >= 40 ? '#FF9800' :
                                             operationViability.viabilityScore >= 20 ? '#FFC107' : '#F44336',
                              transition: 'width 0.5s ease'
                            }}></div>
                          </div>
                        </div>

                        {/* Timeline */}
                        {operationViability.timeline && (
                          <div style={{
                            backgroundColor: '#e3f2fd',
                            padding: '12px',
                            borderRadius: '6px',
                            marginBottom: '20px',
                            borderLeft: '4px solid #2196F3'
                          }}>
                            <div style={{fontWeight: 'bold', marginBottom: '5px', color: '#1976D2'}}>
                              ⏱️ Timeline
                            </div>
                            <div style={{fontSize: '13px'}}>
                              <strong>{operationViability.timeline.recommendation}</strong>
                              <div style={{marginTop: '4px', color: '#555'}}>
                                Wait time: {operationViability.timeline.waitTime}
                              </div>
                              <div style={{marginTop: '4px', fontSize: '12px', fontStyle: 'italic', color: '#666'}}>
                                {operationViability.timeline.rationale}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Security Assessment */}
                        {operationViability.securityAssessment && (
                          <div style={{marginBottom: '20px'}}>
                            <h4 style={{
                              fontSize: '15px',
                              marginBottom: '12px',
                              color: 'var(--aidstack-navy)',
                              fontWeight: 'bold'
                            }}>🔒 Security Assessment:</h4>

                            <div style={{
                              backgroundColor:
                                operationViability.securityAssessment.securityLevel === 'CRITICAL' ? '#ffebee' :
                                operationViability.securityAssessment.securityLevel === 'HIGH' ? '#fff3e0' :
                                operationViability.securityAssessment.securityLevel === 'MEDIUM' ? '#fffde7' :
                                '#e8f5e9',
                              padding: '15px',
                              borderRadius: '6px',
                              borderLeft: `4px solid ${
                                operationViability.securityAssessment.securityLevel === 'CRITICAL' ? '#f44336' :
                                operationViability.securityAssessment.securityLevel === 'HIGH' ? '#ff9800' :
                                operationViability.securityAssessment.securityLevel === 'MEDIUM' ? '#ffc107' :
                                '#4caf50'
                              }`,
                              marginBottom: '10px'
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                marginBottom: '10px'
                              }}>
                                <span style={{fontSize: '20px'}}>
                                  {operationViability.securityAssessment.securityLevel === 'CRITICAL' ? '🚨' :
                                   operationViability.securityAssessment.securityLevel === 'HIGH' ? '⚠️' :
                                   operationViability.securityAssessment.securityLevel === 'MEDIUM' ? '🔒' :
                                   '✅'}
                                </span>
                                <div>
                                  <div style={{fontWeight: 'bold', fontSize: '14px'}}>
                                    Security Level: {operationViability.securityAssessment.securityLevel}
                                  </div>
                                  {operationViability.securityAssessment.facilityName && (
                                    <div style={{fontSize: '12px', color: '#666', marginTop: '2px'}}>
                                      {operationViability.securityAssessment.facilityName}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {operationViability.securityAssessment.securityFramework?.sections?.length > 0 && (
                                <div style={{
                                  marginTop: '10px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid rgba(0,0,0,0.1)'
                                }}>
                                  <div style={{
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    color: '#444',
                                    marginBottom: '8px'
                                  }}>
                                    Operational Security Framework
                                  </div>

                                  {operationViability.securityAssessment.securityFramework.sections.map((section) => (
                                    <div key={section.key} style={{ marginBottom: '10px' }}>
                                      <div style={{
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: 'var(--aidstack-navy)',
                                        marginBottom: '4px'
                                      }}>
                                        {section.title}
                                      </div>

                                      {section.items.map((item, idx) => (
                                        <div key={`${section.key}-${idx}`} style={{
                                          fontSize: '12px',
                                          lineHeight: '1.5',
                                          color: '#333',
                                          marginBottom: '4px'
                                        }}>
                                          <strong>{item.label}:</strong> {item.status}
                                          {item.detail ? ` - ${item.detail}` : ''}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {operationViability.securityAssessment.assessment && (
                                <div style={{
                                  fontSize: '13px',
                                  lineHeight: '1.6',
                                  marginTop: '10px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid rgba(0,0,0,0.1)',
                                  maxHeight: '300px',
                                  overflowY: 'auto'
                                }}>
                                  <ReactMarkdown>{operationViability.securityAssessment.assessment}</ReactMarkdown>
                                </div>
                              )}

                              {operationViability.securityAssessment.note && (
                                <div style={{
                                  fontSize: '11px',
                                  color: '#666',
                                  fontStyle: 'italic',
                                  marginTop: '10px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid rgba(0,0,0,0.1)'
                                }}>
                                  ℹ️ {operationViability.securityAssessment.note}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Risk Factors */}
                        {operationViability.risks && operationViability.risks.length > 0 && (
                          <div style={{marginBottom: '20px'}}>
                            <h4 style={{
                              fontSize: '15px',
                              marginBottom: '12px',
                              color: 'var(--aidstack-navy)',
                              fontWeight: 'bold'
                            }}>⚠️ Risk Factors Identified:</h4>

                            {operationViability.risks.map((risk, idx) => (
                              <div key={idx} style={{
                                backgroundColor:
                                  risk.severity === 'CRITICAL' ? '#ffebee' :
                                  risk.severity === 'HIGH' ? '#fff3e0' :
                                  risk.severity === 'MEDIUM' ? '#fff9c4' : '#f5f5f5',
                                border: `1px solid ${
                                  risk.severity === 'CRITICAL' ? '#f44336' :
                                  risk.severity === 'HIGH' ? '#ff9800' :
                                  risk.severity === 'MEDIUM' ? '#ffc107' : '#e0e0e0'
                                }`,
                                borderRadius: '6px',
                                padding: '10px',
                                marginBottom: '10px'
                              }}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                                  <span style={{fontSize: '16px'}}>{risk.icon}</span>
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    backgroundColor:
                                      risk.severity === 'CRITICAL' ? '#f44336' :
                                      risk.severity === 'HIGH' ? '#ff9800' :
                                      risk.severity === 'MEDIUM' ? '#ffc107' : '#9e9e9e',
                                    color: 'white'
                                  }}>{risk.severity}</span>
                                  <span style={{fontWeight: 'bold', fontSize: '13px'}}>{risk.factor}</span>
                                </div>
                                <p style={{fontSize: '12px', margin: '4px 0 0 24px', color: '#555'}}>
                                  {risk.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AI Recommendations */}
                        {operationViability.aiRecommendations && (
                          <div style={{
                            backgroundColor: 'rgba(26, 54, 93, 0.05)',
                            padding: '15px',
                            borderRadius: '6px',
                            borderLeft: '4px solid var(--aidstack-navy)',
                            marginBottom: '15px'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '10px',
                              fontWeight: 'bold',
                              color: 'var(--aidstack-navy)'
                            }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                              </svg>
                              <span>AI Recommendations</span>
                            </div>
                            <div style={{fontSize: '13px', lineHeight: '1.6'}}>
                              <ReactMarkdown>{operationViability.aiRecommendations}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{textAlign: 'center', padding: '20px 0', color: '#666'}}>
                        Unable to load operation viability assessment
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Export Brief Button */}
              {operationViability && (
                <div style={{marginTop: '20px', borderTop: '1px solid #f0f0f0', paddingTop: '15px', marginBottom: '20px'}}>
                  <button
                    onClick={handleExportFacilityBrief}
                    style={{
                      backgroundColor: 'var(--aidstack-orange)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '10px 15px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto',
                      transition: 'all 0.2s',
                      fontWeight: '500'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Export Decision Brief
                  </button>
                  <p style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    color: 'var(--aidstack-slate-medium)',
                    marginTop: '8px',
                    fontStyle: 'italic'
                  }}>
                    Generate 1-page PDF for NMCP, funders, and decision-makers
                  </p>
                </div>
              )}

              <div style={{marginTop: '20px', borderTop: '1px solid #f0f0f0', paddingTop: '15px'}}>
                {(() => {
                  const impacts = impactedFacilities.find(
                    impacted => impacted.facility.name === selectedFacility.name
                  )?.impacts || [];
                  const hasImpacts = impacts.length > 0;

                  return (
                    <>
                      <button
                        className="button"
                        onClick={() => {
                          setShowRecommendations(true);
                          if (onViewRecommendations) {
                            onViewRecommendations(selectedFacility);
                          }
                        }}
                        style={{
                          backgroundColor: hasImpacts ? 'var(--aidstack-orange)' : 'var(--aidstack-navy)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '10px 15px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto',
                          transition: 'all 0.2s'
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                          {hasImpacts ? (
                            <>
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </>
                          ) : (
                            <>
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </>
                          )}
                        </svg>
                        {hasImpacts ? 'View Response Recommendations' : 'View Preparedness Recommendations'}
                      </button>
                      <p style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--aidstack-slate-medium)',
                        marginTop: '8px',
                        fontStyle: 'italic'
                      }}>
                        {hasImpacts
                          ? `Active disaster impacts detected - Get immediate response guidance`
                          : `No active threats - Get preparedness and mitigation guidance`
                        }
                      </p>

                      {showRecommendations && (
                        <div style={{
                          marginTop: '16px',
                          padding: '16px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #dbe3ee',
                          borderRadius: '10px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '12px'
                          }}>
                            <div>
                              <div style={{
                                fontSize: '15px',
                                fontWeight: 700,
                                color: 'var(--aidstack-navy)',
                                marginBottom: '4px'
                              }}>
                                {hasImpacts ? 'Response Recommendations' : 'Preparedness Recommendations'}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {recommendationsTimestamp && hasCurrentRecommendations
                                  ? `Updated ${new Date(recommendationsTimestamp).toLocaleString()}`
                                  : 'Generated for the selected facility'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {hasCurrentRecommendations && (
                                <ProvenanceBadge
                                  label={recommendationsAIGenerated ? 'AI: recommendations' : 'Derived: standard guidance'}
                                  tone={recommendationsAIGenerated ? '#1B3A5C' : '#7c2d12'}
                                  background={recommendationsAIGenerated ? 'rgba(27, 58, 92, 0.12)' : 'rgba(245, 158, 11, 0.14)'}
                                />
                              )}
                              <button
                                onClick={() => onViewRecommendations && onViewRecommendations(selectedFacility, true)}
                                style={{
                                  background: 'white',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  padding: '8px 10px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#334155'
                                }}
                              >
                                Refresh
                              </button>
                              <button
                                onClick={() => setShowRecommendations(false)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#64748b'
                                }}
                              >
                                Hide
                              </button>
                            </div>
                          </div>

                          {recommendationsLoading ? (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#475569' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px', animation: 'spin 1s linear infinite' }}>
                                <line x1="12" y1="2" x2="12" y2="6"></line>
                                <line x1="12" y1="18" x2="12" y2="22"></line>
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                <line x1="2" y1="12" x2="6" y2="12"></line>
                                <line x1="18" y1="12" x2="22" y2="12"></line>
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                              </svg>
                              <div>Generating recommendations...</div>
                            </div>
                          ) : hasCurrentRecommendations && recommendations && !recommendations.error ? (
                            <div>
                              {Object.entries(recommendations).map(([category, content]) => {
                                if (['error', 'Credits', 'About'].includes(category)) return null;

                                return (
                                  <div key={category} style={{ marginBottom: '18px' }}>
                                    <h4 style={{
                                      fontSize: '14px',
                                      fontWeight: 700,
                                      color: 'var(--aidstack-orange)',
                                      marginBottom: '8px'
                                    }}>
                                      {category}
                                    </h4>
                                    {formatRecommendationContent(content)}
                                  </div>
                                );
                              })}
                            </div>
                          ) : hasCurrentRecommendations && recommendations?.error ? (
                            <div style={{
                              backgroundColor: '#fef2f2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                              borderRadius: '8px',
                              padding: '12px'
                            }}>
                              {recommendations.error}
                            </div>
                          ) : (
                            <div style={{ color: '#475569', lineHeight: '1.6' }}>
                              Recommendations will appear here for the selected facility.
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div style={{textAlign: 'center', padding: '40px 0', color: '#666'}}>
              Select a facility to analyze its disaster risk profile
            </div>
          )}
      </div>
    );
  }

  // Full drawer rendering when isOpen is true
  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`drawer drawer-right ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 20px -20px',
          padding: '20px'
        }}>
          <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6" y2="6"></line>
              <line x1="6" y1="18" x2="6" y2="18"></line>
            </svg>
            AI Facility Analysis
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        <div className="drawer-content">
          {/* Content would go here - same as embedded version above */}
        </div>
      </div>

      <style jsx>{`
        .drawer-backdrop {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2999;
          transition: opacity 0.3s ease;
        }
        .drawer-backdrop.open {
          display: block;
        }
        .drawer {
          position: fixed;
          top: 0;
          bottom: 0;
          right: 0;
          width: 480px;
          max-width: 90vw;
          background: white;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
          transform: translateX(100%);
          transition: transform 0.3s ease;
          overflow-y: auto;
          z-index: 3000;
          padding: 20px;
        }
        .drawer.open {
          transform: translateX(0);
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default AnalysisDrawer;
