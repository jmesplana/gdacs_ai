# WorldPop Population Integration Plan

## Overview

Integrate WorldPop Global 2 population data (2015–2030) into Aidstack Disasters via Google Earth Engine. When a user uploads a shapefile, they can load population counts and age-sex breakdowns per admin unit — displayed on the map and included in all AI analyses.

---

## Data Source: WorldPop Global 2 via GEE Community Catalog

Since the user has a Google Earth Engine account, we use GEE as the primary compute engine. This gives access to WorldPop Global 2 (2015–2030) — the latest generation dataset — without downloading any files.

### GEE Asset IDs (Community Catalog)

| Dataset | GEE Asset Path | Latest Release |
|---|---|---|
| Total Population | `projects/sat-io/open-datasets/WORLDPOP/pop` | R2024B |
| Age-Sex Disaggregated | `projects/sat-io/open-datasets/WORLDPOP/agesex` | R2025A |

- **Resolution**: 100m × 100m
- **Years**: 2015–2030 (annual, including projections to 2030)
- **Coverage**: 242 countries
- **Model**: Constrained (population only allocated to identified human settlements)
- **License**: CC BY 4.0
- **Added to catalog**: February 3, 2026 (age-sex); available now

### Age-Sex Band Names

`f_00`/`m_00` (under 1), `f_01`/`m_01` (1–4), then 5-year groups: `f_05`/`m_05` through `f_90`/`m_90`

Grouped for humanitarian analysis:
- **Under 5**: f_00 + m_00 + f_01 + m_01
- **5–14**: f_05 + m_05 + f_10 + m_10
- **15–49** (reproductive age): f_15…f_45 + m_15…m_45
- **50–59**: f_50 + m_50
- **60+**: f_60…f_90 + m_60…m_90

### Why GEE over WorldPop Stats API

| Factor | GEE (chosen) | WorldPop Stats API |
|---|---|---|
| Dataset | Global 2 ✓ (2015–2030) | WPGP only (2000–2020) |
| Age-sex bands | 38 bands ✓ | Not available |
| Rate limit | 100 req/s, 40 concurrent | 1,000/day, slow async queue |
| Latency | Seconds | Minutes (polling) |
| Reliability | Google infrastructure | Small team, inconsistent |

### Map Visual Overlay (ArcGIS Tile Service — no auth needed)

Used for the population heatmap on the map, independent of GEE stats:

| Layer | URL | Resolution |
|---|---|---|
| Total Population 1km | `https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Total_Population_1km/ImageServer/tile/{z}/{y}/{x}` | 1km |
| Population Density 100m | `https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_100m/ImageServer/tile/{z}/{y}/{x}` | 100m |

Note: ArcGIS tile URLs use `{z}/{y}/{x}` (row/col order), which maps correctly to Leaflet's template syntax.

---

## Authentication Setup

GEE is called from the Next.js backend using a **GCP Service Account**:

1. Create a service account in Google Cloud Console
2. Grant it **Earth Engine Resource Viewer** role
3. Download the JSON key
4. Store as environment variable: `GEE_SERVICE_ACCOUNT_KEY=<json string>`
5. Register the service account in the [GEE registration page](https://code.earthengine.google.com/register)

```bash
npm install @google/earthengine
```

```javascript
// Authentication pattern in API route
const ee = require('@google/earthengine');
const privateKey = JSON.parse(process.env.GEE_SERVICE_ACCOUNT_KEY);

await new Promise((resolve, reject) => {
  ee.data.authenticateViaPrivateKey(privateKey,
    () => ee.initialize(null, null, resolve, reject),
    reject
  );
});
```

---

## User Flow

1. User uploads shapefile → admin boundaries appear on map
2. **"Population Data"** button appears in the map toolbar
3. WorldPop panel opens:
   - Country auto-detected from shapefile properties (ADM0_EN, COUNTRY, ISO, etc.)
   - Year selector: **2015–2030**
   - Data type: **Total Population** or **Age & Sex Breakdown**
4. Click **"Load Population Data"** → backend runs `reduceRegions()` on GEE for all districts in one call
5. Results appear:
   - District popups show population totals + age group breakdown
   - Optional population density heatmap tile overlay (toggleable)
   - Per-district results table in the panel
6. All AI analyses automatically include population data in their prompts

---

## Files to Create

### `pages/api/worldpop-stats.js` (new)

Backend route using `@google/earthengine`:

```javascript
// POST { districts, year, dataType: 'total' | 'agesex' }

// 1. Authenticate with GEE service account
// 2. Load image from collection, filter by year:
//    ee.ImageCollection('projects/sat-io/open-datasets/WORLDPOP/pop')
//      .filter(ee.Filter.calendarRange(year, year, 'year')).first()
// 3. Convert districts to ee.FeatureCollection
// 4. Run reduceRegions({ reducer: ee.Reducer.sum(), scale: 100 })
// 5. Return population per district as JSON

// Returns: { results: [{ districtId, total, ageGroups, error }] }
```

For age-sex: sum all 38 bands in one `reduceRegions()` call, then group bands server-side before returning.

Apply `lib/rateLimit.js` as with other AI endpoints.

---

### `utils/worldpopHelpers.js` (new)

- `GEE_DATASETS`: asset IDs + band names for total and age-sex collections
- `AGE_GROUPS`: display groupings (Under 5, 5–14, 15–49, 50–59, 60+) with colors
- `WORLDPOP_TILE_LAYERS`: ArcGIS tile layer config for map overlay
- `extractCountryFromDistricts(districts)`: auto-detect country name from shapefile properties
- `groupAgeBands(rawBands)`: transform 38 raw GEE bands into display groups
- `formatPopulationForAI(worldPopData, districts)`: format population context string for AI prompts

---

### `components/MapComponent/hooks/useWorldPop.js` (new)

React hook exposing:

```javascript
{
  worldPopData,        // { [districtId]: { total, ageGroups: { under5, child5_14, adult15_49, adult50_59, elderly60plus } } }
  isLoading,           // boolean
  error,               // string | null
  showWorldPopLayer,   // boolean
  activeLayerType,     // 'population' | 'density'
  toggleWorldPopLayer,
  setActiveLayerType,
  fetchWorldPopData,   // (districts, year, dataType) => Promise
  clearWorldPopData,
}
```

---

### `components/MapComponent/WorldPopPanel.js` (new)

Side panel UI:
- Country display (auto-detected from shapefile)
- Year selector dropdown (**2015–2030**)
- Data type toggle: Total Population / Age & Sex Breakdown
- "Load Population Data" button
- Loading spinner (single GEE call — fast, no per-district polling needed)
- Per-district results table (name, total population, age group bars)
- Map overlay toggle + layer type switcher

---

## Files to Modify

### `components/MapComponent.js`
- Add WorldPop tile overlay (`<TileLayer>` when `showWorldPopLayer` is true)
- Integrate `WorldPopPanel` component
- Update district popup content to include population total + age breakdown
- Add "Population Data" button to toolbar (visible after shapefile upload)

### `pages/app.js`
- Add `worldPopData` state
- Pass to `MapComponent` and AI endpoint request bodies

### `pages/api/operational-outlook.js`
Add to `buildAnalysisContext()`:
```
## Population Data (WorldPop Global 2, {year})
- Total population in operational area: {sum}
- District breakdown:
  - {name}: {total} people | Under 5: {n} | 15–49: {n} | 60+: {n}
- Most populous district: {name} ({total})
- Vulnerable groups (under 5 + 60+): {pct}% of total
```

### `pages/api/disaster-forecast.js`
Include population totals per affected district in forecast context.

### `pages/api/district-campaign-viability.js`
Replace shapefile-derived `population` field (often null) with WorldPop GEE totals; use age-group denominators for coverage rate calculations.

---

## Data Flow

```
User uploads shapefile
  → districts stored in React state (geometry + properties)
  → User opens WorldPop Panel, selects year + data type
  → POST /api/worldpop-stats { districts, year, dataType }
      → Authenticate with GEE service account
      → Load WorldPop image, filter by year
      → Convert all district polygons → ee.FeatureCollection
      → reduceRegions({ reducer: sum(), scale: 100 })  ← single GEE call for all districts
      → Return { results: [{ districtId, total, ageGroups }] }
  → worldPopData stored in React state
  → District popups updated on map
  → WorldPop tile overlay shown (optional, ArcGIS tiles — no GEE needed)
  → AI endpoints receive worldPopData in request body
      → Included in prompt context
```

---

## Environment Variables to Add

```
GEE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}   # full JSON as string
```

---

## Constraints & Limitations

| Constraint | Detail |
|---|---|
| GEE service account setup | One-time setup required: create GCP service account, register with GEE, download key |
| Community catalog access | `projects/sat-io/open-datasets/WORLDPOP/` is publicly readable — no special permissions needed |
| GEE quota | 40 concurrent requests, 100 req/s — well within limits for this use case |
| Year range | 2015–2030 (Global 2). For 2000–2014, would need to fall back to older WPGP dataset (`WorldPop/GP/100m/pop`) |
| Tile overlay year | ArcGIS tile layer is not year-filtered — shows a general population distribution pattern |
| Vercel timeout | `reduceRegions()` for large countries with many districts may approach 60s. May need to increase Vercel function timeout for this route or batch large requests |

---

## Implementation Order

1. Set up GEE service account + test auth locally
2. `utils/worldpopHelpers.js` + `hooks/useWorldPop.js`
3. `pages/api/worldpop-stats.js` (test with curl before wiring to UI)
4. `components/MapComponent/WorldPopPanel.js`
5. Integrate into `components/MapComponent.js` + `pages/app.js`
6. Update AI endpoints (`operational-outlook.js`, `disaster-forecast.js`, `district-campaign-viability.js`)
