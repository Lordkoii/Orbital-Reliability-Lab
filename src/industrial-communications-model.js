const FACTORY_ASSETS = ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01', 'AMHS-01', 'MES-01'];

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
      implementation: 'SIMULATED_ADAPTER',
      state: 'STANDBY',
      sessions: 0,
      note: 'Reserved for the next v0.6 increment.'
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

  snapshot() {
    return {
      broker: { ...this.broker },
      outage: { ...this.outage },
      validation: { ...this.validation },
      opcUa: { ...this.opcUa },
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
        reconnectCount: this.broker.reconnectCount
      }
    };
  }
}
