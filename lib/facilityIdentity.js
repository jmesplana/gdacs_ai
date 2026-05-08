import { toNumber } from './geo/coordinates.js';

export function getFacilityIdentityKey(facility = {}) {
  const latitude = toNumber(facility.latitude);
  const longitude = toNumber(facility.longitude);

  return [
    facility.name || '',
    latitude === null ? '' : latitude,
    longitude === null ? '' : longitude
  ].join('__');
}
