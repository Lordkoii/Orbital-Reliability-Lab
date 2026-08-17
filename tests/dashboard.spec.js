import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
  await request.post('/api/auto-recovery', { data: { enabled: true } });
  await page.goto('/');
});

test('dashboard exposes operational state, mission network, and dependency model', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Orbital Reliability Lab' })).toBeVisible();
  await expect(page.getByText('MISSION NETWORK MODEL / TELEMETRY CONTINUITY', { exact: true })).toBeVisible();
  await expect(page.getByText('OPERATIONAL STATE MODEL', { exact: true })).toBeVisible();
  await expect(page.getByText('DEPENDENCY / FLOW MODEL', { exact: true })).toBeVisible();
  await expect(page.locator('#missionReadiness')).toHaveText('MISSION READY');
  await expect(page.locator('[data-system-id="GS-A"]')).toContainText('PRIMARY');
  await expect(page.locator('[data-system-id="GS-B"]')).toContainText('STANDBY');
  await expect(page.locator('[data-system-id="TEL-GW-02"]')).toContainText('STANDBY');
  await expect(page.locator('[data-contract-step="1"]')).toHaveAttribute('data-stage-state', 'PENDING');
});

test('mission telemetry frame control advances received frames', async ({ page }) => {
  const before = Number((await page.locator('#missionFramesReceived').innerText()).replaceAll(',', ''));
  await page.getByRole('button', { name: 'Transmit 120 Telemetry Frames' }).click();
  await expect.poll(async () => Number((await page.locator('#missionFramesReceived').innerText()).replaceAll(',', ''))).toBe(before + 120);
  await expect(page.locator('#missionContinuity')).toHaveText('100.00');
});

test('factory dashboard exposes mini-MES and hides mission network panel', async ({ page }) => {
  await page.getByRole('button', { name: /Factory Operations/ }).click();
  await expect(page.getByText('FACTORY PRODUCTION MODEL / MINI-MES', { exact: true })).toBeVisible();
  await expect(page.locator('#missionNetworkSection')).toBeHidden();
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

test('mission ground-link scenario exposes degraded failover story and pending validation', async ({ page, request }) => {
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await page.getByRole('button', { name: /Ground Link Degradation/ }).click();
  await expect(page.locator('#systemStatus')).toHaveText(/DEGRADED|INCIDENT/, { timeout: 2500 });
  await expect(page.locator('#impactHeadline')).toContainText(/ground/i, { timeout: 3000 });
  await expect(page.locator('[data-system-id="GS-B"]')).toContainText(/FAILOVER|PRIMARY/, { timeout: 3500 });
  await expect(page.locator('#missionGround')).toHaveText('GS-B', { timeout: 3500 });
  await expect(page.locator('#failoverRoute')).toContainText('GS-A → GS-B', { timeout: 3500 });
  await expect(page.locator('#missionReadiness')).toHaveText('MISSION DEGRADED', { timeout: 3500 });
  await expect(page.locator('#missionIncidentLow')).toHaveText('80.00%', { timeout: 3500 });
  await expect(page.locator('#routeSwitch')).toContainText('GS-A', { timeout: 3500 });
  await expect(page.locator('#routeSwitch')).toContainText('GS-B', { timeout: 3500 });
  await expect(page.locator('[data-check-id="post-failover-validation"]')).toHaveAttribute('data-status', 'WARN');
  await expect(page.locator('#readinessScore')).not.toHaveText('100');
  await expect(page.locator('#impactLevel')).toHaveText('DEGRADED');
  await expect(page.locator('[data-contract-step="5"]')).toHaveAttribute('data-stage-state', 'ACTIVE');
});

test('mission network partition drives dashboard to NO-GO readiness', async ({ page, request }) => {
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await page.getByRole('button', { name: /Mission Network Partition/ }).click();
  await expect(page.locator('#missionReadiness')).toHaveText('MISSION NO-GO', { timeout: 3500 });
  await expect(page.locator('[data-system-id="TRACK-01"]')).toContainText('BLOCKED', { timeout: 3500 });
  await expect(page.locator('[data-system-id="CMD-01"]')).toContainText('BLOCKED', { timeout: 3500 });
  await expect(page.locator('[data-check-id="network-fabric"]')).toHaveAttribute('data-status', 'FAIL');
  await expect(page.locator('#routeSwitch')).toContainText('NO ALTERNATE ROUTE');
});
