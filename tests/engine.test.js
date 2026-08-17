import test from 'node:test';
import assert from 'node:assert/strict';
import { ReliabilityEngine } from '../src/reliability-engine.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('starts mission operations with primary and standby ground paths', () => {
  const engine = new ReliabilityEngine();
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.status, 'NOMINAL');
  assert.equal(snapshot.environment.id, 'mission');
  assert.equal(snapshot.systems.find(s => s.id === 'GS-A').state, 'PRIMARY');
  assert.equal(snapshot.systems.find(s => s.id === 'GS-B').state, 'STANDBY');
  assert.deepEqual(snapshot.activePath, ['GS-A', 'TEL-GW-01', 'MDB-01']);
});

test('ground-link failure creates dependency-aware failover and recovers', async () => {
  const engine = new ReliabilityEngine();
  const injected = engine.runScenario('mission-ground-link-degradation');
  assert.equal(injected.ok, true);
  assert.equal(injected.snapshot.systems.find(s => s.id === 'GS-A').health, 'DEGRADED');
  assert.equal(injected.snapshot.systems.find(s => s.id === 'TEL-GW-01').health, 'WARNING');

  await sleep(900);
  const incident = engine.getSnapshot();
  assert.equal(incident.status, 'INCIDENT');
  assert.equal(incident.systems.find(s => s.id === 'GS-A').state, 'FAULT');
  assert.equal(incident.systems.find(s => s.id === 'GS-B').state, 'FAILOVER');
  assert.equal(incident.systems.find(s => s.id === 'TEL-GW-01').state, 'FAILOVER');
  assert.equal(incident.operationalImpact.level, 'CRITICAL');

  await sleep(2500);
  const recovering = engine.getSnapshot();
  assert.ok(['RECOVERING', 'NOMINAL'].includes(recovering.status));
  if (recovering.status === 'RECOVERING') {
    assert.equal(recovering.systems.find(s => s.id === 'GS-B').state, 'PRIMARY');
    assert.equal(recovering.activePath[0], 'GS-B');
  }

  await sleep(1000);
  const final = engine.getSnapshot();
  assert.equal(final.status, 'NOMINAL');
  assert.equal(final.systems.find(s => s.id === 'GS-A').state, 'PRIMARY');
  assert.equal(final.systems.find(s => s.id === 'GS-B').state, 'STANDBY');
  assert.ok(final.lastMttrMs > 0);
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
