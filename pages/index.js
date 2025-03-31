import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Papa from 'papaparse';

// Import components with dynamic loading (no SSR) for Leaflet compatibility
const MapComponent = dynamic(() => import('../components/MapComponent'), {
  ssr: false,
});

const FacilityUploader = dynamic(() => import('../components/FacilityUploader'), {
  ssr: false,
});

const RecommendationsPanel = dynamic(() => import('../components/RecommendationsPanel'), {
  ssr: false,
});

const SitrepGenerator = dynamic(() => import('../components/SitrepGenerator'), {
  ssr: false,
});

export default function Home() {
  const [disasters, setDisasters] = useState([]);
  const [filteredDisasters, setFilteredDisasters] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [impactedFacilities, setImpactedFacilities] = useState([]);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [sitrep, setSitrep] = useState('');
  const [loading, setLoading] = useState({
    disasters: true,
    impact: false,
    recommendations: false,
    sitrep: false
  });
  const [activeTab, setActiveTab] = useState('map');
  const [dataSource, setDataSource] = useState('');
  const [dateFilter, setDateFilter] = useState('72h'); // default to 72 hours
  const [showSettings, setShowSettings] = useState(false); // Hide settings by default
  const [fetchError, setFetchError] = useState(null);
  const [useMockData, setUseMockData] = useState(false); // Default to live data

  // Fetch disaster data on component mount
  useEffect(() => {
    fetchDisasterData();
  }, []);

  // Filter disasters when disaster data or date filter changes
  useEffect(() => {
    filterDisastersByDate(dateFilter);
    
    // Debug logging for disaster data
    console.log('Disasters data state:', {
      totalDisasters: disasters.length,
      disastersWithCoordinates: disasters.filter(d => d.latitude && d.longitude).length,
      dateFilter: dateFilter
    });
    
    // Re-assess impact when filter changes if facilities are available
    if (facilities.length > 0) {
      console.log('Auto-refreshing impact assessment due to filter change');
      assessImpact(facilities);
    }
  }, [disasters, dateFilter]);

  // Initialize with disaster data on mount
  useEffect(() => {
    fetchDisasterData();
    setDateFilter('72h'); // Set to show last 72 hours by default
  }, [useMockData]); // Re-fetch when toggle changes

  // Fetch GDACS disaster data
  const fetchDisasterData = async () => {
    try {
      setLoading(prev => ({ ...prev, disasters: true }));
      setFetchError(null);
      
      if (useMockData) {
        // Use mock data
        const mockData = generateMockDisasters();
        console.log('Using mock disaster data:', mockData);
        
        // Ensure all coordinates are valid numbers
        const processedData = mockData.map(disaster => ({
          ...disaster,
          latitude: typeof disaster.latitude === 'string' ? parseFloat(disaster.latitude) : disaster.latitude,
          longitude: typeof disaster.longitude === 'string' ? parseFloat(disaster.longitude) : disaster.longitude
        }));
        
        console.log('Processed mock data:', processedData);
        setDisasters(processedData);
        setFilteredDisasters(processedData);
        setDataSource('Mock data');
        return;
      }
      
      // Fetch real data from GDACS
      console.log('Fetching real GDACS data...');
      
      // Make sure to use the right port and protocol
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port || (protocol === 'https:' ? '443' : '80');
      const baseUrl = `${protocol}//${hostname}${port === '80' || port === '443' ? '' : `:${port}`}`;
      
      console.log(`Attempting to fetch from ${baseUrl}/api/gdacs`);
      const response = await fetch(`${baseUrl}/api/gdacs`);
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !Array.isArray(data)) {
        throw new Error('Invalid data format received from API');
      }
      
      console.log(`Received ${data.length} disaster events from GDACS API`);
      console.log('Raw GDACS data sample:', data.slice(0, 2));
      
      // Filter out items without coordinates
      const validData = data.filter(disaster => {
        const hasCoords = disaster.latitude !== null && 
                         disaster.longitude !== null && 
                         !isNaN(parseFloat(disaster.latitude)) && 
                         !isNaN(parseFloat(disaster.longitude));
        
        if (!hasCoords) {
          console.log(`Skipping disaster without valid coordinates: ${disaster.title}`);
        }
        
        return hasCoords;
      });
      
      console.log(`Found ${validData.length} disasters with valid coordinates`);
      
      // Ensure all coordinates are valid numbers
      const processedData = validData.map(disaster => {
        const lat = typeof disaster.latitude === 'string' ? parseFloat(disaster.latitude) : disaster.latitude;
        const lng = typeof disaster.longitude === 'string' ? parseFloat(disaster.longitude) : disaster.longitude;
        
        console.log(`Processing disaster: ${disaster.title} at [${lat}, ${lng}]`);
        
        return {
          ...disaster,
          latitude: lat,
          longitude: lng
        };
      });
      
      console.log('First few processed disasters:', processedData.slice(0, 3));
      
      setDisasters(processedData);
      setFilteredDisasters(processedData);
      
      // Check if we got real data or API returned mock data
      if (processedData && processedData.length > 0) {
        // Check if the data is likely from our mock function (uses specific IDs)
        if (processedData[0].link && processedData[0].link.includes('eventid=1345678')) {
          setDataSource('API Mock data (GDACS connection unavailable)');
        } else {
          setDataSource(`Live GDACS data (${processedData.length} events)`);
        }
      } else {
        setDataSource('No data available from GDACS');
        
        // If no valid data, fall back to mock data
        console.log('No valid GDACS data, falling back to mock data');
        const mockData = generateMockDisasters();
        setDisasters(mockData);
        setFilteredDisasters(mockData);
        setDataSource('Mock data (no valid GDACS data)');
      }
    } catch (error) {
      console.error('Error fetching disaster data:', error);
      setFetchError(error.message);
      setDataSource('Error fetching data');
      
      // Provide mock data in case of error - done in useEffect
    } finally {
      setLoading(prev => ({ ...prev, disasters: false }));
    }
  };

  // Filter disasters based on the selected date range
  const filterDisastersByDate = (filter) => {
    if (!disasters || disasters.length === 0) {
      setFilteredDisasters([]);
      return;
    }
    
    // For testing, let's use all disasters to avoid filtering issues
    if (filter === 'all') {
      console.log('Setting all disasters without filtering');
      setFilteredDisasters(disasters);
      return;
    }
    
    const now = new Date();
    let cutoffDate;
    
    switch (filter) {
      case '24h':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '48h':
        cutoffDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        break;
      case '72h':
        cutoffDate = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // Default to 48h
    }
    
    const filtered = disasters.filter(disaster => {
      if (!disaster.pubDate) return true; // Include if no date
      
      try {
        const disasterDate = new Date(disaster.pubDate);
        return disasterDate >= cutoffDate;
      } catch (e) {
        console.log('Date parsing failed for disaster:', disaster.title);
        return true; // Include if date parsing fails
      }
    });
    
    console.log(`Filtered disasters from ${disasters.length} to ${filtered.length}`);
    console.log('First few filtered disasters:', filtered.slice(0, 3).map(d => ({
      title: d.title,
      lat: d.latitude,
      lng: d.longitude,
      date: d.pubDate
    })));
    
    setFilteredDisasters(filtered);
  };

  // Handle facility CSV upload
  const handleFacilityUpload = (csvData) => {
    try {
      // Parse CSV
      Papa.parse(csvData, {
        header: true,
        complete: (results) => {
          // Validate and process facility data
          const validFacilities = results.data.filter(facility => 
            facility.name && 
            !isNaN(parseFloat(facility.latitude)) && 
            !isNaN(parseFloat(facility.longitude))
          ).map(facility => ({
            name: facility.name,
            latitude: parseFloat(facility.latitude),
            longitude: parseFloat(facility.longitude)
          }));
          
          if (validFacilities.length === 0) {
            alert('No valid facilities found in the CSV. Please check the format.');
            return;
          }
          
          console.log(`Loaded ${validFacilities.length} facilities`);
          
          // Clear any existing sitrep when facilities change
          setSitrep('');
          
          // Update facilities and immediately assess impact
          setFacilities(validFacilities);
          assessImpact(validFacilities);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          alert('Failed to parse CSV file. Please check the format.');
        }
      });
    } catch (error) {
      console.error('Error processing facility upload:', error);
      alert('Failed to process facility data. Please try again.');
    }
  };

  // Assess the impact of disasters on facilities
  const assessImpact = async (facilityData) => {
    try {
      setLoading(prev => ({ ...prev, impact: true }));
      
      // Convert facilities to CSV string for API
      const facilitiesCsv = Papa.unparse(facilityData);
      
      // Use filtered disasters instead of all disasters
      const disastersToAssess = filteredDisasters.length > 0 ? filteredDisasters : disasters;
      
      const response = await fetch('/api/impact_assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilities: facilitiesCsv,
          disasters: disastersToAssess
        }),
      });
      
      const data = await response.json();
      console.log(`Impact assessment found ${data.impactedFacilities?.length || 0} impacted facilities`);
      
      // Store the impacted facilities with the filtered disasters only
      setImpactedFacilities(data.impactedFacilities || []);
      
      // Log information about the filtering application
      console.log(`Applied impact assessment with ${dateFilter} date filter (${disastersToAssess.length} disasters)`);
      
      // Reset selected facility and recommendations
      setSelectedFacility(null);
      setRecommendations(null);
    } catch (error) {
      console.error('Error assessing impact:', error);
      alert('Failed to assess facility impact. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, impact: false }));
    }
  };

  // Generate recommendations for a selected facility
  const generateRecommendations = async (facility, impacts) => {
    try {
      setLoading(prev => ({ ...prev, recommendations: true }));
      
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facility: facility,
          impacts: impacts
        }),
      });
      
      const data = await response.json();
      setRecommendations(data.recommendations || null);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      alert('Failed to generate recommendations. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, recommendations: false }));
    }
  };

  // Generate situation report
  const generateSitrep = async () => {
    try {
      setLoading(prev => ({ ...prev, sitrep: true }));
      
      const response = await fetch('/api/sitrep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          impactedFacilities: impactedFacilities,
          disasters: filteredDisasters.length > 0 ? filteredDisasters : disasters,
          dateFilter: dateFilter
        }),
      });
      
      const data = await response.json();
      setSitrep(data.sitrep || '');
      
      // Switch to sitrep tab
      setActiveTab('sitrep');
    } catch (error) {
      console.error('Error generating sitrep:', error);
      alert('Failed to generate situation report. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, sitrep: false }));
    }
  };

  // Handle facility selection
  const handleFacilitySelect = (facility) => {
    setSelectedFacility(facility);
    
    // Find the impacts for this facility
    const facilityImpact = impactedFacilities.find(
      impact => impact.facility.name === facility.name
    );
    
    if (facilityImpact) {
      generateRecommendations(facility, facilityImpact.impacts);
    } else {
      setRecommendations(null);
    }
  };

  // Handle refreshing data from GDACS
  const handleRefreshData = () => {
    fetchDisasterData();
    
    // If we have facilities, reassess impact with the new disaster data
    if (facilities.length > 0) {
      // We delay this slightly to ensure we have the new disaster data
      setTimeout(() => {
        assessImpact(facilities);
      }, 1000);
    }
  };

  // Handle date filter change
  const handleDateFilterChange = (e) => {
    console.log(`Changing date filter from ${dateFilter} to ${e.target.value}`);
    setDateFilter(e.target.value);
    
    // Clear any existing sitrep when filter changes
    setSitrep('');
    
    // Map will be automatically refreshed via useEffect dependency on dateFilter
  };

  // Generate mock disaster data (moved from API to here for fallback)
  const generateMockDisasters = () => {
    console.log("Generating mock disaster data with numeric coordinates");
    return [
      {
        title: "EQ 6.2 M, Indonesia (Indonesia) 2024-03-30 UTC",
        description: "Earthquake of magnitude 6.2M in Indonesia. The earthquake occurred at a depth of 10km.",
        pubDate: "Sat, 30 Mar 2024 10:15:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345678",
        latitude: -0.7893,
        longitude: 131.2461,
        alertLevel: "Orange",
        eventType: "EQ",
        eventName: "Earthquake Indonesia"
      },
      {
        title: "TC IRENE-24, Philippines (Philippines) 2024-03-29 UTC",
        description: "Tropical Cyclone IRENE-24 with maximum sustained winds of 120 km/h making landfall in Philippines.",
        pubDate: "Fri, 29 Mar 2024 18:30:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345679",
        latitude: 13.2543,
        longitude: 123.6714,
        alertLevel: "Red",
        eventType: "TC",
        eventName: "Tropical Cyclone IRENE-24"
      },
      {
        title: "FL, Vietnam (Vietnam) 2024-03-28 UTC",
        description: "Flooding reported in central Vietnam after heavy rainfall. Multiple provinces affected.",
        pubDate: "Thu, 28 Mar 2024 09:45:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345680",
        latitude: 16.4637,
        longitude: 107.5909,
        alertLevel: "Orange",
        eventType: "FL",
        eventName: "Flood Vietnam"
      },
      {
        title: "VO, Iceland (Iceland) 2024-03-26 UTC",
        description: "Volcanic activity reported in Iceland. Eruption ongoing with ash emissions.",
        pubDate: "Tue, 26 Mar 2024 14:20:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345681",
        latitude: 63.6301,
        longitude: -19.0516,
        alertLevel: "Green",
        eventType: "VO",
        eventName: "Volcano Iceland"
      },
      {
        title: "DR, Ethiopia (Ethiopia) 2024-03-25 UTC",
        description: "Drought conditions worsening in Ethiopia affecting agricultural production and water availability.",
        pubDate: "Mon, 25 Mar 2024 11:10:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345682",
        latitude: 9.1450,
        longitude: 40.4897,
        alertLevel: "Orange",
        eventType: "DR",
        eventName: "Drought Ethiopia"
      },
      // Add more mock disasters with dates further in the past
      {
        title: "EQ 5.8 M, Peru (Peru) 2024-03-20 UTC",
        description: "Earthquake of magnitude 5.8M in Peru. Minimal damage reported.",
        pubDate: "Mon, 20 Mar 2024 08:30:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345683",
        latitude: -12.0464,
        longitude: -77.0428,
        alertLevel: "Green",
        eventType: "EQ",
        eventName: "Earthquake Peru"
      },
      {
        title: "TC ALEX-24, Madagascar (Madagascar) 2024-03-15 UTC",
        description: "Tropical Cyclone ALEX-24 affecting eastern coast of Madagascar.",
        pubDate: "Wed, 15 Mar 2024 12:20:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345684",
        latitude: -18.9249,
        longitude: 47.5185,
        alertLevel: "Orange",
        eventType: "TC",
        eventName: "Tropical Cyclone ALEX-24"
      },
      {
        title: "FL, Brazil (Brazil) 2024-03-10 UTC",
        description: "Severe flooding in Southern Brazil after prolonged rainfall.",
        pubDate: "Fri, 10 Mar 2024 10:00:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345685",
        latitude: -23.5505,
        longitude: -46.6333,
        alertLevel: "Red",
        eventType: "FL",
        eventName: "Flood Brazil"
      },
      {
        title: "VO, Japan (Japan) 2024-03-05 UTC",
        description: "Volcanic activity reported in Japan. Minor eruption with ash plume.",
        pubDate: "Sun, 05 Mar 2024 14:45:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345686",
        latitude: 35.3606,
        longitude: 138.7274,
        alertLevel: "Green",
        eventType: "VO",
        eventName: "Volcano Japan"
      },
      {
        title: "DR, Kenya (Kenya) 2024-03-01 UTC",
        description: "Drought affecting eastern regions of Kenya. Agricultural impact significant.",
        pubDate: "Fri, 01 Mar 2024 09:30:00 UTC",
        link: "https://gdacs.org/report.aspx?eventid=1345687",
        latitude: 1.2921,
        longitude: 36.8219,
        alertLevel: "Orange",
        eventType: "DR",
        eventName: "Drought Kenya"
      }
    ];
  };

  return (
    <div className="container">
      <Head>
        <title>GDACS Facility Impact Assessment Tool</title>
        <meta name="description" content="AI-powered disaster impact and response tool" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <div className="header">
          <h1>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            GDACS Disaster Response Dashboard
          </h1>
          
          <div className="data-summary" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#e3f2fd',
              padding: '8px 12px',
              borderRadius: '4px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: '5px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                  <line x1="8" y1="2" x2="8" y2="18"></line>
                  <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
                <span style={{fontWeight: 'bold', fontSize: '14px', color: '#0d47a1'}}>
                  {filteredDisasters.length} Disasters
                </span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                <span style={{
                  backgroundColor: '#ff4444',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>{filteredDisasters.filter(d => d.alertLevel?.toLowerCase() === 'red').length}</span>
                
                <span style={{
                  backgroundColor: '#ffa500',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>{filteredDisasters.filter(d => d.alertLevel?.toLowerCase() === 'orange').length}</span>
                
                <span style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>{filteredDisasters.filter(d => d.alertLevel?.toLowerCase() === 'green').length}</span>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              padding: '8px 12px',
              borderRadius: '4px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span style={{fontWeight: 'bold', fontSize: '14px', color: '#2e7d32', marginRight: '5px'}}>
                {facilities.length} Facilities:
              </span>
              <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                <span style={{
                  backgroundColor: '#ff4444',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>{impactedFacilities.length} Impacted</span>
                
                <span style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>{facilities.length - impactedFacilities.length} Safe</span>
              </div>
            </div>
            
            <button 
              onClick={handleRefreshData}
              disabled={loading.disasters}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: loading.disasters ? '#e0e0e0' : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: loading.disasters ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {loading.disasters ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
              )}
              {loading.disasters ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Settings toggle button */}
        <button 
          className="drawer-toggle"
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 2000, /* Same as map controls, but less than panel */
            backgroundColor: 'white',
            borderRadius: '4px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            padding: '8px 12px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
          onClick={() => setShowSettings(!showSettings)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Settings
        </button>
        
        {/* Settings panel */}
        <div 
          className="floating-panel settings-floating-panel"
          style={{
            position: 'absolute',
            top: '70px',
            left: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            zIndex: 3000, /* Higher than map controls (2000) */
            padding: '15px',
            maxWidth: '320px',
            transform: showSettings ? 'translateY(0)' : 'translateY(-200%)',
            opacity: showSettings ? 1 : 0,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            pointerEvents: showSettings ? 'auto' : 'none'
          }}
        >
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '12px', 
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: '8px',
            color: '#2196F3'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              SETTINGS
            </div>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                padding: 0
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#555' }}>Data source:</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                width: '44px',
                height: '22px',
                backgroundColor: useMockData ? '#e0e0e0' : '#2196F3',
                borderRadius: '24px',
                cursor: 'pointer',
                transition: 'background-color 0.3s',
                padding: '2px'
              }}
              onClick={() => setUseMockData(!useMockData)}
              >
                <span style={{ 
                  position: 'absolute',
                  left: useMockData ? '2px' : '22px',
                  width: '18px',
                  height: '18px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: 'left 0.3s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}></span>
              </div>
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#666',
              textAlign: 'right',
              marginBottom: '12px'
            }}>
              {useMockData ? 'Using mock data' : 'Live GDACS data'}
            </div>
            
            
            <div style={{ 
              padding: '8px',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              borderRadius: '4px',
              color: '#0d47a1',
              fontSize: '12px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {dataSource || 'GDACS Data Source'}
            </div>
          </div>
        </div>

        <MapComponent 
          disasters={filteredDisasters} 
          facilities={facilities}
          impactedFacilities={impactedFacilities}
          onFacilitySelect={handleFacilitySelect}
          loading={loading.disasters}
          onDrawerState={handleFacilityUpload}
          onGenerateSitrep={generateSitrep}
          sitrepLoading={loading.sitrep}
          sitrep={sitrep}
          dateFilter={dateFilter}
          handleDateFilterChange={handleDateFilterChange}
        />

        {selectedFacility && (
          <RecommendationsPanel 
            facility={selectedFacility}
            recommendations={recommendations}
            loading={loading.recommendations}
          />
        )}

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    </div>
  )
}