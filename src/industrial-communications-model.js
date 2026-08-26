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
      lastMessageAt: null
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
    for (const endpoint of this.endpoints) {
      const system = systems.find((candidate) => candidate.id === endpoint.assetId);
      if (!system) continue;
      const result = this.publish(endpoint.assetId, {
        state: system.state,
        health: system.health,
        operation: system.detail || system.role || null
      });
      if (result.ok) messages.push(result.message);
    }
    return { ok: true, published: messages.length, messages, snapshot: this.snapshot() };
  }

  snapshot() {
    return {
      broker: { ...this.broker },
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
        messagesDropped: this.broker.messagesDropped
      }
    };
  }
}
