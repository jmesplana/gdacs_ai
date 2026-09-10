import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { readAppPackage, installAppPackage, listAppPackages, setPackageEnabled } from '../lib/platform/appPackages.js';
import { handleAppRequest } from '../lib/platform/appBridge.js';
import { createModuleStorage } from '../lib/platform/moduleStorage.js';

const bytes = readFileSync(new URL('../public/apps/activity-planner.zip', import.meta.url));
test('installs packages per workspace and preserves code when disabled', async () => {
  const pkg = await readAppPackage(bytes, ['immunization']);
  await installAppPackage('A', pkg);
  assert.equal((await listAppPackages('A'))[0].enabled, true);
  assert.deepEqual(await listAppPackages('B'), []);
  await setPackageEnabled('A', pkg.manifest.id, false);
  assert.equal((await listAppPackages('A'))[0].enabled, false);
  assert.equal((await listAppPackages('A'))[0].html, pkg.html);
});
test('rejects reserved IDs, source archives, path traversal and oversized contents', async () => {
  await assert.rejects(readAppPackage(bytes, ['activity-planner']), /built-in/);
  const source = new JSZip().file('index.js', 'export default {}');
  await assert.rejects(readAppPackage(await source.generateAsync({ type: 'uint8array' })), /self-contained/);
  const traversal = new JSZip().file('../index.html', 'test').file('manifest.json', '{}');
  await assert.rejects(readAppPackage(await traversal.generateAsync({ type: 'uint8array' })), /self-contained/);
  const bomb = await JSZip.loadAsync(bytes);
  bomb.file('index.html', 'a'.repeat(5 * 1024 * 1024 + 1));
  await assert.rejects(readAppPackage(await bomb.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })), /size limit/);
});
test('bridge limits workspace reads and binds writes to the installed app scope', async () => {
  const pkg = await readAppPackage(bytes);
  const context = { manifest: pkg.manifest, workspaceId: 'bridge', districts: [{ id: 'secret' }], facilities: [{}], storage: createModuleStorage({ workspaceId: 'bridge', moduleId: pkg.manifest.id }), setDirty() {} };
  assert.deepEqual(await handleAppRequest({ method: 'workspace' }, context), { workspaceId: 'bridge', districts: [], facilities: [] });
  const securityContext={...context,acledData:[{event_id:'e1'}],manifest:{...context.manifest,capabilities:['read:security']}};
  assert.deepEqual((await handleAppRequest({method:'workspace'},securityContext)).acledData,[{event_id:'e1'}]);
  assert.equal((await handleAppRequest({method:'workspace'},{...context,disasters:[{eventId:1}]})).disasters,undefined);
  assert.deepEqual((await handleAppRequest({method:'workspace'},{...context,disasters:[{eventId:1}],manifest:{...context.manifest,capabilities:['read:disasters']}})).disasters,[{eventId:1}]);
  const record = await handleAppRequest({ method: 'savePlan', args: [{ id: 'test', metadata: { name: 'Test' } }] }, context);
  assert.equal(record.moduleId, 'activity-planner');
  await assert.rejects(handleAppRequest({ method: 'savePlan', args: [{ ...record, moduleId: 'immunization' }, 1] }, context), /another workspace/);
  await assert.rejects(handleAppRequest({ method: 'listPlans' }, { ...context, manifest: { capabilities: [] } }), /permission/);
  await assert.rejects(handleAppRequest({ method: 'deleteEverything' }, context), /Unsupported/);
});
