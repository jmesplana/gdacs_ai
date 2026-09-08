export function applyEvidenceGate(assessment, { disasters, impacts, securityAssessment, operationType, facility = {} }) {
  const missing = [];
  if (!Array.isArray(disasters) || !Array.isArray(impacts) || (!disasters.length && !impacts.length)) missing.push('Current hazard evidence');
  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(securityAssessment?.securityLevel)) missing.push('Current security assessment');
  if (operationType === 'immunization' && facility.cold_chain_verified !== true && facility.cold_chain_verified !== 'true') missing.push('Verified cold-chain readiness');
  assessment.evidence = { status: missing.length ? 'incomplete' : 'available', missing };
  assessment.heuristicScore = assessment.viabilityScore;
  if (missing.length) {
    assessment.viabilityScore = null;
    assessment.decision = 'INSUFFICIENT EVIDENCE';
    assessment.timeline = { recommendation: 'Complete operational verification', waitTime: 'Unknown', rationale: missing.join('; ') };
  }
  return assessment;
}
