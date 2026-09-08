export function numericValue(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number(text.replace(/,/g, '').replace(/%$/, ''));
  return Number.isFinite(number) ? number : null;
}

const COUNT_FIELDS = new Set(['children_missed', 'children_vaccinated', 'refusals', 'cases', 'polio_cases', 'afp_cases', 'doses_administered']);

export function aggregateIndicator(rows, field, definition = null) {
  const key = field.toLowerCase();
  const rule = definition || (key === 'coverage_rate'
    ? { aggregation: 'ratio', numerator: 'children_vaccinated', denominator: 'target_population' }
    : { aggregation: COUNT_FIELDS.has(key) ? 'sum' : /rate|percent|coverage|population|catchment/.test(key) ? 'single' : 'mean' });
  const values = rows.map((row) => numericValue(row[field])).filter((value) => value !== null);
  if (rule.aggregation === 'ratio') {
    const pairs = rows.map((row) => [numericValue(row[rule.numerator]), numericValue(row[rule.denominator])]);
    if (pairs.some(([n, d]) => n === null || d === null || n < 0 || d <= 0 || n > d)) {
      return { value: null, aggregation: 'ratio', issue: 'Compatible numerator and denominator required for every row' };
    }
    const denominator = pairs.reduce((sum, [, d]) => sum + d, 0);
    return { value: denominator ? 100 * pairs.reduce((sum, [n]) => sum + n, 0) / denominator : null, aggregation: 'ratio' };
  }
  if (!values.length || values.length !== rows.length) return { value: null, aggregation: rule.aggregation, issue: 'Incomplete observations' };
  if (rule.aggregation === 'single' && values.length > 1) return { value: null, aggregation: 'single', issue: 'An explicit aggregation contract is required' };
  const total = values.reduce((sum, value) => sum + value, 0);
  return { value: rule.aggregation === 'sum' ? total : total / values.length, aggregation: rule.aggregation };
}
