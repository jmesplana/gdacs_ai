# WorldPop Integration — COMPLETE ✓

## What's Already Done

- `utils/worldpopHelpers.js` — helpers (formatters, age group definitions, AI text formatter)
- `pages/api/worldpop-stats.js` — GEE backend (authenticates, runs reduceRegions, returns pop per district)
- `components/MapComponent/hooks/useWorldPop.js` — React hook (state management, fetch logic)
- `components/MapComponent/components/drawers/WorldPopDrawer.js` — full UI panel
- `components/MapComponent.js` — WorldPop tile overlay, WorldPopDrawer, "POP" button added
- `components/MapComponent/hooks/index.js` — exports useWorldPop
- `components/MapComponent/components/drawers/index.js` — exports WorldPopDrawer
- `next.config.js` — added `serverExternalPackages: ['@google/earthengine']`
- `vercel.json` — added 120s / 1GB timeout for worldpop-stats route
- `@google/earthengine` npm package installed

---

## What's Still Needed

### 1. Lift worldPopData to `pages/app.js` so AI components can use it

**Why:** `OperationalOutlook` and `PredictionDashboard` are rendered in `pages/app.js`, not inside `MapComponent`. They need `worldPopData` to include population in AI prompts.

**How:** Add a callback prop `onWorldPopDataChange` to `MapComponent.js`. Call it via `useEffect` when `worldPopData` changes. In `app.js`, store the data in state and pass it down to AI components.

**Files to change:**

**`components/MapComponent.js`** — add prop + useEffect:
```javascript
// Add to props destructuring:
onWorldPopDataChange,

// Add useEffect after useWorldPop hook call:
useEffect(() => {
  if (onWorldPopDataChange) {
    onWorldPopDataChange(worldPopData, worldPopLastFetch);
  }
}, [worldPopData, worldPopLastFetch]);
```

**`pages/app.js`** — add state + pass to components:
```javascript
// Add state (near other district state around line 82):
const [worldPopData, setWorldPopData] = useState({});
const [worldPopLastFetch, setWorldPopLastFetch] = useState(null);

// Pass callback to MapComponent (find the <MapComponent ... /> block):
onWorldPopDataChange={(data, fetchParams) => {
  setWorldPopData(data);
  setWorldPopLastFetch(fetchParams);
}}

// Pass to OperationalOutlook (around line 1800):
worldPopData={worldPopData}
worldPopYear={worldPopLastFetch?.year}

// Pass to PredictionDashboard (around line 1785):
worldPopData={worldPopData}
worldPopYear={worldPopLastFetch?.year}
```

---

### 2. Update `pages/api/operational-outlook.js` to include population in AI prompt

In the `buildAnalysisContext()` function, add population data from worldPopData.

**`pages/api/operational-outlook.js`:**
- Add `worldPopData` and `worldPopYear` to the request body destructuring
- Call `formatWorldPopForAI(worldPopData, districts, worldPopYear)` from `worldpopHelpers.js` and append to context string

```javascript
// In request body destructuring (top of handler):
const { facilities, disasters, acledData, districts, predictions,
        selectedDistrict, worldPopData, worldPopYear } = req.body;

// In buildAnalysisContext() or at the end of context assembly:
import { formatWorldPopForAI } from '../../utils/worldpopHelpers';

// Add to context:
if (worldPopData && Object.keys(worldPopData).length > 0) {
  context += formatWorldPopForAI(worldPopData, districts, worldPopYear || 'unknown');
}
```

---

### 3. Update `components/OperationalOutlook.js` to send worldPopData in API call

Find where it calls `/api/operational-outlook` and add `worldPopData` + `worldPopYear` to the POST body.

```javascript
// In the fetch call body:
body: JSON.stringify({
  facilities,
  disasters,
  acledData,
  districts,
  // ... existing fields ...
  worldPopData: worldPopData || {},
  worldPopYear: worldPopYear,
})
```

---

### 4. Update `pages/api/disaster-forecast.js` for population context (optional but useful)

Similar pattern — add `worldPopData` to request, include in prompt if present.

---

### 5. Update `pages/api/district-campaign-viability.js` to use WorldPop population

Replace the shapefile-derived `population` field (often null) with WorldPop totals when available.

```javascript
// When building district data for the prompt:
const population = worldPopData?.[String(district.id)]?.total
  || district.properties?.population
  || district.population
  || null;
```

---

## Quick Test Checklist (after remaining work is done)

1. `npm run dev` — no build errors
2. Upload a shapefile → "POP" button appears bottom-right of map
3. Click POP → WorldPop drawer opens, country auto-detected
4. Select year (e.g. 2020), data type = Total Population → click Load
5. Results appear per district, map overlay toggle works
6. Open Operational Outlook → response references population numbers
7. Check Vercel logs for GEE auth errors if deployed

---

## Known Risks / Watch Out For

| Issue | Detail |
|---|---|
| GEE service account not registered | Go to https://signup.earthengine.google.com/#!/service_accounts and register `gee-worldpop@earth-engine-468209.iam.gserviceaccount.com` |
| `.env.local` key format | Multi-line JSON wrapped in single quotes — Next.js dotenv handles this, but strip quotes in `worldpop-stats.js` (already handled with regex) |
| Large country timeout | 120s set in vercel.json, but very large countries with 500+ districts at scale=1000 could still be slow — consider splitting into batches of 50 |
| `@google/earthengine` cold start | First request after deploy will be slow (~5–10s extra) for EE init — subsequent warm requests are fast |
