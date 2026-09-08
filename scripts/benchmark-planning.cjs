const { chromium } = require('playwright');
const fs = require('node:fs/promises');

async function measure(browser, baseURL) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.route('**/api/**', (route) => route.fulfill({ json: route.request().url().includes('/gdacs') ? [] : { reports: [], mapFeatures: [] } }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*$/, (route) => route.abort());
  await page.goto(`${baseURL}/404`);
  await page.evaluate(async () => {
    localStorage.setItem('gdacs_onboarding_done', '1');
    const districts = Array.from({ length: 100 }, (_, index) => {
      const x = 7 + (index % 10) / 10;
      const y = 46 + Math.floor(index / 10) / 10;
      return { id: String(index), name: `Area ${index}`, properties: { PCODE: String(index) }, geometry: { type: 'Polygon', coordinates: [[[x, y], [x + .1, y], [x + .1, y + .1], [x, y + .1], [x, y]]] } };
    });
    const facilities = Array.from({ length: 1000 }, (_, index) => ({ name: `Site ${index}`, latitude: 46.01 + (index % 100) / 101, longitude: 7.01 + (index % 71) / 72 }));
    await new Promise((resolve) => {
      const request = indexedDB.open('aidstack_workspace', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').put({ schemaVersion: 1, districts, facilities, impactedFacilities: [], acledData: [], config: {}, operationType: 'immunization' }, 'current');
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
  const scriptBodies = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script') scriptBodies.push(response.text().catch(() => ''));
  });
  const started = Date.now();
  await page.goto(`${baseURL}/app`);
  await page.getByText('1000 sites', { exact: true }).waitFor();
  await page.locator('.leaflet-container').first().waitFor();
  const readyMs = Date.now() - started;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const interactionMs = [];
  for (let index = 0; index < 10; index += 1) {
    const elapsed = await page.evaluate(async () => {
      const button = document.querySelector('.leaflet-control-zoom-in');
      const start = performance.now();
      button.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      document.querySelector('.leaflet-control-zoom-out').click();
      return performance.now() - start;
    });
    interactionMs.push(elapsed);
  }
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.initiatorType === 'script').reduce((sum, entry) => sum + entry.encodedBodySize, 0));
  const bodies = await Promise.all(scriptBodies);
  const result = { readyMs, initialScriptBytes: bytes, plannerLoadedBeforeOpen: bodies.some((body) => body.includes('New immunization plan')), zoomFrameP95Ms: interactionMs.sort((a, b) => a - b)[9] };
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const results = { fixture: '100 square admin areas; 1,000 sites; external services mocked; local desktop Chrome; cold page contexts', baseline: [], modular: [] };
    for (let index = 0; index < 3; index += 1) {
      results.baseline.push(await measure(browser, process.env.BASELINE_URL || 'http://127.0.0.1:3011'));
      results.modular.push(await measure(browser, process.env.MODULAR_URL || 'http://127.0.0.1:3010'));
    }
    await fs.mkdir('test-results', { recursive: true });
    await fs.writeFile('test-results/planning-performance.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
