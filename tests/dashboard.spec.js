import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
  await page.goto('/');
});

test('dashboard exposes operational state and dependency model', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Orbital Reliability Lab' })).toBeVisible();
  await expect(page.getByText('OPERATIONAL STATE MODEL')).toBeVisible();
  await expect(page.getByText('DEPENDENCY / FLOW MODEL')).toBeVisible();
  await expect(page.getByText('GS-A').first()).toBeVisible();
  await expect(page.getByText('PRIMARY').first()).toBeVisible();
});

test('factory tools expose lifecycle controls', async ({ page }) => {
  await page.getByRole('button', { name: /Factory Operations/ }).click();
  await expect(page.getByText('LITH-01').first()).toBeVisible();
  const advance = page.locator('[data-advance="LITH-01"]');
  await expect(advance).toBeVisible();
  await advance.click();
  await expect(page.locator('.system-card').filter({ hasText: 'LITH-01' })).toContainText('SETUP');
});

test('mission scenario shows failover operational impact', async ({ page }) => {
  await page.getByRole('button', { name: /Ground Link Degradation/ }).click();
  await expect(page.locator('#systemStatus')).toHaveText(/DEGRADED|INCIDENT/, { timeout: 2500 });
  await expect(page.locator('#impactHeadline')).toContainText(/ground/i, { timeout: 3000 });
  await expect(page.locator('.system-card').filter({ hasText: 'GS-B' })).toContainText(/FAILOVER|PRIMARY/, { timeout: 3500 });
});
