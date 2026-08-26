import { test, expect } from '@playwright/test';

test.beforeEach(async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'mission' } });
  await request.post('/api/reset');
  await request.post('/api/auto-recovery', { data: { enabled: true } });
});

test('mission topology exposes redundant ground and telemetry routes', async ({ request }) => {
  const body = await (await request.get('/api/telemetry')).json();
  expect(body.environment.id).toBe('mission');
  expect(body.systems.find(s => s.id === 'GS-A').state).toBe('PRIMARY');
  expect(body.systems.find(s => s.id === 'GS-B').state).toBe('STANDBY');
  expect(body.systems.find(s => s.id === 'TEL-GW-02').state).toBe('STANDBY');
  expect(body.systems.find(s => s.id === 'NET-CORE-01').state).toBe('READY');
  expect(body.activePath).toEqual(['GS-A', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01']);
  expect(body.missionNetwork.readiness.state).toBe('READY');
});

test('mission network API exposes readiness and advances telemetry frames', async ({ request }) => {
  const initial = await (await request.get('/api/mission/network')).json();
  expect(initial.missionNetwork.readiness.state).toBe('READY');
  expect(initial.missionNetwork.frames.lastWindow.continuityPct).toBe(100);
  const before = initial.missionNetwork.frames.received;
  const advanced = await request.post('/api/mission/frames', { data: { count: 120 } });
  expect(advanced.ok()).toBeTruthy();
  const body = await advanced.json();
  expect(body.missionNetwork.frames.received - before).toBe(120);
  expect(body.missionNetwork.frames.lastWindow.continuityPct).toBe(100);
});

test('mission ground-link scenario creates failover state and recovers', async ({ request }) => {
  const injected = await request.post('/api/scenarios/run', { data: { id: 'mission-ground-link-degradation' } });
  expect(injected.status()).toBe(202);
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  const incident = await (await request.get('/api/telemetry')).json();
  expect(incident.systems.find(s => s.id === 'GS-B').state).toBe('FAILOVER');
  expect(incident.missionNetwork.route.groundStation).toBe('GS-B');
  expect(incident.missionNetwork.failover.to).toBe('GS-B');
  expect(incident.missionNetwork.failover.totalInterruptionMs).toBeGreaterThan(0);
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 6500 }).toBe('NOMINAL');
  const final = await (await request.get('/api/telemetry')).json();
  expect(final.missionNetwork.validation.state).toBe('PASS');
  expect(final.missionNetwork.readiness.state).toBe('READY');
});

test('primary telemetry gateway outage moves route to TEL-GW-02', async ({ request }) => {
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  const injected = await request.post('/api/scenarios/run', { data: { id: 'mission-telemetry-gateway-outage' } });
  expect(injected.status()).toBe(202);
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  const incident = await (await request.get('/api/telemetry')).json();
  expect(incident.missionNetwork.route.telemetryGateway).toBe('TEL-GW-02');
  expect(incident.missionNetwork.failover.to).toBe('TEL-GW-02');
  expect(incident.systems.find(s => s.id === 'TEL-GW-02').state).toBe('FAILOVER');
  await request.post('/api/recover');
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('NOMINAL');
});

test('mission network partition drives NO-GO readiness and restores after validation', async ({ request }) => {
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  const injected = await request.post('/api/scenarios/run', { data: { id: 'mission-network-partition' } });
  expect(injected.status()).toBe(202);
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  let body = await (await request.get('/api/telemetry')).json();
  expect(body.missionNetwork.partition.active).toBe(true);
  expect(body.missionNetwork.readiness.state).toBe('NO-GO');
  expect(body.systems.find(s => s.id === 'TRACK-01').state).toBe('BLOCKED');
  expect(body.systems.find(s => s.id === 'CMD-01').state).toBe('BLOCKED');
  await request.post('/api/recover');
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('NOMINAL');
  body = await (await request.get('/api/telemetry')).json();
  expect(body.missionNetwork.partition.active).toBe(false);
  expect(body.missionNetwork.validation.state).toBe('PASS');
  expect(body.missionNetwork.readiness.state).toBe('READY');
});

test('factory lifecycle endpoint advances equipment state', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const advanced = await request.post('/api/systems/advance', { data: { id: 'LITH-01' } });
  expect(advanced.ok()).toBeTruthy();
  const body = await advanced.json();
  expect(body.system.state).toBe('SETUP');
});

test('factory production API exposes a seeded wafer lot and advances route state', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const initial = await (await request.get('/api/production')).json();
  expect(initial.production.lots).toHaveLength(1);
  expect(initial.production.lots[0].wafers).toBe(25);
  expect(initial.production.lots[0].currentOperation).toBe('LITHOGRAPHY');
  const advanced = await request.post('/api/production/advance', { data: { id: initial.production.lots[0].id } });
  expect(advanced.ok()).toBeTruthy();
  const body = await advanced.json();
  expect(body.lot.status).toBe('RUNNING');
  expect(body.lot.assignedTool).toBe('LITH-01');
});

test('MES outage holds WIP and validated recovery releases it', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const production = await (await request.get('/api/production')).json();
  const lotId = production.production.lots[0].id;
  await request.post('/api/production/advance', { data: { id: lotId } });
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await request.post('/api/scenarios/run', { data: { id: 'factory-mes-gateway-outage' } });
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  let body = await (await request.get('/api/telemetry')).json();
  expect(body.production.metrics.heldLots).toBe(1);
  expect(body.production.lots[0].status).toBe('HOLD');
  await request.post('/api/recover');
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('NOMINAL');
  body = await (await request.get('/api/telemetry')).json();
  expect(body.production.metrics.heldLots).toBe(0);
  expect(body.production.lots[0].status).toBe('RUNNING');
});

test('factory communications API exposes MQTT and OPC-UA models and publishes equipment snapshots', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const initialResponse = await request.get('/api/factory/communications');
  expect(initialResponse.ok()).toBeTruthy();
  const initial = await initialResponse.json();
  expect(initial.industrialCommunications.broker.id).toBe('ORL-MQTT-01');
  expect(initial.industrialCommunications.broker.state).toBe('ONLINE');
  expect(initial.industrialCommunications.metrics.connectedEndpoints).toBe(6);
  expect(initial.industrialCommunications.metrics.messagesPublished).toBe(0);
  expect(initial.industrialCommunications.opcUa.state).toBe('ONLINE');
  expect(initial.industrialCommunications.opcUa.sessionState).toBe('ACTIVE');
  expect(initial.industrialCommunications.opcUa.sessions).toBe(1);

  const publishedResponse = await request.post('/api/factory/communications/publish');
  expect(publishedResponse.ok()).toBeTruthy();
  const published = await publishedResponse.json();
  expect(published.published).toBe(6);
  expect(published.snapshot.industrialCommunications.metrics.messagesPublished).toBe(6);

  const readResponse = await request.post('/api/factory/communications/opcua/read');
  expect(readResponse.ok()).toBeTruthy();
  const read = await readResponse.json();
  expect(read.value.statusCode).toBe('Good');
  expect(read.value.assetId).toBe('MET-01');
  expect(read.snapshot.industrialCommunications.opcUa.reads).toBe(1);
});

test('MQTT broker outage records dropped messages and validates reconnect', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const production = await (await request.get('/api/production')).json();
  await request.post('/api/production/advance', { data: { id: production.production.lots[0].id } });
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await request.post('/api/scenarios/run', { data: { id: 'factory-mqtt-broker-outage' } });
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  let body = await (await request.get('/api/telemetry')).json();
  expect(body.industrialCommunications.broker.state).toBe('OFFLINE');
  expect(body.industrialCommunications.metrics.connectedEndpoints).toBe(0);
  expect(body.industrialCommunications.metrics.messagesDropped).toBe(6);
  expect(body.production.lots[0].status).toBe('HOLD');
  await request.post('/api/recover');
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 3500 }).toBe('NOMINAL');
  body = await (await request.get('/api/telemetry')).json();
  expect(body.industrialCommunications.broker.state).toBe('ONLINE');
  expect(body.industrialCommunications.validation.state).toBe('PASS');
  expect(body.production.lots[0].status).toBe('RUNNING');
});

test('OPC-UA session loss exposes stale read evidence and validates session recovery', async ({ request }) => {
  await request.post('/api/environment', { data: { id: 'factory' } });
  const production = await (await request.get('/api/production')).json();
  await request.post('/api/production/advance', { data: { id: production.production.lots[0].id } });
  await request.post('/api/auto-recovery', { data: { enabled: false } });
  await request.post('/api/factory/communications/opcua/read');
  const injected = await request.post('/api/scenarios/run', { data: { id: 'factory-opcua-session-loss' } });
  expect(injected.status()).toBe(202);
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 2500 }).toBe('INCIDENT');
  let body = await (await request.get('/api/telemetry')).json();
  expect(body.industrialCommunications.opcUa.state).toBe('SESSION_LOST');
  expect(body.industrialCommunications.opcUa.sessionState).toBe('LOST');
  expect(body.industrialCommunications.opcUa.staleReads).toBe(1);
  expect(body.industrialCommunications.opcUa.lastValue.statusCode).toBe('BadSessionClosed');
  expect(body.industrialCommunications.opcUa.validation.state).toBe('PENDING');
  expect(body.production.lots[0].status).toBe('HOLD');
  await request.post('/api/recover');
  await expect.poll(async () => (await (await request.get('/api/telemetry')).json()).status, { timeout: 3500 }).toBe('NOMINAL');
  body = await (await request.get('/api/telemetry')).json();
  expect(body.industrialCommunications.opcUa.state).toBe('ONLINE');
  expect(body.industrialCommunications.opcUa.sessionState).toBe('ACTIVE');
  expect(body.industrialCommunications.opcUa.sessions).toBe(1);
  expect(body.industrialCommunications.opcUa.reconnectCount).toBe(1);
  expect(body.industrialCommunications.opcUa.validation.state).toBe('PASS');
  expect(body.industrialCommunications.opcUa.lastValue.statusCode).toBe('Good');
  expect(body.production.lots[0].status).toBe('RUNNING');
});

test('factory communications endpoint is rejected outside Factory Operations', async ({ request }) => {
  const response = await request.get('/api/factory/communications');
  expect(response.status()).toBe(409);
});
