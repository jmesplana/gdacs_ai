import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAvailableWorldPopYears,
  getWorldPopCollectionId,
  resolveWorldPopYear,
} from '../lib/worldpop/worldpopYears.js';

function buildFakeEe(timestamps) {
  return {
    ImageCollection(collectionId) {
      return {
        collectionId,
        aggregate_array(fieldName) {
          return {
            getInfo(callback) {
              callback(timestamps, null);
            },
            fieldName,
          };
        },
      };
    },
  };
}

test('getWorldPopCollectionId returns WorldPop Global 2 collection IDs', () => {
  assert.equal(getWorldPopCollectionId('total'), 'projects/sat-io/open-datasets/WORLDPOP/pop');
  assert.equal(getWorldPopCollectionId('agesex'), 'projects/sat-io/open-datasets/WORLDPOP/agesex');
});

test('getAvailableWorldPopYears returns sorted unique years from collection timestamps', async () => {
  const ee = buildFakeEe([
    Date.UTC(2020, 0, 1),
    Date.UTC(2019, 0, 1),
    Date.UTC(2020, 5, 1),
    Date.UTC(2018, 0, 1),
  ]);

  const years = await getAvailableWorldPopYears(ee, 'total');

  assert.deepEqual(years, [2018, 2019, 2020]);
});

test('resolveWorldPopYear resolves latest to the newest available year', async () => {
  const ee = buildFakeEe([
    Date.UTC(2019, 0, 1),
    Date.UTC(2024, 0, 1),
    Date.UTC(2020, 0, 1),
  ]);

  const year = await resolveWorldPopYear(ee, 'latest', 'agesex');

  assert.equal(year, 2024);
});

test('resolveWorldPopYear accepts available explicit years and rejects unavailable years', async () => {
  const ee = buildFakeEe([
    Date.UTC(2019, 0, 1),
    Date.UTC(2020, 0, 1),
  ]);

  assert.equal(await resolveWorldPopYear(ee, 2020, 'total'), 2020);

  await assert.rejects(
    () => resolveWorldPopYear(ee, 2030, 'total'),
    (error) => {
      assert.equal(error.code, 'WORLDPOP_YEAR_UNAVAILABLE');
      assert.equal(error.status, 400);
      return true;
    }
  );
});
