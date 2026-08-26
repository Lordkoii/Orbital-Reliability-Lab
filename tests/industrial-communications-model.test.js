import test from 'node:test';
import assert from 'node:assert/strict';
import { IndustrialCommunicationsModel } from '../src/industrial-communications-model.js';

test('starts with online MQTT and OPC-UA communications models', () => {
  const model = new IndustrialCommunicationsModel();
  const snapshot = model.snapshot();

  assert.equal(snapshot.broker.id, 'ORL-MQTT-01');
  assert.equal(snapshot.broker.state, 'ONLINE');
  assert.equal(snapshot.broker.implementation, 'IN_MEMORY_SIMULATION');
  assert.equal(snapshot.metrics.connectedEndpoints, 6);
  assert.equal(snapshot.metrics.messagesPublished, 0);
  assert.equal(snapshot.validation.state, 'PASS');
  assert.equal(snapshot.opcUa.id, 'ORL-OPCUA-01');
  assert.equal(snapshot.opcUa.state, 'ONLINE');
  assert.equal(snapshot.opcUa.sessionState, 'ACTIVE');
  assert.equal(snapshot.opcUa.sessions, 1);
  assert.equal(snapshot.opcUa.validation.state, 'PASS');

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
  assert.equal(result.dropped, 0);
  assert.equal(result.snapshot.metrics.messagesPublished, 2);
  assert.equal(result.snapshot.endpoints.find((endpoint) => endpoint.assetId === 'MES-01').lastPayload.state, 'ONLINE');
});

test('broker outage disconnects endpoints, records drops, reconnects, and validates telemetry', () => {
  const model = new IndustrialCommunicationsModel();
  const systems = [
    { id: 'LITH-01', state: 'RUNNING', health: 'NOMINAL' },
    { id: 'ETCH-01', state: 'IDLE', health: 'NOMINAL' },
    { id: 'DEP-01', state: 'IDLE', health: 'NOMINAL' },
    { id: 'MET-01', state: 'IDLE', health: 'NOMINAL' },
    { id: 'AMHS-01', state: 'READY', health: 'NOMINAL' },
    { id: 'MES-01', state: 'ONLINE', health: 'NOMINAL' }
  ];

  const injected = model.injectBrokerOutage('test outage');
  assert.equal(injected.ok, true);
  assert.equal(injected.snapshot.broker.state, 'OFFLINE');
  assert.equal(injected.snapshot.metrics.connectedEndpoints, 0);
  assert.equal(injected.snapshot.validation.state, 'PENDING');

  model.detectBrokerOutage();
  const dropped = model.publishFactorySnapshot(systems);
  assert.equal(dropped.ok, false);
  assert.equal(dropped.published, 0);
  assert.equal(dropped.dropped, 6);
  assert.equal(dropped.snapshot.metrics.messagesDropped, 6);

  const reconnecting = model.beginReconnect();
  assert.equal(reconnecting.snapshot.broker.state, 'RECONNECTING');
  assert.equal(reconnecting.snapshot.validation.state, 'RUNNING');

  const validated = model.validateReconnect(systems);
  assert.equal(validated.ok, true);
  assert.equal(validated.published, 6);
  assert.equal(validated.snapshot.broker.state, 'ONLINE');
  assert.equal(validated.snapshot.metrics.connectedEndpoints, 6);
  assert.equal(validated.snapshot.metrics.reconnectCount, 1);
  assert.equal(validated.snapshot.validation.state, 'PASS');
  assert.equal(validated.snapshot.metrics.messagesDropped, 6);
  assert.equal(validated.snapshot.metrics.messagesPublished, 6);
});

test('OPC-UA session loss produces stale evidence and validates monitored-node readback after reconnect', () => {
  const model = new IndustrialCommunicationsModel();
  const systems = [{ id: 'MET-01', state: 'IDLE', health: 'NOMINAL' }];

  const baseline = model.readOpcUaNode(systems);
  assert.equal(baseline.ok, true);
  assert.equal(baseline.value.statusCode, 'Good');
  assert.equal(baseline.snapshot.opcUa.reads, 1);

  const injected = model.injectOpcUaSessionLoss('test session loss');
  assert.equal(injected.ok, true);
  assert.equal(injected.snapshot.opcUa.state, 'SESSION_LOST');
  assert.equal(injected.snapshot.opcUa.sessions, 0);
  assert.equal(injected.snapshot.opcUa.validation.state, 'PENDING');

  const detected = model.detectOpcUaSessionLoss(systems);
  assert.equal(detected.ok, true);
  assert.equal(detected.staleRead.statusCode, 'BadSessionClosed');
  assert.equal(detected.snapshot.opcUa.staleReads, 1);

  const reconnecting = model.beginOpcUaReconnect();
  assert.equal(reconnecting.snapshot.opcUa.state, 'RECONNECTING');
  assert.equal(reconnecting.snapshot.opcUa.sessionState, 'NEGOTIATING');
  assert.equal(reconnecting.snapshot.opcUa.validation.state, 'RUNNING');

  const validated = model.validateOpcUaReconnect(systems);
  assert.equal(validated.ok, true);
  assert.equal(validated.value.statusCode, 'Good');
  assert.equal(validated.snapshot.opcUa.state, 'ONLINE');
  assert.equal(validated.snapshot.opcUa.sessionState, 'ACTIVE');
  assert.equal(validated.snapshot.opcUa.sessions, 1);
  assert.equal(validated.snapshot.opcUa.reconnectCount, 1);
  assert.equal(validated.snapshot.opcUa.validation.state, 'PASS');
  assert.equal(validated.snapshot.opcUa.staleReads, 1);
  assert.equal(validated.snapshot.opcUa.reads, 2);
});

test('rejects unknown communications endpoints', () => {
  const model = new IndustrialCommunicationsModel();
  const result = model.publish('UNKNOWN-01', { state: 'RUNNING' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unknown factory communications endpoint/);
});
