function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value).replace(/,/g, '').trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCoordinate(point) {
  if (Array.isArray(point)) {
    const [longitude, latitude] = point;
    const normalizedLatitude = toNumber(latitude);
    const normalizedLongitude = toNumber(longitude);

    if (normalizedLatitude === null || normalizedLongitude === null) return null;

    return {
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
    };
  }

  if (
    point &&
    point.latitude !== undefined &&
    point.longitude !== undefined
  ) {
    const normalizedLatitude = toNumber(point.latitude);
    const normalizedLongitude = toNumber(point.longitude);

    if (normalizedLatitude === null || normalizedLongitude === null) return null;

    return {
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
    };
  }

  return null;
}

function convertPolygonFormat(polygon = []) {
  return polygon
    .map((point) => normalizeCoordinate(point))
    .filter(Boolean);
}

function isPointOnSegment(point, start, end) {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1);

  if (Math.abs(cross) > 1e-10) return false;

  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= 1e-10;
}

function isPointInRing(point, ring = []) {
  if (ring.length < 4) return false;

  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const start = ring[i];
    const end = ring[j];

    if (!Array.isArray(start) || !Array.isArray(end)) continue;
    if (isPointOnSegment(point, start, end)) return true;

    const [xi, yi] = start;
    const [xj, yj] = end;
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInPolygonCoordinates(point, polygon = []) {
  if (!polygon.length || !isPointInRing(point, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (isPointInRing(point, polygon[i])) return false;
  }

  return true;
}

// Walk every coordinate of a Polygon/MultiPolygon once to find its
// [minLng, minLat, maxLng, maxLat] envelope.
function computeGeometryBBox(geometry) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const scanRing = (ring) => {
    if (!Array.isArray(ring)) return;
    for (let i = 0; i < ring.length; i += 1) {
      const coord = ring[i];
      if (!Array.isArray(coord)) continue;
      const lng = coord[0];
      const lat = coord[1];
      if (typeof lng !== 'number' || typeof lat !== 'number') continue;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(scanRing);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => polygon.forEach(scanRing));
  }

  if (minLng === Infinity) return null;
  return [minLng, minLat, maxLng, maxLat];
}

// Lazily compute and cache the bbox on the geometry object itself so the
// expensive coordinate walk happens once per geometry, then is reused across
// every subsequent point-in-polygon test. Cached on a non-enumerable property
// so it never leaks into JSON.stringify / React keys / equality checks.
function getGeometryBBox(geometry) {
  if (geometry.__bbox !== undefined) return geometry.__bbox;
  const bbox = computeGeometryBBox(geometry);
  try {
    Object.defineProperty(geometry, '__bbox', {
      value: bbox,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  } catch (_) {
    // Frozen/sealed geometry — fall back to recomputing (correctness preserved).
    return bbox;
  }
  return bbox;
}

function isPointInGeometry(point, geometry) {
  if (!geometry?.type || !geometry?.coordinates) return false;

  // Cheap bounding-box rejection before the O(ring length) ray-cast.
  // A point outside the envelope cannot be inside the polygon.
  const bbox = getGeometryBBox(geometry);
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    if (point[0] < minLng || point[0] > maxLng || point[1] < minLat || point[1] > maxLat) {
      return false;
    }
  }

  if (geometry.type === 'Polygon') {
    return isPointInPolygonCoordinates(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => isPointInPolygonCoordinates(point, polygon));
  }

  return false;
}

function isPointInDistricts(latitude, longitude, districts = []) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  if (lat === null || lng === null || !districts.length) return false;

  const point = [lng, lat];

  return districts.some((district) => {
    const geometry = district?.geometry || (district?.type === 'Feature' ? district.geometry : null);

    if (!geometry) return false;

    try {
      return isPointInGeometry(point, geometry);
    } catch (_) {
      return false;
    }
  });
}

module.exports = {
  toNumber,
  normalizeCoordinate,
  convertPolygonFormat,
  isPointInRing,
  isPointInGeometry,
  isPointInDistricts,
  computeGeometryBBox,
  getGeometryBBox,
};
