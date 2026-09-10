# Outbreak Response

Bundled workspace app for reported outbreak evidence, operational indicator imports,
optional maps, and reviewed leadership briefings. Install/open from Workspace apps.
No administrative layer is required. Boundaries uploaded in the main app are
available for explicit field/level matching; unmatched locations remain visible.

## Workflow

1. Use the DRC preset to load seven INSP public CSV feeds, or start a New outbreak
   for another country/disease and import scoped data. Recognized INSP data connects
   its registered source profile automatically. A manually selected connection is
   remembered for the current administrative workspace.
2. Set the reporting cut-off. National figures remain separate from local figures.
3. Upload CSV, XLS/XLSX or a flat JSON array. Choose the worksheet, location, ISO
   reporting date and numeric value columns; specify level, measure type, label,
   unit and source. Preview and confirm. Import additional indicators separately.
4. Choose the boundary name field and matching level in Situation. No fuzzy joins,
   automatic province-to-zone propagation or cross-location sums are performed.
5. Add coordinator actions, resources, owners and dates. Open Briefing and review.
6. Save snapshots to this browser workspace. Export standalone HTML with visuals, Markdown, evidence JSON,
   individual SVG maps/charts, or print the briefing to PDF.

The example SDB CSV is synthetic and must be replaced before operational use.
Only aggregate indicators are supported; this is not a patient/incident line-list
processor. Numeric imports require one observation per location/date. Duplicate
rows, invalid numbers and dates are rejected. Blank/ND/NA values remain missing.
Daily, cumulative and snapshot values are never silently interchanged. Uploaded
sources are separate series, so overlapping totals are not combined. JSON evidence
exports are audit artifacts, not an import/restore format; reopen saved snapshots
through the selector in the same browser/workspace.

## Evidence and AI

Briefing sentences and numbers are computed by the outbreak analysis modules. The
optional /api/outbreak-briefing endpoint asks AI only to select evidence IDs; any
unsupported ID is rejected and no model-generated prose is rendered. Selection
sends the visible evidence sentences (possibly including uploaded aggregates) to
the existing configured AI provider, only after the user clicks the labelled
button. OPENAI_API_KEY is optional; no AI call is needed for the briefing.

Strict parsing of the current public feeds found malformed cells. The public
adapter quarantines those values as missing and records row number, original
value and reason; it never corrects them by guessing. Invalid geography/date rows
are excluded with an issue record. Conflicting duplicate values are missing.
Each downloaded source includes its URL, retrieval timestamp and SHA-256 hash.
Live feeds may disagree, revise older values, or stop updating. Reporting cut-off
does not imply all metrics were observed on that day. Period comparisons require
all 14 daily observations for a location. Differenced cumulative values are
labelled changes in reported totals, not new infections.

## Integrated priorities and mobility

Burden, exact seven-day cumulative changes, mining sites and security overlaps
are ranked automatically. Focus-area cards state each selection reason. These
are review prompts, not validated transmission forecasts. No place names,
outbreak numbers or sample briefing conclusions are embedded in the analysis.

Click an area to inspect incoming origins or outgoing destinations as curved,
directional arrows. Maps support pan/zoom, labels and SVG export. Exact values
remain in a table. The default shows ten positive connections, with 25/all options.
Arcs connect representative polygon centres, not actual travel paths. Names must
match exactly; unmatched endpoints remain in the table. Without boundaries,
priorities and route tables still work.

The optional Flowminder source loader discovers the latest dated outflow matrix
from the source manifest. Incoming flows are column lookups of that same matrix;
the separate transpose is never added to it. Observation dates remain separate
from outbreak dates. Redacted cells remain missing. GeoJSON cohort destination
percentages and subscriber presence days are separate products, never fabricated
into OD routes. Source definitions are loaded from the catalogue/documentation.
Other outbreaks can upload one-period OD CSVs with explicit field mappings,
period and units. Duplicate pairs are rejected. Route data is saved in snapshots
and included in evidence JSON and visual briefings. Movement does not establish
imported infection, infected travellers or probabilities of exporting infection.

IPIS overlays deduplicate the latest visit per site identifier, retain visit dates
and exclude future visits. Historical sites do not imply current activity. Main-app
ACLED data is available through the read:security permission; validated unique
points are joined to uploaded polygons over an explicit date window. Ambiguous
spatial matches are excluded. Fatalities remain reported estimates. Main-app
facility locations do not imply verified response capacity. Upload dated response
indicators; the sample provincial footprint is not a computed data source.

The Situation view opens with an overall snapshot, trends, areas to review and
suggested actions. Detail maps, mobility controls and observation tables live in
an expandable area explorer. Recommendations are deterministic evidence-based
review prompts with observation periods, and can be added to the response plan.

Connected public sources refresh on app opening; Refresh data checks them again.
The registered DRC profile includes epidemiology, relocation matrices, mobility
definitions and mining. Uploaded mobility is retained. Failed refreshes keep
previous observations with a visible warning. Refresh timestamps and observation
dates are shown separately. Saved snapshots retain their recorded data until an
explicit refresh; pending live requests cannot overwrite a restored/new scope.
Main-app security and uploads have no remote connection and cannot be refreshed
by this module. Generic arbitrary-URL connectors are not implemented.

Forecasting, Word/PowerPoint exports, server sharing, scheduled background refresh
and bilingual translation are not implemented.

Public epidemiological data is preliminary; see the upstream repository guidance:
https://github.com/INRB-UMIE/BDBV2026-Data

## Validation

`npm run app:validate -- components/apps/outbreak`
`npm test`
`npm run build`
`npx playwright test tests/browser/outbreak.spec.js`

## Interaction and briefing design

Maps use fixed viewport coordinates for drag, pointer-centred wheel/double-click
zoom, two-pointer pinch/pan, and keyboard arrows/+/-/Home. Labels use measured
text widths, avoid collisions and stay legible at different display sizes; dense
labels appear progressively as the user zooms. The selected area has priority.
Maps fit within the screen height and retain SVG export.

The default briefing contains a short situation summary, up to three suggested
actions, explicit context gaps, one geographic overview, the response plan and a
folded source register. Detailed evidence and extra charts/maps require opting
into the appendix; HTML/PDF exports follow that choice. Source links remain in
exports. No missing source is represented as a complete negative assessment.

Data coverage lists ACLED, GDACS, mining, facilities, mobility and operational
categories with load/upload actions. Existing uploads can be assigned a category
without reimporting. GDACS is exposed through read:disasters and is limited to
unique alerts published within the 28 days ending at the cut-off whose centre
matches one uploaded polygon. Centres are not affected-area footprints, and
concurrent hazards are not evidence of infection or transmission. Snapshot
exports preserve the loaded GDACS input for reproduction.
