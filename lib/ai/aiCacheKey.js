import crypto from 'crypto';

export function createPrioritizationCacheKey(row, context = {}) {
  const payload = {
    district: row.district || row.districtName || 'Unknown',
    priorityScore: row.priorityScore ?? row.score ?? null,
    priorityLevel: row.priorityLevel ?? row.level ?? null,
    keyGaps: Array.isArray(row.keyGaps) ? row.keyGaps.slice(0, 5) : [],
    operationType: context.operationType || 'general',
    date: new Date().toISOString().slice(0, 10),
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  return `ai:prioritization:${hash}`;
}
