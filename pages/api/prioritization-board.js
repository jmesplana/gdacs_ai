import { withRateLimit } from '../../lib/rateLimit';
import { getCachedAIResult, setCachedAIResult } from '../../lib/ai/aiCache';
import { createPrioritizationCacheKey } from '../../lib/ai/aiCacheKey';
import { sendApiError } from '../../lib/validation/apiValidation';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MAX_DISTRICT_ROWS = 50;
const MAX_FACILITIES = 2000;
const MAX_SELECTED_DISTRICTS = 100;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  try {
    const {
      board = null,
      facilities = [],
      selectedDistricts = [],
      operationType = 'general'
    } = req.body || {};

    if (!board || !Array.isArray(board?.districtRows)) {
      return sendApiError(res, 400, 'INVALID_BOARD', 'board.districtRows is required');
    }

    if (board.districtRows.length > MAX_DISTRICT_ROWS) {
      return sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', `Too many district rows. Max ${MAX_DISTRICT_ROWS}.`);
    }

    if (!Array.isArray(facilities) || facilities.length > MAX_FACILITIES) {
      return sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', `Too many facilities. Max ${MAX_FACILITIES}.`);
    }

    if (!Array.isArray(selectedDistricts) || selectedDistricts.length > MAX_SELECTED_DISTRICTS) {
      return sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', `Too many selected districts. Max ${MAX_SELECTED_DISTRICTS}.`);
    }

    const enrichedBoard = await enrichBoardWithAI(board, {
      operationType,
      selectedDistricts,
      facilities
    });

    return res.status(200).json(enrichedBoard);
  } catch (error) {
    console.error('Error generating prioritization board:', error);
    return sendApiError(res, error.status || 500, error.code || 'PRIORITIZATION_BOARD_ERROR', error.message || 'Failed to generate prioritization board');
  }
}

function compactBoardRow(row = {}) {
  return {
    district: String(row.district || row.districtName || 'Unknown').slice(0, 120),
    priorityScore: row.priorityScore ?? row.score ?? null,
    priorityLevel: row.priorityLevel ?? row.level ?? null,
    recommendedAction: row.recommendedAction
      ? String(row.recommendedAction).slice(0, 300)
      : null,
    keyGaps: Array.isArray(row.keyGaps)
      ? row.keyGaps.slice(0, 5).map((gap) => String(gap).slice(0, 200))
      : [],
    soWhat: row.soWhat ? String(row.soWhat).slice(0, 600) : null,
    leadershipNote: row.leadershipNote
      ? String(row.leadershipNote).slice(0, 400)
      : null,
  };
}

async function enrichBoardWithAI(board, context) {
  if (!openai || !board?.districtRows?.length) return board;

  const districtRows = [...board.districtRows];
  const maxDistrictsToEnrich = Math.min(3, districtRows.length);

  const enrichedRows = await Promise.all(
    districtRows.slice(0, maxDistrictsToEnrich).map(async (row) => {
      try {
        const cacheKey = createPrioritizationCacheKey(row, context);
        const cached = await getCachedAIResult(cacheKey);

        if (cached) {
          return {
            ...row,
            ...cached,
            aiCacheHit: true,
          };
        }

        const today = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();
        const response = await openai.responses.create({
          model: process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4.1-mini',
          tools: [{ type: 'web_search' }],
          input: `You are helping an IFRC-style humanitarian prioritization board explain why a district matters and what to do next.

Prioritize recent, operationally relevant sources and choose sources based on the type of context needed:
- ReliefWeb for recent humanitarian situation reports, operational updates, and coordination products
- WHO for disease outbreaks, health risks, public health guidance, and health-system impacts
- IFRC for Red Cross Red Crescent operational updates, emergency appeals, response positioning, and network presence
- ICRC for conflict, protection, detention, access, and humanitarian law-related operational context
- UN / OCHA for access constraints, humanitarian overview, displacement, and coordination updates
- Other major credible humanitarian reporting only when the above do not provide enough recent signal

Today is ${today}.

Use the loaded row data first. Use web search only to add recent contextual developments for this exact district/area.

District row data:
${JSON.stringify(compactBoardRow(row), null, 2)}

Additional context:
${JSON.stringify({
  operationType: context.operationType,
  selectedAreaCount: context.selectedDistricts?.length || 0,
  facilityDataLoaded: (context.facilities?.length || 0) > 0
}, null, 2)}

Search for humanitarian context for "${row.district}" ${currentYear}, prioritizing ReliefWeb and operational updates.

Return valid JSON only with this shape:
{
  "soWhat": "2-4 sentences max",
  "recommendedAction": "1 sentence",
  "keyGaps": ["gap 1", "gap 2"],
  "leadershipNote": "1-2 sentences max",
  "recentContext": "1-3 sentences max",
  "recentSourceLabel": "short source label",
  "recentSourceDate": "YYYY-MM-DD or null",
  "recentSourceUrl": "https://...",
  "analysisSource": "AI + loaded data + web search"
}

Rules:
- Stay tightly grounded in the row data.
- Do not invent hazard, logistics, population, security, or nighttime-lights conclusions that are not already supported by the row data.
- If the row data shows missing evidence, preserve that limitation and mention what data the operator should load next.
- If web search adds nothing useful, say so briefly in recentContext and set recentSourceLabel/recentSourceUrl to null.
- When web search does add useful context, always include a source URL.
- Web context must prefer the most recent credible source available as of ${today}.
- First look for updates published on ${today}. If none exist, use the closest earlier credible update and include its exact publication date in recentSourceDate.
- Do not use older background articles when a newer humanitarian update is available from the same or a more authoritative source.
- If the newest credible item you find is materially old or stale for operations, say that clearly in recentContext.
- Prefer the most decision-relevant source, not just the most general source.
- Avoid weak or low-authority websites when a humanitarian or health primary source is available.
- Do not invent IFRC operations.
- Be operational, concise, and decision-oriented.`
        });

        const parsed = safeParseJson(response.output_text);
        if (!parsed) return row;

        await setCachedAIResult(cacheKey, parsed, 86400);

        return {
          ...row,
          soWhat: parsed.soWhat || row.soWhat,
          recommendedAction: parsed.recommendedAction || row.recommendedAction,
          keyGaps: Array.isArray(parsed.keyGaps) && parsed.keyGaps.length > 0 ? parsed.keyGaps : row.keyGaps,
          leadershipNote: parsed.leadershipNote || row.leadershipNote,
          recentContext: parsed.recentContext || null,
          recentSourceDate: parsed.recentSourceDate || null,
          recentSourceLabel: parsed.recentSourceLabel || extractFirstLink(row.recentContext)?.label || null,
          recentSourceUrl: parsed.recentSourceUrl || extractFirstLink(row.recentContext)?.url || null,
          analysisSource: parsed.analysisSource || 'AI + loaded data + web search',
          aiCacheHit: false,
        };
      } catch (error) {
        console.warn(`AI enrichment failed for ${row.district}:`, error.message);
        return row;
      }
    })
  );

  const enrichedMap = new Map(enrichedRows.map((row) => [row.district, row]));
  return {
    ...board,
    districtRows: districtRows.map((row) => enrichedMap.get(row.district) || row),
    summary: {
      ...board.summary,
      aiEnhanced: enrichedRows.length > 0
    }
  };
}

function safeParseJson(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractFirstLink(text) {
  if (!text) return null;
  const match = text.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (!match) return null;
  return { label: match[1], url: match[2] };
}

export default withRateLimit(handler, {
  keyPrefix: 'rl:prioritization-board',
  limit: 20,
  windowSecs: 3600,
});
