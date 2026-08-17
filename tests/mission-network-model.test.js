import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionNetworkModel } from '../src/mission-network-model.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('mission network starts on primary route with READY readiness', () => {
  const model = new MissionNetworkModel();
  const snapshot = model.snapshot();
  assert.deepEqual(snapshot.route.path, ['GS-A', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01']);
  assert.equal(snapshot.route.mode, 'PRIMARY');
  assert.equal(snapshot.readiness.state, 'READY');
  assert.equal(snapshot.readiness.score, 100);
  assert.equal(snapshot.frames.lastWindow.continuityPct, 100);
});

test('ground-link loss fails over to GS-B and validates primary restoration', async () => {
  const model = new MissionNetworkModel();
  model.inject('GS-A', 'packet_loss');
  assert.equal(model.snapshot().frames.lastWindow.continuityPct, 80);
  await sleep(5);
  model.detect('GS-A');
  let snapshot = model.snapshot();
  assert.equal(snapshot.route.groundStation, 'GS-B');
  assert.equal(snapshot.route.mode, 'REDUNDANT');
  assert.equal(snapshot.failover.type, 'GROUND');
  assert.equal(snapshot.failover.from, 'GS-A');
  assert.equal(snapshot.failover.to, 'GS-B');
  assert.ok(snapshot.failover.totalInterruptionMs >= 181);
  assert.equal(snapshot.frames.lastWindow.continuityPct, 100);

  model.recover('GS-A');
  snapshot = model.validate('GS-A');
  assert.equal(snapshot.validation.state, 'PASS');
  assert.equal(snapshot.failover.validated, true);
  assert.equal(snapshot.route.groundStation, 'GS-A');
  assert.equal(snapshot.route.mode, 'PRIMARY');
  assert.equal(snapshot.readiness.state, 'READY');
});

test('telemetry gateway outage fails over to TEL-GW-02', async () => {
  const model = new MissionNetworkModel();
  model.inject('TEL-GW-01', 'service_down');
  assert.equal(model.snapshot().frames.lastWindow.continuityPct, 0);
  await sleep(5);
  model.detect('TEL-GW-01');
  const incident = model.snapshot();
  assert.equal(incident.route.telemetryGateway, 'TEL-GW-02');
  assert.equal(incident.failover.type, 'GATEWAY');
  assert.equal(incident.failover.to, 'TEL-GW-02');
  assert.equal(incident.nodes.find(n => n.id === 'TEL-GW-02').state, 'ACTIVE');

  model.recover('TEL-GW-01');
  const final = model.validate('TEL-GW-01');
  assert.equal(final.route.telemetryGateway, 'TEL-GW-01');
  assert.equal(final.validation.state, 'PASS');
  assert.equal(final.readiness.state, 'READY');
});

test('mission network partition drives NO-GO and returns READY after validation', async () => {
  const model = new MissionNetworkModel();
  model.inject('NET-CORE-01', 'service_down');
  await sleep(5);
  model.detect('NET-CORE-01');
  let snapshot = model.snapshot();
  assert.equal(snapshot.partition.active, true);
  assert.equal(snapshot.readiness.state, 'NO-GO');
  assert.equal(snapshot.nodes.find(n => n.id === 'TRACK-01').state, 'BLOCKED');
  assert.equal(snapshot.nodes.find(n => n.id === 'CMD-01').state, 'BLOCKED');

  model.recover('NET-CORE-01');
  snapshot = model.validate('NET-CORE-01');
  assert.equal(snapshot.partition.active, false);
  assert.equal(snapshot.validation.state, 'PASS');
  assert.equal(snapshot.readiness.state, 'READY');
});

test('manual telemetry advancement deterministically accounts for frames', () => {
  const model = new MissionNetworkModel();
  const before = model.snapshot().frames;
  const after = model.advanceFrames(120).frames;
  assert.equal(after.sent - before.sent, 120);
  assert.equal(after.received - before.received, 120);
  assert.equal(after.lost - before.lost, 0);
  assert.equal(after.lastWindow.continuityPct, 100);
});
