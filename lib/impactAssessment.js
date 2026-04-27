import Papa from 'papaparse';
import { getDistance, isPointInPolygon, getAreaOfPolygon } from 'geolib';

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

function isPointInGeoJsonGeometry(point, geometry) {
  if (!geometry?.type || !geometry?.coordinates) return false;

  if (geometry.type === 'Polygon') {
    return isPointInPolygonCoordinates(point, geometry.coordinates);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => isPointInPolygonCoordinates(point, polygon));
  }

  return false;
}

export function normalizeImpactFacilities(facilities) {
  if (typeof facilities === 'string') {
    const parsedCsv = Papa.parse(facilities, {
      header: true,
      skipEmptyLines: true
    });

    return parsedCsv.data.map((row) => {
      const facility = {
        name: row.name,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude)
      };

      Object.keys(row).forEach((key) => {
        if (key !== 'name' && key !== 'latitude' && key !== 'longitude' && row[key]) {
          facility[key] = row[key];
        }
      });

      return facility;
    });
  }

  if (Array.isArray(facilities)) {
    return facilities;
  }

  return [];
}

export function runImpactAssessment({
  facilities,
  disasters,
  acledEvents = [],
  worldPopData = {},
  districts = []
}) {
  const facilityData = normalizeImpactFacilities(facilities);

  if ((!disasters || disasters.length === 0) && (!acledEvents || acledEvents.length === 0)) {
    return {
      impactedFacilities: [],
      statistics: { facilitiesImpacted: 0, totalImpacts: 0 }
    };
  }

  return assessImpact(facilityData, disasters || [], acledEvents || [], worldPopData, districts);
}

export function assessImpact(facilities, disasters, acledEvents, worldPopData = {}, districts = []) {
  console.time('Impact assessment total');
  const impacted = [];
  const disasterStats = {};
  const overlappingDisasters = {};

  const findFacilityDistrict = (facility) => {
    if (!districts || districts.length === 0) return null;

    const facilityPoint = [facility.longitude, facility.latitude];

    for (const district of districts) {
      try {
        const districtFeature = district.type === 'Feature' ? district
          : district.geometry ? { type: 'Feature', geometry: district.geometry } : null;

        if (!districtFeature) continue;

        if (isPointInGeoJsonGeometry(facilityPoint, districtFeature.geometry)) {
          const props = district.properties || {};
          return {
            name: props.ADM2_EN || props.NAME || props.name || props.district || 'Unknown',
            population: props.population || props.POP || null
          };
        }
      } catch (_) {
        continue;
      }
    }
    return null;
  };

  const acledThreats = acledEvents.map((event) => ({
    eventType: event.event_type || 'Security Event',
    eventName: event.event_type || 'ACLED Event',
    title: `${event.event_type} - ${event.sub_event_type}`,
    latitude: parseFloat(event.latitude),
    longitude: parseFloat(event.longitude),
    alertLevel: 'Orange',
    severity: 'Moderate',
    source: 'ACLED',
    event_date: event.event_date,
    fatalities: event.fatalities || 0,
    notes: event.notes
  }));

  const allThreats = [...disasters, ...acledThreats];

  console.log(`Starting assessment: ${facilities.length} facilities vs ${disasters.length} GDACS disasters + ${acledEvents.length} ACLED events = ${allThreats.length} total threats`);

  console.time('Pre-process threats');
  for (const threat of allThreats) {
    if (!threat.latitude || !threat.longitude) continue;

    const threatId = threat.eventName || threat.title || `${threat.eventType}-${threat.latitude}-${threat.longitude}`;
    disasterStats[threatId] = {
      type: threat.eventType,
      alertLevel: threat.alertLevel || 'Unknown',
      name: threat.eventName || threat.title || 'Unnamed',
      affectedFacilities: 0,
      impactArea: calculateImpactArea(threat),
      severity: threat.severity || threat.alertLevel || 'Unknown',
      polygon: hasValidPolygon(threat),
      source: threat.source || 'GDACS'
    };
  }
  console.timeEnd('Pre-process threats');

  console.time('Process facilities');

  const threatData = allThreats.map((threat) => {
    if (!threat.latitude || !threat.longitude) return null;

    const impactRadius = getImpactRadius(threat);
    return {
      disaster: threat,
      lat: parseFloat(threat.latitude),
      lng: parseFloat(threat.longitude),
      radius: impactRadius,
      minLat: parseFloat(threat.latitude) - (impactRadius / 111),
      maxLat: parseFloat(threat.latitude) + (impactRadius / 111),
      minLng: parseFloat(threat.longitude) - (impactRadius / (111 * Math.cos(threat.latitude * Math.PI / 180))),
      maxLng: parseFloat(threat.longitude) + (impactRadius / (111 * Math.cos(threat.latitude * Math.PI / 180))),
      disasterId: threat.eventName || threat.title || `${threat.eventType}-${threat.latitude}-${threat.longitude}`
    };
  }).filter(Boolean);

  for (const facility of facilities) {
    const facilityLat = parseFloat(facility.latitude);
    const facilityLng = parseFloat(facility.longitude);
    const facilityPos = { latitude: facilityLat, longitude: facilityLng };

    const facilityImpacts = [];
    const impactingDisasters = [];

    for (const threatInfo of threatData) {
      const { disaster, lat, lng, radius, minLat, maxLat, minLng, maxLng, disasterId } = threatInfo;

      if (facilityLat < minLat || facilityLat > maxLat || facilityLng < minLng || facilityLng > maxLng) {
        continue;
      }

      const disasterPos = { latitude: lat, longitude: lng };

      let isImpacted = false;
      let impactMethod = 'radius';
      let distance = getDistance(facilityPos, disasterPos) / 1000;

      if (hasValidPolygon(disaster)) {
        const polygon = convertPolygonFormat(disaster.polygon);
        if (isPointInPolygon(facilityPos, polygon)) {
          isImpacted = true;
          impactMethod = 'polygon';
          distance = 0;
        }
      }

      if (!isImpacted && distance <= radius) {
        isImpacted = true;
      }

      if (isImpacted) {
        facilityImpacts.push({
          disaster,
          distance: Math.round(distance * 100) / 100,
          impactMethod
        });

        impactingDisasters.push(disasterId);

        if (disasterStats[disasterId]) {
          disasterStats[disasterId].affectedFacilities++;
        }
      }
    }

    if (impactingDisasters.length > 1) {
      for (let i = 0; i < impactingDisasters.length; i++) {
        for (let j = i + 1; j < impactingDisasters.length; j++) {
          const overlapKey = [impactingDisasters[i], impactingDisasters[j]].sort().join('__');

          if (!overlappingDisasters[overlapKey]) {
            overlappingDisasters[overlapKey] = {
              disasters: [impactingDisasters[i], impactingDisasters[j]],
              facilities: []
            };
          }

          overlappingDisasters[overlapKey].facilities.push(facility.name);
        }
      }
    }

    if (facilityImpacts.length > 0) {
      const districtInfo = findFacilityDistrict(facility);
      const enrichedFacility = { ...facility };

      if (districtInfo) {
        enrichedFacility.district = districtInfo.name;
        enrichedFacility.districtPopulation = districtInfo.population;
      }

      if (districtInfo && worldPopData[districtInfo.name]) {
        enrichedFacility.populationData = worldPopData[districtInfo.name];
      }

      impacted.push({
        facility: enrichedFacility,
        impacts: facilityImpacts
      });
    }
  }
  console.timeEnd('Process facilities');

  console.time('Compile statistics');

  let totalAffectedPopulation = 0;
  const affectedDistricts = new Set();

  impacted.forEach((item) => {
    if (item.facility.districtPopulation) {
      affectedDistricts.add(item.facility.district);
    }
  });

  affectedDistricts.forEach((districtName) => {
    const districtData = districts.find((d) => {
      const props = d.properties || {};
      const name = props.ADM2_EN || props.NAME || props.name || props.district;
      return name === districtName;
    });
    if (districtData && districtData.properties) {
      const pop = districtData.properties.population || districtData.properties.POP || 0;
      totalAffectedPopulation += pop;
    }
  });

  const statistics = {
    totalDisasters: disasters.length,
    totalFacilities: facilities.length,
    impactedFacilityCount: impacted.length,
    percentageImpacted: facilities.length ? Math.round((impacted.length / facilities.length) * 100) : 0,
    disasterStats: Object.values(disasterStats).filter((stat) => stat.affectedFacilities > 0),
    overlappingImpacts: Object.values(overlappingDisasters),
    affectedDistricts: affectedDistricts.size,
    estimatedAffectedPopulation: totalAffectedPopulation > 0 ? totalAffectedPopulation : null
  };
  console.timeEnd('Compile statistics');
  console.timeEnd('Impact assessment total');

  console.log(`Assessment complete: ${impacted.length} impacted facilities found`);

  return {
    impactedFacilities: impacted,
    statistics
  };
}

function hasValidPolygon(disaster) {
  return disaster.polygon &&
    Array.isArray(disaster.polygon) &&
    disaster.polygon.length > 2;
}

function convertPolygonFormat(polygon) {
  return polygon.map((point) => {
    if (Array.isArray(point)) {
      return { latitude: point[0], longitude: point[1] };
    }
    return point;
  });
}

function calculateImpactArea(disaster) {
  if (hasValidPolygon(disaster)) {
    try {
      const polygon = convertPolygonFormat(disaster.polygon);
      return Math.round(getAreaOfPolygon(polygon) / 1000000);
    } catch (e) {
      console.error('Error calculating area:', e);
    }
  }

  const radius = getImpactRadius(disaster);
  return Math.round(Math.PI * radius * radius);
}

function getImpactRadius(disaster) {
  let impactRadius = 0;

  if (disaster.source === 'ACLED') {
    const eventType = disaster.eventType?.toLowerCase() || '';
    const fatalities = disaster.fatalities || 0;

    if (eventType.includes('battle') || eventType.includes('violence against civilians')) {
      impactRadius = 20;
    } else if (eventType.includes('explosion')) {
      impactRadius = 30;
    } else if (eventType.includes('strategic development') || eventType.includes('protest')) {
      impactRadius = 10;
    } else {
      impactRadius = 15;
    }

    if (fatalities > 50) {
      impactRadius += 20;
    } else if (fatalities > 10) {
      impactRadius += 10;
    }

    return impactRadius;
  }

  if (disaster.eventType?.toLowerCase() === 'eq') {
    let magnitude = 6.0;
    const title = disaster.title?.toLowerCase() || '';
    if (title.includes('m=')) {
      try {
        const magMatch = title.match(/m=([0-9.]+)/);
        if (magMatch && magMatch[1]) {
          magnitude = parseFloat(magMatch[1]);
        }
      } catch (_) {}
    }

    impactRadius = magnitude * 50;
  } else if (disaster.eventType?.toLowerCase() === 'tc') {
    impactRadius = 300;
  } else if (disaster.eventType?.toLowerCase() === 'fl') {
    impactRadius = 100;
  } else if (disaster.eventType?.toLowerCase() === 'vo') {
    impactRadius = 100;
  } else if (disaster.eventType?.toLowerCase() === 'dr') {
    impactRadius = 500;
  } else {
    impactRadius = 100;
  }

  return impactRadius;
}
