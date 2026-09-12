import { validDate, formatValue } from './data.js';
export const proposalKey=suggestion=>JSON.stringify([suggestion.title,[...suggestion.areas].sort()]);
export const proposalSelected=(actions,suggestion)=>actions.some(action=>action.proposalKey===proposalKey(suggestion)||(!action.proposalKey&&action.action===`${suggestion.title}. ${suggestion.why} ${suggestion.action}`));
export function recommendations(epi,security,mining,mobility,asOf) {
  const items=[];
  const rising=epi?.growth.filter(z=>z.delta>0).slice(0,3)||[];
  if(rising.length)items.push({title:'Review areas with rising reports',areas:rising.map(z=>z.location),why:rising.map(z=>`${z.location}: +${formatValue(z.delta)}`).join('; ')+` between ${epi.baseline} and ${epi.date}.`,action:'Check recent case investigations and surveillance workload with the area teams. Reported increases can include backlogs and revisions.'});
  const burden=epi?.burden.filter(z=>z.value>0).slice(0,3)||[];
  if(burden.length)items.push({title:'Check response capacity',areas:burden.map(z=>z.location),why:burden.map(z=>`${z.location}: ${formatValue(z.value)} cumulative cases`).join('; ')+` as of ${epi.date}.`,action:'Confirm current caseloads, team availability and supplies before deciding where to add resources. Cumulative totals do not measure current workload.'});
  const affected=new Set(epi?.affected.map(z=>z.location)||[]);
  const access=security?[...security.byZone].filter(([n,s])=>affected.has(n)&&s.events>0).sort((a,b)=>b[1].events-a[1].events).slice(0,3):[];
  if(access.length)items.push({title:'Check access constraints',areas:access.map(([n])=>n),why:access.map(([n,s])=>`${n}: ${s.events} recorded security events`).join('; ')+` during ${security.start}–${security.end}.`,action:'Ask field teams whether access is affecting alert investigation, referrals or follow-up. Event overlap alone does not establish an operational disruption.'});
  const mines=mining?[...mining.byZone].filter(([n,v])=>affected.has(n)&&v>0).sort((a,b)=>b[1]-a[1]).slice(0,3):[];
  if(mines.length)items.push({title:'Verify mining-community coverage',areas:mines.map(([n])=>n),why:mines.map(([n,v])=>`${n}: ${v} documented mining sites`).join('; ')+'.',action:'Verify which sites are active and whether community engagement and surveillance reach them. Historical sites do not establish transmission.'});
  if(mobility&&validDate(mobility.end)&&mobility.end<=asOf){
    const links=mobility.routes.filter(r=>r.origin!==r.destination&&affected.has(r.origin)&&r.value>0).sort((a,b)=>b.value-a.value).slice(0,3);
    if(links.length)items.push({title:'Review receiving-area readiness',areas:[...new Set(links.map(r=>r.destination))],why:links.map(r=>`${r.origin} → ${r.destination}: ${formatValue(r.value)} ${mobility.unit}`).join('; ')+` during ${mobility.start}–${mobility.end}.`,action:'Check surveillance readiness in connected destinations. These are the largest individual reported links from areas with cumulative case reports. Historical movement does not identify infected travellers or prove imported cases.'});
  }
  return items;
}
