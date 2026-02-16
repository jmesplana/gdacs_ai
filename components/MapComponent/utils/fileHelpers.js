import * as XLSX from 'xlsx';

/**
 * Process uploaded Excel/CSV file
 * @param {File} file - The uploaded file
 * @returns {Promise<{data: Array, columns: Array}>} Parsed data and columns
 */
export const processUploadedFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first worksheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          reject(new Error('File is empty'));
          return;
        }

        // First row is headers
        const columns = jsonData[0];
        const rows = jsonData.slice(1);

        // Convert to array of objects
        const parsedData = rows
          .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
          .map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
              obj[col] = row[idx];
            });
            return obj;
          });

        resolve({ data: parsedData, columns });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Convert facilities data to CSV format
 * @param {Array} facilities - Array of facility objects
 * @param {Object} columnMapping - Mapping of required fields
 * @returns {string} CSV string
 */
export const convertFacilitiesToCSV = (facilities, columnMapping) => {
  if (!facilities || facilities.length === 0) {
    return '';
  }

  const { name, latitude, longitude, displayFields = [], aiAnalysisFields = [] } = columnMapping;

  // Build headers
  const headers = ['name', 'latitude', 'longitude', ...displayFields, ...aiAnalysisFields];

  // Build rows
  const rows = facilities.map(facility => {
    const row = [
      facility[name],
      facility[latitude],
      facility[longitude],
      ...displayFields.map(field => facility[field] || ''),
      ...aiAnalysisFields.map(field => facility[field] || '')
    ];
    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

/**
 * Download data as CSV file
 * @param {string} csvContent - CSV content
 * @param {string} filename - Filename for download
 */
export const downloadCSV = (csvContent, filename = 'facilities.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generate sample facility CSV
 * @returns {string} Sample CSV content
 */
export const generateSampleFacilityCSV = () => {
  const headers = ['name', 'latitude', 'longitude', 'type', 'capacity', 'status'];
  const sampleData = [
    ['Central Hospital', '14.5995', '120.9842', 'Hospital', '500', 'Operational'],
    ['Emergency Shelter A', '14.6091', '121.0223', 'Shelter', '200', 'Available'],
    ['Water Treatment Plant', '14.5794', '120.9869', 'Infrastructure', '1000', 'Operational']
  ];

  return [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
};
