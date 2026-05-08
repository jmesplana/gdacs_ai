import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertArray,
  assertEnum,
  assertYear,
  sendApiError,
} from '../lib/validation/apiValidation.js';

test('sendApiError returns standardized API error payloads', () => {
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };

  const payload = sendApiError(response, 400, 'INVALID_INPUT', 'Invalid input');

  assert.equal(response.statusCode, 400);
  assert.deepEqual(payload, {
    success: false,
    code: 'INVALID_INPUT',
    error: 'Invalid input',
  });
});

test('assertArray accepts arrays within the maximum length', () => {
  const value = [1, 2, 3];

  assert.equal(assertArray(value, 'items', 3), value);
});

test('assertArray rejects non-arrays', () => {
  assert.throws(
    () => assertArray('not-array', 'items'),
    /items must be an array/
  );
});

test('assertArray rejects oversized arrays with payload metadata', () => {
  assert.throws(
    () => assertArray([1, 2, 3], 'items', 2),
    (error) => {
      assert.equal(error.message, 'items exceeds maximum length of 2');
      assert.equal(error.code, 'PAYLOAD_TOO_LARGE');
      assert.equal(error.status, 413);
      return true;
    }
  );
});

test('assertYear parses valid integer years', () => {
  assert.equal(assertYear('2020'), 2020);
  assert.equal(assertYear(2030), 2030);
});

test('assertYear rejects out-of-range and non-integer values with metadata', () => {
  for (const value of [2014, 2031, '2020.5', 'not-a-year']) {
    assert.throws(
      () => assertYear(value),
      (error) => {
        assert.equal(error.code, 'INVALID_YEAR');
        assert.equal(error.status, 400);
        return true;
      }
    );
  }
});

test('assertEnum accepts only allowed values', () => {
  assert.equal(assertEnum('total', 'dataType', ['total', 'agesex']), 'total');

  assert.throws(
    () => assertEnum('invalid', 'dataType', ['total', 'agesex']),
    (error) => {
      assert.equal(error.message, 'dataType must be one of: total, agesex');
      assert.equal(error.code, 'INVALID_VALUE');
      assert.equal(error.status, 400);
      return true;
    }
  );
});
