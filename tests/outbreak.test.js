import test from 'node:test';
import assert from 'node:assert/strict';
import { validDate, numeric, formatValue, normalizeRows, latestPerLocation, nationalEvidence, dailyComparison, revisionCount, validateBoundaries, latestMines, selectFacts } from '../lib/outbreak/data.js';
import { normalizePublicRows, parseCSV } from '../lib/outbreak/sources.js';

const mapping={location:'zone',date:'day',metric:'value',level:'health_zone',kind:'cumulative',label:'Cases',unit:'people'};
const row=(day,value,zone='A')=>({day,value,zone});
const normalized=rows=>normalizeRows(rows,mapping,'test');
test('outbreak dates and numbers reject ambiguous or malformed data without coercion',()=>{
  assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2024-02-29'),true);
  assert.equal(validDate('09/10/2026'),false);
  for(const v of ['',null,undefined,'ND','NA']) assert.equal(numeric(v),null);
  assert.equal(numeric('0'),0);assert.equal(numeric('1.5'),1.5);
  for(const v of ['17-','1]','1,000','-1','Infinity','1e3','12 people']) assert.throws(()=>numeric(v));
  assert.throws(()=>numeric('9007199254740993'),/precision/);
  assert.equal(formatValue(numeric('0.0001')),'0.0001');
});
test('uploads reject duplicate location/dates and missing mapping metadata',()=>{
  assert.throws(()=>normalized([row('2026-09-01',1),row('2026-09-01',2)]),/duplicate/);
  assert.throws(()=>normalized([row('2026-09-01',2,'')]),/location required/);
  assert.throws(()=>normalizeRows([row('2026-09-01',1)],{...mapping,unit:''},'x'),/unit/);
});
test('latest observation preserves missing data and honors reporting cut-off',()=>{
  const records=normalized([row('2026-09-01',10),row('2026-09-02','ND'),row('2026-09-03',20)]);
  assert.equal(latestPerLocation(records,'2026-09-02')[0].value,null);
  assert.deepEqual(latestPerLocation(records,'2026-08-31'),[]);
});
test('national evidence never adds health zones and labels downward revisions',()=>{
  const records=normalized([row('2026-09-01',10,'DRC'),row('2026-09-03',8,'DRC')]);
  const dataset={id:'n',label:'Confirmed',unit:'people',level:'national',kind:'cumulative',status:'ready',records};
  const facts=nationalEvidence([dataset,{...dataset,id:'local',level:'health_zone'}],'2026-09-03');
  assert.equal(facts.length,1);assert.equal(facts[0].value,8);
  assert.match(facts[0].text,/since 2026-09-01: -2 \(downward revision\)/);
  assert.equal(revisionCount(records),1);
});
test('period comparison requires 14 nonmissing daily observations per location',()=>{
  const records=Array.from({length:14},(_,i)=>({location:'A',date:`2026-09-${String(i+1).padStart(2,'0')}`,value:i<7?2:3}));
  assert.deepEqual(dailyComparison(records,'2026-09-14'),[{location:'A',reported:14,current:21,previous:14}]);
  assert.equal(dailyComparison(records.slice(1),'2026-09-14')[0].current,null);
  records[0].value=null;assert.equal(dailyComparison(records,'2026-09-14')[0].reported,13);
});
test('public malformed numeric cells are quarantined, never guessed or carried forward',()=>{
  const {records,issues}=normalizePublicRows([row('2026-09-01','17'),row('2026-09-02','17-'),row('2026-09-03','1]')],mapping,'source');
  assert.deepEqual(records.map(r=>r.value),[17,null,null]);assert.equal(issues.length,2);
  assert.equal(issues[0].row,3);assert.equal(issues[0].raw,'17-');
  assert.equal(latestPerLocation(records,'2026-09-03')[0].value,null);
});
test('public duplicate conflict is missing and schema drift fails explicitly',()=>{
  const {records,issues}=normalizePublicRows([row('2026-09-01',2),row('2026-09-01',3),row('invalid',4)],mapping,'source');
  assert.equal(records.length,1);assert.equal(records[0].value,null);assert.equal(issues.length,2);
  assert.throws(()=>normalizePublicRows([{zone:'A',day:'2026-09-01',unexpected:4}],mapping,'source'),/schema changed/);
});
const feature={type:'Feature',properties:{nom:'A'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}};
test('boundary validation rejects ambiguous names, projected coordinates and nonpolygons',()=>{
  assert.equal(validateBoundaries({type:'FeatureCollection',features:[feature]}).features.length,1);
  assert.throws(()=>validateBoundaries({type:'FeatureCollection',features:[feature,feature]}),/unique/);
  assert.throws(()=>validateBoundaries({type:'FeatureCollection',features:[{...feature,geometry:{type:'Point',coordinates:[0,0]}}]}),/polygon/);
  assert.throws(()=>validateBoundaries({type:'FeatureCollection',features:[{...feature,geometry:{type:'Polygon',coordinates:[[[0,0],[10000,0],[1,1],[0,0]]]}}]}),/WGS84/);
});
test('IPIS repeated visits count once and same-date ambiguity is retained',()=>{
  const mine={pcode:'mine1',name:'Mine',latitude:'1',longitude:'29',province:'Ituri'};
  const result=latestMines([{...mine,visit_date:'2010-01-01'},{...mine,visit_date:'2025-12-05'},{...mine,visit_date:'2025-12-05'}]);
  assert.equal(result.length,1);assert.equal(result[0].date,'2025-12-05');assert.equal(result[0].ambiguous,true);
});
test('AI can only select existing evidence once, without returning its own prose',()=>{
  const facts=[{id:'a',text:'Reported total: 5.'}];
  assert.deepEqual(selectFacts(facts,['a']),facts);
  assert.throws(()=>selectFacts(facts,['a','invented']),/unsupported/);
  assert.throws(()=>selectFacts(facts,['a','a']),/unsupported/);
  assert.throws(()=>selectFacts(facts,[{text:'100 cases'}]),/unsupported/);
});
test('CSV parse rejects misaligned columns',()=>{
  assert.throws(()=>parseCSV('zone,day,value\nA,2026-09-01,1,2\n'),/CSV invalid/);
  assert.equal(parseCSV('\uFEFFzone,day,value\nA,2026-09-01,0\n')[0].value,'0');
});
