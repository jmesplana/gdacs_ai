# Disaster & Conflict Impact Assessment Platform

**Live Demo:** [https://disasters.aidstack.ai](https://disasters.aidstack.ai)

A comprehensive platform for humanitarian and disaster response professionals to assess operational risks, analyze facility impacts, and make data-driven decisions using real-time disaster and conflict data.

---

## 🎯 Overview

This platform combines **natural disaster monitoring (GDACS)**, **conflict event tracking (ACLED)**, and **administrative boundary analysis** with AI-powered insights to support humanitarian operations, health campaigns, and emergency response planning.

---

## ✨ Core Features

### 🗺️ Multi-Layer Map Visualization
- **Interactive Map**: Street, satellite, and terrain views with seamless switching
- **Administrative Boundaries**: Upload shapefiles to visualize districts/regions with risk-level color coding
- **Facility Markers**: Square markers (green=safe, red=impacted) for easy visual differentiation
- **ACLED Conflict Events**: Circular markers showing security incidents (battles, violence, protests)
- **GDACS Disasters**: Real-time natural disaster alerts with polygon impact zones
- **Heatmap Overlay**: Intensity visualization for disaster clustering
- **Road Network**: Toggle road overlays for navigation context
- **Drawing Tools**: Annotate maps with polygons, circles, lines, and custom markers

### 📊 Data Integration
- **GDACS Natural Disasters**: Earthquakes, floods, cyclones, droughts, volcanoes (auto-updated)
- **ACLED Conflict Data**: Upload CSV with security events (battles, violence, protests, strategic developments)
- **Administrative Boundaries**: Upload shapefiles (SHP/GeoJSON) for district-level analysis
- **Facility Data**: Upload any CSV with coordinates (health facilities, vaccination sites, warehouses, etc.)
- **Custom Fields**: Select any columns for AI analysis (population, coverage rates, disease cases, etc.)

### 🤖 AI-Powered Analysis
- **Interactive Chatbot**: Ask natural language questions about your operational context
- **Campaign Viability**: Assess safety and feasibility for health campaigns by location
- **Impact Quantification**: Calculate missed populations, coverage gaps, resource needs
- **Operational Outlook**: Forward-looking analysis with scenario planning and early warning indicators
- **District Forecasts**: Predict conflict escalation, disease outbreaks, and supply chain disruptions
- **Contextual Recommendations**: Get specific guidance based on your uploaded data

### 📈 Assessment & Planning Tools
- **Facility Impact Assessment**: Automatic calculation of disaster/conflict proximity
- **District Risk Scoring**: Combined GDACS + ACLED risk levels (None/Low/Medium/High/Very High)
- **Campaign Dashboard**: Track vaccination/distribution campaigns across multiple districts
- **Operational Viability**: GO/NO-GO recommendations with specific timelines and mitigation strategies
- **Situation Reports**: Auto-generate structured SitReps for stakeholder sharing

### 🎨 Visual Differentiation
- **Facilities**: Square markers (easy to spot)
- **ACLED Events**: Circular markers (color-coded by event type)
- **Districts**: Polygon fills (color by risk level: blue→green→yellow→orange→red)
- **Clusters**: Grouped markers with count badges
- **Interactive Popups**: Detailed information on click

---

## 🏥 Use Cases

### 1. Immunization Campaign Planning
**Problem:** Need to determine which districts are safe for vaccination campaigns and quantify missed children in conflict-affected areas.

**Solution:**
- Upload vaccination sites as "facilities" with campaign metrics (target, covered, missed, refusals, disease cases)
- Upload ACLED conflict data and admin boundaries
- Ask chatbot: *"Which districts should I pause campaigns in due to security?"*
- Get AI analysis: District-by-district recommendations with risk levels and catch-up needs

**Example Questions:**
- "Calculate total missed children in conflict-affected districts"
- "Which districts have coverage below 80%?"
- "Correlate refusals with polio cases"
- "Recommend campaign timeline for District X"

**See detailed guide:** [IMMUNIZATION_USE_CASE.md](IMMUNIZATION_USE_CASE.md)

---

### 2. Humanitarian Access Planning
**Problem:** Assess operational access and safety for field teams across multiple locations.

**Solution:**
- Upload field office/warehouse locations
- Overlay ACLED conflict events and GDACS disasters
- View district-level risk maps
- Get AI recommendations for route planning and timing

**Example Questions:**
- "Which supply routes are safe this week?"
- "Show me no-go areas for field teams"
- "When can we resume operations in District Y?"
- "Recommend alternative access points for high-risk areas"

---

### 3. Cholera/OCV Response (WASH Integration)
**Problem:** Prioritize districts for joint WASH-OCV interventions after flooding.

**Solution:**
- Upload OCV campaign data (target, covered, WASH access %)
- Load GDACS flood data (automatic)
- Upload cholera case data
- Ask: *"Which flood-affected districts need urgent WASH-OCV intervention?"*

**Example Questions:**
- "Correlate flood events with cholera cases"
- "Which districts have low WASH access and high cholera burden?"
- "Prioritize emergency OCV campaigns by district"
- "Estimate resources needed for joint WASH-OCV response"

---

### 4. Supply Chain Risk Assessment
**Problem:** Identify supply chain vulnerabilities and predict disruptions.

**Solution:**
- Upload warehouse/distribution center locations
- Map transport routes with drawing tools
- Overlay conflict and disaster data
- Generate supply chain risk forecasts

**Example Questions:**
- "Which warehouses are at risk from flooding?"
- "Show conflict events along supply route A→B"
- "Predict supply disruptions for next 2 weeks"
- "Recommend pre-positioning locations for emergency stocks"

---

### 5. Disease Outbreak Response
**Problem:** Map disease cases, identify transmission hotspots, and plan rapid response.

**Solution:**
- Upload disease case data (AFP, measles, cholera) as "facilities"
- Include case counts, dates, and demographics in CSV
- Overlay with population density and health facility locations
- Get AI analysis of transmission patterns

**Example Questions:**
- "Where are polio transmission hotspots?"
- "Correlate measles cases with vaccination coverage gaps"
- "Which zero-dose districts have active disease transmission?"
- "Recommend rapid response team deployment locations"

---

### 6. Multi-Sector Needs Assessment
**Problem:** Conduct comprehensive area-based assessments combining multiple data sources.

**Solution:**
- Upload facilities from multiple sectors (health, WASH, education, shelter)
- Add admin boundaries with population data
- Overlay disasters and conflict events
- Generate integrated operational outlook

**Example Questions:**
- "Which districts have overlapping health, WASH, and protection needs?"
- "Prioritize areas for multi-sector response"
- "Show correlation between conflict and displacement patterns"
- "Generate 3-month operational forecast for Region X"

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or newer)
- npm or yarn
- OpenAI API key (for AI features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jmesplana/gdacs_ai.git
   cd gdacs_ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create `.env.local` in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📖 Usage Guide

### Step 1: Upload Data

**Option A: Admin Boundaries (Recommended First)**
1. Click "Upload Shapefile"
2. Select your .zip file containing .shp, .shx, .dbf files
3. Districts will appear on map with risk colors

**Option B: Facility/Site Data**
1. Prepare CSV with required columns: `name`, `latitude`, `longitude`
2. Add optional columns for AI analysis (population, coverage, cases, etc.)
3. Upload and select which columns the AI should analyze
4. Facilities appear as square markers

**Option C: ACLED Conflict Data**
1. Download ACLED data from [acleddata.com](https://acleddata.com)
2. Upload CSV with conflict events
3. Events appear as circular markers (color-coded by type)

### Step 2: Configure Filters
- **Date Range**: Filter disasters/conflicts by time period
- **Event Types**: Select specific ACLED event types to display
- **Geographic Focus**: Filter by country/region

### Step 3: Analyze
- **Click facilities** for detailed impact analysis
- **Ask chatbot questions** about your operational context
- **Generate reports** (SitReps, campaign viability, operational outlook)
- **View district forecasts** for forward planning

### Step 4: Export & Share
- Download situation reports
- Share map annotations
- Export analysis results

---

## 📋 CSV Data Format Examples

### Facility Upload (Flexible)
```csv
name,latitude,longitude,population,coverage_rate,cases,partner
District A,1.234,32.567,50000,90,3,UNICEF
District B,2.345,33.678,30000,60,12,MoH
```

### ACLED Data (Standard Format)
Download directly from [ACLED](https://acleddata.com) - no modification needed.

### Admin Boundaries
Upload shapefiles (.zip containing .shp/.shx/.dbf) or GeoJSON files.

---

## 🛠️ Technology Stack

### Frontend
- **Next.js** - React framework
- **Leaflet** - Interactive maps
- **React Leaflet** - React bindings for Leaflet
- **Leaflet.heat** - Heatmap visualization
- **MarkerClusterGroup** - Marker clustering

### Backend
- **Next.js API Routes** - Serverless functions
- **OpenAI API** - GPT-4 for AI analysis
- **Shapefile.js** - Shapefile parsing
- **PapaParse** - CSV parsing
- **Geolib** - Geospatial calculations

### Data Sources
- **GDACS** - Global Disaster Alert and Coordination System
- **ACLED** - Armed Conflict Location & Event Data Project
- **User-provided** - Custom facility and campaign data

---

## 🎨 Visual Design

### Marker Styles
- **Facilities**: 🟩🟥 Squares (green=safe, red=impacted)
- **ACLED Events**: 🔴🟠🟡 Circles (color by event type)
- **Clusters**: Rounded squares/circles with count badges

### District Colors
- 🔵 **Blue** - No risk
- 🟢 **Green** - Low risk
- 🟡 **Yellow** - Medium risk
- 🟠 **Orange** - High risk
- 🔴 **Red** - Very high risk

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear descriptions

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🔗 Links

- **Live Platform**: [https://disasters.aidstack.ai](https://disasters.aidstack.ai)
- **GitHub**: [https://github.com/jmesplana/gdacs_ai](https://github.com/jmesplana/gdacs_ai)
- **Immunization Use Case Guide**: [IMMUNIZATION_USE_CASE.md](IMMUNIZATION_USE_CASE.md)

---

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Contact: [Your contact info]

---

**Built for humanitarian responders, by humanitarian responders.**
