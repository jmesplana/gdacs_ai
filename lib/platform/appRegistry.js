export const PLATFORM_API_VERSION = 1;

export const APP_REGISTRY = Object.freeze([
  Object.freeze({ id: 'immunization', name: 'Immunization planning', version: '1.0.0', platformApiVersion: 1,
    requiredData: ['administrative-boundaries'], capabilities: ['read:boundaries', 'read:sites', 'write:plans', 'export:plans'] })
]);

export function getApp(id) {
  return APP_REGISTRY.find((app) => app.id === id && app.platformApiVersion === PLATFORM_API_VERSION) || null;
}
