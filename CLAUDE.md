# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aidstack Disasters** — a geospatial AI platform for humanitarian operations. It overlays real-time disaster data (GDACS), conflict data (ACLED), and user-uploaded facility/district data on an interactive map, then uses OpenAI GPT-4o to generate impact assessments, operational recommendations, situation reports, and forecasts.

Live: https://disasters.aidstack.ai | Repo: https://github.com/jmesplana/gdacs_ai

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm start        # Start production server
```

No test runner is configured — there are no test files in this project.

## Custom Slash Commands

Available slash commands:
- `/brand-aidstack` — Apply Aidstack branding to components and pages using official brand guidelines

## Environment Setup

Create `.env.local`:
```
OPENAI_API_KEY=sk-proj-...
APP_BASE_URL=http://localhost:3000
GEE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

Optional environment variables:
- `REDIS_URL` — For rate limiting (production). Degrades gracefully if unavailable.
- `OPENAI_WEB_SEARCH_MODEL=gpt-4.1-mini` — Model for web search in chat (defaults to gpt-4o-mini if not set)

## Architecture

### Frontend (Next.js, JavaScript only — no TypeScript)

**Pages**:
- `pages/app.js` — Main application (80+ state variables, no SSR for Leaflet compatibility). All heavy components are dynamically imported with `{ ssr: false }`.
- `pages/landing.js` — Marketing/onboarding page
- `pages/index.js` — Redirects to `/landing`

**Component hierarchy**:
- `components/MapComponent.js` (~10,300 LOC including subcomponents) — the core map interface
  - `components/MapComponent/hooks/` — Custom hooks: `useAIAnalysis`, `useDrawing`, `useFileUpload`, `useMapControls`, `useMapFilters`, `usePlayback`, `useWorldPop`, `useOSMInfrastructure`
  - `components/MapComponent/components/drawers/` — Side panels: `ChatDrawer` (expandable for larger workspace with enhanced table rendering), `FacilityDrawer`, `FilterDrawer`, `MapLayersDrawer`, `RecommendationsDrawer`, `SitrepDrawer`, `UnifiedDrawer` (trend analysis integration), `WorldPopDrawer`
  - `components/MapComponent/components/overlays/` — Map overlays: `FloatingActionButtons`, `HamburgerMenu`, `MapLegend`, `TimelineScrubber`, `CampaignDashboard`
  - `components/MapComponent/components/` — Map layers: `AcledMarkers`, `DisasterMarkers`, `DrawingLayer`, `HeatmapLayer`, `TimelineVisualization`, `OSMInfrastructureLayer`, `AdminBoundariesLayer` (enhanced with dataset styling)
  - `components/MapComponent/utils/` — Geospatial helpers: `disasterHelpers`, `fileHelpers`, `mapHelpers`, `osmHelpers`, `adminDatasetStyling` (choropleth styling for admin boundaries)
  - `components/MapComponent/constants/` — Map configuration: `mapConstants` (base layers, zoom levels, style presets)
- Other major components: `PredictionDashboard.js`, `TrendAnalysisDashboard.js` (modularized with subcomponents), `OperationalOutlook.js`, `LandingPage.js`, `ShapefileUploader.js`, `SitrepGenerator.js`
  - `components/TrendAnalysisDashboard/` — Modular subcomponents: `AcledTrendsChart`, `DisasterTimelineChart`, `FacilityRiskChart`, `DistrictComparisonTable`, `SummaryCards`, `NarrativePanel`, `EmptyState`

**State management**: Local `useState` throughout — no Redux/Zustand. `pages/app.js` owns top-level state and passes down via props.

### Backend (Next.js API Routes)

All AI endpoints are rate-limited via `lib/rateLimit.js` (100 req/hr per IP, Redis-backed).

Key routes:
- `pages/api/chat.js` — Chatbot using GPT-4o with web search (enhanced context awareness)
- `pages/api/impact_assessment.js` — **Lightweight API wrapper** for impact assessment. Core logic moved to `lib/impactAssessment.js` for client-side processing. API now handles optional server-side execution
- `pages/api/process-shapefile.js` — Parses SHP/GeoJSON uploads (60s timeout, 3GB memory via `vercel.json`)
- `pages/api/worldpop-stats.js` — Fetches WorldPop population data via Google Earth Engine (120s timeout, 1GB memory via `vercel.json`)
- `pages/api/gdacs.js` — Proxies/parses GDACS RSS feed
- `pages/api/gdacs-geometry.js` — Fetches detailed GDACS disaster geometry
- `pages/api/operational-outlook.js` — Forward-looking analysis with DuckDuckGo scraping
- `pages/api/osm-infrastructure.js` — Fetches OpenStreetMap infrastructure data via Overpass API (hospitals, schools, roads, water, power, etc.)
- `pages/api/logistics-assessment.js` — OSM-aware logistics and access assessment with confidence scoring
- `pages/api/prioritization-board.js` — Area-scoped facility/district ranking with multi-layer context
- `pages/api/district-hazard-analysis.js` — District-level hazard analysis framework
- `pages/api/export-brief.js` — Exportable decision briefs
- `pages/api/trends.js` — Trend analysis API for AI narrative generation only. Data processing moved to client-side via `lib/trendAnalysis.js` to avoid 413 payload errors
- `pages/api/sitrep.js` — Enhanced SitRep generation with better context and formatting

Other AI endpoints (all rate-limited): `analysis.js`, `campaign-viability.js`, `campaign-viability-batch.js`, `disaster-forecast.js`, `district-campaign-viability.js`, `operation-viability.js`, `outbreak-prediction.js`, `recommendations.js`, `security-assessment.js`, `sitrep.js`, `supply-chain-forecast.js`, `weather-forecast.js`

**API Route Patterns** (when adding new endpoints):
- All AI endpoints must use rate limiting via `lib/rateLimit.js`
- Use context builders from `lib/aiContextBuilders.js` for consistent AI prompts
- Internal API-to-API calls must use `APP_BASE_URL` env var (never hardcode `localhost`)
- Return generic error messages to clients (avoid leaking implementation details via `error.message`)

**Library utilities**:
- `lib/rateLimit.js` — Redis-backed rate limiting with in-memory fallback
- `lib/osmCache.js` — Redis-backed OSM data caching (24h TTL) with in-memory fallback (50 entry LRU cache)
- `lib/osmHelpers.js` — Server-side OSM utilities: Overpass API query builder, GeoJSON conversion, infrastructure categorization, boundary subdivision for large areas
- `lib/aiContextBuilders.js` — Reusable AI context builders for GPT-4o: OSM context, proximity calculations, disaster impact analysis
- `lib/impactAssessment.js` — **Client-side impact assessment library** (413 LOC): Disaster proximity calculations, facility risk scoring, district aggregation, ACLED integration. Moved from server-side to enable client-side processing of large datasets
- `lib/districtRiskScoring.js` — District-level risk calculation algorithms
- `lib/districtHazardAnalysis.js` — Hazard analysis framework for district-level assessments
- `lib/analysisScope.js` — Geographic scope management for area-based workflows
- `lib/contextualAnalysis.js` — Contextual analysis helpers for multi-layer enrichment
- `lib/logisticsHelpers.js` — Logistics assessment utilities (road access, infrastructure scoring)
- `lib/prioritizationBoard.js` — Prioritization scoring logic with confidence modeling
- `lib/trendAnalysis.js` — Temporal trend analysis: ACLED event aggregation, disaster timelines, facility risk trends, district comparisons

### Data Flow

**Basic workflow**:
```
User uploads CSV (facilities) / Shapefile (districts) / ACLED CSV
        ↓
Parsed client-side or via /api/process-shapefile
        ↓
Stored in React state → rendered on Leaflet map
        ↓
User triggers analysis → API route → OpenAI GPT-4o → response rendered
```

GDACS disasters are auto-fetched on load via `/api/gdacs` (proxied RSS → parsed XML).

**Area-based operational workflow** (recommended pattern):
```
1. Load operational geography (upload shapefile/GeoJSON)
        ↓
2. Add operational context (upload facilities, optionally ACLED, set operation type)
        ↓
3. Select analysis area (district/admin area selector)
        ↓
4. Enrich with WorldPop and OSM (for selected area only)
        ↓
5. Run analysis (impact assessment, viability, logistics, prioritization)
        ↓
6. Report and export (SitReps, decision briefs, prioritization board)
```

**OSM Infrastructure Integration**:
```
User uploads district shapefile
        ↓
useOSMInfrastructure hook auto-detects boundary
        ↓
POST /api/osm-infrastructure → Overpass API query
        ↓
Result cached (Redis 24h + localStorage) → rendered on map
        ↓
OSM context passed to AI endpoints → enhanced recommendations
```

**Prioritization Board** (area-scoped, not global):
```
Requires: uploaded districts + selected analysis area
        ↓
Ranks only data inside selected geography:
  - Facilities in area
  - Disasters in area
  - ACLED events in area (optional)
  - WorldPop context (optional)
  - OSM context (optional)
        ↓
Returns ranked actions with confidence scores
(Gracefully degrades when optional layers missing)
```

**Trend Analysis Dashboard**:
```
Requires: uploaded districts + selected analysis area
        ↓
Client-side processing to avoid payload errors:
  - ACLED event trends over time
  - Disaster timeline visualization
  - Facility risk score trends
  - District comparison tables
        ↓
Optional AI narrative generation (GPT-4o)
Configurable time window (7/30/90 days)
```

### Configuration

- `config/operationTypes.js` — Defines operation type categories and their analysis templates
- `config/predictionConfig.js` — Prediction model configuration
- `next.config.js` — Rewrites `/api/gdacs-feed` → `https://gdacs.org/xml/rss.xml`; marks `@google/earthengine` as server-only
- `vercel.json` — Custom timeouts/memory: `process-shapefile.js` (60s/3GB), `worldpop-stats.js` (120s/1GB)

## Recent Architecture Changes

See `OSM_INTEGRATION_PROGRESS.md` and `APP_HUB_ARCHITECTURE.md` for detailed documentation on:
- **OSM Infrastructure Integration**: OpenStreetMap data integration for infrastructure context (hospitals, schools, roads, water, power, etc.)
- **App Hub Architecture** (Proposed): Modular plugin system for specialized workflows (microplanning, supply chain, vaccination campaigns)

## Known Issues & Production Gaps

From `PRODUCTION_ROADMAP.md`:

**Security** (Phase 1):
- Upload size limits not enforced (target: 1MB body size limit)
- API error messages leak implementation details (`.message` exposed to clients)
- `pages/api/operational-outlook.js` has no timeout on external HTTP calls — potential hanging
- Shapefile upload size cap not enforced (currently allows up to 100MB)

**UX** (Phase 2):
- Mobile layout broken (hardcoded `min-width: 600px` in drawers)
- Map container height not optimized for mobile (`100dvh` needed)
- No React Error Boundary — component crashes cause white screen
- No "Using demo data" warning when GDACS live feed fails
- Facility search and status filters not yet implemented
- Map legend needs expansion (facility status, disaster types, risk zones)

**Performance & Scale** (Phase 5):
- 31 `useState` hooks in `pages/app.js` — needs context/state management refactor
- Bundle size ~800KB — needs lazy loading for `openai`, `leaflet-draw`, `xlsx`
- No list virtualization for 500+ facilities (all rendered simultaneously)
- localStorage has 5–10MB limits — should migrate to IndexedDB

**Other**:
- No automated tests exist
- No PWA/offline mode (critical for field workers in low-connectivity environments)

## Development Notes

- **Leaflet SSR incompatibility**: All Leaflet-dependent components must be dynamically imported with `{ ssr: false }` to prevent Next.js server-side rendering errors
- **Large state in app.js**: The main `pages/app.js` contains 80+ `useState` hooks. Consider using context or state management library for major refactors
- **No TypeScript**: This is a JavaScript-only codebase. Do not add TypeScript files or types
- **Client-side processing pattern**: Recent refactor moved heavy data processing from API routes to client-side libraries to avoid 413 payload errors and serverless timeout issues. Pattern: `lib/impactAssessment.js` for impact calculations, `lib/trendAnalysis.js` for trend analytics. APIs now handle only AI narrative generation
- **Rate limiting**: Gracefully degrades if Redis is unavailable — app continues to function without rate limiting. All AI endpoints must use `lib/rateLimit.js`
- **OSM Integration**: OSM infrastructure data is fetched automatically when districts are uploaded. Large boundaries (>10,000 km²) are automatically subdivided. Uses multi-tier caching: Redis (24h) → in-memory LRU (50 entries) → localStorage (24h)
- **AI Context Building**: When adding OSM or WorldPop context to AI endpoints, use the reusable context builders in `lib/aiContextBuilders.js` to maintain consistency across endpoints
- **Area-based workflow**: The app is designed around area-scoped analysis (not global). Features like Prioritization Board, WorldPop loading, and OSM infrastructure all depend on uploaded districts and selected analysis areas
- **Prioritization Board**: Intentionally not global — requires uploaded admin boundaries and selected area. Ranks only facilities/districts within that geography. Gracefully handles missing ACLED, WorldPop, or OSM layers with confidence scoring
- **ACLED handling**: ACLED data is optional throughout the app. Not cached in browser due to file size. All analysis features work without ACLED but provide lower-confidence results
- **Internal API calls**: Always use `APP_BASE_URL` environment variable for API-to-API calls to avoid hardcoding localhost
- **Error handling**: Client-facing errors should be generic. Never expose `error.message` directly in API responses (leaks implementation details)
- **Large payload handling**: For endpoints that process large datasets (ACLED, facilities, districts), prefer client-side processing over API POST to avoid 413 payload errors. See `TrendAnalysisDashboard.js` and `pages/app.js` (impact assessment) for the pattern: import analysis functions from `lib/` client-side and process data locally, only calling API for AI narrative generation
- **Admin boundary dataset styling**: Admin boundaries support dynamic choropleth styling via `adminDatasetStyling.js`. Supports risk-based coloring, custom dataset field visualization, quantile/equal-interval classification, and automatic metric meaning detection (worse-high vs better-high)
- **Modular dashboard components**: Trend Analysis Dashboard refactored into atomic subcomponents in `components/TrendAnalysisDashboard/` for better maintainability and reusability
