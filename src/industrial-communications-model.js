const FACTORY_ASSETS = ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01', 'AMHS-01', 'MES-01'];
const OPCUA_MONITORED_ASSET = 'MET-01';

const topicFor = (assetId, channel) => `factory/equipment/${assetId}/${channel}`;

export class IndustrialCommunicationsModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.sequence = 0;
    this.broker = {
      id: 'ORL-MQTT-01',
      protocol: 'MQTT',
      implementation: 'IN_MEMORY_SIMULATION',
      state: 'ONLINE',
      connectedClients: FACTORY_ASSETS.length,
      messagesPublished: 0,
      messagesDropped: 0,
      reconnectCount: 0,
      lastMessageAt: null
    };
    this.outage = {
      active: false,
      state: 'CLEAR',
      injectedAt: null,
      detectedAt: null,
      reconnectStartedAt: null,
      recoveredAt: null,
      reason: null
    };
    this.validation = {
      state: 'PASS',
      detail: 'Broker online; all registered equipment endpoints connected.',
      validatedAt: new Date().toISOString()
    };
    this.opcUa = {
      id: 'ORL-OPCUA-01',
      protocol: 'OPC-UA',
      implementation: 'SIMULATED_ADAPTER',
      state: 'ONLINE',
      endpointUrl: 'opc.tcp://orl-factory:4840',
      namespace: 'urn:orl:factory',
      monitoredAsset: OPCUA_MONITORED_ASSET,
      monitoredNode: `ns=2;s=Equipment/${OPCUA_MONITORED_ASSET}/State`,
      sessions: 1,
      sessionState: 'ACTIVE',
      reads: 0,
      staleReads: 0,
      reconnectCount: 0,
      lastReadAt: null,
      lastValue: null,
      note: 'Simulated OPC-UA session monitoring metrology state and health.',
      validation: {
        state: 'PASS',
        detail: 'Adapter online; monitored metrology node is readable.',
        validatedAt: new Date().toISOString()
      },
      outage: {
        active: false,
        state: 'CLEAR',
        injectedAt: null,
        detectedAt: null,
        reconnectStartedAt: null,
        recoveredAt: null,
        reason: null
      }
    };
    this.endpoints = FACTORY_ASSETS.map((assetId) => ({
      assetId,
      connected: true,
      qos: 1,
      topics: {
        state: topicFor(assetId, 'state'),
        telemetry: topicFor(assetId, 'telemetry'),
        health: topicFor(assetId, 'health')
      },
      messagesPublished: 0,
      messagesDropped: 0,
      lastSequence: 0,
      lastSeenAt: null,
      lastPayload: null
    }));
    return this.snapshot();
  }

  getEndpoint(assetId) {
    return this.endpoints.find((endpoint) => endpoint.assetId === assetId) || null;
  }

  publish(assetId, payload = {}) {
    const endpoint = this.getEndpoint(assetId);
    if (!endpoint) return { ok: false, reason: 'Unknown factory communications endpoint', snapshot: this.snapshot() };
    if (this.broker.state !== 'ONLINE' || !endpoint.connected) {
      this.broker.messagesDropped += 1;
      endpoint.messagesDropped += 1;
      return { ok: false, reason: 'MQTT path unavailable', snapshot: this.snapshot() };
    }

    this.sequence += 1;
    const at = new Date().toISOString();
    endpoint.messagesPublished += 1;
    endpoint.lastSequence = this.sequence;
    endpoint.lastSeenAt = at;
    endpoint.lastPayload = {
      sequence: this.sequence,
      assetId,
      state: payload.state || 'UNKNOWN',
      health: payload.health || 'UNKNOWN',
      operation: payload.operation || null,
      at
    };
    this.broker.messagesPublished += 1;
    this.broker.lastMessageAt = at;

    return {
      ok: true,
      message: {
        topic: endpoint.topics.telemetry,
        qos: endpoint.qos,
        payload: { ...endpoint.lastPayload }
      },
      snapshot: this.snapshot()
    };
  }

  publishFactorySnapshot(systems = []) {
    const messages = [];
    let dropped = 0;
    for (const endpoint of this.endpoints) {
      const system = systems.find((candidate) => candidate.id === endpoint.assetId);
      if (!system) continue;
      const result = this.publish(endpoint.assetId, {
        state: system.state,
        health: system.health,
        operation: system.detail || system.role || null
      });
      if (result.ok) messages.push(result.message);
      else dropped += 1;
    }
    return { ok: dropped === 0, published: messages.length, dropped, messages, snapshot: this.snapshot() };
  }

  injectBrokerOutage(reason = 'Controlled MQTT broker outage') {
    if (this.outage.active) return { ok: false, reason: 'MQTT outage already active', snapshot: this.snapshot() };
    const at = new Date().toISOString();
    this.outage = {
      active: true,
      state: 'INJECTED',
      injectedAt: at,
      detectedAt: null,
      reconnectStartedAt: null,
      recoveredAt: null,
      reason
    };
    this.validation = {
      state: 'PENDING',
      detail: 'Communications recovery and endpoint validation required.',
      validatedAt: null
    };
    this.broker.state = 'OFFLINE';
    this.broker.connectedClients = 0;
    for (const endpoint of this.endpoints) endpoint.connected = false;
    return { ok: true, snapshot: this.snapshot() };
  }

  detectBrokerOutage() {
    if (!this.outage.active) return { ok: false, reason: 'No active MQTT outage', snapshot: this.snapshot() };
    this.outage.state = 'CONFIRMED';
    this.outage.detectedAt = new Date().toISOString();
    return { ok: true, snapshot: this.snapshot() };
  }

  beginReconnect() {
    if (!this.outage.active) return { ok: false, reason: 'No active MQTT outage', snapshot: this.snapshot() };
    this.outage.state = 'RECONNECTING';
    this.outage.reconnectStartedAt = new Date().toISOString();
    this.broker.state = 'RECONNECTING';
    this.broker.connectedClients = 0;
    this.validation = {
      state: 'RUNNING',
      detail: 'Broker restart complete; equipment sessions are reconnecting.',
      validatedAt: null
    };
    return { ok: true, snapshot: this.snapshot() };
  }

  validateReconnect(systems = []) {
    if (!this.outage.active) return { ok: false, reason: 'No active MQTT outage', snapshot: this.snapshot() };
    const at = new Date().toISOString();
    this.broker.state = 'ONLINE';
    this.broker.reconnectCount += 1;
    for (const endpoint of this.endpoints) endpoint.connected = true;
    this.broker.connectedClients = this.endpoints.length;
    this.outage.state = 'RECOVERED';
    this.outage.recoveredAt = at;

    const publishResult = this.publishFactorySnapshot(systems);
    const allConnected = this.endpoints.every((endpoint) => endpoint.connected);
    const passed = allConnected && publishResult.published === this.endpoints.length && publishResult.dropped === 0;
    this.validation = {
      state: passed ? 'PASS' : 'FAIL',
      detail: passed
        ? `${publishResult.published}/${this.endpoints.length} equipment telemetry paths republished after reconnect.`
        : `Reconnect validation incomplete: ${publishResult.published}/${this.endpoints.length} telemetry paths published.`,
      validatedAt: at
    };
    this.outage.active = false;
    return { ok: passed, published: publishResult.published, snapshot: this.snapshot() };
  }

  readOpcUaNode(systems = []) {
    const system = systems.find((candidate) => candidate.id === this.opcUa.monitoredAsset);
    const at = new Date().toISOString();
    if (this.opcUa.state !== 'ONLINE' || this.opcUa.sessions < 1 || this.opcUa.sessionState !== 'ACTIVE') {
      this.opcUa.staleReads += 1;
      this.opcUa.lastReadAt = at;
      this.opcUa.lastValue = {
        nodeId: this.opcUa.monitoredNode,
        assetId: this.opcUa.monitoredAsset,
        statusCode: 'BadSessionClosed',
        stale: true,
        sourceTimestamp: at
      };
      return { ok: false, reason: 'OPC-UA session unavailable', value: { ...this.opcUa.lastValue }, snapshot: this.snapshot() };
    }
    if (!system) return { ok: false, reason: 'Monitored OPC-UA asset unavailable', snapshot: this.snapshot() };

    this.opcUa.reads += 1;
    this.opcUa.lastReadAt = at;
    this.opcUa.lastValue = {
      nodeId: this.opcUa.monitoredNode,
      assetId: system.id,
      state: system.state,
      health: system.health,
      statusCode: 'Good',
      stale: false,
      sourceTimestamp: at
    };
    return { ok: true, value: { ...this.opcUa.lastValue }, snapshot: this.snapshot() };
  }

  injectOpcUaSessionLoss(reason = 'Controlled OPC-UA session loss') {
    if (this.opcUa.outage.active) return { ok: false, reason: 'OPC-UA outage already active', snapshot: this.snapshot() };
    const at = new Date().toISOString();
    this.opcUa.state = 'SESSION_LOST';
    this.opcUa.sessions = 0;
    this.opcUa.sessionState = 'LOST';
    this.opcUa.note = 'Metrology adapter session lost; monitored node data is stale.';
    this.opcUa.validation = {
      state: 'PENDING',
      detail: 'Session recovery and metrology node readback required.',
      validatedAt: null
    };
    this.opcUa.outage = {
      active: true,
      state: 'INJECTED',
      injectedAt: at,
      detectedAt: null,
      reconnectStartedAt: null,
      recoveredAt: null,
      reason
    };
    return { ok: true, snapshot: this.snapshot() };
  }

  detectOpcUaSessionLoss(systems = []) {
    if (!this.opcUa.outage.active) return { ok: false, reason: 'No active OPC-UA outage', snapshot: this.snapshot() };
    this.opcUa.outage.state = 'CONFIRMED';
    this.opcUa.outage.detectedAt = new Date().toISOString();
    const read = this.readOpcUaNode(systems);
    return { ok: true, staleRead: read.value || null, snapshot: this.snapshot() };
  }

  beginOpcUaReconnect() {
    if (!this.opcUa.outage.active) return { ok: false, reason: 'No active OPC-UA outage', snapshot: this.snapshot() };
    this.opcUa.state = 'RECONNECTING';
    this.opcUa.sessionState = 'NEGOTIATING';
    this.opcUa.sessions = 0;
    this.opcUa.note = 'Adapter transport restored; OPC-UA secure session is being re-established.';
    this.opcUa.validation = {
      state: 'RUNNING',
      detail: 'Re-establishing session and preparing monitored-node readback.',
      validatedAt: null
    };
    this.opcUa.outage.state = 'RECONNECTING';
    this.opcUa.outage.reconnectStartedAt = new Date().toISOString();
    return { ok: true, snapshot: this.snapshot() };
  }

  validateOpcUaReconnect(systems = []) {
    if (!this.opcUa.outage.active) return { ok: false, reason: 'No active OPC-UA outage', snapshot: this.snapshot() };
    const at = new Date().toISOString();
    this.opcUa.state = 'ONLINE';
    this.opcUa.sessionState = 'ACTIVE';
    this.opcUa.sessions = 1;
    this.opcUa.reconnectCount += 1;
    const readback = this.readOpcUaNode(systems);
    const passed = readback.ok && readback.value?.statusCode === 'Good' && !readback.value?.stale;
    this.opcUa.validation = {
      state: passed ? 'PASS' : 'FAIL',
      detail: passed
        ? `${this.opcUa.monitoredAsset} node readback returned Good after session reconnect.`
        : 'OPC-UA session reconnected, but monitored-node readback did not validate.',
      validatedAt: at
    };
    this.opcUa.outage.state = 'RECOVERED';
    this.opcUa.outage.recoveredAt = at;
    this.opcUa.outage.active = false;
    this.opcUa.note = passed
      ? 'Simulated OPC-UA session monitoring metrology state and health.'
      : 'Adapter online with failed post-reconnect node validation.';
    return { ok: passed, value: readback.value || null, snapshot: this.snapshot() };
  }

  snapshot() {
    return {
      broker: { ...this.broker },
      outage: { ...this.outage },
      validation: { ...this.validation },
      opcUa: {
        ...this.opcUa,
        validation: { ...this.opcUa.validation },
        outage: { ...this.opcUa.outage },
        lastValue: this.opcUa.lastValue ? { ...this.opcUa.lastValue } : null
      },
      endpoints: this.endpoints.map((endpoint) => ({
        ...endpoint,
        topics: { ...endpoint.topics },
        lastPayload: endpoint.lastPayload ? { ...endpoint.lastPayload } : null
      })),
      metrics: {
        connectedEndpoints: this.endpoints.filter((endpoint) => endpoint.connected).length,
        totalEndpoints: this.endpoints.length,
        messagesPublished: this.broker.messagesPublished,
        messagesDropped: this.broker.messagesDropped,
        reconnectCount: this.broker.reconnectCount,
        opcUaReads: this.opcUa.reads,
        opcUaStaleReads: this.opcUa.staleReads,
        opcUaReconnectCount: this.opcUa.reconnectCount
      }
    };
  }
}
