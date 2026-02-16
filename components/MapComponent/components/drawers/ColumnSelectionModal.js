import React from 'react';

const ColumnSelectionModal = ({
  isOpen,
  onClose,
  fileColumns,
  selectedColumns,
  setSelectedColumns,
  onProcessData
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid #eee',
          paddingBottom: '10px'
        }}>
          <h3 style={{ margin: 0, color: 'var(--aidstack-navy)' }}>Configure Facility Data</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >×</button>
        </div>

        <p style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>
          Select which columns from your Excel file correspond to facility information.
          This helps us correctly map and analyze your facility data.
        </p>

        {/* Required Fields */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#F44336', marginBottom: '10px' }}>Required Fields</h4>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              Facility Name Column:
            </label>
            <select
              value={selectedColumns.name}
              onChange={(e) => setSelectedColumns({...selectedColumns, name: e.target.value})}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="">-- Select Column --</option>
              {fileColumns.map((col, idx) => (
                <option key={idx} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              Latitude Column:
            </label>
            <select
              value={selectedColumns.latitude}
              onChange={(e) => setSelectedColumns({...selectedColumns, latitude: e.target.value})}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="">-- Select Column --</option>
              {fileColumns.map((col, idx) => (
                <option key={idx} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              Longitude Column:
            </label>
            <select
              value={selectedColumns.longitude}
              onChange={(e) => setSelectedColumns({...selectedColumns, longitude: e.target.value})}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="">-- Select Column --</option>
              {fileColumns.map((col, idx) => (
                <option key={idx} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Additional Fields */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#4CAF50', marginBottom: '10px' }}>Additional Fields</h4>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              Fields for AI Analysis:
            </label>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Select columns that contain information for AI to analyze when generating recommendations
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '10px',
              border: '1px solid #eee',
              borderRadius: '4px'
            }}>
              {fileColumns.filter(col =>
                col !== selectedColumns.name &&
                col !== selectedColumns.latitude &&
                col !== selectedColumns.longitude
              ).map((col, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: selectedColumns.aiAnalysisFields.includes(col) ? 'rgba(26, 54, 93, 0.1)' : '#f5f5f5',
                  padding: '5px 10px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: selectedColumns.aiAnalysisFields.includes(col) ? 'var(--aidstack-navy)' : '#ddd'
                }}
                onClick={() => {
                  if (selectedColumns.aiAnalysisFields.includes(col)) {
                    setSelectedColumns({
                      ...selectedColumns,
                      aiAnalysisFields: selectedColumns.aiAnalysisFields.filter(c => c !== col)
                    });
                  } else {
                    setSelectedColumns({
                      ...selectedColumns,
                      aiAnalysisFields: [...selectedColumns.aiAnalysisFields, col]
                    });
                  }
                }}>
                  {col}
                  {selectedColumns.aiAnalysisFields.includes(col) && (
                    <span style={{ marginLeft: '5px', color: 'var(--aidstack-navy)' }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
              Fields to Display on Map:
            </label>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              Select columns that should be shown when clicking on a facility
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '10px',
              border: '1px solid #eee',
              borderRadius: '4px'
            }}>
              {fileColumns.filter(col =>
                col !== selectedColumns.name &&
                col !== selectedColumns.latitude &&
                col !== selectedColumns.longitude
              ).map((col, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: selectedColumns.displayFields.includes(col) ? '#e8f5e9' : '#f5f5f5',
                  padding: '5px 10px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: selectedColumns.displayFields.includes(col) ? '#4CAF50' : '#ddd'
                }}
                onClick={() => {
                  if (selectedColumns.displayFields.includes(col)) {
                    setSelectedColumns({
                      ...selectedColumns,
                      displayFields: selectedColumns.displayFields.filter(c => c !== col)
                    });
                  } else {
                    setSelectedColumns({
                      ...selectedColumns,
                      displayFields: [...selectedColumns.displayFields, col]
                    });
                  }
                }}>
                  {col}
                  {selectedColumns.displayFields.includes(col) && (
                    <span style={{ marginLeft: '5px', color: '#4CAF50' }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: '#f5f5f5',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onProcessData}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'var(--aidstack-navy)',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Process Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnSelectionModal;
