# Operational Outlook Feature

## Overview

The **Operational Outlook** feature replaces the previous "Download AI Report" button with a forward-looking humanitarian analysis dashboard. This tool helps humanitarian decision-makers understand not just what is happening now, but what is likely to happen next and why.

## Purpose

Unlike traditional situation reports that summarize past events, the Operational Outlook provides:
- **Forward-looking analysis** of humanitarian impacts
- **Scenario planning** (most likely, escalation, and stabilization)
- **Early warning indicators** to monitor
- **Operational implications** for response teams
- **Predictive intelligence** integrated with current situation data

## How It Works

### 1. Data Integration

The Operational Outlook analyzes multiple data sources:
- **GDACS Disaster Alerts** - Active disasters and hazard events
- **ACLED Conflict Data** - Security incidents and conflict trends
- **Health Facilities** - Infrastructure status and distribution
- **District Risk Assessment** - Geographic risk levels from shapefiles
- **Predictive Forecasts** - Weather-based disaster forecasts, disease outbreak predictions, supply chain disruptions

### 2. AI Analysis Structure

The AI generates a structured analysis following humanitarian best practices:

#### **1. Situation Overview**
Brief description of current situation including disasters, conflicts, and infrastructure status

#### **2. Key Signals**
Most important indicators from available data sources:
- Disaster alert levels
- Conflict event patterns
- Facility risk status
- Operational access constraints

#### **3. Humanitarian Drivers**
Structural factors shaping humanitarian risk:
- Infrastructure damage
- Population exposure and displacement
- Conflict dynamics
- Geographic access constraints
- Seasonal hazards and cascading risks

#### **4. Possible Developments**
Three scenario narratives:

**Most Likely Scenario** - What is most likely to happen based on current signals

**Escalation Scenario** - How the situation could worsen

**Stabilization Scenario** - How risks might stabilize or improve

#### **5. Early Warning Indicators**
Observable indicators that responders should monitor to understand which scenario may be unfolding

#### **6. Operational Implications**
How the evolving situation may affect humanitarian operations:
- Access to affected populations
- Logistics and infrastructure constraints
- Safety and security risks
- Potential humanitarian needs
- Service disruptions

#### **7. Key Uncertainties**
Important unknowns or assumptions due to missing data

## Technical Implementation

### API Endpoint: `/api/operational-outlook`

**File**: `/pages/api/operational-outlook.js`

**Request Body**:
```javascript
{
  facilities: [],        // Array of health facility objects
  disasters: [],         // Array of active GDACS disasters
  acledData: [],         // Array of ACLED conflict events
  districts: [],         // Array of district GeoJSON features
  predictions: {         // Optional: Predictive data
    disaster: {},        // From /api/disaster-forecast
    outbreak: {},        // From /api/outbreak-prediction
    supplyChain: {}      // From /api/supply-chain-forecast
  }
}
```

**Response**:
```javascript
{
  success: true,
  timestamp: "2026-03-05T00:00:00.000Z",
  outlook: "...markdown formatted analysis...",
  context: {
    facilitiesAnalyzed: 50,
    disastersMonitored: 3,
    securityEvents: 127,
    districtsIncluded: 25
  }
}
```

### Component: `OperationalOutlook.js`

**File**: `/components/OperationalOutlook.js`

**Features**:
- Automatic data collection from prediction APIs
- Real-time AI analysis generation
- Markdown formatting for readability
- Download as .md file capability
- Loading states and error handling
- Responsive modal design

### Integration in App

**Location**: `/pages/app.js`

**Button**: Replaced "Download AI Report" with "Operational Outlook"
- Orange Aidstack color
- Clock icon
- Disabled when no disasters or facilities loaded

**State Management**:
```javascript
const [showOperationalOutlook, setShowOperationalOutlook] = useState(false);
```

## User Experience

### 1. Click "Operational Outlook" Button
Located in the toolbar next to "View Forecast" button

### 2. Automatic Analysis Generation
The system:
1. Fetches disaster forecasts for the area
2. Retrieves disease outbreak predictions
3. Gets supply chain disruption assessments
4. Analyzes all available situation data
5. Generates forward-looking humanitarian outlook

### 3. View Structured Analysis
Modal dashboard displays:
- Full markdown-formatted analysis
- Structured sections with headers
- Bullet points and lists
- Clear scenario narratives

### 4. Download Report
Click "Download" button to save outlook as markdown file:
- Filename: `operational-outlook-YYYY-MM-DD.md`
- Format: Markdown (.md)
- Easy to share with stakeholders

## Use Cases

### 1. Pre-Disaster Planning
**Scenario**: Cyclone approaching coastal region

**Analysis Provides**:
- Most likely impact timeline
- Infrastructure at risk
- Population exposure estimates
- Pre-positioning recommendations
- Early warning indicators to monitor

### 2. Multi-Hazard Response
**Scenario**: Flooding + conflict in same region

**Analysis Provides**:
- Cascading risk assessment
- Access constraint analysis
- Compound humanitarian impacts
- Security vs. needs trade-offs
- Phased response scenarios

### 3. Post-Disaster Outlook
**Scenario**: Earthquake aftermath

**Analysis Provides**:
- Secondary hazard risks (aftershocks, landslides)
- Disease outbreak probability
- Supply chain recovery timeline
- Population displacement trends
- Stabilization indicators

### 4. Conflict-Affected Areas
**Scenario**: Ongoing violence + drought

**Analysis Provides**:
- Conflict dynamics analysis
- Humanitarian access windows
- Escalation triggers
- Protection concerns
- Operational risk assessment

## Example Output

```markdown
# Operational Outlook

## 1. Situation Overview

The Central African Republic is experiencing a compound humanitarian crisis with:
- 3 active GDACS disasters (floods, drought conditions)
- 127 conflict events in the last 30 days (47% increase from previous period)
- 50 health facilities in affected areas, 12 at high risk
- 8 districts with elevated risk levels

## 2. Key Signals

**Disaster Indicators**:
- Heavy rainfall forecasted (next 7-14 days)
- Flood risk: HIGH probability (75%)
- River levels rising in northern districts

**Conflict Trends**:
- Increase in "Battles" events (45 incidents)
- Concentration in western districts
- Attacks on civilians: 18 events (concern for protection)

**Infrastructure Status**:
- 12 facilities in high-risk zones
- Road access degraded in 5 districts
- Cold chain at MEDIUM risk

## 3. Humanitarian Drivers

**Flooding + Displacement**: Heavy rainfall will exacerbate existing displacement,
with populations moving to higher ground. This increases disease transmission risk
and strains host communities.

**Conflict Dynamics**: Armed group activity limits humanitarian access in western
districts, creating pockets of unmet need.

**Infrastructure Damage**: Road degradation isolates communities and delays
medical supply delivery.

## 4. Possible Developments

### Most Likely Scenario

Continued rainfall leads to moderate flooding in 3-5 districts over the next 2 weeks.
Displacement increases by 30-50%. Cholera cases begin rising by day 10-14.
Humanitarian access remains possible with enhanced security protocols.

### Escalation Scenario

Severe flooding affects 8+ districts. Major roads impassable for 2-3 weeks.
Cholera outbreak accelerates (200+ cases). Conflict spreads to new areas,
restricting humanitarian access. Cold chain failures lead to vaccine stock losses.

### Stabilization Scenario

Rainfall remains moderate. Flood prevention measures contain water levels.
Early health interventions prevent major outbreak. Conflict de-escalation
allows expanded humanitarian access. Supply chains adapt to road conditions.

## 5. Early Warning Indicators

Monitor these signals to understand which scenario is unfolding:

- **River gauge levels** in northern districts
- **Daily cholera case reports** from health facilities
- **ACLED conflict events** - watch for spread to new locations
- **Road accessibility reports** from logistics partners
- **Cold chain temperature logs** - indicator of infrastructure stress
- **Displacement figures** from camp management

## 6. Operational Implications

**Access**: Plan for alternative routes. Pre-position supplies in isolated areas.
Consider helicopter transport for critical supplies if road access degrades.

**Health Response**: Accelerate cholera preparedness (ORP stocks, treatment centers).
Mobile medical teams may be needed for displaced populations.

**Security**: Enhanced security protocols in western districts. Consider armed escorts
or negotiated access. Remote programming where direct access is not possible.

**Supply Chain**: Cold chain backup power critical. Road maintenance or temporary
bridges may be needed. Increase buffer stocks at field level.

## 7. Key Uncertainties

- **Rainfall intensity**: Forecasts show range of 50-150mm - significant impact difference
- **Conflict actors' intentions**: Unclear if violence will spread or stabilize
- **Government response capacity**: Unknown level of support available
- **Population movement patterns**: Displacement estimates have wide confidence intervals
- **Health facility capacity**: Limited data on facility preparedness levels
```

## Benefits

1. **Forward-Looking** - Focuses on what's coming, not just what happened
2. **Scenario-Based** - Provides multiple plausible futures for planning
3. **Actionable** - Clear operational implications for decision-makers
4. **Data-Driven** - Integrates all available data sources
5. **Predictive** - Incorporates weather, outbreak, and supply chain forecasts
6. **Structured** - Consistent format aids rapid comprehension
7. **Shareable** - Download as markdown for easy distribution

## AI Model

**Model**: OpenAI GPT-4o
**Temperature**: 0.7 (balanced creativity and consistency)
**Max Tokens**: 3000 (allows comprehensive analysis)

**System Prompt**: Configured as expert humanitarian analyst specializing in forward-looking operational assessments

## Cost Estimate

**Per Outlook Generation**:
- Disaster forecast API: Free (Open-Meteo)
- Outbreak prediction: ~$0.001 (GPT-3.5-turbo)
- Supply chain forecast: Free (no external calls)
- Operational outlook: ~$0.05 (GPT-4o with 3000 tokens)

**Total**: ~$0.051 per operational outlook

## Comparison with Previous "Download AI Report"

| Feature | Download AI Report (Old) | Operational Outlook (New) |
|---------|-------------------------|---------------------------|
| **Focus** | Past events summary | Future developments |
| **Format** | Word document | Interactive dashboard + markdown |
| **Analysis** | Descriptive | Predictive and prescriptive |
| **Scenarios** | No | Yes (3 scenarios) |
| **Early Warning** | No | Yes (indicators to monitor) |
| **Predictions** | Not integrated | Fully integrated |
| **Structure** | Generic | Humanitarian-specific |
| **Speed** | Slow (doc generation) | Fast (instant display) |
| **Use Case** | Reporting | Decision-making |

## Future Enhancements

### 1. Historical Pattern Analysis
Integrate historical disaster and conflict data to identify recurring patterns:
- "This region experiences floods every 3-5 years"
- "Conflict typically escalates during harvest season"
- Seasonal risk calendars

### 2. Population Movement Modeling
Use displacement algorithms to predict population flows:
- Where will people move?
- How many displaced persons expected?
- Host community stress points

### 3. Multi-Country Analysis
Extend outlook to cover regional crises:
- Cross-border displacement
- Regional conflict spillover
- Transnational disease spread

### 4. Automated Monitoring
Set up automated outlook generation:
- Daily or weekly scheduled updates
- Trigger alerts when key indicators change
- Email delivery to stakeholders

### 5. Customizable Templates
Allow users to define their own outlook structure:
- Program-specific sections (e.g., nutrition, WASH)
- Organization-specific frameworks
- Donor reporting requirements

## Testing

### Test the Operational Outlook

1. Load disaster data (GDACS)
2. Upload facilities and/or shapefiles
3. Optionally load ACLED data
4. Click "Operational Outlook" button
5. Wait for analysis generation (~10-30 seconds)
6. Review structured outlook
7. Download as markdown file

### Expected Result

A comprehensive forward-looking analysis with:
- Current situation assessment
- Key signals identified
- Humanitarian drivers explained
- 3 scenario narratives
- Early warning indicators
- Operational implications
- Key uncertainties

## Troubleshooting

### Issue: "AI service not available"
**Cause**: OpenAI API key not configured
**Solution**: Set `OPENAI_API_KEY` in `.env.local`

### Issue: Outlook takes too long
**Cause**: Multiple prediction API calls + AI generation
**Solution**:
- Check internet connection
- Verify prediction APIs are responding
- Consider reducing prediction integration

### Issue: Generic or vague analysis
**Cause**: Insufficient input data
**Solution**:
- Load more data sources (disasters, ACLED, facilities)
- Upload district shapefiles for geographic context
- Ensure data quality and completeness

### Issue: Analysis not downloading
**Cause**: Browser blocking download
**Solution**: Allow downloads from localhost in browser settings

## Credits

- **Concept**: Inspired by humanitarian foresight analysis practices
- **Structure**: Based on humanitarian decision-making frameworks
- **AI Model**: OpenAI GPT-4o
- **Integration**: Combines GDACS, ACLED, predictive analytics, and facility data
- **Development**: John Mark Esplana - Aidstack Platform
