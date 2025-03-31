import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, ZIndex } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';

// Component to add disaster markers directly to the map
const DisasterMarkers = ({ disasters, getDisasterInfo, getAlertColor }) => {
  const map = useMap();
  
  useEffect(() => {
    // Create markers for each disaster directly with Leaflet
    const markers = [];
    
    if (disasters && disasters.length > 0) {
      console.log(`Adding ${disasters.length} disaster markers directly to map`);
      
      disasters.forEach((disaster, index) => {
        if (disaster.latitude && disaster.longitude) {
          const lat = parseFloat(disaster.latitude);
          const lng = parseFloat(disaster.longitude);
          
          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lng)) {
            console.log(`Invalid coordinates for disaster: ${disaster.title}`);
            return;
          }
          
          console.log(`Adding disaster marker at [${lat}, ${lng}]: ${disaster.title}`);
          
          // Get disaster type info (for icon)
          const disasterInfo = getDisasterInfo(disaster.eventType);
          const alertColor = getAlertColor(disaster.alertLevel);
          
          // Create a custom GDACS-style icon
          const iconUrl = disasterInfo.icon;
          const iconSize = [36, 36]; // Size of the icon
          
          // Create a div icon with a colored border based on alert level
          const iconHtml = `
            <div style="position: relative;">
              <div style="position: absolute; border-radius: 50%; border: 4px solid ${alertColor}; width: 44px; height: 44px; top: -6px; left: -6px; background-color: white;"></div>
              <img src="${iconUrl}" width="36" height="36" style="position: relative; z-index: 10;">
            </div>
          `;
          
          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'gdacs-icon',
            iconSize: [36, 36],
            zIndexOffset: -1000, // Keep disasters below facilities
            iconAnchor: [18, 18]
          });
          
          // Create a marker instead of circle
          const marker = L.marker([lat, lng], {
            icon: customIcon,
            zIndexOffset: 1000
          }).addTo(map);
          
          // Add popup
          const popupContent = `
            <div style="max-width: 280px;">
              <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid ${alertColor}; padding-bottom: 6px;">
                ${disaster.title}
              </h3>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Event Type:</strong>
                <span>${disasterInfo.name}</span>
              </div>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Alert Level:</strong>
                <span style="color: ${alertColor}; font-weight: bold;">${disaster.alertLevel}</span>
              </div>
              <div style="display: flex; margin-bottom: 6px;">
                <strong style="width: 100px;">Date:</strong>
                <span>${disaster.pubDate}</span>
              </div>
              <p style="margin-top: 8px;">${disaster.description}</p>
              <a href="${disaster.link}" target="_blank" style="display: inline-block; margin-top: 8px; color: #2196F3; text-decoration: none; font-weight: bold;">
                View on GDACS →
              </a>
            </div>
          `;
          
          marker.bindPopup(popupContent);
          
          // Store markers to remove on cleanup
          markers.push(marker);
          
          // Add a transparent circle for the impact radius
          let impactRadius = 50; // Default radius in km
          if (disaster.eventType) {
            const eventType = disaster.eventType.toLowerCase();
            if (eventType === 'eq') {
              // For earthquakes, use magnitude-based radius
              const magnitude = parseFloat(disaster.title.match(/\d+\.\d+/)?.[0] || '5.0');
              impactRadius = magnitude * 25; // km
            } else if (eventType === 'tc') {
              impactRadius = 200; // 200km for tropical cyclones
            } else if (eventType === 'fl') {
              impactRadius = 70; // 70km for floods
            } else if (eventType === 'vo') {
              impactRadius = 50; // 50km for volcanic activity
            } else if (eventType === 'dr') {
              impactRadius = 250; // 250km for drought
            } else if (eventType === 'wf') {
              impactRadius = 30; // 30km for wildfire
            } else if (eventType === 'ts') {
              impactRadius = 100; // 100km for tsunami
            }
          }
          
          // Convert km to meters for the circle
          const radiusInMeters = impactRadius * 1000;
          
          // Create the circle
          const circle = L.circle([lat, lng], {
            radius: radiusInMeters,
            color: alertColor,
            fillColor: alertColor,
            fillOpacity: 0.1,
            weight: 1,
            opacity: 0.5
          }).addTo(map);
          
          // Store the circle to remove on cleanup
          markers.push(circle);
        }
      });
    }
    
    // Cleanup function to remove markers when component unmounts
    return () => {
      markers.forEach(marker => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
    };
  }, [map, disasters]);
  
  return null;
};

const MapComponent = ({ disasters, facilities, impactedFacilities, onFacilitySelect, loading, dateFilter, handleDateFilterChange, onDrawerState, onGenerateSitrep, sitrepLoading, sitrep }) => {
  const mapRef = useRef(null);
  const [visibleDisasterTypes, setVisibleDisasterTypes] = useState({
    eq: true,
    tc: true,
    fl: true,
    vo: true,
    dr: true,
    wf: true,
    ts: true
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [facilityDrawerOpen, setFacilityDrawerOpen] = useState(false);
  const [sitrepDrawerOpen, setSitrepDrawerOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false); // Default to hidden
  
  // States for column selection modal
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
  
  // Filter disasters based on selected types
  const filteredDisasters = disasters.filter(disaster => 
    visibleDisasterTypes[disaster.eventType?.toLowerCase()]
  );
  
  // Handle file uploads
  const handleFileUpload = (file) => {
    if (!file) return;
    
    // Check file extension
    const fileExt = file.name.split('.').pop().toLowerCase();
    
    if (fileExt === 'csv') {
      // Process CSV directly
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvData = e.target.result;
        onDrawerState(csvData);
        toggleFacilityDrawer();
      };
      reader.readAsText(file);
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      // Process Excel file
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Identify columns (first row)
        if (jsonData.length > 0) {
          const columns = jsonData[0];
          setFileColumns(columns);
          setFileData({
            workbook,
            jsonData,
            fileName: file.name
          });
          
          // Auto-detect location columns
          let nameCol = '';
          let latCol = '';
          let longCol = '';
          
          columns.forEach(col => {
            const colLower = col.toLowerCase();
            if (colLower.includes('name') || colLower.includes('facility')) {
              nameCol = col;
            } else if (colLower.includes('lat') || colLower === 'y') {
              latCol = col;
            } else if (colLower.includes('long') || colLower.includes('lng') || colLower === 'x') {
              longCol = col;
            }
          });
          
          setSelectedColumns(prev => ({
            ...prev,
            name: nameCol,
            latitude: latCol,
            longitude: longCol
          }));
          
          // Show column selection modal
          setShowColumnModal(true);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a valid CSV or Excel file (.csv, .xlsx, .xls)');
    }
  };
  
  // Process the Excel data after column selection
  const processExcelData = () => {
    if (!fileData || !selectedColumns.name || !selectedColumns.latitude || !selectedColumns.longitude) {
      alert('Please select the required columns (Name, Latitude, Longitude)');
      return;
    }
    
    // Convert Excel data to CSV
    const { jsonData } = fileData;
    const headers = jsonData[0];
    
    // Find column indexes
    const nameIdx = headers.indexOf(selectedColumns.name);
    const latIdx = headers.indexOf(selectedColumns.latitude);
    const longIdx = headers.indexOf(selectedColumns.longitude);
    
    // Prepare additional data columns
    const additionalCols = [...selectedColumns.aiAnalysisFields, ...selectedColumns.displayFields];
    const additionalIdxs = additionalCols.map(col => headers.indexOf(col));
    
    // Create CSV data
    let csvData = 'name,latitude,longitude';
    
    // Add additional columns to header
    additionalCols.forEach(col => {
      csvData += `,${col}`;
    });
    
    csvData += '\n';
    
    // Add data rows
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row[nameIdx] && !isNaN(parseFloat(row[latIdx])) && !isNaN(parseFloat(row[longIdx]))) {
        csvData += `${row[nameIdx]},${row[latIdx]},${row[longIdx]}`;
        
        // Add additional fields
        additionalIdxs.forEach(idx => {
          csvData += `,${row[idx] || ''}`;
        });
        
        csvData += '\n';
      }
    }
    
    // Process the CSV data
    onDrawerState(csvData);
    
    // Close modal and drawer
    setShowColumnModal(false);
    toggleFacilityDrawer();
  };
  
  // Toggle drawers
  const toggleFilterDrawer = () => {
    setFilterDrawerOpen(!filterDrawerOpen);
    if (!filterDrawerOpen) {
      setFacilityDrawerOpen(false);
      setSitrepDrawerOpen(false);
    }
  };
  
  const toggleFacilityDrawer = () => {
    setFacilityDrawerOpen(!facilityDrawerOpen);
    if (!facilityDrawerOpen) {
      setFilterDrawerOpen(false);
      setSitrepDrawerOpen(false);
    }
  };
  
  const toggleSitrepDrawer = () => {
    setSitrepDrawerOpen(!sitrepDrawerOpen);
    if (!sitrepDrawerOpen) {
      setFilterDrawerOpen(false);
      setFacilityDrawerOpen(false);
    }
  };
  
  // Setup effect
  useEffect(() => {
    // Initialization code if needed
  }, [disasters, facilities]);

  // Helper function to determine disaster type name and appropriate icon
  const getDisasterInfo = (eventType) => {
    const disasterTypes = {
      'eq': {
        name: 'Earthquake',
        icon: '/images/gdacs/earthquake.svg'
      },
      'tc': {
        name: 'Tropical Cyclone',
        icon: '/images/gdacs/cyclone.svg'
      },
      'fl': {
        name: 'Flood',
        icon: '/images/gdacs/flood.svg'
      },
      'vo': {
        name: 'Volcanic Activity',
        icon: '/images/gdacs/volcano.svg'
      },
      'dr': {
        name: 'Drought',
        icon: '/images/gdacs/drought.svg'
      },
      'wf': {
        name: 'Wildfire',
        icon: '/images/gdacs/fire.svg'
      },
      'ts': {
        name: 'Tsunami',
        icon: '/images/gdacs/tsunami.svg'
      }
    };
    
    const type = eventType?.toLowerCase();
    return disasterTypes[type] || { name: eventType, icon: '/images/gdacs/warning.svg' };
  };
  
  // Helper function to get just the name for backward compatibility
  const getDisasterTypeName = (eventType) => {
    return getDisasterInfo(eventType).name;
  };

  // Helper function to determine marker color based on alert level
  const getAlertColor = (alertLevel) => {
    if (!alertLevel) return '#2196F3'; // Default blue
    
    switch(alertLevel.toLowerCase()) {
      case 'red':
        return '#ff4444';
      case 'orange':
        return '#ffa500';
      case 'green':
        return '#4CAF50';
      default:
        return '#2196F3'; // Default blue
    }
  };

  // Helper function to toggle a disaster type filter
  const toggleDisasterType = (type) => {
    setVisibleDisasterTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };
  
  // Get available disaster types from current disaster data
  const getAvailableDisasterTypes = () => {
    const types = new Set();
    disasters.forEach(disaster => {
      if (disaster.eventType) {
        types.add(disaster.eventType.toLowerCase());
      }
    });
    return Array.from(types);
  };
  
  const availableTypes = getAvailableDisasterTypes();
  
  if (loading) {
    return <div className="loading">Loading disaster data...</div>;
  }

  return (
    <div className="map-container">
      {/* Floating action buttons */}
      <button 
        className="drawer-toggle drawer-toggle-right"
        onClick={toggleFilterDrawer}
        title="Filter Disasters"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
        </svg>
        Filters
      </button>
      
      <button 
        className="drawer-toggle drawer-toggle-facilities"
        onClick={toggleFacilityDrawer}
        title="Manage Facilities"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        Facilities
      </button>
      
      <button 
        className="drawer-toggle drawer-toggle-sitrep"
        onClick={toggleSitrepDrawer}
        title="Generate Report"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Sitrep
      </button>
      
      {/* Filter drawer */}
      <div className={`drawer-backdrop ${filterDrawerOpen ? 'open' : ''}`} onClick={toggleFilterDrawer}></div>
      <div className={`drawer drawer-right ${filterDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Disaster Filters
          </h3>
          <button className="drawer-close" onClick={toggleFilterDrawer}>×</button>
        </div>
        <div className="drawer-content">
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              DISASTER TYPE FILTERS
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              {availableTypes.map(type => {
                const info = getDisasterInfo(type);
                const isActive = visibleDisasterTypes[type];
                
                return (
                  <button
                    key={type}
                    onClick={() => toggleDisasterType(type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '20px',
                      border: '1px solid #ddd',
                      backgroundColor: isActive ? '#e3f2fd' : '#f5f5f5',
                      cursor: 'pointer',
                      opacity: isActive ? 1 : 0.65,
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 2px 5px rgba(33, 150, 243, 0.2)' : 'none',
                      position: 'relative',
                      width: 'calc(50% - 5px)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: isActive ? '#2196F3' : '#e0e0e0',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px'
                    }}>
                      <img 
                        src={info.icon} 
                        alt={info.name}
                        width="16" 
                        height="16" 
                        style={{
                          filter: isActive ? 'brightness(10)' : 'none'
                        }}
                      />
                    </div>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: isActive ? 'bold' : 'normal',
                      color: isActive ? '#1976D2' : '#666'
                    }}>
                      {info.name}
                    </span>
                    {isActive && (
                      <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        width: '16px',
                        height: '16px',
                        backgroundColor: '#2196F3',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            
            {availableTypes.length > 0 && (
              <button
                onClick={() => {
                  const allActive = Object.values(visibleDisasterTypes).every(Boolean);
                  const newState = {};
                  
                  availableTypes.forEach(type => {
                    newState[type] = !allActive;
                  });
                  
                  setVisibleDisasterTypes(prev => ({
                    ...prev,
                    ...newState
                  }));
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: '#f0f0f0',
                  cursor: 'pointer',
                  fontSize: '13px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  color: '#666',
                  marginTop: '5px'
                }}
              >
                {Object.values(visibleDisasterTypes).every(Boolean) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                  </svg>
                )}
                {Object.values(visibleDisasterTypes).every(Boolean) ? 'Hide All Disaster Types' : 'Show All Disaster Types'}
              </button>
            )}
            
            <div style={{ 
              marginTop: '15px', 
              borderTop: '1px solid #f5f5f5', 
              paddingTop: '10px', 
              fontSize: '12px', 
              color: '#757575',
              textAlign: 'center'
            }}>
              <span>
                {Object.values(visibleDisasterTypes).filter(Boolean).length} of {availableTypes.length} disaster types visible
              </span>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              TIME FILTER
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <select 
                value={dateFilter} 
                onChange={handleDateFilterChange}
                style={{ 
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#f9f9f9',
                  fontSize: '13px',
                  marginBottom: '15px'
                }}
              >
                <option value="24h">Last 24 Hours</option>
                <option value="48h">Last 48 Hours</option>
                <option value="72h">Last 72 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Events</option>
              </select>
            </div>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px' 
            }}>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 15px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#f9f9f9',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Last 24 Hours</span>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: '#1976D2'
                }}>
                  {disasters.filter(d => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    return new Date(d.pubDate) >= cutoff;
                  }).length}
                </span>
              </button>
              
              <button style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 15px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#f9f9f9',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Last 72 Hours</span>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: '#1976D2'
                }}>
                  {disasters.filter(d => {
                    const now = new Date();
                    const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
                    return new Date(d.pubDate) >= cutoff;
                  }).length}
                </span>
              </button>
              
              <button style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 15px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#f9f9f9',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>All Events</span>
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  backgroundColor: '#e3f2fd', 
                  padding: '3px 8px', 
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  color: '#1976D2'
                }}>
                  {disasters.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Facility Management Drawer */}
      <div className={`drawer-backdrop ${facilityDrawerOpen ? 'open' : ''}`} onClick={toggleFacilityDrawer}></div>
      <div className={`drawer drawer-right ${facilityDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Facility Management
          </h3>
          <button className="drawer-close" onClick={toggleFacilityDrawer}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-section">
            <div style={{ margin: '10px 0 20px 0', textAlign: 'center' }}>
              <div 
                onClick={() => {
                  // Create a file input element
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.xlsx,.xls';
                  
                  // Add event listener for when a file is selected
                  input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  });
                  
                  // Trigger click on file input
                  input.click();
                }}
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
                onClick={() => {
                  // Create a file input element
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.xlsx,.xls';
                  
                  // Add event listener for when a file is selected
                  input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  });
                  
                  // Trigger click on file input
                  input.click();
                }}
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
                  onClick={(e) => {
                    e.preventDefault();
                    const csvContent = "name,latitude,longitude,description,type,capacity,risk_level,last_inspection\nHeadquarters,40.7128,-74.006,Main office building,Office,250,Low,2023-10-15\nRegional Office A,34.0522,-118.2437,Western region headquarters,Office,120,Medium,2023-09-20\nWarehouse B,51.5074,-0.1278,Storage facility for European operations,Warehouse,N/A,High,2023-08-05\nField Station C,35.6762,139.6503,Asian operations center,Field Station,45,Medium,2023-11-01\nDistribution Center D,19.4326,-99.1332,Latin American distribution hub,Distribution,500,High,2023-07-12";
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.setAttribute('href', url);
                    a.setAttribute('download', 'sample_facilities.csv');
                    a.click();
                  }}
                  style={{ color: '#2196F3', textDecoration: 'underline' }}
                >
                  CSV Sample
                </a>
                <a 
                  href="#" 
                  onClick={(e) => {
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
                  }}
                  style={{ color: '#2196F3', textDecoration: 'underline' }}
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
                    <button style={{
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
                    }}>
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
            onClick={() => {
              if (impactedFacilities.length > 0) {
                toggleSitrepDrawer();
              }
            }}
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
      
      {/* Situation Report Drawer */}
      <div className={`drawer-backdrop ${sitrepDrawerOpen ? 'open' : ''}`} onClick={toggleSitrepDrawer}></div>
      <div className={`drawer drawer-right ${sitrepDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 className="drawer-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Situation Report
          </h3>
          <button className="drawer-close" onClick={toggleSitrepDrawer}>×</button>
        </div>
        <div className="drawer-content">
          <div className="drawer-section">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ 
                width: '70px', 
                height: '70px', 
                borderRadius: '50%', 
                backgroundColor: '#F44336', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 15px auto'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '5px', 
                color: '#D32F2F',
                fontSize: '18px'
              }}>
                Generate Situation Report
              </div>
              <div style={{ fontSize: '14px', color: '#666', maxWidth: '80%', margin: '0 auto' }}>
                Generate a comprehensive situation report for all active disasters and impacted facilities.
              </div>
              
              <button 
                onClick={() => {
                  if (impactedFacilities.length > 0) {
                    onGenerateSitrep();
                    // Do not close the drawer - we'll show the report here
                  }
                }}
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
                disabled={impactedFacilities.length === 0 || sitrepLoading}
              >
                {sitrepLoading ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', animation: 'spin 1s linear infinite'}}>
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Generate Report
                  </>
                )}
              </button>
              
              {impactedFacilities.length === 0 && (
                <div style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
                  Upload facilities and assess impact first
                </div>
              )}
              
              {/* Display the sitrep if available */}
              {sitrep && !sitrepLoading && (
                <div style={{ 
                  marginTop: '25px',
                  padding: '15px',
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid #e0e0e0',
                    color: '#D32F2F'
                  }}>
                    Situation Report
                  </div>
                  
                  <div className="sitrep-container" style={{ textAlign: 'left' }}>
                    <ReactMarkdown>
                      {sitrep}
                    </ReactMarkdown>
                  </div>
                  
                  <div style={{ 
                    marginTop: '15px',
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      onClick={() => {
                        const blob = new Blob([sitrep], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.setAttribute('href', url);
                        const date = new Date().toISOString().split('T')[0];
                        a.setAttribute('download', `sitrep-${date}.md`);
                        a.click();
                      }}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#F44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Download Report
                    </button>
                    
                    <button
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(sitrep).then(() => {
                            alert('Report copied to clipboard');
                          }).catch(err => {
                            console.error('Could not copy text: ', err);
                          });
                        } else {
                          const textArea = document.createElement('textarea');
                          textArea.value = sitrep;
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textArea);
                          alert('Report copied to clipboard');
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      Copy to Clipboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <MapContainer 
        center={[0, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        
        {/* Add disaster markers directly to the map */}
        <DisasterMarkers 
          disasters={filteredDisasters}
          getDisasterInfo={getDisasterInfo}
          getAlertColor={getAlertColor}
        />
        
        {/* No need to render duplicate disaster markers - the DisasterMarkers component handles this */}
        
        {/* Render facility markers */}
        {facilities.map((facility, index) => {
          if (!facility.latitude || !facility.longitude) return null;
          
          const isImpacted = impactedFacilities.some(
            impacted => impacted.facility.name === facility.name
          );
          
          return (
            <CircleMarker
              key={`facility-${index}`}
              center={[parseFloat(facility.latitude), parseFloat(facility.longitude)]}
              radius={7}
              pathOptions={{ 
                color: 'black',
                weight: 1.5,
                fillColor: isImpacted ? '#ff4444' : '#4CAF50',
                fillOpacity: 0.7,
                dashArray: '3,3'
              }}
              zIndexOffset={1000} // Ensure facilities are on top of other markers
              eventHandlers={{
                click: () => onFacilitySelect(facility)
              }}
            >
              <Popup>
                <div className="popup-content" style={{ maxWidth: '300px', padding: '5px' }}>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    padding: '0 0 8px 0', 
                    borderBottom: `2px solid ${isImpacted ? '#ff4444' : '#4CAF50'}`,
                    color: isImpacted ? '#d32f2f' : '#2e7d32'
                  }}>
                    {facility.name}
                  </h3>
                  
                  <div style={{ 
                    margin: '8px 0', 
                    padding: '5px 8px', 
                    backgroundColor: isImpacted ? 'rgba(255, 68, 68, 0.08)' : 'rgba(76, 175, 80, 0.08)',
                    borderRadius: '4px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ 
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: isImpacted ? '#ff4444' : '#4CAF50',
                      textAlign: 'center',
                      lineHeight: '20px',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {isImpacted ? '!' : '✓'}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      {isImpacted ? 'Potentially Impacted' : 'Not Impacted'}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '13px', margin: '8px 0' }}>
                    <strong>Location:</strong> {facility.latitude}, {facility.longitude}
                  </p>
                  
                  {/* Display additional fields if available */}
                  {Object.keys(facility).filter(key => 
                    key !== 'name' && key !== 'latitude' && key !== 'longitude'
                  ).map((key, idx) => (
                    <p key={idx} style={{ fontSize: '13px', margin: '5px 0' }}>
                      <strong>{key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:</strong> {facility[key]}
                    </p>
                  ))}
                  
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    marginTop: '12px',
                    justifyContent: 'space-between' 
                  }}>
                    {isImpacted && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          
                          // Close popup
                          mapRef.current._map.closePopup();
                          
                          // Display recommendations for this facility
                          onFacilitySelect(facility);
                        }}
                        style={{
                          flex: '1',
                          padding: '6px 10px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        View Recommendations
                      </button>
                    )}
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Close popup
                        mapRef.current._map.closePopup();
                        
                        // Show alert
                        alert('AI Analysis feature will be available in the next update');
                        
                        // Here you would normally invoke the AI analysis function
                        // onAnalyzeFacility(facility);
                      }}
                      style={{
                        flex: '1',
                        padding: '6px 10px',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="9" y1="21" x2="9" y2="9"></line>
                      </svg>
                      Analyze with AI
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Legend controls */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '10px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          {/* Legend toggle button */}
          <button 
            onClick={() => setShowLegend(!showLegend)}
            style={{
              backgroundColor: 'white',
              borderRadius: '4px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              border: 'none',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#2196F3'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
            </svg>
            {showLegend ? 'Hide Legend' : 'Show Legend'}
          </button>
          
          {/* Collapsible legend panel */}
          {showLegend && (
            <div className="map-legend" style={{
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
              maxWidth: '300px',
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
          <div style={{ 
            marginBottom: '15px', 
            fontWeight: 'bold', 
            fontSize: '14px', 
            borderBottom: '2px solid #f0f0f0', 
            paddingBottom: '10px',
            display: 'flex',
            alignItems: 'center' 
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 13l5.553-2.276A1 1 0 0 0 21 16.382V5.618a1 1 0 0 0-1.447-.894L15 7m0 13V7"></path>
            </svg>
            MAP LEGEND
          </div>
          
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold', 
            fontSize: '13px', 
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            DISASTER EVENT TYPES
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/earthquake.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Earthquake</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/cyclone.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Cyclone</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/flood.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Flood</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '48%',
              backgroundColor: '#f9f9f9',
              padding: '5px 8px',
              borderRadius: '4px',
              border: '1px solid #eee'
            }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '6px'
              }}>
                <img src="/images/gdacs/volcano.svg" width="16" height="16" />
              </div>
              <span style={{ fontSize: '12px' }}>Volcano</span>
            </div>
          </div>
          
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold', 
            fontSize: '13px', 
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            ALERT SEVERITY LEVELS
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '12px',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#ff4444', 
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>Red Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Severe Impact</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '12px',
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 165, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#ffa500', 
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef6c00' }}>Orange Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Moderate Impact</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '15px',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#4CAF50', 
                border: '2px solid white',
                marginRight: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>Green Alert</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Minor Impact</span>
          </div>
          
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold', 
            fontSize: '13px', 
            color: '#424242',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            padding: '6px 10px',
            borderRadius: '4px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            FACILITY STATUS
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '8px',
            border: '1px solid rgba(76, 175, 80, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#4CAF50', 
                border: '1.5px dashed #1b5e20',
                marginRight: '8px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2e7d32' }}>Safe</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>No impact detected</span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '50%', 
                backgroundColor: '#ff4444', 
                border: '1.5px dashed #b71c1c',
                marginRight: '8px'
              }}></div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d32f2f' }}>Impacted</span>
            </div>
            <span style={{ fontSize: '12px', color: '#666' }}>Response needed</span>
          </div>
          
          <div style={{ 
            marginTop: '15px', 
            fontSize: '12px', 
            color: '#757575', 
            borderTop: '1px solid #f0f0f0', 
            paddingTop: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Click any marker for detailed information
          </div>
            </div>
          )}
        </div>
      </MapContainer>

      {/* Display a message if no markers are visible */}
      {disasters.length === 0 && facilities.length === 0 && (
        <div style={{
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255,255,255,0.8)',
          padding: '15px',
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          <p><strong>No data to display on the map.</strong></p>
          <p>Try refreshing GDACS data or uploading facilities.</p>
        </div>
      )}
      
      {/* Column Selection Modal */}
      {showColumnModal && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #eee',
              paddingBottom: '10px'
            }}>
              <h3 style={{ margin: 0, color: '#2196F3' }}>Configure Facility Data</h3>
              <button 
                onClick={() => setShowColumnModal(false)}
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
                      backgroundColor: selectedColumns.aiAnalysisFields.includes(col) ? '#e3f2fd' : '#f5f5f5',
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: selectedColumns.aiAnalysisFields.includes(col) ? '#2196F3' : '#ddd'
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
                        <span style={{ marginLeft: '5px', color: '#2196F3' }}>✓</span>
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
                onClick={() => setShowColumnModal(false)}
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
                onClick={processExcelData}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#2196F3',
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
      )}
    </div>
  );
};

export default MapComponent;