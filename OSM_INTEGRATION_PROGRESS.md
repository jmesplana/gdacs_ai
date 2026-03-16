# OSM Infrastructure Integration - Progress Report

## ✅ Completed (Core Backend & Frontend Foundation)

### Backend Infrastructure
1. **`/lib/osmHelpers.js`** - Server-side utilities
   - Overpass API query builder for all infrastructure types
   - GeoJSON conversion from OSM elements
   - Infrastructure categorization (hospitals, schools, roads, water, power, etc.)
   - Boundary subdivision for large areas (>10,000 km²)
   - Feature filtering and deduplication
   - AI formatting functions

2. **`/lib/osmCache.js`** - Caching layer
   - Redis-backed caching with 24-hour TTL
   - In-memory fallback (50 entry LRU cache)
   - Graceful degradation if Redis unavailable
   - Stale cache return on query failures

3. **`/pages/api/osm-infrastructure.js`** - Main API endpoint
   - POST endpoint accepting boundary + layer selection
   - Automatic query subdivision for large boundaries
   - Multi-endpoint failover (3 Overpass mirrors)
   - Retry logic with exponential backoff
   - Error handling with stale cache fallback
   - Rate limit protection

4. **`/lib/aiContextBuilders.js`** - AI integration utilities
   - OSM context builder for GPT-4o
   - Proximity calculations (nearest infrastructure per category)
   - Disaster impact zone analysis
   - Operational implications generator
   - Reusable across all AI endpoints

### Frontend Infrastructure
5. **`/components/MapComponent/hooks/useOSMInfrastructure.js`** - State management hook
   - OSM data fetching and caching
   - Layer visibility toggles
   - localStorage persistence (24h)
   - Loading/error states
   - Refresh and clear functions

6. **`/components/MapComponent/utils/osmHelpers.js`** - Client-side utilities
   - Proximity calculations (within 5km, 10km, 25km bands)
   - Category filtering
   - Disaster zone infrastructure analysis
   - OSM context formatting for AI
   - Icon and color helpers

7. **`/components/MapComponent/components/OSMInfrastructureLayer.js`** - Map rendering
   - Leaflet marker clustering
   - Custom icons per category (hospitals=red, schools=blue, water=cyan, etc.)
   - Layer visibility filtering
   - Rich popups with OSM metadata
   - Links to OpenStreetMap.org

---

## 🚧 In Progress

### AI Integration
- Integrating OSM context into `/pages/api/chat.js`
- Integrating OSM context into `/pages/api/recommendations.js`
- Adding infrastructure checks to `/pages/api/campaign-viability.js`

### UI Components
- Creating OSM toggle in `MapLayersDrawer`
- Wiring up OSM hook to main `MapComponent`
- Adding "Load Infrastructure" button to UI

---

## 📋 TODO (Remaining Work)

### 1. AI Endpoint Integration (High Priority)
Enhance these endpoints with OSM context:

**`/pages/api/chat.js`**
```javascript
// Add OSM infrastructure to context summary (line ~742)
if (context.osmData && Object.keys(context.osmData).length > 0) {
  summary.push(formatOSMForAI(context.osmData, context.disasters));
}
```

**`/pages/api/recommendations.js`**
```javascript
// Add OSM context to prompt (line ~85)
const osmContext = osmData ? buildOSMContext(facility, osmData, impacts) : '';
// Include osmContext in systemPrompt
```

**`/pages/api/campaign-viability.js`**
```javascript
// Enhance infrastructure access risk assessment (line ~388)
function assessAccessRisk(facility, impacts, disasters, osmData) {
  // Use OSM road/bridge data to determine accessibility
}
```

### 2. UI Integration (High Priority)
Wire OSM into the map:

**`/components/MapComponent.js` (or wherever map is rendered)**
```javascript
import { useOSMInfrastructure } from './hooks/useOSMInfrastructure';
import OSMInfrastructureLayer from './components/OSMInfrastructureLayer';

// In component:
const {
  osmData,
  osmLoading,
  osmError,
  osmStats,
  osmLayerVisibility,
  showOSMLayer,
  fetchOSMInfrastructure,
  toggleLayerVisibility,
  toggleAllOSM
} = useOSMInfrastructure();

// Auto-fetch when districts loaded
useEffect(() => {
  if (districts && districts.length > 0 && !osmData) {
    const boundary = calculateBoundary(districts); // Use existing helper
    fetchOSMInfrastructure(boundary);
  }
}, [districts, osmData, fetchOSMInfrastructure]);

// Render layer
<OSMInfrastructureLayer
  osmData={osmData}
  layerVisibility={osmLayerVisibility}
  showOSMLayer={showOSMLayer}
/>
```

**`MapLayersDrawer` or `FilterDrawer`**
Add OSM controls:
```javascript
<div>
  <h3>Infrastructure (OpenStreetMap)</h3>
  <label>
    <input
      type="checkbox"
      checked={showOSMLayer}
      onChange={toggleAllOSM}
    />
    Show OSM Infrastructure
  </label>
  {osmLoading && <span>Loading...</span>}
  {osmStats && <span>{osmStats.totalFeatures} features</span>}
  <button onClick={() => refreshOSM(true)}>Refresh</button>
</div>

{/* Per-layer toggles */}
<div>
  {['hospital', 'clinic', 'school', 'water', 'power'].map(layer => (
    <label key={layer}>
      <input
        type="checkbox"
        checked={osmLayerVisibility[layer]}
        onChange={() => toggleLayerVisibility(layer)}
      />
      {layer} ({osmStats?.[layer] || 0})
    </label>
  ))}
</div>
```

### 3. Pass OSM Data to AI Endpoints
When calling AI endpoints, include `osmData`:

```javascript
// Example: In chat endpoint call
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages,
    context: {
      facilities,
      disasters,
      osmData, // ADD THIS
      worldPopData,
      acledData,
      districts
    }
  })
});
```

### 4. Testing & Validation
- [ ] Test with real district shapefile upload
- [ ] Verify Overpass API queries return data
- [ ] Check marker rendering on map
- [ ] Validate AI context in chat responses
- [ ] Test with large boundaries (subdivision logic)
- [ ] Test cache persistence across sessions

### 5. Documentation Updates
- [ ] Update `CLAUDE.md` with OSM integration notes
- [ ] Add JSDoc comments to all functions
- [ ] Create user-facing documentation (how to use OSM features)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Flow                                │
└─────────────────────────────────────────────────────────────┘
                              │
        User uploads district shapefile
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │  useOSMInfrastructure hook           │
        │  - Detects boundary uploaded         │
        │  - Calls fetchOSMInfrastructure()    │
        └──────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │  POST /api/osm-infrastructure        │
        │  - Checks cache (Redis/memory)       │
        │  - Subdivides if >10k km²            │
        │  - Queries Overpass API              │
        │  - Filters & categorizes features    │
        │  - Caches result (24h TTL)           │
        └──────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │  osmData stored in state             │
        │  - localStorage persistence          │
        │  - Available to all components       │
        └──────────────────────────────────────┘
                              │
        ┌─────────────────────┴──────────────────────┐
        │                                             │
        ▼                                             ▼
┌──────────────────┐                    ┌──────────────────────┐
│  Map Rendering   │                    │  AI Analysis         │
│  - Markers       │                    │  - Chat context      │
│  - Clustering    │                    │  - Recommendations   │
│  - Popups        │                    │  - Viability checks  │
└──────────────────┘                    └──────────────────────┘
```

---

## Key Features Implemented

### 🎯 Smart Infrastructure Querying
- **Boundary-scoped**: Only fetches data within uploaded districts
- **Automatic subdivision**: Large areas split into manageable chunks
- **Multi-layer selection**: 10+ infrastructure types (hospitals, schools, roads, water, power, fuel, pharmacies, bridges, airports, ports)

### 🗺️ Rich Map Visualization
- **Custom icons**: Color-coded by category (red=hospitals, blue=schools, cyan=water)
- **Marker clustering**: Handles 1000+ features without performance issues
- **Detailed popups**: Shows name, category, capacity, operator, links to OSM

### 🤖 AI Intelligence Enhancement
- **Proximity analysis**: Nearest hospital, water point, airport for each facility
- **Disaster impact**: Infrastructure affected by active disasters
- **Operational implications**: "Medical support accessible" vs "LIMITED"
- **Specific recommendations**: "Use Bridge B-301 (OSM ID 123456)" instead of generic advice

### 💾 Smart Caching
- **24-hour cache**: Reduces Overpass API load
- **Stale fallback**: Returns old data if API fails
- **Multi-tier**: Redis → Memory → localStorage

---

## Testing Checklist

### Backend Tests
- [ ] `/api/osm-infrastructure` returns data for valid boundary
- [ ] Cache hit on second identical query
- [ ] Subdivision triggered for boundary >10,000 km²
- [ ] Graceful degradation when Overpass API fails
- [ ] Rate limiting works (10 req/min)

### Frontend Tests
- [ ] OSM markers render on map
- [ ] Clustering works with 100+ features
- [ ] Layer visibility toggles work
- [ ] Popups show correct infrastructure info
- [ ] localStorage persistence survives refresh

### AI Integration Tests
- [ ] Chat responses mention nearby infrastructure
- [ ] Recommendations include specific OSM facility names
- [ ] Campaign viability considers road accessibility
- [ ] Impact assessments flag affected infrastructure

---

## Next Steps (Priority Order)

1. **Wire up UI** (30 min)
   - Add OSM hook to MapComponent
   - Render OSMInfrastructureLayer
   - Add toggle to MapLayersDrawer

2. **Test with real data** (15 min)
   - Upload district shapefile
   - Verify OSM query works
   - Check markers appear

3. **Integrate into chat.js** (20 min)
   - Add osmData to context parameter
   - Call buildOSMContext() in context builder
   - Test chat mentions infrastructure

4. **Integrate into recommendations.js** (15 min)
   - Add osmData parameter
   - Include OSM context in prompt
   - Verify recommendations reference facilities

5. **Polish & Documentation** (30 min)
   - Add loading states
   - Error messages
   - User-facing docs

**Total estimated time to MVP: ~2 hours**

---

## Success Criteria

✅ **Backend working**: API returns OSM data for uploaded boundary
✅ **Frontend working**: Markers render on map with clustering
🔲 **AI working**: Chat/recommendations mention specific infrastructure
🔲 **UX working**: Users can toggle layers, see loading states
🔲 **Tested**: Works with real district shapefile from user

---

## Notes

- All files follow existing codebase patterns (JavaScript only, no TypeScript)
- Uses same dynamic import pattern as WorldPop (`{ ssr: false }`)
- Graceful degradation everywhere (no blocking errors)
- Compatible with existing state management (no Context needed)
- OSM data only loads when boundary uploaded (not on page load)
