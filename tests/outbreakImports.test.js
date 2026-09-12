import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {normalizeMineVisits,minesAtCutoff,spreadsheetDates,mergePublicDatasets,replacementSummary,importedMetricId} from '../lib/outbreak/imports.js';
import {normalizeRows} from '../lib/outbreak/data.js';

const mapping={id:'code',date:'visited',latitude:'lat',longitude:'lon',name:'label'};
const row={code:'m1',visited:'2026-01-01',lat:1,lon:29,label:'Older visit',mineral:'gold'};
test('IPIS mapped uploads retain history and extra columns; cut-off selects the latest eligible visit',()=>{
  const visits=normalizeMineVisits([row,{...row,visited:'2026-09-10',label:'New visit',lon:30}],mapping);
  assert.equal(visits[0].mineral,'gold');
  assert.equal(minesAtCutoff({visits},'2026-09-01')[0].name,'Older visit');
  assert.equal(minesAtCutoff({visits},'2026-09-11')[0].longitude,30);
  assert.deepEqual(minesAtCutoff({visits},'2025-12-31'),[]);
  assert.equal(minesAtCutoff(JSON.parse(JSON.stringify({visits})),'2026-09-01')[0].date,'2026-01-01');
});
test('IPIS rejects absent or invalid coordinates, malformed dates and duplicate visit IDs',()=>{
  for(const change of [{lat:''},{lon:181},{visited:'bad'},{code:''}])assert.throws(()=>normalizeMineVisits([{...row,...change}],mapping));
  assert.throws(()=>normalizeMineVisits([row,row],mapping),/duplicate mine/);
  assert.throws(()=>normalizeMineVisits([row],{...mapping,latitude:'renamed'}),/Map mine ID/);
  assert.equal(normalizeMineVisits([{...row,lat:0,lon:-20}],mapping)[0].latitude,0);
});
test('Excel date systems are respected for mining uploads',()=>{
  assert.equal(spreadsheetDates([{d:46267}],'d',XLSX,{})[0].d,'2026-09-02');
  assert.equal(spreadsheetDates([{d:44805}],'d',XLSX,{Workbook:{WBProps:{date1904:true}}})[0].d,'2026-09-02');
  assert.equal(spreadsheetDates([{d:46267.5}],'d',XLSX,{})[0].d,'Invalid Excel date');
});
test('public refresh preserves uploaded replacements without duplicate IDs',()=>{
  const upload={id:'insp:cases',origin:'upload',records:[{value:70}]};
  const oldPublic={id:'deaths',origin:'public',records:[{value:2}]};
  const merged=mergePublicDatasets([upload,oldPublic],[{id:'insp:cases',origin:'public',status:'ready',records:[{value:3}]},{id:'deaths',origin:'public',status:'error',error:'offline'}]);
  assert.equal(merged.length,2);assert.deepEqual(merged[0],upload);assert.deepEqual(merged[1].records,oldPublic.records);assert.equal(merged[1].refreshError,'offline');
});
test('replacement preview reports removed records and mapped national roles are explicit',()=>{
  assert.deepEqual(replacementSummary([{id:'a',v:1},{id:'b',v:2}],[{id:'a',v:3},{id:'c',v:4}],r=>r.id),{added:1,changed:1,removed:1});
  assert.equal(importedMetricId({purpose:'cases',kind:'cumulative',level:'national'}),'national_cumulative_confirmed_cases');
  assert.equal(importedMetricId({purpose:'recoveries',kind:'cumulative',level:'national'}),'national_cumulative_recovered_cases');
  assert.throws(()=>normalizeRows([{place:'A',day:'2026-09-01'}],{location:'place',date:'day',metric:'missing',label:'Cases',unit:'people',kind:'daily',level:'health_zone'},'x'),/mapped column is missing/);
});
