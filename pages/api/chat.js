import OpenAI from 'openai';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '10mb', // Increased from default 1mb to handle large contexts
    },
  },
};

export default async function handler(req, res) {
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

    // Build conversation messages
    const messages = [
      {
        role: "system",
        content: `You are an expert humanitarian aid and disaster response advisor with deep knowledge of:
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

    // Add conversation history
    conversationHistory.forEach(msg => {
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
      console.time('OpenAI stream start');

      const streamResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: true
      });

      console.timeEnd('OpenAI stream start');
      console.log('✅ OpenAI stream started, processing chunks...');

      let chunkCount = 0;
      for await (const chunk of streamResponse) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          chunkCount++;
          if (chunkCount === 1) {
            console.log('🎉 First chunk received!');
          }
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          // Flush the response to ensure it's sent immediately
          if (res.flush) res.flush();
        }
      }

      console.log(`✅ Stream complete. Total chunks: ${chunkCount}`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500
      });

      const aiResponse = response.choices[0].message.content;

      res.status(200).json({
        response: aiResponse,
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

      summary.push(`\nFACILITIES DATABASE (showing ${shownCount} of ${totalCount}):`);

      const aiAnalysisFields = context.aiAnalysisFields || [];

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

        // Add first 2 analysis fields, truncated
        aiAnalysisFields.slice(0, 2).forEach(field => {
          if (facility[field]) {
            const val = String(facility[field]).length > 25
              ? String(facility[field]).substring(0, 22) + '...'
              : facility[field];
            parts.push(`${field}:${val}`);
          }
        });

        summary.push(parts.join(' | '));
      });

      if (totalCount > shownCount) {
        summary.push(`\n[${totalCount - shownCount} additional facilities not shown]`);
      }

      if (aiAnalysisFields.length > 0) {
        summary.push(`\nAvailable fields: ${aiAnalysisFields.join(', ')}`);
      }
    }
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
