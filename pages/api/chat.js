import OpenAI from 'openai';

export const config = {
  api: {
    responseLimit: false,
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

    // Build context summary for the AI
    const contextSummary = buildContextSummary(context);

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

IMPORTANT: The user has uploaded facility data that is visible in the "FACILITIES LIST" section above. When asked questions like "which facilities have I added" or "what facilities do I have", you should list out the facilities from the FACILITIES LIST in the context, including their names, locations, types, and any other relevant details.

Be direct, practical, and specific. Use the context data to give personalized answers.`
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
      summary.push('\nFACILITIES LIST:');
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
    summary.push(`\nACTIVE DISASTERS (${context.disasters.length} total):`);
    context.disasters.slice(0, 10).forEach(disaster => {
      summary.push(`- ${disaster.eventType}: ${disaster.eventName || disaster.title}`);
      summary.push(`  Alert Level: ${disaster.alertLevel || 'Unknown'}`);
      if (disaster.severity) summary.push(`  Severity: ${disaster.severity}`);
    });
    if (context.disasters.length > 10) {
      summary.push(`... and ${context.disasters.length - 10} more disasters`);
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

  // Recent analysis or recommendations
  if (context.recentAnalysis) {
    summary.push('\nRECENT ANALYSIS:');
    summary.push(context.recentAnalysis);
  }

  return summary.join('\n');
}
