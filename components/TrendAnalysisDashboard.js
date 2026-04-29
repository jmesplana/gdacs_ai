import React, { useState, useEffect } from 'react';
import EmptyState from './TrendAnalysisDashboard/EmptyState';
import SummaryCards from './TrendAnalysisDashboard/SummaryCards';
import AcledTrendsChart from './TrendAnalysisDashboard/AcledTrendsChart';
import FacilityRiskChart from './TrendAnalysisDashboard/FacilityRiskChart';
import DisasterTimelineChart from './TrendAnalysisDashboard/DisasterTimelineChart';
import DistrictComparisonTable from './TrendAnalysisDashboard/DistrictComparisonTable';
import NarrativePanel from './TrendAnalysisDashboard/NarrativePanel';

const acledEventDateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

function formatAcledEventDate(value) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : acledEventDateFormatter.format(date);
}

function AcledMetricCard({ value, label, accent = '#ef4444', sublabel = null }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        fontSize: '26px',
        fontWeight: 700,
        color: accent,
        marginBottom: '6px',
        fontFamily: "'Space Grotesk', sans-serif"
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#475569',
        fontWeight: 600
      }}>
        {label}
      </div>
      {sublabel && (
        <div style={{
          marginTop: '6px',
          fontSize: '11px',
          color: '#64748b'
        }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}

function AcledRankedList({ title, items = [], emptyMessage, renderValue }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '18px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--aidstack-navy)',
        marginBottom: '12px',
        fontFamily: "'Space Grotesk', sans-serif"
      }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#64748b' }}>{emptyMessage}</div>
      ) : (
        items.map((item, index) => (
          <div
            key={`${title}-${index}-${item.type || item.district || item.actor || item.label || 'row'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 0',
              borderTop: index === 0 ? 'none' : '1px solid #f1f5f9'
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                {item.type || item.district || item.actor || 'Unknown'}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
              {renderValue(item)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function TrendAnalysisDashboard({
  districts = [],
  selectedDistricts = [],
  facilities = [],
  impactedFacilities = [],
  acledData = [],
  disasters = [],
  onClose
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [timeWindow, setTimeWindow] = useState(30); // default 30 days
  const [acledGranularity, setAcledGranularity] = useState('daily');
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // summary, facilities, acled, disasters

  // Fetch trend analysis when component mounts or dependencies change
  useEffect(() => {
    if (!selectedDistricts || selectedDistricts.length === 0) {
      setTrendData(null);
      return;
    }

    fetchTrendAnalysis();
  }, [selectedDistricts, facilities, impactedFacilities, acledData, disasters, timeWindow, acledGranularity]);

  const fetchTrendAnalysis = async () => {
    setLoading(true);
    setError(null);
    setNarrative(null);
    setNarrativeError(null);
    setNarrativeLoading(false);

    try {
      // Process ALL data client-side to avoid 413 payload errors
      const {
        aggregateAcledByTime,
        aggregateDisastersByTime,
        calculateFacilityRiskTrends,
        calculateDistrictComparison,
        getSummaryMetrics,
        getAcledDetailMetrics
      } = await import('../lib/trendAnalysis');

      // Calculate summary metrics
      const summary = getSummaryMetrics(
        selectedDistricts,
        facilities || [],
        acledData || [],
        disasters || [],
        timeWindow
      );

      // Calculate ACLED trends
      const acledTrends = aggregateAcledByTime(
        acledData || [],
        selectedDistricts,
        acledGranularity,
        timeWindow
      );

      const acledDetails = getAcledDetailMetrics(
        selectedDistricts,
        acledData || [],
        timeWindow
      );

      // Calculate facility risk trends
      const facilityRiskTrends = calculateFacilityRiskTrends(
        facilities || [],
        impactedFacilities || [],
        selectedDistricts
      );

      // Calculate disaster trends
      const disasterTrends = aggregateDisastersByTime(
        disasters || [],
        selectedDistricts,
        'weekly'
      );

      // Calculate district comparison
      const districtComparison = calculateDistrictComparison(
        selectedDistricts,
        facilities || [],
        acledData || [],
        disasters || [],
        timeWindow
      );

      // Build warnings array
      const warnings = [];
      if (!acledTrends) warnings.push(`No ACLED data in the last ${timeWindow} days for selected districts`);
      if (!facilityRiskTrends) warnings.push('No site data available for selected districts');
      if (!disasterTrends) warnings.push(`No disaster data in the last ${timeWindow} days for selected districts`);

      const data = {
        success: true,
        summary,
        acledTrends,
        acledDetails,
        facilityRiskTrends,
        disasterTrends,
        districtComparison,
        warnings: warnings.length > 0 ? warnings : null
      };

      setTrendData(data);
    } catch (err) {
      console.error('Error fetching trend analysis:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNarrative = async (trendDataToUse) => {
    setNarrativeLoading(true);
    setNarrativeError(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || '';
      const response = await fetch(`${baseUrl}/api/trend-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: trendDataToUse.summary,
          acledTrends: trendDataToUse.acledTrends,
          facilityRiskTrends: trendDataToUse.facilityRiskTrends,
          disasterTrends: trendDataToUse.disasterTrends,
          districtComparison: trendDataToUse.districtComparison,
          timeWindowDays: timeWindow
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate narrative');
      }

      const data = await response.json();
      setNarrative(data.narrative);
    } catch (err) {
      console.error('Error generating narrative:', err);
      setNarrativeError(err.message);
    } finally {
      setNarrativeLoading(false);
    }
  };

  // Render empty state if no districts selected
  if (!selectedDistricts || selectedDistricts.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '600px',
        height: '100vh',
        background: '#f8fafc',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #334155 100%)',
          color: 'white',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            Trend Analysis
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px 12px',
              transition: 'all 0.2s'
            }}
          >
            ×
          </button>
        </div>

        {/* Empty state content */}
        <div style={{ padding: '24px', flex: 1, overflow: 'auto' }}>
          <EmptyState
            icon="📊"
            title="No Districts Selected"
            message="Select one or more districts from the map to view trend analysis"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '600px',
      height: '100vh',
      background: '#f8fafc',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #334155 100%)',
        color: 'white',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif"
          }}>
            Trend Analysis
          </h2>
          {trendData?.summary && (
            <div style={{
              fontSize: '11px',
              marginTop: '4px',
              opacity: 0.9
            }}>
              {trendData.summary.selectedArea}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px 12px',
            transition: 'all 0.2s'
          }}
        >
          ×
        </button>
      </div>

      {/* Time Window Selector & Tabs */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {/* Time Window */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 700,
            marginBottom: '8px'
          }}>
            Time Window
          </div>
          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            {[7, 30, 60, 90].map((days) => (
              <button
                key={days}
                onClick={() => setTimeWindow(days)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: timeWindow === days ? 'var(--aidstack-navy)' : 'white',
                  color: timeWindow === days ? 'white' : '#64748b',
                  border: `1px solid ${timeWindow === days ? 'var(--aidstack-navy)' : '#cbd5e1'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0',
          padding: '0 24px'
        }}>
          {[
            {
              id: 'summary',
              label: 'Summary',
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            },
            {
              id: 'facilities',
              label: 'Sites',
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            },
            {
              id: 'acled',
              label: 'Security (ACLED)',
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            },
            {
              id: 'disasters',
              label: 'Disasters',
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: 'transparent',
                color: activeTab === tab.id ? 'var(--aidstack-navy)' : '#64748b',
                border: 'none',
                borderBottom: `3px solid ${activeTab === tab.id ? 'var(--aidstack-navy)' : 'transparent'}`,
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px'
      }}>
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#64748b'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Loading trend analysis...</div>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            color: '#991b1b',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && trendData && (
          <>
            {/* Warnings */}
            {trendData.warnings && trendData.warnings.length > 0 && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#78350f',
                  fontWeight: 600,
                  marginBottom: '4px'
                }}>
                  ⚠️ Limited Data
                </div>
                {trendData.warnings.map((warning, i) => (
                  <div key={i} style={{
                    fontSize: '11px',
                    color: '#92400e',
                    marginLeft: '20px'
                  }}>
                    • {warning}
                  </div>
                ))}
              </div>
            )}

            {/* SUMMARY TAB */}
            {activeTab === 'summary' && (
              <>
                {/* Summary Cards */}
                <SummaryCards
                  summary={trendData.summary}
                  trends={trendData.summary?.trends}
                />

                {/* AI Narrative */}
                <NarrativePanel
                  narrative={narrative}
                  loading={narrativeLoading}
                  error={narrativeError}
                  onGenerate={() => fetchNarrative(trendData)}
                  onRegenerate={() => fetchNarrative(trendData)}
                />

                {/* District Comparison Table */}
                {trendData.districtComparison && trendData.districtComparison.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--aidstack-navy)',
                      marginBottom: '12px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      District Comparison
                    </h3>
                    <DistrictComparisonTable data={trendData.districtComparison} />
                  </div>
                )}
              </>
            )}

            {/* FACILITIES TAB */}
            {activeTab === 'facilities' && (
              <>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--aidstack-navy)',
                  marginBottom: '16px',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  Site Analysis
                </div>

                {/* Facility Stats */}
                {trendData.summary?.currentPeriod?.facilities && (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: 'var(--aidstack-navy)',
                      marginBottom: '8px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      {trendData.summary.currentPeriod.facilities}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      Sites being monitored in {trendData.summary.selectedArea}
                    </div>
                  </div>
                )}

                {/* Facility Risk Chart */}
                {trendData.facilityRiskTrends ? (
                  <FacilityRiskChart
                    data={trendData.facilityRiskTrends}
                    title="Current Site Status"
                  />
                ) : (
                  <EmptyState
                    icon="🏥"
                    title="No Site Status Data"
                    message="Upload sites and run an impact assessment to see current impacted vs not impacted status in the selected area."
                  />
                )}
              </>
            )}

            {/* ACLED TAB */}
            {activeTab === 'acled' && (
              <>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--aidstack-navy)',
                  marginBottom: '16px',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  Security Analysis (ACLED)
                </div>

                {/* ACLED Stats */}
                {trendData.acledDetails && (
                  <>
                    <div style={{
                      background: '#fff7ed',
                      border: '1px solid #fdba74',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#9a3412',
                        lineHeight: 1.5
                      }}>
                        {trendData.summary?.trends?.acledChange !== null && trendData.summary?.trends?.acledChange !== undefined
                          ? `Security activity ${trendData.summary.trends.acledChange > 0 ? 'increased' : trendData.summary.trends.acledChange < 0 ? 'decreased' : 'was unchanged'} ${Math.abs(trendData.summary.trends.acledChange)}% vs the previous ${timeWindow}-day period`
                          : `Security activity summary for the last ${timeWindow} days`}
                        {trendData.acledDetails.topEventTypes?.[0]?.type ? `, driven mainly by ${trendData.acledDetails.topEventTypes[0].type}` : ''}
                        {trendData.acledDetails.topDistrictsByCount?.[0]?.district ? ` in ${trendData.acledDetails.topDistrictsByCount[0].district}` : ''}.
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <AcledMetricCard
                        value={trendData.acledDetails.totalEvents.toLocaleString()}
                        label={`Events in last ${timeWindow} days`}
                      />
                      <AcledMetricCard
                        value={trendData.acledDetails.totalFatalities.toLocaleString()}
                        label="Reported fatalities"
                        accent="#b91c1c"
                      />
                      <AcledMetricCard
                        value={trendData.acledDetails.mostCommonEventType}
                        label="Most common event type"
                        accent="#1e293b"
                      />
                      <AcledMetricCard
                        value={trendData.acledDetails.mostAffectedDistrict}
                        label="Most affected district"
                        accent="#7c2d12"
                      />
                    </div>
                  </>
                )}

                {/* ACLED Trends Chart */}
                {trendData.acledTrends ? (
                  <>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      marginBottom: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: 600
                      }}>
                        Time series view
                      </div>
                      <div style={{
                        display: 'inline-flex',
                        gap: '6px',
                        padding: '4px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px'
                      }}>
                        {[
                          { id: 'daily', label: 'Daily' },
                          { id: 'weekly', label: 'Weekly' }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setAcledGranularity(option.id)}
                            style={{
                              padding: '7px 12px',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              background: acledGranularity === option.id ? 'var(--aidstack-navy)' : 'transparent',
                              color: acledGranularity === option.id ? 'white' : '#475569',
                              fontSize: '12px',
                              fontWeight: 600,
                              fontFamily: "'Inter', sans-serif"
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <AcledTrendsChart
                      data={trendData.acledTrends}
                      title={`ACLED Events Over Last ${timeWindow} Days`}
                      granularity={acledGranularity}
                    />
                  </>
                ) : (
                  <EmptyState
                    icon="⚠️"
                    title="No ACLED Data"
                    message={`No security events recorded in the last ${timeWindow} days for selected districts. Try a longer time window or upload ACLED data.`}
                  />
                )}

                {trendData.acledDetails && (
                  <>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <AcledRankedList
                        title="Top Event Types"
                        items={trendData.acledDetails.topEventTypes}
                        emptyMessage="No event type breakdown available."
                        renderValue={(item) => `${item.count} events`}
                      />
                      <AcledRankedList
                        title="Top District Hotspots"
                        items={trendData.acledDetails.topDistrictsByCount}
                        emptyMessage="No district hotspot data available."
                        renderValue={(item) => `${item.count} events`}
                      />
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <AcledRankedList
                        title="Fatality Hotspots"
                        items={trendData.acledDetails.topDistrictsByFatalities.filter((item) => item.fatalities > 0)}
                        emptyMessage="No fatalities reported in this window."
                        renderValue={(item) => `${item.fatalities} fatalities`}
                      />
                      <AcledRankedList
                        title="Most Frequent Actors"
                        items={trendData.acledDetails.topActors}
                        emptyMessage="No actor data available."
                        renderValue={(item) => `${item.count} events`}
                      />
                    </div>

                    <div style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--aidstack-navy)',
                        marginBottom: '12px',
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}>
                        Recent Notable Events
                      </div>
                      <div style={{
                        display: 'grid',
                        gap: '10px'
                      }}>
                        {trendData.acledDetails.recentEvents.map((event, index) => (
                          <div
                            key={`${event.event_id_cnty || event.event_id_no_cnty || event.event_date || index}-${index}`}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '12px 14px',
                              background: '#f8fafc'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '12px',
                              marginBottom: '6px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                  {event.event_type || 'Unknown event'}
                                  {event.sub_event_type ? ` • ${event.sub_event_type}` : ''}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                                  {event.admin2 || event.admin1 || 'Unknown district'}
                                  {event.country ? `, ${event.country}` : ''}
                                </div>
                              </div>
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#475569',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatAcledEventDate(event.event_date)}
                              </div>
                            </div>

                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px 14px',
                              fontSize: '11px',
                              color: '#475569',
                              marginBottom: event.notes ? '8px' : '0'
                            }}>
                              {event.actor1 && (
                                <span><strong>Actor 1:</strong> {event.actor1}</span>
                              )}
                              {event.actor2 && (
                                <span><strong>Actor 2:</strong> {event.actor2}</span>
                              )}
                              <span><strong>Fatalities:</strong> {(event.fatalities || 0).toLocaleString()}</span>
                            </div>

                            {event.notes && (
                              <div style={{
                                fontSize: '11px',
                                color: '#334155',
                                lineHeight: 1.5
                              }}>
                                {String(event.notes).slice(0, 220)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* DISASTERS TAB */}
            {activeTab === 'disasters' && (
              <>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--aidstack-navy)',
                  marginBottom: '16px',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  Disaster Analysis
                </div>

                {/* Disaster Stats */}
                {trendData.summary?.currentPeriod?.disasters !== undefined && (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#ff6b35',
                      marginBottom: '8px',
                      fontFamily: "'Space Grotesk', sans-serif"
                    }}>
                      {trendData.summary.currentPeriod.disasters}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      Active disasters in {trendData.summary.selectedArea}
                    </div>
                  </div>
                )}

                {/* Disaster Timeline */}
                {trendData.disasterTrends ? (
                  <DisasterTimelineChart
                    data={trendData.disasterTrends}
                    title="Disaster Timeline"
                  />
                ) : (
                  <EmptyState
                    icon="🌪️"
                    title="No Disaster Data"
                    message="No disasters recorded for selected districts in the current time window."
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        padding: '12px 24px',
        fontSize: '11px',
        color: '#64748b',
        textAlign: 'center'
      }}>
        {trendData && (
          <>
            Analyzing {trendData.summary?.districtCount || 0} district(s) over {timeWindow} days
          </>
        )}
      </div>
    </div>
  );
}
