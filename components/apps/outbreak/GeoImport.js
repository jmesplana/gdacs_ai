import { useState } from 'react';
import { normalizeRows, validDate } from '../../../lib/outbreak/data';

export default function GeoImport({layers,level,onImport}) {
  const [field,setField]=useState(''),[label,setLabel]=useState(''),[date,setDate]=useState(''),[unit,setUnit]=useState(''),[kind,setKind]=useState('snapshot'),[purpose,setPurpose]=useState('operational'),[error,setError]=useState('');
  const layer=layers.find(l=>l.id===field);
  function commit() {
    try {
      if(!layer)throw new Error('Choose a field.');
      const id=`geo-import:${crypto.randomUUID()}`;
      const mapping={location:'location',date:'date',metric:'value',label:label||layer.label,unit,level,kind};
      const records=normalizeRows(layer.records.map(r=>({...r,date:validDate(r.date)?r.date:date})),mapping,id);
      onImport({id,label:mapping.label,unit,level,kind,purpose,records,status:'ready',origin:'upload',source:`Main-app GeoJSON: ${field}`,file:'Workspace GeoJSON',fetchedAt:new Date().toISOString(),mapping:{...mapping,path:field,undatedObservationDate:date||null}});
      setError('');setField('');
    }catch(e){setError(e.message);}
  }
  return <section><h3>Use an indicator already in the GeoJSON</h3><p>Numeric fields are discovered from the uploaded properties. Map an unfamiliar schema once, without changing application code. National figures repeated in every polygon must not be imported as local counts.</p>
    {!layers.length?<p>No numeric boundary fields available. Upload boundaries in the main app or use a tabular dataset below.</p>:<>
      <label>GeoJSON numeric field<select aria-label="GeoJSON numeric field" value={field} onChange={e=>{setField(e.target.value);setLabel('');}}><option value="">Choose a source field</option>{layers.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
      {layer&&<><p>{layer.records.length} observations · geographic level: {level} · {layer.date||'Date not supplied'} · source path: {layer.id}</p>
        <div className="outbreak-fields"><label>Display name<input value={label} placeholder={layer.label} maxLength={180} onChange={e=>setLabel(e.target.value)}/></label><label>Units<input value={unit} maxLength={80} onChange={e=>setUnit(e.target.value)}/></label><label>Date for undated observations<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label>Interpretation<select aria-label="GeoJSON interpretation" value={kind} onChange={e=>setKind(e.target.value)}><option value="snapshot">Snapshot</option><option value="cumulative">Cumulative total</option><option value="daily">Daily reported count</option></select></label>
          <label>Analysis role<select aria-label="GeoJSON analysis role" value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="operational">Operational / other indicator</option><option value="cases">Confirmed cases</option><option value="deaths">Deaths</option></select></label>
        </div><button disabled={!unit.trim()} onClick={commit}>Use mapped GeoJSON indicator</button></>}
    </>}{error&&<p role="alert">{error}</p>}
  </section>;
}
