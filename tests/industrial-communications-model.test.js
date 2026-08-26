import test from 'node:test';
import assert from 'node:assert/strict';
import { IndustrialCommunicationsModel } from '../src/industrial-communications-model.js';

test('starts with an online simulated MQTT topology for factory assets', () => {
  const model = new IndustrialCommunicationsModel();
  const snapshot = model.snapshot();

  assert.equal(snapshot.broker.id, 'ORL-MQTT-01');
  assert.equal(snapshot.broker.state, 'ONLINE');
  assert.equal(snapshot.broker.implementation, 'IN_MEMORY_SIMULATION');
  assert.equal(snapshot.metrics.connectedEndpoints, 6);
  assert.equal(snapshot.metrics.messagesPublished, 0);
  assert.equal(snapshot.opcUa.state, 'STANDBY');

  const lith = snapshot.endpoints.find((endpoint) => endpoint.assetId === 'LITH-01');
  assert.equal(lith.topics.telemetry, 'factory/equipment/LITH-01/telemetry');
  assert.equal(lith.qos, 1);
});

test('publishes deterministic equipment telemetry with sequence evidence', () => {
  const model = new IndustrialCommunicationsModel();
  const result = model.publish('ETCH-01', { state: 'RUNNING', health: 'NOMINAL', operation: 'ETCH' });

  assert.equal(result.ok, true);
  assert.equal(result.message.topic, 'factory/equipment/ETCH-01/telemetry');
  assert.equal(result.message.qos, 1);
  assert.equal(result.message.payload.sequence, 1);
  assert.equal(result.message.payload.state, 'RUNNING');
  assert.equal(result.snapshot.metrics.messagesPublished, 1);
  assert.equal(result.snapshot.endpoints.find((endpoint) => endpoint.assetId === 'ETCH-01').lastSequence, 1);
});

test('publishes a factory system snapshot across registered endpoints', () => {
  const model = new IndustrialCommunicationsModel();
  const systems = [
    { id: 'LITH-01', state: 'RUNNING', health: 'NOMINAL', detail: 'Lot processing' },
    { id: 'MES-01', state: 'ONLINE', health: 'NOMINAL', detail: 'Execution service' }
  ];

  const result = model.publishFactorySnapshot(systems);
  assert.equal(result.ok, true);
  assert.equal(result.published, 2);
  assert.equal(result.snapshot.metrics.messagesPublished, 2);
  assert.equal(result.snapshot.endpoints.find((endpoint) => endpoint.assetId === 'MES-01').lastPayload.state, 'ONLINE');
});

test('rejects unknown communications endpoints', () => {
  const model = new IndustrialCommunicationsModel();
  const result = model.publish('UNKNOWN-01', { state: 'RUNNING' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unknown factory communications endpoint/);
});
