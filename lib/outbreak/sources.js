import Papa from 'papaparse';
import { createHash } from 'node:crypto';
import { METRICS, normalizeRows, validateBoundaries, latestMines } from './data.js';

const ROOT = 'https://raw.githubusercontent.com/INRB-UMIE/BDBV2026-Data/main';
export const IPIS_URL = 'https://ipisresearch.be/wp-content/uploads/2026/05/cod_mines_curated_all_opendata_p_ipis.csv';
export function parseCSV(text) {
  const parsed = Papa.parse(text, { header:true, skipEmptyLines:'greedy', transformHeader:h => h.replace(/^\uFEFF/,'').trim() });
  if (parsed.errors.length) throw new Error(`CSV invalid: ${parsed.errors[0].message}`);
  return parsed.data;
}
export function normalizePublicRows(rows, mapping, sourceId) {
  if(!rows.length || [mapping.location,mapping.date,mapping.metric].some(k=>!Object.hasOwn(rows[0],k))) throw new Error('Source schema changed: required location, date or metric column missing.');
  const records=new Map(), issues=[];
  rows.forEach((row,i)=>{
    let record;
    try { [record]=normalizeRows([row],mapping,sourceId); }
    catch(e) {
      issues.push({row:i+2,location:String(row[mapping.location]||''),date:String(row[mapping.date]||''),raw:String(row[mapping.metric]??''),message:e.message});
      // Preserve a missing observation at a valid location/date, rather than
      // falling back to an earlier value or guessing malformed source numbers.
      try { [record]=normalizeRows([{...row,[mapping.metric]:null}],mapping,sourceId); } catch { return; }
    }
    const key=JSON.stringify([record.location,record.date]);
    if(records.has(key)) {
      const old=records.get(key);
      issues.push({row:i+2,location:record.location,date:record.date,raw:String(row[mapping.metric]??''),message:'Duplicate location/date in source. Conflicting values are marked missing.'});
      if(old.value!==record.value) old.value=null;
    } else records.set(key,record);
  });
  if(!records.size) throw new Error('No valid location/date observations in source.');
  return {records:[...records.values()],issues};
}
async function download(url) {
  const response = await fetch(url,{ signal:AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 20000000) throw new Error('Source exceeds 20 MB.');
  const chunks=[]; let size=0;
  for await (const chunk of response.body) { size+=chunk.length; if(size>20000000) { throw new Error('Source exceeds 20 MB.'); } chunks.push(chunk); }
  const body=Buffer.concat(chunks);
  return { text:body.toString('utf8'), sha256:createHash('sha256').update(body).digest('hex'), fetchedAt:new Date().toISOString(), url };
}
export async function loadPublicSources() {
  const datasets = await Promise.all(METRICS.map(async ([metric,label,level,kind]) => {
    const id = `insp:${metric}`, url = `${ROOT}/data/insp_sitrep/processed/insp_sitrep__${metric}__daily.csv`;
    const base = { id,metricId:metric,purpose:metric==='cumulative_confirmed_cases'?'cases':'other',label,level,kind,unit:'people',url,origin:'public' };
    try {
      const source = await download(url);
      const {records,issues} = normalizePublicRows(parseCSV(source.text), { location:'nom',date:'date',metric,level,kind,label,unit:'people',integerOnly:true },id);
      return { ...base,status:'ready',records,issues,sha256:source.sha256,fetchedAt:source.fetchedAt };
    } catch(e) { return { ...base,status:'error',records:[],error:e.message }; }
  }));
  return { datasets, fetchedAt:new Date().toISOString() };
}
export async function loadGeography() {
  const url = `${ROOT}/build/drc_health_zones.geojson`;
  const source = await download(url);
  return { data:validateBoundaries(JSON.parse(source.text)),url,sha256:source.sha256,fetchedAt:source.fetchedAt };
}
export async function loadMines() {
  const source=await download(IPIS_URL);
  return { data:latestMines(parseCSV(source.text)),url:IPIS_URL,sha256:source.sha256,fetchedAt:source.fetchedAt };
}

// Source-specific schema adapter. Locations, dates, products and cohorts are read
// from the source catalogue/docs; analysis code does not contain those values.
export async function loadFlowminderCatalogue() {
  const [manifest,shortDocs]=await Promise.all([
    download(`${ROOT}/build/manifest.json`),
    download(`${ROOT}/data/flowminder_short_trips/README.md`)
  ]);
  const data=JSON.parse(manifest.text);
  if(!Array.isArray(data.datasets))throw new Error('Mobility catalogue schema changed.');
  const tableRows=shortDocs.text.split('\n').filter(line=>line.startsWith('|')).map(line=>line.split('|').slice(1,-1).map(c=>c.replace(/[`*]/g,'').trim()));
  const annexOrigins=shortDocs.text.split('\n').find(line=>/^Origins:/.test(line))?.replace(/^Origins:\s*/,'').replace(/[*`]/g,'').replace(/\.$/,'')||null;
  const products=data.datasets.filter(d=>/flowminder/i.test(d.folder||'')).flatMap(dataset=>(dataset.outputs||[]).map(output=>{
    const short=dataset.folder==='flowminder_short_trips',subscriber=/subscriber_days/.test(output.metric||'');
    const definition=tableRows.find(c=>c[0]===output.metric||c[0]===`_${output.metric}`);
    const path=output.long_csv||output.matrix_csv;
    const url=typeof path==='string'&&/^build\/(long|matrix)\/[a-zA-Z0-9_.-]+\.csv$/.test(path)?`${ROOT}/${path}`:null;
    return {id:`${dataset.folder}:${output.metric}:${output.type}`,namespace:dataset.folder,metric:output.metric,type:output.type,inGeoJSON:output.in_geojson===true,url,
      source:dataset.source,citation:dataset.citation,retrievedOn:dataset.retrieved_on,
      documentation:`https://github.com/INRB-UMIE/BDBV2026-Data/blob/main/data/${dataset.folder}/README.md`,
      unit:short?(subscriber?'average subscriber presence days':'% of documented subscriber cohort'):'estimated relocations (people)',
      product:short?(subscriber?'cohort_presence':'cohort_destinations'):'relocations',
      window:definition?.[1]||null,origins:short?(subscriber?definition?.[3]||null:annexOrigins):null,
      limitation:short?'Cohort-level destination profile. Do not sum repeated origin rows or convert these values into traveller counts.':'Directed relocation estimates. Redacted cells are missing, not zero; processed point estimates omit uncertainty bounds.'};
  }));
  return {products,fetchedAt:manifest.fetchedAt,manifestUrl:manifest.url,manifestSha256:manifest.sha256,documentationSha256:shortDocs.sha256};
}

export async function loadRelocations() {
  const catalogue=await loadFlowminderCatalogue();
  const product=catalogue.products.filter(p=>p.namespace==='flowminder'&&/^outflow_\d{6}$/.test(p.metric)&&p.url).sort((a,b)=>b.metric.localeCompare(a.metric))[0];
  if(!product)throw new Error('No documented dated outflow matrix available.');
  const source=await download(product.url),rows=parseCSV(source.text);
  const {matrixRoutes}=await import('./mobility.js');
  const month=product.metric.slice(-6),year=Number(month.slice(0,4)),m=Number(month.slice(4));
  if(m<1||m>12)throw new Error('Invalid matrix period.');
  return {routes:matrixRoutes(rows,Object.keys(rows[0]||{})),unit:product.unit,start:new Date(Date.UTC(year,m-2,1)).toISOString().slice(0,10),end:new Date(Date.UTC(year,m,0)).toISOString().slice(0,10),source:source.url,sha256:source.sha256,fetchedAt:source.fetchedAt,limitation:product.limitation};
}
