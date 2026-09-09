import { createIndexedDBPlanStorage } from './appStore.js';

/**
 * Module storage contract: listPlans(), loadPlan(id), savePlan(plan, expectedRevision).
 * All methods return promises. The host binds workspace/module scope once.
 * An alternate adapter must implement the same scope and revision semantics.
 */
export function createModuleStorage(scope, adapter = createIndexedDBPlanStorage) {
  return adapter(scope);
}
