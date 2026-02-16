import { useState, useCallback } from 'react';
import { processUploadedFile, convertFacilitiesToCSV } from '../utils/fileHelpers';

/**
 * Custom hook for managing file upload and column selection
 * @returns {Object} File upload state and handlers
 */
export const useFileUpload = () => {
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [fileColumns, setFileColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState({
    name: '',
    latitude: '',
    longitude: '',
    aiAnalysisFields: [],
    displayFields: []
  });

  const handleFileUpload = useCallback(async (event, onSuccess) => {
    const file = event.target.files[0];
    console.log('handleFileUpload called with file:', file);
    if (!file) {
      console.log('No file found');
      return;
    }

    try {
      console.log('Processing file...');
      const { data, columns } = await processUploadedFile(file);
      console.log('File processed. Data rows:', data?.length, 'Columns:', columns);

      setFileData(data);
      setFileColumns(columns);
      console.log('Opening column selection modal...');
      setShowColumnModal(true);

      // Try to auto-detect common column names
      const autoSelectedColumns = {
        name: columns.find(col =>
          /name|facility|location/i.test(col)
        ) || '',
        latitude: columns.find(col =>
          /^lat$|latitude|^y$/i.test(col)
        ) || '',
        longitude: columns.find(col =>
          /^lon$|^lng$|longitude|^x$/i.test(col)
        ) || '',
        aiAnalysisFields: [],
        displayFields: []
      };

      setSelectedColumns(autoSelectedColumns);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please make sure it\'s a valid CSV or Excel file.');
    }
  }, []);

  const processExcelData = useCallback((onSuccess) => {
    if (!fileData || !selectedColumns.name || !selectedColumns.latitude || !selectedColumns.longitude) {
      alert('Please select required columns: Name, Latitude, and Longitude');
      return;
    }

    try {
      // Convert to CSV format expected by the system
      const csvContent = convertFacilitiesToCSV(fileData, selectedColumns);

      // Create a blob and file from the CSV content
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'facilities.csv', { type: 'text/csv' });

      // Close modal first
      setShowColumnModal(false);
      setFileData(null);
      setFileColumns([]);

      // Call success callback with the processed file
      if (onSuccess) {
        onSuccess(file, selectedColumns);
      }
    } catch (error) {
      console.error('Error processing data:', error);
      alert('Error processing facility data. Please check your file and column selections.');
    }
  }, [fileData, selectedColumns]);

  const resetFileUpload = useCallback(() => {
    setShowColumnModal(false);
    setFileData(null);
    setFileColumns([]);
    setSelectedColumns({
      name: '',
      latitude: '',
      longitude: '',
      aiAnalysisFields: [],
      displayFields: []
    });
  }, []);

  return {
    // State
    showColumnModal,
    fileData,
    fileColumns,
    selectedColumns,

    // Handlers
    handleFileUpload,
    processExcelData,
    resetFileUpload,
    setShowColumnModal,
    setSelectedColumns
  };
};
