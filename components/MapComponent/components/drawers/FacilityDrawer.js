import React from 'react';
import * as XLSX from 'xlsx';

const FacilityDrawer = ({
  isOpen,
  onClose,
  impactedFacilities = [],
  onFacilitySelect,
  onFileUpload,
  onGenerateSitrep,
  sitrepLoading,
  facilities = []
}) => {
  const handleFileUploadClick = () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';

    // Add event listener for when a file is selected
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        onFileUpload(file);
      }
    });

    // Trigger click on file input
    input.click();
  };

  const downloadCSVSample = (e) => {
    e.preventDefault();
    const csvContent = "name,latitude,longitude,description,type,capacity,risk_level,last_inspection\nHeadquarters,40.7128,-74.006,Main office building,Office,250,Low,2023-10-15\nRegional Office A,34.0522,-118.2437,Western region headquarters,Office,120,Medium,2023-09-20\nWarehouse B,51.5074,-0.1278,Storage facility for European operations,Warehouse,N/A,High,2023-08-05\nField Station C,35.6762,139.6503,Asian operations center,Field Station,45,Medium,2023-11-01\nDistribution Center D,19.4326,-99.1332,Latin American distribution hub,Distribution,500,High,2023-07-12";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'sample_facilities.csv');
    a.click();
  };

  const downloadExcelSample = (e) => {
    e.preventDefault();
    // Create a workbook with sample data
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['name', 'latitude', 'longitude', 'description', 'type', 'capacity', 'risk_level', 'last_inspection', 'emergency_contact', 'supplies_available'],
      ['Headquarters', 40.7128, -74.006, 'Main office building', 'Office', 250, 'Low', '2023-10-15', '555-123-4567', 'Water, Food, Medical'],
      ['Regional Office A', 34.0522, -118.2437, 'Western region headquarters', 'Office', 120, 'Medium', '2023-09-20', '555-234-5678', 'Medical supplies only'],
      ['Warehouse B', 51.5074, -0.1278, 'Storage facility for European operations', 'Warehouse', 'N/A', 'High', '2023-08-05', '555-345-6789', 'Large food stockpile, water'],
      ['Field Station C', 35.6762, 139.6503, 'Asian operations center', 'Field Station', 45, 'Medium', '2023-11-01', '555-456-7890', 'Limited supplies'],
      ['Distribution Center D', 19.4326, -99.1332, 'Latin American distribution hub', 'Distribution', 500, 'High', '2023-07-12', '555-567-8901', 'Full emergency supplies']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Facilities');

    // Generate and download the Excel file
    XLSX.writeFile(wb, 'sample_facilities.xlsx');
  };

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div
        className={`drawer drawer-right ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 3000 }}
      >
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 20px -20px',
          padding: '20px'
        }}>
          <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif"}}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Facility Management
          </h3>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-section">
            <div style={{ margin: '10px 0 20px 0', textAlign: 'center' }}>
              <div
                onClick={handleFileUploadClick}
                style={{
                  border: '2px dashed #4CAF50',
                  borderRadius: '8px',
                  padding: '30px 20px',
                  backgroundColor: 'rgba(76, 175, 80, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(76, 175, 80, 0.05)'}
              >
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: '#4CAF50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 15px auto'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#2E7D32' }}>Upload Facility Data</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  CSV or Excel files (.csv, .xlsx, .xls)
                </div>
              </div>

              <button
                onClick={handleFileUploadClick}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  marginTop: '20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                  <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"></path>
                </svg>
                Upload Facility Data
              </button>

              <div style={{ fontSize: '12px', marginTop: '10px', color: '#666', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                <a
                  href="#"
                  onClick={downloadCSVSample}
                  style={{ color: 'var(--aidstack-orange)', textDecoration: 'underline' }}
                >
                  CSV Sample
                </a>
                <a
                  href="#"
                  onClick={downloadExcelSample}
                  style={{ color: 'var(--aidstack-orange)', textDecoration: 'underline' }}
                >
                  Excel Sample
                </a>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid #f5f5f5',
              paddingBottom: '10px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              FACILITIES IMPACTED
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {facilities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#666' }}>
                  No facilities uploaded yet.
                </div>
              ) : impactedFacilities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#4CAF50', fontWeight: 'bold' }}>
                  All facilities safe!
                </div>
              ) : (
                impactedFacilities.map((impacted, index) => (
                  <div key={index} style={{
                    backgroundColor: 'rgba(244, 67, 54, 0.05)',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid rgba(244, 67, 54, 0.1)'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {impacted.facility.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Impacted by {impacted.impacts?.length || 0} disasters
                    </div>
                    <button
                      onClick={() => onFacilitySelect(impacted.facility)}
                      style={{
                        backgroundColor: '#F44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 10px',
                        fontSize: '12px',
                        marginTop: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      View Recommendations
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={onGenerateSitrep}
            style={{
              width: '100%',
              padding: '12px 20px',
              marginTop: '20px',
              backgroundColor: '#F44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: impactedFacilities.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: impactedFacilities.length > 0 ? 1 : 0.5,
              pointerEvents: impactedFacilities.length > 0 ? 'auto' : 'none'
            }}
            disabled={impactedFacilities.length === 0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Generate Situation Report
          </button>
        </div>
      </div>
    </>
  );
};

export default FacilityDrawer;
