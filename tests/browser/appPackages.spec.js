const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('upload, run in sandbox, save, reload, reopen and disable an app', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*$/, route => route.abort());
  await page.goto('/404');
  await page.evaluate(() => localStorage.setItem('gdacs_onboarding_done', '1'));
  await page.goto('/app');
  await page.getByRole('button', { name: 'Workspace apps', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add app', exact: true })).toBeEnabled();
  await page.getByLabel('App ZIP package').setInputFiles(path.resolve('public/apps/activity-planner.zip'));
  await expect(page.getByRole('region', { name: 'Review app installation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm installation' }).click();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Activity planner', exact: true }) });
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Activity planner"]');
  await expect(frame.getByRole('heading', { name: 'Activity planner' })).toBeVisible();
  const child = page.frames().find(item => item !== page.mainFrame());
  expect(await child.evaluate(() => {
    try { return parent.document.title; } catch { return 'blocked'; }
  })).toBe('blocked');
  expect(await child.evaluate(async () => {
    try { await fetch('/api/debug'); return 'allowed'; } catch { return 'blocked'; }
  })).toBe('blocked');
  await frame.getByLabel('Plan name').fill('Malaria campaign');
  await frame.getByLabel('Activities').fill('Assign teams and schedule activities');
  await frame.getByRole('button', { name: 'Save plan' }).click();
  await expect(frame.getByRole('status')).toHaveText('Plan saved.');
  await page.reload();
  await page.getByRole('button', { name: 'Workspace apps', exact: true }).click();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await frame.getByLabel('Saved plans').selectOption({ label: 'Malaria campaign' });
  await expect(frame.getByLabel('Activities')).toHaveValue('Assign teams and schedule activities');
  await frame.getByLabel('Activities').fill('Revised activity schedule');
  // Wait for the dirty notification to reach the host before leaving.
  await childCheckDirty(page);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Back to Apps' }).click();
  await expect(frame.getByLabel('Activities')).toHaveValue('Revised activity schedule');
  await frame.getByRole('button', { name: 'Save plan' }).click();
  await expect(frame.getByRole('status')).toHaveText('Plan saved.');
  await page.getByRole('button', { name: 'Back to Apps' }).click();
  await page.getByLabel('App ZIP package').setInputFiles(path.resolve('public/apps/activity-planner.zip'));
  await expect(page.getByText('This replaces the installed app code. Saved plans are retained.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm installation' }).click();
  await card.getByRole('button', { name: 'Open', exact: true }).click();
  await frame.getByLabel('Saved plans').selectOption({ label: 'Malaria campaign' });
  await expect(frame.getByLabel('Activities')).toHaveValue('Revised activity schedule');
  await page.getByRole('button', { name: 'Back to Apps' }).click();
  await card.getByRole('button', { name: 'Disable app' }).click();
  await expect(card.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0);
});

async function childCheckDirty(page) {
  const frame = page.frames().find(item => item !== page.mainFrame());
  await frame.evaluate(() => aidstack.setDirty(true));
}
