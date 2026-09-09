import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDB } from 'idb';
import { getInstalledApps, setInstalledApps } from '../lib/platform/appStore.js';
import { createModuleStorage } from '../lib/platform/moduleStorage.js';

const legacy = await openDB('aidstack_planning_apps', 1, {
  upgrade(db) {
    db.createObjectStore('settings');
    db.createObjectStore('plans');
    db.createObjectStore('summaries', { keyPath: 'id' }).createIndex('workspaceId', 'workspaceId');
    db.createObjectStore('versions', { keyPath: ['id', 'revision'] }).createIndex('planId', 'id');
  }
});
const oldPlan = { id: 'legacy', workspaceId: 'legacy-workspace', metadata: { name: 'Existing' }, revision: 2, savedAt: '2026-01-01T00:00:00.000Z' };
await legacy.put('plans', oldPlan, oldPlan.id);
await legacy.put('summaries', { ...oldPlan, name: oldPlan.metadata.name });
await legacy.put('versions', { ...oldPlan, revision: 1 });
await legacy.put('versions', oldPlan);
await legacy.put('settings', ['immunization'], 'legacy-workspace');
legacy.close();

const store = (workspaceId = 'A', moduleId = 'immunization') => createModuleStorage({ workspaceId, moduleId });
const listPlans = (workspaceId) => store(workspaceId).listPlans();
const loadPlan = (id, workspaceId) => store(workspaceId).loadPlan(id);
const savePlan = (plan, revision) => store(plan.workspaceId).savePlan(plan, revision);

test('migrates legacy plans and all revisions while retaining installations', async () => {
  const storage = store('legacy-workspace');
  assert.deepEqual(await storage.loadPlan('legacy'), { ...oldPlan, moduleId: 'immunization' });
  assert.equal((await storage.listPlans())[0].name, 'Existing');
  assert.deepEqual(await getInstalledApps('legacy-workspace'), ['immunization']);
  assert.equal(await store('legacy-workspace', 'malaria').loadPlan('legacy'), undefined);
  const db = await openDB('aidstack_planning_apps', 2);
  assert.equal((await db.getAll('moduleVersions')).length, 2);
  assert.deepEqual(await db.get('plans', 'legacy'), oldPlan);
  db.close();
  assert.equal((await storage.savePlan(oldPlan, 2)).revision, 3);
});

test('installations are workspace scoped and disabling preserves saved plans', async () => {
  await setInstalledApps('A', ['immunization']);
  assert.deepEqual(await getInstalledApps('B'), []);
  await savePlan({ id: 'plan-1', workspaceId: 'A', metadata: { name: 'Pilot' } });
  await setInstalledApps('A', []);
  assert.equal((await listPlans('A')).length, 1);
  assert.equal((await listPlans('B')).length, 0);
  assert.equal(await loadPlan('plan-1', 'B'), undefined);
});

test('same id stays independent across modules and workspaces', async () => {
  const scopes = [store('isolated'), store('isolated', 'malaria'), store('other')];
  for (const [index, storage] of scopes.entries()) {
    await storage.savePlan({ id: 'shared', metadata: { name: String(index) } });
  }
  for (const [index, storage] of scopes.entries()) {
    assert.equal((await storage.loadPlan('shared')).metadata.name, String(index));
    assert.equal((await storage.listPlans())[0].name, String(index));
  }
});

test('rejects mismatched scope and invalid records', async () => {
  const storage = store();
  const plan = { id: 'invalid', metadata: { name: 'Invalid' } };
  await assert.rejects(storage.savePlan({ ...plan, moduleId: 'malaria' }), /another workspace or module/);
  await assert.rejects(storage.savePlan({ ...plan, workspaceId: 'B' }), /another workspace or module/);
  await assert.rejects(storage.savePlan(plan, -1), /revision/);
  await assert.rejects(storage.savePlan({ id: 'invalid' }), /metadata.name/);
  assert.equal(await storage.loadPlan('invalid'), undefined);
  assert.throws(() => store(''), /workspaceId/);
  assert.throws(() => store('A', ''), /moduleId/);
});
test('concurrent saves detect stale revisions and preserve the last valid plan', async () => {
  const first = await savePlan({ id: 'plan-2', workspaceId: 'A', metadata: { name: 'First' } });
  const second = await savePlan({ ...first, metadata: { name: 'Second' } }, first.revision);
  assert.equal(second.revision, 2);
  await assert.rejects(savePlan({ ...first, metadata: { name: 'Stale' } }, first.revision), /changed in another tab/);
  assert.equal((await loadPlan('plan-2', 'A')).metadata.name, 'Second');
});
