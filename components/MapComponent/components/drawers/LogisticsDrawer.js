import React, { useState } from 'react';
import styles from './LogisticsDrawer.module.css';

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

const confidenceCardStyle = {
  marginBottom: '16px',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc'
};

const LogisticsDrawer = ({
  isOpen,
  onClose,
  data,
  loading,
  error,
  onRetry
}) => {
  const [expandedSections, setExpandedSections] = useState({
    roadNetwork: true,
    fuelAccess: true,
    airAccess: true,
    security: true,
    recommendations: true,
    alternativeRoutes: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2>Logistics Assessment</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading && <LoadingState />}
          {error && <ErrorState error={error} onRetry={onRetry} />}
          {!loading && !error && !data && <EmptyState />}
          {!loading && !error && data && (
            <>
              <SummaryCard data={data} />

              <RoadNetworkSection
                data={data.roadNetwork}
                expanded={expandedSections.roadNetwork}
                onToggle={() => toggleSection('roadNetwork')}
              />

              <FuelAccessSection
                data={data.fuelAccess}
                expanded={expandedSections.fuelAccess}
                onToggle={() => toggleSection('fuelAccess')}
              />

              <AirAccessSection
                data={data.airAccess}
                expanded={expandedSections.airAccess}
                onToggle={() => toggleSection('airAccess')}
              />

              {data.securityAnalysis && (
                <SecuritySection
                  data={data.securityAnalysis}
                  expanded={expandedSections.security}
                  onToggle={() => toggleSection('security')}
                />
              )}

              <RecommendationsSection
                data={data.recommendations}
                expanded={expandedSections.recommendations}
                onToggle={() => toggleSection('recommendations')}
              />

              {data.alternativeRoutes && data.alternativeRoutes.length > 0 && (
                <AlternativeRoutesSection
                  data={data.alternativeRoutes}
                  expanded={expandedSections.alternativeRoutes}
                  onToggle={() => toggleSection('alternativeRoutes')}
                />
              )}

              <MetadataSection data={data.metadata} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ data }) => {
  const getRatingColor = (rating) => {
    const colors = {
      'EXCELLENT': '#22c55e',
      'GOOD': '#84cc16',
      'MODERATE': '#eab308',
      'DIFFICULT': '#f97316',
      'CRITICAL': '#ef4444'
    };
    return colors[rating] || '#6b7280';
  };

  return (
    <div className={styles.summaryCard}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <ProvenanceBadge
          label="Observed: OSM infrastructure"
          tone="#166534"
          background="rgba(34, 197, 94, 0.12)"
        />
        {data.securityAnalysis && (
          <ProvenanceBadge
            label="Observed: ACLED security context"
            tone="#9a3412"
            background="rgba(249, 115, 22, 0.12)"
          />
        )}
        <ProvenanceBadge
          label="Derived: access score + rating"
          tone="#7c2d12"
          background="rgba(245, 158, 11, 0.14)"
        />
        {data.recommendations?.aiGenerated && (
          <ProvenanceBadge
            label="AI: recommendations"
            tone="#1B3A5C"
            background="rgba(27, 58, 92, 0.12)"
          />
        )}
      </div>
      <div className={styles.scoreContainer}>
        <div className={styles.scoreCircle}>
          <div className={styles.scoreValue}>{data.accessScore.toFixed(1)}</div>
          <div className={styles.scoreLabel}>/ 10</div>
        </div>
        <div className={styles.ratingBadge} style={{ backgroundColor: getRatingColor(data.rating) }}>
          {data.rating}
        </div>
      </div>
      {data.metadata?.confidence && (
        <div style={confidenceCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              Confidence: {data.metadata.confidence.level}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              {data.metadata.confidence.availableCount}/{data.metadata.confidence.totalCount} signals
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
            {data.metadata.confidence.summary}
          </div>
          {data.metadata.confidence.missingSignals?.length > 0 && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
              Missing: {data.metadata.confidence.missingSignals.join(', ')}
            </div>
          )}
        </div>
      )}
      <p className={styles.summaryText}>{data.summary}</p>
    </div>
  );
};

// Loading State
const LoadingState = () => (
  <div className={styles.centerState}>
    <div className={styles.spinner}></div>
    <p>Analyzing logistics accessibility...</p>
    <p className={styles.subtext}>This may take up to 30 seconds</p>
  </div>
);

// Error State
const ErrorState = ({ error, onRetry }) => (
  <div className={styles.centerState}>
    <div className={styles.errorIcon}>⚠️</div>
    <h3>Analysis Failed</h3>
    <p className={styles.errorMessage}>{error}</p>
    <button className={styles.retryButton} onClick={onRetry}>Try Again</button>
  </div>
);

// Empty State
const EmptyState = () => (
  <div className={styles.centerState}>
    <div className={styles.emptyIcon}>📦</div>
    <h3>No Data Available</h3>
    <p className={styles.subtext}>Upload districts and ensure disasters are loaded to run logistics assessment</p>
  </div>
);

// Road Network Section
const RoadNetworkSection = ({ data, expanded, onToggle }) => (
  <CollapsibleSection title="Road Network" expanded={expanded} onToggle={onToggle}>
    <div className={styles.sectionContent}>
      {data.assessmentStatus === 'NOT_LOADED' ? (
        <p className={styles.summaryText}>Not assessed. Load `roads` or `bridges` in OpenStreetMap Infrastructure first.</p>
      ) : (
        <>
      <StatRow label="Total Roads" value={data.totalRoads} />
      <StatRow label="Major Routes" value={data.majorRoutes} />
      <StatRow label="Passable Roads" value={`${data.passableCount} (${data.passablePercentage}%)`} />
      <StatRow label="Blocked/At Risk" value={`${data.blockedCount} (${data.blockedPercentage}%)`} />

      {data.criticalBlocked && data.criticalBlocked.length > 0 && (
        <>
          <h4 className={styles.subsectionTitle}>Critical Routes Affected:</h4>
          <ul className={styles.itemList}>
            {data.criticalBlocked.map((road, idx) => (
              <li key={idx} className={styles.criticalItem}>
                <strong>{road.name || 'Unnamed Road'}</strong>
                <span className={styles.riskBadge}>
                  {(road.blockageProbability * 100).toFixed(0)}% blocked
                </span>
                <div className={styles.itemDetail}>
                  Distance to disaster: {road.distanceToDisaster.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {data.bridgesAtRisk && data.bridgesAtRisk.length > 0 && (
        <>
          <h4 className={styles.subsectionTitle}>Bridges At Risk:</h4>
          <ul className={styles.itemList}>
            {data.bridgesAtRisk.map((bridge, idx) => (
              <li key={idx} className={styles.warningItem}>
                <strong>{bridge.name || `Bridge ${idx + 1}`}</strong>
                <span className={styles.riskBadge}>
                  {(bridge.riskScore * 100).toFixed(0)}% risk
                </span>
                <div className={styles.itemDetail}>
                  Distance to disaster: {bridge.distanceToDisaster.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
        </>
      )}
    </div>
  </CollapsibleSection>
);

// Fuel Access Section
const FuelAccessSection = ({ data, expanded, onToggle }) => (
  <CollapsibleSection title="Fuel Access" expanded={expanded} onToggle={onToggle}>
    <div className={styles.sectionContent}>
      {data.assessmentStatus === 'NOT_LOADED' ? (
        <p className={styles.summaryText}>Not assessed. Load the `fuel` infrastructure layer to evaluate fuel access.</p>
      ) : (
        <>
      <StatRow label="Fuel Stations" value={data.totalStations} />
      <StatRow label="Operational" value={`${data.operationalCount} (${data.operationalPercentage}%)`} />
      <StatRow label="At Risk" value={`${data.atRiskCount} (${data.atRiskPercentage}%)`} />

      {data.operationalStations && data.operationalStations.length > 0 && (
        <>
          <h4 className={styles.subsectionTitle}>Operational Stations:</h4>
          <ul className={styles.itemList}>
            {data.operationalStations.slice(0, 5).map((station, idx) => (
              <li key={idx} className={styles.successItem}>
                <strong>{station.name || `Station ${idx + 1}`}</strong>
                <div className={styles.itemDetail}>
                  Distance to nearest disaster: {station.distanceToDisaster.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
          {data.operationalStations.length > 5 && (
            <p className={styles.moreInfo}>+ {data.operationalStations.length - 5} more stations</p>
          )}
        </>
      )}

      {data.atRiskStations && data.atRiskStations.length > 0 && (
        <>
          <h4 className={styles.subsectionTitle}>Stations At Risk:</h4>
          <ul className={styles.itemList}>
            {data.atRiskStations.map((station, idx) => (
              <li key={idx} className={styles.warningItem}>
                <strong>{station.name || `Station ${idx + 1}`}</strong>
                <span className={styles.riskBadge}>
                  {(station.impactProbability * 100).toFixed(0)}% impact
                </span>
                <div className={styles.itemDetail}>
                  Distance to disaster: {station.distanceToDisaster.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
        </>
      )}
    </div>
  </CollapsibleSection>
);

// Air Access Section
const AirAccessSection = ({ data, expanded, onToggle }) => (
  <CollapsibleSection title="Air Access" expanded={expanded} onToggle={onToggle}>
    <div className={styles.sectionContent}>
      {data.assessmentStatus === 'NOT_LOADED' ? (
        <p className={styles.summaryText}>Not assessed. Load the `airports` infrastructure layer to evaluate air access.</p>
      ) : (
        <>
      <StatRow label="Airports/Airfields" value={data.totalAirports} />
      <StatRow label="Operational" value={`${data.operationalCount} (${data.operationalPercentage}%)`} />
      <StatRow label="At Risk" value={`${data.atRiskCount} (${data.atRiskPercentage}%)`} />

      {data.operationalAirports && data.operationalAirports.length > 0 && (
        <>
          <h4 className={styles.subsectionTitle}>Operational Airports:</h4>
          <ul className={styles.itemList}>
            {data.operationalAirports.map((airport, idx) => (
              <li key={idx} className={styles.successItem}>
                <strong>{airport.name || `Airport ${idx + 1}`}</strong>
                <span className={styles.typeBadge}>{airport.type || 'airport'}</span>
                <div className={styles.itemDetail}>
                  Distance to nearest disaster: {airport.distanceToDisaster.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {data.atRiskAirports && data.atRiskAirports.length > 0 && (
        <>
          <h4 className={styles.subsectionTitle}>Airports At Risk:</h4>
          <ul className={styles.itemList}>
            {data.atRiskAirports.map((airport, idx) => (
              <li key={idx} className={styles.warningItem}>
                <strong>{airport.name || `Airport ${idx + 1}`}</strong>
                <span className={styles.riskBadge}>
                  {(airport.impactProbability * 100).toFixed(0)}% impact
                </span>
                <div className={styles.itemDetail}>
                  Distance to disaster: {airport.distanceToDisaster.toFixed(1)} km
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
        </>
      )}
    </div>
  </CollapsibleSection>
);

const SecuritySection = ({ data, expanded, onToggle }) => (
  <CollapsibleSection title="Security Context" expanded={expanded} onToggle={onToggle}>
    <div className={styles.sectionContent}>
      <StatRow label="Security Level" value={data.level} />
      <StatRow label="Recent Incidents" value={data.incidentCount} />
      <StatRow label="Reported Fatalities" value={data.fatalities} />
      <StatRow label="Security Score" value={`${data.score} / 10`} />
      <p className={styles.summaryText}>{data.description}</p>
    </div>
  </CollapsibleSection>
);

// Recommendations Section
const RecommendationsSection = ({ data, expanded, onToggle }) => (
  <CollapsibleSection title="AI Recommendations" expanded={expanded} onToggle={onToggle}>
    <div className={styles.sectionContent}>
      {Object.entries(data).map(([category, items]) => (
        <div key={category} className={styles.recommendationCategory}>
          <h4 className={styles.categoryTitle}>{category}</h4>
          <ul className={styles.recommendationList}>
            {items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </CollapsibleSection>
);

// Alternative Routes Section
const AlternativeRoutesSection = ({ data, expanded, onToggle }) => (
  <CollapsibleSection title="Alternative Routes" expanded={expanded} onToggle={onToggle}>
    <div className={styles.sectionContent}>
      {data.map((route, idx) => (
        <div key={idx} className={styles.routeCard}>
          <div className={styles.routeHeader}>
            <h4>Route {idx + 1}</h4>
            <span className={styles.scoreValue}>{route.score.toFixed(1)}/10</span>
          </div>
          <StatRow label="Distance" value={`${route.distance.toFixed(1)} km`} />
          <StatRow label="Status" value={route.passable ? '✓ Passable' : '✗ Blocked'} />
          <StatRow label="Road Segments" value={route.segments.length} />

          {route.risks && route.risks.length > 0 && (
            <>
              <h5 className={styles.subsectionTitle}>Risks:</h5>
              <ul className={styles.riskList}>
                {route.risks.map((risk, rIdx) => (
                  <li key={rIdx} className={styles.riskItem}>{risk}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}
    </div>
  </CollapsibleSection>
);

// Metadata Section
const MetadataSection = ({ data }) => {
  // Format data quality object into readable string
  const formatDataQuality = (quality) => {
    if (!quality) return 'N/A';
    if (typeof quality === 'string') return quality;

    const parts = [];
    if (quality.osmCoverage) parts.push(`OSM: ${quality.osmCoverage}`);
    if (quality.disasterData) parts.push(`Disasters: ${quality.disasterData}`);
    if (quality.securityData) parts.push(`Security: ${quality.securityData}`);
    if (quality.weatherData) parts.push(`Weather: ${quality.weatherData}`);

    return parts.join(', ') || 'N/A';
  };

  return (
    <div className={styles.metadata}>
      <div className={styles.metadataItem}>
        <span className={styles.metadataLabel}>Generated:</span>
        <span className={styles.metadataValue}>{new Date(data.timestamp).toLocaleString()}</span>
      </div>
      <div className={styles.metadataItem}>
        <span className={styles.metadataLabel}>Processing Time:</span>
        <span className={styles.metadataValue}>{data.analysisTime}ms</span>
      </div>
      {data.dataQuality && (
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>Data Quality:</span>
          <span className={styles.metadataValue}>{formatDataQuality(data.dataQuality)}</span>
        </div>
      )}
    </div>
  );
};

// Reusable Components
const CollapsibleSection = ({ title, expanded, onToggle, children }) => (
  <div className={styles.section}>
    <div className={styles.sectionHeader} onClick={onToggle}>
      <h3>{title}</h3>
      <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
    </div>
    {expanded && children}
  </div>
);

const StatRow = ({ label, value }) => (
  <div className={styles.statRow}>
    <span className={styles.statLabel}>{label}:</span>
    <span className={styles.statValue}>{value}</span>
  </div>
);

export default LogisticsDrawer;
