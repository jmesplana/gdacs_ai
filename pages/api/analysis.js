import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facility, impacts } = req.body;
    
    if (!facility) {
      return res.status(400).json({ error: 'Missing facility data' });
    }
    
    // Check if OpenAI API is available
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('Generating AI analysis...');
        const analysis = await generateAIAnalysis(facility, impacts);
        res.status(200).json({ analysis, isAIGenerated: true });
        return;
      } catch (aiError) {
        console.error('Error generating AI analysis, falling back to mock:', aiError);
        // Fall back to mock if AI fails
      }
    }
    
    // Generate mock analysis if no API key or if AI generation fails
    const analysis = generateMockAnalysis(facility, impacts);
    res.status(200).json({ analysis, isAIGenerated: false });
  } catch (error) {
    console.error('Error generating analysis:', error);
    res.status(500).json({ error: error.message });
  }
}

// Generate AI-powered facility analysis
async function generateAIAnalysis(facility, impacts) {
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

Provide a structured analysis with the following sections:
1. Executive Summary - A brief overview of the facility's risk profile
2. Vulnerability Assessment - Analysis of facility vulnerabilities based on its type, location, and features
3. Impact Scenarios - Potential impact scenarios from current or future disasters
4. Risk Rating - Overall risk rating (High/Medium/Low) with explanation
5. Potential Health Risks - Health risks associated with the disaster exposure
6. Recommended Monitoring - Specific monitoring recommendations

Format your response as a JSON object with these section headings as keys and detailed analysis as values. Do not use curly braces, brackets, or other JSON formatting symbols within the text content itself - provide clean, readable text for each section.
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

// Generate analysis using simplified OpenAI call if main one fails
async function generateMockAnalysis(facility, impacts) {
  try {
    // Try to use OpenAI with a simplified prompt for fallback
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
    
    Provide a structured analysis with these sections:
    1. Executive Summary - Brief overview of the facility's risk profile
    2. Vulnerability Assessment - Analysis of facility vulnerabilities
    3. Impact Scenarios - Potential impact scenarios
    4. Risk Rating - Overall risk rating (High/Medium/Low) with explanation
    5. Potential Health Risks - Health risks associated with the disaster exposure
    6. Recommended Monitoring - Specific monitoring recommendations
    
    Format your response as a JSON object with these section headings as keys and detailed analysis as values.
    Avoid using JSON symbols like {}, [], or quotes within your text content.
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
    
    // Add a credit line
    if (analysis["About"]) {
      analysis["About"] += " | Developed by John Mark Esplana (https://github.com/jmesplana)";
    } else {
      analysis["About"] = "Developed by John Mark Esplana (https://github.com/jmesplana)";
    }
    
    return analysis;
    
  } catch (error) {
    console.error("Error using OpenAI API for mock analysis:", error);
    
    // Create minimal fallback analysis if API call fails
    const facilityName = facility.name || 'Unnamed facility';
    
    // Create minimal fallback response
    return {
      "Executive Summary": `Analysis of ${facilityName} based on available disaster data.`,
      "Vulnerability Assessment": `${facilityName} may have vulnerabilities based on its location and facility type.`,
      "Impact Scenarios": ["Potential impacts from nearby disaster events if any are active."],
      "Risk Rating": "Assessment incomplete. Please try again with API access.",
      "Potential Health Risks": [
        "Standard health and safety risks associated with facility operations",
        "Potential for stress-related health impacts during emergency situations"
      ],
      "Recommended Monitoring": [
        "Regular monitoring of local disaster alerts and warnings",
        "Periodic facility integrity inspections",
        "Annual comprehensive risk assessment"
      ]
    };
  }
}
