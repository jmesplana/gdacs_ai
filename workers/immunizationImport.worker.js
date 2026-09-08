import * as XLSX from 'xlsx';
import { normalizeObservations } from '../lib/planning/immunization.js';

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'parse') {
      const workbook = XLSX.read(data.buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      if (range.e.r > 50000 || range.e.c > 250) throw new Error('Maximum import size is 50,000 rows and 250 columns.');
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
      const columns = (matrix.shift() || []).map((value) => String(value).trim());
      if (!columns.length || columns.some((value) => !value) || new Set(columns).size !== columns.length) throw new Error('Column names must be non-empty and unique.');
      const rows = matrix.filter((row) => row.some((value) => value !== '')).map((row) => Object.fromEntries(columns.map((key, index) => [key, row[index] ?? ''])));
      self.postMessage({ columns, rows });
    } else {
      self.postMessage(normalizeObservations(data.rows, data.districts, data.mapping, data.areaField));
    }
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
