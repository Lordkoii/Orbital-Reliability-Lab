import test from 'node:test';
import assert from 'node:assert/strict';
import { ReliabilityEngine } from '../src/reliability-engine.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('starts nominal', () => {
  const engine = new ReliabilityEngine();
  const snapshot = engine.getSnapshot();
  assert.equal(snapshot.status, 'NOMINAL');
  assert.equal(snapshot.activeFault, null);
  assert.ok(snapshot.metrics.availabilityPct > 99);
});

test('detects and auto-recovers from packet loss', async () => {
  const engine = new ReliabilityEngine();
  const injected = engine.injectFault('packet_loss');
  assert.equal(injected.ok, true);
  assert.equal(injected.snapshot.status, 'DEGRADED');

  await sleep(900);
  assert.equal(engine.getSnapshot().status, 'INCIDENT');

  await sleep(3400);
  const final = engine.getSnapshot();
  assert.equal(final.status, 'NOMINAL');
  assert.equal(final.activeFault, null);
  assert.ok(final.lastMttrMs > 0);
});

test('supports manual recovery', async () => {
  const engine = new ReliabilityEngine();
  engine.setAutoRecovery(false);
  engine.injectFault('service_down');
  await sleep(900);
  assert.equal(engine.getSnapshot().status, 'INCIDENT');
  const result = engine.recover('manual');
  assert.equal(result.ok, true);
  await sleep(850);
  assert.equal(engine.getSnapshot().status, 'NOMINAL');
});
