import {useState} from 'react';
import Papa from 'papaparse';
import {latestMines} from '../../../lib/outbreak/data';
import {normalizeMineVisits,spreadsheetDates,minesAtCutoff,replacementSummary} from '../../../lib/outbreak/imports';
import {locatePoint} from '../../../lib/outbreak/insights';
import styles from './outbreak.module.css';

export default function MineUpload({current,asOf,index,onImport}) {
  const [file,setFile]=useState(null),[rows,setRows]=useState([]),[book,setBook]=useState(null),[excel,setExcel]=useState(null),[sheet,setSheet]=useState(''),[hash,setHash]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [mapping,setMapping]=useState(current?.mapping||{id:'pcode',date:'visit_date',latitude:'latitude',longitude:'longitude',name:'name',province:'province'});
  const columns=Object.keys(rows[0]||{});
  async function read(event){
    const f=event.target.files?.[0];event.target.value='';if(!f)return;
    setBusy(true);setFile(null);setRows([]);setBook(null);setError('');
    try{
      if(f.size>10*1024*1024)throw new Error('Maximum file size: 10 MB.');
      const bytes=await f.arrayBuffer();let data;
      setHash(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join(''));
      if(/\.xlsx?$/i.test(f.name)){
        const tools=await import('xlsx'),workbook=tools.read(bytes,{type:'array',cellDates:false});
        const chosen=workbook.SheetNames.includes(current?.sheet)?current.sheet:workbook.SheetNames[0];
        setExcel(tools);setBook(workbook);setSheet(chosen);data=tools.utils.sheet_to_json(workbook.Sheets[chosen],{raw:true,defval:''});
      }else if(/\.csv$/i.test(f.name)){
        const parsed=Papa.parse(new TextDecoder().decode(bytes),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\uFEFF/,'').trim()});
        if(parsed.errors.length)throw new Error(parsed.errors[0].message);data=parsed.data;
      }else throw new Error('Choose an IPIS Excel workbook or CSV.');
      if(!data.length||data.length>50000)throw new Error('Supply 1–50,000 mine visits.');
      setRows(data);setFile(f.name);setMapping(current?.mapping||mapping);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  let visits=[],points=[],validation='',changes=null,unmatched=0;
  if(file)try{
    visits=normalizeMineVisits(spreadsheetDates(rows,mapping.date,excel,book),mapping);
    points=latestMines(visits,asOf);
    changes=replacementSummary(minesAtCutoff(current,asOf),points,p=>p.id);
    unmatched=points.filter(p=>!locatePoint(index,p.longitude,p.latitude).location).length;
  }catch(e){validation=e.message;}
  return <section className={styles.panel} aria-label="Mining data upload"><h3>IPIS mining data</h3>
    <p>{current?`Active source: ${current.file||current.source||current.url||'Saved mining data'}${current.sheet?` · worksheet ${current.sheet}`:''}. ${minesAtCutoff(current,asOf).length} eligible unique sites at ${asOf}.`:'No mining source loaded.'}</p>
    {current?.visits?.length>0&&<p>Visit history: {current.visits.map(v=>v.visit_date).sort()[0]}–{current.visits.map(v=>v.visit_date).sort().at(-1)} · imported/retrieved {current.fetchedAt||'date unavailable'}.</p>}
    {current&&!current.visits&&<p>This source contains latest visits only. Upload a full visit-history file to reconstruct earlier cut-offs.</p>}
    <p>Upload a complete replacement for the mining layer. All visit dates and source columns are retained; the latest visit on or before the reporting cut-off is used for each mine. Public refresh keeps uploaded mining data.</p>
    <label>IPIS workbook or CSV<input type="file" accept=".xlsx,.xls,.csv" onChange={read} disabled={busy}/></label>
    {busy&&<p role="status">Reading mining data…</p>}{error&&<p role="alert">{error}</p>}
    {file&&<><p>{file}</p>{book&&<label>Mining worksheet<select value={sheet} onChange={e=>{setSheet(e.target.value);setRows(excel.utils.sheet_to_json(book.Sheets[e.target.value],{raw:true,defval:''}));}}>{book.SheetNames.map(s=><option key={s}>{s}</option>)}</select></label>}
      <div className={styles.controls}>{[['id','Mine ID'],['date','Mine visit date'],['latitude','Mine latitude'],['longitude','Mine longitude'],['name','Mine name (optional)'],['province','Mine province (optional)']].map(([key,label])=><label key={key}>{label}<select value={columns.includes(mapping[key])?mapping[key]:''} onChange={e=>setMapping({...mapping,[key]:e.target.value})}><option value="">Choose column</option>{columns.map(c=><option key={c}>{c}</option>)}</select></label>)}</div>
      <p>Excel serial dates use the workbook’s date system; text dates must be YYYY-MM-DD. Coordinates must be WGS84 decimal degrees.</p>
      {validation?<p role="status">{validation}</p>:<><p role="status">{visits.length} validated visits; {points.length} eligible unique sites. {changes.added} added, {changes.changed} changed, {changes.removed} removed compared with the active source at this cut-off.</p><p>{index.length?`${unmatched} sites do not match a unique uploaded boundary.`:'No boundaries loaded; spatial matching is not yet available.'}</p><div className={styles.tableWrap}><table><caption>Mining preview — first five eligible sites</caption><thead><tr><th>ID / name</th><th>Visit date</th><th>Latitude</th><th>Longitude</th></tr></thead><tbody>{points.slice(0,5).map(p=><tr key={p.id}><td>{p.id} / {p.name}</td><td>{p.date}</td><td>{p.latitude}</td><td>{p.longitude}</td></tr>)}</tbody></table></div></>}
      <button disabled={!!validation||busy} onClick={()=>{onImport({origin:'upload',file,sheet:book?sheet:null,mapping,source:file,sha256:hash,fetchedAt:new Date().toISOString(),visits,data:latestMines(visits)});setFile(null);setRows([]);}}>Use uploaded mining data{current?' — replace active source':''}</button>
    </>}
  </section>;
}
