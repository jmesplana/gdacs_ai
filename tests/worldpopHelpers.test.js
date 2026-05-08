import test from 'node:test';
import assert from 'node:assert/strict';

import { formatWorldPopForAI, groupAgeBands } from '../utils/worldpopHelpers.js';

test('groupAgeBands returns total, sex totals, and sex split age buckets', () => {
  const grouped = groupAgeBands({
    f_00: 10,
    m_00: 8,
    f_01: 20,
    m_01: 12,
    f_05: 30,
    m_05: 25,
    f_60: 7,
    m_60: 5,
  });

  assert.equal(grouped.under5, 50);
  assert.equal(grouped.under5Female, 30);
  assert.equal(grouped.under5Male, 20);

  assert.equal(grouped.age5_14, 55);
  assert.equal(grouped.age5_14Female, 30);
  assert.equal(grouped.age5_14Male, 25);

  assert.equal(grouped.age60plus, 12);
  assert.equal(grouped.age60plusFemale, 7);
  assert.equal(grouped.age60plusMale, 5);

  assert.equal(grouped.female, 67);
  assert.equal(grouped.male, 50);
  assert.equal(grouped.total, 117);
});

test('formatWorldPopForAI includes sex-by-age breakdown when available', () => {
  const text = formatWorldPopForAI(
    {
      '1': {
        total: 117,
        ageGroups: {
          total: 117,
          female: 67,
          male: 50,
          under5: 50,
          under5Female: 30,
          under5Male: 20,
          age5_14: 55,
          age5_14Female: 30,
          age5_14Male: 25,
          age60plus: 12,
          age60plusFemale: 7,
          age60plusMale: 5,
        },
      },
    },
    [{ id: '1', name: 'District A' }],
    2024
  );

  assert.match(text, /Sex breakdown: 67 female/);
  assert.match(text, /Sex by Age Group Totals/);
  assert.match(text, /Under 5: 30 female, 20 male/);
  assert.match(text, /Sex by age: Under 5 30F\/20M/);
});
