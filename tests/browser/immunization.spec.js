const { test, expect } = require('@playwright/test');

const districts = [{ id: 'A', name: 'Test district', geometryVersion: 'test-v1', properties: { PCODE: 'A001' }, geometry: { type: 'Polygon', coordinates: [[[7, 46], [8, 46], [8, 47], [7, 47], [7, 46]]] } }];
const csv = 'settlement_id,settlement,area_code,target_population,children_vaccinated\nS1,North settlement,A001,100,90\nS2,South settlement,A001,1000,100\nS3,Zero settlement,A001,100,0\n';

async function seed(page) {
  await page.route('**/api/**', (route) => route.fulfill({ json: route.request().url().includes('/gdacs') ? [] : { reports: [], mapFeatures: [] } }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*$/, (route) => route.abort());
  await page.goto('/404');
  await page.evaluate(async (areas) => {
    localStorage.setItem('gdacs_onboarding_done', '1');
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('aidstack_workspace', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('workspace');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').put({ schemaVersion: 1, districts: areas, facilities: [], impactedFacilities: [], acledData: [], config: {}, operationType: 'immunization' }, 'current');
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  }, districts);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Workspace apps', exact: true }).click();
  await expect(page.getByText('1 admin areas', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
}

async function createPlan(page) {
  for (const [name, value] of Object.entries({ 'Plan name': 'Country-independent pilot', 'Vaccine / antigen': 'Program antigen', 'Dose': '1', 'Eligible age / cohort': 'Program cohort', 'Observation period': '2026-Q3', 'Data source / revision': 'Synthetic test v1' })) {
    await page.getByLabel(name, { exact: true }).fill(value);
  }
  await page.locator('input[type=file][accept=".csv,.xlsx,.xls"]').setInputFiles({ name: 'observations.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByLabel('Boundary join field').selectOption('PCODE');
  await page.getByRole('button', { name: 'Validate observations' }).click();
  await expect(page.getByText('3 valid rows; 0 excluded rows.')).toBeVisible();
  await page.getByRole('checkbox', { name: /The accepted rows represent/ }).check();
  await page.getByRole('button', { name: 'Create plan from 3 valid rows' }).click();
  await expect(page.getByRole('heading', { name: 'Country-independent pilot' })).toBeVisible();
}

test('plan import, weighted coverage, sessions, resources, save/reopen and workbook export', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page);
  await createPlan(page);
  await expect(page.getByText('15.8%', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1,010', { exact: true }).first()).toBeVisible();
  await expect(page.locator('dialog .leaflet-container')).toBeVisible();
  const coloredPixels = await page.locator('dialog canvas').evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count += 1;
    return count;
  });
  expect(coloredPixels).toBeGreaterThan(100);
  await page.screenshot({ path: testInfo.outputPath('planner-desktop.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await page.getByRole('combobox', { name: 'Settlement', exact: true }).selectOption({ label: 'Test district / South settlement (900 unassigned)' });
  await page.getByLabel('Date', { exact: true }).fill('2026-09-15');
  await page.getByLabel('Team', { exact: true }).fill('Team A');
  await page.getByLabel('Children assigned').fill('100');
  await page.getByRole('button', { name: 'Add session' }).click();
  await page.getByLabel('Delivered at South settlement on 2026-09-15').fill('50');
  await page.getByRole('tab', { name: 'Resources' }).click();
  await expect(page.getByText(/1 team\/date assignments exceed/)).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved on this device · v1')).toBeVisible();
  await page.getByRole('tab', { name: 'Export', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Planning workbook' }).click();
  expect((await download).suggestedFilename()).toBe('immunization-plan.xlsx');
  await page.getByRole('button', { name: 'Close apps', exact: true }).click();
  await page.getByRole('button', { name: 'Workspace apps', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByLabel('Saved plans').selectOption({ label: 'Country-independent pilot (v1)' });
  await expect(page.getByText('960', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile layout fits viewport and unsaved drafts require confirmation', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await createPlan(page);
  expect(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('planner-mobile.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Close apps', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Immunization planning', exact: true })).toBeVisible();
});
