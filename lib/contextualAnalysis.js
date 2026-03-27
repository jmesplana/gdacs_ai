import { buildFacilityContextualAnalysis, buildPrioritizationBoard } from './prioritizationBoard';

function summarizeBoard(board = null) {
  if (!board?.districtRows?.length) return null;

  return {
    generatedAt: board.generatedAt || new Date().toISOString(),
    scopeType: 'selected_districts',
    summary: board.summary || null,
    topAreas: board.districtRows.slice(0, 5).map((row) => ({
      rank: row.rank,
      district: row.district,
      priorityScore: row.priorityScore,
      priorityLevel: row.priorityLevel,
      posture: row.posture,
      recommendedAction: row.recommendedAction,
      keyGaps: row.keyGaps || [],
      disasterCount: row.disasterCount ?? 0,
      acledCount: row.acledCount ?? 0,
      populationEstimate: row.populationEstimate ?? null,
      leadershipNote: row.leadershipNote || null,
      soWhat: row.soWhat || null
    })),
    facilityFocus: board.facilityRows?.slice(0, 5).map((row) => ({
      rank: row.rank,
      name: row.facility?.name || null,
      district: row.district,
      priorityScore: row.priorityScore,
      priorityLevel: row.priorityLevel,
      topDriver: row.topDriver,
      recommendedAction: row.recommendedAction,
      rationale: row.rationale
    })) || []
  };
}

export function buildChatContextualAnalysis(context = {}, operationType = 'general') {
  if (context?.prioritizationBoard?.districtRows?.length) {
    return summarizeBoard(context.prioritizationBoard);
  }

  if (Array.isArray(context?.selectedAnalysisDistricts) && context.selectedAnalysisDistricts.length > 0) {
    try {
      const board = buildPrioritizationBoard({
        facilities: context.facilities || [],
        impactedFacilities: context.impactedFacilities || [],
        disasters: context.disasters || [],
        acledData: context.acledData || [],
        districts: context.districts?.features || [],
        selectedDistricts: context.selectedAnalysisDistricts,
        worldPopData: context.worldPopData || {},
        osmData: context.osmData || null,
        operationType
      });

      return summarizeBoard(board);
    } catch (error) {
      console.warn('Unable to build contextual analysis from chat scope:', error);
    }
  }

  if (context?.selectedFacility) {
    try {
      return buildFacilityContextualAnalysis({
        facility: context.selectedFacility,
        impacts: context.selectedFacilityImpacts || [],
        acledData: context.acledData || [],
        selectedDistricts: context.selectedAnalysisDistricts || [],
        worldPopData: context.worldPopData || {},
        operationType
      });
    } catch (error) {
      console.warn('Unable to build facility contextual analysis for chat:', error);
    }
  }

  return null;
}

export function formatContextualAnalysisForPrompt(contextualAnalysis = null) {
  if (!contextualAnalysis) return '';

  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'CONTEXTUAL ANALYSIS LAYER',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  if (contextualAnalysis.scopeType === 'selected_districts') {
    const summary = contextualAnalysis.summary || {};
    lines.push(`Scope: ${summary.selectedAreaCount || contextualAnalysis.topAreas?.length || 0} selected admin area(s)`);
    if (summary.operationName) lines.push(`Operation lens: ${summary.operationName}`);
    if (summary.confidence?.level) {
      lines.push(`Confidence: ${summary.confidence.level}`);
      if (summary.confidence.availableSignals?.length) {
        lines.push(`Available signals: ${summary.confidence.availableSignals.join(', ')}`);
      }
      if (summary.confidence.missingSignals?.length) {
        lines.push(`Missing signals: ${summary.confidence.missingSignals.join(', ')}`);
      }
    }
    lines.push('');
    lines.push('Top priority areas:');
    contextualAnalysis.topAreas?.forEach((area) => {
      lines.push(`- Rank ${area.rank}: ${area.district} | ${area.priorityLevel} (${area.priorityScore}/100) | ${area.posture}`);
      if (area.recommendedAction) lines.push(`  Recommended action: ${area.recommendedAction}`);
      if (area.soWhat) lines.push(`  Why it matters: ${area.soWhat}`);
      if (area.keyGaps?.length) lines.push(`  Key gaps: ${area.keyGaps.join(' | ')}`);
    });
  } else if (contextualAnalysis.scopeType === 'facility') {
    lines.push(`Scope: facility`);
    lines.push(`Facility: ${contextualAnalysis.facilityName}`);
    lines.push(`Priority: ${contextualAnalysis.priorityLevel} (${contextualAnalysis.priorityScore}/100)`);
    lines.push(`Posture: ${contextualAnalysis.posture}`);
    lines.push(`Top driver: ${contextualAnalysis.topDriver}`);
    if (contextualAnalysis.recommendedAction) lines.push(`Recommended action: ${contextualAnalysis.recommendedAction}`);
    if (contextualAnalysis.rationale) lines.push(`Rationale: ${contextualAnalysis.rationale}`);
    if (contextualAnalysis.confidence?.level) {
      lines.push(`Confidence: ${contextualAnalysis.confidence.level}`);
    }
  }

  lines.push('⚡ IMPORTANT: Treat this contextual analysis layer as the synthesized decision baseline. Use it before free-form interpretation.');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return lines.join('\n');
}

export function buildFacilityAnalysisContext(params = {}) {
  return buildFacilityContextualAnalysis(params);
}
