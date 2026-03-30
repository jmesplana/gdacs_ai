import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Papa from 'papaparse';
import { ToastContainer, useToast } from '../components/Toast';
import OnboardingModal from '../components/OnboardingModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { getDisasterTimelineDate } from '../components/MapComponent/utils/disasterHelpers';

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

const PredictionDashboard = dynamic(() => import('../components/PredictionDashboard'), {
  ssr: false,
});

const OperationalOutlook = dynamic(() => import('../components/OperationalOutlook'), {
  ssr: false,
});

const PrioritizationBoard = dynamic(() => import('../components/PrioritizationBoard'), {
  ssr: false,
});

// GDACS Facilities Impact Assessment Tool
// Developed by John Mark Esplana (https://github.com/jmesplana)
export default function Home() {
  const loadCachedJson = (key) => {
    const sources = [
      { storage: localStorage, label: 'localStorage' },
      { storage: sessionStorage, label: 'sessionStorage' }
    ];

    for (const source of sources) {
      try {
        const value = source.storage.getItem(key);
        if (value) {
          return {
            value: JSON.parse(value),
            source: source.label
          };
        }
      } catch (error) {
        console.warn(`Unable to read ${key} from ${source.label}:`, error);
      }
    }

    return { value: null, source: null };
  };

  const removeCachedValue = (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Unable to clear ${key} from localStorage:`, error);
    }

    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`Unable to clear ${key} from sessionStorage:`, error);
    }
  };

  const persistCachedJson = (key, value) => {
    const serialized = JSON.stringify(value);
    const targets = [
      { storage: localStorage, label: 'localStorage', persistent: true },
      { storage: sessionStorage, label: 'sessionStorage', persistent: false }
    ];

    for (const target of targets) {
      try {
        target.storage.setItem(key, serialized);
        if (target.label !== 'localStorage') {
          try {
            localStorage.removeItem(key);
          } catch (_) {}
        } else {
          try {
            sessionStorage.removeItem(key);
          } catch (_) {}
        }
        return { ok: true, storage: target.label, persistent: target.persistent };
      } catch (error) {
        console.warn(`Unable to save ${key} to ${target.label}:`, error);
      }
    }

    return { ok: false, storage: null, persistent: false };
  };

  const parseApiResponse = async (response, label) => {
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    if (!response.ok) {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`${label} failed with status ${response.status}${preview ? `: ${preview}` : ''}`);
    }

    if (!contentType.includes('application/json')) {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`${label} returned ${contentType || 'non-JSON content'}${preview ? `: ${preview}` : ''}`);
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ').trim();
      throw new Error(`${label} returned invalid JSON${preview ? `: ${preview}` : ''}`);
    }
  };

  const buildImpactFacilitiesPayload = (facilityData) => {
    return facilityData.map((facility) => ({
      name: facility.name,
      latitude: facility.latitude,
      longitude: facility.longitude
    }));
  };

  const buildImpactDisastersPayload = (items = []) => {
    return items.map((item) => ({
      eventType: item.eventType,
      eventName: item.eventName,
      title: item.title,
      latitude: item.latitude,
      longitude: item.longitude,
      alertLevel: item.alertLevel,
      severity: item.severity,
      polygon: item.polygon,
      source: item.source
    }));
  };

  const buildImpactAcledPayload = (items = []) => {
    return items.map((item) => ({
      event_type: item.event_type,
      sub_event_type: item.sub_event_type,
      latitude: item.latitude,
      longitude: item.longitude,
      event_date: item.event_date,
      fatalities: item.fatalities
    }));
  };

  const sanitizeDistrictLabel = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;

    const cleaned = String(value)
      .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || fallback;
  };

  const [disasters, setDisasters] = useState([]);
  const [filteredDisasters, setFilteredDisasters] = useState([]);
  const [gdacsDiagnostics, setGdacsDiagnostics] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [impactedFacilities, setImpactedFacilities] = useState([]);
  const [impactStatistics, setImpactStatistics] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsAIGenerated, setRecommendationsAIGenerated] = useState(false);
  const [sitrep, setSitrep] = useState('');
  const [sitrepTimestamp, setSitrepTimestamp] = useState(null);
  const [loading, setLoading] = useState({
    disasters: true,
    impact: false,
    recommendations: false,
    sitrep: false
  });
  const [activeTab, setActiveTab] = useState('map');
  const [dataSource, setDataSource] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // default to all fetched GDACS events
  const [fetchError, setFetchError] = useState(null);
  const [showHelp, setShowHelp] = useState(false); // Help panel visibility
  const [showChatDrawer, setShowChatDrawer] = useState(false); // Chat drawer visibility
  const [showPredictions, setShowPredictions] = useState(false); // Prediction dashboard visibility
  const [showOperationalOutlook, setShowOperationalOutlook] = useState(false); // Operational outlook dashboard visibility
  const [showPrioritizationBoard, setShowPrioritizationBoard] = useState(false); // Prioritization board visibility
  const [completeReport, setCompleteReport] = useState(null); // Store combined AI report
  const [lastUpdated, setLastUpdated] = useState(null); // Track when data was last updated
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(''); // Human-readable time since last update
  const [aiAnalysisFields, setAiAnalysisFields] = useState([]); // Track which fields are selected for AI analysis

  // ACLED security data state
  const [acledData, setAcledData] = useState([]); // ACLED conflict/security events
  const [acledEnabled, setAcledEnabled] = useState(true); // Toggle ACLED in analysis
  const [acledConfig, setAcledConfig] = useState({
    dateRange: 60, // days to consider
    eventTypes: ['Battles', 'Explosions/Remote violence', 'Violence against civilians', 'Riots'],
    showOnMap: true,
    selectedCountries: [], // Filter by countries
    selectedRegions: [] // Filter by regions (admin1)
  });

  // District boundaries from shapefile upload
  const [districts, setDistricts] = useState([]);
  const [districtAvailableFields, setDistrictAvailableFields] = useState([]);
  const [districtLabelField, setDistrictLabelField] = useState(null);
  const [districtRawData, setDistrictRawData] = useState([]); // Store original district data for remapping
  const [selectedDistrictForForecast, setSelectedDistrictForForecast] = useState(null); // For district-specific forecast
  const [selectedDistrictForOutlook, setSelectedDistrictForOutlook] = useState(null); // For district-specific operational outlook

  // WorldPop population data (lifted from MapComponent)
  const [worldPopData, setWorldPopData] = useState({});
  const [worldPopLastFetch, setWorldPopLastFetch] = useState(null);

  // OSM infrastructure data (lifted from MapComponent)
  const [osmData, setOsmData] = useState(null);
  const [selectedAnalysisDistricts, setSelectedAnalysisDistricts] = useState([]);
  const [latestPrioritizationBoard, setLatestPrioritizationBoard] = useState(null);
  const [enabledEvidenceLayers, setEnabledEvidenceLayers] = useState([]);

  // Toast notifications
  const { toasts, addToast, dismissToast } = useToast();

  // First-time onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem('gdacs_onboarding_done')) {
        setShowOnboarding(true);
      }
    } catch (_) {}
  }, []);
  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    try { localStorage.setItem('gdacs_onboarding_done', '1'); } catch (_) {}
  };

  // Operation type state (for multi-use humanitarian operations)
  const [operationType, setOperationType] = useState('');

  // Persist operation type to localStorage
  useEffect(() => {
    try {
      if (typeof operationType === 'string' && operationType) {
        localStorage.setItem('gdacs_operation_type', operationType);
      } else {
        localStorage.removeItem('gdacs_operation_type');
      }
    } catch (error) {
      console.warn('Unable to persist operation type to localStorage:', error);
    }
  }, [operationType]);

  // Load operation type from localStorage on mount
  useEffect(() => {
    try {
      const cachedOperationType = localStorage.getItem('gdacs_operation_type');
      if (cachedOperationType) {
        setOperationType(cachedOperationType);
        console.log('Loaded operation type from cache:', cachedOperationType);
      }
    } catch (error) {
      console.error('Error loading operation type:', error);
    }
  }, []);

  // Load cached facilities and ACLED data from localStorage on mount
  useEffect(() => {
    try {
      // Load facilities
      const { value: cachedFacilities, source: facilitiesCacheSource } = loadCachedJson('gdacs_facilities');
      const { value: cachedAiFields } = loadCachedJson('gdacs_ai_analysis_fields');

      if (cachedFacilities) {
        if (cachedFacilities && cachedFacilities.length > 0) {
          console.log(`Loaded ${cachedFacilities.length} facilities from ${facilitiesCacheSource || 'cache'}`);
          setFacilities(cachedFacilities);

          // Restore AI analysis fields if available
          if (cachedAiFields) {
            setAiAnalysisFields(cachedAiFields);
          }

          // Assess impact with cached facilities once disasters are loaded
          if (disasters.length > 0) {
            assessImpact(cachedFacilities);
          }
        }
      }

      // Load ACLED config only (data not cached due to size)
      const cachedAcledConfig = localStorage.getItem('gdacs_acled_config');
      if (cachedAcledConfig) {
        try {
          const parsedConfig = JSON.parse(cachedAcledConfig);
          setAcledConfig(parsedConfig);
          setAcledEnabled(parsedConfig.enabled !== undefined ? parsedConfig.enabled : true);
          console.log('Loaded ACLED config from cache');
        } catch (error) {
          console.error('Error loading ACLED config:', error);
        }
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
      // Clear corrupted cache
      removeCachedValue('gdacs_facilities');
      removeCachedValue('gdacs_ai_analysis_fields');
      removeCachedValue('gdacs_acled_data');
      removeCachedValue('gdacs_acled_config');
    }
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
    const nextFilteredDisasters = filterDisastersByDate(dateFilter);

    // Debug logging for disaster data
    console.log('Disasters data state:', {
      totalDisasters: disasters.length,
      disastersWithCoordinates: disasters.filter(d => d.latitude && d.longitude).length,
      dateFilter: dateFilter
    });

    // Re-assess impact when filter changes if facilities are available
    if (facilities.length > 0) {
      console.log('Auto-refreshing impact assessment due to filter change');
      assessImpact(facilities, { disastersOverride: nextFilteredDisasters });
    }
  }, [disasters, dateFilter]);

  // Re-assess impact when ACLED data or enabled state changes
  useEffect(() => {
    if (facilities.length > 0) {
      console.log('ACLED data/state changed - re-assessing facility impacts...', {
        acledEvents: acledData.length,
        acledEnabled: acledEnabled
      });
      assessImpact(facilities);
    }
  }, [acledData, acledEnabled]);

  // Initialize with disaster data on mount
  useEffect(() => {
    fetchDisasterData();
  }, []);

  // Fetch GDACS disaster data
  const fetchDisasterData = async () => {
    try {
      setLoading(prev => ({ ...prev, disasters: true }));
      setFetchError(null);

      const response = await fetch('/api/gdacs');
      if (!response.ok) {
        console.warn(`GDACS API unavailable (status ${response.status}). Continuing without disaster data.`);
        setDisasters([]);
        setFilteredDisasters([]);
        setDataSource('GDACS temporarily unavailable');
        setFetchError('GDACS servers are temporarily unavailable. App functionality continues without disaster data.');
        return;
      }

      const data = await parseApiResponse(response, 'GDACS API');
      if (!data || !Array.isArray(data)) {
        console.warn('Invalid GDACS data format. Continuing without disaster data.');
        setDisasters([]);
        setFilteredDisasters([]);
        setDataSource('GDACS data unavailable');
        return;
      }

      // Filter to events with valid coordinates
      const processedData = data
        .filter(d => d.latitude !== null && d.longitude !== null &&
          !isNaN(parseFloat(d.latitude)) && !isNaN(parseFloat(d.longitude)))
        .map(d => ({
          ...d,
          latitude: typeof d.latitude === 'string' ? parseFloat(d.latitude) : d.latitude,
          longitude: typeof d.longitude === 'string' ? parseFloat(d.longitude) : d.longitude,
        }));

      const initiallyFilteredDisasters = filterDisastersByDate(dateFilter, processedData, false);

      setDisasters(processedData);
      setFilteredDisasters(initiallyFilteredDisasters);
      setDataSource(`Live GDACS data (${processedData.length} events)`);
      const primarySourceLabel = processedData[0]?.primarySource === 'rss_fallback' ? 'RSS fallback' : 'CAP/RSS feed';
      setGdacsDiagnostics({
        fetchedTotal: processedData.length,
        primarySourceLabel,
        primaryOnly: processedData.filter(event => event.dataSources?.length === 1 && event.dataSources.includes(processedData[0]?.primarySource === 'rss_fallback' ? 'rss' : 'cap')).length,
        jsonOnly: processedData.filter(event => event.dataSources?.length === 1 && event.dataSources.includes('json_api')).length,
        enriched: processedData.filter(event => event.enriched).length,
        withGeometryUrl: processedData.filter(event => Boolean(event.geometryUrl)).length,
        lastFetchAt: new Date().toISOString()
      });

      // Set last updated from most recent event modification date (when GDACS last updated any event)
      const sorted = [...processedData].sort((a, b) => {
        const dateA = b.lastModified || b.pubDate;
        const dateB = a.lastModified || a.pubDate;
        return (dateA ? new Date(dateA) : 0) - (dateB ? new Date(dateB) : 0);
      });
      const mostRecentDate = sorted[0]?.lastModified || sorted[0]?.pubDate;
      setLastUpdated(mostRecentDate ? new Date(mostRecentDate) : new Date());

    } catch (error) {
      console.error('Error fetching disaster data:', error);
      setFetchError(error.message);
      setDataSource('GDACS data unavailable');
    } finally {
      setLoading(prev => ({ ...prev, disasters: false }));
    }
  };

  // Filter disasters based on the selected date range
  const filterDisastersByDate = (filter, sourceDisasters = disasters, updateState = true) => {
    if (!sourceDisasters || sourceDisasters.length === 0) {
      if (updateState) {
        setFilteredDisasters([]);
      }
      return [];
    }

    if (filter === 'all') {
      console.log('Setting all disasters without filtering');
      if (updateState) {
        setFilteredDisasters(sourceDisasters);
      }
      return sourceDisasters;
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
    
    const filtered = sourceDisasters.filter(disaster => {
      const disasterDate = getDisasterTimelineDate(disaster);
      if (!disasterDate) return true;
      return disasterDate >= cutoffDate;
    });
    
    console.log(`Filtered disasters from ${sourceDisasters.length} to ${filtered.length}`);
    console.log('First few filtered disasters:', filtered.slice(0, 3).map(d => ({
      title: d.title,
      lat: d.latitude,
      lng: d.longitude,
      date: getDisasterTimelineDate(d)?.toISOString() || null
    })));

    if (updateState) {
      setFilteredDisasters(filtered);
    }

    return filtered;
  };

  // Handle clearing cached facility data
  const handleClearCache = () => {
    try {
      removeCachedValue('gdacs_facilities');
      removeCachedValue('gdacs_ai_analysis_fields');

      // Clear state
      setFacilities([]);
      setImpactedFacilities([]);
      setImpactStatistics(null);
      setAiAnalysisFields([]);
      setSitrep('');
      setSelectedFacility(null);
      setRecommendations(null);

      addToast('Facility data cleared.', 'success');
    } catch (error) {
      console.error('Error clearing cache:', error);
      addToast('Failed to clear cache. Please try again.', 'error');
    }
  };

  // Handle districts loaded from shapefile
  const handleDistrictsLoaded = (districtsData, availableFields, selectedField) => {
    setDistricts(districtsData);
    setDistrictRawData(districtsData); // Store raw data for remapping
    if (availableFields) {
      setDistrictAvailableFields(availableFields);
    }
    if (selectedField) {
      setDistrictLabelField(selectedField);
    }
  };

  // Handle label field change for districts
  const handleDistrictLabelFieldChange = (fieldName) => {
    if (!districtRawData || districtRawData.length === 0) {
      return;
    }

    // Remap districts using the new field
    const remappedDistricts = districtRawData.map(district => ({
      ...district,
      name: sanitizeDistrictLabel(district.properties[fieldName], district.name),
      labelField: fieldName,
      properties: {
        ...district.properties,
        displayName: sanitizeDistrictLabel(district.properties[fieldName], district.name)
      }
    }));

    setDistricts(remappedDistricts);
    setDistrictLabelField(fieldName);
  };

  // Handle ACLED data upload
  const handleAcledUpload = (csvData) => {
    try {
      // Parse CSV
      Papa.parse(csvData, {
        header: true,
        complete: (results) => {
          // Validate and process ACLED data
          const validEvents = results.data.filter(event =>
            event.event_date &&
            !isNaN(parseFloat(event.latitude)) &&
            !isNaN(parseFloat(event.longitude)) &&
            event.event_type
          ).map(event => ({
            event_id: event.event_id_cnty || event.event_id,
            event_date: event.event_date,
            event_type: event.event_type,
            sub_event_type: event.sub_event_type,
            actor1: event.actor1,
            actor2: event.actor2,
            latitude: parseFloat(event.latitude),
            longitude: parseFloat(event.longitude),
            location: event.location,
            admin1: event.admin1,
            admin2: event.admin2,
            admin3: event.admin3,
            country: event.country,
            fatalities: parseInt(event.fatalities) || 0,
            notes: event.notes,
            source: event.source
          }));

          if (validEvents.length === 0) {
            addToast('No valid ACLED events found. Check that your CSV has event_date, latitude, longitude, and event_type columns.', 'error');
            return;
          }

          console.log(`Loaded ${validEvents.length} ACLED events`);

          // Don't cache ACLED data to localStorage (too large - exceeds quota)
          // Only cache the config
          try {
            const configToSave = { ...acledConfig, enabled: true };
            localStorage.setItem('gdacs_acled_config', JSON.stringify(configToSave));
            console.log('ACLED config saved. Note: Data is not cached (too large for localStorage)');
          } catch (error) {
            console.error('Error saving ACLED config:', error);
          }

          // Update state (useEffect will trigger reassessment automatically)
          setAcledData(validEvents);
          setAcledEnabled(true);

          addToast(`${validEvents.length.toLocaleString()} ACLED security events loaded. Re-upload after page refresh — file is too large for browser cache.`, 'success');
        },
        error: (error) => {
          console.error('Error parsing ACLED CSV:', error);
          addToast('Failed to parse ACLED CSV. Please check the file format.', 'error');
        }
      });
    } catch (error) {
      console.error('Error processing ACLED upload:', error);
      addToast('Failed to process ACLED data. Please try again.', 'error');
    }
  };

  // Handle clearing ACLED cache
  const handleClearAcledCache = () => {
    try {
      localStorage.removeItem('gdacs_acled_data');
      localStorage.removeItem('gdacs_acled_config');
      setAcledData([]);
      setAcledEnabled(true);
      setAcledConfig({
        dateRange: 60,
        eventTypes: ['Battles', 'Explosions/Remote violence', 'Violence against civilians', 'Riots'],
        showOnMap: true
      });
      addToast('Security event data cleared.', 'success');
    } catch (error) {
      console.error('Error clearing ACLED cache:', error);
      addToast('Failed to clear security data. Please try again.', 'error');
    }
  };

  // Toggle ACLED enabled/disabled
  const handleToggleAcled = (enabled) => {
    setAcledEnabled(enabled);
    try {
      const configToSave = { ...acledConfig, enabled };
      localStorage.setItem('gdacs_acled_config', JSON.stringify(configToSave));
    } catch (error) {
      console.error('Error saving ACLED config:', error);
    }
    // useEffect will trigger reassessment automatically when acledEnabled changes
  };

  // Handle ACLED config changes (date range, etc.)
  const handleAcledConfigChange = (newConfig) => {
    setAcledConfig(newConfig);
    try {
      localStorage.setItem('gdacs_acled_config', JSON.stringify(newConfig));
      console.log('ACLED config updated:', newConfig);
    } catch (error) {
      console.error('Error saving ACLED config:', error);
    }
  };

  // Handle facility CSV upload
  const handleFacilityUpload = (csvData, columnSelections) => {
    try {
      // Store AI analysis fields for use in chat context
      if (columnSelections && columnSelections.aiAnalysisFields) {
        console.log('Storing AI analysis fields:', columnSelections.aiAnalysisFields);
        setAiAnalysisFields(columnSelections.aiAnalysisFields);
      }

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
            addToast('No valid facilities found. Ensure your CSV has name, latitude, and longitude columns.', 'error');
            return;
          }

          console.log(`Loaded ${validFacilities.length} facilities`);

          // Clear any existing sitrep when facilities change
          setSitrep('');

          // Save facilities to localStorage (this will override any previous cache)
          const facilitiesCacheResult = persistCachedJson('gdacs_facilities', validFacilities);

          if (columnSelections && columnSelections.aiAnalysisFields) {
            persistCachedJson('gdacs_ai_analysis_fields', columnSelections.aiAnalysisFields);
          } else {
            removeCachedValue('gdacs_ai_analysis_fields');
          }

          if (facilitiesCacheResult.ok) {
            console.log(`Facilities cached to ${facilitiesCacheResult.storage}`);
            if (!facilitiesCacheResult.persistent) {
              addToast('Facility data is too large for persistent browser storage. It will remain available until this tab is closed.', 'warning');
            }
          } else {
            console.error('Facility data could not be cached in browser storage');
            addToast('Facility data loaded, but the file is too large to cache in the browser. It will need to be re-uploaded after refresh.', 'warning');
          }

          // Update facilities and immediately assess impact
          setFacilities(validFacilities);
          assessImpact(validFacilities);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          addToast('Failed to parse CSV. Please check the file format.', 'error');
        }
      });
    } catch (error) {
      console.error('Error processing facility upload:', error);
      addToast('Failed to process facility data. Please try again.', 'error');
    }
  };

  // Assess the impact of disasters on facilities
  const assessImpactRef = useRef(false); // Prevent concurrent calls
  const lastImpactPayloadRef = useRef('');
  const lastImpactResultRef = useRef(null);

  const applyImpactAssessmentResult = (facilityData, data, disastersToAssess) => {
    const facilityLookup = new Map(
      facilityData.map((facility) => [
        `${facility.name}__${facility.latitude}__${facility.longitude}`,
        facility
      ])
    );

    const mergedImpactedFacilities = (data.impactedFacilities || []).map((item) => {
      const key = `${item.facility?.name}__${item.facility?.latitude}__${item.facility?.longitude}`;
      const originalFacility = facilityLookup.get(key);

      return {
        ...item,
        facility: originalFacility
          ? { ...originalFacility, ...item.facility }
          : item.facility
      };
    });

    console.log(`Impact assessment found ${mergedImpactedFacilities.length || 0} impacted facilities`);

    setImpactedFacilities(mergedImpactedFacilities);

    if (data.statistics) {
      console.log('Impact assessment statistics:', data.statistics);
      setImpactStatistics(data.statistics);
    }

    console.log(`Applied impact assessment with ${dateFilter} date filter (${disastersToAssess.length} disasters)`);

    setSelectedFacility(null);
    setRecommendations(null);
  };

  const assessImpact = async (facilityData, options = {}) => {
    // Prevent multiple simultaneous assessments
    if (assessImpactRef.current) {
      console.log('Impact assessment already running, skipping...');
      return;
    }

    try {
      assessImpactRef.current = true;
      setLoading(prev => ({ ...prev, impact: true }));

      // Use filtered disasters instead of all disasters
      const disastersToAssess = options.disastersOverride || (filteredDisasters.length > 0 ? filteredDisasters : disasters);

      // Include ACLED events only if enabled and available
      const acledToAssess = options.acledOverride || ((acledEnabled && acledData && acledData.length > 0) ? acledData : []);
      const impactFacilities = buildImpactFacilitiesPayload(facilityData);
      const impactDisasters = buildImpactDisastersPayload(disastersToAssess);
      const impactAcledEvents = buildImpactAcledPayload(acledToAssess);
      const requestPayload = {
        facilities: impactFacilities,
        disasters: impactDisasters,
        acledEvents: impactAcledEvents,
        districts: []
      };
      const payloadJson = JSON.stringify(requestPayload);

      console.log(`Impact assessment: ${disastersToAssess.length} GDACS disasters + ${acledToAssess.length} ACLED events`);
      console.log('Impact assessment payload summary:', {
        facilities: facilityData.length,
        disasters: disastersToAssess.length,
        acledEvents: acledToAssess.length,
        districts: 0,
        bytes: payloadJson.length
      });

      if (lastImpactPayloadRef.current === payloadJson && lastImpactResultRef.current) {
        console.log('Impact assessment payload unchanged, reusing cached result');
        applyImpactAssessmentResult(facilityData, lastImpactResultRef.current, disastersToAssess);
        return;
      }

      const response = await fetch('/api/impact_assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadJson,
      });
      
      const data = await parseApiResponse(response, 'Impact assessment');
      lastImpactPayloadRef.current = payloadJson;
      lastImpactResultRef.current = data;
      applyImpactAssessmentResult(facilityData, data, disastersToAssess);
    } catch (error) {
      console.error('Error assessing impact:', error);
      addToast('Failed to assess facility impact. Please try again.', 'error');
    } finally {
      assessImpactRef.current = false;
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
      
      const data = await parseApiResponse(response, 'Recommendations');
      setRecommendations(data.recommendations || null);
      setRecommendationsAIGenerated(data.isAIGenerated || false);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      addToast('Failed to generate recommendations. Please try again.', 'error');
    } finally {
      setLoading(prev => ({ ...prev, recommendations: false }));
    }
  };

  const compactSitrepImpactedFacilities = (items = [], maxItems = 75) =>
    (items || []).slice(0, maxItems).map((item) => ({
      facility: {
        name: item?.facility?.name,
        latitude: item?.facility?.latitude,
        longitude: item?.facility?.longitude,
        type: item?.facility?.type || item?.facility?.facilityType,
        country: item?.facility?.country,
        region: item?.facility?.region,
        district: item?.facility?.district
      },
      impacts: (item?.impacts || []).slice(0, 8).map((impact) => ({
        distance: impact?.distance,
        impactMethod: impact?.impactMethod,
        disaster: {
          eventType: impact?.disaster?.eventType,
          eventName: impact?.disaster?.eventName,
          title: impact?.disaster?.title,
          alertLevel: impact?.disaster?.alertLevel,
          severity: impact?.disaster?.severity,
          source: impact?.disaster?.source,
          event_date: impact?.disaster?.event_date
        }
      }))
    }));

  const compactSitrepDisasters = (items = [], maxItems = 100) =>
    (items || []).slice(0, maxItems).map((item) => ({
      eventType: item?.eventType,
      eventName: item?.eventName,
      title: item?.title,
      alertLevel: item?.alertLevel,
      severity: item?.severity,
      country: item?.country,
      latitude: item?.latitude,
      longitude: item?.longitude,
      polygon: Array.isArray(item?.polygon) ? item.polygon.slice(0, 25) : undefined
    }));

  const compactSitrepAcled = (items = [], maxItems = 100) =>
    (items || []).slice(0, maxItems).map((item) => ({
      event_date: item?.event_date,
      event_type: item?.event_type,
      sub_event_type: item?.sub_event_type,
      country: item?.country,
      admin1: item?.admin1,
      admin2: item?.admin2,
      location: item?.location,
      fatalities: item?.fatalities,
      notes: item?.notes ? String(item.notes).slice(0, 160) : null
    }));

  const compactSitrepStatistics = (statistics = null) => {
    if (!statistics) return null;

    return {
      totalDisasters: statistics.totalDisasters,
      totalFacilities: statistics.totalFacilities,
      impactedFacilityCount: statistics.impactedFacilityCount,
      percentageImpacted: statistics.percentageImpacted,
      affectedDistricts: statistics.affectedDistricts,
      estimatedAffectedPopulation: statistics.estimatedAffectedPopulation,
      disasterStats: Array.isArray(statistics.disasterStats)
        ? statistics.disasterStats.slice(0, 25).map((item) => ({
            name: item?.name,
            type: item?.type,
            affectedFacilities: item?.affectedFacilities,
            impactArea: item?.impactArea,
            polygon: item?.polygon,
            source: item?.source
          }))
        : [],
      overlappingImpacts: Array.isArray(statistics.overlappingImpacts)
        ? statistics.overlappingImpacts.slice(0, 15).map((item) => ({
            disasters: Array.isArray(item?.disasters) ? item.disasters.slice(0, 3) : [],
            facilities: Array.isArray(item?.facilities) ? item.facilities.slice(0, 6) : []
          }))
        : []
    };
  };

  const compactSitrepDistricts = (items = [], maxItems = 100) =>
    (items || []).slice(0, maxItems).map((district) => ({
      properties: district?.properties
        ? {
            NAME_0: district.properties.NAME_0,
            ADM0_EN: district.properties.ADM0_EN,
            COUNTRY: district.properties.COUNTRY,
            country: district.properties.country,
            NAME_1: district.properties.NAME_1,
            ADM1_EN: district.properties.ADM1_EN,
            REGION: district.properties.REGION,
            region: district.properties.region,
            NAME_2: district.properties.NAME_2,
            ADM2_EN: district.properties.ADM2_EN,
            DISTRICT: district.properties.DISTRICT,
            district: district.properties.district,
            NAME: district.properties.NAME,
            name: district.properties.name
          }
        : district
    }));

  const compactSitrepWorldPopData = (data = {}, maxEntries = 100) =>
    Object.fromEntries(Object.entries(data || {}).slice(0, maxEntries));

  const compactSitrepOsmData = (data = null, maxFeatures = 250) => {
    const features = data?.features || [];
    if (!features.length) return null;

    return {
      type: 'FeatureCollection',
      metadata: {
        totalFeatures: data?.metadata?.totalFeatures || features.length,
        byLayer: data?.metadata?.byLayer || {},
        requestedLayers: data?.metadata?.requestedLayers || []
      },
      features: features.slice(0, maxFeatures).map((feature) => ({
        geometry: feature?.geometry,
        properties: {
          name: feature?.properties?.name || feature?.properties?.tags?.name || null,
          category: feature?.properties?.category || null,
          priority: feature?.properties?.priority || null,
          tags: {
            name: feature?.properties?.tags?.name || null,
            amenity: feature?.properties?.tags?.amenity || null,
            healthcare: feature?.properties?.tags?.healthcare || null,
            highway: feature?.properties?.tags?.highway || null,
            bridge: feature?.properties?.tags?.bridge || null,
            aeroway: feature?.properties?.tags?.aeroway || null,
            power: feature?.properties?.tags?.power || null
          }
        }
      }))
    };
  };

  // Generate situation report
  const generateSitrep = async (forceRefresh = false) => {
    try {
      // Check cache if not forcing refresh
      if (!forceRefresh && sitrep && sitrepTimestamp) {
        console.log('Using cached sitrep');
        setActiveTab('sitrep');
        return;
      }

      setLoading(prev => ({ ...prev, sitrep: true }));

      const requestBody = JSON.stringify({
        impactedFacilities: compactSitrepImpactedFacilities(impactedFacilities),
        disasters: compactSitrepDisasters(filteredDisasters.length > 0 ? filteredDisasters : disasters),
        dateFilter: dateFilter,
        statistics: compactSitrepStatistics(impactStatistics),
        acledData: acledEnabled ? compactSitrepAcled(acledData) : [],
        osmData: compactSitrepOsmData(osmData),
        worldPopData: compactSitrepWorldPopData(worldPopData),
        worldPopYear: worldPopLastFetch?.year || null,
        districts: compactSitrepDistricts(districtRawData || [])
      });

      console.log(`Sitrep request body size: ${(requestBody.length / 1024).toFixed(2)} KB`);

      const response = await fetch('/api/sitrep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const data = await parseApiResponse(response, 'Situation report');
      setSitrep(data.sitrep || '');
      setSitrepTimestamp(Date.now());

      // Switch to sitrep tab
      setActiveTab('sitrep');
    } catch (error) {
      console.error('Error generating sitrep:', error);
      addToast('Failed to generate situation report. Please try again.', 'error');
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
  // Impact reassessment is triggered automatically by the [disasters] effect above
  const handleRefreshData = () => {
    fetchDisasterData();
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
      reportContent += `# Emergency Response Overview Report\n`;
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
                const data = await parseApiResponse(response, 'Facility recommendations');
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
      downloadWordDocument(reportContent, `Emergency-Response-Overview-${date}`);
      
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      addToast('Failed to generate comprehensive report. Please try again.', 'error');
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
            <title>AI Analysis Report</title>
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
        addToast('Unable to download Word document. Please try again.', 'error');
      }
    }
  };

  return (
    <ErrorBoundary>
    <div className="container">
      <Head>
        <title>Aidstack Disasters - Real-time Disaster Intelligence Platform</title>
        <meta name="description" content="Intelligence for impact workers: Monitor global disasters, assess facility impacts, predict disease outbreaks, and optimize humanitarian operations with AI-powered real-time analysis" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex" />
        <link rel="icon" type="image/svg+xml" href="/images/gdacs/warning.svg" />
        <link rel="canonical" href="https://disasters.aidstack.ai/app" />
      </Head>

      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <main>

        {/* GDACS data unavailable banner */}
        {fetchError && !loading.disasters && (
          <div style={{
            background: '#FEF3C7', border: '1px solid #F59E0B',
            borderRadius: '6px', padding: '10px 16px',
            marginBottom: '8px', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#92400E',
          }}>
            <span>⚠️ Live GDACS data unavailable — disaster map may be empty. Check your connection or try refreshing.</span>
            <button
              onClick={handleRefreshData}
              style={{
                background: '#F59E0B', color: 'white', border: 'none',
                borderRadius: '4px', padding: '4px 10px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginLeft: '12px',
              }}
            >Retry</button>
          </div>
        )}
        <div className="header">
          <h1 style={{
            color: 'var(--aidstack-navy)',
            display: 'flex',
            alignItems: 'center',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '28px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '12px'}}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
              <span>aidstack<span style={{color: 'var(--aidstack-slate-medium)', fontWeight: 500}}>.disasters</span></span>
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--aidstack-slate-medium)',
                letterSpacing: '0.5px',
                fontFamily: "'Inter', sans-serif"
              }}>Intelligence for impact workers</span>
            </div>
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
                backgroundColor: 'var(--aidstack-light-gray)',
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--aidstack-slate-light)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '8px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}>
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                    <line x1="8" y1="2" x2="8" y2="18"></line>
                    <line x1="16" y1="6" x2="16" y2="22"></line>
                  </svg>
                  <span style={{fontWeight: 600, fontSize: '14px', color: 'var(--aidstack-navy)', fontFamily: "'Inter', sans-serif"}}>
                    {filteredDisasters.length} Disasters
                  </span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <span style={{
                    backgroundColor: 'var(--color-error)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif"
                  }}>{filteredDisasters.filter(d =>
                    (d.alertLevel?.toLowerCase() === 'red') ||
                    (d.severity?.toLowerCase()?.includes('extreme')) ||
                    (d.severity?.toLowerCase()?.includes('severe'))).length}</span>

                  <span style={{
                    backgroundColor: 'var(--aidstack-orange)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif"
                  }}>{filteredDisasters.filter(d =>
                    (d.alertLevel?.toLowerCase() === 'orange') ||
                    (d.severity?.toLowerCase()?.includes('moderate'))).length}</span>

                  <span style={{
                    backgroundColor: 'var(--color-success)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif"
                  }}>{filteredDisasters.filter(d =>
                    (d.alertLevel?.toLowerCase() === 'green') ||
                    (d.severity?.toLowerCase()?.includes('minor')) ||
                    (!d.alertLevel && !d.severity)).length}</span>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--aidstack-light-gray)',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid var(--aidstack-slate-light)'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '5px'}}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span style={{fontWeight: 600, fontSize: '14px', color: 'var(--aidstack-navy)', marginRight: '5px', fontFamily: "'Inter', sans-serif"}}>
                  {facilities.length} Facilities:
                </span>
                <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                  <span style={{
                    backgroundColor: 'var(--color-error)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif"
                  }}>{impactedFacilities.length} Impacted</span>

                  <span style={{
                    backgroundColor: 'var(--color-success)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '12px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: "'Inter', sans-serif"
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
                  backgroundColor: loading.disasters ? 'var(--aidstack-slate-light)' : 'var(--aidstack-navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: loading.disasters ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
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
              
              {/* Operational Outlook Button */}
              <button
                onClick={() => setShowOperationalOutlook(true)}
                disabled={!filteredDisasters.length && !impactedFacilities.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: (!filteredDisasters.length && !impactedFacilities.length) ? 'var(--aidstack-slate-light)' : 'var(--aidstack-orange)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: (!filteredDisasters.length && !impactedFacilities.length) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Operational Outlook
              </button>

              {/* Prediction Dashboard Button */}
              <button
                onClick={() => setShowPredictions(true)}
                disabled={!filteredDisasters.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: !filteredDisasters.length ? 'var(--aidstack-slate-light)' : 'var(--aidstack-navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: !filteredDisasters.length ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
                  <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
                  <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                View Forecast
              </button>

              <button
                onClick={() => setShowPrioritizationBoard(true)}
                disabled={!districts.length || !selectedAnalysisDistricts.length}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: (!districts.length || !selectedAnalysisDistricts.length) ? 'var(--aidstack-slate-light)' : '#0f766e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  cursor: (!districts.length || !selectedAnalysisDistricts.length) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M3 3v18h18"></path>
                  <path d="M7 14l4-4 3 3 5-7"></path>
                </svg>
                Prioritization Board
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

        
        {/* Help panel as drawer */}
        <div className={`drawer-backdrop ${showHelp ? 'open' : ''}`} onClick={() => setShowHelp(false)}></div>
        <div
          className={`drawer drawer-right ${showHelp ? 'open' : ''}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            zIndex: 3000
          }}
        >
          <div className="drawer-header" style={{
            background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
            color: 'white',
            margin: '-20px -20px 20px -20px',
            padding: '20px'
          }}>
            <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif"}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Help Guide
            </h3>
            <button className="drawer-close" onClick={() => setShowHelp(false)} style={{color: 'white'}}>×</button>
          </div>
          <div className="drawer-content">
          
          {/* What Is This Tool section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--aidstack-orange)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>What Is This Tool?</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '10px' }}>
              The Disaster Impact Assessment Tool helps organizations monitor their global facilities and assess potential impacts from current natural disasters. It combines real-time disaster data with your facility locations to identify risks and provide AI-powered recommendations.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                onClick={() => {
                  setShowHelp(false);
                  setShowOnboarding(true);
                }}
                style={{
                  background: 'var(--aidstack-orange)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Replay quick start
              </button>
              <a
                href="/landing"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F8FAFC',
                  color: 'var(--aidstack-navy)',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Open landing page
              </a>
            </div>
          </div>
          
          {/* Problems Solved section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--aidstack-orange)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Problems This Tool Solves</h3>
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
            <h3 style={{ fontSize: '16px', color: 'var(--aidstack-orange)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Key Features</h3>
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
            <h3 style={{ fontSize: '16px', color: 'var(--aidstack-orange)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>How To Use This Tool</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>1. Upload Your Facilities</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click the <strong>Facilities</strong> button on the right side of the map. Upload a CSV or Excel file with your facility locations (must include name, latitude, and longitude columns).
              </p>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>2. View Disaster Data</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                The map shows active disasters from global sources. Use the <strong>Filters</strong> button to filter disasters by type and time period.
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
              <h4 style={{ fontSize: '14px', color: 'var(--aidstack-orange)', marginBottom: '5px', fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>7. Operational Outlook</h4>
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#555', marginBottom: '5px' }}>
                Click the <strong>Operational Outlook</strong> button to generate a forward-looking humanitarian analysis. The AI analyzes current signals, identifies humanitarian drivers, describes possible developments (most likely, escalation, and stabilization scenarios), and provides operational implications.
              </p>
            </div>
          </div>
          
          {/* Use Cases section */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--aidstack-orange)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Use Cases</h3>
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
            <h3 style={{ fontSize: '16px', color: 'var(--aidstack-orange)', marginBottom: '10px', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>Pro Tips</h3>
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
                Use the "Operational Outlook" button for forward-looking humanitarian analysis that combines predictions, current signals, humanitarian drivers, possible scenarios, and operational implications
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
            Developed by <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--aidstack-orange)', textDecoration: 'none' }}>John Mark Esplana</a>
          </div>
          </div>
        </div>
        

        <MapComponent
          disasters={filteredDisasters}
          gdacsDiagnostics={gdacsDiagnostics ? {
            ...gdacsDiagnostics,
            filteredTotal: filteredDisasters.length,
            dateFilter
          } : null}
          facilities={facilities}
          impactedFacilities={impactedFacilities}
          impactStatistics={impactStatistics}
          onFacilitySelect={handleFacilitySelect}
          loading={loading.disasters}
          onDrawerState={handleFacilityUpload}
          onGenerateSitrep={generateSitrep}
          sitrepLoading={loading.sitrep}
          sitrep={sitrep}
          sitrepTimestamp={sitrepTimestamp}
          showHelp={showHelp}
          setShowHelp={setShowHelp}
          showChatDrawer={showChatDrawer}
          setShowChatDrawer={setShowChatDrawer}
          dateFilter={dateFilter}
          handleDateFilterChange={handleDateFilterChange}
          aiAnalysisFields={aiAnalysisFields}
          onClearCache={handleClearCache}
          acledData={acledData}
          acledEnabled={acledEnabled}
          acledConfig={acledConfig}
          onAcledUpload={handleAcledUpload}
          onClearAcledCache={handleClearAcledCache}
          onToggleAcled={handleToggleAcled}
          districts={districts}
          onDistrictsLoaded={handleDistrictsLoaded}
          districtAvailableFields={districtAvailableFields}
          districtLabelField={districtLabelField}
          onDistrictLabelFieldChange={handleDistrictLabelFieldChange}
          onAcledConfigChange={handleAcledConfigChange}
          operationType={operationType}
          onOperationTypeChange={setOperationType}
          onDistrictClick={(district) => {
            setSelectedDistrictForForecast(district);
            setShowPredictions(true);
          }}
          onDistrictOutlookClick={(district) => {
            setSelectedDistrictForOutlook(district);
            setShowOperationalOutlook(true);
          }}
          onWorldPopDataChange={(data, fetchParams) => {
            setWorldPopData(data);
            setWorldPopLastFetch(fetchParams);
          }}
          onOSMDataChange={(data) => {
            setOsmData(data);
          }}
          onAnalysisDistrictsChange={setSelectedAnalysisDistricts}
          onEvidenceLayersChange={setEnabledEvidenceLayers}
          selectedAnalysisDistricts={selectedAnalysisDistricts}
          prioritizationBoard={latestPrioritizationBoard}
        />

        {selectedFacility && (
          <RecommendationsPanel
            facility={selectedFacility}
            recommendations={recommendations}
            loading={loading.recommendations}
            isAIGenerated={recommendationsAIGenerated}
          />
        )}

        {/* Prediction Dashboard */}
        {showPredictions && (
          <PredictionDashboard
            facilities={facilities}
            disasters={filteredDisasters}
            districts={districts}
            selectedDistricts={selectedAnalysisDistricts}
            acledData={acledData}
            selectedDistrict={selectedDistrictForForecast}
            worldPopData={worldPopData}
            enabledEvidenceLayers={enabledEvidenceLayers}
            worldPopYear={worldPopLastFetch?.year}
            onClose={() => {
              setShowPredictions(false);
              setSelectedDistrictForForecast(null); // Clear selected district when closing
            }}
          />
        )}

        {/* Operational Outlook Dashboard */}
        {showOperationalOutlook && (
          <OperationalOutlook
            facilities={facilities}
            disasters={filteredDisasters}
            acledData={acledData}
            districts={districts}
            selectedDistrict={selectedDistrictForOutlook}
            worldPopData={worldPopData}
            worldPopYear={worldPopLastFetch?.year}
            osmData={osmData}
            enabledEvidenceLayers={enabledEvidenceLayers}
            onClose={() => {
              setShowOperationalOutlook(false);
              setSelectedDistrictForOutlook(null); // Clear selected district when closing
            }}
          />
        )}

        {showPrioritizationBoard && (
          <PrioritizationBoard
            isOpen={showPrioritizationBoard}
            onClose={() => setShowPrioritizationBoard(false)}
            facilities={facilities}
            impactedFacilities={impactedFacilities}
            disasters={filteredDisasters.length > 0 ? filteredDisasters : disasters}
            acledData={acledEnabled ? acledData : []}
            districts={districts}
            selectedDistricts={selectedAnalysisDistricts}
            worldPopData={worldPopData}
            osmData={osmData}
            operationType={operationType || 'general'}
            enabledEvidenceLayers={enabledEvidenceLayers}
            onBoardLoaded={setLatestPrioritizationBoard}
            onViewFacility={(facility) => {
              setShowPrioritizationBoard(false);
              handleFacilitySelect(facility);
            }}
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
        padding: '12px 20px',
        textAlign: 'center',
        borderTop: '1px solid #eaeaea',
        marginTop: '0',
        marginBottom: '0',
        fontSize: '12px',
        color: '#666',
        backgroundColor: '#fafafa',
        position: 'relative',
        bottom: '-20px'
      }}>
        Created by <a href="https://github.com/jmesplana" target="_blank" rel="noopener noreferrer" style={{ color: '#2196F3', textDecoration: 'none', fontWeight: 'bold' }}>John Mark Esplana</a> | Disaster Impact Assessment Tool
      </footer>
    </div>
    </ErrorBoundary>
  )
}
