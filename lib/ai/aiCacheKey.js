import crypto from 'crypto';

export function createPrioritizationCacheKey(row, context = {}) {
  const payload = {
    version: 2,
    workspaceId: context.workspaceId || null,
    country: context.country || null,
    model: context.model || process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4.1-mini',
    selectedDistricts: context.selectedDistricts || [],
    facilityDataLoaded: (context.facilities?.length || 0) > 0,
    recommendedAction: row.recommendedAction || null,
    soWhat: row.soWhat || null,
    leadershipNote: row.leadershipNote || null,
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
