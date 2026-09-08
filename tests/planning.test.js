import test from 'node:test';
import assert from 'node:assert/strict';
import { convertFacilitiesToCSV } from '../components/MapComponent/utils/fileHelpers.js';
import { buildAdminDatasetJoin } from '../components/MapComponent/utils/adminDatasetJoin.js';
import { filterOsmDataToDistricts } from '../lib/analysisScope.js';
import { areaIdentity, geographyKey } from '../lib/planning/geography.js';
import { applyEvidenceGate } from '../lib/planning/evidence.js';
import { normalizeObservations, calculatePlan, validatePlan, validateSessions } from '../lib/planning/immunization.js';
import { calculateEpidemicRisk, predictCases } from '../config/predictionConfig.js';

const geometry = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
const districts = [{ id: 'A', name: 'Area A', properties: { PCODE: 'A001' }, geometry }];
const rows = [{ settlement_id: '1', settlement: 'One', area_code: 'A001', target_population: 100, children_vaccinated: 90 },
  { settlement_id: '2', settlement: 'Two', area_code: 'A001', target_population: 1000, children_vaccinated: 100 }];
function planFixture() {
  return { schemaVersion: 1, metadata: { name: 'Plan', vaccine: 'Test antigen', dose: '1', cohort: 'Test cohort', period: '2026-Q3', source: 'Test' },
    observations: normalizeObservations(rows, districts, {}, 'PCODE').observations, sessions: [],
    assumptions: { dailyCapacity: 50, wastagePercent: 10, bufferPercent: 10, stockDoses: 0, costPerTeamDay: 100 } };
}

test('mapped import preserves zero and false while leaving missing values empty', () => {
  assert.equal(convertFacilitiesToCSV([{ name: 'A', lat: 1, lon: 1, vaccinated: 0, active: false, unknown: null }],
    { name: 'name', latitude: 'lat', longitude: 'lon', aiAnalysisFields: ['vaccinated', 'active', 'unknown'] }),
  'name,latitude,longitude,vaccinated,active,unknown\nA,1,1,0,false,');
});
test('district counts sum and rates use compatible denominators', () => {
  const data = rows.map((row) => ({ ...row, latitude: 1, longitude: 1, children_missed: row.target_population - row.children_vaccinated, coverage_rate: row.children_vaccinated / row.target_population * 100 }));
  assert.equal(buildAdminDatasetJoin(data, districts, 'children_missed').byDistrictId.A.aggregated.children_missed.value, 910);
  assert.ok(Math.abs(buildAdminDatasetJoin(data, districts, 'coverage_rate').byDistrictId.A.aggregated.coverage_rate.value - 190 / 1100 * 100) < 1e-9);
  assert.equal(buildAdminDatasetJoin([{ latitude: 1, longitude: 1, coverage_rate: 90 }, { latitude: 1, longitude: 1, coverage_rate: 10 }], districts, 'coverage_rate').byDistrictId.A.aggregated.coverage_rate.value, null);
});
test('geometry scope retains crossing roads and containing polygons but rejects disjoint roads', () => {
  const features = [
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-1, 1], [3, 1]] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-1, -1], [3, -1], [3, 3], [-1, 3], [-1, -1]]] } },
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-2, -2], [-1, -1]] } }
  ];
  assert.equal(filterOsmDataToDistricts({ features }, districts).features.length, 2);
});
test('area identity survives ordering and geometry revisions change the workspace', () => {
  const first = { ...areaIdentity({ geometry, properties: { PCODE: 'A', COUNTRY: 'X' } }), geometry };
  const second = { ...areaIdentity({ geometry, properties: { PCODE: 'B', COUNTRY: 'X' } }), geometry };
  assert.equal(geographyKey([first, second]), geographyKey([second, first]));
  assert.notEqual(first.id, areaIdentity({ geometry, properties: { PCODE: 'A', COUNTRY: 'Y' } }).id);
  assert.notEqual(geographyKey([first]), geographyKey([{ ...first, geometryVersion: 'changed' }]));
});
test('missing evidence does not produce GO and heuristic confidence is unvalidated', () => {
  const assessment = applyEvidenceGate({ viabilityScore: 100, decision: 'GO' }, { disasters: [], impacts: [], operationType: 'immunization' });
  assert.equal(assessment.viabilityScore, null);
  assert.equal(assessment.decision, 'INSUFFICIENT EVIDENCE');
  assert.equal(calculateEpidemicRisk('measles', { displacement: 1 }).confidence, 'UNVALIDATED');
  assert.equal(predictCases(20, 10000, 1, 90, 3).cases, 10000);
  assert.equal(predictCases(20, 0, 1, 90, 3).cases, null);
});
test('admin-code imports do not require coordinates and preserve observed zero', () => {
  const normalized = normalizeObservations([{ ...rows[0], children_vaccinated: 0 }], districts, {}, 'PCODE');
  assert.equal(normalized.issues.length, 0);
  assert.equal(normalized.observations[0].vaccinated, 0);
  assert.equal(normalized.observations[0].latitude, null);
});
test('imports reject duplicates, unknown areas, missing counts, and impossible coverage', () => {
  const normalized = normalizeObservations([rows[0], rows[0], { ...rows[1], area_code: 'unknown' }, { ...rows[1], settlement_id: '3', children_vaccinated: '' }, { ...rows[1], settlement_id: '4', children_vaccinated: 1001 }], districts, {}, 'PCODE');
  assert.equal(normalized.observations.length, 1);
  assert.equal(normalized.issues.length, 4);
});
test('coordinates that contradict an area code are rejected', () => {
  assert.equal(normalizeObservations([{ ...rows[0], latitude: 10, longitude: 10 }], districts, {}, 'PCODE').issues.length, 1);
});
test('plans aggregate weighted coverage and reconcile actual delivery once', () => {
  const plan = planFixture();
  plan.sessions = [{ id: 's1', observationId: plan.observations[1].id, date: '2026-09-10', team: 'Team A', mode: 'Mobile', planned: 100, actual: 50 }];
  assert.deepEqual(validatePlan(plan), []);
  const result = calculatePlan(plan);
  assert.equal(result.totals.missed, 910);
  assert.equal(result.totals.remaining, 860);
  assert.equal(result.totals.unassigned, 810);
  assert.equal(result.resources.doses, 123);
  assert.equal(result.resources.teamDays, 2);
  assert.equal(result.resources.overloaded, 1);
  assert.equal(result.areas[0].coverage, 190 / 1100 * 100);
});
test('sessions cannot overallocate a settlement, overreport delivery, or use invalid dates', () => {
  const plan = planFixture();
  const session = { id: 's1', observationId: plan.observations[0].id, date: '2026-02-30', team: 'A', mode: 'Fixed', planned: 11, actual: 12 };
  const errors = validateSessions([session], plan.observations);
  assert.equal(errors.length, 3);
});
test('unknown target is rejected; zero target has unknown coverage rather than 0%', () => {
  const plan = planFixture();
  plan.observations = [{ ...plan.observations[0], target: 0, vaccinated: 0 }];
  assert.equal(calculatePlan(plan).totals.coverage, null);
  plan.observations[0].target = null;
  assert.ok(validatePlan(plan).length);
});
