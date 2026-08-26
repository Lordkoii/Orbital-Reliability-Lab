import { getEnvironment, listEnvironments } from './environments.js';
import { getScenario, getScenarios } from './scenario-library.js';
import { OperationalModel } from './operational-model.js';
import { ProductionModel } from './production-model.js';
import { MissionNetworkModel } from './mission-network-model.js';
import { IndustrialCommunicationsModel } from './industrial-communications-model.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MQTT_BROKER_ID = 'ORL-MQTT-01';
const OPCUA_ADAPTER_ID = 'ORL-OPCUA-01';
const FACTORY_COMM_ASSETS = ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01', 'AMHS-01', 'MES-01'];

export class ReliabilityEngine {
  constructor({ environment = 'mission' } = {}) {
    this.startedAt = Date.now();
    this.autoRecovery = true;
    this.incidentCounter = 0;
    this.environmentId = getEnvironment(environment) ? environment : 'mission';
    this.operationalModel = new OperationalModel(this.getEnvironment());
    this.productionModel = new ProductionModel();
    this.missionNetworkModel = new MissionNetworkModel();
    this.industrialCommunicationsModel = new IndustrialCommunicationsModel();
    this.reset();
  }

  baselineMetrics() { return { latencyMs: 22, packetLossPct: 0.1, cpuPct: 31, throughputRps: 1260, availabilityPct: 99.99 }; }

  reset() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.metrics = this.baselineMetrics();
    this.activeFault = null;
    this.activeScenario = null;
    this.status = 'NOMINAL';
    this.detectedAt = null;
    this.lastMttrMs = null;
    const environment = this.getEnvironment();
    this.operationalModel.reset(environment);
    this.missionNetworkModel.reset();
    this.industrialCommunicationsModel.reset();
    if (environment.id === 'factory') this.productionModel.reset();
    this.events = [this.event('SYSTEM', `${environment.name} initialized`, 'info')];
    this.recoveryTimer = null;
    return this.getSnapshot();
  }

  event(source, message, severity = 'info') { return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: new Date().toISOString(), source, message, severity }; }
  pushEvent(source, message, severity = 'info') { this.events.unshift(this.event(source, message, severity)); this.events = this.events.slice(0, 160); }
  getEnvironment() { return getEnvironment(this.environmentId); }
  listEnvironments() { return listEnvironments(); }
  getScenarios() { return getScenarios(this.environmentId); }

  setEnvironment(id) {
    const environment = getEnvironment(id);
    if (!environment) return { ok: false, reason: 'Unknown environment', snapshot: this.getSnapshot() };
    if (this.activeFault) return { ok: false, reason: 'Cannot switch environments during an active incident', snapshot: this.getSnapshot() };
    this.environmentId = id;
    this.operationalModel.reset(environment);
    this.reset();
    this.pushEvent('ENV', `${environment.name} selected`, 'success');
    return { ok: true, snapshot: this.getSnapshot() };
  }

  advanceSystem(id) {
    if (this.activeFault) return { ok: false, reason: 'Cannot advance equipment during an active incident', snapshot: this.getSnapshot() };
    const result = this.operationalModel.advanceFactoryAsset(id);
    if (result.ok) {
      this.pushEvent('STATE', `${id}: advanced to ${result.system.state}`, 'success');
      if (this.environmentId === 'factory') this.industrialCommunicationsModel.publish(id, result.system);
    }
    return { ...result, snapshot: this.getSnapshot() };
  }

  advanceMissionFrames(count = 120) {
    if (this.environmentId !== 'mission') return { ok: false, reason: 'Mission telemetry controls are only available in Mission Operations', snapshot: this.getSnapshot() };
    const network = this.missionNetworkModel.advanceFrames(count);
    this.pushEvent('TELEMETRY', `${network.frames.lastWindow.sent} frames transmitted · ${network.frames.lastWindow.lost} lost · ${network.frames.lastWindow.continuityPct.toFixed(2)}% continuity`, network.frames.lastWindow.lost ? 'warning' : 'info');
    return { ok: true, missionNetwork: network, snapshot: this.getSnapshot() };
  }

  createLot(input = {}) {
    if (this.environmentId !== 'factory') return { ok: false, reason: 'Production controls are only available in Factory Operations', snapshot: this.getSnapshot() };
    if (this.activeFault) return { ok: false, reason: 'Cannot create a lot during an active incident', snapshot: this.getSnapshot() };
    const result = this.productionModel.createLot(input);
    if (result.ok) this.pushEvent('MES', `${result.lot.id}: created (${result.lot.wafers} wafers, ${result.lot.recipeId})`, 'success');
    return { ...result, snapshot: this.getSnapshot() };
  }

  advanceLot(id) {
    if (this.environmentId !== 'factory') return { ok: false, reason: 'Production controls are only available in Factory Operations', snapshot: this.getSnapshot() };
    if (this.activeFault) return { ok: false, reason: 'Cannot advance production during an active incident', snapshot: this.getSnapshot() };
    const result = this.productionModel.advanceLot(id);
    if (result.ok) {
      this.pushEvent('MES', `${id}: ${result.lot.status} · ${result.lot.currentOperation}${result.lot.assignedTool ? ` · ${result.lot.assignedTool}` : ''}`, result.lot.status === 'COMPLETED' ? 'success' : 'info');
      this.industrialCommunicationsModel.publishFactorySnapshot(this.operationalModel.snapshot().systems);
    }
    return { ...result, snapshot: this.getSnapshot() };
  }

  publishFactoryCommunications() {
    if (this.environmentId !== 'factory') return { ok: false, reason: 'Industrial communications are only available in Factory Operations', snapshot: this.getSnapshot() };
    const result = this.industrialCommunicationsModel.publishFactorySnapshot(this.operationalModel.snapshot().systems);
    const severity = result.dropped ? 'warning' : 'success';
    this.pushEvent('MQTT', `${result.published} equipment telemetry messages published${result.dropped ? ` · ${result.dropped} dropped` : ''} through ${result.snapshot.broker.id}`, severity);
    return { ...result, snapshot: this.getSnapshot() };
  }

  readFactoryOpcUa() {
    if (this.environmentId !== 'factory') return { ok: false, reason: 'OPC-UA controls are only available in Factory Operations', snapshot: this.getSnapshot() };
    const result = this.industrialCommunicationsModel.readOpcUaNode(this.operationalModel.snapshot().systems);
    const status = result.value?.statusCode || result.reason || 'UNKNOWN';
    this.pushEvent('OPCUA', `${this.industrialCommunicationsModel.opcUa.monitoredAsset} monitored-node read · ${status}`, result.ok ? 'success' : 'warning');
    return { ...result, snapshot: this.getSnapshot() };
  }

  getSnapshot() {
    this.jitter();
    const operational = this.operationalModel.snapshot();
    return {
      status: this.status,
      metrics: { ...this.metrics },
      environment: this.getEnvironment(),
      systems: operational.systems,
      operationalImpact: operational.impact,
      activePath: operational.activePath,
      missionNetwork: this.environmentId === 'mission' ? this.missionNetworkModel.snapshot() : null,
      production: this.environmentId === 'factory' ? this.productionModel.snapshot() : null,
      industrialCommunications: this.environmentId === 'factory' ? this.industrialCommunicationsModel.snapshot() : null,
      scenarios: this.getScenarios(),
      activeFault: this.activeFault,
      activeScenario: this.activeScenario,
      autoRecovery: this.autoRecovery,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      incidentCounter: this.incidentCounter,
      lastMttrMs: this.lastMttrMs,
      updatedAt: new Date().toISOString()
    };
  }

  jitter() {
    if (this.status === 'NOMINAL') {
      this.metrics.latencyMs = clamp(this.metrics.latencyMs + (Math.random() - 0.5) * 3, 15, 35);
      this.metrics.packetLossPct = clamp(this.metrics.packetLossPct + (Math.random() - 0.5) * 0.08, 0, 0.5);
      this.metrics.cpuPct = clamp(this.metrics.cpuPct + (Math.random() - 0.5) * 4, 20, 48);
      this.metrics.throughputRps = clamp(this.metrics.throughputRps + (Math.random() - 0.5) * 80, 1100, 1450);
      this.metrics.availabilityPct = 99.99;
    }
  }

  setAutoRecovery(enabled) { this.autoRecovery = Boolean(enabled); this.pushEvent('CONTROL', `Automatic recovery ${this.autoRecovery ? 'enabled' : 'disabled'}`); return this.getSnapshot(); }

  runScenario(id) {
    const scenario = getScenario(id);
    if (!scenario) return { ok: false, reason: 'Unknown scenario', snapshot: this.getSnapshot() };
    if (scenario.environment !== this.environmentId) return { ok: false, reason: 'Scenario does not belong to the active environment', snapshot: this.getSnapshot() };
    if (this.activeFault) return { ok: false, reason: 'An incident is already active', snapshot: this.getSnapshot() };
    this.activeScenario = { id: scenario.id, name: scenario.name, target: scenario.target, response: scenario.response };
    this.pushEvent('SCENARIO', `${scenario.name} started against ${scenario.target}`, 'warning');
    return this.injectFault(scenario.faultType, { label: scenario.name, target: scenario.target, scenarioId: scenario.id, summary: scenario.summary });
  }

  injectFault(type, context = {}) {
    if (this.activeFault) return { ok: false, reason: 'An incident is already active', snapshot: this.getSnapshot() };
    const definitions = {
      latency: { label: 'Latency degradation', mutate: () => { this.metrics.latencyMs = 860; this.metrics.cpuPct = 79; this.metrics.throughputRps = 740; } },
      packet_loss: { label: 'Packet loss anomaly', mutate: () => { this.metrics.packetLossPct = 18.4; this.metrics.latencyMs = 270; this.metrics.throughputRps = 510; } },
      service_down: { label: 'Service outage', mutate: () => { this.metrics.availabilityPct = 0; this.metrics.throughputRps = 0; this.metrics.latencyMs = 9999; } },
      cpu_spike: { label: 'Compute saturation', mutate: () => { this.metrics.cpuPct = 98.7; this.metrics.latencyMs = 430; this.metrics.throughputRps = 620; } },
      protocol_session_loss: { label: 'Protocol session loss', mutate: () => { this.metrics.packetLossPct = 1.8; this.metrics.latencyMs = 138; this.metrics.throughputRps = 1080; } }
    };
    const fault = definitions[type];
    if (!fault) return { ok: false, reason: 'Unknown fault type', snapshot: this.getSnapshot() };

    this.incidentCounter += 1;
    this.activeFault = { type, label: context.label || fault.label, target: context.target || null, scenarioId: context.scenarioId || null, summary: context.summary || null, incidentId: `IR-${String(this.incidentCounter).padStart(3, '0')}`, injectedAt: new Date().toISOString() };
    fault.mutate();
    this.status = 'DEGRADED';

    const mqttOutage = this.environmentId === 'factory' && this.activeFault.target === MQTT_BROKER_ID;
    const opcUaOutage = this.environmentId === 'factory' && this.activeFault.target === OPCUA_ADAPTER_ID;
    if (mqttOutage) {
      this.industrialCommunicationsModel.injectBrokerOutage(this.activeFault.label);
      this.operationalModel.setImpact(
        'DEGRADED',
        'Factory messaging degraded',
        'The MQTT broker is unavailable. Equipment telemetry delivery is interrupted while production protection remains armed.',
        FACTORY_COMM_ASSETS
      );
    } else if (opcUaOutage) {
      this.industrialCommunicationsModel.injectOpcUaSessionLoss(this.activeFault.label);
      this.operationalModel.setImpact(
        'DEGRADED',
        'Metrology protocol degraded',
        'The OPC-UA session is unavailable and MET-01 state is stale. Quality-sensitive production remains protected until readback is validated.',
        ['MET-01']
      );
    } else if (this.activeFault.target) {
      this.operationalModel.inject(this.activeFault.target, type);
      if (this.environmentId === 'mission') this.missionNetworkModel.inject(this.activeFault.target, type);
    }

    const target = this.activeFault.target ? ` on ${this.activeFault.target}` : '';
    this.pushEvent('FAULT', `${this.activeFault.incidentId}: ${this.activeFault.label}${target} injected`, 'warning');
    if (mqttOutage) this.pushEvent('MQTT', `${this.activeFault.incidentId}: ${MQTT_BROKER_ID} OFFLINE · 0/${FACTORY_COMM_ASSETS.length} endpoints connected`, 'warning');
    if (opcUaOutage) this.pushEvent('OPCUA', `${this.activeFault.incidentId}: ${OPCUA_ADAPTER_ID} SESSION_LOST · MET-01 node data stale`, 'warning');
    if (this.environmentId === 'mission' && this.activeFault.target) {
      const network = this.missionNetworkModel.snapshot();
      this.pushEvent('NETWORK', `${this.activeFault.incidentId}: telemetry window ${network.frames.lastWindow.continuityPct.toFixed(2)}% · readiness ${network.readiness.state}`, network.readiness.state === 'NO-GO' ? 'critical' : 'warning');
    }
    setTimeout(() => this.detectActiveFault(), 700);
    return { ok: true, snapshot: this.getSnapshot() };
  }

  detectActiveFault() {
    if (!this.activeFault) return;
    this.status = 'INCIDENT';
    this.detectedAt = Date.now();
    const mqttOutage = this.environmentId === 'factory' && this.activeFault.target === MQTT_BROKER_ID;
    const opcUaOutage = this.environmentId === 'factory' && this.activeFault.target === OPCUA_ADAPTER_ID;

    if (mqttOutage) {
      this.industrialCommunicationsModel.detectBrokerOutage();
      const dropEvidence = this.industrialCommunicationsModel.publishFactorySnapshot(this.operationalModel.snapshot().systems);
      this.productionModel.hold('MQTT broker unavailable; equipment telemetry acknowledgement unavailable');
      this.operationalModel.setImpact(
        'CRITICAL',
        'Factory communications outage',
        'Equipment messaging is disconnected. Active WIP is held until the broker, endpoint sessions, and telemetry delivery are restored and validated.',
        FACTORY_COMM_ASSETS
      );
      this.pushEvent('MQTT', `${this.activeFault.incidentId}: broker outage confirmed · ${dropEvidence.dropped} equipment messages dropped`, 'critical');
    } else if (opcUaOutage) {
      const stale = this.industrialCommunicationsModel.detectOpcUaSessionLoss(this.operationalModel.snapshot().systems);
      this.productionModel.hold('OPC-UA metrology session lost; quality state is stale and release validation is unavailable');
      this.operationalModel.setImpact(
        'CRITICAL',
        'Metrology session unavailable',
        'OPC-UA node data is stale. WIP is held at the quality gate until the session is re-established and MET-01 readback returns Good.',
        ['MET-01']
      );
      this.pushEvent('OPCUA', `${this.activeFault.incidentId}: stale read confirmed · ${stale.staleRead?.statusCode || 'BadSessionClosed'} · quality hold active`, 'critical');
    } else if (this.activeFault.target) {
      this.operationalModel.detect(this.activeFault.target);
      if (this.environmentId === 'mission') this.missionNetworkModel.detect(this.activeFault.target);
    }

    if (this.environmentId === 'factory' && !mqttOutage && !opcUaOutage) {
      const target = this.activeFault.target;
      if (target === 'MES-01') this.productionModel.hold('MES unavailable; production-state integrity protection');
      if (target === 'AMHS-01') this.productionModel.hold('Material handling unavailable');
      if (target === 'MET-01') this.productionModel.hold('Metrology unavailable; quality release blocked', ['MET-01']);
    }
    const target = this.activeFault.target ? ` (${this.activeFault.target})` : '';
    this.pushEvent('DETECT', `${this.activeFault.incidentId}: Threshold breach confirmed${target}`, 'critical');
    this.pushEvent('DIAGNOSE', `${this.activeFault.incidentId}: Dependency, production, network, and operational impact evaluated`, 'warning');
    this.pushEvent('ISOLATE', `${this.activeFault.incidentId}: Fault domain isolated`, 'warning');
    if (this.environmentId === 'mission' && this.activeFault.target) {
      const network = this.missionNetworkModel.snapshot();
      if (network.failover.state === 'ACTIVE') {
        this.pushEvent('FAILOVER', `${this.activeFault.incidentId}: ${network.failover.from} → ${network.failover.to} · simulated interruption ${network.failover.totalInterruptionMs} ms`, 'warning');
      } else if (network.readiness.state === 'NO-GO') {
        this.pushEvent('READINESS', `${this.activeFault.incidentId}: mission readiness NO-GO · ${network.partition.detail || 'critical dependency unavailable'}`, 'critical');
      }
    }
    if (this.environmentId === 'factory' && this.productionModel.metrics().heldLots) this.pushEvent('MES', `${this.productionModel.metrics().heldLots} lot(s) placed on HOLD`, 'critical');
    if (this.autoRecovery) { this.pushEvent('RECOVERY', `${this.activeFault.incidentId}: Automated recovery sequence started`, 'info'); this.recoveryTimer = setTimeout(() => this.recover('automatic'), 2400); }
  }

  recover(mode = 'manual') {
    if (!this.activeFault) return { ok: false, reason: 'No active incident', snapshot: this.getSnapshot() };
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    const incidentId = this.activeFault.incidentId;
    const targetId = this.activeFault.target;
    const mqttOutage = this.environmentId === 'factory' && targetId === MQTT_BROKER_ID;
    const opcUaOutage = this.environmentId === 'factory' && targetId === OPCUA_ADAPTER_ID;
    this.status = 'RECOVERING';

    if (mqttOutage) {
      this.industrialCommunicationsModel.beginReconnect();
      this.operationalModel.setImpact(
        'RECOVERING',
        'Factory messaging reconnecting',
        'The MQTT broker has restarted. Equipment sessions are reconnecting before telemetry republish and production release validation.',
        FACTORY_COMM_ASSETS
      );
      this.pushEvent('MQTT', `${incidentId}: ${MQTT_BROKER_ID} RECONNECTING · endpoint sessions pending`, 'info');
    } else if (opcUaOutage) {
      this.industrialCommunicationsModel.beginOpcUaReconnect();
      this.operationalModel.setImpact(
        'RECOVERING',
        'Metrology session reconnecting',
        'The OPC-UA transport is restored. A secure session is being re-established before MET-01 node readback and quality release validation.',
        ['MET-01']
      );
      this.pushEvent('OPCUA', `${incidentId}: ${OPCUA_ADAPTER_ID} RECONNECTING · session negotiation active`, 'info');
    } else if (targetId) {
      this.operationalModel.recover(targetId);
      if (this.environmentId === 'mission') this.missionNetworkModel.recover(targetId);
    }
    this.pushEvent('RECOVERY', `${incidentId}: Recovery action applied (${mode})`, 'info');
    this.pushEvent('VALIDATE', `${incidentId}: Running post-recovery health, dependency, continuity, communications, and production-state checks`, 'info');

    const validationDelay = mqttOutage || opcUaOutage ? 1400 : 650;
    setTimeout(() => {
      this.metrics = this.baselineMetrics();
      this.lastMttrMs = this.detectedAt ? Date.now() - this.detectedAt : null;
      if (targetId) this.operationalModel.validate(targetId);
      let missionValidation = null;
      let communicationsValidation = null;
      if (this.environmentId === 'mission' && targetId) missionValidation = this.missionNetworkModel.validate(targetId);
      if (mqttOutage) {
        communicationsValidation = this.industrialCommunicationsModel.validateReconnect(this.operationalModel.snapshot().systems);
        const comms = communicationsValidation.snapshot;
        this.pushEvent(
          'MQTT',
          `${incidentId}: reconnect validation ${comms.validation.state} · ${comms.metrics.connectedEndpoints}/${comms.metrics.totalEndpoints} endpoints · ${communicationsValidation.published} telemetry messages republished`,
          communicationsValidation.ok ? 'success' : 'critical'
        );
      }
      if (opcUaOutage) {
        communicationsValidation = this.industrialCommunicationsModel.validateOpcUaReconnect(this.operationalModel.snapshot().systems);
        const opcUa = communicationsValidation.snapshot.opcUa;
        this.pushEvent(
          'OPCUA',
          `${incidentId}: session validation ${opcUa.validation.state} · ${opcUa.monitoredAsset} readback ${communicationsValidation.value?.statusCode || 'UNKNOWN'} · ${opcUa.sessions} active session`,
          communicationsValidation.ok ? 'success' : 'critical'
        );
      }
      if (this.environmentId === 'factory') {
        const held = this.productionModel.metrics().heldLots;
        if (held && (!communicationsValidation || communicationsValidation.ok)) {
          this.productionModel.release();
          this.pushEvent('MES', `${held} held lot(s) reconciled and released after validation`, 'success');
        }
      }
      this.activeFault = null;
      this.activeScenario = null;
      this.detectedAt = null;
      this.status = 'NOMINAL';
      if (missionValidation) {
        this.pushEvent('NETWORK', `${incidentId}: continuity ${missionValidation.validation.continuityPct.toFixed(2)}% validated · readiness ${missionValidation.readiness.state}`, missionValidation.validation.state === 'PASS' ? 'success' : 'critical');
      }
      this.pushEvent('SYSTEM', `${incidentId}: Recovery validated — operational model nominal (${mode})`, 'success');
      if (this.lastMttrMs) this.pushEvent('EVIDENCE', `${incidentId}: Incident evidence captured; MTTR ${(this.lastMttrMs / 1000).toFixed(1)}s`, 'success');
    }, validationDelay);
    return { ok: true, snapshot: this.getSnapshot() };
  }
}
