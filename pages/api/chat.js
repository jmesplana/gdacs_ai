import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb', // Increased from default 1mb to handle large contexts
    },
  },
};

// Note: Web search is now handled natively by OpenAI's gpt-4o-search-preview model
// The model will automatically perform web searches when needed using the web_search tool

// Get current date and time
function getCurrentDateTime() {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0], // YYYY-MM-DD
    time: now.toUTCString(),
    timestamp: now.toISOString(),
    day: now.toLocaleDateString('en-US', { weekday: 'long' }),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    dayOfMonth: now.getDate()
  };
}

// Define tools for OpenAI function calling
const tools = [
  {
    type: "function",
    function: {
      name: "get_current_date",
      description: "Get the current date and time. Use this when you need to know today's date, the current year, or when discussing 'today', 'now', or 'current' time periods.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

// Web search configuration for Chat Completions API
// Note: For gpt-4o-search-preview, use web_search_options parameter instead of tools array
const webSearchOptions = {
  search_context_size: "high"
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, context, conversationHistory = [], stream = false } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Detect map interaction intents (highlight, show, filter districts)
    const mapIntent = detectMapIntent(message, context);
    console.log('Detected map intent:', mapIntent);

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({
        response: "I'm sorry, but the AI chat feature requires an OpenAI API key to be configured. Please contact your administrator.",
        isAIGenerated: false
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Debug: Log what context we received
    console.log('Chat API received context:', {
      facilities: context?.facilities?.length,
      disasters: context?.disasters?.length,
      acledData: context?.acledData?.length,
      acledEnabled: context?.acledEnabled
    });

    // Build context summary for the AI
    const contextSummary = buildContextSummary(context);

    // Log context size for debugging
    const contextSize = contextSummary.length;
    const estimatedTokens = Math.ceil(contextSize / 4); // Rough estimate: 1 token ≈ 4 chars
    console.log(`Context summary: ${contextSize} characters, ~${estimatedTokens} tokens`);

    // Debug: Log if ACLED section is in the summary
    if (contextSummary.includes('ACLED')) {
      console.log('✅ ACLED data IS in context summary');
    } else {
      console.log('❌ ACLED data NOT in context summary');
    }

    // Get current date
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentDateTime = new Date().toUTCString();

    // Build conversation messages
    const messages = [
      {
        role: "system",
        content: `You are an expert humanitarian aid and disaster response advisor with deep knowledge of:

**📅 CURRENT DATE & TIME**: Today is ${currentDate} (${currentDateTime}). Always use this date when discussing "today", "recent", or "current" events. You also have access to the 'get_current_date' function if you need to verify the current date during the conversation.

**🌐 WEB SEARCH CAPABILITY**: You have access to real-time web search through OpenAI's native web_search tool. Use this when:
- Users ask about recent events, current statistics, or up-to-date information
- You need to verify or supplement information about ongoing disasters
- Users request information about recent disease outbreaks, conflict events, or humanitarian situations
- You need current best practices, recent WHO/CDC guidelines, or latest operational guidance
- Any information that may have changed since your training data cutoff
- The web search is performed automatically by the model when needed

**🗓️ SEARCH RECENCY RULES — STRICTLY FOLLOW THESE**:
- Today is ${currentDate}. Always include the current year (${new Date().getFullYear()}) in your search queries to surface recent results (e.g., "Pakistan security situation ${new Date().getFullYear()}", "floods Pakistan ${new Date().getFullYear()}").
- When you find search results, CHECK THE DATE of each source. If a source is from before 2024, treat it as historical background only — do NOT present it as current information.
- If your search only returns results older than 12 months, explicitly tell the user: "I could only find information from [date] — this may be outdated. Please verify with current sources."
- NEVER present 2021, 2022, or 2023 data as if it describes the current situation without clearly stating the year it's from.
- For security situations, disease outbreaks, and conflict data: always search for the most recent 3-6 months of information.

**🌤️ WEATHER FORECAST DATA**: You have access to weather forecast data in your context when facilities or districts are loaded:
- Regional weather forecasts cover the operational area (center point of all facilities)
- District-level forecasts (when administrative boundaries are uploaded)
- Use weather data to assess campaign viability, predict disease outbreaks (cholera, malaria), and identify supply chain risks
- Weather warnings indicate flood risk, extreme temperatures, or conditions affecting operations
- Integrate weather with disaster data for comprehensive risk assessment

Core expertise areas:
- Disaster management and emergency response
- Public health programs (malaria, polio, immunization campaigns)
- SPHERE standards and humanitarian protocols
- WHO guidelines and CERF requirements
- Supply chain management in crisis contexts
- Field operations and logistics
- Campaign viability assessment and planning
- Alliance for Malaria Prevention (AMP) best practices and operational guidance
- ITN/LLIN distribution strategies (mass campaigns, routine channels, school-based)
- cLQAS (clustered Lot Quality Assurance Sampling) assessment procedures
- Digital tools for campaign monitoring (mobile data collection, geospatial planning, barcode scanning)
- Vector control in emergency settings
- Malaria response in humanitarian crises, armed conflict, and IDP settings

The user is viewing a disaster impact assessment tool. You have access to the current context of their situation including facility data, active disasters, and impact assessments.

Current Context:
${contextSummary}

Your role is to:
1. Answer questions about how disasters impact specific health programs and operations
2. Provide actionable recommendations based on the current situation
3. Help with scenario planning and decision-making
4. Explain technical humanitarian concepts in plain language
5. Reference specific facilities, disasters, and data from the context when relevant
6. When asked about facilities, you MUST reference the facilities list provided in the context above
7. **Campaign Planning Support**: When asked about campaign viability, feasibility, or "can I run a campaign at [facility]", provide guidance on:
   - Whether it's safe to proceed with health campaigns (malaria, immunization, etc.)
   - Specific risks for campaign teams and target populations
   - Cold chain considerations for vaccine programs
   - Population displacement and coverage implications
   - Timeline recommendations (go immediately, wait X days/weeks, postpone)
   - Mitigation strategies for identified risks
   - Resource adjustments needed (extra supplies, mobile teams, etc.)
8. **Malaria Program Expertise** (following AMP guidance):
   - ITN/LLIN distribution channel selection (mass campaign vs routine vs school-based based on context)
   - Post-disaster vector control intensification (floods create breeding sites, coordinate with WASH)
   - Expected malaria case surge: 40-60% increase after floods, 50% increase in ACT/RDT stock needed
   - Supply chain: Pre-positioning nets, barcode tracking, digitalization
   - At-risk populations: IDPs, conflict-affected areas, displaced communities
   - Assessment planning: Recommend cLQAS methodology (10-step process) for campaign quality assurance
   - Digital tools: Mobile data collection (BYOD), geospatial microplanning, real-time dashboards
9. **Assessment Procedures** (cLQAS methodology):
   - In-process evaluations: During household registration and distribution
   - End-process evaluations: Post-campaign coverage assessment
   - Rapid assessments: For emergency/disaster contexts
   - Recommend specific assessment timing based on campaign status and disaster situation

IMPORTANT:
- The user has uploaded facility data that is visible in the "FACILITIES LIST" section above. When asked questions like "which facilities have I added" or "what facilities do I have", you should list out the facilities from the FACILITIES LIST in the context, including their names, locations, types, and any other relevant details.
- **FACILITY DATA FIELDS**: If you see "📊 AI ANALYSIS FIELDS LOADED" in the context, the user has selected specific data fields for you to analyze. The actual data values from these fields are included in each facility's listing above (shown inline after the facility name and location). You MUST use this data to answer questions about facility characteristics, populations, disease prevalence, service coverage, or any other metrics the user asks about.
- For campaign planning questions, consider: disaster proximity, cold chain risks, access constraints, population displacement, staff safety, and program-specific needs (ACTs for malaria, vaccines for immunization)
- For malaria programs after floods: ALWAYS recommend 50% increase in ACT/RDT stock, coordinate with WASH for vector control, monitor for 40-60% case surge
- Provide GO/NO-GO/DELAY/CAUTION recommendations with clear rationale based on AMP and WHO best practices
- Suggest appropriate digital tools and assessment procedures when relevant

**DISTRICT-LEVEL ANALYSIS (When Administrative Boundaries Shapefile is Uploaded):**
- When a shapefile is uploaded, you have access to detailed district-level risk assessment data in the "ADMINISTRATIVE BOUNDARIES SHAPEFILE" section
- Focus your analysis on the specific geographic area covered by the shapefile (check the Country, Region, and Coverage Area)
- Reference specific districts by name when discussing risks, especially the examples provided in each risk category
- When the user asks you to "highlight" or "show" districts on the map (e.g., "highlight high risk districts", "show me no-go areas"):
  1. Explain which districts match their criteria based on the risk breakdown
  2. List specific district names if available
  3. Provide context about why these districts are at that risk level
  4. The system will AUTOMATICALLY highlight these districts on the map with orange pulsing borders
- Always frame your district analysis in the context of the uploaded shapefile area (e.g., "In [Country/Region], based on the uploaded administrative boundaries...")
- Use the risk breakdown percentages to give an overall security picture of the area
- When discussing campaign planning, reference which districts are safe vs. risky for operations

Be direct, practical, and specific. Use the context data to give personalized answers following AMP operational guidance. When districts are loaded, prioritize district-level analysis for geographic risk assessment.`
      }
    ];

    // Add conversation history (capped to last 20 messages to avoid token limit failures)
    conversationHistory.slice(-20).forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    // Call OpenAI API with streaming if requested
    if (stream) {
      // Set headers for SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.setHeader('Content-Encoding', 'none'); // Disable compression

      // Send headers immediately to establish connection
      res.flushHeaders();

      // If there's a map intent, send it first as a special command
      if (mapIntent) {
        res.write(`data: ${JSON.stringify({ mapCommand: mapIntent })}\n\n`);
        if (res.flush) res.flush();
      }

      console.log('📤 Calling OpenAI API with streaming...');
      console.log('Model:', "gpt-4o-search-preview");
      console.log('Web search enabled:', true);
      console.time('OpenAI stream start');

      try {
        const streamResponse = await openai.chat.completions.create({
          model: "gpt-4o-search-preview",
          messages: messages,
          max_tokens: 1500,
          stream: true,
          web_search_options: webSearchOptions
          // Note: gpt-4o-search-preview doesn't support tools or temperature parameters
        });

        console.timeEnd('OpenAI stream start');
        console.log('✅ OpenAI stream started, processing chunks...');

      let chunkCount = 0;
      let toolCalls = [];

      for await (const chunk of streamResponse) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;

        // Handle text content
        if (delta?.content) {
          chunkCount++;
          if (chunkCount === 1) {
            console.log('🎉 First chunk received!');
          }
          res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
          if (res.flush) res.flush();
        }

        // Handle tool calls (function calling)
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            if (toolCallDelta.index !== undefined) {
              // New tool call or continuing existing one
              if (!toolCalls[toolCallDelta.index]) {
                toolCalls[toolCallDelta.index] = {
                  id: toolCallDelta.id || '',
                  type: toolCallDelta.type || 'function',
                  function: {
                    name: toolCallDelta.function?.name || '',
                    arguments: toolCallDelta.function?.arguments || ''
                  }
                };
              } else {
                // Append to existing tool call
                if (toolCallDelta.function?.arguments) {
                  toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
                }
              }
            }
          }
        }

        // Check if finish reason indicates tool calls
        if (choice?.finish_reason === 'tool_calls' && toolCalls.length > 0) {
          console.log('🔧 AI requested tool calls:', toolCalls);

          // Execute tool calls
          const toolResults = [];
          for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'get_current_date') {
              try {
                const dateInfo = getCurrentDateTime();
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: 'get_current_date',
                  content: JSON.stringify(dateInfo, null, 2)
                });
                console.log('✅ Current date provided:', dateInfo.date);
              } catch (error) {
                console.error('Error getting current date:', error);
                toolResults.push({
                  tool_call_id: toolCall.id,
                  role: 'tool',
                  name: 'get_current_date',
                  content: `Error: ${error.message}`
                });
              }
            }
            // Note: web_search tool calls are handled natively by OpenAI
            // No need to manually execute them
          }

          // Make a second API call with tool results
          if (toolResults.length > 0) {
            messages.push({
              role: 'assistant',
              tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: tc.type,
                function: {
                  name: tc.function.name,
                  arguments: tc.function.arguments
                }
              }))
            });

            toolResults.forEach(result => {
              messages.push(result);
            });

            // Continue streaming with tool results
            const followUpStream = await openai.chat.completions.create({
              model: "gpt-4o-search-preview",
              messages: messages,
              max_tokens: 1500,
              stream: true,
              web_search_options: webSearchOptions
            });

            for await (const followUpChunk of followUpStream) {
              const followUpContent = followUpChunk.choices[0]?.delta?.content;
              if (followUpContent) {
                res.write(`data: ${JSON.stringify({ content: followUpContent })}\n\n`);
                if (res.flush) res.flush();
              }
            }
          }
        }
      }

      console.log(`✅ Stream complete. Total chunks: ${chunkCount}`);
      res.write('data: [DONE]\n\n');
      res.end();
      } catch (streamError) {
        console.error('❌ Streaming error:', streamError);
        console.error('Error details:', streamError.message);
        if (streamError.response) {
          console.error('OpenAI error response:', await streamError.response.json());
        }
        res.write(`data: ${JSON.stringify({ content: `Error: ${streamError.message}` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } else {
      // Non-streaming mode with web search
      let response = await openai.chat.completions.create({
        model: "gpt-4o-search-preview",
        messages: messages,
        max_tokens: 1500,
        web_search_options: webSearchOptions
        // Note: gpt-4o-search-preview doesn't support tools or temperature parameters
      });

      // Handle function calls if requested
      let finalResponse = response.choices[0].message;

      if (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
        console.log('🔧 AI requested tool calls (non-streaming)');

        // Add assistant message with tool calls to history
        messages.push(finalResponse);

        // Execute each tool call
        for (const toolCall of finalResponse.tool_calls) {
          if (toolCall.function.name === 'get_current_date') {
            try {
              const dateInfo = getCurrentDateTime();
              console.log(`📅 Providing current date: ${dateInfo.date}`);

              messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: 'get_current_date',
                content: JSON.stringify(dateInfo, null, 2)
              });
            } catch (error) {
              console.error('Error getting current date:', error);
              messages.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: 'get_current_date',
                content: `Error: ${error.message}`
              });
            }
          }
          // Note: web_search tool calls are handled natively by OpenAI
          // No need to manually execute them
        }

        // Make a second API call with tool results
        const followUpResponse = await openai.chat.completions.create({
          model: "gpt-4o-search-preview",
          messages: messages,
          max_tokens: 1500,
          web_search_options: webSearchOptions
        });

        finalResponse = followUpResponse.choices[0].message;
      }

      res.status(200).json({
        response: finalResponse.content,
        isAIGenerated: true
      });
    }

  } catch (error) {
    console.error('Error in chat API:', error);

    // Provide helpful fallback response
    res.status(200).json({
      response: "I apologize, but I encountered an error processing your question. Please try rephrasing your question or contact support if the issue persists.",
      isAIGenerated: false,
      error: error.message
    });
  }
}

function detectMapIntent(message, context) {
  if (!context || !context.hasDistricts) {
    return null; // No districts loaded, can't perform map actions
  }

  const lowerMessage = message.toLowerCase();

  // Keywords for highlighting/showing districts
  const highlightKeywords = ['highlight', 'show me', 'which districts', 'what districts', 'display', 'point out', 'identify', 'show', 'map', 'visualize'];
  const riskKeywords = ['high risk', 'very high risk', 'dangerous', 'unsafe', 'no go', 'no-go', 'risky', 'risk', 'threat'];
  const safeKeywords = ['safe', 'low risk', 'no risk', 'secure', 'clear', 'safe for operations'];

  // Check if the message is asking about districts or areas
  const hasDistrictMention = lowerMessage.includes('district') || lowerMessage.includes('area') || lowerMessage.includes('region') || lowerMessage.includes('location');

  // Check for highlight intent
  const hasHighlightIntent = highlightKeywords.some(keyword => lowerMessage.includes(keyword));

  // Check if this is a geographic or risk-related query about the districts
  const isGeographicQuery = hasDistrictMention || hasHighlightIntent;

  if (isGeographicQuery) {
    // Determine what to highlight
    const criteria = {};

    // Check for risk level mentions
    if (riskKeywords.some(keyword => lowerMessage.includes(keyword))) {
      // User wants to see high risk areas
      if (lowerMessage.includes('very high')) {
        criteria.riskLevels = ['very-high'];
      } else if (lowerMessage.includes('high')) {
        criteria.riskLevels = ['high', 'very-high'];
      } else if (lowerMessage.includes('no go') || lowerMessage.includes('no-go')) {
        criteria.riskLevels = ['very-high', 'high'];
      } else {
        // Generic "risk" or "risky" - show all at-risk districts
        criteria.riskLevels = ['high', 'very-high', 'medium'];
      }
    }

    if (safeKeywords.some(keyword => lowerMessage.includes(keyword))) {
      // User wants to see safe areas
      criteria.riskLevels = ['none', 'low'];
    }

    // Check for medium risk
    if (lowerMessage.includes('medium risk') || lowerMessage.includes('moderate')) {
      criteria.riskLevels = ['medium'];
    }

    // Check for "all districts" or general area questions
    if ((lowerMessage.includes('all') || lowerMessage.includes('entire') || lowerMessage.includes('whole')) &&
        (lowerMessage.includes('district') || lowerMessage.includes('area') || lowerMessage.includes('region'))) {
      // Show all districts regardless of risk
      criteria.riskLevels = ['very-high', 'high', 'medium', 'low', 'none'];
    }

    // Check for event count thresholds
    const eventMatch = lowerMessage.match(/(\d+)\s*(or more|events|incidents)/);
    if (eventMatch) {
      criteria.minEventCount = parseInt(eventMatch[1]);
    }

    // If we detected some criteria, return the intent
    if (Object.keys(criteria).length > 0) {
      console.log('✅ Map intent detected with criteria:', criteria);
      return {
        action: 'highlight_districts',
        criteria: criteria
      };
    }
  }

  return null;
}

function buildContextSummary(context) {
  if (!context) return "No context available.";

  let summary = [];

  // Facility information
  if (context.selectedFacility) {
    summary.push(`SELECTED FACILITY: ${context.selectedFacility.name}`);
    if (context.selectedFacility.type) {
      summary.push(`Type: ${context.selectedFacility.type}`);
    }
    summary.push(`Location: ${context.selectedFacility.latitude}, ${context.selectedFacility.longitude}`);

    // Include custom fields from uploaded data
    if (context.selectedFacility.customFields) {
      summary.push('\nAdditional Facility Information:');
      Object.entries(context.selectedFacility.customFields).forEach(([key, value]) => {
        summary.push(`- ${key}: ${value}`);
      });
    }
  }

  // Facilities overview
  if (context.totalFacilities) {
    summary.push(`\nTOTAL FACILITIES: ${context.totalFacilities}`);

    // Include facilities list (compact format for 200 facilities)
    if (context.facilities && context.facilities.length > 0) {
      const totalCount = context.totalFacilities;
      const shownCount = context.facilities.length;

      const aiAnalysisFields = context.aiAnalysisFields || [];

      // Debug logging
      console.log('Building facility list with AI fields:', aiAnalysisFields);
      if (context.facilities.length > 0) {
        console.log('Sample facility keys:', Object.keys(context.facilities[0]));
      }

      if (aiAnalysisFields.length > 0) {
        summary.push(`\n📊 FACILITIES DATABASE WITH AI ANALYSIS DATA (showing ${shownCount} of ${totalCount}):`);
        summary.push(`   The following fields are included for each facility: ${aiAnalysisFields.join(', ')}`);
      } else {
        summary.push(`\nFACILITIES DATABASE (showing ${shownCount} of ${totalCount}):`);
      }

      // Compact one-line format for each facility
      context.facilities.forEach((facility, idx) => {
        const parts = [`${idx + 1}. ${facility.name}`];

        // Add location (abbreviated)
        if (facility.latitude && facility.longitude) {
          parts.push(`@ ${parseFloat(facility.latitude).toFixed(2)},${parseFloat(facility.longitude).toFixed(2)}`);
        }

        // Add type if available
        if (facility.type) {
          parts.push(`[${facility.type}]`);
        }

        // Add country
        if (facility.country) {
          parts.push(`(${facility.country})`);
        }

        // Add ALL analysis fields (not just first 2) to ensure AI has complete data
        aiAnalysisFields.forEach(field => {
          if (facility[field] !== undefined && facility[field] !== null && facility[field] !== '') {
            const val = String(facility[field]).length > 30
              ? String(facility[field]).substring(0, 27) + '...'
              : facility[field];
            parts.push(`${field}=${val}`);
          }
        });

        summary.push(parts.join(' | '));
      });

      if (totalCount > shownCount) {
        summary.push(`\n[${totalCount - shownCount} additional facilities not shown]`);
      }

      if (aiAnalysisFields.length > 0) {
        summary.push(`\n📊 AI ANALYSIS FIELDS LOADED FOR ALL FACILITIES:`);
        summary.push(`   Fields available: ${aiAnalysisFields.join(', ')}`);
        summary.push(`   ✅ The data from these fields is included in each facility listing above`);
        summary.push(`   You can analyze trends, identify patterns, and answer questions about these field values`);
      }
    }
  }

  // Weather forecast information
  if (context.weatherForecast) {
    summary.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    summary.push(`WEATHER FORECAST DATA`);
    summary.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Regional forecast (Option 1)
    if (context.weatherForecast.regional) {
      const regional = context.weatherForecast.regional;
      summary.push(`\n🌤️ REGIONAL FORECAST (Operational Area):`);
      summary.push(`   Location: ${regional.location || 'Center of facility area'}`);
      summary.push(`   Coordinates: ${regional.latitude?.toFixed(2)}°, ${regional.longitude?.toFixed(2)}°`);
      summary.push(`   Forecast Period: Next ${regional.forecastDays} days`);

      if (regional.summary) {
        summary.push(`\n   📊 7-Day Summary:`);
        summary.push(`   • Total Rainfall: ${regional.summary.totalRainfall}mm`);
        summary.push(`   • Peak Rainfall: ${regional.summary.peakRainfall}mm (${regional.summary.peakRainfallDay})`);
        summary.push(`   • Temperature Range: ${regional.summary.minTemp}°C to ${regional.summary.maxTemp}°C`);
        summary.push(`   • Avg Wind Speed: ${regional.summary.avgWindSpeed} km/h`);
        summary.push(`   • Avg Humidity: ${regional.summary.avgHumidity}%`);
      }

      if (regional.warnings && regional.warnings.length > 0) {
        summary.push(`\n   ⚠️ WEATHER WARNINGS:`);
        regional.warnings.forEach(warning => {
          summary.push(`   • ${warning}`);
        });
      }

      if (regional.operationalImplications && regional.operationalImplications.length > 0) {
        summary.push(`\n   💡 Operational Implications:`);
        regional.operationalImplications.forEach(implication => {
          summary.push(`   • ${implication}`);
        });
      }
    }

    // District-level forecasts (Option 3)
    if (context.weatherForecast.districts && context.weatherForecast.districts.length > 0) {
      summary.push(`\n🗺️ DISTRICT-LEVEL WEATHER FORECASTS:`);
      summary.push(`   Showing weather for ${context.weatherForecast.districts.length} districts`);

      context.weatherForecast.districts.forEach(dist => {
        const warnings = dist.warnings && dist.warnings.length > 0
          ? ` ⚠️ ${dist.warnings.join(', ')}`
          : '';
        summary.push(`   • ${dist.name}: ${dist.totalRainfall}mm rain, ${dist.avgTemp}°C${warnings}`);
      });
    }

    summary.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  // Disaster information
  if (context.disasters && context.disasters.length > 0) {
    summary.push(`\nACTIVE DISASTERS (showing ${Math.min(context.disasters.length, 10)} most relevant):`);
    context.disasters.slice(0, 10).forEach(disaster => {
      summary.push(`- ${disaster.eventType}: ${disaster.eventName || disaster.title}`);
      summary.push(`  Alert Level: ${disaster.alertLevel || 'Unknown'}`);
      if (disaster.severity) summary.push(`  Severity: ${disaster.severity}`);
    });
    if (context.disasters.length > 10) {
      summary.push(`... context limited to most relevant disasters for performance`);
    }
  }

  // Impact statistics
  if (context.impactStatistics) {
    summary.push('\nIMPACT ASSESSMENT:');
    summary.push(`- Facilities Impacted: ${context.impactStatistics.facilitiesImpacted || 0}`);
    summary.push(`- Total Impacts: ${context.impactStatistics.totalImpacts || 0}`);
    if (context.impactStatistics.byDisasterType) {
      summary.push('- By Disaster Type:');
      Object.entries(context.impactStatistics.byDisasterType).forEach(([type, count]) => {
        summary.push(`  * ${type}: ${count}`);
      });
    }
  }

  // Impacted facilities
  if (context.impactedFacilities && context.impactedFacilities.length > 0) {
    summary.push(`\nIMPACTED FACILITIES (${context.impactedFacilities.length} total):`);
    context.impactedFacilities.slice(0, 5).forEach(item => {
      summary.push(`- ${item.facility.name}: ${item.impacts.length} disaster(s) affecting it`);
    });
    if (context.impactedFacilities.length > 5) {
      summary.push(`... and ${context.impactedFacilities.length - 5} more facilities`);
    }
  }

  // ACLED security data
  if (context.acledData && context.acledEnabled && context.acledData.length > 0) {
    const totalEvents = context.totalAcledEvents || context.acledData.length;
    summary.push(`\nACLED SECURITY DATA LOADED: ${totalEvents.toLocaleString()} total conflict events in system`);
    summary.push(`Context Sample: Showing ${context.acledData.length} filtered events for your analysis`);
    summary.push('Status: ACTIVE - Full ACLED dataset is being used in all security assessments');

    // Show active filters if any
    if (context.acledConfig) {
      const filters = [];
      if (context.acledConfig.dateRange) {
        filters.push(`Date Range: Last ${context.acledConfig.dateRange} days`);
      }
      if (context.acledConfig.selectedCountries && context.acledConfig.selectedCountries.length > 0) {
        filters.push(`Countries: ${context.acledConfig.selectedCountries.join(', ')}`);
      }
      if (context.acledConfig.selectedRegions && context.acledConfig.selectedRegions.length > 0) {
        filters.push(`Regions: ${context.acledConfig.selectedRegions.join(', ')}`);
      }
      if (context.acledConfig.eventTypes && context.acledConfig.eventTypes.length > 0) {
        filters.push(`Event Types: ${context.acledConfig.eventTypes.join(', ')}`);
      }

      if (filters.length > 0) {
        summary.push('\nACTIVE ACLED FILTERS:');
        filters.forEach(filter => summary.push(`  - ${filter}`));
      }
    }

    // Count recent incidents (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentIncidents = context.acledData.filter(event => {
      const eventDate = new Date(event.event_date);
      return eventDate >= thirtyDaysAgo;
    });

    if (recentIncidents.length > 0) {
      summary.push(`Recent Incidents (Last 30 days): ${recentIncidents.length}`);

      // Count by event type
      const incidentsByType = {};
      recentIncidents.forEach(incident => {
        const type = incident.event_type;
        incidentsByType[type] = (incidentsByType[type] || 0) + 1;
      });

      summary.push('Event Types:');
      Object.entries(incidentsByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          summary.push(`  - ${type}: ${count}`);
        });

      // Countries covered
      const countries = [...new Set(context.acledData.map(e => e.country).filter(Boolean))];
      if (countries.length > 0) {
        summary.push(`Countries covered: ${countries.slice(0, 10).join(', ')}${countries.length > 10 ? ` and ${countries.length - 10} more` : ''}`);
      }

      summary.push('\nNOTE: Security assessments are enhanced with this real ACLED conflict data for proximity analysis and risk scoring.');
    }
  } else if (context.acledData && !context.acledEnabled) {
    summary.push('\nACLED DATA: Uploaded but DISABLED - Not being used in analysis');
  }

  // District boundaries information (detailed)
  if (context.hasDistricts && context.districts) {
    const d = context.districts;
    summary.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    summary.push(`ADMINISTRATIVE BOUNDARIES SHAPEFILE (User-Uploaded)`);
    summary.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    summary.push(`\n📍 GEOGRAPHIC AREA:`);
    summary.push(`   Country: ${d.country}`);
    if (d.region && d.region !== 'Unknown') {
      summary.push(`   Region: ${d.region}`);
    }
    summary.push(`   Total Districts: ${d.totalCount}`);
    summary.push(`   Coverage Area: ${d.geographicBounds.minLat}°N to ${d.geographicBounds.maxLat}°N, ${d.geographicBounds.minLng}°E to ${d.geographicBounds.maxLng}°E`);
    summary.push(`   Center Point: ${d.geographicBounds.centerLat}°, ${d.geographicBounds.centerLng}°`);

    summary.push(`\n🎯 DISTRICT RISK ASSESSMENT (Based on Active Disasters & ACLED Security Events):`);
    const totalWithRisk = d.riskBreakdown['very-high'] + d.riskBreakdown.high + d.riskBreakdown.medium + d.riskBreakdown.low;
    summary.push(`   ⚠️  Very High Risk: ${d.riskBreakdown['very-high']} districts (NO-GO zones)`);
    summary.push(`   🔴 High Risk: ${d.riskBreakdown.high} districts (Extreme caution)`);
    summary.push(`   🟡 Medium Risk: ${d.riskBreakdown.medium} districts (Moderate caution)`);
    summary.push(`   🟢 Low Risk: ${d.riskBreakdown.low} districts (Minimal concerns)`);
    summary.push(`   🔵 No Risk: ${d.riskBreakdown.none} districts (Safe for operations)`);
    summary.push(`   📊 Total at Risk: ${totalWithRisk} of ${d.totalCount} districts (${((totalWithRisk / d.totalCount) * 100).toFixed(1)}%)`);

    // Show example districts for each risk level
    if (d.sampleDistricts['very-high'].length > 0) {
      summary.push(`\n   Very High Risk Examples:`);
      d.sampleDistricts['very-high'].forEach(dist => {
        summary.push(`      • ${dist.name} (${dist.eventCount} events, score: ${dist.score})`);
      });
    }

    if (d.sampleDistricts.high.length > 0) {
      summary.push(`\n   High Risk Examples:`);
      d.sampleDistricts.high.forEach(dist => {
        summary.push(`      • ${dist.name} (${dist.eventCount} events, score: ${dist.score})`);
      });
    }

    if (d.sampleDistricts.medium.length > 0) {
      summary.push(`\n   Medium Risk Examples:`);
      d.sampleDistricts.medium.forEach(dist => {
        summary.push(`      • ${dist.name} (${dist.eventCount} events, score: ${dist.score})`);
      });
    }

    summary.push(`\n💡 INTERACTIVE MAP FEATURES:`);
    summary.push(`   • Districts are color-coded by risk: Blue (none) → Green (low) → Yellow (medium) → Orange (high) → Red (very high)`);
    summary.push(`   • User can ask you to highlight specific districts, and you can trigger map highlighting`);
    summary.push(`   • Example queries: "highlight high risk districts", "show me no-go areas", "which districts are safe?"`);
    summary.push(`   • When user asks to highlight/show districts, explain which districts match and the system will automatically highlight them on the map`);
    summary.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  }

  // Recent analysis or recommendations
  if (context.recentAnalysis) {
    summary.push('\nRECENT ANALYSIS:');
    summary.push(context.recentAnalysis);
  }

  return summary.join('\n');
}

export default withRateLimit(handler);
