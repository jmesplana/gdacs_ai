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

## Environment Setup

Create `.env.local`:
```
OPENAI_API_KEY=sk-proj-...
APP_BASE_URL=http://localhost:3000
```

Optional environment variables:
- `REDIS_URL` — For rate limiting (production). Degrades gracefully if unavailable.
- Google Earth Engine service account credentials — For WorldPop population data integration (`pages/api/worldpop-stats.js`). This endpoint uses the `@google/earthengine` package and has a 120s timeout via `vercel.json`.

## Architecture

### Frontend (Next.js, JavaScript only — no TypeScript)

**Pages**:
- `pages/app.js` — Main application (80+ state variables, no SSR for Leaflet compatibility). All heavy components are dynamically imported with `{ ssr: false }`.
- `pages/landing.js` — Marketing/onboarding page
- `pages/index.js` — Redirects to `/landing`

**Component hierarchy**:
- `components/MapComponent.js` (~10,300 LOC including subcomponents) — the core map interface
  - `components/MapComponent/hooks/` — Custom hooks: `useAIAnalysis`, `useDrawing`, `useFileUpload`, `useMapControls`, `useMapFilters`, `usePlayback`, `useWorldPop`
  - `components/MapComponent/components/drawers/` — Side panels: `ChatDrawer`, `FacilityDrawer`, `FilterDrawer`, `MapLayersDrawer`, `RecommendationsDrawer`, `SitrepDrawer`, `UnifiedDrawer`, `WorldPopDrawer`
  - `components/MapComponent/components/overlays/` — Map overlays: `FloatingActionButtons`, `HamburgerMenu`, `MapLegend`, `TimelineScrubber`, `CampaignDashboard`
  - `components/MapComponent/components/` — Map layers: `AcledMarkers`, `DisasterMarkers`, `DrawingLayer`, `HeatmapLayer`, `TimelineVisualization`
  - `components/MapComponent/utils/` — Geospatial helpers: `disasterHelpers`, `fileHelpers`, `mapHelpers`
- Other major components: `PredictionDashboard.js`, `OperationalOutlook.js`, `LandingPage.js`, `ShapefileUploader.js`, `SitrepGenerator.js`

**State management**: Local `useState` throughout — no Redux/Zustand. `pages/app.js` owns top-level state and passes down via props.

### Backend (Next.js API Routes)

All AI endpoints are rate-limited via `lib/rateLimit.js` (100 req/hr per IP, Redis-backed).

Key routes:
- `pages/api/chat.js` — Chatbot using GPT-4o with web search
- `pages/api/impact_assessment.js` — Calculates disaster proximity to uploaded facilities using `geolib`
- `pages/api/process-shapefile.js` — Parses SHP/GeoJSON uploads (60s timeout, 3GB memory via `vercel.json`)
- `pages/api/worldpop-stats.js` — Fetches WorldPop population data via Google Earth Engine (120s timeout, 1GB memory via `vercel.json`)
- `pages/api/gdacs.js` — Proxies/parses GDACS RSS feed
- `pages/api/operational-outlook.js` — Forward-looking analysis with DuckDuckGo scraping

Other AI endpoints (all rate-limited): `analysis.js`, `campaign-viability.js`, `campaign-viability-batch.js`, `disaster-forecast.js`, `district-campaign-viability.js`, `operation-viability.js`, `outbreak-prediction.js`, `recommendations.js`, `security-assessment.js`, `sitrep.js`, `supply-chain-forecast.js`, `weather-forecast.js`

The `APP_BASE_URL` env var is used for internal API-to-API calls (avoid hardcoding `localhost`).

### Data Flow

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

### Configuration

- `config/operationTypes.js` — Defines operation type categories and their analysis templates
- `config/predictionConfig.js` — Prediction model configuration
- `next.config.js` — Rewrites `/api/gdacs-feed` → `https://gdacs.org/xml/rss.xml`; marks `@google/earthengine` as server-only
- `vercel.json` — Custom timeouts/memory: `process-shapefile.js` (60s/3GB), `worldpop-stats.js` (120s/1GB)

## Custom Slash Commands

- `/brand-aidstack` — Apply Aidstack branding to components and pages using official brand guidelines

## Known Issues & Production Gaps

From `PRODUCTION_ROADMAP.md`:
- Upload size limits not enforced (target: 1MB)
- API error messages leak implementation details (`.message` exposed)
- `pages/api/operational-outlook.js` has no timeout on external HTTP calls — potential hanging
- Mobile layout is broken (hardcoded 600px min-width)
- No automated tests exist

## Development Notes

- **Leaflet SSR incompatibility**: All Leaflet-dependent components must be dynamically imported with `{ ssr: false }` to prevent Next.js server-side rendering errors
- **Large state in app.js**: The main `pages/app.js` contains 80+ `useState` hooks. Consider using context or state management library for major refactors
- **No TypeScript**: This is a JavaScript-only codebase. Do not add TypeScript files or types
- **Rate limiting**: Gracefully degrades if Redis is unavailable — app continues to function without rate limiting
