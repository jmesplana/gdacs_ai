import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facility, impacts, useAI } = req.body;

    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }

    // Handle case where there are no impacts (preparedness mode)
    const hasImpacts = impacts && impacts.length > 0;

    // Generate situation summary
    const situationSummary = hasImpacts
      ? createSituationSummary(facility, impacts)
      : `Facility '${facility.name || 'Unnamed facility'}' at coordinates ${facility.latitude}, ${facility.longitude} is currently not impacted by any active disasters. Provide preparedness and risk mitigation recommendations.`;
    
    // If OpenAI API key exists and AI is requested, use AI-powered recommendations
    if (process.env.OPENAI_API_KEY && useAI) {
      try {
        console.log(`Generating ${hasImpacts ? 'response' : 'preparedness'} recommendations...`);
        const recommendations = await generateAIRecommendations(facility, impacts || [], situationSummary, hasImpacts);
        res.status(200).json({ recommendations, isAIGenerated: true });
        return;
      } catch (aiError) {
        console.error('Error generating AI recommendations, falling back to mock:', aiError);
        // Fall back to mock recommendations if AI fails
      }
    }

    // For demo purposes, generate mock recommendations based on disaster types
    const recommendations = generateMockRecommendations(facility, impacts || [], hasImpacts);
    
    res.status(200).json({ recommendations, isAIGenerated: false });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate AI-powered recommendations
async function generateAIRecommendations(facility, impacts, situationSummary, hasImpacts) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Different prompts for response vs preparedness
    const prompt = hasImpacts ? `
You are a disaster management and emergency response expert. Based on the following information about
a facility and the disasters currently impacting it, provide detailed, actionable recommendations.

FACILITY DATA:
${JSON.stringify(facility, null, 2)}

DISASTER IMPACT ASSESSMENT:
${situationSummary}

Provide recommendations organized in these categories:
1. Immediate Safety Measures
2. Resource Mobilization
3. Evacuation Considerations
4. Communication Protocols
5. Medium-term Mitigation Strategies

Your response should be a JSON object with these categories as keys and arrays of specific recommendations as values.` : `
You are a disaster preparedness and risk management expert. Based on the following information about
a facility, provide detailed preparedness and risk mitigation recommendations.

FACILITY DATA:
${JSON.stringify(facility, null, 2)}

SITUATION:
${situationSummary}

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

// Generate recommendations using a simplified AI call
async function generateMockRecommendations(facility, impacts, hasImpacts) {
  try {
    // Try to use OpenAI with a simplified prompt for fallback
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Generate situation summary
    const situationSummary = hasImpacts
      ? createSituationSummary(facility, impacts)
      : `Facility '${facility.name || 'Unnamed facility'}' at coordinates ${facility.latitude}, ${facility.longitude} is currently not impacted by any active disasters.`;
    
    // Create a simplified prompt
    const prompt = hasImpacts ? `
    As a disaster management expert, provide recommendations for this facility impacted by disasters:

    ${situationSummary}

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
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a disaster management expert providing structured recommendations in JSON format."},
        {role: "user", content: prompt}
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });
    
    // Parse the response
    const recommendationsJSON = response.choices[0].message.content.trim();
    let recommendations = JSON.parse(recommendationsJSON);
    
    // Add a credit section if it doesn't exist
    if (!recommendations["Credits"]) {
      recommendations["Credits"] = ["Recommendations provided by John Mark Esplana's GDACS Facilities Impact Assessment Tool"];
    }
    
    return recommendations;
    
  } catch (error) {
    console.error("Error using OpenAI API for mock recommendations:", error);

    // Create minimal fallback recommendations if API call fails
    if (hasImpacts) {
      return {
        "Immediate Safety Measures": [
          "Conduct a comprehensive facility safety assessment",
          "Implement appropriate safety protocols based on disaster types"
        ],
        "Resource Mobilization": [
          "Prepare emergency supplies kit with food, water, and medical supplies",
          "Ensure communication equipment is charged and operational"
        ],
        "Evacuation Considerations": [
          "Identify safe evacuation routes",
          "Designate assembly points away from hazard zones"
        ],
        "Communication Protocols": [
          "Establish emergency communication channels for all staff",
          "Maintain regular contact with emergency services"
        ],
        "Medium-term Mitigation Strategies": [
          "Develop comprehensive disaster response plan",
          "Conduct regular drills and staff training"
        ]
      };
    } else {
      return {
        "Risk Assessment and Planning": [
          "Conduct comprehensive hazard and vulnerability assessment",
          "Develop facility-specific disaster preparedness plan",
          "Identify potential risks based on geographic location and facility type"
        ],
        "Infrastructure Hardening": [
          "Assess structural integrity and seismic resistance",
          "Install backup power systems and water storage",
          "Strengthen critical infrastructure elements"
        ],
        "Emergency Supplies and Resources": [
          "Stock emergency supplies (food, water, medical kits) for at least 72 hours",
          "Maintain inventory of emergency equipment and tools",
          "Establish supply chain backup for critical resources"
        ],
        "Staff Training and Drills": [
          "Conduct regular disaster preparedness drills",
          "Train staff on emergency protocols and first aid",
          "Designate and train emergency response team members"
        ],
        "Communication Systems": [
          "Install redundant communication systems (satellite, radio, cellular)",
          "Create emergency contact lists and update regularly",
          "Establish communication protocols with local authorities"
        ],
        "Early Warning Systems": [
          "Subscribe to local disaster alert systems",
          "Install environmental monitoring equipment as appropriate",
          "Develop standard operating procedures for alert response"
        ]
      };
    }
  }
}