const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const XLSX = require('xlsx');

const areas=[{id:'A',name:'A',properties:{nom:'A'},geometry:{type:'Polygon',coordinates:[[[29,1],[30,1],[30,2],[29,2],[29,1]]]}}];
async function openOutbreak(page, boundaries=[], sourceHandler=null) {
  await page.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/gdacs')?[]:{reports:[],mapFeatures:[]}}));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*$/,route=>route.abort());
  if(sourceHandler)await page.route('**/api/outbreak-data?*',sourceHandler);
  await page.goto('/404');
  await page.evaluate(async districts=>{
    localStorage.setItem('gdacs_onboarding_done','1');
    await new Promise((resolve,reject)=>{
      const request=indexedDB.open('aidstack_workspace',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,tx=db.transaction('workspace','readwrite');
        tx.objectStore('workspace').put({schemaVersion:1,districts,facilities:[],impactedFacilities:[],acledData:[],config:{},operationType:'general'},'current');
        tx.oncomplete=()=>{db.close();resolve();};
      };
    });
  },boundaries);
  await page.goto('/app');
  await page.getByRole('button',{name:'Workspace apps',exact:true}).click();
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Outbreak Response',exact:true})});
  await card.getByRole('button',{name:'Install app',exact:true}).click();
  await card.getByRole('button',{name:'Open',exact:true}).click();
  await expect(page.getByRole('region',{name:'Outbreak response'})).toBeVisible();
}
async function upload(page,text) {
  await page.getByRole('button',{name:'Data & uploads',exact:true}).click();
  await page.getByLabel('Dataset file').setInputFiles({name:'sdb.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
  await page.getByRole('combobox',{name:'Location column',exact:true}).selectOption('zone');
  await page.getByRole('combobox',{name:'Reporting date column',exact:true}).selectOption('date');
  await page.getByRole('combobox',{name:'Value column',exact:true}).selectOption('completed');
  await page.getByLabel('Indicator label').fill('SDB completed');
  await page.getByLabel('Unit (people, requests, teams…)').fill('burials');
}

test('upload, map, chart, evidence validation, decisions and snapshot reopen',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await openOutbreak(page,areas);
  await page.getByLabel('Reporting cut-off').fill('2026-09-02');
  await upload(page,'zone,date,completed\nA,2026-09-01,12\nA,2026-09-02,0\nB,2026-09-02,ND\n');
  await expect(page.getByText('3 validated observations; 1 missing values. No data has been imported yet.')).toBeVisible();
  await page.getByRole('button',{name:'Confirm mapped import'}).click();
  await page.getByRole('button',{name:'Situation',exact:true}).click();
  await expect(page.getByRole('img',{name:'SDB completed trend for A'})).toBeVisible();
  await expect(page.getByRole('img',{name:'SDB completed map'})).toBeVisible();
  await expect(page.getByText('1 unmatched locations (not mapped): B')).toBeVisible();
  await expect(page.getByRole('cell',{name:'Not reported',exact:true})).toBeVisible();
  const svgDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export map SVG'}).click();
  expect((await svgDownload).suggestedFilename()).toBe('outbreak-map.svg');
  await page.getByRole('button',{name:'Response & decisions',exact:true}).click();
  await page.getByRole('button',{name:'Add decision / action'}).click();
  await page.getByLabel('Owner',{exact:true}).fill('Coordinator');
  await page.getByLabel('Action, rationale and decision requested').fill('Verify team availability with zone focal point.');
  await page.getByRole('button',{name:'Briefing',exact:true}).click();
  await expect(page.getByText('SDB completed: 0 burials reported for A (health_zone) on 2026-09-02.',{exact:false}).first()).toBeVisible();
  // A bogus AI reference must never replace the verified narrative.
  await page.route('**/api/outbreak-briefing',route=>route.fulfill({json:{ids:['invented']}}));
  await page.getByRole('button',{name:'Use AI to select leadership messages'}).click();
  await expect(page.getByRole('region',{name:'Outbreak response'}).getByRole('alert')).toContainText('unsupported evidence');
  await expect(page.getByRole('region',{name:'Outbreak response'}).getByRole('img')).toHaveCount(1);
  const appendix=page.getByRole('checkbox',{name:'Include detailed evidence and extra maps in this briefing and exports'});
  await appendix.check();
  await expect(page.getByRole('region',{name:'Evidence appendix'})).toBeVisible();
  await appendix.uncheck();
  await expect(page.getByRole('region',{name:'Evidence appendix'})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'I have reviewed this snapshot and its evidence for sharing.'}).check();
  await page.getByRole('button',{name:/Save snapshot/}).click();
  await expect(page.getByText('Snapshot saved in this browser workspace.')).toBeVisible();
  const evidenceDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export evidence JSON'}).click();
  expect((await evidenceDownload).suggestedFilename()).toBe('outbreak-evidence.json');
  const htmlDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export briefing HTML with visuals'}).click();
  const html=readFileSync(await (await htmlDownload).path(),'utf8');
  expect(html).toContain('<svg');expect(html).not.toContain('Use AI to select');
  expect(html).toContain('Verify team availability with zone focal point.');
  const printable=await page.context().newPage();
  await printable.setContent(html);
  await expect(printable.getByRole('img',{name:'SDB completed map'})).toBeVisible();
  await printable.pdf({path:testInfo.outputPath('outbreak-briefing.pdf'),format:'A4',printBackground:true});
  await printable.screenshot({path:testInfo.outputPath('outbreak-printable.png'),fullPage:true});
  await printable.close();
  await page.screenshot({path:testInfo.outputPath('outbreak-briefing.png'),fullPage:true});
  await page.getByRole('button',{name:'Close apps',exact:true}).click();
  await page.getByRole('button',{name:'Workspace apps',exact:true}).click();
  await page.locator('article').filter({has:page.getByRole('heading',{name:'Outbreak Response',exact:true})}).getByRole('button',{name:'Open',exact:true}).click();
  await page.getByLabel('Saved snapshots').selectOption({index:1});
  await page.getByRole('button',{name:'Briefing',exact:true}).click();
  await expect(page.getByText('Reviewed by user',{exact:true})).toBeVisible();
  await expect(page.getByText('Verify team availability with zone focal point.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Excel dates, multiple worksheets and JSON aggregates import without date or precision loss',async({page})=>{
  await openOutbreak(page);
  await page.getByRole('button',{name:'Data & uploads',exact:true}).click();
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['ignore'],['other data']]),'Other');
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['zone','date','completed'],['A',46267,0.0001]]),'Observations');
  // Excel serial 46267 is 2026-09-02 in the 1900 date system.
  await page.getByLabel('Dataset file').setInputFiles({name:'sdb.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})});
  await page.getByRole('combobox',{name:'Worksheet',exact:true}).selectOption('Observations');
  await page.getByRole('combobox',{name:'Location column',exact:true}).selectOption('zone');
  await page.getByRole('combobox',{name:'Reporting date column',exact:true}).selectOption('date');
  await page.getByRole('combobox',{name:'Value column',exact:true}).selectOption('completed');
  await page.getByLabel('Indicator label').fill('Example fractional measure');
  await page.getByLabel('Unit (people, requests, teams…)').fill('units');
  await page.getByRole('button',{name:'Confirm mapped import'}).click();
  await page.getByRole('button',{name:'Situation',exact:true}).click();
  await expect(page.getByRole('cell',{name:'2026-09-02',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'0.0001',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Data & uploads',exact:true}).click();
  await page.getByLabel('Dataset file').setInputFiles({name:'aggregate.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([{zone:'B',date:'2026-09-02',completed:3}]))});
  await page.getByRole('combobox',{name:'Location column',exact:true}).selectOption('zone');
  await page.getByRole('combobox',{name:'Reporting date column',exact:true}).selectOption('date');
  await page.getByRole('combobox',{name:'Value column',exact:true}).selectOption('completed');
  await page.getByLabel('Indicator label').fill('Teams');
  await page.getByLabel('Unit (people, requests, teams…)').fill('teams');
  await page.getByRole('button',{name:'Confirm mapped import'}).click();
  await page.getByRole('button',{name:'Situation',exact:true}).click();
  await expect(page.getByRole('cell',{name:'3',exact:true})).toBeVisible();
});

test('no-boundary global analysis rejects malformed uploads and fits mobile',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await openOutbreak(page);
  await page.getByRole('button',{name:'New outbreak',exact:true}).click();
  await page.getByLabel('Outbreak / operational scope').fill('Synthetic global outbreak');
  await upload(page,'zone,date,completed\nCountry A,2026-09-01,17-\n');
  await expect(page.getByRole('button',{name:'Confirm mapped import'})).toBeDisabled();
  await expect(page.getByText(/Invalid non-negative number: 17-/)).toBeVisible();
  await upload(page,'zone,date,completed\nCountry A,2026-09-01,5\n');
  await page.getByRole('combobox',{name:'Geographic level',exact:true}).selectOption('national');
  await page.getByRole('button',{name:'Confirm mapped import'}).click();
  await page.getByRole('button',{name:'Situation',exact:true}).click();
  await expect(page.getByRole('img',{name:'SDB completed trend for Country A'})).toBeVisible();
  await expect(page.getByText(/Upload administrative polygons in the main app/)).toBeVisible();
  expect(await page.locator('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('outbreak-mobile.png'),fullPage:true});
  page.once('dialog',d=>d.dismiss());
  await page.getByRole('button',{name:'Close apps',exact:true}).click();
  await expect(page.getByRole('region',{name:'Outbreak response'})).toBeVisible();
});

test('district selection shows directional arcs and missing routes stay missing',async({page},testInfo)=>{
  const second={id:'B',name:'B',properties:{nom:'B'},geometry:{type:'Polygon',coordinates:[[[30,1],[31,1],[31,2],[30,2],[30,1]]]}};
  await openOutbreak(page,[...areas,second]);
  await page.getByLabel('Reporting cut-off').fill('2026-09-02');
  await page.getByRole('button',{name:'Data & uploads',exact:true}).click();
  await page.getByLabel('Mobility CSV',{exact:true}).setInputFiles({name:'routes.csv',mimeType:'text/csv',buffer:Buffer.from('origin,destination,value\nA,B,25\nB,A,12\n')});
  await page.getByLabel('Mobility period start').fill('2026-04-01');
  await page.getByLabel('Mobility period end').fill('2026-04-30');
  await page.getByLabel('Mobility units').fill('estimated relocations');
  await page.getByRole('button',{name:'Import mobility routes',exact:true}).click();
  await page.getByRole('button',{name:'Situation',exact:true}).click();
  await page.getByRole('combobox',{name:'District connections',exact:true}).selectOption('A');
  await expect(page.locator('[data-mobility-route="A → B"]')).toHaveCount(1);
  const view=page.getByRole('img',{name:'Outflow from A map'}).locator('[data-map-viewport]');
  const before=await view.getAttribute('viewBox');
  await page.getByRole('img',{name:'Outflow from A map'}).scrollIntoViewIfNeeded();
  const box=await page.getByRole('img',{name:'Outflow from A map'}).boundingBox();
  const x=box.x+box.width*.5,y=box.y+box.height*.45;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+20,{steps:5});await page.mouse.up();
  const dragged=(await view.getAttribute('viewBox')).split(' ').map(Number);
  const original=before.split(' ').map(Number);
  expect(Math.abs(dragged[0]-original[0])).toBeGreaterThan(original[2]*.025);
  await page.mouse.wheel(0,-150);
  await expect.poll(async()=>Number((await view.getAttribute('viewBox')).split(' ')[2])).toBeLessThan(dragged[2]);
  const beforePinch=Number((await view.getAttribute('viewBox')).split(' ')[2]);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y},{x:x+30,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-60,y},{x:x+60,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Number((await view.getAttribute('viewBox')).split(' ')[2])).toBeLessThan(beforePinch*.8);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await cdp.detach();


  await page.getByRole('button',{name:'Zoom in Outflow from A map',exact:true}).click();
  expect(await view.getAttribute('viewBox')).not.toBe(before);
  await page.getByRole('combobox',{name:'Route direction',exact:true}).selectOption('inflow');
  await expect(page.locator('[data-mobility-route="B → A"]')).toHaveCount(1);
  await expect(page.locator('[data-mobility-route="A → B"]')).toHaveCount(0);
  await page.getByLabel('Admin labels for Inflow to A',{exact:true}).selectOption('all');
  await expect(page.getByRole('img',{name:'Inflow to A map'}).locator('text[data-admin]')).toHaveCount(2);
  await page.setViewportSize({width:1440,height:1400});
  await page.getByRole('img',{name:'Inflow to A map'}).screenshot({path:testInfo.outputPath('district-mobility.png')});
  await page.getByRole('button',{name:'Save snapshot *',exact:true}).click();
  await page.getByRole('button',{name:'Briefing',exact:true}).click();
  await expect(page.getByRole('img',{name:'Inflow to A map'})).toBeVisible();

});


test('connected source refreshes on opening, summary precedes detail, failed refresh retains dated evidence',async({page},testInfo)=>{
  let calls=0,fail=false;
  const seed=[{...areas[0],properties:{nom:'A',insp_sitrep:{cumulative_confirmed_cases:{_date:'2026-09-01',cumulative_confirmed_cases:3}}}}];
  const datasets=[{id:'insp:cumulative_confirmed_cases',metricId:'cumulative_confirmed_cases',purpose:'cases',status:'ready',origin:'public',kind:'cumulative',unit:'people',level:'health_zone',label:'Confirmed cases (cumulative)',source:'Fixture source',records:[{location:'A',date:'2026-09-03',value:10},{location:'A',date:'2026-09-10',value:20}]}];
  await openOutbreak(page,seed,route=>{
    if(route.request().url().includes('kind=indicators')){calls++;return fail?route.fulfill({status:502,json:{error:'Source unavailable'}}):route.fulfill({json:{datasets}});}
    if(route.request().url().includes('kind=relocations'))return route.fulfill({json:{routes:[],start:'2026-03-01',end:'2026-04-30',unit:'estimated relocations',source:'Fixture mobility'}});
    if(route.request().url().includes('kind=mines'))return route.fulfill({json:{data:[],url:'https://example.test/mines'}});
    return route.fulfill({json:{products:[]}});
  });
  await expect(page.getByRole('region',{name:'Overall snapshot'})).toContainText('20');
  await expect(page.getByRole('region',{name:'Overall snapshot'})).toContainText('2026-09-10');
  expect(calls).toBe(1);
  await page.setViewportSize({width:1440,height:1200});
  await page.getByRole('region',{name:'Overall snapshot'}).screenshot({path:testInfo.outputPath('overall-snapshot.png')});
  const headings=await page.getByRole('region',{name:'Outbreak response'}).locator('h3:visible').allTextContents();
  expect(headings.slice(0,4)).toEqual(['Overall snapshot','Trends','Areas to review','Suggested actions']);
  await expect(page.getByRole('region',{name:'Suggested actions'})).toContainText('+10');
  await page.getByRole('region',{name:'Suggested actions'}).getByRole('button',{name:'Add to response plan'}).first().click();
  await expect(page.getByLabel('Action, rationale and decision requested')).toHaveValue(/A: \+10/);
  await page.getByRole('button',{name:'Situation',exact:true}).click();
  fail=true;
  await page.getByRole('button',{name:'Refresh data',exact:true}).click();
  await expect(page.getByText(/Some sources could not refresh/)).toBeVisible();
  await expect(page.getByRole('region',{name:'Overall snapshot'})).toContainText('20');
  await expect(page.getByRole('region',{name:'Overall snapshot'})).toContainText('2026-09-10');
});


test('data coverage points to missing sources without claiming they were analysed',async({page})=>{
  await openOutbreak(page,areas);
  await page.getByRole('button',{name:'Data & uploads',exact:true}).click();
  const coverage=page.getByRole('region',{name:'Data coverage'});
  for(const title of ['ACLED / security','GDACS disaster alerts','Mining sites','Safe and dignified burial','Community engagement / RCCE','Logistics and supplies'])await expect(coverage.getByText(title,{exact:true})).toBeVisible();
  await expect(coverage.getByRole('button',{name:'Open main app'}).first()).toBeVisible();
  await coverage.getByRole('button',{name:'Add data'}).last().click();
  await expect(page.getByRole('heading',{name:'Upload operational data'})).toBeVisible();
});
