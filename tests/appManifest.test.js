import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defineAppRegistry, validateAppManifest, missingAppData } from '../lib/platform/appManifest.js';

const app = JSON.parse(readFileSync(new URL('../components/apps/immunization/manifest.json', import.meta.url)));
test('validates supported apps and rejects incompatible or ambiguous registrations', () => {
  assert.deepEqual(validateAppManifest(app), []);
  assert.throws(() => defineAppRegistry([app, app]), /Duplicate/);
  assert.throws(() => defineAppRegistry([{ ...app, platformApiVersion: 99 }]), /platformApiVersion/);
  assert.throws(() => defineAppRegistry([{ ...app, capabilities: ['execute:server'] }]), /capabilities/);
  assert.throws(() => defineAppRegistry([{ ...app, id: '../invalid' }]), /id/);
  assert.throws(() => defineAppRegistry([{ ...app, requiredData: ['unknown'] }]), /requiredData/);
});
test('each app declares its own prerequisites', () => {
  assert.deepEqual(missingAppData(app, {}), ['administrative-boundaries']);
  assert.deepEqual(missingAppData(app, { districts: [{}] }), []);
  assert.deepEqual(missingAppData({ ...app, requiredData: [] }, {}), []);
  assert.deepEqual(missingAppData({ ...app, requiredData: ['facilities'] }, { districts: [{}] }), ['facilities']);
});
