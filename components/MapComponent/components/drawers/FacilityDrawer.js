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
  facilities = [],
  onClearCache,
  acledData = [],
  acledEnabled = true,
  acledConfig = {},
  onAcledUpload,
  onClearAcledCache,
  onToggleAcled,
  onAcledConfigChange
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

  const handleAcledUploadClick = () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    // Add event listener for when a file is selected
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const csvData = event.target.result;
          onAcledUpload(csvData);
        };
        reader.readAsText(file);
      }
    });

    // Trigger click on file input
    input.click();
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

              {/* Clear Cache Button */}
              {facilities.length > 0 && onClearCache && (
                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px', textAlign: 'center' }}>
                    💾 {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'} cached in browser
                  </p>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all cached facility data? You will need to re-upload your facilities.')) {
                        onClearCache();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 20px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Clear Cached Data
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ACLED Security Data Section */}
          <div className="drawer-section" style={{
            backgroundColor: 'rgba(244, 67, 54, 0.03)',
            padding: '15px',
            borderRadius: '8px',
            border: '1px solid rgba(244, 67, 54, 0.1)'
          }}>
            <div style={{
              fontWeight: 'bold',
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid rgba(244, 67, 54, 0.1)',
              paddingBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                SECURITY DATA (ACLED)
              </div>
              {acledData.length > 0 && (
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 'normal'
                }}>
                  <input
                    type="checkbox"
                    checked={acledEnabled}
                    onChange={(e) => onToggleAcled(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Include in Analysis
                </label>
              )}
            </div>

            {acledData.length === 0 ? (
              <>
                <div style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                  Upload ACLED conflict data to enhance security risk assessments with real-time incident information.
                </div>

                <div
                  onClick={handleAcledUploadClick}
                  style={{
                    border: '2px dashed #F44336',
                    borderRadius: '8px',
                    padding: '20px',
                    backgroundColor: 'rgba(244, 67, 54, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.05)'}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#F44336',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 10px auto'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#C62828' }}>Upload ACLED Data</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    CSV format from ACLED export
                  </div>
                </div>

                <button
                  onClick={handleAcledUploadClick}
                  style={{
                    width: '100%',
                    padding: '10px 20px',
                    marginTop: '15px',
                    backgroundColor: '#F44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                    <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"></path>
                  </svg>
                  Upload ACLED CSV
                </button>
              </>
            ) : (
              <>
                <div style={{
                  backgroundColor: acledEnabled ? '#e8f5e9' : '#f5f5f5',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  border: `1px solid ${acledEnabled ? '#4CAF50' : '#ddd'}`
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                      {acledEnabled ? '✅ Active' : '⏸️ Paused'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {acledData.length.toLocaleString()} events loaded
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                    Data enhances security assessments and campaign viability scoring
                  </div>
                  {/* Date range info */}
                  {acledData.length > 0 && (() => {
                    const dates = acledData
                      .map(e => new Date(e.event_date))
                      .filter(d => !isNaN(d.getTime()))
                      .sort((a, b) => a - b);

                    if (dates.length > 0) {
                      const oldest = dates[0];
                      const newest = dates[dates.length - 1];
                      const daysDiff = Math.floor((new Date() - newest) / (1000 * 60 * 60 * 24));

                      return (
                        <div style={{
                          fontSize: '11px',
                          color: daysDiff > 30 ? '#f57c00' : '#666',
                          backgroundColor: daysDiff > 30 ? 'rgba(255, 152, 0, 0.1)' : 'transparent',
                          padding: daysDiff > 30 ? '4px 6px' : '0',
                          borderRadius: '4px',
                          marginTop: '4px'
                        }}>
                          📅 Data: {oldest.toLocaleDateString()} → {newest.toLocaleDateString()}
                          {daysDiff > 30 && (
                            <div style={{ fontWeight: 'bold', marginTop: '2px' }}>
                              ⚠️ Most recent event is {daysDiff} days old
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Date Range Filter */}
                <div style={{
                  backgroundColor: 'white',
                  padding: '12px',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  border: '1px solid #e0e0e0'
                }}>
                  <label style={{
                    display: 'block',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    marginBottom: '8px',
                    color: '#424242'
                  }}>
                    Time Range (Days)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {[7, 30, 60, 90, 180, 365].map(days => (
                      <button
                        key={days}
                        onClick={() => {
                          const newConfig = { ...acledConfig, dateRange: days };
                          if (onAcledConfigChange) {
                            onAcledConfigChange(newConfig);
                          }
                        }}
                        style={{
                          flex: '1 1 30%',
                          padding: '6px 8px',
                          backgroundColor: (acledConfig.dateRange || 60) === days ? '#F44336' : 'white',
                          color: (acledConfig.dateRange || 60) === days ? 'white' : '#666',
                          border: `1px solid ${(acledConfig.dateRange || 60) === days ? '#F44336' : '#ddd'}`,
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', textAlign: 'center' }}>
                    Showing most recent {acledConfig.dateRange || 60} days from dataset
                  </div>
                </div>

                {/* Country/Region Filter */}
                {acledData.length > 0 && (() => {
                  // Extract unique countries and regions from ACLED data
                  const countries = [...new Set(acledData.map(e => e.country).filter(Boolean))].sort();
                  const regions = [...new Set(acledData.map(e => e.admin1).filter(Boolean))].sort();

                  return (
                    <div style={{
                      backgroundColor: 'white',
                      padding: '12px',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <label style={{
                        display: 'block',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        marginBottom: '8px',
                        color: '#424242'
                      }}>
                        Geographic Filter
                      </label>

                      {/* Country Filter */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{
                          fontSize: '11px',
                          color: '#666',
                          marginBottom: '4px',
                          display: 'block'
                        }}>
                          Countries ({countries.length} available)
                        </label>
                        <select
                          multiple
                          value={acledConfig.selectedCountries || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, option => option.value);
                            const newConfig = { ...acledConfig, selectedCountries: selected };
                            if (onAcledConfigChange) {
                              onAcledConfigChange(newConfig);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '11px',
                            maxHeight: '100px',
                            overflowY: 'auto'
                          }}
                        >
                          {countries.map(country => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                          Hold Ctrl/Cmd to select multiple. Leave empty for all countries.
                        </div>
                      </div>

                      {/* Summary */}
                      {(acledConfig.selectedCountries?.length > 0 || acledConfig.selectedRegions?.length > 0) && (
                        <div style={{
                          fontSize: '11px',
                          color: '#F44336',
                          backgroundColor: 'rgba(244, 67, 54, 0.1)',
                          padding: '6px',
                          borderRadius: '4px',
                          marginTop: '8px'
                        }}>
                          <strong>Active Filters:</strong><br/>
                          {acledConfig.selectedCountries?.length > 0 && (
                            <span>Countries: {acledConfig.selectedCountries.join(', ')}</span>
                          )}
                        </div>
                      )}

                      {/* Clear Filters Button */}
                      {(acledConfig.selectedCountries?.length > 0) && (
                        <button
                          onClick={() => {
                            const newConfig = { ...acledConfig, selectedCountries: [], selectedRegions: [] };
                            if (onAcledConfigChange) {
                              onAcledConfigChange(newConfig);
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '6px',
                            marginTop: '8px',
                            backgroundColor: '#fff',
                            color: '#F44336',
                            border: '1px solid #F44336',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          Clear Geographic Filters
                        </button>
                      )}
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAcledUploadClick}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Update Data
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm('Clear ACLED data? You will need to re-upload the file.')) {
                        onClearAcledCache();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Clear
                  </button>
                </div>
              </>
            )}
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
