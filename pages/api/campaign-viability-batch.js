import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facilities, impactedFacilities, disasters, acledData, acledEnabled } = req.body;

    if (!facilities || facilities.length === 0) {
      return res.status(400).json({ error: 'Missing facilities data' });
    }

    console.log(`Batch campaign assessment: ${facilities.length} facilities`);

    const startTime = Date.now();

    // Build a comprehensive context for AI
    const impactMap = new Map();
    impactedFacilities?.forEach(item => {
      impactMap.set(item.facility.name, item.impacts);
    });

    // Create a concise summary for each facility
    const facilitySummaries = facilities.map((facility, idx) => {
      const impacts = impactMap.get(facility.name) || [];
      const hasImpacts = impacts.length > 0;

      return {
        id: idx + 1,
        name: facility.name,
        location: `${facility.country || 'Unknown'}`,
        impacted: hasImpacts,
        impactCount: impacts.length,
        disasters: impacts.map(i => i.disaster.eventType).join(', ') || 'None'
      };
    });

    // Use OpenAI for intelligent batch assessment
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `Campaign viability for ${facilities.length} facilities. ${disasters?.length || 0} active disasters.

FACILITIES:
${facilitySummaries.map(f =>
  `${f.id}|${f.name}|${f.impacted ? `${f.impactCount}x${f.disasters}` : 'OK'}`
).join('\n')}

Format: ID|GO/CAUTION/DELAY/NOGO|reason (max 20 words)
Assess all:`;

      // Calculate safe max_tokens (max 16k for gpt-4o-mini, use 15 tokens per facility)
      const maxTokens = Math.min(facilities.length * 15, 15000);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Faster and cheaper
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: maxTokens
      });

      const aiResponse = response.choices[0].message.content;

      // Parse AI response
      const lines = aiResponse.trim().split('\n');
      const assessments = {};

      lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length === 3) {
          const [id, decision, reason] = parts.map(p => p.trim());
          assessments[parseInt(id)] = {
            decision: decision.toUpperCase(),
            reason: reason,
            isAIGenerated: true
          };
        }
      });

      // Map assessments back to facilities
      const results = facilities.map((facility, idx) => {
        const impacts = impactMap.get(facility.name) || [];
        const assessment = assessments[idx + 1] || {
          decision: impacts.length > 0 ? 'CAUTION' : 'GO',
          reason: impacts.length > 0
            ? `${impacts.length} disaster impact(s) detected`
            : 'No current impacts detected',
          isAIGenerated: false
        };

        // Calculate a simple viability score
        let score = 100;
        if (impacts.length > 0) score -= impacts.length * 15;
        if (assessment.decision === 'NO-GO') score = 0;
        else if (assessment.decision === 'DELAY') score = Math.min(score, 40);
        else if (assessment.decision === 'CAUTION') score = Math.min(score, 70);

        return {
          facility: facility.name,
          decision: assessment.decision,
          viabilityScore: Math.max(0, score),
          reason: assessment.reason,
          impactCount: impacts.length,
          isAIGenerated: assessment.isAIGenerated
        };
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Batch assessment complete: ${facilities.length} facilities in ${duration}ms (${(duration/1000).toFixed(1)}s)`);

      res.status(200).json({
        assessments: results,
        summary: {
          total: facilities.length,
          go: results.filter(r => r.decision === 'GO').length,
          caution: results.filter(r => r.decision === 'CAUTION').length,
          delay: results.filter(r => r.decision === 'DELAY').length,
          noGo: results.filter(r => r.decision === 'NO-GO').length,
          processingTime: duration
        }
      });

    } else {
      // Fallback without AI
      const results = facilities.map(facility => {
        const impacts = impactMap.get(facility.name) || [];
        return {
          facility: facility.name,
          decision: impacts.length > 2 ? 'DELAY' : impacts.length > 0 ? 'CAUTION' : 'GO',
          viabilityScore: Math.max(0, 100 - (impacts.length * 20)),
          reason: impacts.length > 0
            ? `${impacts.length} disaster impact(s) detected`
            : 'No current impacts',
          impactCount: impacts.length,
          isAIGenerated: false
        };
      });

      res.status(200).json({
        assessments: results,
        summary: {
          total: facilities.length,
          go: results.filter(r => r.decision === 'GO').length,
          caution: results.filter(r => r.decision === 'CAUTION').length,
          delay: results.filter(r => r.decision === 'DELAY').length,
          noGo: results.filter(r => r.decision === 'NO-GO').length
        }
      });
    }

  } catch (error) {
    console.error('Error in batch campaign assessment:', error);
    res.status(500).json({ error: error.message });
  }
}
