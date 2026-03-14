import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';
import { formatWorldPopForAI } from '../../utils/worldpopHelpers';

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
    const { facility, impacts, useAI, worldPopData = {}, worldPopYear = null, districts = [] } = req.body;

    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }

    // Handle case where there are no impacts (preparedness mode)
    const hasImpacts = impacts && impacts.length > 0;

    // Generate situation summary
    const situationSummary = hasImpacts
      ? createSituationSummary(facility, impacts)
      : `Facility '${facility.name || 'Unnamed facility'}' at coordinates ${facility.latitude}, ${facility.longitude} is currently not impacted by any active disasters. Provide preparedness and risk mitigation recommendations.`;
    
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI recommendations unavailable. Please check your API key configuration.' });
    }

    // Try primary AI recommendations
    if (useAI) {
      try {
        console.log(`Generating ${hasImpacts ? 'response' : 'preparedness'} recommendations...`);
        const recommendations = await generateAIRecommendations(
          facility,
          impacts || [],
          situationSummary,
          hasImpacts,
          worldPopData,
          worldPopYear,
          districts
        );
        res.status(200).json({ recommendations, isAIGenerated: true });
        return;
      } catch (aiError) {
        console.error('Error generating AI recommendations, trying simplified prompt:', aiError);
      }
    }

    // Try fallback with simplified prompt
    try {
      const recommendations = await generateFallbackRecommendations(
        facility,
        impacts || [],
        hasImpacts,
        worldPopData,
        worldPopYear,
        districts
      );
      res.status(200).json({ recommendations, isAIGenerated: true });
      return;
    } catch (_) {}

    res.status(503).json({ error: 'AI recommendations unavailable. Please check your API key configuration.' });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate AI-powered recommendations
async function generateAIRecommendations(facility, impacts, situationSummary, hasImpacts, worldPopData, worldPopYear, districts) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build population context if available
    let populationContext = '';
    if (worldPopData && Object.keys(worldPopData).length > 0) {
      const totalPop = Object.values(worldPopData).reduce((sum, d) => sum + (d.total || 0), 0);
      const under5 = Object.values(worldPopData).reduce((sum, d) => sum + (d.ageGroups?.under5 || 0), 0);
      const over60 = Object.values(worldPopData).reduce((sum, d) => sum + (d.ageGroups?.age60plus || 0), 0);
      const vulnerable = under5 + over60;
      const vulnPct = Math.round((vulnerable / totalPop) * 100);

      populationContext = `\n\nPOPULATION CONTEXT (WorldPop ${worldPopYear || 'data'}):
Total Population: ${totalPop.toLocaleString()}
Vulnerable Groups (Under 5 + Over 60): ${vulnerable.toLocaleString()} (${vulnPct}%)
- Under 5: ${under5.toLocaleString()}
- Over 60: ${over60.toLocaleString()}`;

      // Add detailed district data
      if (districts && districts.length > 0) {
        populationContext += formatWorldPopForAI(worldPopData, districts, worldPopYear || 'unknown');
      }
    }

    // Different prompts for response vs preparedness
    const prompt = hasImpacts ? `
You are a disaster management and emergency response expert. Based on the following information about
a facility and the disasters currently impacting it, provide detailed, actionable recommendations.

FACILITY DATA:
${JSON.stringify(facility, null, 2)}

DISASTER IMPACT ASSESSMENT:
${situationSummary}${populationContext}

Provide recommendations organized in these categories:
1. Immediate Safety Measures (prioritize vulnerable populations if data available)
2. Resource Mobilization (scale to population size)
3. Evacuation Considerations
4. Communication Protocols
5. Medium-term Mitigation Strategies

Your response should be a JSON object with these categories as keys and arrays of specific recommendations as values.
${populationContext ? 'IMPORTANT: Scale your resource and staffing recommendations to the actual population size and demographics provided.' : ''}` : `
You are a disaster preparedness and risk management expert. Based on the following information about
a facility, provide detailed preparedness and risk mitigation recommendations.

FACILITY DATA:
${JSON.stringify(facility, null, 2)}

SITUATION:
${situationSummary}${populationContext}

Provide preparedness recommendations organized in these categories:
1. Risk Assessment and Planning
2. Infrastructure Hardening
3. Emergency Supplies and Resources
4. Staff Training and Drills
5. Communication Systems
6. Early Warning Systems

Your response should be a JSON object with these categories as keys and arrays of specific recommendations as values.

Example format:
{
  "Risk Assessment and Planning": ["Recommendation 1", "Recommendation 2"],
  ...
}

Ensure your recommendations are:
- Specific to the facility type and the disasters affecting it
- Practical and actionable
- Prioritized by urgency and importance
- Based on established emergency management best practices
- Written in plain text without using curly braces, brackets, or other JSON formatting symbols within the text content itself
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a disaster management expert providing structured recommendations in JSON format. Avoid using JSON symbols like {}, [], or quotes within your text content. Provide clean, readable text for humans."},
        {role: "user", content: prompt}
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    const recommendationsJSON = response.choices[0].message.content.trim();
    let recommendations = JSON.parse(recommendationsJSON);
    
    // Remove credit sections
    if (recommendations["Credits"]) {
      delete recommendations["Credits"];
    }
    if (recommendations["About"]) {
      delete recommendations["About"];
    }
    
    return recommendations;
  } catch (error) {
    console.error("Error using OpenAI API:", error);
    throw error;
  }
}

function createSituationSummary(facility, impacts) {
  const facilityName = facility.name || 'Unnamed facility';
  const facilityLocation = `${facility.latitude}, ${facility.longitude}`;
  
  let summary = `Facility '${facilityName}' at coordinates ${facilityLocation} is potentially impacted by the following disasters:\n\n`;
  
  for (const impact of impacts) {
    const disaster = impact.disaster || {};
    const distance = impact.distance || 'unknown';
    
    const disasterType = disaster.eventType || 'unknown';
    const disasterName = disaster.eventName || disaster.title || 'Unnamed disaster';
    const alertLevel = disaster.alertLevel || 'unknown';
    
    // Map disaster type codes to human-readable names
    const disasterTypeNames = {
      'eq': 'Earthquake',
      'tc': 'Tropical Cyclone',
      'fl': 'Flood',
      'vo': 'Volcanic Activity',
      'dr': 'Drought',
      'wf': 'Wildfire',
      'ts': 'Tsunami'
    };
    
    const disasterTypeName = disasterTypeNames[disasterType.toLowerCase()] || disasterType;
    
    summary += `- ${disasterTypeName}: ${disasterName}, Alert Level: ${alertLevel}\n`;
    summary += `  Distance: ${distance} km from facility\n`;
    summary += `  Details: ${disaster.description || 'No details available'}\n\n`;
  }
  
  return summary;
}

// Generate recommendations using a simplified AI call (fallback)
async function generateFallbackRecommendations(facility, impacts, hasImpacts, worldPopData, worldPopYear, districts) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const situationSummary = hasImpacts
    ? createSituationSummary(facility, impacts)
    : `Facility '${facility.name || 'Unnamed facility'}' at coordinates ${facility.latitude}, ${facility.longitude} is currently not impacted by any active disasters.`;

  // Build population context if available
  let populationContext = '';
  if (worldPopData && Object.keys(worldPopData).length > 0) {
    const totalPop = Object.values(worldPopData).reduce((sum, d) => sum + (d.total || 0), 0);
    populationContext = `\n\nPopulation served: ${totalPop.toLocaleString()} (WorldPop ${worldPopYear || 'data'})`;
  }

  const prompt = hasImpacts ? `
  As a disaster management expert, provide recommendations for this facility impacted by disasters:

  ${situationSummary}${populationContext}

  Provide recommendations in these categories:
  1. Immediate Safety Measures
  2. Resource Mobilization
  3. Evacuation Considerations
  4. Communication Protocols
  5. Medium-term Mitigation Strategies

  Format your response as a JSON object with these categories as keys and arrays of specific recommendations as values.
  Do not use JSON symbols like {}, [], or quotes within your text content.
  ` : `
  As a disaster preparedness expert, provide preparedness recommendations for this facility:

  ${situationSummary}

  Provide recommendations in these categories:
  1. Risk Assessment and Planning
  2. Infrastructure Hardening
  3. Emergency Supplies and Resources
  4. Staff Training and Drills
  5. Communication Systems
  6. Early Warning Systems

  Format your response as a JSON object with these categories as keys and arrays of specific recommendations as values.
  Do not use JSON symbols like {}, [], or quotes within your text content.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {role: "system", content: "You are a disaster management expert providing structured recommendations in JSON format."},
      {role: "user", content: prompt}
    ],
    response_format: { type: "json_object" },
    temperature: 0.7
  });

  const recommendationsJSON = response.choices[0].message.content.trim();
  let recommendations = JSON.parse(recommendationsJSON);

  if (recommendations["Credits"]) delete recommendations["Credits"];
  if (recommendations["About"]) delete recommendations["About"];

  return recommendations;
}
export default withRateLimit(handler);
