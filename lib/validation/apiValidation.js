export function sendApiError(res, status, code, message) {
  return res.status(status).json({
    success: false,
    code,
    error: message,
  });
}

export function assertArray(value, fieldName, maxLength = 1000) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  if (value.length > maxLength) {
    const error = new Error(`${fieldName} exceeds maximum length of ${maxLength}`);
    error.code = 'PAYLOAD_TOO_LARGE';
    error.status = 413;
    throw error;
  }

  return value;
}

export function assertYear(value, fieldName = 'year') {
  const year = Number(value);

  if (!Number.isInteger(year) || year < 2015 || year > 2030) {
    const error = new Error(`${fieldName} must be an integer between 2015 and 2030`);
    error.code = 'INVALID_YEAR';
    error.status = 400;
    throw error;
  }

  return year;
}

export function assertEnum(value, fieldName, allowedValues = []) {
  if (!allowedValues.includes(value)) {
    const error = new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    error.code = 'INVALID_VALUE';
    error.status = 400;
    throw error;
  }

  return value;
}
