// Deterministic response-side rollups. Missing observations are never zero and no
// pillar status is asserted without loaded, dated response indicators.
import { latestPerLocation, formatValue } from './data.js';
import { epidemiology, shiftDate } from './insights.js';

// Classify a numeric change for display. A null delta has no comparable basis (not a trend).
export function deltaTrend(delta) {
  if (delta === null || delta === undefined) return 'none';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

export const PILLARS = [
  ['sdb', 'Safe & dignified burial'],
  ['rcce', 'Community engagement / RCCE'],
  ['logistics', 'Logistics & supplies'],
  ['response', 'Response presence & capacity']
];

// Optional rate rules per pillar: a coverage ratio of a "completed" numerator over a
// "denominator", scored against operational thresholds. Higher is better unless overloadAt
// is set (e.g. bed occupancy, where exceeding 100% is the concern). Rules are matched by
// dataset-label keywords so uploads drive them; nothing is assumed when a pair is absent.
export const RATE_RULES = {
  sdb: { label: 'Safe burials completed', numerator: /complet|conduct|done|performed/i, denominator: /request|expected|reported|alert/i, watch: 0.9, attention: 0.7 },
  response: [
    { label: 'Contact follow-up rate', numerator: /followed|follow.?up|seen|visited/i, denominator: /registered|listed|under follow|contacts?$/i, watch: 0.95, attention: 0.8 },
    { label: 'Bed occupancy', numerator: /occup|patients?|admitted|isolation/i, denominator: /bed|capacity|available/i, overloadAt: 1, watch: 0.85 }
  ]
};

// Sum reported (non-missing) latest observations across areas for a category's datasets,
// with the matching seven-day-earlier total for areas reporting on both dates.
function categoryTotals(datasets, category, asOf) {
  const sets = datasets.filter(d => d.category === category && d.status === 'ready');
  if (!sets.length) return null;
  let value = 0, previous = 0, reporting = 0, comparable = 0, missing = 0;
  for (const d of sets) {
    const latest = latestPerLocation(d.records, asOf);
    for (const row of latest) {
      if (row.value === null) { missing++; continue; }
      reporting++; value += row.value;
      const baselineDate = shiftDate(row.date, -7);
      const prior = d.records.find(r => r.location === row.location && r.date === baselineDate && r.value !== null);
      if (prior) { comparable++; previous += prior.value; }
    }
  }
  return { value, previous: comparable ? previous : null, reporting, comparable, missing, delta: comparable ? value - previous : null };
}

// Evaluate one rate rule: a numerator total over a denominator total, matched by dataset-label
// keywords within a category. The ratio is reported only when both totals are present and the
// denominator is positive, so a difference is never assumed without an explicit paired source.
function evaluateRate(datasets, category, rule, asOf) {
  const num = categoryTotals(datasets.filter(d => rule.numerator.test(d.label)), category, asOf);
  const den = categoryTotals(datasets.filter(d => rule.denominator.test(d.label)), category, asOf);
  if (!num || !den || !den.value) return null;
  const rate = num.value / den.value;
  let level;
  if (rule.overloadAt !== undefined && rate >= rule.overloadAt) level = 'attention';
  else if (rate >= (rule.watch ?? 1)) level = 'on-track';
  else if (rule.attention !== undefined && rate < rule.attention) level = 'attention';
  else level = 'watch';
  return { label: rule.label, numerator: num.value, denominator: den.value, rate, level, target: rule.watch };
}

function rateRulesFor(id) {
  const r = RATE_RULES[id];
  return Array.isArray(r) ? r : r ? [r] : [];
}

const RANK = { attention: 3, watch: 2, 'on-track': 1, reported: 0 };

export function responseStatus(datasets, actions = [], asOf) {
  const pillars = PILLARS.map(([id, label]) => {
    const totals = categoryTotals(datasets, id, asOf);
    if (!totals) return { id, label, loaded: false, note: 'No dated indicators loaded for this pillar.' };
    const rates = rateRulesFor(id).map(rule => evaluateRate(datasets, id, rule, asOf)).filter(Boolean);
    let level = 'reported', note;
    if (rates.length) {
      level = rates.reduce((worst, r) => RANK[r.level] > RANK[worst] ? r.level : worst, 'on-track');
      note = rates.map(r => `${r.label}: ${(r.rate * 100).toFixed(0)}%${r.target ? ` (target ${(r.target * 100).toFixed(0)}%)` : ''} — ${formatValue(r.numerator)} of ${formatValue(r.denominator)}.`).join(' ');
    } else {
      note = `${formatValue(totals.value)} reported across ${totals.reporting} area records`;
      if (totals.delta !== null) note += `; ${totals.delta >= 0 ? '+' : ''}${formatValue(totals.delta)} vs seven days earlier (${totals.comparable} comparable)`;
      note += `. Missing values are not zero.`;
    }
    return { id, label, loaded: true, level, note, rates, missing: totals.missing, delta: totals.delta };
  });
  const openActions = actions.filter(a => ['Proposed', 'In progress'].includes(a.status)).length;
  const blocked = actions.filter(a => a.status === 'Blocked').length;
  return { pillars, actions: { open: openActions, blocked, total: actions.length }, loadedPillars: pillars.filter(p => p.loaded).length };
}

// Difference the current situation against a previously saved snapshot for "since last brief".
// Only reports changes that both snapshots can support; absence of a metric is never a decline.
export function sinceLast(current, previousSnapshot, asOf) {
  if (!previousSnapshot) return null;
  const lines = [];
  const priorAsOf = previousSnapshot.asOf;
  // National confirmed totals: compare latest reported value in each snapshot's national series.
  const nationalLabel = 'National cumulative confirmed cases';
  const now = current.national.find(f => f.label === nationalLabel);
  const wasSets = (previousSnapshot.datasets || []).filter(d => d.level === 'national' && d.status === 'ready');
  const wasRow = wasSets.flatMap(d => latestPerLocation(d.records, priorAsOf)).find(r => r.metric === nationalLabel || true);
  if (now && wasRow && wasRow.value !== null) {
    const delta = now.value - wasRow.value;
    lines.push({ label: nationalLabel, value: formatValue(now.value), delta, since: `since ${priorAsOf}` });
  } else if (now) {
    lines.push({ label: nationalLabel, value: formatValue(now.value), delta: null, since: 'no comparable value in the previous snapshot' });
  }
  // New reporting areas: areas reporting positive cases now but absent from the prior snapshot's affected set.
  const priorEpi = epidemiology(previousSnapshot.datasets || [], previousSnapshot.geometry, priorAsOf, previousSnapshot.epiSource, previousSnapshot.boundaryLevel);
  if (current.epi) {
    const wasAffected = new Set(priorEpi?.affected.map(z => z.location) || []);
    const nowAreas = current.epi.affected.map(z => z.location);
    const added = nowAreas.filter(n => !wasAffected.has(n));
    if (priorEpi) lines.push({ label: 'Reporting areas', delta: added.length || null, value: added.length ? `${added.length} newly reporting positive cases` : 'No newly reporting areas', since: added.length ? added.slice(0, 6).join(', ') + (added.length > 6 ? '…' : '') : `since ${priorAsOf}` });
  }
  // Response coverage: compare each loaded pillar's reported total against the prior snapshot's.
  for (const [id, label] of PILLARS) {
    const nowTotal = categoryTotals(current.datasets, id, asOf);
    const wasTotal = categoryTotals(previousSnapshot.datasets || [], id, priorAsOf);
    if (nowTotal && wasTotal) lines.push({ label, value: `${formatValue(nowTotal.value)} reported`, delta: nowTotal.value - wasTotal.value, since: `since ${priorAsOf}` });
  }
  return { priorAsOf, priorName: previousSnapshot.name, lines };
}
