# Chatbot Weather Integration

## Overview

The AI chatbot now has access to **weather forecast data** to enhance decision-making for humanitarian operations. Weather data is automatically included in the chat context when facilities or administrative boundaries are loaded.

## Implementation Strategy

### Geographic Scope Approach

To avoid data overload, weather forecasts are **geographically scoped** based on user-uploaded data:

**Option 1: Regional Weather Forecast** (Always active when facilities are loaded)
- Fetches ONE weather forecast for the center point of all uploaded facilities
- Provides 7-day forecast for the operational area
- Includes rainfall, temperature, wind speed, humidity
- Auto-generates warnings for flood risk, heat, disease outbreak conditions

**Option 3: District-Level Weather Forecasts** (Active when shapefiles are uploaded)
- Fetches weather for each district centroid (max 20 districts)
- Provides district-specific rainfall and temperature summaries
- Identifies high-risk districts based on weather conditions

## Features

### 1. Regional Weather Context

When facilities are loaded, the chatbot receives:

```javascript
weatherForecast: {
  regional: {
    location: "Center of operational area",
    latitude: 4.37,
    longitude: 18.58,
    forecastDays: 7,
    summary: {
      totalRainfall: 120,      // mm over 7 days
      peakRainfall: 65,         // mm in single day
      peakRainfallDay: "Mar 12",
      minTemp: 22,              // °C
      maxTemp: 34,              // °C
      avgWindSpeed: 15,         // km/h
      avgHumidity: 75           // %
    },
    warnings: [
      "Moderate flood risk: 65mm expected on Mar 12",
      "Cholera outbreak risk: Favorable temperature and rainfall conditions"
    ],
    operationalImplications: [
      "Monitor flood conditions - roads may become impassable",
      "Increase AWD/cholera surveillance, check ORS stock levels"
    ]
  }
}
```

### 2. District-Level Weather Context

When admin boundaries are uploaded:

```javascript
weatherForecast: {
  districts: [
    {
      name: "Bangui",
      latitude: 4.36,
      longitude: 18.56,
      totalRainfall: 85,        // mm over 7 days
      avgTemp: 28,              // °C
      warnings: ["Malaria risk increasing: Breeding site conditions favorable"]
    },
    // ... up to 20 districts
  ]
}
```

## Auto-Generated Warnings

The system automatically analyzes weather data and generates warnings for:

### Flood Risk
- **Moderate**: Single day rainfall > 50mm
- **Critical**: Single day rainfall > 100mm
- **Soil Saturation**: 3+ consecutive days of heavy rain (>50mm/day)

### Disease Outbreak Risk
- **Cholera**: Heavy rain (>50mm) + temperature 15-35°C
- **Malaria**: Rainfall 80-200mm + temperature 20-30°C

### Operational Risks
- **Extreme Heat**: Temperatures > 40°C
- **High Heat**: Temperatures > 35°C (cold chain risk)
- **Cold Chain**: High temperatures threaten vaccine storage

## Operational Implications

The chatbot provides context-aware operational guidance:

### Examples:
- "Flooding likely - consider postponing field activities and pre-positioning supplies"
- "Monitor heat-sensitive medical supplies (vaccines, cold chain)"
- "Vector control needed - stock ACTs/RDTs, distribute ITNs"
- "Heat stress risk for field teams - ensure adequate hydration and rest"
- "Landslide and flash flood risk in hilly areas"

## Use Cases

### 1. Campaign Viability Assessment
**User**: "Can we run the vaccination campaign this week?"

**Chatbot** (with weather context):
> "Based on weather forecasts, I recommend **POSTPONING** the campaign:
> - Heavy rainfall expected (65mm on Mar 12) with moderate flood risk
> - Roads may become impassable, affecting cold chain transport
> - Suggest waiting 5-7 days for conditions to improve
> - Pre-position supplies at field sites before the rain starts"

### 2. Disease Outbreak Prediction
**User**: "What's the cholera risk this week?"

**Chatbot** (with weather context):
> "**HIGH cholera outbreak risk** detected:
> - Heavy rainfall forecast (120mm over next 7 days) creates contamination risk
> - Temperature range (22-34°C) is optimal for cholera transmission
> - Recommend:
>   - Increase AWD surveillance at health facilities
>   - Check ORS and IV fluid stock levels
>   - Coordinate with WASH cluster on water quality monitoring
>   - Consider pre-positioning cholera treatment supplies"

### 3. District Risk Prioritization
**User**: "Which districts need urgent malaria interventions?"

**Chatbot** (with district weather + other data):
> "Based on weather forecasts and current conditions, prioritize:
> 1. **Bangui** - 85mm rainfall, 28°C avg temp, ideal breeding conditions
> 2. **Mbaiki** - 92mm rainfall, high humidity, vector control urgent
> 3. **Bimbo** - Recent flooding + optimal malaria temperature
>
> Recommend 50% increase in ACT/RDT stock per AMP guidelines"

### 4. Cold Chain Risk Assessment
**User**: "Is the cold chain safe this week?"

**Chatbot** (with weather context):
> "**MEDIUM cold chain risk** this week:
> - Temperatures reaching 35°C on Days 3-5
> - Ensure backup generators are functional
> - Increase temperature monitoring frequency
> - Consider relocating heat-sensitive vaccines to cooler storage
> - Brief staff on cold chain emergency procedures"

## Technical Implementation

### Data Flow

1. **User uploads facilities** → System calculates center point
2. **Chat context builder** → Fetches weather via `/api/weather-forecast`
3. **Weather analysis** → Generates warnings and implications
4. **Context injection** → Weather data added to chat context
5. **AI processing** → Chatbot uses weather in responses

### API Endpoints

**Weather Forecast API**: `/api/weather-forecast`
- Source: Open-Meteo (FREE, no API key required)
- Cache: 6 hours (reduces redundant calls)
- Forecast: 7 days ahead
- Parameters: latitude, longitude, days

### Utility Functions

**File**: `/utils/weatherContextBuilder.js`

**Key Functions**:
- `buildRegionalWeatherContext(facilities)` - Option 1 implementation
- `buildDistrictWeatherContext(districtFeatures)` - Option 3 implementation
- `buildWeatherContext(facilities, districts)` - Main entry point
- `analyzeWeatherData(weatherData)` - Generates warnings and implications

### Frontend Integration

**Example Usage** (in component that manages chat context):

```javascript
import buildWeatherContext from '../utils/weatherContextBuilder';

// When building chat context
const chatContext = {
  facilities: facilities,
  disasters: disasters,
  acledData: acledData,
  districts: districtInfo,
  // ... other context fields
};

// Add weather data
const weatherForecast = await buildWeatherContext(
  facilities,
  districtFeatures  // GeoJSON features array
);

if (weatherForecast) {
  chatContext.weatherForecast = weatherForecast;
}

// Send to chat API
fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: userMessage,
    context: chatContext
  })
});
```

## Performance Considerations

### API Call Optimization

**Regional Forecast**: 1 API call regardless of facility count
- 50 facilities → 1 call
- 200 facilities → 1 call

**District Forecasts**: Limited to 20 districts max
- 10 districts → 10 calls
- 50 districts → 20 calls (limited)

**Caching**: Weather data cached for 6 hours
- Subsequent chat messages reuse cached data
- Reduces API load and response time

### Response Time

- **Without districts**: +1-2 seconds (1 API call)
- **With districts**: +3-5 seconds (up to 20 parallel calls)

## Configuration

Weather thresholds are defined in `/config/predictionConfig.js`:

```javascript
PREDICTION_CONFIG = {
  disasterThresholds: {
    flood: {
      warningRainfall: 50,      // mm in 24 hours
      criticalRainfall: 100,    // mm in 24 hours
      soilSaturationDays: 3     // consecutive heavy rain days
    },
    heatwave: {
      warningTemp: 35,          // °C
      criticalTemp: 40          // °C
    }
  },
  diseaseModels: {
    cholera: {
      optimalTemp: { min: 15, max: 35 }  // °C
    },
    malaria: {
      optimalTemp: { min: 20, max: 30 },      // °C
      optimalRainfall: { min: 80, max: 200 }  // mm/month
    }
  }
}
```

## Testing

### Test Scenarios

1. **Load facilities only**
   - Verify regional weather forecast appears in chat context
   - Ask: "What's the weather forecast for my operational area?"

2. **Load facilities + districts**
   - Verify both regional and district forecasts appear
   - Ask: "Which districts have flood risk this week?"

3. **Campaign viability with weather**
   - Ask: "Can I run vaccination campaigns this week?"
   - Verify chatbot considers weather + disasters + security

4. **Disease outbreak prediction**
   - Ask: "What's the cholera outbreak risk?"
   - Verify weather (rain + temp) is factored into assessment

### Expected Chat Context Output

When weather is loaded, the chat context summary should include:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEATHER FORECAST DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌤️ REGIONAL FORECAST (Operational Area):
   Location: Center of facility area
   Coordinates: 4.37°, 18.58°
   Forecast Period: Next 7 days

   📊 7-Day Summary:
   • Total Rainfall: 120mm
   • Peak Rainfall: 65mm (Mar 12, 2026)
   • Temperature Range: 22°C to 34°C
   • Avg Wind Speed: 15 km/h
   • Avg Humidity: 75%

   ⚠️ WEATHER WARNINGS:
   • Moderate flood risk: 65mm expected on Mar 12
   • Cholera outbreak risk: Favorable temperature and rainfall conditions

   💡 Operational Implications:
   • Monitor flood conditions - roads may become impassable
   • Increase AWD/cholera surveillance, check ORS stock levels

🗺️ DISTRICT-LEVEL WEATHER FORECASTS:
   Showing weather for 15 districts
   • Bangui: 85mm rain, 28°C ⚠️ Malaria risk increasing
   • Mbaiki: 92mm rain, 27°C
   • Bimbo: 110mm rain, 29°C ⚠️ CRITICAL flood risk
   ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Benefits

1. **Context-Aware Decisions**: Weather integrated with disasters, security, and facility data
2. **Proactive Warnings**: Auto-generated alerts for floods, disease outbreaks, operational risks
3. **Campaign Planning**: Assess viability based on actual weather forecasts, not just current disasters
4. **Resource Optimization**: Pre-position supplies before weather events
5. **Disease Prediction**: Link weather patterns to cholera, malaria outbreak risk
6. **Cold Chain Protection**: Anticipate temperature-related vaccine storage risks
7. **Geographic Precision**: District-level forecasts for targeted interventions

## Future Enhancements

1. **Extended Forecasts**: 14-day forecasts for longer-term planning
2. **Historical Comparison**: "Is this rainfall unusual for this time of year?"
3. **Seasonal Patterns**: Integrate seasonal weather calendars
4. **Weather Alerts**: Push notifications when critical weather detected
5. **Custom Thresholds**: Let users define their own warning thresholds
6. **Multi-Hazard Modeling**: Combine weather + geology for landslide risk
7. **Population Exposure**: Calculate populations exposed to weather hazards

## Credits

- **Weather Data**: Open-Meteo API (free, no API key required)
- **Disease Models**: Based on WHO, CDC, and AMP guidance
- **Integration**: John Mark Esplana - Aidstack Platform
- **Configuration**: `/config/predictionConfig.js`
