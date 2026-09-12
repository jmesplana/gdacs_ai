import {latestMines,validDate} from './data.js';

export function spreadsheetDates(rows,column,tools,workbook) {
  if(!tools||!workbook||!column)return rows;
  return rows.map(row=>{
    if(typeof row[column]!=='number')return row;
    const d=tools.SSF.parse_date_code(row[column],{date1904:!!workbook.Workbook?.WBProps?.date1904});
    const date=d&&d.H===0&&d.M===0&&d.S===0?`${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'Invalid Excel date';
    return {...row,[column]:date};
  });
}
export function normalizeMineVisits(rows,mapping) {
  const required=['id','date','latitude','longitude'];
  if(!rows.length||rows.length>50000)throw new Error('Supply 1–50,000 mine visits.');
  if(required.some(k=>!mapping[k]||!Object.hasOwn(rows[0],mapping[k])))throw new Error('Map mine ID, visit date, latitude and longitude columns.');
  const seen=new Set();
  return rows.map((row,i)=>{
    const id=String(row[mapping.id]??'').trim(),date=String(row[mapping.date]??'').trim();
    if(!id||!validDate(date))throw new Error(`Row ${i+2}: mine ID and a valid YYYY-MM-DD visit date are required.`);
    const coordinate=(key,limit)=>{
      const raw=String(row[mapping[key]]??'').trim();
      if(!/^[+-]?\d+(?:\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))||Math.abs(Number(raw))>limit)throw new Error(`Row ${i+2}: invalid ${key}; use WGS84 decimal degrees.`);
      return Number(raw);
    };
    const key=JSON.stringify([id,date]);
    if(seen.has(key))throw new Error(`Row ${i+2}: duplicate mine ID / visit date. Resolve duplicate visits before importing.`);
    seen.add(key);
    return {...row,pcode:id,visit_date:date,latitude:coordinate('latitude',90),longitude:coordinate('longitude',180),name:String(row[mapping.name]??id),province:String(row[mapping.province]??'')};
  });
}
export function minesAtCutoff(source,asOf) {
  if(!source)return [];
  return source.visits?latestMines(source.visits,asOf):(source.data||[]).filter(m=>validDate(m.date)&&m.date<=asOf);
}
export function replacementSummary(previous,next,key) {
  const old=new Map(previous.map(row=>[key(row),JSON.stringify(row)]));
  const current=new Map(next.map(row=>[key(row),JSON.stringify(row)]));
  let added=0,changed=0,removed=0;
  for(const [id,value] of current){if(!old.has(id))added++;else if(old.get(id)!==value)changed++;}
  for(const id of old.keys())if(!current.has(id))removed++;
  return {added,changed,removed};
}
export function mergePublicDatasets(old,incoming) {
  const protectedIds=new Set(old.filter(d=>d.origin==='upload').map(d=>d.id));
  return [...old.filter(d=>d.origin!=='public'),...incoming.filter(d=>!protectedIds.has(d.id)).map(d=>d.status==='ready'?d:{...(old.find(v=>v.id===d.id)||d),refreshError:d.error||'Refresh failed'})];
}
export function importedMetricId(mapping) {
  const prefix=mapping.level==='national'?'national_':'';
  const metric={cases:'confirmed_cases',deaths:'confirmed_deaths',recoveries:'recovered_cases',isolation:'suspected_cases_in_isolation'}[mapping.purpose];
  return metric?(mapping.purpose==='isolation'?`${prefix}${metric}`:`${prefix}${mapping.kind==='cumulative'?'cumulative':mapping.kind==='daily'?'new':'snapshot'}_${metric}`):undefined;
}
