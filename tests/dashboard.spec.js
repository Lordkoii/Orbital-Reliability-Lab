import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
  await page.goto('/');
});

test('dashboard exposes both operational environments', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Orbital Reliability Lab' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mission Operations/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Factory Operations/ })).toBeVisible();
  await expect(page.getByText('SCENARIO LIBRARY')).toBeVisible();
});

test('factory operations loads factory assets and scenarios', async ({ page }) => {
  await page.getByRole('button', { name: /Factory Operations/ }).click();
  await expect(page.getByText('LITH-01')).toBeVisible();
  await expect(page.getByRole('button', { name: /Equipment Link Loss/ })).toBeVisible();
});

test('mission scenario reflects incident and recovery', async ({ page }) => {
  await page.getByRole('button', { name: /Ground Link Degradation/ }).click();
  await expect(page.locator('#systemStatus')).toHaveText(/DEGRADED|INCIDENT/, { timeout: 2500 });
  await expect(page.locator('#systemStatus')).toHaveText('NOMINAL', { timeout: 7000 });
  await expect(page.locator('#mttr')).not.toHaveText('—');
});
