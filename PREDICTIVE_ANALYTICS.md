# Predictive Analytics System

## Overview

The Predictive Analytics system adds **forward-looking intelligence** to your disaster response platform. Instead of only reacting to current disasters, you can now:

- 📊 **Predict future disaster risks** (floods, droughts, cyclones, heatwaves) based on weather forecasts
- 🦠 **Forecast disease outbreaks** (cholera, malaria, measles, diarrhea) following disasters
- 📦 **Anticipate supply chain disruptions** (cold chain, roads, air transport)

---

## Features Implemented

### 1. **Weather-Based Disaster Forecasting**
- **7-14 day outlook** for floods, droughts, heatwaves, cyclones
- **Risk scoring** (CRITICAL, HIGH, MEDIUM, LOW)
- **Automated recommendations** for each risk level
- **Peak day predictions** (when risk is highest)

### 2. **Disease Outbreak Prediction**
- **Epidemiological models** for 4 diseases (cholera, malaria, measles, diarrhea)
- **Case projections** over 30 days using exponential growth models
- **AI-enhanced analysis** using your existing OpenAI API key
- **Risk factor weighting** (flooding, WASH damage, temperature, displacement)

### 3. **Supply Chain Disruption Forecasting**
- **Cold chain risk** (power outages, temperature extremes)
- **Road access** (flooding, earthquakes, landslides)
- **Air transport** (cyclones, volcanic ash, high winds)
- **Recovery time estimates**

---

## API Endpoints Created

### `/api/weather-forecast` (GET/POST)
Fetches weather forecasts from Open-Meteo with server-side caching.

**Parameters:**
```json
{
  "latitude": 6.5,
  "longitude": 3.4,
  "days": 7
}
```

**Response:**
```json
{
  "latitude": 6.5,
  "longitude": 3.4,
  "daily": {
    "time": ["2025-03-04", "2025-03-05", ...],
    "temperature_2m_max": [32.5, 33.1, ...],
    "precipitation_sum": [0, 5.2, 15.7, ...]
  },
  "cached": true,
  "source": "cache"
}
```

**Caching:** 6-hour cache per location (reduces API calls by ~95%)

---

### `/api/disaster-forecast` (POST)
Predicts future disaster risks based on weather.

**Parameters:**
```json
{
  "latitude": 6.5,
  "longitude": 3.4,
  "days": 7
}
```

**Response:**
```json
{
  "flood": {
    "riskLevel": "HIGH",
    "probability": 75,
    "peakDay": "2025-03-07",
    "maxDailyRainfall": 95,
    "totalRainfall": 145
  },
  "drought": { "riskLevel": "LOW", "probability": 15 },
  "cyclone": { "isInSeason": true, "basin": "indian", "riskLevel": "MEDIUM" },
  "heatwave": { "riskLevel": "MEDIUM", "peakTemperature": 38.5 },
  "summary": {
    "overallRisk": "HIGH",
    "primaryThreats": [{ "type": "Flooding", "level": "HIGH", "probability": 75 }],
    "recommendedActions": ["Move equipment to higher ground", "Check drainage systems"]
  }
}
```

---

### `/api/outbreak-prediction` (POST)
Forecasts disease outbreak risks.

**Parameters:**
```json
{
  "latitude": 6.5,
  "longitude": 3.4,
  "disasters": [{ "eventtype": "Flood", "alertlevel": "Orange" }],
  "populationEstimate": 50000,
  "washFacilitiesDamaged": 3,
  "healthFacilitiesDamaged": 1,
  "displacedPopulation": 5000,
  "forecastDays": 30
}
```

**Response:**
```json
{
  "predictions": {
    "cholera": {
      "disease": "Cholera",
      "risk": "HIGH",
      "probability": 68,
      "peakDay": 14,
      "casePredictions": [
        { "day": 0, "cases": 5, "incidenceRate": 0.1 },
        { "day": 7, "cases": 45, "incidenceRate": 0.9 },
        { "day": 14, "cases": 180, "incidenceRate": 3.6 }
      ]
    },
    "malaria": { ... },
    "diarrhea": { ... }
  },
  "topThreats": [
    { "disease": "cholera", "level": "HIGH", "probability": 68 }
  ],
  "aiAnalysis": "The primary concern is cholera risk due to flooding and damaged WASH infrastructure..."
}
```

---

### `/api/supply-chain-forecast` (POST)
Predicts logistical disruptions.

**Parameters:**
```json
{
  "latitude": 6.5,
  "longitude": 3.4,
  "disasters": [{ "eventtype": "Tropical Cyclone", "alertlevel": "Red" }],
  "forecastDays": 14
}
```

**Response:**
```json
{
  "coldChain": {
    "riskLevel": "CRITICAL",
    "probability": 90,
    "estimatedDurationDays": 10,
    "threats": [{ "source": "Tropical Cyclone", "probability": 90, "expectedDuration": 10 }],
    "recommendations": ["Test backup generators immediately", "Secure 7-day fuel supply"]
  },
  "roadAccess": { "riskLevel": "HIGH", "estimatedRecoveryDays": 14 },
  "airTransport": { "riskLevel": "CRITICAL", "probability": 100 },
  "overallAssessment": {
    "overallRisk": "CRITICAL",
    "criticalComponents": ["Cold Chain", "Air Transport"],
    "primaryThreat": "Cold Chain"
  }
}
```

---

## How to Use

### Option 1: Through the Prediction Dashboard UI

1. **Add the PredictionDashboard component** to your main app:

```javascript
// In your main page component
import PredictionDashboard from '../components/PredictionDashboard';

const [showPredictions, setShowPredictions] = useState(false);

// Add a button to open predictions
<button onClick={() => setShowPredictions(true)}>
  🔮 View Predictions
</button>

// Render dashboard
{showPredictions && (
  <PredictionDashboard
    facilities={facilities}
    disasters={disasters}
    onClose={() => setShowPredictions(false)}
  />
)}
```

2. **The dashboard will automatically:**
   - Calculate the geographic center of your facilities
   - Fetch weather forecasts
   - Generate disaster predictions
   - Predict disease outbreaks
   - Assess supply chain risks

### Option 2: Direct API Calls

```javascript
// Get weather forecast
const weather = await fetch('/api/weather-forecast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latitude: 6.5, longitude: 3.4, days: 7 })
}).then(r => r.json());

// Get disaster forecast
const forecast = await fetch('/api/disaster-forecast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latitude: 6.5, longitude: 3.4, days: 7 })
}).then(r => r.json());
```

---

## Data Sources (All FREE, No API Keys Required)

### Primary: Open-Meteo
- **URL:** https://api.open-meteo.com
- **API Key:** ❌ **NOT REQUIRED**
- **Rate Limit:** 10,000 calls/day (free tier)
- **Data:** 14-day weather forecasts, historical weather
- **Actual usage:** ~50-200 calls/day (with caching)

### Caching Strategy
- **Server-side cache** using Vercel KV (or in-memory fallback)
- **6-hour cache TTL** (weather doesn't change that frequently)
- **Coordinate rounding** (0.1° grid = ~11km) to increase cache hits
- **Result:** Multiple users in same region share cached data

---

## Performance Optimizations

### 1. Clustering (Not yet implemented)
Use `utils/clustering.js` to group facilities:

```javascript
import { clusterFacilities, distributeCl usterData } from '../utils/clustering';

// Group 100 facilities into ~5-10 clusters
const clusters = clusterFacilities(facilities, 50); // 50km radius

// Fetch weather for each cluster centroid (not each facility)
for (const cluster of clusters) {
  const weather = await fetch('/api/weather-forecast', {
    method: 'POST',
    body: JSON.stringify({
      latitude: cluster.centroid.latitude,
      longitude: cluster.centroid.longitude,
    })
  }).then(r => r.json());

  cluster.weatherData = weather;
}

// Distribute weather to all facilities
const facilitiesWithWeather = distributeClusterData(clusters, 'weatherData');
```

**Result:** 100 facilities → 10 API calls (90% reduction)

### 2. Batch Predictions
Process multiple locations in a single request by modifying API routes.

---

## Optional: Vercel KV Setup (Recommended for Production)

### Why?
- **Shared cache** across all users (not just per-user)
- **Persistent cache** across serverless function invocations
- **Automatic expiry** (no manual cleanup)

### Setup Steps:

1. **Install Vercel CLI** (if not already):
   ```bash
   npm install -g vercel
   ```

2. **Create KV store**:
   ```bash
   vercel env add KV_REST_API_URL
   vercel env add KV_REST_API_TOKEN
   ```

3. **Or use Vercel Dashboard:**
   - Go to your project on vercel.com
   - Navigate to "Storage" → "Create Database" → "KV"
   - Copy environment variables to `.env.local`

4. **Fallback:** If KV is not configured, the system automatically uses in-memory cache (works but not shared across users).

---

## Future Enhancements (Not Yet Implemented)

### 1. Historical Disaster Pattern Analysis
- Store GDACS disasters in a database
- Analyze 10-year patterns: "This region has 70% probability of cyclone in September"
- Seasonal risk scoring

### 2. Population Exposure Integration
- Download WorldPop data
- Calculate "127,000 people in flood risk zone"
- Vulnerable population mapping (children under 5, pregnant women)

### 3. DHIS2 Disease Surveillance Integration
- Real-time case data from health facilities
- Outbreak early warning alerts
- Correlation with disaster events

### 4. Satellite Imagery Analysis
- Before/after disaster comparison
- Flood extent mapping (Sentinel-1 SAR)
- Vegetation health (NDVI) for drought monitoring

---

## Configuration

### Adjust Prediction Models

Edit `config/predictionConfig.js` to customize:

```javascript
// Change flood thresholds
disasterThresholds: {
  flood: {
    warningRainfall: 50,  // Change to 40mm
    criticalRainfall: 100, // Change to 80mm
  }
}

// Adjust disease models
diseaseModels: {
  cholera: {
    doublingTime: 4, // Change epidemic growth rate
    peakDay: 14,     // Change expected outbreak peak
  }
}
```

### Adjust Cache Duration

In `pages/api/weather-forecast.js`:

```javascript
const cacheSeconds = 6 * 3600; // Change from 6 hours to 12 hours
```

---

## Testing

### Test Weather API:
```bash
curl -X POST http://localhost:3000/api/weather-forecast \
  -H "Content-Type: application/json" \
  -d '{"latitude": 6.5, "longitude": 3.4, "days": 7}'
```

### Test Disaster Forecast:
```bash
curl -X POST http://localhost:3000/api/disaster-forecast \
  -H "Content-Type: application/json" \
  -d '{"latitude": 6.5, "longitude": 3.4, "days": 7}'
```

### Test Outbreak Prediction:
```bash
curl -X POST http://localhost:3000/api/outbreak-prediction \
  -H "Content-Type: application/json" \
  -d '{"latitude": 6.5, "longitude": 3.4, "populationEstimate": 50000, "disasters": [{"eventtype": "Flood"}]}'
```

---

## Troubleshooting

### "Failed to fetch weather data"
- Check internet connection
- Verify Open-Meteo is accessible: https://api.open-meteo.com/v1/forecast?latitude=6.5&longitude=3.4&daily=temperature_2m_max
- Check browser console for CORS errors

### "Cache write error"
- Vercel KV not configured → System falls back to in-memory cache (OK for development)
- To enable KV: Follow setup steps above

### Predictions seem inaccurate
- Adjust thresholds in `config/predictionConfig.js`
- Disease models are **simplified** - consult epidemiologists for production use
- Weather forecasts have inherent uncertainty (especially beyond 7 days)

---

## API Rate Limits

| Service | Free Tier | With Caching | Usage |
|---------|-----------|--------------|-------|
| **Open-Meteo** | 10,000/day | ~50-200/day | Weather forecasts |
| **Vercel KV** | 30,000 commands/day | ~100-400/day | Cache reads/writes |

**Estimated capacity:** ~500-1,000 unique prediction requests per day with caching enabled.

---

## Cost Summary

| Component | Cost |
|-----------|------|
| Open-Meteo API | **FREE** (10k/day) |
| Vercel KV (Hobby) | **FREE** (30k commands/day) |
| OpenAI (AI analysis) | **Existing budget** (optional feature) |
| **Total** | **$0/month** |

---

## Support

For questions or issues:
1. Check this documentation
2. Review API responses in browser DevTools
3. Check server logs in Vercel dashboard
4. Open GitHub issue with error details

---

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com) (CC BY 4.0)
- Disease models: Based on WHO/CDC epidemiological parameters
- Caching: Vercel KV / Upstash Redis
