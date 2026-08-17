import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/reset');
  await page.goto('/');
});

test('dashboard exposes reliability workflow', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Orbital Reliability Lab' })).toBeVisible();
  await expect(page.locator('#systemStatus')).toHaveText('NOMINAL');
  await expect(page.getByRole('button', { name: /Packet Loss/ })).toBeVisible();
  await expect(page.getByText('INCIDENT EVIDENCE')).toBeVisible();
});

test('UI reflects an injected incident and recovery', async ({ page }) => {
  await page.getByRole('button', { name: /Latency/ }).click();
  await expect(page.locator('#systemStatus')).toHaveText(/DEGRADED|INCIDENT/, { timeout: 2500 });
  await expect(page.locator('#systemStatus')).toHaveText('NOMINAL', { timeout: 7000 });
  await expect(page.locator('#mttr')).not.toHaveText('—');
});
