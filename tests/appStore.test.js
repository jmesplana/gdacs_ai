import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getInstalledApps, setInstalledApps, savePlan, loadPlan, listPlans } from '../lib/platform/appStore.js';

test('installations are workspace scoped and disabling preserves saved plans', async () => {
  await setInstalledApps('A', ['immunization']);
  assert.deepEqual(await getInstalledApps('B'), []);
  await savePlan({ id: 'plan-1', workspaceId: 'A', metadata: { name: 'Pilot' } });
  await setInstalledApps('A', []);
  assert.equal((await listPlans('A')).length, 1);
  assert.equal((await listPlans('B')).length, 0);
  await assert.rejects(loadPlan('plan-1', 'B'), /another boundary workspace/);
});
test('concurrent saves detect stale revisions and preserve the last valid plan', async () => {
  const first = await savePlan({ id: 'plan-2', workspaceId: 'A', metadata: { name: 'First' } });
  const second = await savePlan({ ...first, metadata: { name: 'Second' } }, first.revision);
  assert.equal(second.revision, 2);
  await assert.rejects(savePlan({ ...first, metadata: { name: 'Stale' } }, first.revision), /changed in another tab/);
  assert.equal((await loadPlan('plan-2', 'A')).metadata.name, 'Second');
});
