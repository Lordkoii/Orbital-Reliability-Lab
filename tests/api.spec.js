import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
});

test('mission topology exposes primary and standby ground paths', async ({ request }) => {
  const body = await (await request.get('/api/telemetry')).json();
  expect(body.environment.id).toBe('mission');
  expect(body.systems.find(s => s.id === 'GS-A').state).toBe('PRIMARY');
  expect(body.systems.find(s => s.id === 'GS-B').state).toBe('STANDBY');
  expect(body.activePath[0]).toBe('GS-A');
});

test('mission ground-link scenario creates failover state and recovers', async ({ request }) => {
  const injected = await request.post('/api/scenarios/run', { data: { id: 'mission-ground-link-degradation' } });
  expect(injected.status()).toBe(202);
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  const incident = await (await request.get('/api/telemetry')).json();
  expect(incident.systems.find(s => s.id === 'GS-B').state).toBe('FAILOVER');
  expect(incident.operationalImpact.level).toBe('CRITICAL');
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 6500 }).toBe('NOMINAL');
});

test('factory lifecycle endpoint advances equipment state', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const advanced = await request.post('/api/systems/advance', { data: { id: 'LITH-01' } });
  expect(advanced.ok()).toBeTruthy();
  const body = await advanced.json();
  expect(body.system.state).toBe('SETUP');
});

test('MES outage holds process equipment', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await request.post('/api/scenarios/run', { data: { id: 'factory-mes-gateway-outage' } });
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  const body = await (await request.get('/api/telemetry')).json();
  expect(body.systems.find(s => s.id === 'LITH-01').state).toBe('HOLD');
  expect(body.operationalImpact.headline).toContain('Factory execution hold');
});
