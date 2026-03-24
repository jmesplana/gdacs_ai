import { withRateLimit } from '../../lib/rateLimit';
import { buildPrioritizationBoard } from '../../lib/prioritizationBoard';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      facilities = [],
      impactedFacilities = [],
      disasters = [],
      acledData = [],
      districts = [],
      selectedDistricts = [],
      worldPopData = {},
      osmData = null,
      operationType = 'general'
    } = req.body || {};

    if (!Array.isArray(selectedDistricts) || selectedDistricts.length === 0) {
      return res.status(400).json({ error: 'selectedDistricts array is required' });
    }

    const board = buildPrioritizationBoard({
      facilities,
      impactedFacilities,
      disasters,
      acledData,
      districts,
      selectedDistricts,
      worldPopData,
      osmData,
      operationType
    });

    const enrichedBoard = await enrichBoardWithAI(board, {
      operationType,
      selectedDistricts,
      facilities
    });

    return res.status(200).json(enrichedBoard);
  } catch (error) {
    console.error('Error generating prioritization board:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate prioritization board' });
  }
}

async function enrichBoardWithAI(board, context) {
  if (!openai || !board?.districtRows?.length) return board;

  const districtRows = [...board.districtRows];
  const maxDistrictsToEnrich = Math.min(3, districtRows.length);

  const enrichedRows = await Promise.all(
    districtRows.slice(0, maxDistrictsToEnrich).map(async (row) => {
      try {
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
${JSON.stringify(row, null, 2)}

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
          analysisSource: parsed.analysisSource || 'AI + loaded data + web search'
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

export default withRateLimit(handler);
