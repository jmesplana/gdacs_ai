import { useState } from 'react';

const FacilityUploader = ({ onUpload, facilities, impactedFacilities, loading, onClearCache }) => {
  const [dragActive, setDragActive] = useState(false);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert('Please upload a valid CSV file.');
      return;
    }
    
    readFile(file);
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Validate file type
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        alert('Please upload a valid CSV file.');
        return;
      }
      
      readFile(file);
    }
  };

  // Read file contents
  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target.result;
      onUpload(csvData);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <h2>Facility Management</h2>
      
      <div 
        className={`file-upload ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <p>Drag & drop a CSV file, or <label className="upload-label" style={{ cursor: 'pointer', color: '#4CAF50' }}>
          browse
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label></p>
        <p className="upload-hint" style={{ fontSize: '0.9em', color: '#666' }}>
          CSV format: name, latitude, longitude
        </p>
      </div>
      
      {loading && (
        <div className="loading">Processing facilities...</div>
      )}
      
      <div className="facility-stats">
        <h3>Facility Statistics</h3>
        <p>Total Facilities: {facilities.length}</p>
        <p>Potentially Impacted: {impactedFacilities.length}</p>

        {facilities.length > 0 && onClearCache && (
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all cached facility data? This will remove all uploaded facilities and you will need to re-upload them.')) {
                  onClearCache();
                }
              }}
              style={{
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear Cached Data
            </button>
            <p style={{ fontSize: '11px', color: '#666', marginTop: '6px', fontStyle: 'italic' }}>
              💾 Facilities are automatically saved to browser cache
            </p>
          </div>
        )}
      </div>
      
      {facilities.length > 0 && (
        <div className="facility-list">
          <h3>Uploaded Facilities</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Latitude</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Longitude</th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((facility, index) => {
                const isImpacted = impactedFacilities.some(
                  impacted => impacted.facility.name === facility.name
                );
                
                return (
                  <tr key={index}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{facility.name}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{facility.latitude}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{facility.longitude}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
                      {isImpacted ? 
                        <span style={{ color: '#ff4444' }}>⚠️ Potentially Impacted</span> : 
                        <span style={{ color: '#4CAF50' }}>✅ Not Impacted</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <div style={{ marginTop: '20px' }}>
        <h3>Sample Data</h3>
        <p>Download a sample CSV template to get started:</p>
        <button 
          className="button"
          onClick={() => {
            const csvContent = "name,latitude,longitude\nHeadquarters,40.7128,-74.006\nRegional Office A,34.0522,-118.2437\nWarehouse B,51.5074,-0.1278\nField Station C,35.6762,139.6503\nDistribution Center D,19.4326,-99.1332";
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', 'sample_facilities.csv');
            a.click();
          }}
        >
          Download Sample
        </button>
      </div>
    </div>
  );
};

export default FacilityUploader;