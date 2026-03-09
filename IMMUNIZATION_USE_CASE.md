# Immunization Campaign Analysis - Use Case Guide

## Overview

This tool is **data-agnostic** and can analyze immunization campaign data alongside conflict events, natural disasters, and administrative boundaries. You don't need specialized features - simply upload your campaign data as "facilities" and the AI will analyze it.

---

## How It Works

### Step 1: Upload Your Campaign Data

Instead of uploading health facilities, upload **vaccination sites/districts** with campaign metrics.

**Example CSV Structure:**

```csv
name,latitude,longitude,target_population,children_vaccinated,children_missed,refusals,polio_cases,campaign_status,partner,coverage_rate,interruption_days
District A,1.234,32.567,50000,45000,5000,200,3,Active,PRCS,90,0
District B,2.345,33.678,30000,18000,12000,800,12,Paused,MoH,60,14
District C,3.456,34.789,40000,38000,2000,50,0,Active,UNICEF,95,0
```

### Step 2: Select AI Analysis Fields

When uploading, select which columns the AI should analyze:
- ✅ `target_population`
- ✅ `children_vaccinated`
- ✅ `children_missed`
- ✅ `refusals`
- ✅ `polio_cases`
- ✅ `campaign_status`
- ✅ `partner`
- ✅ `coverage_rate`
- ✅ `interruption_days`

### Step 3: Upload Supporting Data

- **ACLED conflict data** - To identify conflict-affected areas
- **Admin boundaries shapefile** - To map districts
- **GDACS disaster data** - Already loaded automatically

### Step 4: Ask Questions

Use the chatbot to analyze your data with natural language questions.

---

## Answering Key Operational Questions

### 1. Conflict Impact on Immunization

**Question:** "Did armed conflict impact immunization activities? In what area and how many expected to be unvaccinated?"

**How to Answer:**
1. Upload vaccination data with `campaign_status` and `children_missed` fields
2. Upload ACLED conflict data
3. Ask chatbot:
   - *"Which districts with paused campaigns are affected by conflict?"*
   - *"How many children are missed in conflict-affected districts?"*
   - *"Show correlation between ACLED events and campaign interruptions"*

**What You'll See:**
- Red markers = Districts with conflict + paused campaigns
- Green markers = Active campaigns in safe areas
- AI analysis: "District B has 800 ACLED events and paused campaign - 12,000 children missed"

**Map Visualization:**
- Facilities colored by campaign status (green=active, red=paused)
- Districts shaded by conflict risk level
- Easy identification of overlap between conflict and interrupted campaigns

---

### 2. Disease Case Mapping

**Question:** "Add disease cases (polio) to figure out where they are. Where is the current foothold of polio?"

**How to Answer:**
1. Upload facilities with `polio_cases` (or `afp_cases`, `cholera_cases`, etc.) column
2. Select `polio_cases` as AI analysis field
3. Ask chatbot:
   - *"Which districts have the most polio cases?"*
   - *"Show correlation between refusals and polio cases"*
   - *"Identify polio hotspots"*

**What AI Will Do:**
- Facilities list shows: `District B | polio_cases=12`
- Analyze patterns: "Districts with high refusals (District B: 800) also have high polio cases (12)"
- Identify transmission hotspots: "Districts B, D, F have 80% of all polio cases"

**Map Visualization:**
- Marker size can reflect case count
- Color intensity shows disease burden
- Spatial clustering reveals transmission patterns

---

### 3. Refusal Mapping & Mitigation

**Question:** "There are refusals, but where are they? How to mitigate?"

**How to Answer:**
1. Upload with `refusals` column (absolute number or percentage)
2. Select `refusals` as AI analysis field
3. Ask chatbot:
   - *"Which districts have the highest refusals?"*
   - *"Recommend mitigation strategies for high-refusal areas"*
   - *"Is there correlation between conflict and refusals?"*

**What AI Will Do:**
- Rank districts by refusal count/rate
- Identify patterns (e.g., refusals higher in conflict zones)
- Suggest: "Focus social mobilization in District B (800 refusals, 40% of missed children)"
- Recommend: "Deploy community health workers in top 5 refusal hotspots"

**Mitigation Recommendations:**
- Community engagement strategies
- Religious leader involvement
- Mobile team deployment
- Timing adjustments (avoid conflict periods)

---

### 4. Post-Campaign Coverage Analysis

**Question:** "Map missed and covered areas. What were contributions from PRCS and MoH?"

**How to Answer:**
1. Upload with `coverage_rate`, `children_vaccinated`, `children_missed`, `partner` columns
2. Select all as AI analysis fields
3. Ask chatbot:
   - *"Which districts have coverage below 80%?"*
   - *"Calculate total missed children across all districts"*
   - *"Compare coverage rates by partner (PRCS vs MoH vs UNICEF)"*
   - *"Which partner areas need catch-up campaigns?"*

**What AI Will Do:**
- Sum: `children_missed` across districts → "Total: 19,000 children missed"
- Identify low-coverage districts → "Districts B, D, F <80% coverage"
- Compare partners → "PRCS: 3 districts, avg 85% coverage; MoH: 2 districts, avg 65% coverage"
- Recommend: "Prioritize mop-up campaigns in MoH-supported districts"

**Coverage Visualization:**
- Districts colored by coverage % (green=high, red=low)
- Partner logos/labels on map
- Gap analysis dashboard

---

### 5. Campaign Pause/Resume Decisions

**Question:** "Show where to pause implementation based on high-risk areas"

**How to Answer:**
1. Upload vaccination sites with `campaign_status=Active`
2. Upload ACLED data and admin boundaries
3. Ask chatbot:
   - *"Which active campaigns are in high-risk districts?"*
   - *"Recommend which campaigns to pause for safety"*
   - *"When can we resume campaigns in District X?"*

**What AI Will Do:**
- Cross-reference active campaigns with district risk levels
- Recommend: "Pause campaigns in Districts X, Y (Very High Risk due to 50+ ACLED events in last 30 days)"
- Suggest: "Resume in District Z (risk downgraded to Medium, no events in 14 days)"
- Prioritize: "Maintain campaigns in safe districts A, C, E to prevent further immunity gaps"

**Decision Support:**
- Real-time risk assessment
- Safety thresholds
- Alternative timing recommendations
- Resource reallocation suggestions

---

### 6. Impact Quantification

**Question:** "What is the impact of interruption? Quantify how many children were not vaccinated or need to be revisited"

**How to Answer:**
1. Upload with `children_missed`, `interruption_days`, `target_population` columns
2. Ask chatbot:
   - *"What is the total number of missed children?"*
   - *"Calculate the impact of campaign interruptions by district"*
   - *"Estimate catch-up needs for next month"*

**What AI Will Do:**
- Sum `children_missed`: "19,000 children across 8 districts"
- Correlate with `interruption_days`: "14-day interruption in District B → 12,000 children missed (40% of target)"
- Calculate catch-up needs: "Districts B, D, F require immediate mop-up: 15,000 children"
- Estimate resources: "Need 30 mobile teams for 2 weeks to achieve 95% coverage"

**Quantified Metrics:**
- Total missed children (by district, by month)
- Interruption days vs coverage gap
- Catch-up campaign requirements
- Resource needs (teams, vaccines, days)

---

### 7. Joint WASH-OCV Analysis (Cholera Response)

**Question:** "Look into cholera, drought, flood. OCV/WASH. Joint WASH and OCV approach"

**How to Answer:**

**For Cholera Campaigns:**
1. Upload OCV campaign sites with columns:
   - `ocv_target`, `ocv_covered`, `ocv_coverage`
   - `wash_access` (% population with improved water)
   - `cholera_cases`, `cholera_deaths`
   - `flood_affected` (yes/no)

2. GDACS will automatically show floods/droughts

3. Ask chatbot:
   - *"Which districts need joint WASH-OCV intervention?"*
   - *"Correlate flood events with cholera cases"*
   - *"Prioritize districts for emergency OCV campaigns"*

**What AI Will Do:**
- Identify flood-affected districts with low WASH access
- Cross-reference with cholera case data
- Recommend: "Urgent joint WASH-OCV in District C (flood + 30% WASH access + 45 cholera cases)"
- Suggest: "WASH-only intervention in District E (flood + low WASH but no cholera yet - preventive)"
- Prioritize: "Top 3 districts for OCV: C, F, H (based on cases, flood risk, WASH gaps)"

**Integrated Analysis:**
- Flood extent overlaid with WASH coverage
- Cholera cases mapped against water sources
- OCV campaign gaps identified
- Multi-sector coordination recommendations

---

## Example Scenarios

### Scenario 1: Pakistan MR Campaign

**Context:** Measles-Rubella campaign interrupted by conflict in KP province

**Data to Upload:**
```csv
name,latitude,longitude,target_population,children_vaccinated,children_missed,refusals,measles_cases,campaign_status,partner,coverage_rate,interruption_days
Peshawar,34.0151,71.5249,500000,450000,50000,2000,45,Paused,MoH,90,21
Swat,35.2227,72.4258,300000,180000,120000,8000,89,Paused,PRCS,60,28
Mardan,34.1958,72.0447,250000,240000,10000,500,12,Active,UNICEF,96,0
```

**Questions to Ask:**
1. "Which districts should we prioritize for catch-up campaigns?"
2. "What is the correlation between conflict events and campaign interruptions?"
3. "Calculate total missed children in conflict-affected areas"
4. "Recommend timeline for campaign resumption"

**Expected AI Response:**
- "Swat district priority: 120,000 missed children, 28-day interruption, 89 measles cases, 8,000 refusals"
- "Conflict impact: 50+ ACLED events in Swat and Peshawar in last 30 days"
- "Recommendation: Wait 14 days for security improvement, then deploy 60 mobile teams"
- "Total catch-up need: 170,000 children in 2 districts"

---

### Scenario 2: Mozambique Cholera Response

**Context:** Floods in Zambezia province, cholera outbreak

**Data to Upload:**
```csv
name,latitude,longitude,population,ocv_target,ocv_covered,wash_access,cholera_cases,flood_affected,partner
Quelimane,-17.8786,36.8883,350000,280000,210000,45,234,yes,MSF
Mocuba,-16.8372,36.9856,180000,144000,130000,60,67,yes,UNICEF
Inhassunge,-18.0367,36.5833,90000,72000,68000,55,12,yes,MOH
```

**Questions to Ask:**
1. "Which districts need urgent joint WASH-OCV intervention?"
2. "Where are cholera cases highest relative to OCV coverage?"
3. "Prioritize flood-affected areas with low WASH access"

**Expected AI Response:**
- "Quelimane urgent priority: 234 cholera cases, 45% WASH access, 70,000 unvaccinated, flood-affected"
- "Recommendation: Joint WASH-OCV in Quelimane (MSF) + Mocuba (UNICEF)"
- "Gap: 84,000 people need OCV across 3 districts"
- "WASH focus: Quelimane needs emergency water treatment and sanitation"

---

## Sample Chatbot Questions

### Campaign Status & Coverage
- "Which districts have coverage below 80%?"
- "Show me all paused campaigns"
- "What is the average coverage rate across all districts?"
- "List districts by coverage rate from lowest to highest"
- "Which partner has the best performance?"

### Conflict & Security
- "Which active campaigns are in high-risk conflict areas?"
- "Recommend which campaigns to pause based on ACLED events"
- "Show correlation between conflict and campaign interruptions"
- "Is it safe to run campaigns in District X?"
- "When can we resume in conflict-affected districts?"

### Disease Surveillance
- "Which districts have the most polio cases?"
- "Where are disease hotspots?"
- "Correlate refusals with disease cases"
- "Identify transmission corridors"
- "Which zero-dose districts have disease cases?"

### Impact & Planning
- "Calculate total missed children across all districts"
- "Quantify the impact of the 2-week interruption"
- "How many children need catch-up vaccination?"
- "Estimate resources needed for mop-up campaigns"
- "Which districts should we prioritize for next month?"

### Cross-Sector (WASH + OCV)
- "Which flood-affected districts need OCV campaigns?"
- "Show districts with low WASH access and cholera cases"
- "Recommend joint WASH-OCV intervention areas"
- "Prioritize emergency response districts"

### Refusals & Social Mobilization
- "Where are refusals highest?"
- "Which districts need enhanced social mobilization?"
- "Is there correlation between conflict and refusals?"
- "Recommend mitigation strategies for high-refusal areas"

---

## CSV Template for Immunization Campaigns

### Required Columns
- `name` - District/area name
- `latitude` - Decimal degrees
- `longitude` - Decimal degrees

### Campaign Metrics (add as needed)
- `target_population` - Total children targeted
- `children_vaccinated` - Number vaccinated
- `children_missed` - Number not reached
- `coverage_rate` - Percentage (0-100)
- `campaign_status` - Active/Paused/Completed
- `interruption_days` - Days campaign was interrupted

### Disease Surveillance
- `polio_cases` or `afp_cases` - Polio/AFP case count
- `measles_cases` - Measles case count
- `cholera_cases` - Cholera case count
- `zero_dose` - Number of zero-dose children

### Program Quality
- `refusals` - Number or percentage of refusals
- `partner` - Implementing partner (MoH/PRCS/UNICEF/MSF)
- `teams_deployed` - Number of vaccination teams
- `supervision_score` - Quality score (0-100)

### WASH/OCV (Cholera)
- `ocv_target` - OCV campaign target
- `ocv_covered` - People vaccinated with OCV
- `wash_access` - % with improved water access
- `flood_affected` - yes/no

### Example Template

| name | latitude | longitude | target_population | children_vaccinated | children_missed | refusals | polio_cases | coverage_rate | campaign_status | partner | interruption_days |
|------|----------|-----------|-------------------|---------------------|-----------------|----------|-------------|---------------|-----------------|---------|-------------------|
| District A | 1.234 | 32.567 | 50000 | 45000 | 5000 | 200 | 3 | 90 | Active | PRCS | 0 |
| District B | 2.345 | 33.678 | 30000 | 18000 | 12000 | 800 | 12 | 60 | Paused | MoH | 14 |
| District C | 3.456 | 34.789 | 40000 | 38000 | 2000 | 50 | 0 | 95 | Active | UNICEF | 0 |
| District D | 4.567 | 35.890 | 25000 | 20000 | 5000 | 300 | 7 | 80 | Active | WHO | 0 |
| District E | 5.678 | 36.901 | 35000 | 14000 | 21000 | 1200 | 23 | 40 | Paused | MoH | 21 |

**Download as CSV:**
```csv
name,latitude,longitude,target_population,children_vaccinated,children_missed,refusals,polio_cases,coverage_rate,campaign_status,partner,interruption_days
District A,1.234,32.567,50000,45000,5000,200,3,90,Active,PRCS,0
District B,2.345,33.678,30000,18000,12000,800,12,60,Paused,MoH,14
District C,3.456,34.789,40000,38000,2000,50,0,95,Active,UNICEF,0
District D,4.567,35.890,25000,20000,5000,300,7,80,Active,WHO,0
District E,5.678,36.901,35000,14000,21000,1200,23,40,Paused,MoH,21
```

---

## Advantages of This Approach

### No Custom Development Needed
- ✅ Use existing facility upload (any CSV with lat/long)
- ✅ AI analysis fields work with ANY columns
- ✅ Chatbot analyzes YOUR specific data
- ✅ Multi-layer overlay (GDACS + ACLED + boundaries + campaigns)

### Flexible & Scalable
- Upload different campaigns (polio, measles, OCV, routine immunization)
- Add new metrics anytime (just add CSV columns)
- Works for any country/region
- Supports multiple partners

### Real-Time Intelligence
- Overlay campaigns with live conflict data (ACLED)
- Cross-reference with natural disasters (GDACS)
- District-level risk assessment
- AI-powered recommendations

### Evidence-Based Decisions
- Quantify impact (missed children, coverage gaps)
- Identify hotspots (disease, refusals, conflict)
- Prioritize interventions (catch-up, mop-up, emergency)
- Track partner performance

---

## Getting Started

1. **Prepare your data** using the CSV template above
2. **Upload to the tool:**
   - Go to facility upload
   - Select your campaign CSV
   - Choose AI analysis fields (target, vaccinated, missed, refusals, cases, etc.)
3. **Upload supporting data:**
   - Admin boundaries shapefile
   - ACLED conflict data (if analyzing conflict impact)
4. **Ask questions** using the chatbot
5. **Analyze results** on the map and in AI responses

---

## Support

For questions or technical support, contact the development team.

**Tool URL:** https://disasters.aidstack.ai

---

*Last updated: [March 9, 2026]*
