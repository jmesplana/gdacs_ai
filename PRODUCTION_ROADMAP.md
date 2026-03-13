# Aidstack Disasters — Production Roadmap

**App**: [disasters.aidstack.ai](https://disasters.aidstack.ai)
**Current version**: 0.1.0
**Goal**: Take the platform from functional prototype to production-grade tool adopted by INGOs, UN agencies, and humanitarian organizations worldwide.

---

## What This App Is

**Aidstack Disasters** is a real-time operational intelligence platform for humanitarian workers. It fuses live disaster data (GDACS), conflict/security events (ACLED), user facility data, and admin boundaries into an AI-powered decision-support interface.

**Who it's for**: Operations teams, safety & security officers, logistics coordinators, and program managers at INGOs, UN agencies, and NGOs — professionals making time-sensitive, high-stakes decisions about field deployments, supply chains, and health campaigns.

**What makes it defensible**: Purpose-built for humanitarian operational context. Speaks immunization coverage, zero-dose districts, cold-chain, WASH, SPHERE — things general-purpose GIS tools don't understand.

---

## Agent Audit Summary (March 2026)

Four specialized agents audited the codebase across security, UX, mobile/performance, and integration dimensions. Key findings:

| Dimension | Verdict |
|---|---|
| Security | Not production-safe: no rate limiting, error leakage, unvalidated inputs |
| UX | High friction: 13 `alert()` calls, no onboarding, no empty states, no facility search |
| Mobile/Performance | Unusable on phones: hardcoded `min-width: 600px`, no PWA, 800KB bundle, 31 unoptimized state hooks |
| Integrations | Clear path to adoption: HDX, DHIS2, KoboToolbox, ReliefWeb all have well-documented APIs |

---

## Phase 1 — Make It Safe
**Target**: 1 day | **Status**: In Progress

Security blockers that must be resolved before any organization evaluates this seriously.

- [x] Rate limit all OpenAI API routes (100 req/hour per IP)
- [ ] Reduce request body size limits from 10MB → 1MB across all API routes
- [ ] Replace all `error.message` in API responses with generic "Internal server error"
- [ ] Cap shapefile upload size (currently 100MB — decide on appropriate limit)
- [x] Fix `NEXT_PUBLIC_BASE_URL` pattern in `operation-viability.js` and `campaign-viability.js`
- [ ] Strip sensitive data from `console.log` calls in API routes (production leakage)
- [x] Add method validation (`POST` only) on all state-changing endpoints
- [ ] Add timeout to external HTTP calls in `operational-outlook.js` (DuckDuckGo scraping, no timeout)

---

## Phase 2 — Make It Usable
**Target**: 2 days | **Status**: In Progress

UX improvements that cut time-to-value from ~30 minutes to ~5 minutes for a first-time humanitarian org user.

- [x] Replace all 13 `alert()` calls with in-app toast notifications (error + success)
- [x] Add guided onboarding modal (3-step: Upload → Assess → Report) shown on first visit
- [x] Add empty state with "Get Started" CTA when no data is loaded
- [ ] Add `"Using demo data"` warning banner when GDACS live feed fails
- [ ] Add facility search + status filter to the facility drawer
- [ ] Add React Error Boundary — prevent full white-screen on component crash
- [ ] Fix mobile drawer: remove hardcoded `min-width: 600px`, make fully responsive
- [ ] Fix map container height for mobile (`100dvh` instead of `calc(100vh - 180px)`)
- [x] Add progress detail messages for long AI operations (10–30s) so users don't think it froze
- [ ] Expand map legend with facility status, disaster types, and risk zone explanations
- [x] Add data freshness indicator ("Refreshed 2 min ago") to header
- [ ] Standardize UI terminology: "Situation Report", "Impacted Facility", "Data Hub" consistently

---

## Phase 3 — Make It Credible
**Target**: 1–2 weeks | **Status**: Pending

Integrations that remove manual data entry friction and ground AI analysis in authoritative sources.

### 3a. HDX Admin Boundaries Auto-Import (1–2 days)
- Replace manual shapefile upload with a country picker that auto-loads UN COD admin boundaries
- HDX API is public (no auth), returns GeoJSON directly usable by Leaflet
- Removes the single biggest UX friction point for new users
- Add HDX attribution: "Boundaries: OCHA HDX"

### 3b. ReliefWeb Context Injection (1 day)
- Auto-fetch latest situation reports for active crises from ReliefWeb API (no auth required)
- Inject as context into GPT-4 — AI answers become grounded in authoritative OCHA sources
- Show "Sources: ReliefWeb sitrep — [date]" citation in AI responses

### 3c. DHIS2 Facility Import (2–3 days)
- "Import from DHIS2" flow: user enters instance URL + Personal Access Token
- Fetch organisation units at selected admin level via `/api/organisationUnits`
- Facilities with geometry appear on map as a layer
- Critical for health-sector orgs: UNICEF, WHO, national health ministries all run DHIS2

### 3d. KoboToolbox Data Import (2–3 days)
- "Import from KoboToolbox" flow: user enters API token + picks a form
- Fetch submissions with `_geolocation` → map layer with field assessment data
- Connects directly to existing INGO data collection workflows (UNHCR, WFP, IRC, Save the Children)
- Paginate for large forms (5,000–50,000 submissions)

---

## Phase 4 — Make It Adoptable by Organizations
**Target**: Month 2 | **Status**: Pending

Authentication and persistence that passes INGO IT security reviews and enables org-level workflows.

### 4a. NextAuth.js Authentication (3–5 days)
- Multi-tenant Azure AD (covers UNICEF, WHO, OCHA, WFP, IRC, Save the Children — 90%+ of UN/INGO staff)
- Google OAuth as secondary provider (MSF, field NGOs)
- No email/password auth (reduces attack surface)
- 8-hour session timeout
- **Prerequisite**: Publish Privacy Policy + Terms of Service (required for Azure AD multi-tenant approval)

### 4b. Server-Side Persistence (2–3 days)
- Vercel Postgres (Neon) via `@auth/pg-adapter`
- Schema: users, sessions, saved_maps, org_settings
- Replace localStorage with server-side saved map sessions
- Enables: "Resume where you left off", shared sessions across teammates

### 4c. Org-Level Configuration (2–3 days)
- Per-org settings stored by email domain: DHIS2 URL, KoboToolbox URL, default country
- Org admin role can configure defaults for all org members
- Audit log: who ran what analysis, when

---

## Phase 5 — Make It Scale
**Target**: Month 2–3 | **Status**: Planned

Performance and infrastructure for real-world operational load.

### 5a. Bundle Optimization (4–5 days)
- Lazy-load `openai`, `leaflet-draw`, `xlsx` (not needed on initial load)
- Target: 40–50% bundle reduction → 4–5s load on 2G instead of 8–10s
- `openai` package should never be loaded client-side

### 5b. State Management Refactor (6–8 days)
- Consolidate 31 `useState` hooks in `app.js` into context groups
- Wrap `MapComponent`, `ChatDrawer` in `React.memo`
- Add `useCallback` to all event handlers passed as props
- `useMemo` for district risk calculations (currently 200k comparisons per render)

### 5c. List Virtualization (5–7 days)
- `react-window` for facility drawer, disaster list, ACLED event list
- Smooth scrolling with 500+ facilities (currently all rendered simultaneously)

### 5d. IndexedDB Migration (8–10 days)
- Replace `localStorage` with IndexedDB (Dexie.js) for facilities, disasters, ACLED data
- Async, non-blocking; no 5–10MB limit
- Cache expiry/rotation (7-day TTL)

### 5e. PWA / Offline Mode (20–30 days)
- `manifest.json` + Workbox service worker
- Cache-first for static assets; network-first with fallback for API data
- IndexedDB for offline facility/disaster data access
- **Critical for field workers in low-connectivity environments**

---

## Phase 6 — Differentiating Features
**Target**: Month 3+ | **Status**: Planned

Features that make Aidstack the only tool humanitarian orgs want for this workflow.

- [ ] **OCHA FTS Funding Overlay** — spatially show funding gaps vs. needs; no other mapping tool does this
- [ ] **Scheduled alerts** — email/push when new disasters appear near tracked facilities
- [ ] **Team collaboration** — shared map sessions, facility annotations, status updates
- [ ] **Safe route planning** — evacuation routing that avoids disaster zones and conflict areas
- [ ] **Multi-country dashboard** — org-wide view across all active operations
- [ ] **Export to PDF/Excel** — high-resolution map export, district risk table export
- [ ] **Mobile app (PWA install)** — homescreen install, offline maps, GPS facility lookup

---

## Integration Reference

| System | Auth | API Base | Key Use |
|---|---|---|---|
| HDX (OCHA) | None (public) | `https://data.humdata.org/api/3` | Admin boundaries, population, facility data |
| ReliefWeb | None (public) | `https://api.reliefweb.int/v1` | Situation reports for AI context |
| GDACS | None (public) | `https://www.gdacs.org/gdacsapi/` | Live disaster alerts (already integrated) |
| DHIS2 | PAT token | `{instance}/api` | Health facility locations with geometry |
| KoboToolbox | API token | `https://kobo.humanitarianresponse.info/api/v2` | Field assessment data with GPS |
| OCHA FTS | None (public) | `https://api.hpc.tools/v2/public` | Humanitarian funding flows |
| ACLED | API key | `https://api.acleddata.com` | Conflict/security events (user uploads CSV currently) |

### Licensing Notes
- **HDX/ReliefWeb/FTS**: Open data, attribution required for HDX
- **ACLED**: Non-commercial license only — do not bundle; link out only (current approach ✅)
- **Azure AD multi-tenant**: Requires published Privacy Policy + ToS before Microsoft approval

---

## Adoption Path to OCHA/UNICEF Catalog

The combination of:
1. HDX + ReliefWeb + DHIS2 + KoboToolbox integrations
2. Multi-tenant Azure AD SSO
3. Audit logging and org-level settings

...would make Aidstack a credible candidate for inclusion in **OCHA's Digital Hub catalog** and **UNICEF's approved tools list** — the primary adoption channels for the humanitarian sector.

---

## Success Metrics

| Metric | Current | Target (6 months) |
|---|---|---|
| Time-to-value (first use) | ~30 min | < 5 min |
| Mobile usability | Broken | Full feature parity |
| Org security review pass rate | 0% | >80% |
| Load time on 3G | ~8–10s | < 3s |
| Data sources (no upload needed) | 1 (GDACS) | 4 (GDACS + HDX + ReliefWeb + DHIS2) |
| Supported auth providers | 0 | Azure AD + Google |

---

*Last updated: 13 March 2026*
