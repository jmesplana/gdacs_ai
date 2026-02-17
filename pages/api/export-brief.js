/**
 * Campaign Decision Brief Export API
 * Generates a formatted HTML document suitable for printing or PDF export
 * Includes campaign viability assessment, security analysis, and recommendations
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { briefType, data } = req.body;

    if (!briefType || !data) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    let htmlContent;

    if (briefType === 'facility') {
      // Individual facility decision brief
      htmlContent = generateFacilityBrief(data);
    } else if (briefType === 'system') {
      // System-wide campaign readiness brief
      htmlContent = generateSystemBrief(data);
    } else {
      return res.status(400).json({ error: 'Invalid brief type' });
    }

    res.status(200).json({ html: htmlContent });
  } catch (error) {
    console.error('Error generating brief:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Generate individual facility decision brief
 */
function generateFacilityBrief(data) {
  const {
    facility,
    viability,
    security,
    impact,
    timestamp
  } = data;

  const date = new Date(timestamp || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Determine decision color
  const decisionColor = getDecisionColor(viability.decision);
  const securityColor = getSecurityColor(security?.securityLevel);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Campaign Decision Brief - ${facility.name}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.4;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm;
      font-size: 10pt;
    }

    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .title {
      font-size: 18pt;
      font-weight: bold;
      color: #1e40af;
      margin: 0;
    }

    .subtitle {
      font-size: 10pt;
      color: #666;
      margin: 4px 0 0 0;
    }

    .section {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 6px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 2px;
    }

    .decision-box {
      background-color: ${decisionColor};
      color: white;
      padding: 12px;
      border-radius: 4px;
      text-align: center;
      margin: 12px 0;
      font-size: 14pt;
      font-weight: bold;
    }

    .score-bar {
      background-color: #e5e7eb;
      height: 24px;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      margin: 8px 0;
    }

    .score-fill {
      background-color: ${decisionColor};
      height: 100%;
      width: ${viability.score}%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 10pt;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
    }

    .info-item {
      background-color: #f9fafb;
      padding: 6px;
      border-radius: 3px;
      font-size: 9pt;
    }

    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .risk-item {
      background-color: #fef2f2;
      border-left: 3px solid #dc2626;
      padding: 6px;
      margin: 4px 0;
      font-size: 9pt;
    }

    .risk-high {
      background-color: #fef2f2;
      border-left-color: #dc2626;
    }

    .risk-medium {
      background-color: #fffbeb;
      border-left-color: #f59e0b;
    }

    .risk-low {
      background-color: #f0fdf4;
      border-left-color: #10b981;
    }

    .recommendation {
      background-color: #eff6ff;
      border-left: 3px solid #2563eb;
      padding: 8px;
      margin: 6px 0;
      font-size: 9pt;
    }

    .security-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 9pt;
      background-color: ${securityColor};
      color: white;
    }

    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }

    ul {
      margin: 4px 0;
      padding-left: 20px;
    }

    li {
      margin: 3px 0;
      font-size: 9pt;
    }

    @media print {
      body {
        padding: 0;
      }

      .decision-box, .recommendation, .risk-item {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">Campaign Decision Brief</h1>
    <p class="subtitle">${facility.name} • ${date}</p>
  </div>

  <div class="decision-box">
    ${viability.decision}
  </div>

  <div class="section">
    <div class="section-title">Campaign Viability Assessment</div>
    <div class="score-bar">
      <div class="score-fill">
        Viability Score: ${viability.score}/100
      </div>
    </div>
    ${viability.timeline ? `<p><strong>Recommended Timeline:</strong> ${viability.timeline}</p>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Facility Information</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Location</div>
        ${facility.latitude.toFixed(4)}, ${facility.longitude.toFixed(4)}
      </div>
      ${facility.country ? `
      <div class="info-item">
        <div class="info-label">Country</div>
        ${facility.country}
      </div>
      ` : ''}
      ${facility.region ? `
      <div class="info-item">
        <div class="info-label">Region</div>
        ${facility.region}
      </div>
      ` : ''}
      ${facility.district ? `
      <div class="info-item">
        <div class="info-label">District</div>
        ${facility.district}
      </div>
      ` : ''}
      ${facility.population ? `
      <div class="info-item">
        <div class="info-label">Population</div>
        ${facility.population.toLocaleString()}
      </div>
      ` : ''}
      ${impact?.nearestDisaster ? `
      <div class="info-item">
        <div class="info-label">Nearest Disaster</div>
        ${impact.nearestDisaster.name} (${impact.nearestDisaster.distance.toFixed(1)} km)
      </div>
      ` : ''}
    </div>
  </div>

  ${security ? `
  <div class="section">
    <div class="section-title">Security Assessment</div>
    <p><strong>Security Level:</strong> <span class="security-badge">${security.securityLevel}</span></p>
    ${security.assessment ? `
      <div style="font-size: 9pt; margin-top: 6px;">
        ${formatSecurityAssessment(security.assessment)}
      </div>
    ` : ''}
  </div>
  ` : ''}

  ${viability.risks && viability.risks.length > 0 ? `
  <div class="section">
    <div class="section-title">Key Risk Factors</div>
    ${viability.risks.map(risk => `
      <div class="risk-item risk-${risk.severity.toLowerCase()}">
        <strong>${risk.factor}</strong> (${risk.severity})
        ${risk.detail ? `<br/>${risk.detail}` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${viability.resourceNeeds && viability.resourceNeeds.length > 0 ? `
  <div class="section">
    <div class="section-title">Resource Requirements</div>
    <ul>
      ${viability.resourceNeeds.map(need => `<li>${need}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  ${viability.aiRecommendations ? `
  <div class="section">
    <div class="section-title">AI-Generated Recommendations</div>
    <div class="recommendation">
      ${formatRecommendations(viability.aiRecommendations)}
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated by GDACS Facilities AI • Alliance for Malaria Prevention Standards • ${date}</p>
    <p style="margin-top: 4px; font-size: 7pt;">This assessment is based on real-time disaster data, security analysis, and AI-powered recommendations following AMP best practices.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate system-wide campaign readiness brief
 */
function generateSystemBrief(data) {
  const {
    overallScore,
    facilitiesByStatus,
    topRisks,
    resourceNeeds,
    timestamp,
    totalFacilities
  } = data;

  const date = new Date(timestamp || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const scoreColor = getDecisionColor(
    overallScore >= 70 ? 'GO' : overallScore >= 40 ? 'PROCEED WITH CAUTION' : 'DELAY RECOMMENDED'
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Campaign Readiness Brief - System Overview</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.4;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm;
      font-size: 10pt;
    }

    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .title {
      font-size: 18pt;
      font-weight: bold;
      color: #1e40af;
      margin: 0;
    }

    .subtitle {
      font-size: 10pt;
      color: #666;
      margin: 4px 0 0 0;
    }

    .section {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 11pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 6px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 2px;
    }

    .score-box {
      background-color: ${scoreColor};
      color: white;
      padding: 16px;
      border-radius: 4px;
      text-align: center;
      margin: 12px 0;
    }

    .score-number {
      font-size: 36pt;
      font-weight: bold;
      margin: 0;
    }

    .score-label {
      font-size: 10pt;
      margin-top: 4px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 8px 0;
    }

    .status-card {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px;
      font-size: 9pt;
    }

    .status-header {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 10pt;
    }

    .status-go {
      border-left: 4px solid #10b981;
      background-color: #f0fdf4;
    }

    .status-caution {
      border-left: 4px solid #f59e0b;
      background-color: #fffbeb;
    }

    .status-delay {
      border-left: 4px solid #f97316;
      background-color: #fff7ed;
    }

    .status-no-go {
      border-left: 4px solid #dc2626;
      background-color: #fef2f2;
    }

    .risk-item {
      background-color: #fef2f2;
      border-left: 3px solid #dc2626;
      padding: 6px;
      margin: 4px 0;
      font-size: 9pt;
    }

    .resource-item {
      background-color: #eff6ff;
      border-left: 3px solid #2563eb;
      padding: 6px;
      margin: 4px 0;
      font-size: 9pt;
    }

    .footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }

    .facility-list {
      font-size: 8pt;
      color: #666;
      margin-top: 4px;
      line-height: 1.3;
    }

    @media print {
      body {
        padding: 0;
      }

      .score-box, .status-card, .risk-item, .resource-item {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">Campaign Readiness Brief</h1>
    <p class="subtitle">System-Wide Assessment • ${totalFacilities} Facilities • ${date}</p>
  </div>

  <div class="score-box">
    <div class="score-number">${overallScore}</div>
    <div class="score-label">Overall Readiness Score (out of 100)</div>
  </div>

  <div class="section">
    <div class="section-title">Facilities by Status</div>
    <div class="status-grid">
      ${facilitiesByStatus.go && facilitiesByStatus.go.length > 0 ? `
      <div class="status-card status-go">
        <div class="status-header">✓ GO (${facilitiesByStatus.go.length})</div>
        <div class="facility-list">
          ${facilitiesByStatus.go.length <= 5
            ? facilitiesByStatus.go.map(f => f.facility.name).join(', ')
            : `${facilitiesByStatus.go.slice(0, 5).map(f => f.facility.name).join(', ')} and ${facilitiesByStatus.go.length - 5} more...`
          }
        </div>
      </div>
      ` : ''}

      ${facilitiesByStatus.caution && facilitiesByStatus.caution.length > 0 ? `
      <div class="status-card status-caution">
        <div class="status-header">⚠ PROCEED WITH CAUTION (${facilitiesByStatus.caution.length})</div>
        <div class="facility-list">
          ${facilitiesByStatus.caution.length <= 5
            ? facilitiesByStatus.caution.map(f => f.facility.name).join(', ')
            : `${facilitiesByStatus.caution.slice(0, 5).map(f => f.facility.name).join(', ')} and ${facilitiesByStatus.caution.length - 5} more...`
          }
        </div>
      </div>
      ` : ''}

      ${facilitiesByStatus.delay && facilitiesByStatus.delay.length > 0 ? `
      <div class="status-card status-delay">
        <div class="status-header">⏸ DELAY RECOMMENDED (${facilitiesByStatus.delay.length})</div>
        <div class="facility-list">
          ${facilitiesByStatus.delay.length <= 5
            ? facilitiesByStatus.delay.map(f => f.facility.name).join(', ')
            : `${facilitiesByStatus.delay.slice(0, 5).map(f => f.facility.name).join(', ')} and ${facilitiesByStatus.delay.length - 5} more...`
          }
        </div>
      </div>
      ` : ''}

      ${facilitiesByStatus.noGo && facilitiesByStatus.noGo.length > 0 ? `
      <div class="status-card status-no-go">
        <div class="status-header">✖ DO NOT PROCEED (${facilitiesByStatus.noGo.length})</div>
        <div class="facility-list">
          ${facilitiesByStatus.noGo.length <= 5
            ? facilitiesByStatus.noGo.map(f => f.facility.name).join(', ')
            : `${facilitiesByStatus.noGo.slice(0, 5).map(f => f.facility.name).join(', ')} and ${facilitiesByStatus.noGo.length - 5} more...`
          }
        </div>
      </div>
      ` : ''}
    </div>
  </div>

  ${topRisks && topRisks.length > 0 ? `
  <div class="section">
    <div class="section-title">Top System-Wide Risk Factors</div>
    ${topRisks.map((risk, index) => `
      <div class="risk-item">
        <strong>${index + 1}. ${risk.factor}</strong> (${risk.count} facilities affected)
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${resourceNeeds && resourceNeeds.length > 0 ? `
  <div class="section">
    <div class="section-title">System-Wide Resource Requirements</div>
    ${resourceNeeds.map(need => `
      <div class="resource-item">${need}</div>
    `).join('')}
  </div>
  ` : `
  <div class="section">
    <div class="section-title">System-Wide Resource Requirements</div>
    <div class="resource-item">✅ No Additional Resources Needed - All facilities within acceptable operating parameters</div>
  </div>
  `}

  <div class="section">
    <div class="section-title">Key Recommendations</div>
    <ul style="margin: 6px 0; padding-left: 20px; font-size: 9pt;">
      ${overallScore >= 70 ? `
        <li>System-wide readiness is HIGH. Proceed with campaign planning and execution.</li>
        <li>Monitor facilities marked "PROCEED WITH CAUTION" for any deteriorating conditions.</li>
        <li>Ensure resource allocation matches identified needs across all facilities.</li>
      ` : overallScore >= 40 ? `
        <li>System-wide readiness is MODERATE. Additional planning and resources required.</li>
        <li>Prioritize facilities with GO status for immediate campaign deployment.</li>
        <li>Develop contingency plans for CAUTION and DELAY facilities.</li>
        <li>Address top risk factors before proceeding with vulnerable facilities.</li>
      ` : `
        <li>System-wide readiness is LOW. Delay campaign until conditions improve.</li>
        <li>Focus on stabilizing facilities marked DELAY and DO NOT PROCEED.</li>
        <li>Address critical security and access constraints.</li>
        <li>Consider phased approach starting with GO facilities only.</li>
      `}
      <li>Follow AMP best practices for ITN/LLIN distribution and cLQAS assessment.</li>
      <li>Maintain regular security updates and reassess facility viability weekly.</li>
    </ul>
  </div>

  <div class="footer">
    <p>Generated by GDACS Facilities AI • Alliance for Malaria Prevention Standards • ${date}</p>
    <p style="margin-top: 4px; font-size: 7pt;">This assessment is based on real-time disaster data, security analysis, and AI-powered recommendations following AMP best practices.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Helper function to get decision color
 */
function getDecisionColor(decision) {
  if (!decision) return '#6b7280';

  if (decision.includes('GO') && !decision.includes('NO')) {
    return '#10b981'; // Green
  } else if (decision.includes('CAUTION')) {
    return '#f59e0b'; // Amber
  } else if (decision.includes('DELAY')) {
    return '#f97316'; // Orange
  } else if (decision.includes('DO NOT PROCEED') || decision.includes('DON\'T PROCEED')) {
    return '#dc2626'; // Red
  }
  return '#6b7280'; // Gray
}

/**
 * Helper function to get security level color
 */
function getSecurityColor(level) {
  if (!level) return '#6b7280';

  switch (level.toUpperCase()) {
    case 'LOW':
      return '#10b981'; // Green
    case 'MEDIUM':
      return '#f59e0b'; // Amber
    case 'HIGH':
      return '#f97316'; // Orange
    case 'CRITICAL':
      return '#dc2626'; // Red
    default:
      return '#6b7280'; // Gray
  }
}

/**
 * Format security assessment text for HTML
 */
function formatSecurityAssessment(text) {
  if (!text) return '';

  // Convert markdown-style headings to HTML
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin: 6px 0;">')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n/g, '<br/>');

  return `<p style="margin: 6px 0;">${formatted}</p>`;
}

/**
 * Format AI recommendations for HTML
 */
function formatRecommendations(text) {
  if (!text) return '';

  // Convert markdown-style formatting to HTML
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin: 6px 0;">')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n/g, '<br/>');

  return `<p style="margin: 6px 0;">${formatted}</p>`;
}
