import { isPointInDistricts } from './districtRiskScoring';
import { format, subDays, startOfDay, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Filter any dataset to only include records within selected district polygons
 */
export function filterToDistricts(data, districts, latitudeKey = 'latitude', longitudeKey = 'longitude') {
  if (!Array.isArray(data) || !Array.isArray(districts) || districts.length === 0) {
    return Array.isArray(data) ? data : [];
  }

  return data.filter((item) => {
    const latitude = toNumber(item?.[latitudeKey]);
    const longitude = toNumber(item?.[longitudeKey]);

    if (latitude === null || longitude === null) return false;
    return isPointInDistricts(latitude, longitude, districts);
  });
}

/**
 * Aggregate ACLED data by time period for selected districts
 */
export function aggregateAcledByTime(acledData = [], districts = [], granularity = 'daily', timeWindowDays = 30) {
  if (!Array.isArray(acledData) || acledData.length === 0) return null;
  if (!Array.isArray(districts) || districts.length === 0) return null;

  // Filter ACLED to selected districts
  const filteredAcled = filterToDistricts(acledData, districts);
  if (filteredAcled.length === 0) return null;

  // Parse dates and filter to date range
  const end = new Date();
  const start = subDays(end, timeWindowDays);

  const eventsInRange = filteredAcled
    .filter((event) => {
      if (!event.event_date) return false;
      const eventDate = new Date(event.event_date);
      return eventDate >= start && eventDate <= end;
    })
    .map((event) => ({
      ...event,
      parsedDate: new Date(event.event_date)
    }));

  if (eventsInRange.length === 0) return null;

  // Aggregate by granularity
  const intervals = granularity === 'daily'
    ? eachDayOfInterval({ start, end })
    : eachWeekOfInterval({ start, end });

  const aggregated = intervals.map((date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const eventsForPeriod = eventsInRange.filter((event) => {
      if (granularity === 'daily') {
        return format(event.parsedDate, 'yyyy-MM-dd') === dateStr;
      } else {
        const weekStart = startOfDay(date);
        const weekEnd = startOfDay(new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000));
        return event.parsedDate >= weekStart && event.parsedDate < weekEnd;
      }
    });

    const eventTypes = {};
    let fatalities = 0;

    eventsForPeriod.forEach((event) => {
      const type = event.event_type || 'Unknown';
      eventTypes[type] = (eventTypes[type] || 0) + 1;
      fatalities += toNumber(event.fatalities) || 0;
    });

    return {
      date: dateStr,
      count: eventsForPeriod.length,
      fatalities,
      eventTypes,
      label: granularity === 'daily' ? format(date, 'MMM d') : format(date, 'MMM d')
    };
  });

  return aggregated;
}

/**
 * Aggregate disasters by time period for selected districts
 */
export function aggregateDisastersByTime(disasters = [], districts = [], granularity = 'weekly') {
  if (!Array.isArray(disasters) || disasters.length === 0) return null;
  if (!Array.isArray(districts) || districts.length === 0) return null;

  // Filter disasters to selected districts
  const filteredDisasters = filterToDistricts(disasters, districts);
  if (filteredDisasters.length === 0) return null;

  // Group by date
  const disastersByDate = {};

  filteredDisasters.forEach((disaster) => {
    const date = disaster.fromdate || disaster.todate || disaster.pubDate;
    if (!date) return;

    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    if (!disastersByDate[dateStr]) {
      disastersByDate[dateStr] = [];
    }
    disastersByDate[dateStr].push(disaster);
  });

  // Convert to timeline format
  const timeline = Object.keys(disastersByDate)
    .sort()
    .map((dateStr) => ({
      date: dateStr,
      count: disastersByDate[dateStr].length,
      disasters: disastersByDate[dateStr],
      label: format(new Date(dateStr), 'MMM d')
    }));

  return timeline;
}

/**
 * Calculate facility risk trends over time
 */
export function calculateFacilityRiskTrends(facilities = [], disasters = [], acledData = [], districts = [], timeWindowDays = 30) {
  if (!Array.isArray(facilities) || facilities.length === 0) return null;
  if (!Array.isArray(districts) || districts.length === 0) return null;

  // Filter facilities to selected districts
  const filteredFacilities = filterToDistricts(facilities, districts);
  if (filteredFacilities.length === 0) return null;

  // For simplicity, we'll create a snapshot-based risk calculation
  // In a real system, this would calculate historical risk scores
  const end = new Date();
  const start = subDays(end, timeWindowDays);
  const intervals = eachDayOfInterval({ start, end });

  // Calculate risk distribution (simplified - just using current state)
  const riskDistribution = {
    high: filteredFacilities.filter(f => f.riskLevel === 'high' || f.risk_level === 'high').length,
    medium: filteredFacilities.filter(f => f.riskLevel === 'medium' || f.risk_level === 'medium').length,
    low: filteredFacilities.filter(f => f.riskLevel === 'low' || f.risk_level === 'low').length,
    unassessed: filteredFacilities.filter(f => !f.riskLevel && !f.risk_level).length
  };

  // Generate daily snapshots (in real implementation, this would be based on historical data)
  const daily = intervals.map((date) => {
    return {
      date: format(date, 'yyyy-MM-dd'),
      high: riskDistribution.high,
      medium: riskDistribution.medium,
      low: riskDistribution.low,
      unassessed: riskDistribution.unassessed,
      label: format(date, 'MMM d')
    };
  });

  return {
    daily,
    riskDistribution,
    totalFacilities: filteredFacilities.length
  };
}

/**
 * Calculate week-over-week percentage change
 */
export function calculateWeekOverWeek(currentData, previousData) {
  if (!currentData || !previousData) return null;
  if (currentData === 0 && previousData === 0) return 0;
  if (previousData === 0) return 100;

  const change = ((currentData - previousData) / previousData) * 100;
  return Math.round(change);
}

/**
 * Calculate district-level comparison metrics
 * @param {Array} districts - Districts to compare
 * @param {Array} facilities - Facilities data
 * @param {Array} acledData - ACLED data
 * @param {Array} disasters - Disasters data
 * @param {number} timeWindowDays - Time window in days (default: all time if not specified)
 */
export function calculateDistrictComparison(districts = [], facilities = [], acledData = [], disasters = [], timeWindowDays = null) {
  if (!Array.isArray(districts) || districts.length === 0) return [];

  // Calculate date range if time window specified
  const end = new Date();
  const start = timeWindowDays ? subDays(end, timeWindowDays) : null;

  return districts.map((district, index) => {
    // Filter data to this specific district
    const districtFacilities = filterToDistricts(facilities, [district]);
    let districtAcled = filterToDistricts(acledData, [district]);
    const districtDisasters = filterToDistricts(disasters, [district]);

    // Apply time window filter to ACLED if specified
    if (start && districtAcled.length > 0) {
      districtAcled = districtAcled.filter((event) => {
        if (!event.event_date) return false;
        const eventDate = new Date(event.event_date);
        return eventDate >= start && eventDate <= end;
      });
    }

    // Calculate risk score (0-10) based on threats and exposure
    let riskScore = 0;

    // Disaster risk (0-4 points)
    if (districtDisasters.length >= 3) riskScore += 4;
    else if (districtDisasters.length >= 2) riskScore += 3;
    else if (districtDisasters.length >= 1) riskScore += 2;

    // ACLED security risk (0-5 points) - scaled by event count
    if (districtAcled.length >= 200) riskScore += 5;
    else if (districtAcled.length >= 100) riskScore += 4;
    else if (districtAcled.length >= 50) riskScore += 3.5;
    else if (districtAcled.length >= 20) riskScore += 2.5;
    else if (districtAcled.length >= 10) riskScore += 1.5;
    else if (districtAcled.length >= 5) riskScore += 1;

    // Facility exposure risk (0-1 point) - more facilities = more exposure
    if (districtFacilities.length >= 50) riskScore += 1;
    else if (districtFacilities.length >= 20) riskScore += 0.5;

    riskScore = Math.min(10, riskScore);

    const districtName = district.properties?.ADM2_EN
      || district.properties?.NAME_2
      || district.properties?.NAME
      || district.properties?.name
      || district.name
      || `District ${index + 1}`;

    return {
      district: districtName,
      facilities: districtFacilities.length,
      acledEvents: districtAcled.length,
      disasters: districtDisasters.length,
      riskScore: riskScore.toFixed(1)
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Get summary metrics for selected area
 */
export function getSummaryMetrics(districts = [], facilities = [], acledData = [], disasters = [], timeWindowDays = 30) {
  const end = new Date();
  const start = subDays(end, timeWindowDays);
  const previousStart = subDays(start, timeWindowDays);

  // Filter all data to districts
  const filteredFacilities = filterToDistricts(facilities, districts);
  const filteredAcled = filterToDistricts(acledData, districts);
  const filteredDisasters = filterToDistricts(disasters, districts);

  // Calculate current period counts
  const currentAcled = filteredAcled.filter((event) => {
    if (!event.event_date) return false;
    const eventDate = new Date(event.event_date);
    return eventDate >= start && eventDate <= end;
  }).length;

  // Calculate previous period counts
  const previousAcled = filteredAcled.filter((event) => {
    if (!event.event_date) return false;
    const eventDate = new Date(event.event_date);
    return eventDate >= previousStart && eventDate < start;
  }).length;

  const acledChange = calculateWeekOverWeek(currentAcled, previousAcled);

  const districtNames = districts.map((d, i) =>
    d.properties?.ADM2_EN
    || d.properties?.NAME_2
    || d.properties?.NAME
    || d.properties?.name
    || d.name
    || `District ${i + 1}`
  );

  return {
    selectedArea: districtNames.length <= 3
      ? districtNames.join(', ')
      : `${districtNames.slice(0, 2).join(', ')} +${districtNames.length - 2} more`,
    districtCount: districts.length,
    timeWindow: `${timeWindowDays} days`,
    dataAvailable: {
      acled: filteredAcled.length > 0,
      facilities: filteredFacilities.length > 0,
      disasters: filteredDisasters.length > 0
    },
    currentPeriod: {
      acledEvents: currentAcled,
      facilities: filteredFacilities.length,
      disasters: filteredDisasters.length
    },
    trends: {
      acledChange
    }
  };
}

/**
 * Build ACLED detail metrics for the selected districts and time window.
 */
export function getAcledDetailMetrics(districts = [], acledData = [], timeWindowDays = 30) {
  if (!Array.isArray(districts) || districts.length === 0) return null;
  if (!Array.isArray(acledData) || acledData.length === 0) return null;

  const end = new Date();
  const start = subDays(end, timeWindowDays);

  const filteredAcled = filterToDistricts(acledData, districts);
  if (filteredAcled.length === 0) return null;

  const eventsInRange = filteredAcled
    .filter((event) => {
      if (!event.event_date) return false;
      const eventDate = new Date(event.event_date);
      return eventDate >= start && eventDate <= end;
    })
    .map((event) => ({
      ...event,
      parsedDate: new Date(event.event_date),
      fatalities: toNumber(event.fatalities) || 0
    }))
    .sort((a, b) => b.parsedDate - a.parsedDate);

  if (eventsInRange.length === 0) return null;

  const typeCounts = {};
  const districtCounts = {};
  const districtFatalities = {};
  const actorCounts = {};
  let totalFatalities = 0;

  eventsInRange.forEach((event) => {
    const eventType = event.event_type || 'Unknown';
    const districtName = event.admin2 || event.admin1 || event.country || 'Unknown';
    const actorName = event.actor1 || 'Unknown';

    typeCounts[eventType] = (typeCounts[eventType] || 0) + 1;
    districtCounts[districtName] = (districtCounts[districtName] || 0) + 1;
    districtFatalities[districtName] = (districtFatalities[districtName] || 0) + event.fatalities;
    actorCounts[actorName] = (actorCounts[actorName] || 0) + 1;
    totalFatalities += event.fatalities;
  });

  const topEventTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topDistrictsByCount = Object.entries(districtCounts)
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topDistrictsByFatalities = Object.entries(districtFatalities)
    .map(([district, fatalities]) => ({ district, fatalities }))
    .sort((a, b) => b.fatalities - a.fatalities)
    .slice(0, 5);

  const topActors = Object.entries(actorCounts)
    .map(([actor, count]) => ({ actor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const mostCommonEventType = topEventTypes[0]?.type || 'Unknown';
  const mostAffectedDistrict = topDistrictsByCount[0]?.district || 'Unknown';

  return {
    totalEvents: eventsInRange.length,
    totalFatalities,
    mostCommonEventType,
    mostAffectedDistrict,
    topEventTypes,
    topDistrictsByCount,
    topDistrictsByFatalities,
    topActors,
    recentEvents: eventsInRange.slice(0, 8)
  };
}
