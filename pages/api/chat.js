import OpenAI from 'openai';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '4mb', // Increased from default 1mb to handle large contexts
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

Be direct, practical, and specific. Use the context data to give personalized answers following AMP operational guidance.`
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
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      const streamResponse = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      });

      for await (const chunk of streamResponse) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
          // Flush the response to ensure it's sent immediately
          if (res.flush) res.flush();
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
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

    // Include list of all facilities for better context
    if (context.facilities && context.facilities.length > 0) {
      const facilityCount = context.facilities.length;
      const totalCount = context.totalFacilities;
      summary.push(`\nFACILITIES LIST (showing ${facilityCount} of ${totalCount}):`);
      const aiAnalysisFields = context.aiAnalysisFields || [];

      context.facilities.forEach((facility, index) => {
        const facilityInfo = [`${index + 1}. ${facility.name}`];

        // Include location
        if (facility.latitude && facility.longitude) {
          facilityInfo.push(`Location: ${facility.latitude}, ${facility.longitude}`);
        }

        // Include type if available
        if (facility.type || facility.facilityType || facility.category) {
          facilityInfo.push(`Type: ${facility.type || facility.facilityType || facility.category}`);
        }

        // Include country if available
        if (facility.country) {
          facilityInfo.push(`Country: ${facility.country}`);
        }

        // Include ONLY the fields that were selected for AI analysis
        if (aiAnalysisFields.length > 0) {
          aiAnalysisFields.forEach(fieldName => {
            if (facility[fieldName] !== undefined && facility[fieldName] !== null && facility[fieldName] !== '') {
              const displayValue = String(facility[fieldName]).length > 100
                ? String(facility[fieldName]).substring(0, 97) + '...'
                : facility[fieldName];
              facilityInfo.push(`${fieldName}: ${displayValue}`);
            }
          });
        }

        summary.push(`  ${facilityInfo.join(' | ')}`);
      });

      // Add a note about which fields are being analyzed
      if (aiAnalysisFields.length > 0) {
        summary.push(`\nAI ANALYSIS FIELDS: ${aiAnalysisFields.join(', ')}`);
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

  // Recent analysis or recommendations
  if (context.recentAnalysis) {
    summary.push('\nRECENT ANALYSIS:');
    summary.push(context.recentAnalysis);
  }

  return summary.join('\n');
}
