import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/api/reset');
});

test('telemetry is nominal at startup', async ({ request }) => {
  const response = await request.get('/api/telemetry');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('NOMINAL');
  expect(body.metrics.availabilityPct).toBeGreaterThan(99);
});

test('fault injection is detected and automatically recovered', async ({ request }) => {
  const injected = await request.post('/api/faults', { data: { type: 'packet_loss' } });
  expect(injected.status()).toBe(202);

  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 })
    .toBe('INCIDENT');

  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 6000 })
    .toBe('NOMINAL');

  const final = await (await request.get('/api/telemetry')).json();
  expect(final.lastMttrMs).toBeGreaterThan(0);
  expect(final.activeFault).toBeNull();
});

test('manual recovery works when auto recovery is disabled', async ({ request }) => {
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await request.post('/api/faults', { data: { type: 'service_down' } });

  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 })
    .toBe('INCIDENT');

  const recovery = await request.post('/api/recover');
  expect(recovery.status()).toBe(202);

  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 })
    .toBe('NOMINAL');
});
