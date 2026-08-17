import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
  await request.post('/api/auto-recovery', { data: { enabled: true } });
  await page.goto('/');
});

test('dashboard exposes operational state and dependency model', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Orbital Reliability Lab' })).toBeVisible();
  await expect(page.getByText('OPERATIONAL STATE MODEL', { exact: true })).toBeVisible();
  await expect(page.getByText('DEPENDENCY / FLOW MODEL', { exact: true })).toBeVisible();
  await expect(page.locator('[data-system-id="GS-A"]')).toContainText('PRIMARY');
  await expect(page.locator('[data-system-id="GS-B"]')).toContainText('STANDBY');
});

test('factory dashboard exposes mini-MES lot and route controls', async ({ page }) => {
  await page.getByRole('button', { name: /Factory Operations/ }).click();
  await expect(page.getByText('FACTORY PRODUCTION MODEL / MINI-MES', { exact: true })).toBeVisible();
  const lot = page.locator('[data-lot-id="LOT-DEMO-001"]');
  await expect(lot).toContainText('LITHOGRAPHY');
  await lot.getByRole('button', { name: 'START OPERATION' }).click();
  await expect(lot).toContainText('RUNNING');
});

test('factory tools expose lifecycle controls', async ({ page }) => {
  await page.getByRole('button', { name: /Factory Operations/ }).click();
  await expect(page.locator('[data-system-id="LITH-01"]')).toBeVisible();
  const advance = page.locator('[data-advance="LITH-01"]');
  await expect(advance).toBeVisible();
  await advance.click();
  await expect(page.locator('[data-system-id="LITH-01"]')).toContainText('SETUP');
});

test('mission scenario shows failover operational impact', async ({ page }) => {
  await page.getByRole('button', { name: /Ground Link Degradation/ }).click();
  await expect(page.locator('#systemStatus')).toHaveText(/DEGRADED|INCIDENT/, { timeout: 2500 });
  await expect(page.locator('#impactHeadline')).toContainText(/ground/i, { timeout: 3000 });
  await expect(page.locator('[data-system-id="GS-B"]')).toContainText(/FAILOVER|PRIMARY/, { timeout: 3500 });
});
