import { numeric, validDate } from './data.js';

export function normalizeRoutes(rows, mapping) {
  const seen=new Set();
  if(!rows.length||rows.length>300000)throw new Error('Supply 1–300,000 origin–destination observations.');
  return rows.map((r,i)=>{
    const origin=String(r[mapping.origin]??'').trim(),destination=String(r[mapping.destination]??'').trim();
    if(!origin||!destination)throw new Error(`Row ${i+2}: missing origin or destination.`);
    const key=JSON.stringify([origin,destination]);
    if(seen.has(key))throw new Error(`Duplicate route ${origin} → ${destination}. Select one period/product before importing.`);
    seen.add(key);
    return {origin,destination,value:numeric(r[mapping.value])};
  });
}
export function matrixRoutes(rows,headers) {
  if(!headers?.length||headers.length<2)throw new Error('Invalid matrix headers.');
  return normalizeRoutes(rows.flatMap(r=>headers.slice(1).map(destination=>({origin:r[headers[0]],destination,value:r[destination]}))),{origin:'origin',destination:'destination',value:'value'});
}
export function districtRoutes(data,area,direction,asOf) {
  if(!data||!validDate(data.end)||data.end>asOf)return [];
  return data.routes.filter(r=>r.origin!==r.destination&&(direction==='inflow'?r.destination===area:r.origin===area)).sort((a,b)=>(b.value??-1)-(a.value??-1));
}
export function focusAreas(epi,security,data,asOf) {
  const found=new Map();
  const add=(name,reason)=>{if(!found.has(name))found.set(name,{name,reasons:[]});found.get(name).reasons.push(reason);};
  epi?.burden.filter(z=>z.value>0).slice(0,3).forEach(z=>add(z.location,`High reported burden: ${z.value} cumulative cases (${epi.date}). Review response capacity.`));
  epi?.growth.filter(z=>z.delta>0).slice(0,3).forEach(z=>add(z.location,`Large seven-day reported increase: +${z.delta}. Review surveillance and investigation capacity.`));
  const affected=new Set(epi?.affected.map(z=>z.location)||[]);
  if(security)[...security.byZone].filter(([n,s])=>affected.has(n)&&s.events>0).sort((a,b)=>b[1].events-a[1].events).slice(0,3).forEach(([n,s])=>add(n,`${s.events} recorded security events in an area reporting cases. Review access and surveillance continuity.`));
  if(data&&validDate(data.end)&&data.end<=asOf){
    // Rank individual observed links; do not sum percentages or duplicated cohorts.
    [...data.routes].filter(r=>r.origin!==r.destination&&affected.has(r.origin)&&r.value>0).sort((a,b)=>b.value-a.value).slice(0,3).forEach(r=>add(r.destination,`Receiving connection from ${r.origin}: ${r.value} ${data.unit} (${data.start}–${data.end}). Assess surveillance readiness; historical mobility does not prove exposure.`));
  }
  return [...found.values()];
}
