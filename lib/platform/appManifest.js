export const PLATFORM_API_VERSION = 1;
export const CAPABILITIES = ['read:boundaries', 'read:sites', 'write:plans', 'export:plans'];
export const DATA_REQUIREMENTS = ['administrative-boundaries', 'facilities'];

export function validateAppManifest(app) {
  if (!app || typeof app !== 'object' || Array.isArray(app)) return ['Manifest must be an object.'];
  const errors = [];
  if (typeof app.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(app.id)) errors.push('id must use lowercase letters, digits and hyphens.');
  for (const field of ['name', 'description', 'author']) {
    if (typeof app[field] !== 'string' || !app[field].trim()) errors.push(`${field} is required.`);
  }
  if (typeof app.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(app.version)) errors.push('version must use major.minor.patch.');
  if (app.platformApiVersion !== PLATFORM_API_VERSION) errors.push(`platformApiVersion must be ${PLATFORM_API_VERSION}.`);
  for (const [field, allowed] of [['requiredData', DATA_REQUIREMENTS], ['capabilities', CAPABILITIES]]) {
    if (!Array.isArray(app[field]) || app[field].some((value) => !allowed.includes(value))) errors.push(`${field} contains unsupported values or is missing.`);
  }
  return errors;
}

export function defineAppRegistry(manifests) {
  const ids = new Set();
  return Object.freeze(manifests.map((manifest) => {
    const errors = validateAppManifest(manifest);
    if (ids.has(manifest.id)) errors.push('Duplicate app id.');
    if (errors.length) throw new Error(`Invalid app ${manifest.id || '(unknown)'}: ${errors.join(' ')}`);
    ids.add(manifest.id);
    return Object.freeze({ ...manifest, requiredData: Object.freeze([...manifest.requiredData]), capabilities: Object.freeze([...manifest.capabilities]) });
  }));
}

export function missingAppData(app, { districts = [], facilities = [] }) {
  return app.requiredData.filter((requirement) => requirement === 'administrative-boundaries' ? !districts.length : !facilities.length);
}
