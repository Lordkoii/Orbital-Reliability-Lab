import test from 'node:test';
import assert from 'node:assert/strict';
import { ReliabilityEngine } from '../src/reliability-engine.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('starts nominal in mission operations', () => {
  const engine = new ReliabilityEngine();
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.status, 'NOMINAL');
  assert.equal(snapshot.environment.id, 'mission');
  assert.equal(snapshot.activeFault, null);
  assert.ok(snapshot.systems.length >= 6);
});

test('switches environments and exposes domain scenarios', () => {
  const engine = new ReliabilityEngine();
  const result = engine.setEnvironment('factory');
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.environment.id, 'factory');
  assert.ok(result.snapshot.scenarios.every((scenario) => scenario.environment === 'factory'));
  assert.ok(result.snapshot.systems.some((system) => system.id === 'LITH-01'));
});

test('runs a mission scenario against its target and auto-recovers', async () => {
  const engine = new ReliabilityEngine();
  const injected = engine.runScenario('mission-ground-link-degradation');
  assert.equal(injected.ok, true);
  assert.equal(injected.snapshot.status, 'DEGRADED');
  assert.equal(injected.snapshot.activeFault.target, 'GS-A');
  assert.equal(injected.snapshot.systems.find((system) => system.id === 'GS-A').state, 'DEGRADED');

  await sleep(900);
  assert.equal(engine.getSnapshot().status, 'INCIDENT');

  await sleep(3400);
  const final = engine.getSnapshot();
  assert.equal(final.status, 'NOMINAL');
  assert.equal(final.activeFault, null);
  assert.equal(final.activeScenario, null);
  assert.ok(final.lastMttrMs > 0);
});

test('rejects a scenario from the wrong environment', () => {
  const engine = new ReliabilityEngine({ environment: 'factory' });
  const result = engine.runScenario('mission-ground-link-degradation');
  assert.equal(result.ok, false);
  assert.match(result.reason, /active environment/);
});

test('supports manual recovery', async () => {
  const engine = new ReliabilityEngine({ environment: 'factory' });
  engine.setAutoRecovery(false);
  engine.runScenario('factory-mes-gateway-outage');
  await sleep(900);
  assert.equal(engine.getSnapshot().status, 'INCIDENT');
  const result = engine.recover('manual');
  assert.equal(result.ok, true);
  await sleep(850);
  assert.equal(engine.getSnapshot().status, 'NOMINAL');
});
