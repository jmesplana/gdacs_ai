import { openDB } from 'idb';

let database;
function getDB() {
  if (!database) database = openDB('aidstack_planning_apps', 1, {
    upgrade(db) {
      db.createObjectStore('settings');
      db.createObjectStore('plans');
      const summaries = db.createObjectStore('summaries', { keyPath: 'id' });
      summaries.createIndex('workspaceId', 'workspaceId');
      const versions = db.createObjectStore('versions', { keyPath: ['id', 'revision'] });
      versions.createIndex('planId', 'id');
    }
  });
  return database;
}

export async function getInstalledApps(workspaceId) {
  return (await (await getDB()).get('settings', workspaceId)) || [];
}

export async function setInstalledApps(workspaceId, ids) {
  await (await getDB()).put('settings', ids, workspaceId);
}

export async function listPlans(workspaceId) {
  return (await (await getDB()).getAllFromIndex('summaries', 'workspaceId', workspaceId)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function loadPlan(id, workspaceId) {
  const plan = await (await getDB()).get('plans', id);
  if (plan && plan.workspaceId !== workspaceId) throw new Error('This plan belongs to another boundary workspace.');
  return plan;
}

export async function savePlan(plan, expectedRevision = 0) {
  const db = await getDB();
  const tx = db.transaction(['plans', 'summaries', 'versions'], 'readwrite');
  const current = await tx.objectStore('plans').get(plan.id);
  if ((current?.revision || 0) !== expectedRevision || (current && current.workspaceId !== plan.workspaceId)) {
    await tx.done;
    throw new Error('This plan changed in another tab. Reopen it before saving, or save a scenario copy.');
  }
  const next = { ...plan, revision: expectedRevision + 1, savedAt: new Date().toISOString() };
  await tx.objectStore('plans').put(next, next.id);
  await tx.objectStore('summaries').put({ id: next.id, workspaceId: next.workspaceId, name: next.metadata.name, revision: next.revision, savedAt: next.savedAt });
  await tx.objectStore('versions').put(next);
  await tx.done;
  return next;
}
