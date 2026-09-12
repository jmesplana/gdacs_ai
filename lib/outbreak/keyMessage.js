import { nationalEvidence, formatValue } from './data.js';
import { recommendations } from './overview.js';

// Deterministic copy with explicit reporting periods; never a transmission forecast.
export function keyMessage({datasets=[],epi,mining,security,mobility,asOf,override=''}) {
  if(override.trim()) return {text:override.trim(),origin:'Coordinator message'};
  const sentences=[];
  const rising=epi?.growth.filter(z=>z.delta>0).slice(0,2)||[];
  const burden=epi?.burden.filter(z=>z.value>0).slice(0,2)||[];
  if(rising.length) sentences.push(`Review ${rising.map(z=>`${z.location} (+${formatValue(z.delta)})`).join(' and ')}: these are the largest seven-day increases in reported cumulative cases among areas with comparable observations (${epi.baseline}–${epi.date}).`);
  else if(burden.length) sentences.push(`${burden.map(z=>`${z.location} (${formatValue(z.value)})`).join(' and ')} have the largest reported cumulative case totals (${epi.date}). ${epi.growth.length?'No positive seven-day changes are present among areas with paired observations.':'Seven-day comparisons are unavailable.'}`);
  else if(epi?.zones?.some(z=>z.value===0)) sentences.push(`No positive cumulative case counts are present among available area observations for ${epi.date}. Check reporting coverage before interpreting this as absence of cases.`);
  else {
    const cases=nationalEvidence(datasets.filter(d=>d.status==='ready'&&d.level==='national'&&/^(national_)?cumulative_confirmed_cases$/.test(d.metricId||'')),asOf)[0];
    sentences.push(cases?`${formatValue(cases.value)} cumulative confirmed cases were reported nationally on ${cases.date}. Area-level evidence is needed to identify geographic priorities.`:'There is not enough case evidence to identify outbreak priorities. Load dated case data and check geographic coverage before preparing decisions.');
  }
  const suggestions=recommendations(epi,security,mining,mobility,asOf);
  const receiving=suggestions.find(s=>s.title==='Review receiving-area readiness');
  if(receiving) sentences.push(`Assess surveillance readiness in ${receiving.areas.slice(0,2).join(' and ')}: they receive leading individual movement links from areas with cumulative case reports (mobility: ${mobility.start}–${mobility.end}).`);
  const mines=suggestions.find(s=>s.title==='Verify mining-community coverage');
  if(mines) sentences.push(`Verify active mines and community coverage in ${mines.areas.slice(0,2).join(' and ')}; mapped sites are historical observations.`);
  const access=suggestions.find(s=>s.title==='Check access constraints');
  if(access) sentences.push(`Check access conditions in ${access.areas.slice(0,2).join(' and ')} against security observations (${security.start}–${security.end}).`);
  return {text:sentences.join(' '),origin:'Summary from loaded data'};
}
