import { useMemo } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';

function formatField(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

/**
 * ACLED Conflict Event Markers
 * Visualizes conflict events from ACLED dataset on the map
 */
const AcledMarkers = ({
  acledData = [],
  acledEnabled = false,
  acledConfig = {},
  showClusterCounts = true,
  showClustering = true
}) => {
  // Don't render if ACLED is disabled or no data
  if (!acledEnabled || !acledData || acledData.length === 0) {
    return null;
  }

  // Get date range filter from config (default: last 60 days)
  const dateRange = acledConfig.dateRange || 60;

  // Memoize filtered events to prevent re-computing on every render
  const filteredEvents = useMemo(() => {
    // Find the most recent date in the dataset to use as reference
    const allDates = acledData
      .map(e => new Date(e.event_date))
      .filter(d => !isNaN(d.getTime()));

    const mostRecentDate = allDates.length > 0
      ? new Date(Math.max(...allDates))
      : new Date();

    // Calculate cutoff date from the most recent event in dataset
    const cutoffDate = new Date(mostRecentDate);
    cutoffDate.setDate(cutoffDate.getDate() - dateRange);

    // Get filters from config
    const eventTypeFilter = acledConfig.eventTypes || [];
    const selectedCountries = acledConfig.selectedCountries || [];
    const selectedRegions = acledConfig.selectedRegions || [];

    // Filter ACLED data based on config
    return acledData.filter(event => {
      // Date filter
      const eventDate = new Date(event.event_date);
      if (eventDate < cutoffDate) return false;

      // Event type filter (if specified)
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(event.event_type)) {
        return false;
      }

      // Country filter (if countries are selected)
      if (selectedCountries.length > 0 && !selectedCountries.includes(event.country)) {
        return false;
      }

      // Region filter (if regions are selected)
      if (selectedRegions.length > 0 && !selectedRegions.includes(event.admin1)) {
        return false;
      }

      // Ensure valid coordinates
      if (!event.latitude || !event.longitude) return false;

      return true;
    });
  }, [acledData, dateRange, acledConfig.eventTypes, acledConfig.selectedCountries, acledConfig.selectedRegions]);

  // Log filtering results
  const filterInfo = [];
  filterInfo.push(`${dateRange} days`);
  if (acledConfig.selectedCountries?.length > 0) {
    filterInfo.push(`${acledConfig.selectedCountries.length} countries`);
  }
  if (acledConfig.selectedRegions?.length > 0) {
    filterInfo.push(`${acledConfig.selectedRegions.length} regions`);
  }
  console.log(`ACLED: Filtered ${filteredEvents.length} events from ${acledData.length} total (${filterInfo.join(', ')})`);

  // Color mapping for event types
  const getEventColor = (eventType) => {
    const colors = {
      'Battles': '#d32f2f',                          // Dark red
      'Explosions/Remote violence': '#ff6f00',       // Dark orange
      'Violence against civilians': '#c62828',       // Crimson
      'Protests': '#fbc02d',                         // Yellow
      'Riots': '#f57c00',                            // Amber
      'Strategic developments': '#1976d2'            // Blue
    };
    return colors[eventType] || '#757575'; // Gray for unknown types
  };

  // Get severity icon based on fatalities
  const getSeverityIcon = (fatalities) => {
    if (fatalities >= 50) return '🔴';
    if (fatalities >= 10) return '🟠';
    if (fatalities >= 1) return '🟡';
    return '⚪';
  };

  const renderedMarkers = filteredEvents.map((event, idx) => {
    const lat = parseFloat(event.latitude);
    const lng = parseFloat(event.longitude);

    if (isNaN(lat) || isNaN(lng)) return null;

    const color = getEventColor(event.event_type);
    const fatalities = parseInt(event.fatalities) || 0;
    const severityIcon = getSeverityIcon(fatalities);

    return (
      <CircleMarker
        key={`acled-${event.event_id || idx}`}
        center={[lat, lng]}
        radius={6}
        pathOptions={{
          color: 'white',
          fillColor: color,
          fillOpacity: 0.7,
          weight: 2
        }}
      >
        <Popup maxWidth={460}>
          <div style={{ minWidth: '320px', maxWidth: '460px' }}>
            <div style={{
              background: color,
              color: 'white',
              padding: '8px 12px',
              margin: '-10px -10px 10px -10px',
              borderRadius: '4px 4px 0 0',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              {severityIcon} {event.event_type}
            </div>

            <div style={{ fontSize: '13px', lineHeight: '1.5', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              <p style={{ margin: '5px 0' }}>
                <strong>Date:</strong> {event.event_date}
              </p>

              <p style={{ margin: '5px 0' }}>
                <strong>Location:</strong> {event.location}
                {event.admin1 && `, ${event.admin1}`}
                {event.admin2 && `, ${event.admin2}`}
                {event.admin3 && `, ${event.admin3}`}
                {event.country && ` (${event.country})`}
              </p>

              {event.sub_event_type && (
                <p style={{ margin: '5px 0' }}>
                  <strong>Type:</strong> {event.sub_event_type}
                </p>
              )}

              {event.actor1 && (
                <p style={{ margin: '5px 0' }}>
                  <strong>Actor 1:</strong> {event.actor1}
                </p>
              )}

              {event.actor2 && event.actor2 !== 'Civilians' && (
                <p style={{ margin: '5px 0' }}>
                  <strong>Actor 2:</strong> {event.actor2}
                </p>
              )}

              {event.event_id && (
                <p style={{ margin: '5px 0' }}>
                  <strong>Event ID:</strong> {event.event_id}
                </p>
              )}

              {fatalities > 0 && (
                <p style={{
                  margin: '8px 0',
                  padding: '6px',
                  background: '#ffebee',
                  borderRadius: '4px',
                  color: '#c62828',
                  fontWeight: 'bold'
                }}>
                  <strong>Fatalities:</strong> {fatalities}
                </p>
              )}

              {event.notes && (
                <div style={{
                  margin: '8px 0',
                  fontSize: '12px',
                  color: '#4b5563',
                  borderTop: '1px solid #e0e0e0',
                  paddingTop: '8px'
                }}>
                  <strong>Details:</strong>
                  <div style={{
                    marginTop: '6px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}>
                    {formatField(event.notes)}
                  </div>
                </div>
              )}

              {event.source && (
                <div style={{
                  margin: '5px 0',
                  fontSize: '11px',
                  color: '#6b7280'
                }}>
                  <strong>Source:</strong>
                  <div style={{
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {formatField(event.source)}
                  </div>
                </div>
              )}

              <p style={{
                margin: '8px 0 0 0',
                fontSize: '11px',
                color: '#999',
                borderTop: '1px solid #e0e0e0',
                paddingTop: '6px'
              }}>
                <strong>Coordinates:</strong> {lat.toFixed(4)}, {lng.toFixed(4)}
              </p>
            </div>
          </div>
        </Popup>
      </CircleMarker>
    );
  });

  if (!showClustering) {
    return <>{renderedMarkers}</>;
  }

  return (
    <MarkerClusterGroup
      showCoverageOnHover={false}
      maxClusterRadius={showClusterCounts ? 50 : 20}
      iconCreateFunction={(cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
        const dimension = showClusterCounts
          ? (size === 'small' ? '30px' : size === 'medium' ? '40px' : '50px')
          : '14px';

        return L.divIcon({
          html: `<div style="
            background: rgba(211, 47, 47, 0.8);
            color: white;
            border-radius: 50%;
            width: ${dimension};
            height: ${dimension};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: ${size === 'small' ? '12px' : size === 'medium' ? '14px' : '16px'};
            border: ${showClusterCounts ? '2px solid white' : '1.5px solid white'};
            box-shadow: ${showClusterCounts ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.2)'};
          ">${showClusterCounts ? count : ''}</div>`,
          className: 'acled-cluster',
          iconSize: [parseInt(dimension), parseInt(dimension)]
        });
      }}
    >
      {renderedMarkers}
    </MarkerClusterGroup>
  );
};

export default AcledMarkers;
