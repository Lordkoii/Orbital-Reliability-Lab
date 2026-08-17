import test from 'node:test';
import assert from 'node:assert/strict';
import { ReliabilityEngine } from '../src/reliability-engine.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('starts mission operations with redundant network topology and READY readiness', () => {
  const engine = new ReliabilityEngine();
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.status, 'NOMINAL');
  assert.equal(snapshot.environment.id, 'mission');
  assert.equal(snapshot.systems.find(s => s.id === 'GS-A').state, 'PRIMARY');
  assert.equal(snapshot.systems.find(s => s.id === 'GS-B').state, 'STANDBY');
  assert.equal(snapshot.systems.find(s => s.id === 'TEL-GW-02').state, 'STANDBY');
  assert.equal(snapshot.systems.find(s => s.id === 'NET-CORE-01').state, 'READY');
  assert.deepEqual(snapshot.activePath, ['GS-A', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01']);
  assert.equal(snapshot.missionNetwork.readiness.state, 'READY');
});

test('ground-link failure creates measured failover and recovers', async () => {
  const engine = new ReliabilityEngine();
  const injected = engine.runScenario('mission-ground-link-degradation');
  assert.equal(injected.ok, true);
  assert.equal(injected.snapshot.systems.find(s => s.id === 'GS-A').health, 'DEGRADED');
  assert.equal(injected.snapshot.missionNetwork.frames.lastWindow.continuityPct, 80);

  await sleep(900);
  const incident = engine.getSnapshot();
  assert.equal(incident.status, 'INCIDENT');
  assert.equal(incident.systems.find(s => s.id === 'GS-A').state, 'FAULT');
  assert.equal(incident.systems.find(s => s.id === 'GS-B').state, 'FAILOVER');
  assert.equal(incident.missionNetwork.route.groundStation, 'GS-B');
  assert.equal(incident.missionNetwork.failover.type, 'GROUND');
  assert.ok(incident.missionNetwork.failover.totalInterruptionMs > 0);

  await sleep(2500);
  const recovering = engine.getSnapshot();
  assert.ok(['RECOVERING', 'NOMINAL'].includes(recovering.status));

  await sleep(1000);
  const final = engine.getSnapshot();
  assert.equal(final.status, 'NOMINAL');
  assert.equal(final.systems.find(s => s.id === 'GS-A').state, 'PRIMARY');
  assert.equal(final.systems.find(s => s.id === 'GS-B').state, 'STANDBY');
  assert.equal(final.missionNetwork.validation.state, 'PASS');
  assert.equal(final.missionNetwork.readiness.state, 'READY');
  assert.ok(final.lastMttrMs > 0);
});

test('mission frame control advances deterministic telemetry counters', () => {
  const engine = new ReliabilityEngine();
  const before = engine.getSnapshot().missionNetwork.frames.received;
  const result = engine.advanceMissionFrames(120);
  assert.equal(result.ok, true);
  assert.equal(result.missionNetwork.frames.received - before, 120);
  assert.equal(result.missionNetwork.frames.lastWindow.continuityPct, 100);
});

test('MES outage holds tracked factory equipment', async () => {
  const engine = new ReliabilityEngine({ environment: 'factory' });
  engine.setAutoRecovery(false);
  engine.runScenario('factory-mes-gateway-outage');
  await sleep(900);
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.status, 'INCIDENT');
  assert.equal(snapshot.systems.find(s => s.id === 'MES-01').state, 'FAULT');
  for (const id of ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']) {
    assert.equal(snapshot.systems.find(s => s.id === id).state, 'HOLD');
  }
  assert.match(snapshot.operationalImpact.headline, /Factory execution hold/);
});

test('material handling saturation starves process equipment', async () => {
  const engine = new ReliabilityEngine({ environment: 'factory' });
  engine.setAutoRecovery(false);
  engine.runScenario('factory-control-node-saturation');
  await sleep(900);
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.systems.find(s => s.id === 'AMHS-01').state, 'FAULT');
  assert.equal(snapshot.systems.find(s => s.id === 'LITH-01').state, 'STARVED');
  assert.equal(snapshot.operationalImpact.level, 'CRITICAL');
});

test('factory equipment advances through operational lifecycle', () => {
  const engine = new ReliabilityEngine({ environment: 'factory' });
  assert.equal(engine.getSnapshot().systems.find(s => s.id === 'LITH-01').state, 'IDLE');
  assert.equal(engine.advanceSystem('LITH-01').system.state, 'SETUP');
  assert.equal(engine.advanceSystem('LITH-01').system.state, 'RUNNING');
  assert.equal(engine.advanceSystem('LITH-01').system.state, 'COMPLETE');
  assert.equal(engine.advanceSystem('LITH-01').system.state, 'IDLE');
});

test('wrong environment scenario remains rejected', () => {
  const engine = new ReliabilityEngine({ environment: 'factory' });
  const result = engine.runScenario('mission-ground-link-degradation');
  assert.equal(result.ok, false);
  assert.match(result.reason, /active environment/);
});
