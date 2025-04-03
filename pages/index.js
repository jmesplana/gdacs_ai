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

// GDACS Facilities Impact Assessment Tool
// Developed by John Mark Esplana (https://github.com/jmesplana)
export default function Home() {
  const [disasters, setDisasters] = useState([]);
  const [filteredDisasters, setFilteredDisasters] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [impactedFacilities, setImpactedFacilities] = useState([]);
  const [impactStatistics, setImpactStatistics] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsAIGenerated, setRecommendationsAIGenerated] = useState(false);
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
  const [fetchError, setFetchError] = useState(null);
  const [useMockData, setUseMockData] = useState(false); // Default to live data
  const [showHelp, setShowHelp] = useState(false); // Help panel visibility
  const [completeReport, setCompleteReport] = useState(null); // Store combined AI report
  const [lastUpdated, setLastUpdated] = useState(null); // Track when data was last updated
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(''); // Human-readable time since last update

  // Fetch disaster data on component mount
  useEffect(() => {
    fetchDisasterData();
  }, []);
  
  // Update the "time since" last data refresh
  useEffect(() => {
    if (!lastUpdated) return;
    
    const updateTimeSince = () => {
      const now = new Date();
      const diffMs = now - lastUpdated;
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes < 1) {
        setTimeSinceUpdate('just now');
      } else if (diffMinutes === 1) {
        setTimeSinceUpdate('1 minute ago');
      } else if (diffMinutes < 60) {
        setTimeSinceUpdate(`${diffMinutes} minutes ago`);
      } else {
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours === 1) {
          setTimeSinceUpdate('1 hour ago');
        } else if (diffHours < 24) {
          setTimeSinceUpdate(`${diffHours} hours ago`);
        } else {
          const diffDays = Math.floor(diffHours / 24);
          setTimeSinceUpdate(`${diffDays} day${diffDays > 1 ? 's' : ''} ago`);
        }
      }
    };
    
    // Update immediately
    updateTimeSince();
    
    // Then update every minute
    const interval = setInterval(updateTimeSince, 60000);
    
    return () => clearInterval(interval);
  }, [lastUpdated]);

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
      
      // Use the Next.js API endpoint, not the Python one
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
      
      // Debug: Check if any disasters have polygon data
      const disastersWithPolygons = data.filter(d => d.polygon && d.polygon.length > 2);
      console.log(`Found ${disastersWithPolygons.length} disasters with polygon data out of ${data.length} total`);
      
      if (disastersWithPolygons.length > 0) {
        console.log('Example polygon data:', disastersWithPolygons[0].polygon.slice(0, 3), '...');
      }
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
      
      // Find the latest publication date from GDACS data
      if (processedData && processedData.length > 0) {
        try {
          // Sort the disasters by publication date (newest first)
          const sortedByDate = [...processedData].sort((a, b) => {
            // Handle potential missing dates by using a fallback
            const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
            const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
            return dateB - dateA;
          });
          
          // Get the most recent publication date
          const mostRecentDisaster = sortedByDate[0];
          if (mostRecentDisaster && mostRecentDisaster.pubDate) {
            const gdacsUpdateTime = new Date(mostRecentDisaster.pubDate);
            console.log('Most recent GDACS update:', gdacsUpdateTime);
            setLastUpdated(gdacsUpdateTime);
          } else {
            // Fallback if no valid dates found
            console.log('No valid publication dates found in GDACS data, using current time');
            setLastUpdated(new Date());
          }
        } catch (err) {
          console.error('Error processing GDACS update dates:', err);
          // Fallback to current time
          setLastUpdated(new Date());
        }
      } else {
        // No data, use current time
        setLastUpdated(new Date());
      }
      
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
        
        // For mock data, use the most recent mock date
        try {
          const sortedMockData = [...mockData].sort((a, b) => {
            const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
            const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
            return dateB - dateA;
          });
          const mockUpdateTime = new Date(sortedMockData[0].pubDate);
          setLastUpdated(mockUpdateTime);
        } catch (err) {
          console.log('Error processing mock data dates:', err);
          setLastUpdated(new Date());
        }
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
          ).map(facility => {
            // Create a base object with required fields
            const facilityObject = {
              name: facility.name,
              latitude: parseFloat(facility.latitude),
              longitude: parseFloat(facility.longitude)
            };
            
            // Add all other fields from the CSV
            Object.keys(facility).forEach(key => {
              if (key !== 'name' && key !== 'latitude' && key !== 'longitude' && facility[key]) {
                facilityObject[key] = facility[key];
              }
            });
            
            return facilityObject;
          });
          
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
      
      // Store the statistical analysis
      if (data.statistics) {
        console.log('Impact assessment statistics:', data.statistics);
        setImpactStatistics(data.statistics);
      }
      
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
  const generateRecommendations = async (facility, impacts, useAI = true) => {
    try {
      setLoading(prev => ({ ...prev, recommendations: true }));
      
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facility: facility,
          impacts: impacts,
          useAI: useAI
        }),
      });
      
      const data = await response.json();
      setRecommendations(data.recommendations || null);
      setRecommendationsAIGenerated(data.isAIGenerated || false);
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
          dateFilter: dateFilter,
          statistics: impactStatistics
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
    
    // Last updated will be set by fetchDisasterData, but we could also set it here
    // if there are cases where we update data without calling fetchDisasterData
  };

  // Handle date filter change
  const handleDateFilterChange = (e) => {
    console.log(`Changing date filter from ${dateFilter} to ${e.target.value}`);
    setDateFilter(e.target.value);
    
    // Clear any existing sitrep when filter changes
    setSitrep('');
    
    // Map will be automatically refreshed via useEffect dependency on dateFilter
  };
  
  // Generate and download comprehensive AI report
  const generateCompleteReport = async () => {
    try {
      setLoading(prev => ({ ...prev, sitrep: true }));
      
      // Collect all available AI data
      let reportContent = '';
      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toTimeString().split(' ')[0];
      
      // Start with header
      reportContent += `# GDACS Emergency Response Overview Report\n`;
      reportContent += `## Generated: ${date} | ${time} | Filter: ${dateFilter === '24h' ? 'Last 24h' : 
                                 dateFilter === '48h' ? 'Last 48h' : 
                                 dateFilter === '72h' ? 'Last 72h' : 
                                 dateFilter === '7d' ? 'Last 7 days' : 
                                 dateFilter === '30d' ? 'Last 30 days' : 'All time'}\n\n`;
      
      // Executive Summary Section
      reportContent += `# EXECUTIVE SUMMARY\n\n`;
      reportContent += `## Key Statistics\n`;
      reportContent += `- **Total Facilities Monitored:** ${facilities.length}\n`;
      reportContent += `- **Facilities Potentially Impacted:** ${impactedFacilities.length} (${Math.round((impactedFacilities.length/facilities.length)*100)}% of total)\n`;
      reportContent += `- **Total Active Disasters:** ${disasters.length}\n`;
      reportContent += `- **Active Disaster Alert Levels:** ${
        filteredDisasters.filter(d => 
          (d.alertLevel?.toLowerCase() === 'red') || 
          (d.severity?.toLowerCase()?.includes('extreme')) || 
          (d.severity?.toLowerCase()?.includes('severe'))).length
      } Red, ${
        filteredDisasters.filter(d => 
          (d.alertLevel?.toLowerCase() === 'orange') || 
          (d.severity?.toLowerCase()?.includes('moderate'))).length
      } Orange, ${
        filteredDisasters.filter(d => 
          (d.alertLevel?.toLowerCase() === 'green') || 
          (d.severity?.toLowerCase()?.includes('minor')) ||
          (!d.alertLevel && !d.severity)).length
      } Green\n\n`;
      
      // Add current disaster breakdown by type
      const disasterTypes = {};
      filteredDisasters.forEach(disaster => {
        const type = disaster.eventType?.toUpperCase() || 'Unknown';
        disasterTypes[type] = (disasterTypes[type] || 0) + 1;
      });
      
      reportContent += `## Active Disasters by Type\n`;
      Object.entries(disasterTypes).forEach(([type, count]) => {
        const fullName = getDisasterFullName(type);
        reportContent += `- **${fullName}:** ${count}\n`;
      });
      reportContent += `\n`;
      
      // Add situation report if available
      if (sitrep) {
        reportContent += `# Situation Overview\n\n${sitrep}\n\n`;
        reportContent += `---\n\n`;
      }
      
      // Group impacted facilities by disaster type, then by country and facility type
      const facilitiesByDisasterType = {};
      impactedFacilities.forEach(impact => {
        impact.impacts.forEach(disasterImpact => {
          const disasterType = disasterImpact.disaster?.eventType?.toUpperCase() || 'Unknown';
          if (!facilitiesByDisasterType[disasterType]) {
            facilitiesByDisasterType[disasterType] = {};
          }
          
          // Get country from facility data if available, otherwise "Unknown"
          const country = impact.facility.country || 
                         (impact.facility.address && impact.facility.address.includes(',') ? 
                          impact.facility.address.split(',').pop().trim() : "Unknown Location");
          
          if (!facilitiesByDisasterType[disasterType][country]) {
            facilitiesByDisasterType[disasterType][country] = {};
          }
          
          // Get facility type if available, otherwise "General"
          const facilityType = impact.facility.type || 
                              impact.facility.facilityType || 
                              impact.facility.category || 
                              "General";
                              
          if (!facilitiesByDisasterType[disasterType][country][facilityType]) {
            facilitiesByDisasterType[disasterType][country][facilityType] = [];
          }
          
          if (!facilitiesByDisasterType[disasterType][country][facilityType].includes(impact.facility)) {
            facilitiesByDisasterType[disasterType][country][facilityType].push(impact.facility);
          }
        });
      });
      
      // Add facilities impacted by disaster type section
      reportContent += `# IMPACT BREAKDOWN BY DISASTER TYPE\n\n`;
      Object.entries(facilitiesByDisasterType).forEach(([disasterType, countriesMap]) => {
        const fullName = getDisasterFullName(disasterType);
        
        // Count total facilities for this disaster type
        let totalFacilitiesForDisaster = 0;
        Object.values(countriesMap).forEach(facilityTypeMap => {
          Object.values(facilityTypeMap).forEach(facilities => {
            totalFacilitiesForDisaster += facilities.length;
          });
        });
        
        reportContent += `## ${fullName} (${totalFacilitiesForDisaster} facilities)\n`;
        
        // List facilities by country, then by facility type
        Object.entries(countriesMap).forEach(([country, facilityTypesMap]) => {
          // Count facilities for this country
          let totalFacilitiesForCountry = 0;
          Object.values(facilityTypesMap).forEach(facilities => {
            totalFacilitiesForCountry += facilities.length;
          });
          
          reportContent += `### ${country} (${totalFacilitiesForCountry} facilities)\n`;
          
          Object.entries(facilityTypesMap).forEach(([facilityType, facilities]) => {
            reportContent += `#### ${facilityType} Facilities (${facilities.length})\n`;
            
            facilities.forEach(facility => {
              // Include all available facility metadata
              const additionalInfo = Object.entries(facility)
                .filter(([key, _]) => !['name', 'latitude', 'longitude', 'type', 'facilityType', 'category', 'country'].includes(key))
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
              
              const locationInfo = `${facility.latitude}, ${facility.longitude}`;
              
              if (additionalInfo) {
                reportContent += `- **${facility.name}** - Location: ${locationInfo} - ${additionalInfo}\n`;
              } else {
                reportContent += `- **${facility.name}** - Location: ${locationInfo}\n`;
              }
            });
            
            reportContent += `\n`;
          });
        });
        
        reportContent += `\n`;
      });
      
      // For large numbers of facilities, provide high-level recommendations by disaster type
      reportContent += `# PRIORITY RECOMMENDATIONS BY DISASTER TYPE\n\n`;
      
      const highPriorityRecommendations = {
        "EQ": [
          "Immediately check structural integrity of all buildings in earthquake-affected regions",
          "Initiate communication with all facilities in affected areas; prioritize those without response",
          "Deploy assessment teams to facilities reporting damage or with no communication",
          "Prepare temporary housing and supplies for displaced personnel"
        ],
        "TC": [
          "Evacuate personnel from facilities in the direct path of tropical cyclones",
          "Secure all equipment and materials that could become projectiles in high winds",
          "Pre-position emergency supplies before landfall at safe locations",
          "Maintain hourly communication with facilities during storm passage when safe"
        ],
        "FL": [
          "Move essential equipment and supplies to higher floors in flood-prone facilities",
          "Establish evacuation routes that avoid flood-prone roads and bridges",
          "Deploy water pumping equipment to critical facilities",
          "Establish decontamination protocols for facilities after floodwaters recede"
        ],
        "VO": [
          "Monitor air quality at all facilities within volcanic ash fallout zones",
          "Distribute respiratory protection equipment to affected facilities",
          "Clear ash from rooftops to prevent structural collapse",
          "Establish protocols for safe ash removal and disposal"
        ],
        "DR": [
          "Implement water conservation measures at all facilities in drought-affected regions",
          "Secure additional water supplies for critical operations",
          "Prioritize facilities with highest water dependency for assistance",
          "Deploy water quality testing kits to monitor deteriorating water sources"
        ],
        "WF": [
          "Establish defensible space around facilities in wildfire-prone areas",
          "Prepare evacuation plans with multiple exit routes",
          "Monitor air quality and provide filtration systems for affected facilities",
          "Pre-position firefighting equipment at high-risk facilities"
        ],
        "TS": [
          "Evacuate all coastal facilities in tsunami warning zones immediately",
          "Position emergency response teams at safe elevations near tsunami-prone areas",
          "Establish clear tsunami evacuation routes with marked safe zones",
          "Prepare for potential contamination from seawater inundation of facilities"
        ]
      };
      
      Object.entries(facilitiesByDisasterType).forEach(([disasterType, facilitiesList]) => {
        const fullName = getDisasterFullName(disasterType);
        reportContent += `## ${fullName} Priority Response Actions\n`;
        
        // Add high-priority recommendations for this disaster type
        const recommendations = highPriorityRecommendations[disasterType] || 
          ["Conduct rapid assessment of all affected facilities", 
           "Establish communication protocols with affected facilities", 
           "Prepare emergency resources for deployment"];
        
        recommendations.forEach(rec => {
          reportContent += `- ${rec}\n`;
        });
        
        reportContent += `\n`;
      });
      
      // Provide a summary of the most critical facilities
      if (impactedFacilities.length > 0) {
        // Sort facilities by number of disasters affecting them
        const criticalFacilities = [...impactedFacilities]
          .sort((a, b) => b.impacts.length - a.impacts.length)
          .slice(0, Math.min(5, impactedFacilities.length));
        
        reportContent += `# HIGHEST PRIORITY FACILITIES\n\n`;
        reportContent += `The following facilities are affected by multiple disasters or high-severity events and require immediate attention:\n\n`;
        
        criticalFacilities.forEach((impact, index) => {
          const facility = impact.facility;
          const disasterCount = impact.impacts.length;
          const disasterTypes = impact.impacts.map(i => getDisasterFullName(i.disaster?.eventType?.toUpperCase() || 'Unknown'));
          const uniqueDisasterTypes = [...new Set(disasterTypes)];
          
          reportContent += `## ${index + 1}. ${facility.name}\n`;
          reportContent += `- **Location:** ${facility.latitude}, ${facility.longitude}\n`;
          reportContent += `- **Impacted by:** ${disasterCount} disaster event(s)\n`;
          reportContent += `- **Disaster Types:** ${uniqueDisasterTypes.join(', ')}\n`;
          
          // If available, add a brief recommendation for this specific facility
          reportContent += `- **Immediate Action:** ${getImmediateAction(uniqueDisasterTypes)}\n\n`;
        });
      }
      
      // Add resource allocation guidance
      reportContent += `# RESOURCE ALLOCATION GUIDANCE\n\n`;
      reportContent += `## Personnel Deployment Priorities\n`;
      reportContent += `- Deploy assessment teams to ${Math.min(10, impactedFacilities.length)} highest priority facilities first\n`;
      reportContent += `- Establish forward command posts in areas with clusters of affected facilities\n`;
      reportContent += `- Rotate personnel working in extreme conditions every 12 hours\n\n`;
      
      reportContent += `## Equipment & Supply Distribution\n`;
      reportContent += `- Pre-position emergency supplies at strategic locations to serve multiple affected facilities\n`;
      reportContent += `- Prioritize communication equipment for facilities in areas with infrastructure damage\n`;
      reportContent += `- Allocate temporary power generation to facilities with critical operations\n\n`;
      
      reportContent += `## Communication Protocol\n`;
      reportContent += `- Establish hourly check-ins with facilities in red alert zones\n`;
      reportContent += `- Implement twice-daily situation reports from all affected facilities\n`;
      reportContent += `- Maintain dedicated communication channels for highest priority facilities\n\n`;
      
      // Add contact information section
      reportContent += `# EMERGENCY CONTACT INFORMATION\n\n`;
      reportContent += `## Emergency Operations Center\n`;
      reportContent += `- **Main Dispatch:** [Add primary EOC contact number]\n`;
      reportContent += `- **Email:** [Add EOC email]\n`;
      reportContent += `- **Radio Frequency:** [Add emergency frequency if applicable]\n\n`;
      
      reportContent += `## Key Personnel\n`;
      reportContent += `- **Emergency Coordinator:** [Add name and contact details]\n`;
      reportContent += `- **Logistics Coordinator:** [Add name and contact details]\n`;
      reportContent += `- **Medical Coordinator:** [Add name and contact details]\n\n`;
      
      // Add detailed facility-specific recommendations only for the top 5 most critical facilities
      if (impactedFacilities.length > 0) {
        const criticalFacilities = [...impactedFacilities]
          .sort((a, b) => b.impacts.length - a.impacts.length)
          .slice(0, Math.min(5, impactedFacilities.length));
        
        if (criticalFacilities.length > 0) {
          reportContent += `# DETAILED RECOMMENDATIONS FOR CRITICAL FACILITIES\n\n`;
          
          // Get detailed recommendations for these critical facilities only
          for (const impact of criticalFacilities) {
            try {
              const response = await fetch('/api/recommendations', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  facility: impact.facility,
                  impacts: impact.impacts,
                  useAI: true
                }),
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.recommendations) {
                  reportContent += `## ${impact.facility.name}\n\n`;
                  
                  // Format recommendations
                  Object.entries(data.recommendations).forEach(([category, items]) => {
                    if (category !== 'error' && category !== 'Credits' && category !== 'About' && items) {
                      reportContent += `### ${category}\n`;
                      
                      if (Array.isArray(items)) {
                        items.forEach(item => {
                          reportContent += `- ${item}\n`;
                        });
                      } else {
                        reportContent += `- ${items}\n`;
                      }
                      
                      reportContent += '\n';
                    }
                  });
                  
                  reportContent += `\n`;
                }
              }
            } catch (err) {
              console.error(`Error getting recommendations for ${impact.facility.name}:`, err);
            }
          }
        }
      }
      
      // Add attribution (only in the footer)
      reportContent += `\n\n---\n\n`;
      reportContent += `*Generated by AI Disaster Impact and Response Tool | Developed by John Mark Esplana*`;
      
      // Save the complete report
      setCompleteReport(reportContent);
      
      // Convert to Word format and download
      downloadWordDocument(reportContent, `GDACS-Emergency-Response-Overview-${date}`);
      
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      alert('Failed to generate comprehensive report. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, sitrep: false }));
    }
  };
  
  // Helper function to get full disaster name from code
  const getDisasterFullName = (code) => {
    const disasterCodes = {
      'EQ': 'Earthquake',
      'TC': 'Tropical Cyclone',
      'FL': 'Flood',
      'VO': 'Volcanic Activity',
      'DR': 'Drought',
      'WF': 'Wildfire',
      'TS': 'Tsunami',
      'UNKNOWN': 'Unspecified Disaster'
    };
    
    return disasterCodes[code] || code;
  };
  
  // Helper function to get immediate action based on disaster types
  const getImmediateAction = (disasterTypes) => {
    if (disasterTypes.includes('Earthquake')) {
      return 'Conduct structural assessment and establish emergency shelter';
    } else if (disasterTypes.includes('Tropical Cyclone')) {
      return 'Secure facility and prepare for evacuation if in direct path';
    } else if (disasterTypes.includes('Flood')) {
      return 'Move critical equipment to higher ground and monitor water levels';
    } else if (disasterTypes.includes('Tsunami')) {
      return 'Evacuate immediately to designated high ground';
    } else if (disasterTypes.includes('Volcanic Activity')) {
      return 'Monitor air quality and prepare for evacuation if eruption intensifies';
    } else if (disasterTypes.includes('Wildfire')) {
      return 'Clear defensible space and prepare for evacuation';
    } else if (disasterTypes.includes('Drought')) {
      return 'Implement water conservation measures and secure alternative supplies';
    } else {
      return 'Conduct rapid assessment and establish communication';
    }
  };
  
  // Helper function to download content as Word document
  const downloadWordDocument = (content, filename) => {
    try {
      // Create Word document format using basic HTML with MS Word-specific XML
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8">
            <meta name="ProgId" content="Word.Document">
            <meta name="Generator" content="Microsoft Word 15">
            <meta name="Originator" content="Microsoft Word 15">
            <title>GDACS AI Analysis Report</title>
            <!--[if gte mso 9]>
            <xml>
              <w:WordDocument>
                <w:View>Print</w:View>
                <w:Zoom>90</w:Zoom>
                <w:DoNotOptimizeForBrowser/>
              </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
              body { font-family: 'Calibri', sans-serif; margin: 1cm; }
              h1, h2, h3 { font-family: 'Calibri', sans-serif; }
              h1 { font-size: 16pt; color: #2196F3; margin-top: 24pt; margin-bottom: 6pt; }
              h2 { font-size: 14pt; color: #0d47a1; margin-top: 18pt; margin-bottom: 6pt; }
              h3 { font-size: 12pt; color: #333; margin-top: 12pt; margin-bottom: 3pt; }
              p { margin: 6pt 0; }
              ul { margin-left: 20pt; }
              li { margin-bottom: 3pt; }
              .highlight { color: #d32f2f; font-weight: bold; background-color: #ffebee; padding: 2pt; }
              .footer { font-style: italic; color: #666; margin-top: 24pt; border-top: 1pt solid #ccc; padding-top: 12pt; text-align: center; }
            </style>
          </head>
          <body>
            ${content
              .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
              .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
              .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/\n- (.*?)$/gm, '<ul><li>$1</li></ul>')
              .replace(/<\/ul>\s*<ul>/g, '')  // Combine adjacent lists
              .replace(/\n\n/g, '<p></p>')
              .replace(/\n/g, '<br>')
              .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
              .replace(/---\n\n\*(.*?)\*/, '<hr><div class="footer">$1</div>')} <!-- Format footer -->
          </body>
        </html>
      `;
      
      // Correct MIME type for Word documents
      const blob = new Blob([htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.doc`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Error downloading Word document:', e);
      
      // Try again with a simpler HTML structure
      try {
        const simpleHtml = `<html><head><title>GDACS Report</title></head><body>${content.replace(/\n/g, '<br>')}</body></html>`;
        const simpleBlob = new Blob([simpleHtml], { type: 'application/msword' });
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(simpleBlob);
        a.download = `${filename}.doc`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
      } catch (finalError) {
        console.error('Final error trying to download Word document:', finalError);
        alert('Unable to download Word document. Please try again or copy the content manually.');
      }
    }
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
            gap: '20px',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <div style={{
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
                  }}>{filteredDisasters.filter(d => 
                    (d.alertLevel?.toLowerCase() === 'red') || 
                    (d.severity?.toLowerCase()?.includes('extreme')) || 
                    (d.severity?.toLowerCase()?.includes('severe'))).length}</span>
                  
                  <span style={{
                    backgroundColor: '#ffa500',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>{filteredDisasters.filter(d => 
                    (d.alertLevel?.toLowerCase() === 'orange') || 
                    (d.severity?.toLowerCase()?.includes('moderate'))).length}</span>
                  
                  <span style={{
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>{filteredDisasters.filter(d => 
                    (d.alertLevel?.toLowerCase() === 'green') || 
                    (d.severity?.toLowerCase()?.includes('minor')) ||
                    (!d.alertLevel && !d.severity)).length}</span>
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
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
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
              
              {/* Complete AI Report Download Button */}
              <button 
                onClick={generateCompleteReport}
                disabled={loading.sitrep || !impactedFacilities.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: loading.sitrep || !impactedFacilities.length ? '#e0e0e0' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: loading.sitrep || !impactedFacilities.length ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                {loading.sitrep ? (
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                )}
                {loading.sitrep ? 'Generating...' : 'Download Complete AI Report'}
              </button>
            </div>
            
            {/* Last Updated indicator */}
            {lastUpdated && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '10px',
                color: '#666',
                backgroundColor: '#f5f5f5',
                padding: '3px 8px',
                borderRadius: '4px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <div>
                  <span style={{ fontWeight: 'medium' }}>
                    Updated: {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }).format(lastUpdated)}
                  </span>
                  {timeSinceUpdate && (
                    <span style={{ 
                      marginLeft: '4px', 
                      backgroundColor: timeSinceUpdate.includes('hour') || timeSinceUpdate.includes('day') ? '#ffebee' : '#e8f5e9',
                      padding: '1px 4px',
                      borderRadius: '8px',
                      fontSize: '9px',
                      color: timeSinceUpdate.includes('hour') || timeSinceUpdate.includes('day') ? '#d32f2f' : '#2e7d32',
                      fontWeight: 'bold'
                    }}>
                      {timeSinceUpdate}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating control buttons */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 2000,
          display: 'flex',
          gap: '10px'
        }}>
          
          {/* Help button */}
          <button 
            style={{
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
            onClick={() => setShowHelp(!showHelp)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Help Guide
          </button>
        </div>
        
        {/* Settings panel */}
        {/* Help panel */}
        <div 
          className="floating-panel help-floating-panel"
          style={{
            position: 'absolute',
            top: '70px',
            left: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            zIndex: 3000, /* Higher than map controls (2000) */
            padding: '20px',
            maxWidth: '450px',
            maxHeight: '80vh',
            overflowY: 'auto',
            transform: showHelp ? 'translateY(0)' : 'translateY(-200%)',
            opacity: showHelp ? 1 : 0,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            pointerEvents: showHelp ? 'auto' : 'none'
          }}
        >
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '15px', 
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: '10px',
            color: '#F44336'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              GDACS FACILITIES IMPACT ASSESSMENT GUIDE
            </div>
            <button
              onClick={() => setShowHelp(false)}
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
          
          {/* What Is This Tool section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#F44336', marginBottom: '10px' }}>What Is This Tool?</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '10px' }}>
              The GDACS Facilities Impact Assessment Tool helps organizations monitor their global facilities and assess potential impacts from current natural disasters. It combines real-time disaster data from the Global Disaster Alert and Coordination System (GDACS) with your facility locations to identify risks and provide AI-powered recommendations.
            </p>
          </div>
          
          {/* Problems Solved section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#F44336', marginBottom: '10px' }}>Problems This Tool Solves</h3>
            <ul style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Scattered Information:</strong> Consolidates disaster data and facility locations in one visual interface
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Manual Assessment:</strong> Automatically identifies which facilities are at risk from active disasters
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Response Planning:</strong> Generates AI-powered recommendations specific to each facility and disaster type
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Situation Reporting:</strong> Creates comprehensive reports for stakeholders with a single click
              </li>
            </ul>
          </div>
          
          {/* Key Features section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#F44336', marginBottom: '10px' }}>Key Features</h3>
            <ul style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Interactive Map:</strong> Visualize disasters and facilities globally
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Facility Upload:</strong> Import your facilities from CSV/Excel files
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Automated Impact Assessment:</strong> Identify which facilities are affected by disasters
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>AI Analysis:</strong> Get personalized risk analysis for any facility
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Smart Recommendations:</strong> Receive specific action items based on disaster type
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Situation Reports:</strong> Generate comprehensive reports for stakeholders
              </li>
              <li style={{ marginBottom: '8px', backgroundColor: '#ffebee', padding: '5px 8px', borderRadius: '4px' }}>
                <strong>Complete AI Report:</strong> Download all AI-generated content in a single Word document
              </li>
            </ul>
          </div>
          
          {/* How To Use section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#F44336', marginBottom: '10px' }}>How To Use This Tool</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>1. Upload Your Facilities</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click the <strong>Facilities</strong> button on the right side of the map. Upload a CSV or Excel file with your facility locations (must include name, latitude, and longitude columns).
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>2. View Disaster Data</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                The map shows active disasters from GDACS. Use the <strong>Filters</strong> button to filter disasters by type and time period.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>3. Assess Impact</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Once facilities are uploaded, the system automatically identifies which are in the impact radius of active disasters.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>4. Analyze Facilities</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click on a facility marker, then select <strong>Analyze with AI</strong> to get a detailed risk assessment.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>5. Get Recommendations</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click <strong>View Recommendations</strong> to receive specific action items tailored to the facility and disasters affecting it.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>6. Generate Report</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click the <strong>Sitrep</strong> button to create a comprehensive situation report for all impacted facilities.
              </p>
            </div>
            
            <div style={{ marginBottom: '12px', backgroundColor: '#ffebee', padding: '10px', borderRadius: '4px' }}>
              <h4 style={{ fontSize: '14px', color: '#d32f2f', marginBottom: '5px' }}>7. Download Complete AI Report</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click the <strong>Download Complete AI Report</strong> button in the dashboard header to generate a comprehensive Word document that includes all AI-generated content: situation report, facility-specific recommendations, and detailed analysis.
              </p>
            </div>
          </div>
          
          {/* Use Cases section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: '#F44336', marginBottom: '10px' }}>Use Cases</h3>
            <ul style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Emergency Response:</strong> Quickly identify which facilities need immediate assistance during a disaster
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Business Continuity:</strong> Prepare specific action plans for facilities at risk
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Risk Assessment:</strong> Evaluate which facilities might be impacted by developing situations
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Executive Briefing:</strong> Generate professional reports for leadership teams
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Resource Allocation:</strong> Make informed decisions on where to deploy emergency resources
              </li>
            </ul>
          </div>
          
          {/* Tips section */}
          <div style={{ 
            backgroundColor: 'rgba(244, 67, 54, 0.05)', 
            padding: '15px', 
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            <h3 style={{ fontSize: '16px', color: '#F44336', marginBottom: '10px' }}>Pro Tips</h3>
            <ul style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>
                Use the time filter to focus on recent disasters or historical events
              </li>
              <li style={{ marginBottom: '8px' }}>
                High-risk recommendations are automatically highlighted in red
              </li>
              <li style={{ marginBottom: '8px' }}>
                Download reports in Word format for easy sharing with stakeholders
              </li>
              <li style={{ marginBottom: '8px' }}>
                For comprehensive reporting, use the "Download Complete AI Report" button to combine all AI-generated content into one document
              </li>
              <li style={{ marginBottom: '8px' }}>
                Click the map legend to filter disasters by type
              </li>
            </ul>
          </div>
          
          <div style={{ 
            fontSize: '13px', 
            color: '#888', 
            fontStyle: 'italic',
            textAlign: 'center',
            marginTop: '20px',
            borderTop: '1px solid #eee',
            paddingTop: '15px'
          }}>
            Developed by <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer" style={{ color: '#F44336', textDecoration: 'none' }}>John Mark Esplana</a>
          </div>
        </div>
        

        <MapComponent 
          disasters={filteredDisasters} 
          facilities={facilities}
          impactedFacilities={impactedFacilities}
          impactStatistics={impactStatistics}
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
            isAIGenerated={recommendationsAIGenerated}
          />
        )}

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
      
      <footer style={{
        padding: '15px',
        textAlign: 'center',
        borderTop: '1px solid #eaeaea',
        marginTop: '20px',
        fontSize: '14px',
        color: '#666'
      }}>
        Created by <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer" style={{ color: '#2196F3', textDecoration: 'none', fontWeight: 'bold' }}>John Mark Esplana</a> | GDACS Facilities Impact Assessment Tool
      </footer>
    </div>
  )
}