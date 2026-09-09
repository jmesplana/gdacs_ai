import { openDB } from 'idb';

let database;
function getDB() {
  if (!database) database = openDB('aidstack_planning_apps', 2, {
    upgrade(db, oldVersion, newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('settings');
        db.createObjectStore('plans');
        const summaries = db.createObjectStore('summaries', { keyPath: 'id' });
        summaries.createIndex('workspaceId', 'workspaceId');
        const versions = db.createObjectStore('versions', { keyPath: ['id', 'revision'] });
        versions.createIndex('planId', 'id');
      }
      const plans = db.createObjectStore('modulePlans', { keyPath: ['workspaceId', 'moduleId', 'id'] });
      const summaries = db.createObjectStore('moduleSummaries', { keyPath: ['workspaceId', 'moduleId', 'id'] });
      summaries.createIndex('scope', ['workspaceId', 'moduleId']);
      const versions = db.createObjectStore('moduleVersions', { keyPath: ['workspaceId', 'moduleId', 'id', 'revision'] });
      // The original stores contain immunization data only. Preserve the originals
      // and copy every record, including revision history, in this upgrade transaction.
      for (const [source, target] of [['plans', plans], ['summaries', summaries], ['versions', versions]]) {
        tx.objectStore(source).getAll().then((records) => {
          for (const record of records) target.put({ ...record, moduleId: 'immunization' });
        });
      }
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

export function createIndexedDBPlanStorage({ workspaceId, moduleId }) {
  for (const [name, value] of Object.entries({ workspaceId, moduleId })) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  }
  return Object.freeze({
    async listPlans() {
      return (await (await getDB()).getAllFromIndex('moduleSummaries', 'scope', [workspaceId, moduleId]))
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },
    async loadPlan(id) {
      return (await getDB()).get('modulePlans', [workspaceId, moduleId, id]);
    },
    async savePlan(plan, expectedRevision = 0) {
      if (!plan || typeof plan.id !== 'string' || !plan.id.trim() || typeof plan.metadata?.name !== 'string') {
        throw new Error('A plan requires an id and metadata.name.');
      }
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('Invalid expected revision.');
      if ((plan.workspaceId !== undefined && plan.workspaceId !== workspaceId) ||
          (plan.moduleId !== undefined && plan.moduleId !== moduleId)) {
        throw new Error('This plan belongs to another workspace or module.');
      }
      const db = await getDB();
      const tx = db.transaction(['modulePlans', 'moduleSummaries', 'moduleVersions'], 'readwrite');
      const current = await tx.objectStore('modulePlans').get([workspaceId, moduleId, plan.id]);
      if ((current?.revision || 0) !== expectedRevision) {
        await tx.done;
        throw new Error('This plan changed in another tab. Reopen it before saving, or save a scenario copy.');
      }
      const next = { ...plan, workspaceId, moduleId, revision: expectedRevision + 1, savedAt: new Date().toISOString() };
      await tx.objectStore('modulePlans').put(next);
      await tx.objectStore('moduleSummaries').put({ id: next.id, workspaceId, moduleId, name: next.metadata.name, revision: next.revision, savedAt: next.savedAt });
      await tx.objectStore('moduleVersions').put(next);
      await tx.done;
      return next;
    }
  });
}
