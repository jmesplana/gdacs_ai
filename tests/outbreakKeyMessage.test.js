import test from 'node:test';
import assert from 'node:assert/strict';
import {keyMessage} from '../lib/outbreak/keyMessage.js';

const asOf='2026-09-11';
const epi={date:'2026-09-08',baseline:'2026-09-01',growth:[{location:'Origin',delta:8}],burden:[{location:'Origin',value:20}],affected:[{location:'Origin'}]};
const mobility={start:'2026-04-01',end:'2026-04-30',unit:'estimated relocations',routes:[{origin:'Origin',destination:'Receiver',value:100}]};

test('opening summary retains movement, mining and security alongside dated case changes',()=>{
  const message=keyMessage({asOf,epi,mobility,mining:{byZone:new Map([['Origin',4]])},security:{byZone:new Map([['Origin',{events:2}]]),start:'2026-08-01',end:'2026-08-28'}});
  for(const part of ['Origin (+8)','2026-09-01–2026-09-08','Receiver','2026-04-01–2026-04-30','cumulative case reports','historical observations','2026-08-01–2026-08-28']) assert.ok(message.text.includes(part),part);
  assert.equal(message.origin,'Summary from loaded data');
});
test('future mobility and links from origins without case reports cannot become priorities',()=>{
  for(const data of [{...mobility,end:'2026-09-20'},{...mobility,routes:[{origin:'Unknown',destination:'Receiver',value:500}]}]) {
    assert.ok(!keyMessage({asOf,epi,mobility:data}).text.includes('Receiver'));
  }
});
test('missing comparisons and observed nonpositive changes have different wording',()=>{
  assert.match(keyMessage({asOf,epi:{...epi,growth:[]}}).text,/comparisons are unavailable/);
  assert.match(keyMessage({asOf,epi:{...epi,growth:[{location:'Origin',delta:0}]}}).text,/No positive seven-day changes.*paired observations/);
  assert.match(keyMessage({asOf}).text,/not enough case evidence/);
});
test('coordinator message takes precedence without automatic additions; blank restores data summary',()=>{
  assert.deepEqual(keyMessage({asOf,epi,override:'  Confirm staffing before deployment.  '}),{text:'Confirm staffing before deployment.',origin:'Coordinator message'});
  assert.equal(keyMessage({asOf,epi,override:' '}).origin,'Summary from loaded data');
});
test('reported zero is distinct from missing evidence, including national-only data',()=>{
  assert.match(keyMessage({asOf,epi:{...epi,growth:[],burden:[],affected:[],zones:[{location:'Origin',value:0}]}}).text,/No positive cumulative case counts/);
  const dataset={id:'cases',metricId:'national_cumulative_confirmed_cases',status:'ready',level:'national',kind:'cumulative',records:[{location:'DRC',date:'2026-09-08',value:0},{location:'DRC',date:'2026-09-20',value:90}]};
  assert.match(keyMessage({asOf,datasets:[dataset]}).text,/0 cumulative confirmed cases.*2026-09-08/);
});
