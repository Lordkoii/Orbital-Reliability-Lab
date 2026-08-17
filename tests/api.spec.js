import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
});

test('telemetry exposes mission systems core at startup', async ({ request }) => {
  const response = await request.get('/api/telemetry');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('NOMINAL');
  expect(body.environment.id).toBe('mission');
  expect(body.systems.length).toBeGreaterThan(5);
});

test('environment can switch to factory operations', async ({ request }) => {
  const switched = await request.post('/api/environment', { data: { id: 'factory' } });
  expect(switched.ok()).toBeTruthy();
  const body = await switched.json();
  expect(body.snapshot.environment.id).toBe('factory');
  expect(body.snapshot.systems.some((system) => system.id === 'LITH-01')).toBeTruthy();
});

test('domain scenario is detected and automatically recovered', async ({ request }) => {
  const injected = await request.post('/api/scenarios/run', { data: { id: 'mission-ground-link-degradation' } });
  expect(injected.status()).toBe(202);

  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 })
    .toBe('INCIDENT');

  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 6000 })
    .toBe('NOMINAL');

  const final = await (await request.get('/api/telemetry')).json();
  expect(final.lastMttrMs).toBeGreaterThan(0);
  expect(final.activeFault).toBeNull();
});
