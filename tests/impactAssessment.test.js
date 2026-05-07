import test from 'node:test';
import assert from 'node:assert/strict';

import { runImpactAssessment } from '../lib/impactAssessment.js';

const squarePolygon = [
  [10, 10],
  [20, 10],
  [20, 20],
  [10, 20],
  [10, 10],
];

function buildDisaster(overrides = {}) {
  return {
    eventType: 'EQ',
    eventName: 'Test Disaster',
    title: 'Test earthquake m=15.0',
    latitude: 15,
    longitude: 15,
    alertLevel: 'Orange',
    severity: 'Moderate',
    source: 'GDACS',
    polygon: squarePolygon,
    ...overrides,
  };
}

function runAssessment({ facilities, disasters }) {
  return runImpactAssessment({
    facilities,
    disasters,
    acledEvents: [],
    worldPopData: {},
    districts: [],
  });
}

function getFacilityResult(result, facilityName) {
  return result.impactedFacilities.find(({ facility }) => facility.name === facilityName);
}

test('Facility inside GeoJSON polygon should be impacted as confirmed_polygon', () => {
  const facilityInside = {
    name: 'Inside Facility',
    latitude: 15,
    longitude: 15,
  };

  const result = runAssessment({
    facilities: [facilityInside],
    disasters: [buildDisaster()],
  });

  const impactedFacility = getFacilityResult(result, 'Inside Facility');

  assert.ok(impactedFacility);
  assert.equal(impactedFacility.impacts[0].impactMethod, 'confirmed_polygon');
  assert.equal(impactedFacility.impacts[0].confidence, 'high');
  assert.equal(impactedFacility.impacts[0].distance, 0);
});

test('GeoJSON polygon coordinates should be interpreted as longitude latitude', () => {
  const asymmetricPolygon = [
    [30, 10],
    [40, 10],
    [40, 20],
    [30, 20],
    [30, 10],
  ];

  const facilityInside = {
    name: 'Asymmetric Inside Facility',
    latitude: 15,
    longitude: 35,
  };

  const result = runAssessment({
    facilities: [facilityInside],
    disasters: [
      buildDisaster({
        eventName: 'Asymmetric Polygon Disaster',
        latitude: 15,
        longitude: 35,
        polygon: asymmetricPolygon,
      }),
    ],
  });

  const impactedFacility = getFacilityResult(result, 'Asymmetric Inside Facility');

  assert.ok(impactedFacility);
  assert.equal(impactedFacility.impacts[0].impactMethod, 'confirmed_polygon');
  assert.equal(impactedFacility.impacts[0].confidence, 'high');
});

test('Facility outside GeoJSON polygon should not be marked as confirmed_polygon', () => {
  const facilityOutside = {
    name: 'Outside Facility',
    latitude: 30,
    longitude: 30,
  };

  const result = runAssessment({
    facilities: [facilityOutside],
    disasters: [buildDisaster()],
  });

  const impactedFacility = getFacilityResult(result, 'Outside Facility');

  if (impactedFacility) {
    assert.notEqual(impactedFacility.impacts[0].impactMethod, 'confirmed_polygon');
  } else {
    assert.equal(result.impactedFacilities.length, 0);
  }
});

test('Facility near polygon but outside should be proximity_buffer, not confirmed_polygon', () => {
  const facilityNearPolygon = {
    name: 'Near Polygon Facility',
    latitude: 20.1,
    longitude: 15,
  };

  const result = runAssessment({
    facilities: [facilityNearPolygon],
    disasters: [buildDisaster()],
  });

  const impactedFacility = getFacilityResult(result, 'Near Polygon Facility');

  assert.ok(impactedFacility);
  assert.equal(impactedFacility.impacts[0].impactMethod, 'proximity_buffer');
  assert.equal(impactedFacility.impacts[0].confidence, 'low');
});

test('Facility with coordinates at 0 latitude or longitude should not be dropped', () => {
  const zeroCoordinateFacility = {
    name: 'Zero Coordinate Facility',
    latitude: 0,
    longitude: 0,
  };

  const zeroCenteredPolygon = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [-1, -1],
  ];

  const result = runAssessment({
    facilities: [zeroCoordinateFacility],
    disasters: [
      buildDisaster({
        eventName: 'Zero Coordinate Disaster',
        latitude: 0,
        longitude: 0,
        polygon: zeroCenteredPolygon,
      }),
    ],
  });

  const impactedFacility = getFacilityResult(result, 'Zero Coordinate Facility');

  assert.ok(impactedFacility);
  assert.equal(impactedFacility.impacts[0].impactMethod, 'confirmed_polygon');
});

test('Polygon already using latitude/longitude objects should still work', () => {
  const facilityInside = {
    name: 'Object Polygon Facility',
    latitude: 15,
    longitude: 15,
  };

  const objectPolygon = [
    { latitude: 10, longitude: 10 },
    { latitude: 10, longitude: 20 },
    { latitude: 20, longitude: 20 },
    { latitude: 20, longitude: 10 },
    { latitude: 10, longitude: 10 },
  ];

  const result = runAssessment({
    facilities: [facilityInside],
    disasters: [
      buildDisaster({
        eventName: 'Object Polygon Disaster',
        polygon: objectPolygon,
      }),
    ],
  });

  const impactedFacility = getFacilityResult(result, 'Object Polygon Facility');

  assert.ok(impactedFacility);
  assert.equal(impactedFacility.impacts[0].impactMethod, 'confirmed_polygon');
  assert.equal(impactedFacility.impacts[0].confidence, 'high');
});
