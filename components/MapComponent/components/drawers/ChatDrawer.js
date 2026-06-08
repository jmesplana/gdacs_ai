import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const CHAT_DRAWER_WIDTH = 420;
const CHAT_DRAWER_EXPANDED_WIDTH = 1040;
const CHAT_ATTACHMENT_CONTEXT_ROWS = 20;
const CHAT_ATTACHMENT_CONTEXT_COLUMNS = 20;
const CHAT_ATTACHMENT_MAX_ROWS_RETAINED = 5000;
const CHAT_DOCUMENT_CONTEXT_CHUNKS = 6;
const CHAT_PDF_BROWSER_MAX_BYTES = 50 * 1024 * 1024;
const CHAT_DOCUMENT_MAX_TEXT_CHARS = 60000;
const CHAT_DOCUMENT_CHUNK_SIZE = 2200;
const CHAT_DOCUMENT_MAX_CHUNKS = 12;

function isDocumentAttachment(fileName = '') {
  const lowerName = fileName.toLowerCase();
  return lowerName.endsWith('.pdf') || lowerName.endsWith('.docx');
}

function compactWorldPopDataForChat(worldPopData = {}, maxEntries = 50) {
  const entries = Object.entries(worldPopData || {}).slice(0, maxEntries);
  return Object.fromEntries(entries);
}

function truncateText(value, maxLength = 500) {
  if (value === null || value === undefined) return value;
  const stringValue = String(value);
  return stringValue.length > maxLength
    ? `${stringValue.slice(0, maxLength - 3)}...`
    : stringValue;
}

function compactValue(value, maxLength = 120) {
  if (value === null || value === undefined) return '';
  return truncateText(String(value).replace(/\s+/g, ' ').trim(), maxLength);
}

function normalizeDocumentText(text = '') {
  return String(text)
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function chunkDocumentText(text = '') {
  const chunks = [];
  let offset = 0;

  while (offset < text.length && chunks.length < CHAT_DOCUMENT_MAX_CHUNKS) {
    const targetEnd = Math.min(offset + CHAT_DOCUMENT_CHUNK_SIZE, text.length);
    const nextBreak = text.lastIndexOf('\n\n', targetEnd);
    const end = nextBreak > offset + 800 ? nextBreak : targetEnd;
    const content = text.slice(offset, end).trim();

    if (content) {
      chunks.push({
        index: chunks.length + 1,
        text: content
      });
    }

    offset = end;
  }

  return chunks;
}

function getDocumentStats(text = '', metadata = {}) {
  const words = text.match(/\S+/g) || [];
  return {
    characterCount: text.length,
    wordCount: words.length,
    pageCount: Number.isFinite(metadata.pageCount) ? metadata.pageCount : null,
    parsedPageCount: Number.isFinite(metadata.parsedPageCount) ? metadata.parsedPageCount : null,
    truncated: Boolean(metadata.truncated),
    truncatedPages: Boolean(metadata.truncatedPages)
  };
}

function normalizeTabularRows(rows = []) {
  return (rows || [])
    .map((row) => Object.fromEntries(
      Object.entries(row || {}).map(([key, value]) => [String(key).trim(), value])
    ))
    .filter((row) => Object.values(row).some((value) => compactValue(value) !== ''));
}

function getAttachmentColumns(rows = []) {
  const columns = [];
  const seen = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });
  return columns;
}

function inferAttachmentMappings(columns = []) {
  const findColumn = (patterns) => columns.find((column) => {
    const normalized = column.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return patterns.some((pattern) => pattern.test(normalized));
  }) || null;

  return {
    latitude: findColumn([/^lat$/, /latitude/, /y_coord/, /gps_lat/]),
    longitude: findColumn([/^lon$/, /^lng$/, /longitude/, /x_coord/, /gps_lon/, /gps_lng/]),
    name: findColumn([/^name$/, /site_name/, /community/, /location_name/, /facility_name/, /settlement/]),
    admin1: findColumn([/^admin1$/, /admin_?1/, /province/, /region/, /state/]),
    admin2: findColumn([/^admin2$/, /admin_?2/, /district/, /county/, /health_zone/]),
    date: findColumn([/report_date/, /date_reported/, /onset_date/, /^date$/]),
    disease: findColumn([/disease/, /syndrome/, /vpd/, /condition/]),
    status: findColumn([/status/, /verification/, /response_status/])
  };
}

function summarizeAttachmentColumns(rows = [], columns = []) {
  return columns.slice(0, 40).map((column) => {
    const values = rows
      .map((row) => row?.[column])
      .filter((value) => compactValue(value) !== '');
    const numericCount = values.filter((value) => Number.isFinite(Number(value))).length;
    const uniqueValues = Array.from(new Set(values.map((value) => compactValue(value, 80)))).slice(0, 6);

    return {
      name: column,
      filledRows: values.length,
      likelyNumeric: values.length > 0 && numericCount / values.length >= 0.8,
      examples: uniqueValues
    };
  });
}

function compactRowsForAttachment(rows = [], maxRows = 80, maxColumns = 35) {
  const columns = getAttachmentColumns(rows).slice(0, maxColumns);
  return rows.slice(0, maxRows).map((row) => Object.fromEntries(
    columns.map((column) => [column, compactValue(row?.[column])])
  ));
}

async function parseDocumentAttachment(file) {
  const lowerName = (file.name || '').toLowerCase();

  if (lowerName.endsWith('.pdf')) {
    if (file.size > CHAT_PDF_BROWSER_MAX_BYTES) {
      throw new Error('PDF uploads are limited to 50 MB for browser-based parsing.');
    }

    const { extractPdfTextInBrowser } = await import('../../../../lib/clientPdfText');
    const extracted = await extractPdfTextInBrowser(await file.arrayBuffer());
    const normalizedText = normalizeDocumentText(extracted.text);

    if (!normalizedText) {
      throw new Error('No readable text could be extracted from this PDF. Scanned PDFs may need OCR before upload.');
    }

    const truncated = normalizedText.length > CHAT_DOCUMENT_MAX_TEXT_CHARS;
    const retainedText = truncated
      ? normalizedText.slice(0, CHAT_DOCUMENT_MAX_TEXT_CHARS).trim()
      : normalizedText;

    return {
      id: `${Date.now()}-${file.name || 'attached-document'}`,
      fileName: file.name || 'attached-document',
      fileType: 'pdf',
      attachmentKind: 'document',
      rowCount: 0,
      retainedRowCount: 0,
      columns: [],
      mappings: {},
      columnSummary: [],
      sampleRows: [],
      rows: [],
      documentStats: getDocumentStats(retainedText, {
        pageCount: extracted.pageCount,
        parsedPageCount: extracted.parsedPageCount,
        truncated,
        truncatedPages: extracted.truncatedPages
      }),
      documentChunks: chunkDocumentText(retainedText),
      createdAt: new Date().toISOString(),
      promoteCandidate: false
    };
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/parse-document', {
    method: 'POST',
    body: formData
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to parse that document.');
  }

  const documentChunks = Array.isArray(payload.documentChunks)
    ? payload.documentChunks
    : [];

  return {
    id: `${Date.now()}-${payload.fileName || file.name || 'attached-document'}`,
    fileName: payload.fileName || file.name || 'attached-document',
    fileType: payload.fileType || (file.name?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'),
    attachmentKind: 'document',
    rowCount: 0,
    retainedRowCount: 0,
    columns: [],
    mappings: {},
    columnSummary: [],
    sampleRows: [],
    rows: [],
    documentStats: payload.documentStats || {},
    documentChunks,
    createdAt: new Date().toISOString(),
    promoteCandidate: false
  };
}

function getGeoJsonRows(geojson = {}) {
  const features = Array.isArray(geojson.features) ? geojson.features : [];
  return features.map((feature, index) => {
    const props = feature.properties || {};
    const geometry = feature.geometry || {};
    const row = {
      feature_id: props.id || feature.id || index + 1,
      geometry_type: geometry.type || '',
      ...props
    };

    if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
      row.longitude = geometry.coordinates[0];
      row.latitude = geometry.coordinates[1];
    }

    return row;
  });
}

async function parseChatAttachment(file) {
  const fileName = file.name || 'attached-file';
  const lowerName = fileName.toLowerCase();
  let rows = [];
  let fileType = 'table';

  if (isDocumentAttachment(fileName)) {
    return parseDocumentAttachment(file);
  }

  if (lowerName.endsWith('.csv')) {
    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });
    if (parsed.errors?.length) {
      throw new Error(parsed.errors[0].message || 'Unable to parse CSV file.');
    }
    rows = normalizeTabularRows(parsed.data);
    fileType = 'csv';
  } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    rows = normalizeTabularRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
    fileType = lowerName.endsWith('.xls') ? 'xls' : 'xlsx';
  } else if (lowerName.endsWith('.geojson') || lowerName.endsWith('.json')) {
    const parsed = JSON.parse(await file.text());
    if (parsed.type === 'FeatureCollection') {
      rows = normalizeTabularRows(getGeoJsonRows(parsed));
      fileType = 'geojson';
    } else if (Array.isArray(parsed)) {
      rows = normalizeTabularRows(parsed);
      fileType = 'json';
    } else {
      rows = normalizeTabularRows([parsed]);
      fileType = 'json';
    }
  } else {
    throw new Error('Upload a CSV, Excel, JSON, GeoJSON, PDF, or Word document (.docx).');
  }

  const retainedRows = rows.slice(0, CHAT_ATTACHMENT_MAX_ROWS_RETAINED);
  const columns = getAttachmentColumns(retainedRows);
  const mappings = inferAttachmentMappings(columns);

  return {
    id: `${Date.now()}-${fileName}`,
    fileName,
    fileType,
    attachmentKind: 'dataset',
    rowCount: rows.length,
    retainedRowCount: retainedRows.length,
    columns,
    mappings,
    columnSummary: summarizeAttachmentColumns(retainedRows, columns),
    sampleRows: compactRowsForAttachment(retainedRows, 8, CHAT_ATTACHMENT_CONTEXT_COLUMNS),
    rows: retainedRows,
    createdAt: new Date().toISOString(),
    promoteCandidate: Boolean(mappings.latitude && mappings.longitude)
  };
}

function compactChatAttachmentsForContext(attachments = []) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    attachmentKind: attachment.attachmentKind || 'dataset',
    rowCount: attachment.rowCount,
    retainedRowCount: attachment.retainedRowCount,
    columns: (attachment.columns || []).slice(0, 80),
    mappings: attachment.mappings,
    columnSummary: attachment.columnSummary,
    sampleRows: attachment.sampleRows,
    rows: compactRowsForAttachment(
      attachment.rows || [],
      CHAT_ATTACHMENT_CONTEXT_ROWS,
      CHAT_ATTACHMENT_CONTEXT_COLUMNS
    ),
    documentStats: attachment.documentStats || null,
    documentChunks: Array.isArray(attachment.documentChunks)
      ? attachment.documentChunks.slice(0, CHAT_DOCUMENT_CONTEXT_CHUNKS)
      : [],
    promoteCandidate: attachment.promoteCandidate
  }));
}

function compactPrioritizationBoardForChat(board = null, maxRows = 10) {
  if (!board?.districtRows?.length) return null;

  return {
    summary: board.summary
      ? {
          selectedAreaCount: board.summary.selectedAreaCount,
          totalFacilities: board.summary.totalFacilities,
          urgentFacilities: board.summary.urgentFacilities,
          highFacilities: board.summary.highFacilities,
          impactedFacilities: board.summary.impactedFacilities,
          totalDisasters: board.summary.totalDisasters,
          totalAcledEvents: board.summary.totalAcledEvents,
          districtCount: board.summary.districtCount,
          hasFacilityData: board.summary.hasFacilityData,
          districtHazardSummary: board.summary.districtHazardSummary || null,
          confidence: board.summary.confidence
        }
      : null,
    districtRows: board.districtRows.slice(0, maxRows).map((row) => ({
      rank: row.rank,
      district: row.district,
      priorityScore: row.priorityScore,
      priorityLevel: row.priorityLevel,
      posture: row.posture,
      recommendedAction: row.recommendedAction,
      populationEstimate: row.populationEstimate,
      disasterCount: row.disasterCount,
      acledCount: row.acledCount,
      projectedHazardType: row.projectedHazardType,
      projectedHazardScore: row.projectedHazardScore,
      projectedHazardLevel: row.projectedHazardLevel,
      projectedResponseScale: row.projectedResponseScale,
      projectedConfidence: row.projectedConfidence,
      projectedEvidenceBase: row.projectedEvidenceBase,
      projectedTopDrivers: Array.isArray(row.projectedTopDrivers)
        ? row.projectedTopDrivers.slice(0, 3).map((driver) => ({
            label: driver?.label,
            value: driver?.value,
            unit: driver?.unit,
            source: driver?.source
          }))
        : [],
      hazardReadinessGaps: Array.isArray(row.hazardReadinessGaps) ? row.hazardReadinessGaps.slice(0, 3) : [],
      keyGaps: Array.isArray(row.keyGaps) ? row.keyGaps.slice(0, 4) : [],
      soWhat: truncateText(row.soWhat, 300),
      leadershipNote: truncateText(row.leadershipNote, 240),
      recentContext: truncateText(row.recentContext, 280)
    }))
  };
}

function compactImpactedFacilitiesForChat(items = [], maxItems = 20) {
  return (items || []).slice(0, maxItems).map((item) => ({
    facility: {
      name: item?.facility?.name,
      latitude: item?.facility?.latitude,
      longitude: item?.facility?.longitude,
      type: item?.facility?.type || item?.facility?.facilityType
    },
    impacts: (item?.impacts || []).slice(0, 5).map((impact) => ({
      distance: impact?.distance,
      impactMethod: impact?.impactMethod,
      confidence: impact?.confidence,
      disaster: {
        eventType: impact?.disaster?.eventType,
        eventName: impact?.disaster?.eventName,
        title: impact?.disaster?.title,
        alertLevel: impact?.disaster?.alertLevel,
        severity: impact?.disaster?.severity
      }
    }))
  }));
}

function compactDisastersForChat(items = [], maxItems = 20) {
  return (items || []).slice(0, maxItems).map((item) => ({
    eventType: item?.eventType,
    eventName: item?.eventName,
    title: item?.title,
    alertLevel: item?.alertLevel,
    severity: item?.severity,
    country: item?.country,
    latitude: item?.latitude,
    longitude: item?.longitude
  }));
}

function compactAcledDataForChat(items = [], { maxItems = 30, includeDetails = false } = {}) {
  return (items || []).slice(0, maxItems).map((item) => ({
    event_id: item?.event_id,
    event_date: item?.event_date,
    event_type: item?.event_type,
    sub_event_type: item?.sub_event_type,
    country: item?.country,
    admin1: item?.admin1,
    admin2: item?.admin2,
    admin3: item?.admin3,
    location: item?.location,
    latitude: item?.latitude,
    longitude: item?.longitude,
    fatalities: item?.fatalities,
    ...(includeDetails ? {
      actor1: truncateText(item?.actor1, 200),
      actor2: truncateText(item?.actor2, 200),
      notes: truncateText(item?.notes, 1200),
      source: truncateText(item?.source, 300)
    } : {})
  }));
}

function compactImpactStatisticsForChat(statistics = null, maxDisasterStats = 20, maxOverlapStats = 10) {
  if (!statistics) return null;

  return {
    facilitiesImpacted: statistics.facilitiesImpacted ?? statistics.impactedFacilityCount ?? 0,
    impactedFacilityCount: statistics.impactedFacilityCount ?? statistics.facilitiesImpacted ?? 0,
    totalImpacts: statistics.totalImpacts ?? 0,
    totalDisasters: statistics.totalDisasters ?? 0,
    totalFacilities: statistics.totalFacilities ?? 0,
    percentageImpacted: statistics.percentageImpacted ?? null,
    affectedDistricts: statistics.affectedDistricts ?? null,
    estimatedAffectedPopulation: statistics.estimatedAffectedPopulation ?? null,
    byDisasterType: statistics.byDisasterType || null,
    disasterStats: Array.isArray(statistics.disasterStats)
      ? statistics.disasterStats.slice(0, maxDisasterStats).map((item) => ({
          type: item?.type,
          alertLevel: item?.alertLevel,
          name: item?.name,
          affectedFacilities: item?.affectedFacilities,
          impactArea: item?.impactArea,
          severity: item?.severity,
          source: item?.source
        }))
      : [],
    overlappingImpacts: Array.isArray(statistics.overlappingImpacts)
      ? statistics.overlappingImpacts.slice(0, maxOverlapStats).map((item) => ({
          disasters: Array.isArray(item?.disasters) ? item.disasters.slice(0, 3) : [],
          facilities: Array.isArray(item?.facilities) ? item.facilities.slice(0, 5) : []
        }))
      : []
  };
}

function compactDistrictsForWorldPopForChat(items = [], maxItems = 100) {
  return (items || []).slice(0, maxItems).map((item) => ({
    id: item?.id,
    name: item?.name,
    country: item?.country,
    region: item?.region
  }));
}

function compactSelectedFacilityForChat(facility = null) {
  if (!facility) return null;

  return {
    name: facility.name,
    latitude: facility.latitude,
    longitude: facility.longitude,
    type: facility.type || facility.facilityType,
    country: facility.country,
    region: facility.region,
    district: facility.district
  };
}

function compactOsmDataForChat(osmData = null, maxFeatures = 250) {
  const features = osmData?.features || [];
  if (!features.length) return null;

  const prioritized = [...features].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityA = priorityOrder[a?.properties?.priority] ?? 9;
    const priorityB = priorityOrder[b?.properties?.priority] ?? 9;
    return priorityA - priorityB;
  });

  return {
    type: 'FeatureCollection',
    metadata: {
      totalFeatures: osmData?.metadata?.totalFeatures || features.length,
      byLayer: osmData?.metadata?.byLayer || {},
      requestedLayers: osmData?.metadata?.requestedLayers || []
    },
    features: prioritized.slice(0, maxFeatures).map((feature) => ({
      geometry: feature.geometry,
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
          power: feature?.properties?.tags?.power || null,
          man_made: feature?.properties?.tags?.man_made || null,
          natural: feature?.properties?.tags?.natural || null,
          'addr:district': feature?.properties?.tags?.['addr:district'] || null,
          'addr:city': feature?.properties?.tags?.['addr:city'] || null
        }
      }
    }))
  };
}

function compactChatContext(context = {}, detailLevel = 'compact') {
  const includeAcledDetails = detailLevel === 'deep';
  const acledSource = includeAcledDetails
    ? (context.acledDeepPool || context.acledData)
    : context.acledData;

  return {
    ...context,
    selectedFacility: compactSelectedFacilityForChat(context.selectedFacility),
    acledData: compactAcledDataForChat(acledSource, {
      maxItems: includeAcledDetails ? 20 : 30,
      includeDetails: includeAcledDetails
    }),
    ...(includeAcledDetails ? {
      acledDeepPool: compactAcledDataForChat(context.acledDeepPool || context.acledData, {
        maxItems: 120,
        includeDetails: true
      })
    } : {}),
    disasters: compactDisastersForChat(context.disasters),
    impactStatistics: compactImpactStatisticsForChat(context.impactStatistics),
    impactedFacilities: compactImpactedFacilitiesForChat(context.impactedFacilities),
    districtsForWorldPop: compactDistrictsForWorldPopForChat(context.districtsForWorldPop),
    worldPopData: compactWorldPopDataForChat(context.worldPopData),
    osmData: compactOsmDataForChat(context.osmData),
    adminAreas: (context.adminAreas || []).map((area) => ({
      id: area.id,
      name: area.name,
      country: area.country,
      region: area.region,
      aliases: Array.isArray(area.aliases) ? area.aliases.slice(0, 40) : [],
      identityEntries: Array.isArray(area.identityEntries) ? area.identityEntries.slice(0, 40) : [],
      searchText: area.searchText
    })),
    adminMetricValues: Array.isArray(context.adminMetricValues)
      ? context.adminMetricValues.slice(0, 40).map((metric) => ({
          field: metric.field,
          label: metric.label,
          source: metric.source,
          count: metric.count,
          truncated: Boolean(metric.truncated),
          values: Array.isArray(metric.values)
            ? metric.values.slice(0, 80).map((item) => ({
                district: item.district,
                value: item.value,
                count: item.count
              }))
            : []
        }))
      : [],
    highlightedAdminAreas: Array.isArray(context.highlightedAdminAreas)
      ? context.highlightedAdminAreas.map((area) => ({
          id: area.id,
          name: area.name,
          country: area.country,
          region: area.region
        }))
      : [],
    prioritizationBoard: compactPrioritizationBoardForChat(context.prioritizationBoard)
  };
}

function getLocalMapCommandKey(command = null) {
  if (!command?.action) return '';
  return JSON.stringify(command);
}

function matchNumericFieldFromMessage(message = '', fields = []) {
  const lower = String(message).toLowerCase();
  const normalizeToken = (token = '') => String(token).replace(/s$/, '');
  const genericMetricTokens = new Set([
    'site',
    'count',
    'total',
    'case',
    'death',
    'number',
    'value',
    'data'
  ]);
  const messageTokenSet = new Set(
    lower
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
      .map(normalizeToken)
  );

  const scoredFields = (fields || []).map((item) => {
    const field = String(item?.field || item?.label || '').toLowerCase();
    const label = String(item?.label || item?.field || '').toLowerCase();
    const searchableField = `${field} ${label}`;
    const fieldText = field.replace(/[_-]+/g, ' ');
    const fieldTokens = searchableField
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
      .map(normalizeToken);
    const sharedTokenCount = fieldTokens.filter((token) => messageTokenSet.has(token)).length;
    const strongSharedTokenCount = fieldTokens.filter((token) => (
      messageTokenSet.has(token) && !genericMetricTokens.has(token)
    )).length;
    const exactScore = searchableField.trim() && (
      lower.includes(field) ||
      lower.includes(label) ||
      lower.includes(fieldText)
    ) ? 100 : 0;
    const confident = exactScore > 0 || sharedTokenCount >= 2 || strongSharedTokenCount >= 1;

    return {
      item,
      confident,
      score: exactScore + sharedTokenCount * 10 + Math.min(Number(item?.count) || 0, 5)
    };
  });

  return scoredFields
    .filter((entry) => entry.confident && entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

function getLocalAdminAreaNamesFromMessage(message = '', context = {}) {
  return getLocalAdminAreaMatchesFromMessage(message, context).map((match) => match.matchedValue || match.name);
}

function normalizedTextContains(searchText = '', term = '') {
  const normalizedSearchText = String(searchText).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedTerm = String(term).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalizedSearchText || !normalizedTerm) return false;
  return ` ${normalizedSearchText} `.includes(` ${normalizedTerm} `);
}

function normalizeAdminNameForMatch(value = '') {
  const adminTypeWords = new Set([
    'admin',
    'area',
    'areas',
    'boundary',
    'boundaries',
    'district',
    'districts',
    'province',
    'provinces',
    'region',
    'regions',
    'territory',
    'territories'
  ]);

  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !adminTypeWords.has(token))
    .join(' ')
    .trim();
}

function getRequestedAdminLevel(message = '') {
  const lower = String(message).toLowerCase();
  if (/\b(province|provinces|adm1|admin 1|admin1)\b/.test(lower)) return 'province';
  if (/\b(health zone|health zones|zone de sante|zscode)\b/.test(lower)) return 'health_zone';
  if (/\b(district|districts|territory|territories|adm2|admin 2|admin2)\b/.test(lower)) return 'district';
  return '';
}

function getLocalAdminAreaMatchesFromMessage(message = '', context = {}, options = {}) {
  const normalizedMessage = String(message).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const areas = Array.isArray(context.adminAreas) ? context.adminAreas : [];
  const requestedLevel = options.adminLevel || getRequestedAdminLevel(message);
  const genericAdminTokens = new Set([
    'admin',
    'area',
    'areas',
    'boundary',
    'boundaries',
    'district',
    'districts',
    'province',
    'provinces',
    'region',
    'regions',
    'territory',
    'territories',
    'health',
    'zone',
    'zones',
    'sud',
    'nord',
    'est',
    'ouest',
    'north',
    'south',
    'east',
    'west',
    'central',
    'highlight',
    'show',
    'map'
  ]);

  const messageLoose = normalizeAdminNameForMatch(message);
  const getExactCandidateMatch = (candidates = []) => {
    return candidates.filter(Boolean).find((candidate) => {
      const normalized = String(candidate).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return normalized.length >= 3 && normalizedTextContains(normalizedMessage, normalized);
    });
  };
  const getCandidateMatch = (area, candidates = []) => {
    return candidates.filter(Boolean).find((candidate) => {
      const normalized = String(candidate).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const normalizedLoose = normalizeAdminNameForMatch(candidate);
      return normalized.length >= 3 && (
        normalizedTextContains(normalizedMessage, normalized) ||
        normalizedTextContains(messageLoose, normalizedLoose)
      );
    });
  };

  if (!requestedLevel) {
    const getPrimaryCandidates = (area) => [
      area?.name,
      ...(Array.isArray(area?.identityEntries)
        ? area.identityEntries
            .filter((entry) => entry.level === 'name')
            .map((entry) => entry.value)
        : [])
    ];
    const primaryExactMatches = areas
      .map((area) => {
        const matchedCandidate = getExactCandidateMatch(getPrimaryCandidates(area));
        return matchedCandidate ? { ...area, matchedValue: String(matchedCandidate) } : null;
      })
      .filter(Boolean);

    if (primaryExactMatches.length > 0) {
      return Array.from(
        new Map(primaryExactMatches.map((match) => [String(match.id ?? match.name), match])).values()
      ).slice(0, 25);
    }

    const primaryLooseMatches = areas
      .map((area) => {
        const matchedCandidate = getCandidateMatch(area, getPrimaryCandidates(area));
        return matchedCandidate ? { ...area, matchedValue: String(matchedCandidate) } : null;
      })
      .filter(Boolean);

    if (primaryLooseMatches.length > 0) {
      return Array.from(
        new Map(primaryLooseMatches.map((match) => [String(match.id ?? match.name), match])).values()
      ).slice(0, 25);
    }
  }

  const matches = [];

  areas.forEach((area) => {
    const identityEntries = Array.isArray(area?.identityEntries) ? area.identityEntries : [];
    const levelEntries = requestedLevel
      ? identityEntries.filter((entry) => {
          if (requestedLevel === 'province') return entry.level === 'province';
          if (requestedLevel === 'district') return entry.level === 'district' || entry.level === 'name';
          if (requestedLevel === 'health_zone') return entry.level === 'health_zone' || entry.level === 'name';
          return true;
        })
      : identityEntries;
    const candidates = (levelEntries.length ? levelEntries.map((entry) => entry.value) : [
      area?.name,
      area?.country,
      area?.region,
      ...(Array.isArray(area?.aliases) ? area.aliases : [])
    ]).filter(Boolean);

    const matchedCandidate = getCandidateMatch(area, candidates);

    if (matchedCandidate) {
      matches.push({ ...area, matchedValue: String(matchedCandidate) });
      return;
    }

    if (requestedLevel && levelEntries.length) return;

    const messageTokens = normalizedMessage
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !genericAdminTokens.has(token));
    const searchText = requestedLevel && levelEntries.length
      ? String(levelEntries.map((entry) => entry.value).join(' ')).toLowerCase().replace(/[^a-z0-9]+/g, ' ')
      : String(area?.searchText || '');
    const tokenMatch = messageTokens.find((token) => normalizedTextContains(searchText, token));
    if (tokenMatch) {
      matches.push({ ...area, matchedValue: tokenMatch });
    }
  });

  return Array.from(
    new Map(matches.map((match) => [String(match.id ?? match.name), match])).values()
  )
    .filter((match) => {
      const normalized = String(match.matchedValue || match.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return normalized.length >= 3;
    })
    .slice(0, 25);
}

function getMentionedAdminAreaDetails(message = '', context = {}, maxAreas = 8) {
  return getLocalAdminAreaMatchesFromMessage(message, context)
    .slice(0, maxAreas)
    .map((area) => ({
      id: area.id,
      name: area.name,
      country: area.country,
      region: area.region,
      matchedValue: area.matchedValue,
      attributes: Array.isArray(area.attributes) ? area.attributes.slice(0, 120) : []
    }))
    .filter((area) => area.attributes.length > 0);
}

function detectLocalMarkerCommand(message = '', context = {}) {
  const lower = String(message).toLowerCase();
  const wantsMarker = /\b(add|drop|place|put|show|plot|mark)\b/.test(lower) && /\b(pin|marker|dot|point)\b/.test(lower);
  if (!wantsMarker) return null;

  const coordinateMatch =
    String(message).match(/(?:lat(?:itude)?\s*[:=]?\s*)?(-?\d{1,2}(?:\.\d+)?)\s*(?:,|;|\s+)\s*(?:lon(?:gitude)?|lng)\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/i) ||
    String(message).match(/lat(?:itude)?\s*[:=]?\s*(-?\d{1,2}(?:\.\d+)?)[,\s;]+(?:lon(?:gitude)?|lng)\s*[:=]?\s*(-?\d{1,3}(?:\.\d+)?)/i) ||
    String(message).match(/\b(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\b/);
  if (!coordinateMatch) {
    const names = getLocalAdminAreaNamesFromMessage(message, context);
    if (!names.length) return null;

    return {
      action: 'add_marker',
      criteria: { names },
      label: names[0]
    };
  }

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const labelMatch = String(message).match(/(?:called|named|label(?:ed)?(?:\s+as)?|label)\s+["']?([^"',.]+)["']?/i);
  return {
    action: 'add_marker',
    latitude,
    longitude,
    label: labelMatch?.[1]?.trim() || 'Chat marker'
  };
}

function getRequestedPalette(message = '') {
  const lower = String(message).toLowerCase();
  const paletteNames = ['red', 'green', 'blue', 'orange', 'purple', 'gray'];
  return paletteNames.find((palette) => lower.includes(palette)) || undefined;
}

function getRequestedColor(message = '') {
  const lower = String(message).toLowerCase();
  const colors = {
    red: '#dc2626',
    green: '#16a34a',
    blue: '#2563eb',
    orange: '#ea580c',
    purple: '#9333ea',
    yellow: '#ca8a04',
    black: '#111827'
  };
  const key = Object.keys(colors).find((color) => lower.includes(color));
  return key ? colors[key] : undefined;
}

function detectAdminMetricStyleCommand(message = '', context = {}) {
  const lower = String(message).toLowerCase();
  const fields = Array.isArray(context.adminNumericFields) ? context.adminNumericFields : [];
  if (!context?.hasDistricts || !fields.length) return null;

  const matchedField = matchNumericFieldFromMessage(message, fields);
  if (!matchedField) return null;

  const wantsBubbles = /\b(bubble|bubbles|circle|circles|proportional|symbol|symbols)\b/.test(lower);
  const wantsChoropleth = /\b(color|colour|shade|style|choropleth|chlorepleth|fill|heat|gradient)\b/.test(lower);
  const wantsMapMetric = /\b(show|map|display|visualize|plot|make|draw|chart)\b/.test(lower) &&
    /\b(admin|district|districts|area|areas|boundary|boundaries|map|chart|data)\b/.test(lower);

  if (wantsBubbles) {
    return {
      action: 'style_admin_metric_bubbles',
      metricField: matchedField.field,
      color: getRequestedColor(message)
    };
  }

  if (wantsChoropleth || wantsMapMetric) {
    return {
      action: 'style_admin_by_metric',
      metricField: matchedField.field,
      palette: getRequestedPalette(message)
    };
  }

  return null;
}

function detectLocalAdminDisplayCommand(message = '') {
  const lower = String(message).toLowerCase();
  if (/\b(analysis|scope|selection)\b/.test(lower)) return null;
  const hasAdminLayerTerm = /\b(admin|district|boundary|boundaries|border|borders|outline|outlines|label|labels)\b/.test(lower);
  if (!hasAdminLayerTerm) return null;

  const getTargetVisibility = (targetPattern) => {
    const hidePattern = new RegExp(`\\b(hide|turn off|switch off|disable|remove)\\b[^.?!]{0,60}\\b(${targetPattern})\\b|\\b(${targetPattern})\\b[^.?!]{0,60}\\b(off|hidden|disabled)\\b`);
    const showPattern = new RegExp(`\\b(show|turn on|switch on|enable|display)\\b[^.?!]{0,60}\\b(${targetPattern})\\b|\\b(${targetPattern})\\b[^.?!]{0,60}\\b(on|visible|enabled)\\b`);
    if (hidePattern.test(lower)) return false;
    if (showPattern.test(lower)) return true;
    return null;
  };

  const command = { action: 'set_admin_display' };
  const hasBorderTerm = /\b(border|borders|outline|outlines|boundary line|boundary lines)\b/.test(lower);
  const hasLabelTerm = /\b(label|labels|names)\b/.test(lower);
  const hasBoundaryTerm = /\b(admin layer|admin boundaries|boundaries|boundary layer|district layer)\b/.test(lower) && !hasBorderTerm;
  const borderVisibility = getTargetVisibility('border|borders|outline|outlines|boundary line|boundary lines');
  const labelVisibility = getTargetVisibility('label|labels|names');
  const layerVisibility = getTargetVisibility('admin layer|admin boundaries|boundaries|boundary layer|district layer');

  if (hasBorderTerm && borderVisibility !== null) {
    command.showBorders = borderVisibility;
    command.showLayer = true;
  }

  if (hasLabelTerm && labelVisibility !== null) {
    command.showLabels = labelVisibility;
    command.showLayer = true;
  }

  if (hasBoundaryTerm && layerVisibility !== null) {
    command.showLayer = layerVisibility;
  }

  return Object.keys(command).length > 1 ? command : null;
}

function detectLocalOSMCommand(message = '', context = {}) {
  const lower = String(message).toLowerCase();

  // Check for "clear/remove ALL OSM/infrastructure" commands first
  const hasClearVerb = /\b(clear|remove|delete|hide|unload)\b/.test(lower);
  const hasAllOSMPattern = /\b(all|everything)\b/.test(lower) && /\b(osm|openstreetmap|infrastructure|facilities)\b/.test(lower);
  const hasOSMDataPattern = /\b(osm data|osm infrastructure|infrastructure data|infrastructure layers?|osm layers?)\b/.test(lower);

  if (hasClearVerb && (hasAllOSMPattern || hasOSMDataPattern)) {
    return {
      action: 'remove_all_osm',
      category: 'all'
    };
  }

  // OSM category keywords with synonyms - order matters for matching priority
  const osmCategories = {
    hospitals: /\b(hospital|hospitals|clinic|clinics|health center|health centres|health facility|health facilities|medical center|medical centres|healthsite|healthsites)\b/,
    water: /\b(water source|water sources|water point|water points|water station|water stations|water supply|water facilities|well|wells|borehole|boreholes|water)\b/,
    schools: /\b(school|schools|education|educational facility|university|universities|college|colleges|learning center|learning centre)\b/,
    power: /\b(power station|power stations|power plant|power plants|electricity|electric|power line|power lines|electrical grid|substation|substations|power)\b/,
    pharmacies: /\b(pharmacy|pharmacies|drugstore|drugstores|drug store|drug stores|chemist|chemists)\b/,
    airports: /\b(airport|airports|airfield|airfields|airstrip|airstrips|aerodrome|aerodromes|landing strip)\b/,
    roads: /\b(major road|major roads|main road|main roads|highway|highways|motorway|motorways|road|roads|street|streets)\b/,
    fuel: /\b(fuel station|fuel stations|gas station|gas stations|petrol station|petrol stations|filling station|service station|fuel|petrol|gasoline)\b/,
    bridges: /\b(bridge|bridges)\b/
  };

  // Detect which category is mentioned
  const matchedCategory = Object.keys(osmCategories).find(category =>
    osmCategories[category].test(lower)
  );

  if (!matchedCategory) return null;

  // Determine action type
  const hasShowVerb = /\b(show|map|display|add|load|get|fetch|visualize|plot)\b/.test(lower);
  const hasHideVerb = /\b(hide|don't show|stop showing|turn off|switch off)\b/.test(lower);
  const hasRemoveVerb = /\b(remove|delete|clear|unload)\b/.test(lower);

  // Priority: remove > hide > show
  if (hasRemoveVerb) {
    return {
      action: 'remove_osm_layer',
      category: matchedCategory
    };
  }

  if (hasHideVerb) {
    return {
      action: 'hide_osm_layer',
      category: matchedCategory
    };
  }

  if (hasShowVerb || /\b(all|the)\b/.test(lower)) {
    return {
      action: 'show_osm_layer',
      category: matchedCategory
    };
  }

  return null;
}

function detectMapLayerControlCommand(message = '', context = {}) {
  const lower = String(message).toLowerCase();

  const hasSwitchVerb = /\b(switch|change|set|use)\b/.test(lower);
  const hasShowVerb = /\b(show|display|add|load|overlay|turn on|switch on|enable)\b/.test(lower);
  const hasHideVerb = /\b(hide|remove|clear|unload|turn off|switch off|disable)\b/.test(lower);
  const wantsResetMap = /\b(reset|restore)\b[^.?!]{0,30}\b(map|basemap|base map|map layer|layers?)\b/.test(lower) ||
    /\b(map|basemap|base map|map layer|layers?)\b[^.?!]{0,30}\b(reset|restore)\b/.test(lower);
  const wantsBasemapSwitch = /\b(switch|change|set|use|show|display)\b[^.?!]{0,60}\b(map|basemap|base map|view|layer)\b/.test(lower) ||
    /\b(map|basemap|base map|view|layer)\b[^.?!]{0,60}\b(switch|change|set|use|show|display)\b/.test(lower);

  if (wantsResetMap) {
    return { action: 'set_base_map', layer: 'street', resetContextOverlays: true };
  }

  const overlayMatches = [];
  const overlayDefinitions = [
    {
      layer: 'flood_context',
      pattern: /\b(flood context|flood overlay|flood layer|flood-prone|flood prone)\b/
    },
    {
      layer: 'drought_context',
      pattern: /\b(drought context|drought overlay|drought layer|dryness|rainfall context)\b/
    },
    {
      layer: 'accessibility_context',
      pattern: /\b(accessibility|hard to reach|hard-to-reach|reachability|travel time|access friction)\b/
    }
  ];

  overlayDefinitions.forEach((definition) => {
    if (definition.pattern.test(lower)) overlayMatches.push(definition.layer);
  });

  if ((hasShowVerb || hasHideVerb) && /\b(all context overlays?|all evidence layers?|context overlays?|evidence layers?|these ones|them|all overlays?)\b/.test(lower)) {
    const enabledEvidenceLayers = Array.isArray(context.enabledEvidenceLayers) ? context.enabledEvidenceLayers : [];
    const contextOverlayIds = ['flood_context', 'drought_context', 'accessibility_context'];
    const targetOverlays = hasHideVerb
      ? (enabledEvidenceLayers.filter((layer) => contextOverlayIds.includes(layer)).length
          ? enabledEvidenceLayers.filter((layer) => contextOverlayIds.includes(layer))
          : contextOverlayIds)
      : contextOverlayIds;

    return {
      action: 'set_context_overlays',
      overlays: targetOverlays,
      visible: !hasHideVerb
    };
  }

  if (overlayMatches.length > 0 && (hasShowVerb || hasHideVerb)) {
    return {
      action: 'set_context_overlays',
      overlays: overlayMatches,
      visible: !hasHideVerb
    };
  }

  if (/\b(nighttime lights|night time lights|nightime lights|night lights|viirs)\b/.test(lower) && (wantsBasemapSwitch || hasSwitchVerb || hasShowVerb || hasHideVerb)) {
    if (hasHideVerb) {
      return { action: 'set_base_map', layer: 'street' };
    }
    return { action: 'set_base_map', layer: 'nighttime_lights' };
  }

  const basemapDefinitions = [
    { layer: 'satellite', pattern: /\b(satellite|imagery|world imagery)\b/ },
    { layer: 'street', pattern: /\b(street map|streetmap|osm|openstreetmap|default map|standard map)\b/ },
    { layer: 'terrain', pattern: /\b(terrain|topographic|topo)\b/ },
    { layer: 'dark', pattern: /\b(dark map|dark mode|dark basemap)\b/ },
    { layer: 'light_minimal', pattern: /\b(light map|light basemap|minimal map)\b/ },
    { layer: 'recent_clear', pattern: /\b(recent clear|sentinel-2|sentinel 2|clear imagery)\b/ },
    { layer: 'radar_change', pattern: /\b(radar change|sentinel-1|sentinel 1|radar)\b/ },
    { layer: 'recent_imagery', pattern: /\b(recent imagery|daily imagery|nasa imagery|viirs true color)\b/ }
  ];
  const matchedBasemap = basemapDefinitions.find((definition) => definition.pattern.test(lower));

  if (matchedBasemap && (wantsBasemapSwitch || hasShowVerb || /\b(view|basemap|base map|map)\b/.test(lower))) {
    return { action: 'set_base_map', layer: matchedBasemap.layer };
  }

  return null;
}

function detectLocalMapCommand(message = '', context = {}) {
  const lower = String(message).toLowerCase();
  const hasClearVerb = /(?:\bclear\b|\breset\b|\b[a-z]*remove\b)/.test(lower);
  const hasClearOrResetVerb = /\b(clear|reset)\b/.test(lower);

  const mapLayerControlCommand = detectMapLayerControlCommand(message, context);
  if (mapLayerControlCommand) return mapLayerControlCommand;

  const metricStyleCommand = detectAdminMetricStyleCommand(message, context);
  if (metricStyleCommand) return metricStyleCommand;

  // Handle "clear map" or "clear everything" - clears all map overlays
  if ((hasClearOrResetVerb || /\b(remove all|remove everything)\b/.test(lower)) &&
      /\b(map|everything|all)\b/.test(lower) &&
      !/\b(pin|marker|highlight|annotation|bubble|metric|layer|choropleth)\b/.test(lower)) {
    return { action: 'clear_all_map_overlays' };
  }

  // Handle "unselect all" or "clear selection" or "deselect all" - clears analysis scope
  // Must explicitly mention unselect/deselect or have "all" with clear/reset
  if ((/\b(unselect|deselect)\b/.test(lower) && /\b(all|districts?|admin|areas?|everything|selection)\b/.test(lower)) ||
      (/\b(clear|reset|remove)\b/.test(lower) && /\b(selection|all districts?|all admin|all areas?)\b/.test(lower))) {
    // This is a global clear command, not a selective deselect
    if (!/\b(from analysis|from scope|specific|only|named|called)\b/.test(lower)) {
      return { action: 'clear_analysis_scope' };
    }
  }

  if ((hasClearOrResetVerb && /\b(admin|district|districts|boundary|boundaries)\b/.test(lower)) ||
      (hasClearVerb && /\b(choropleth|chlorepleth|color map|colour map|bubble|bubbles|circle|circles|metric layer|metric layers|case map|disease layer)\b/.test(lower))) {
    return { action: 'clear_metric_layers' };
  }

  if (hasClearVerb && /\b(bubble|bubbles|circle|circles|proportional symbol|proportional symbols)\b/.test(lower)) {
    return { action: 'clear_metric_bubbles' };
  }

  if (hasClearVerb && /\b(metric|metrics|case map|disease layer|choropleth|chlorepleth|color map|colour map)\b/.test(lower)) {
    return { action: 'clear_metric_layers' };
  }

  if (hasClearVerb && /\b(highlight|highlights|highlighting)\b/.test(lower)) {
    return { action: 'clear_highlights' };
  }

  if (hasClearVerb && /\b(pin|pins|marker|markers|dot|dots|annotation|annotations)\b/.test(lower)) {
    return { action: 'clear_map_annotations' };
  }

  if (/\b(clear|reset|remove all)\b/.test(lower) && /\b(analysis scope|analysis selection|selected admin|selected district|selected districts|selected areas)\b/.test(lower)) {
    return { action: 'clear_analysis_scope' };
  }

  const adminDisplayCommand = detectLocalAdminDisplayCommand(message);
  if (adminDisplayCommand) return adminDisplayCommand;

  const markerCommand = detectLocalMarkerCommand(message, context);
  if (markerCommand) return markerCommand;

  const osmCommand = detectLocalOSMCommand(message, context);
  if (osmCommand) return osmCommand;

  const highlightKeywords = ['highlight', 'show on map', 'display on map', 'point out on map', 'map', 'visualize'];
  const selectKeywords = ['select', 'set scope', 'focus on', 'use only', 'analyze only'];
  const deselectKeywords = ['deselect', 'unselect', 'remove from analysis', 'remove from scope', 'exclude from analysis', 'exclude from scope'];
  const hasDeselectPhrase = /\b(remove|exclude|deselect|unselect)\b[\s\S]{0,120}\b(from|for)\s+(?:the\s+)?(analysis|scope|selection)\b/.test(lower) ||
    /\b(remove|exclude|deselect|unselect)\b[\s\S]{0,120}\b(analysis scope|selected areas|selected admin|selected districts?)\b/.test(lower);
  const riskKeywords = ['high risk', 'very high risk', 'dangerous', 'unsafe', 'no go', 'no-go', 'risky', 'risk', 'threat'];
  const safeKeywords = ['safe', 'low risk', 'no risk', 'secure', 'safe for operations'];
  const hasDistrictMention = lower.includes('district') || lower.includes('province') || lower.includes('admin') || lower.includes('area') || lower.includes('region') || lower.includes('location');
  const hasHighlightIntent = highlightKeywords.some((keyword) => lower.includes(keyword));
  const hasSelectIntent = selectKeywords.some((keyword) => lower.includes(keyword));
  const hasDeselectIntent = hasDeselectPhrase || deselectKeywords.some((keyword) => lower.includes(keyword));
  if (!context?.hasDistricts || (!hasHighlightIntent && !hasSelectIntent && !hasDeselectIntent)) return null;

  const criteria = {};
  if (riskKeywords.some((keyword) => lower.includes(keyword))) {
    if (lower.includes('very high')) {
      criteria.riskLevels = ['very-high'];
    } else if (lower.includes('high')) {
      criteria.riskLevels = ['high', 'very-high'];
    } else if (lower.includes('no go') || lower.includes('no-go')) {
      criteria.riskLevels = ['very-high', 'high'];
    } else {
      criteria.riskLevels = ['high', 'very-high', 'medium'];
    }
  }

  if (safeKeywords.some((keyword) => lower.includes(keyword))) {
    criteria.riskLevels = ['none', 'low'];
  }

  if (lower.includes('medium risk') || lower.includes('moderate')) {
    criteria.riskLevels = ['medium'];
  }

  if ((lower.includes('all') || lower.includes('entire') || lower.includes('whole')) && hasDistrictMention && hasHighlightIntent) {
    criteria.riskLevels = ['very-high', 'high', 'medium', 'low', 'none'];
  }

  const eventMatch = lower.match(/(\d+)\s*(or more|events|incidents)/);
  if (eventMatch) {
    criteria.minEventCount = parseInt(eventMatch[1], 10);
  }

  const matchedAreas = getLocalAdminAreaMatchesFromMessage(message, context);
  if (matchedAreas.length > 0) {
    criteria.ids = matchedAreas.map((area) => area.id).filter((id) => id !== undefined && id !== null);
    criteria.names = matchedAreas.map((area) => area.name || area.matchedValue).filter(Boolean);
    console.log(`📍 Extracted ${matchedAreas.length} district name(s) from message:`, criteria.names);
  }
  const requestedAdminLevel = getRequestedAdminLevel(message);
  if (requestedAdminLevel) {
    criteria.adminLevel = requestedAdminLevel;
  }

  if (!Object.keys(criteria).length && (hasSelectIntent || hasDeselectIntent) && Array.isArray(context.highlightedAdminAreas) && context.highlightedAdminAreas.length > 0) {
    criteria.ids = context.highlightedAdminAreas.map((area) => area.id);
    criteria.names = context.highlightedAdminAreas.map((area) => area.name).filter(Boolean);
  }

  if (!Object.keys(criteria).length) {
    return null;
  }

  return {
    action: hasDeselectIntent ? 'deselect_districts' : (hasSelectIntent ? 'select_districts' : 'highlight_districts'),
    criteria
  };
}

function getExactAdminAreaMatchesFromText(text = '', context = {}) {
  const areas = Array.isArray(context.adminAreas) ? context.adminAreas : [];
  const normalizedText = String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const lines = String(text)
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean);

  const standaloneMatches = [];
  areas.forEach((area) => {
    const areaName = String(area?.name || '').trim();
    if (areaName.length < 3) return;
    const normalizedAreaName = areaName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const lineMatch = lines.some((line) => {
      const normalizedLine = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return normalizedLine === normalizedAreaName ||
        normalizedLine.startsWith(`${normalizedAreaName} `) ||
        normalizedLine.includes(` ${normalizedAreaName} `);
    });
    if (lineMatch) {
      standaloneMatches.push({ id: area.id, name: areaName });
    }
  });

  if (standaloneMatches.length > 0) {
    return Array.from(
      new Map(standaloneMatches.map((match) => [String(match.id), match])).values()
    ).slice(0, 25);
  }

  const exactMatches = areas
    .map((area) => ({ id: area.id, name: String(area?.name || '').trim() }))
    .filter((area) => {
      if (area.name.length < 3) return false;
      const normalizedName = area.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return normalizedText.includes(` ${normalizedName} `) ||
        normalizedText.startsWith(`${normalizedName} `) ||
        normalizedText.endsWith(` ${normalizedName}`);
    });

  return Array.from(
    new Map(exactMatches.map((match) => [String(match.id), match])).values()
  ).slice(0, 25);
}

function getExactAdminAreaNamesFromText(text = '', context = {}) {
  return getExactAdminAreaMatchesFromText(text, context).map((match) => match.name);
}

function detectAssistantMapCommand(content = '', context = {}, userMessage = '') {
  const lowerUserMessage = String(userMessage).toLowerCase();
  const userRequestedHighlight = /\b(highlight|map|visualize)\b/.test(lowerUserMessage) ||
    /\b(show|display|point out)\b[\s\S]{0,40}\b(on|in)\s+(?:the\s+)?map\b/.test(lowerUserMessage);

  if (!userRequestedHighlight) return null;

  let matches = getExactAdminAreaMatchesFromText(content, context);
  if (!matches.length) return null;

  if (/\b(largest|highest|most)\b/.test(lowerUserMessage)) {
    matches = matches.slice(0, 5);
  }

  return {
    action: 'highlight_districts',
    criteria: {
      ids: matches.map((match) => match.id),
      names: matches.map((match) => match.name)
    }
  };
}

function detectAssistantMetricMapCommand(content = '', context = {}, userMessage = '') {
  const lowerUserMessage = String(userMessage).toLowerCase();
  const fields = Array.isArray(context.adminNumericFields) ? context.adminNumericFields : [];
  if (!context?.hasDistricts || !fields.length) return null;

  const wantsBubbles = /\b(bubble|bubbles|circle|circles|proportional|symbol|symbols)\b/.test(lowerUserMessage);
  const wantsChoropleth = /\b(color|colour|shade|style|choropleth|chlorepleth|fill|heat|gradient)\b/.test(lowerUserMessage);
  const wantsMapMetric = /\b(show|map|display|visualize|plot|make|draw|chart)\b/.test(lowerUserMessage) &&
    /\b(admin|district|districts|area|areas|boundary|boundaries|map|chart|data)\b/.test(lowerUserMessage);
  if (!wantsBubbles && !wantsChoropleth && !wantsMapMetric) return null;

  const matchedField = matchNumericFieldFromMessage(content, fields);
  if (!matchedField) return null;

  if (wantsBubbles) {
    return {
      action: 'style_admin_metric_bubbles',
      metricField: matchedField.field
    };
  }

  return {
    action: 'style_admin_by_metric',
    metricField: matchedField.field,
    palette: getRequestedPalette(userMessage)
  };
}

function shouldUseDeepChat(message = '') {
  const lower = String(message).toLowerCase();

  const detailTerms = [
    'detail', 'details', 'detailed', 'deep', 'deeper', 'full', 'full details',
    'exactly', 'what happened', 'explain', 'walk me through', 'notes', 'source',
    'actor', 'actors', 'evidence', 'why exactly', 'root cause', 'analyze deeply'
  ];
  const proximityTerms = ['near', 'nearby', 'close to', 'around', 'within'];
  const airportTerms = ['airport', 'airports', 'airfield', 'helipad', 'aerodrome'];

  const acledTerms = ['acled', 'event', 'incident', 'strike', 'attack', 'explosion', 'violence'];
  const facilityTerms = ['facility', 'clinic', 'hospital', 'warehouse', 'site'];

  const asksForDetail = detailTerms.some((term) => lower.includes(term));
  const asksAirportProximity = airportTerms.some((term) => lower.includes(term))
    && (proximityTerms.some((term) => lower.includes(term)) || acledTerms.some((term) => lower.includes(term)));
  const asksAboutSpecificEvidence = (acledTerms.some((term) => lower.includes(term)) && asksForDetail)
    || (facilityTerms.some((term) => lower.includes(term)) && asksForDetail);

  return asksForDetail || asksAboutSpecificEvidence || asksAirportProximity;
}

function isTableRow(line = '') {
  const trimmed = line.trim();
  return trimmed.includes('|') && !trimmed.startsWith('```');
}

function isTableSeparator(line = '') {
  const normalized = line.trim().replace(/\|/g, '').replace(/:/g, '').replace(/-/g, '').trim();
  return normalized.length === 0 && line.includes('-');
}

function parseTableRow(line = '') {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTabularRow(line = '') {
  const trimmed = line.trim();
  return trimmed.includes('\t') && !trimmed.startsWith('```');
}

function parseTabularRow(line = '') {
  return line
    .trim()
    .split('\t')
    .map((cell) => cell.trim());
}

function stripMarkdownTokens(value = '') {
  return String(value)
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .trim();
}

function isNumericTableCell(value = '') {
  const normalized = stripMarkdownTokens(value)
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/[()]/g, '')
    .trim();

  if (!normalized) return false;
  return /^-?\d+(\.\d+)?$/.test(normalized);
}

function getUrlHost(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function linkifyPlainUrls(markdown = '') {
  return String(markdown).replace(
    /(^|[\s[{>])((https?:\/\/)[^\s<>()]+[^\s<>().,;:!?])/g,
    (match, prefix, url, _protocol, offset, source) => {
      if (prefix === '(' && source[offset - 1] === ']') return match;
      const label = getUrlHost(url) || url;
      return `${prefix}[${label}](${url})`;
    }
  );
}

function markdownLinkComponent({ node, href, children, ...props }) {
  const safeHref = typeof href === 'string' && /^https?:\/\//i.test(href) ? href : undefined;

  if (!safeHref) {
    return <span {...props}>{children}</span>;
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      title={safeHref}
      style={{
        color: 'var(--aidstack-orange)',
        fontWeight: 700,
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
        overflowWrap: 'anywhere'
      }}
      {...props}
    >
      {children}
    </a>
  );
}

function getNumericColumns(rows = []) {
  if (!rows.length) return new Set();

  const maxColumns = Math.max(...rows.map((row) => row.length));
  const numericColumns = new Set();

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const columnValues = rows
      .map((row) => row[columnIndex])
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== '');

    if (columnValues.length > 0 && columnValues.every((value) => isNumericTableCell(value))) {
      numericColumns.add(columnIndex);
    }
  }

  return numericColumns;
}

function renderInlineMarkdown(content, key) {
  return (
    <ReactMarkdown
      key={key}
      components={{
        p: ({ node, ...props }) => <span {...props} />,
        strong: ({ node, ...props }) => <strong style={{ fontWeight: 700, color: '#0f172a' }} {...props} />,
        em: ({ node, ...props }) => <em {...props} />,
        a: markdownLinkComponent,
        code: ({ node, inline, ...props }) => <code style={{ backgroundColor: 'rgba(15,23,42,0.06)', padding: '1px 4px', borderRadius: '4px', fontSize: '0.92em' }} {...props} />
      }}
    >
      {linkifyPlainUrls(content)}
    </ReactMarkdown>
  );
}

function markdownComponents() {
  return {
    p: ({ node, ...props }) => <p style={{ margin: '0.5em 0' }} {...props} />,
    strong: ({ node, ...props }) => <strong style={{ fontWeight: 600 }} {...props} />,
    em: ({ node, ...props }) => <em {...props} />,
    a: markdownLinkComponent,
    ul: ({ node, ordered, ...props }) => <ul style={{ marginLeft: '1.2em', marginTop: '0.5em', marginBottom: '0.5em' }} {...props} />,
    ol: ({ node, ordered, ...props }) => <ol style={{ marginLeft: '1.2em', marginTop: '0.5em', marginBottom: '0.5em' }} {...props} />,
    li: ({ node, ordered, ...props }) => <li style={{ marginBottom: '0.3em' }} {...props} />,
    code: ({ node, inline, ...props }) => (
      inline
        ? <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.9em' }} {...props} />
        : <code style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px', fontSize: '0.9em', overflow: 'auto' }} {...props} />
    )
  };
}

function renderMarkdownWithTables(content, keyPrefix = 'md') {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks = [];
  let currentMarkdown = [];
  let i = 0;

  const flushMarkdown = () => {
    const markdown = currentMarkdown.join('\n').trim();
    if (markdown) {
      blocks.push({ type: 'markdown', content: markdown });
    }
    currentMarkdown = [];
  };

  while (i < lines.length) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];

    if (isTableRow(currentLine) && nextLine && isTableSeparator(nextLine)) {
      flushMarkdown();

      const header = parseTableRow(currentLine);
      const rows = [];
      i += 2;

      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }

      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (isTabularRow(currentLine) && nextLine && isTabularRow(nextLine)) {
      flushMarkdown();

      const header = parseTabularRow(currentLine);
      const rows = [];
      i += 1;

      while (i < lines.length && isTabularRow(lines[i])) {
        rows.push(parseTabularRow(lines[i]));
        i += 1;
      }

      blocks.push({ type: 'table', header, rows });
      continue;
    }

    currentMarkdown.push(currentLine);
    i += 1;
  }

  flushMarkdown();

  return blocks.map((block, index) => {
    if (block.type === 'table') {
      const numericColumns = getNumericColumns(block.rows);

      return (
        <div key={`${keyPrefix}-table-${index}`} className="chat-table-wrap">
          <table className="chat-table">
            <thead>
              <tr>
                {block.header.map((cell, cellIndex) => (
                  <th
                    key={`${keyPrefix}-th-${index}-${cellIndex}`}
                    className={numericColumns.has(cellIndex) ? 'chat-table-cell-numeric' : ''}
                  >
                    {renderInlineMarkdown(cell, `${keyPrefix}-th-md-${index}-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={`${keyPrefix}-tr-${index}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${keyPrefix}-td-${index}-${rowIndex}-${cellIndex}`}
                      className={numericColumns.has(cellIndex) ? 'chat-table-cell-numeric' : ''}
                    >
                      {renderInlineMarkdown(cell, `${keyPrefix}-td-md-${index}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <ReactMarkdown key={`${keyPrefix}-markdown-${index}`} components={markdownComponents()}>
        {linkifyPlainUrls(block.content)}
      </ReactMarkdown>
    );
  });
}

const ChatDrawer = ({
  isOpen,
  onClose,
  context,
  onHighlightDistricts,
  onMapCommand,
  isExpanded = false,
  onToggleExpand,
  embedded = false // New prop for when embedded in UnifiedDrawer
}) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: context?.hasDistricts
        ? 'Hello. I can help analyze your selected admin areas and workspace data. Ask me to compare risk levels, identify priority areas, review attached files, highlight districts on the map, or prepare an operational summary.'
        : 'Hello. I can help analyze the data in this workspace, including uploaded sites, admin areas, hazards, outbreaks, population layers, security events, and any files you attach here. Ask me to summarize risks, compare areas, review uploaded data, prepare files for mapping, or generate operational briefs.',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [chatAttachments, setChatAttachments] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastLocalMapCommandRef = useRef('');
  const localMapCommandAppliedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const handleCopy = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleAttachmentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAttachmentLoading(true);
    setAttachmentError('');

    try {
      const attachment = await parseChatAttachment(file);
      setChatAttachments((prev) => [attachment, ...prev].slice(0, 3));
      const isDocument = attachment.attachmentKind === 'document';
      const retainedNote = !isDocument && attachment.retainedRowCount < attachment.rowCount
        ? ` I retained the first ${attachment.retainedRowCount.toLocaleString()} rows locally and will send a compact sample to chat.`
        : '';
      const attachmentDescription = isDocument
        ? `Attached **${attachment.fileName}** with ${Number(attachment.documentStats?.wordCount || 0).toLocaleString()} extracted words across ${attachment.documentChunks.length.toLocaleString()} text chunks. I can use it as chat context for summarization, question answering, and comparison against the workspace data.`
        : `Attached **${attachment.fileName}** with ${attachment.rowCount.toLocaleString()} rows and ${attachment.columns.length.toLocaleString()} columns.${retainedNote} I can use it as chat context for data review, cleaning, schema mapping, and analysis based on the fields in the file.`;
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: attachmentDescription,
        timestamp: Date.now(),
        isAIGenerated: false
      }]);
    } catch (error) {
      console.error('Attachment parse failed:', error);
      setAttachmentError(error.message || 'Unable to read that file.');
    } finally {
      setAttachmentLoading(false);
      if (event.target) event.target.value = '';
    }
  };

  const removeAttachment = (attachmentId) => {
    setChatAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingMessage('');

    try {
      // Debug: Log context to see what's being sent
      console.log('Chat context being sent:', {
        facilities: context.facilities?.length,
        disasters: context.disasters?.length,
        acledData: context.acledData?.length,
        acledEnabled: context.acledEnabled
      });

      const detailLevel = shouldUseDeepChat(userMessage.content) ? 'deep' : 'compact';
      const compactContext = {
        ...compactChatContext(context, detailLevel),
        chatAttachments: compactChatAttachmentsForContext(chatAttachments),
        mentionedAdminAreas: getMentionedAdminAreaDetails(userMessage.content, context)
      };
      const recentAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
      const isGoAhead = /\b(go ahead|do it|yes|please do|proceed)\b/i.test(userMessage.content);
      const localMapCommand = detectLocalMapCommand(userMessage.content, compactContext) ||
        (isGoAhead && recentAssistantMessage
          ? detectAssistantMapCommand(recentAssistantMessage.content, compactContext, 'highlight')
          : null);
      if (localMapCommand && onMapCommand) {
        lastLocalMapCommandRef.current = getLocalMapCommandKey(localMapCommand);
        localMapCommandAppliedRef.current = true;
        onMapCommand(localMapCommand);
      } else {
        lastLocalMapCommandRef.current = '';
        localMapCommandAppliedRef.current = false;
      }

      console.time('Serializing request body');
      const requestBody = JSON.stringify({
        message: userMessage.content,
        context: compactContext,
        detailLevel,
        conversationHistory: messages.slice(-10).map(m => ({
          role: m.role,
          content: truncateText(m.content, 1200)
        })),
        stream: true
      });
      console.timeEnd('Serializing request body');
      console.log(`Request body size: ${(requestBody.length / 1024).toFixed(2)} KB`);

      const fetchStart = Date.now();
      console.log('🚀 Starting fetch request...');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      });

      console.log(`📥 Response headers received in ${Date.now() - fetchStart}ms, status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';
      let chunkCount = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                throw new Error(parsed.error.message || 'The AI response stream failed.');
              }

              // Check for map commands
              if (parsed.mapCommand) {
                console.log('📍 Received map command:', parsed.mapCommand);
                const serverCommandKey = getLocalMapCommandKey(parsed.mapCommand);
                if (onMapCommand && !localMapCommandAppliedRef.current && serverCommandKey !== lastLocalMapCommandRef.current) {
                  onMapCommand(parsed.mapCommand);
                } else if (!onMapCommand && onHighlightDistricts) {
                  console.log('✅ onHighlightDistricts function is available');
                  if (parsed.mapCommand.action === 'highlight_districts') {
                    console.log('🗺️ Calling onHighlightDistricts with criteria:', parsed.mapCommand.criteria);
                    onHighlightDistricts(parsed.mapCommand.criteria);
                  }
                } else if (!onMapCommand && !onHighlightDistricts) {
                  console.warn('⚠️ onHighlightDistricts function is NOT available - districts may not be loaded');
                }
              }

              if (parsed.content) {
                chunkCount++;
                if (chunkCount === 1) {
                  console.log(`🎉 First chunk received at ${Date.now() - startTime}ms`);
                }
                accumulatedContent += parsed.content;
                setStreamingMessage(accumulatedContent);
              }
            } catch (e) {
              console.error('Failed to parse chunk:', data, e);
            }
          }
        }
      }

      console.log(`✅ Client received ${chunkCount} chunks in ${Date.now() - startTime}ms`);

      const assistantMessage = {
        role: 'assistant',
        content: accumulatedContent,
        timestamp: Date.now(),
        isAIGenerated: true
      };

      const assistantMapCommand = detectAssistantMetricMapCommand(accumulatedContent, compactContext, userMessage.content) ||
        detectAssistantMapCommand(accumulatedContent, compactContext, userMessage.content);
      const assistantCommandKey = getLocalMapCommandKey(assistantMapCommand);
      if (
        assistantMapCommand &&
        onMapCommand &&
        !localMapCommandAppliedRef.current &&
        assistantCommandKey !== lastLocalMapCommandRef.current
      ) {
        lastLocalMapCommandRef.current = assistantCommandKey;
        onMapCommand(assistantMapCommand);
      }

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: Date.now(),
        isError: true
      }]);
      setStreamingMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Conditional suggested questions based on available data
  const getSuggestedQuestions = () => {
    const baseQuestions = [
      "How will the current disasters affect ongoing health campaigns?",
      "Which sites should we prioritize for immunization programs?"
    ];

    if (context?.hasDistricts) {
      return [
        "Show me all admin areas in the uploaded boundaries",
        "Highlight high risk admin areas",
        "Show safe admin areas for operations",
        "Which admin areas should I avoid?"
      ];
    }

    return [
      ...baseQuestions,
      "What are the supply chain risks for malaria prevention?",
      "How should we adjust our program timeline?"
    ];
  };

  const suggestedQuestions = getSuggestedQuestions();
  const messageMaxWidth = isExpanded ? '92%' : '85%';

  // Content that will be shown (either embedded or in full drawer)
  const content = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: embedded ? 'calc(100vh - 130px)' : 'auto',
      flex: embedded ? '0 0 auto' : 1,
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: 0
      }}>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: messageMaxWidth
              }}
            >
              <div style={{
                backgroundColor: message.role === 'user'
                  ? 'var(--aidstack-navy)'
                  : message.isError
                  ? '#ffebee'
                  : 'var(--aidstack-light-gray)',
                color: message.role === 'user' ? 'white' : 'var(--aidstack-slate-dark)',
                padding: '10px 14px',
                borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                position: 'relative'
              }}>
                {message.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(message.content, index)}
                    title={copiedIndex === index ? "Copied!" : "Copy response"}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      opacity: 0.6,
                      transition: 'opacity 0.2s, background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.6';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {copiedIndex === index ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                )}
                {message.role === 'user' ? (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {message.content}
                  </div>
                ) : (
                  <div style={{ paddingRight: '24px' }}>
                    {renderMarkdownWithTables(message.content, `message-${index}`)}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '11px',
                color: 'var(--aidstack-slate-light)',
                marginTop: '4px',
                textAlign: message.role === 'user' ? 'right' : 'left',
                fontFamily: "'Inter', sans-serif"
              }}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div style={{
              alignSelf: 'flex-start',
              maxWidth: messageMaxWidth
            }}>
              <div style={{
                backgroundColor: 'var(--aidstack-light-gray)',
                color: 'var(--aidstack-slate-dark)',
                padding: '10px 14px',
                borderRadius: '16px 16px 16px 4px',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                {renderMarkdownWithTables(streamingMessage, 'streaming')}
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '14px',
                  backgroundColor: 'var(--aidstack-slate-dark)',
                  marginLeft: '2px',
                  animation: 'blink 1s infinite'
                }}></span>
              </div>
            </div>
          )}

          {loading && !streamingMessage && (
            <div style={{
              alignSelf: 'flex-start',
              maxWidth: '85%'
            }}>
              <div style={{
                backgroundColor: 'var(--aidstack-light-gray)',
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                display: 'flex',
                gap: '6px',
                alignItems: 'center'
              }}>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          {messages.length === 1 && (
            <div style={{
              marginTop: '10px'
            }}>
              <p style={{
                fontSize: '13px',
                color: 'var(--aidstack-slate-medium)',
                marginBottom: '10px',
                fontFamily: "'Inter', sans-serif"
              }}>
                Suggested questions:
              </p>
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => setInput(question)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    backgroundColor: 'white',
                    border: '1px solid var(--aidstack-slate-light)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--aidstack-slate-dark)',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = 'var(--aidstack-light-gray)';
                    e.target.style.borderColor = 'var(--aidstack-navy)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.borderColor = 'var(--aidstack-slate-light)';
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'white',
          flexShrink: 0
        }}>
          {chatAttachments.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '10px'
            }}>
              {chatAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '7px 8px',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      minWidth: 0
                    }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--aidstack-navy)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {attachment.fileName}
                      </span>
                      {attachment.attachmentKind === 'document' && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: '#334155',
                          backgroundColor: 'rgba(100, 116, 139, 0.12)',
                          border: '1px solid rgba(100, 116, 139, 0.24)',
                          borderRadius: '999px',
                          padding: '1px 6px',
                          flexShrink: 0
                        }}>
                          document
                        </span>
                      )}
                      {attachment.promoteCandidate && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: '#166534',
                          backgroundColor: 'rgba(34, 197, 94, 0.12)',
                          border: '1px solid rgba(34, 197, 94, 0.24)',
                          borderRadius: '999px',
                          padding: '1px 6px',
                          flexShrink: 0
                        }}>
                          map-ready
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--aidstack-slate-medium)',
                      marginTop: '2px'
                    }}>
                      {attachment.attachmentKind === 'document'
                        ? `${Number(attachment.documentStats?.wordCount || 0).toLocaleString()} words · ${attachment.documentChunks?.length || 0} chunks`
                        : `${attachment.rowCount.toLocaleString()} rows · ${attachment.columns.length.toLocaleString()} columns`}
                      {attachment.attachmentKind !== 'document' && attachment.retainedRowCount < attachment.rowCount ? ` · ${attachment.retainedRowCount.toLocaleString()} retained` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    title="Remove attachment"
                    style={{
                      width: '28px',
                      height: '28px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      color: 'var(--aidstack-slate-medium)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachmentError && (
            <div style={{
              marginBottom: '8px',
              color: '#b91c1c',
              fontSize: '12px',
              fontFamily: "'Inter', sans-serif"
            }}>
              {attachmentError}
            </div>
          )}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end'
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json,.geojson,.pdf,.docx"
              onChange={handleAttachmentUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || attachmentLoading}
              title={attachmentLoading ? "Reading file..." : "Attach data file"}
              style={{
                width: '40px',
                height: '40px',
                padding: '0',
                backgroundColor: attachmentLoading ? '#e5e7eb' : 'white',
                color: attachmentLoading ? 'var(--aidstack-slate-light)' : 'var(--aidstack-navy)',
                border: '1.5px solid #e5e7eb',
                borderRadius: '12px',
                cursor: loading || attachmentLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {attachmentLoading ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              )}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about the map, admin areas, or loaded data..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1.5px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
                lineHeight: '18px',
                resize: 'none',
                minHeight: '48px',
                maxHeight: '100px',
                overflowY: input ? 'auto' : 'hidden',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              rows={2}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--aidstack-navy)'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              title={loading ? "Sending..." : "Send message"}
              style={{
                width: '40px',
                height: '40px',
                padding: '0',
                backgroundColor: input.trim() && !loading ? 'var(--aidstack-orange)' : '#e5e7eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {loading ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          </div>
        </div>

      <style jsx>{`
        .typing-indicator span {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--aidstack-slate-medium);
          animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 49% {
            opacity: 1;
          }
          50%, 100% {
            opacity: 0;
          }
        }
        .chat-table-wrap {
          overflow-x: auto;
          margin: 12px 0 16px 0;
          border: 1px solid #94a3b8;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
        }
        .chat-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--aidstack-slate-dark);
        }
        .chat-table th {
          text-align: left;
          padding: 12px 14px;
          background: #e2e8f0;
          border-bottom: 1px solid #94a3b8;
          color: #0f172a;
          font-weight: 700;
          letter-spacing: 0.01em;
          white-space: nowrap;
          font-family: 'Space Grotesk', sans-serif;
        }
        .chat-table th:not(:last-child),
        .chat-table td:not(:last-child) {
          border-right: 1px solid #cbd5e1;
        }
        .chat-table tbody tr:nth-child(even) {
          background: #f8fafc;
        }
        .chat-table tbody tr:hover {
          background: #e2e8f0;
        }
        .chat-table td {
          padding: 11px 14px;
          border-top: 1px solid #cbd5e1;
          vertical-align: top;
          color: #334155;
          background: transparent;
        }
        .chat-table tbody tr:first-child td {
          border-top: none;
        }
        .chat-table-cell-numeric {
          text-align: center;
          font-variant-numeric: tabular-nums;
        }
        .chat-table :global(p) {
          margin: 0;
        }
      `}</style>
    </div>
  );

  // Return embedded content or full drawer
  if (embedded) {
    return content;
  }

  return (
    <>
      <div className={`drawer-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div
        className={`drawer drawer-right ${isOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          zIndex: 3000,
          width: isExpanded
            ? `min(${CHAT_DRAWER_EXPANDED_WIDTH}px, 92vw)`
            : `min(${CHAT_DRAWER_WIDTH}px, 92vw)`,
          maxWidth: '92vw',
          display: 'flex',
          flexDirection: 'column',
          height: '90vh',
          maxHeight: '90vh',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="drawer-header" style={{
          background: 'linear-gradient(135deg, var(--aidstack-navy) 0%, #2D5A7B 100%)',
          color: 'white',
          margin: '-20px -20px 0 -20px',
          padding: '20px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{ flex: 1 }}>
            <h3 className="drawer-title" style={{color: 'white', fontFamily: "'Space Grotesk', sans-serif", marginBottom: context?.hasDistricts ? '8px' : '0'}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '10px'}}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              AI Assistant
            </h3>
            {context?.hasDistricts && context?.districts && (
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.8)',
                marginLeft: '30px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--aidstack-orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Area Analysis: {context.districts.country} ({context.districts.totalCount} admin areas)</span>
              </div>
            )}
          </div>
          <button
            onClick={onToggleExpand}
            title={isExpanded ? 'Collapse chat width' : 'Expand chat width'}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'white',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginRight: '8px',
              flexShrink: 0
            }}
          >
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 3 3 3 3 9"></polyline>
                <polyline points="15 21 21 21 21 15"></polyline>
                <line x1="3" y1="3" x2="10" y2="10"></line>
                <line x1="21" y1="21" x2="14" y2="14"></line>
              </svg>
            )}
          </button>
          <button className="drawer-close" onClick={onClose} style={{color: 'white'}}>×</button>
        </div>

        {content}
      </div>
    </>
  );
};

export default ChatDrawer;
