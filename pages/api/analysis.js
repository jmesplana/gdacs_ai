import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';
import { buildFacilityAnalysisContext } from '../../lib/contextualAnalysis';

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
      facility,
      impacts,
      acledData = [],
      worldPopData = {},
      selectedDistricts = [],
      operationType = 'general',
      nighttimeLightsLoaded = false,
      activeMapLayerName = null,
      activeMapLayerNote = null
    } = req.body;
    console.log('API received facility:', facility?.name);
    console.log('API received impacts count:', impacts?.length || 0);

    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }
    
    const contextualAnalysis = buildFacilityAnalysisContext({
      facility,
      impacts: impacts || [],
      acledData,
      worldPopData,
      selectedDistricts,
      operationType
    });

    // Check if OpenAI API is available
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Generating AI analysis...');
        const analysis = await generateAIAnalysis(facility, impacts, contextualAnalysis, {
          nighttimeLightsLoaded,
          activeMapLayerName,
          activeMapLayerNote
        });
        res.status(200).json({ analysis, isAIGenerated: true });
        return;
      } catch (aiError) {
        console.error('Error generating AI analysis, trying simplified prompt:', aiError);
        // Fall through to simplified fallback below
      }
    }

    // Fallback: try a simpler OpenAI prompt if the main call failed
    if (process.env.OPENAI_API_KEY) {
      try {
        const analysis = await generateFallbackAnalysis(facility, impacts, contextualAnalysis, {
          nighttimeLightsLoaded,
          activeMapLayerName,
          activeMapLayerNote
        });
        res.status(200).json({ analysis, isAIGenerated: true });
        return;
      } catch (_) {}
    }

    res.status(503).json({ error: 'AI analysis unavailable. Please check your API key configuration.' });
  } catch (error) {
    console.error('Error generating analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate AI-powered facility analysis
async function generateAIAnalysis(facility, impacts, contextualAnalysis, layerContext = {}) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Create prompt for GPT
    const prompt = `
You are a disaster risk analysis expert. Based on the following information about
a facility and its potential exposure to disasters, provide a comprehensive risk analysis.

FACILITY DATA:
${JSON.stringify(facility, null, 2)}

DISASTER EXPOSURE:
${impacts && impacts.length > 0 ? JSON.stringify(impacts.map(i => ({
  disasterType: i.disaster.eventType,
  disasterName: i.disaster.title,
  alertLevel: i.disaster.alertLevel,
  distance: i.distance,
  description: i.disaster.description
})), null, 2) : "No current disaster exposure data available."}

CONTEXTUAL ANALYSIS LAYER:
${JSON.stringify(contextualAnalysis, null, 2)}

MAP / EVIDENCE LAYER STATUS:
${JSON.stringify({
  nighttimeLightsLoaded: Boolean(layerContext.nighttimeLightsLoaded),
  activeMapLayerName: layerContext.activeMapLayerName || null,
  activeMapLayerNote: layerContext.activeMapLayerNote || null,
  guidance: layerContext.nighttimeLightsLoaded
    ? 'Nighttime lights context is loaded and may be used for settlement footprint, infrastructure concentration, and broad electrification context.'
    : 'Nighttime lights context is NOT loaded. Do not infer from nighttime lights. If that context would be useful, tell the user to switch the map layer to Nighttime Lights (GEE).'
}, null, 2)}

Provide a structured analysis with the following sections:
1. Executive Summary - A brief overview of the facility's risk profile
2. Vulnerability Assessment - Analysis of facility vulnerabilities based on its type, location, and features
3. Impact Scenarios - Potential impact scenarios from current or future disasters
4. Risk Rating - Overall risk rating (High/Medium/Low) with explanation
5. Potential Health Risks - Health risks associated with the disaster exposure
6. Recommended Monitoring - Specific monitoring recommendations

Format your response as a JSON object with these section headings as keys and detailed analysis as values. Do not use curly braces, brackets, or other JSON formatting symbols within the text content itself - provide clean, readable text for each section.
Treat the contextual analysis layer as the primary decision baseline, then use raw facility and disaster data as supporting evidence.
If nighttime lights are not loaded, do not make claims based on nighttime light patterns. State that the layer is not loaded and recommend switching to Nighttime Lights (GEE) if that context is needed.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a disaster risk analysis expert providing structured analysis in JSON format. Avoid using JSON symbols like {}, [], or quotes within your text content. Provide clean, readable text for humans."},
        {role: "user", content: prompt}
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const analysisJSON = response.choices[0].message.content.trim();
    let analysis = JSON.parse(analysisJSON);
    
    // Remove any About section if present
    if (analysis["About"]) {
      delete analysis["About"];
    }
    
    return analysis;
  } catch (error) {
    console.error("Error using OpenAI API:", error);
    throw error;
  }
}

// Simplified fallback analysis prompt (used when primary call fails)
async function generateFallbackAnalysis(facility, impacts, contextualAnalysis, layerContext = {}) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get base disaster information
    const hasImpacts = impacts && impacts.length > 0;
    const disasterInfo = hasImpacts ? 
      impacts.map(i => ({
        type: i.disaster.eventType,
        name: i.disaster.title,
        alertLevel: i.disaster.alertLevel,
        distance: i.distance
      })) : [];
    
    // Create a simplified prompt
    const prompt = `
    As a disaster risk analysis expert, provide a comprehensive risk analysis for a facility based on this data:
    
    FACILITY: ${JSON.stringify(facility, null, 2)}
    
    DISASTER EXPOSURE: ${JSON.stringify(disasterInfo, null, 2)}

    CONTEXTUAL ANALYSIS LAYER: ${JSON.stringify(contextualAnalysis, null, 2)}

    MAP / EVIDENCE LAYER STATUS: ${JSON.stringify({
      nighttimeLightsLoaded: Boolean(layerContext.nighttimeLightsLoaded),
      activeMapLayerName: layerContext.activeMapLayerName || null,
      activeMapLayerNote: layerContext.activeMapLayerNote || null
    }, null, 2)}
    
    Provide a structured analysis with these sections:
    1. Executive Summary - Brief overview of the facility's risk profile
    2. Vulnerability Assessment - Analysis of facility vulnerabilities
    3. Impact Scenarios - Potential impact scenarios
    4. Risk Rating - Overall risk rating (High/Medium/Low) with explanation
    5. Potential Health Risks - Health risks associated with the disaster exposure
    6. Recommended Monitoring - Specific monitoring recommendations
    
    Format your response as a JSON object with these section headings as keys and detailed analysis as values.
    Avoid using JSON symbols like {}, [], or quotes within your text content.
    Treat the contextual analysis layer as the primary decision baseline, then use raw facility and disaster data as supporting evidence.
    If nighttime lights are not loaded, do not make nighttime-light claims. Instead say that context is not currently loaded and suggest switching the map to Nighttime Lights (GEE) if that evidence would help.
    `;
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a disaster risk analysis expert providing structured analysis in JSON format."},
        {role: "user", content: prompt}
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    // Parse the response
    const analysisJSON = response.choices[0].message.content.trim();
    let analysis = JSON.parse(analysisJSON);
    
    return analysis;

  } catch (error) {
    console.error("Error using OpenAI API for fallback analysis:", error);
    throw error;
  }
}

export default withRateLimit(handler);
