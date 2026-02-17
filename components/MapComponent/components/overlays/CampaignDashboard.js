import React, { useState, useEffect } from 'react';

/**
 * Campaign Readiness Dashboard
 * Shows system-level overview of campaign viability across all facilities
 */
const CampaignDashboard = ({
  facilities = [],
  disasters = [],
  impactedFacilities = [],
  acledData = [],
  acledEnabled = false,
  isOpen,
  onClose
}) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Calculate dashboard statistics
  useEffect(() => {
    if (isOpen && facilities.length > 0) {
      calculateDashboard();
    }
  }, [isOpen, facilities, disasters, impactedFacilities, acledData, acledEnabled]);

  const calculateDashboard = async () => {
    setLoading(true);

    try {
      // Assess viability for each facility
      const assessments = await Promise.all(
        facilities.map(async (facility) => {
          const impacts = impactedFacilities.find(
            f => f.facility.name === facility.name
          )?.impacts || [];

          const disastersList = impacts.map(impact => impact.disaster);

          try {
            const response = await fetch('/api/campaign-viability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                facility,
                impacts,
                disasters: disastersList,
                acledData: acledEnabled ? acledData : null,
                acledEnabled
              })
            });

            if (response.ok) {
              const data = await response.json();
              return { facility, assessment: data };
            }
          } catch (error) {
            console.error('Error assessing facility:', facility.name, error);
          }

          return null;
        })
      );

      // Filter out failed assessments
      const validAssessments = assessments.filter(a => a !== null);

      // Categorize facilities by decision
      const byDecision = {
        'GO': [],
        'PROCEED WITH CAUTION': [],
        'DELAY RECOMMENDED': [],
        'DO NOT PROCEED': []
      };

      validAssessments.forEach(({ facility, assessment }) => {
        if (byDecision[assessment.decision]) {
          byDecision[assessment.decision].push({ facility, assessment });
        }
      });

      // Aggregate risks
      const riskCounts = {
        'CRITICAL': 0,
        'HIGH': 0,
        'MEDIUM': 0,
        'LOW': 0
      };

      const allRisks = [];
      validAssessments.forEach(({ assessment }) => {
        assessment.risks.forEach(risk => {
          riskCounts[risk.severity] = (riskCounts[risk.severity] || 0) + 1;

          // Track unique risk types
          const existingRisk = allRisks.find(r => r.factor === risk.factor);
          if (existingRisk) {
            existingRisk.count++;
            existingRisk.facilities.push(assessment.facilityName);
          } else {
            allRisks.push({
              ...risk,
              count: 1,
              facilities: [assessment.facilityName]
            });
          }
        });
      });

      // Calculate average viability score
      const avgScore = validAssessments.length > 0
        ? Math.round(validAssessments.reduce((sum, { assessment }) =>
            sum + assessment.viabilityScore, 0) / validAssessments.length)
        : 0;

      // Calculate resource needs (simplified)
      const resourceNeeds = calculateResourceNeeds(validAssessments);

      setDashboardData({
        totalFacilities: facilities.length,
        assessed: validAssessments.length,
        byDecision,
        averageViability: avgScore,
        riskCounts,
        topRisks: allRisks.sort((a, b) => b.count - a.count).slice(0, 5),
        resourceNeeds
      });

    } catch (error) {
      console.error('Error calculating dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateResourceNeeds = (assessments) => {
    const needs = {
      mobileTeams: 0,
      actIncrease: 0,
      facilitiesNeedingAlternatives: [],
      securityProtocols: 0
    };

    assessments.forEach(({ facility, assessment }) => {
      // Check if mobile teams recommended
      if (assessment.risks.some(r => r.factor.includes('Displacement') || r.factor.includes('Access'))) {
        needs.mobileTeams++;
      }

      // Check if malaria surge expected
      if (assessment.risks.some(r => r.factor.includes('Waterborne') || r.factor.includes('Malaria'))) {
        needs.actIncrease += 50; // 50% increase per affected facility
      }

      // Check if facility needs alternatives
      if (assessment.decision === 'DO NOT PROCEED' || assessment.decision === 'DELAY RECOMMENDED') {
        needs.facilitiesNeedingAlternatives.push(facility.name);
      }

      // Check security protocols needed
      if (assessment.risks.some(r => r.factor.includes('Security'))) {
        needs.securityProtocols++;
      }
    });

    return needs;
  };

  const handleExportBrief = async () => {
    if (!dashboardData) return;

    try {
      // Format resource needs for export
      const resourceNeeds = [];
      if (dashboardData.resourceNeeds.mobileTeams > 0) {
        resourceNeeds.push(`Deploy ${dashboardData.resourceNeeds.mobileTeams} mobile team${dashboardData.resourceNeeds.mobileTeams > 1 ? 's' : ''} for displaced populations`);
      }
      if (dashboardData.resourceNeeds.actIncrease > 0) {
        resourceNeeds.push(`Increase ACT/RDT stock by ${dashboardData.resourceNeeds.actIncrease}% for malaria surge`);
      }
      if (dashboardData.resourceNeeds.securityProtocols > 0) {
        resourceNeeds.push(`${dashboardData.resourceNeeds.securityProtocols} ${dashboardData.resourceNeeds.securityProtocols > 1 ? 'facilities require' : 'facility requires'} enhanced security measures`);
      }
      if (dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 0) {
        resourceNeeds.push(`${dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length} ${dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 1 ? 'facilities need' : 'facility needs'} alternative approaches`);
      }

      // Format facilities by status for export
      const facilitiesByStatus = {
        go: dashboardData.byDecision['GO'] || [],
        caution: dashboardData.byDecision['PROCEED WITH CAUTION'] || [],
        delay: dashboardData.byDecision['DELAY RECOMMENDED'] || [],
        noGo: dashboardData.byDecision['DO NOT PROCEED'] || []
      };

      const response = await fetch('/api/export-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefType: 'system',
          data: {
            overallScore: dashboardData.averageViability,
            facilitiesByStatus,
            topRisks: dashboardData.topRisks,
            resourceNeeds,
            timestamp: new Date().toISOString(),
            totalFacilities: dashboardData.totalFacilities
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
        alert('Failed to generate decision brief');
      }
    } catch (error) {
      console.error('Error exporting brief:', error);
      alert('Error generating decision brief');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="drawer-backdrop open"
        onClick={onClose}
        style={{ zIndex: 4000 }}
      />

      <div
        className="drawer drawer-right open"
        style={{
          zIndex: 4001,
          width: '600px',
          maxWidth: '90vw'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 20px -20px',
          padding: '20px'
        }}>
          <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Campaign Readiness Dashboard
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>

        <div className="drawer-content" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>
          {loading ? (
            <div style={{textAlign: 'center', padding: '40px 0'}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', marginBottom: '15px' }}>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
              <p>Analyzing campaign readiness across all facilities...</p>
            </div>
          ) : dashboardData ? (
            <>
              {/* Overall Readiness Score */}
              <div style={{
                backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                background: dashboardData.averageViability >= 70 ? '#4CAF50' :
                          dashboardData.averageViability >= 40 ? '#FF9800' :
                          dashboardData.averageViability >= 20 ? '#FFC107' : '#F44336',
                color: 'white',
                padding: '25px',
                borderRadius: '12px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>
                  Overall Campaign Readiness
                </div>
                <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '5px' }}>
                  {dashboardData.averageViability}
                </div>
                <div style={{ fontSize: '16px', opacity: 0.9 }}>
                  out of 100
                </div>
                <div style={{ fontSize: '13px', marginTop: '10px', opacity: 0.8 }}>
                  {dashboardData.assessed} of {dashboardData.totalFacilities} facilities assessed
                </div>
              </div>

              {/* Facilities by Decision */}
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ fontSize: '16px', marginBottom: '15px', color: 'var(--aidstack-navy)' }}>
                  Facility Status Breakdown
                </h4>

                {Object.entries(dashboardData.byDecision).map(([decision, items]) => {
                  const color =
                    decision === 'GO' ? '#4CAF50' :
                    decision === 'PROCEED WITH CAUTION' ? '#FF9800' :
                    decision === 'DELAY RECOMMENDED' ? '#FFC107' : '#F44336';

                  const icon =
                    decision === 'GO' ? '✅' :
                    decision === 'PROCEED WITH CAUTION' ? '⚠️' :
                    decision === 'DELAY RECOMMENDED' ? '⏸️' : '🛑';

                  return (
                    <div key={decision} style={{
                      backgroundColor: `${color}15`,
                      border: `2px solid ${color}`,
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{icon}</span>
                          <span style={{ fontWeight: 'bold', color: color }}>{decision}</span>
                        </div>
                        <div style={{
                          backgroundColor: color,
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>
                          {items.length}
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                          {items.length <= 5
                            ? items.map(({ facility }) => facility.name).join(', ')
                            : `${items.slice(0, 5).map(({ facility }) => facility.name).join(', ')} and ${items.length - 5} more...`
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Top Risks */}
              {dashboardData.topRisks.length > 0 && (
                <div style={{ marginBottom: '25px' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '15px', color: 'var(--aidstack-navy)' }}>
                    Top Risk Factors (System-wide)
                  </h4>

                  {dashboardData.topRisks.map((risk, idx) => (
                    <div key={idx} style={{
                      backgroundColor: '#f5f5f5',
                      borderLeft: `4px solid ${
                        risk.severity === 'CRITICAL' ? '#f44336' :
                        risk.severity === 'HIGH' ? '#ff9800' :
                        risk.severity === 'MEDIUM' ? '#ffc107' : '#9e9e9e'
                      }`,
                      padding: '12px',
                      marginBottom: '10px',
                      borderRadius: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{risk.icon}</span>
                            <span>{risk.factor}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Affects {risk.count} {risk.count === 1 ? 'facility' : 'facilities'}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '4px 8px',
                          borderRadius: '10px',
                          backgroundColor:
                            risk.severity === 'CRITICAL' ? '#f44336' :
                            risk.severity === 'HIGH' ? '#ff9800' :
                            risk.severity === 'MEDIUM' ? '#ffc107' : '#9e9e9e',
                          color: 'white'
                        }}>
                          {risk.severity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resource Needs */}
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ fontSize: '16px', marginBottom: '15px', color: 'var(--aidstack-navy)' }}>
                  System-wide Resource Needs
                </h4>

                <div style={{
                  backgroundColor: '#e3f2fd',
                  border: '1px solid #2196F3',
                  borderRadius: '8px',
                  padding: '15px'
                }}>
                  {/* Show all resource needs, with positive message if none needed */}
                  {dashboardData.resourceNeeds.mobileTeams > 0 ? (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🚐</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#1976D2' }}>Mobile Teams Needed</div>
                        <div style={{ fontSize: '13px', color: '#555' }}>
                          Deploy {dashboardData.resourceNeeds.mobileTeams} mobile team{dashboardData.resourceNeeds.mobileTeams > 1 ? 's' : ''} for displaced populations
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dashboardData.resourceNeeds.actIncrease > 0 ? (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>💊</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#1976D2' }}>ACT/RDT Stock Increase</div>
                        <div style={{ fontSize: '13px', color: '#555' }}>
                          Increase stock by {dashboardData.resourceNeeds.actIncrease}% for malaria surge
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dashboardData.resourceNeeds.securityProtocols > 0 ? (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🔒</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#1976D2' }}>Security Protocols</div>
                        <div style={{ fontSize: '13px', color: '#555' }}>
                          {dashboardData.resourceNeeds.securityProtocols} {dashboardData.resourceNeeds.securityProtocols > 1 ? 'facilities require' : 'facility requires'} enhanced security measures
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 0 ? (
                    <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🔄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#1976D2' }}>Alternative Strategies</div>
                        <div style={{ fontSize: '13px', color: '#555' }}>
                          {dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length} {dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 1 ? 'facilities need' : 'facility needs'} alternative approaches
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Show positive message if no special needs */}
                  {dashboardData.resourceNeeds.mobileTeams === 0 &&
                   dashboardData.resourceNeeds.actIncrease === 0 &&
                   dashboardData.resourceNeeds.securityProtocols === 0 &&
                   dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>✅</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#4CAF50' }}>No Additional Resources Needed</div>
                        <div style={{ fontSize: '13px', color: '#555' }}>
                          All facilities can proceed with standard campaign resources. No special interventions required.
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Summary */}
                  <div style={{
                    marginTop: dashboardData.resourceNeeds.mobileTeams > 0 ||
                               dashboardData.resourceNeeds.actIncrease > 0 ||
                               dashboardData.resourceNeeds.securityProtocols > 0 ||
                               dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 0 ? '15px' : '10px',
                    paddingTop: dashboardData.resourceNeeds.mobileTeams > 0 ||
                                dashboardData.resourceNeeds.actIncrease > 0 ||
                                dashboardData.resourceNeeds.securityProtocols > 0 ||
                                dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 0 ? '15px' : '0',
                    borderTop: dashboardData.resourceNeeds.mobileTeams > 0 ||
                               dashboardData.resourceNeeds.actIncrease > 0 ||
                               dashboardData.resourceNeeds.securityProtocols > 0 ||
                               dashboardData.resourceNeeds.facilitiesNeedingAlternatives.length > 0 ? '1px solid rgba(33, 150, 243, 0.3)' : 'none',
                    fontSize: '12px',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    💡 Tip: Click individual facilities for detailed viability assessments and AI recommendations
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                  onClick={handleExportBrief}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'var(--aidstack-orange)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Export Brief
                </button>

                <button
                  onClick={calculateDashboard}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'var(--aidstack-navy)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Refresh
                </button>
              </div>
            </>
          ) : (
            <div style={{textAlign: 'center', padding: '40px 0', color: '#666'}}>
              No facilities to assess
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default CampaignDashboard;
