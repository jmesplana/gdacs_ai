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
    const { districts, facilities, impactedFacilities, disasters } = req.body;

    if (!districts || districts.length === 0) {
      return res.status(400).json({ error: 'Missing districts data' });
    }

    console.log(`District-level campaign assessment: ${districts.length} districts, ${facilities?.length || 0} facilities`);

    const startTime = Date.now();

    // Aggregate facilities by district using point-in-polygon
    const districtData = districts.map(district => {
      const facilitiesInDistrict = facilities?.filter(facility => {
        return isPointInDistrict(
          parseFloat(facility.latitude),
          parseFloat(facility.longitude),
          district
        );
      }) || [];

      const impactedInDistrict = facilitiesInDistrict.filter(facility =>
        impactedFacilities?.some(imp => imp.facility.name === facility.name)
      );

      // Count disasters affecting this district
      const disastersInDistrict = disasters?.filter(disaster => {
        if (!disaster.latitude || !disaster.longitude) return false;
        return isPointInDistrict(
          parseFloat(disaster.latitude),
          parseFloat(disaster.longitude),
          district
        );
      }) || [];

      return {
        district: district.name,
        country: district.country,
        region: district.region,
        totalFacilities: facilitiesInDistrict.length,
        impactedFacilities: impactedInDistrict.length,
        disasterCount: disastersInDistrict.length,
        impactRate: facilitiesInDistrict.length > 0
          ? Math.round((impactedInDistrict.length / facilitiesInDistrict.length) * 100)
          : 0
      };
    });

    // Filter to only districts with facilities
    const relevantDistricts = districtData.filter(d => d.totalFacilities > 0);

    if (relevantDistricts.length === 0) {
      return res.status(200).json({
        assessments: [],
        summary: { message: 'No facilities found in any district' }
      });
    }

    console.log(`${relevantDistricts.length} districts have facilities`);

    // Sort by impact rate and total facilities to prioritize most relevant districts
    relevantDistricts.sort((a, b) => {
      // First by number of facilities (descending)
      if (b.totalFacilities !== a.totalFacilities) {
        return b.totalFacilities - a.totalFacilities;
      }
      // Then by impact rate (descending)
      return b.impactRate - a.impactRate;
    });

    // Limit to top 300 districts to avoid token limits (300 * 30 = 9000 tokens, well under 16384)
    const maxDistricts = 300;
    const districtsToAssess = relevantDistricts.slice(0, maxDistricts);
    const remainingDistricts = relevantDistricts.slice(maxDistricts);

    console.log(`Assessing top ${districtsToAssess.length} districts (${remainingDistricts.length} with basic assessment)`);

    // Use OpenAI for district-level assessment
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `District-level campaign viability assessment for top ${districtsToAssess.length} districts (sorted by facility count).

DISTRICTS:
${districtsToAssess.map((d, idx) =>
  `${idx + 1}|${d.district}|${d.totalFacilities} facilities|${d.impactedFacilities} impacted (${d.impactRate}%)|${d.disasterCount} disasters`
).join('\n')}

Assess each district for campaign feasibility. Consider:
- High impact rate (>30%) = higher risk
- Multiple disasters = coordination challenges
- District-wide logistics and access

Format: ID|GO/CAUTION/DELAY/NOGO|reason (max 30 words)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: Math.min(districtsToAssess.length * 30, 15000) // Cap at 15k tokens
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
            reason: reason
          };
        }
      });

      // Map assessments back to top districts
      const assessedResults = districtsToAssess.map((district, idx) => {
        const assessment = assessments[idx + 1] || {
          decision: district.impactRate > 50 ? 'DELAY' : district.impactRate > 20 ? 'CAUTION' : 'GO',
          reason: `${district.impactRate}% facilities impacted, ${district.disasterCount} disasters`
        };

        // Calculate viability score
        let score = 100;
        score -= district.impactRate;
        score -= district.disasterCount * 10;
        if (assessment.decision === 'NO-GO') score = 0;
        else if (assessment.decision === 'DELAY') score = Math.min(score, 40);
        else if (assessment.decision === 'CAUTION') score = Math.min(score, 70);

        return {
          district: district.district,
          country: district.country,
          region: district.region,
          totalFacilities: district.totalFacilities,
          impactedFacilities: district.impactedFacilities,
          impactRate: district.impactRate,
          decision: assessment.decision,
          viabilityScore: Math.max(0, score),
          reason: assessment.reason,
          disasterCount: district.disasterCount
        };
      });

      // Add remaining districts with basic assessment (no AI)
      const remainingResults = remainingDistricts.map(district => {
        const decision = district.impactRate > 50 ? 'DELAY' : district.impactRate > 20 ? 'CAUTION' : 'GO';
        let score = 100 - district.impactRate - (district.disasterCount * 10);
        if (decision === 'DELAY') score = Math.min(score, 40);
        else if (decision === 'CAUTION') score = Math.min(score, 70);

        return {
          district: district.district,
          country: district.country,
          region: district.region,
          totalFacilities: district.totalFacilities,
          impactedFacilities: district.impactedFacilities,
          impactRate: district.impactRate,
          decision: decision,
          viabilityScore: Math.max(0, score),
          reason: `${district.impactRate}% impact, ${district.disasterCount} disasters (auto-assessed)`,
          disasterCount: district.disasterCount
        };
      });

      const results = [...assessedResults, ...remainingResults];

      const duration = Date.now() - startTime;
      console.log(`✅ District assessment complete: ${assessedResults.length} AI-assessed + ${remainingResults.length} auto-assessed = ${results.length} total in ${duration}ms`);

      res.status(200).json({
        assessments: results,
        summary: {
          totalDistricts: districts.length,
          assessedDistricts: relevantDistricts.length,
          aiAssessedDistricts: assessedResults.length,
          autoAssessedDistricts: remainingResults.length,
          go: results.filter(r => r.decision === 'GO').length,
          caution: results.filter(r => r.decision === 'CAUTION').length,
          delay: results.filter(r => r.decision === 'DELAY').length,
          noGo: results.filter(r => r.decision === 'NO-GO').length,
          totalFacilities: relevantDistricts.reduce((sum, d) => sum + d.totalFacilities, 0),
          processingTime: duration
        }
      });

    } else {
      // Fallback without AI
      const results = relevantDistricts.map(district => ({
        district: district.district,
        country: district.country,
        region: district.region,
        totalFacilities: district.totalFacilities,
        impactedFacilities: district.impactedFacilities,
        impactRate: district.impactRate,
        decision: district.impactRate > 50 ? 'DELAY' : district.impactRate > 20 ? 'CAUTION' : 'GO',
        viabilityScore: Math.max(0, 100 - district.impactRate - (district.disasterCount * 10)),
        reason: `${district.impactRate}% impact rate, ${district.disasterCount} disasters`,
        disasterCount: district.disasterCount
      }));

      res.status(200).json({
        assessments: results,
        summary: {
          totalDistricts: districts.length,
          assessedDistricts: relevantDistricts.length,
          go: results.filter(r => r.decision === 'GO').length,
          caution: results.filter(r => r.decision === 'CAUTION').length,
          delay: results.filter(r => r.decision === 'DELAY').length,
          noGo: results.filter(r => r.decision === 'NO-GO').length
        }
      });
    }

  } catch (error) {
    console.error('Error in district campaign assessment:', error);
    res.status(500).json({ error: error.message });
  }
}

// Simple point-in-bounding-box check (can be enhanced with actual point-in-polygon later)
function isPointInDistrict(lat, lng, district) {
  if (!district.bounds) return false;

  const { minLat, maxLat, minLng, maxLng } = district.bounds;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}
