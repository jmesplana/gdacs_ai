import test from 'node:test';
import assert from 'node:assert/strict';

import { createPrioritizationCacheKey } from '../lib/ai/aiCacheKey.js';

test('createPrioritizationCacheKey returns stable prioritization cache keys', () => {
  const row = {
    district: 'District A',
    priorityScore: 82,
    priorityLevel: 'high',
    keyGaps: ['access', 'cold chain', 'staffing', 'fuel', 'security', 'extra gap'],
  };
  const context = { operationType: 'cholera' };

  const firstKey = createPrioritizationCacheKey(row, context);
  const secondKey = createPrioritizationCacheKey({ ...row }, { ...context });

  assert.equal(firstKey, secondKey);
  assert.match(firstKey, /^ai:prioritization:[a-f0-9]{64}$/);
});

test('createPrioritizationCacheKey changes when key prioritization context changes', () => {
  const row = {
    district: 'District A',
    priorityScore: 82,
    priorityLevel: 'high',
    keyGaps: ['access'],
  };

  const generalKey = createPrioritizationCacheKey(row, { operationType: 'general' });
  const healthKey = createPrioritizationCacheKey(row, { operationType: 'health' });

  assert.notEqual(generalKey, healthKey);
});

test('createPrioritizationCacheKey ignores key gaps after the first five', () => {
  const baseRow = {
    district: 'District A',
    priorityScore: 82,
    priorityLevel: 'high',
    keyGaps: ['one', 'two', 'three', 'four', 'five'],
  };

  const baseKey = createPrioritizationCacheKey(baseRow);
  const extraGapKey = createPrioritizationCacheKey({
    ...baseRow,
    keyGaps: [...baseRow.keyGaps, 'six'],
  });

  assert.equal(baseKey, extraGapKey);
});
