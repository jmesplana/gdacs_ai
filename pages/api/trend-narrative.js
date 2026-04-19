import { withRateLimit } from '../../lib/rateLimit';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      summary,
      acledTrends,
      facilityRiskTrends,
      disasterTrends,
      districtComparison,
      timeWindowDays
    } = req.body || {};

    // Validation
    if (!summary) {
      return res.status(400).json({ error: 'Summary data is required' });
    }

    // Build context for AI
    const context = [];

    // Add summary metrics
    context.push(`**Analysis Scope**: ${summary.selectedArea}`);
    context.push(`**Time Window**: Last ${timeWindowDays || 30} days`);
    context.push(`**Districts Analyzed**: ${summary.districtCount}`);

    if (summary.dataAvailable?.acled && summary.currentPeriod?.acledEvents !== undefined) {
      const change = summary.trends?.acledChange;
      const changeText = change !== null && change !== 0
        ? ` (${change > 0 ? '+' : ''}${change}% from previous period)`
        : '';
      context.push(`**ACLED Events**: ${summary.currentPeriod.acledEvents} events${changeText}`);
    }

    if (summary.dataAvailable?.facilities && summary.currentPeriod?.facilities !== undefined) {
      context.push(`**Facilities**: ${summary.currentPeriod.facilities} facilities being monitored`);
    }

    if (summary.dataAvailable?.disasters && summary.currentPeriod?.disasters !== undefined) {
      context.push(`**Active Disasters**: ${summary.currentPeriod.disasters} disasters`);
    }

    // Add ACLED trend data
    if (acledTrends && Array.isArray(acledTrends)) {
      const total = acledTrends.reduce((sum, day) => sum + day.count, 0);
      const peak = Math.max(...acledTrends.map(d => d.count));
      const peakDay = acledTrends.find(d => d.count === peak);
      context.push(`**ACLED Trend**: Total ${total} events, peak of ${peak} events on ${peakDay?.label || 'unknown date'}`);
    }

    // Add facility risk data
    if (facilityRiskTrends?.riskDistribution) {
      const { high, medium, low } = facilityRiskTrends.riskDistribution;
      context.push(`**Facility Risk Distribution**: ${high} high risk, ${medium} medium risk, ${low} low risk`);
    }

    // Add disaster data
    if (disasterTrends && Array.isArray(disasterTrends)) {
      const total = disasterTrends.reduce((sum, entry) => sum + entry.count, 0);
      context.push(`**Disaster Events**: ${total} disaster events recorded`);
    }

    // Add district comparison highlights
    if (districtComparison && Array.isArray(districtComparison) && districtComparison.length > 0) {
      const highestRisk = districtComparison[0]; // Already sorted by risk score
      const lowestRisk = districtComparison[districtComparison.length - 1];

      context.push(`**Highest Risk District**: ${highestRisk.district} (risk score: ${highestRisk.riskScore}, ${highestRisk.acledEvents} ACLED events, ${highestRisk.facilities} facilities)`);

      if (districtComparison.length > 1) {
        context.push(`**Lowest Risk District**: ${lowestRisk.district} (risk score: ${lowestRisk.riskScore}, ${lowestRisk.acledEvents} ACLED events, ${lowestRisk.facilities} facilities)`);
      }
    }

    const contextString = context.join('\n');

    // Generate AI narrative
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a humanitarian operations analyst providing strategic insights from trend data.

Generate a concise, actionable narrative (3-4 paragraphs, max 250 words) that:
1. Summarizes the overall security and operational situation
2. Highlights key trends and patterns (increasing/decreasing risks, hotspots)
3. Provides 2-3 specific operational recommendations
4. Uses professional humanitarian terminology

Be direct and specific. Focus on what decision-makers need to know. Use bullet points for recommendations.`
        },
        {
          role: 'user',
          content: `Analyze this trend data and provide a strategic narrative:\n\n${contextString}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const narrative = completion.choices[0]?.message?.content || 'Unable to generate narrative';

    return res.status(200).json({
      success: true,
      narrative,
      tokensUsed: completion.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('Error generating trend narrative:', error);
    return res.status(500).json({ error: 'Failed to generate trend narrative' });
  }
}

export default withRateLimit(handler);
