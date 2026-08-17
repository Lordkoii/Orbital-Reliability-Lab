import { getEnvironment, listEnvironments } from './environments.js';
import { getScenario, getScenarios } from './scenario-library.js';
import { OperationalModel } from './operational-model.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ReliabilityEngine {
  constructor({ environment = 'mission' } = {}) {
    this.startedAt = Date.now();
    this.autoRecovery = true;
    this.incidentCounter = 0;
    this.environmentId = getEnvironment(environment) ? environment : 'mission';
    this.operationalModel = new OperationalModel(this.getEnvironment());
    this.reset();
  }

  baselineMetrics() {
    return { latencyMs: 22, packetLossPct: 0.1, cpuPct: 31, throughputRps: 1260, availabilityPct: 99.99 };
  }

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
    this.events = [this.event('SYSTEM', `${environment.name} initialized`, 'info')];
    this.recoveryTimer = null;
    return this.getSnapshot();
  }

  event(source, message, severity = 'info') {
    return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: new Date().toISOString(), source, message, severity };
  }

  pushEvent(source, message, severity = 'info') {
    this.events.unshift(this.event(source, message, severity));
    this.events = this.events.slice(0, 120);
  }

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
    if (result.ok) this.pushEvent('STATE', `${id}: advanced to ${result.system.state}`, 'success');
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

  setAutoRecovery(enabled) {
    this.autoRecovery = Boolean(enabled);
    this.pushEvent('CONTROL', `Automatic recovery ${this.autoRecovery ? 'enabled' : 'disabled'}`);
    return this.getSnapshot();
  }

  runScenario(id) {
    const scenario = getScenario(id);
    if (!scenario) return { ok: false, reason: 'Unknown scenario', snapshot: this.getSnapshot() };
    if (scenario.environment !== this.environmentId) return { ok: false, reason: 'Scenario does not belong to the active environment', snapshot: this.getSnapshot() };
    if (this.activeFault) return { ok: false, reason: 'An incident is already active', snapshot: this.getSnapshot() };

    this.activeScenario = { id: scenario.id, name: scenario.name, target: scenario.target, response: scenario.response };
    this.pushEvent('SCENARIO', `${scenario.name} started against ${scenario.target}`, 'warning');
    return this.injectFault(scenario.faultType, {
      label: scenario.name,
      target: scenario.target,
      scenarioId: scenario.id,
      summary: scenario.summary
    });
  }

  injectFault(type, context = {}) {
    if (this.activeFault) return { ok: false, reason: 'An incident is already active', snapshot: this.getSnapshot() };

    const definitions = {
      latency: { label: 'Latency degradation', mutate: () => { this.metrics.latencyMs = 860; this.metrics.cpuPct = 79; this.metrics.throughputRps = 740; } },
      packet_loss: { label: 'Packet loss anomaly', mutate: () => { this.metrics.packetLossPct = 18.4; this.metrics.latencyMs = 270; this.metrics.throughputRps = 510; } },
      service_down: { label: 'Service outage', mutate: () => { this.metrics.availabilityPct = 0; this.metrics.throughputRps = 0; this.metrics.latencyMs = 9999; } },
      cpu_spike: { label: 'Compute saturation', mutate: () => { this.metrics.cpuPct = 98.7; this.metrics.latencyMs = 430; this.metrics.throughputRps = 620; } }
    };
    const fault = definitions[type];
    if (!fault) return { ok: false, reason: 'Unknown fault type', snapshot: this.getSnapshot() };

    this.incidentCounter += 1;
    this.activeFault = {
      type,
      label: context.label || fault.label,
      target: context.target || null,
      scenarioId: context.scenarioId || null,
      summary: context.summary || null,
      incidentId: `IR-${String(this.incidentCounter).padStart(3, '0')}`,
      injectedAt: new Date().toISOString()
    };
    fault.mutate();
    this.status = 'DEGRADED';
    if (this.activeFault.target) this.operationalModel.inject(this.activeFault.target, type);
    const target = this.activeFault.target ? ` on ${this.activeFault.target}` : '';
    this.pushEvent('FAULT', `${this.activeFault.incidentId}: ${this.activeFault.label}${target} injected`, 'warning');

    setTimeout(() => this.detectActiveFault(), 700);
    return { ok: true, snapshot: this.getSnapshot() };
  }

  detectActiveFault() {
    if (!this.activeFault) return;
    this.status = 'INCIDENT';
    this.detectedAt = Date.now();
    if (this.activeFault.target) this.operationalModel.detect(this.activeFault.target);
    const target = this.activeFault.target ? ` (${this.activeFault.target})` : '';
    this.pushEvent('DETECT', `${this.activeFault.incidentId}: Threshold breach confirmed${target}`, 'critical');
    this.pushEvent('DIAGNOSE', `${this.activeFault.incidentId}: Dependency and operational impact evaluated`, 'warning');
    this.pushEvent('ISOLATE', `${this.activeFault.incidentId}: Fault domain isolated`, 'warning');

    if (this.autoRecovery) {
      this.pushEvent('RECOVERY', `${this.activeFault.incidentId}: Automated recovery sequence started`, 'info');
      this.recoveryTimer = setTimeout(() => this.recover('automatic'), 2400);
    }
  }

  recover(mode = 'manual') {
    if (!this.activeFault) return { ok: false, reason: 'No active incident', snapshot: this.getSnapshot() };
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);

    const incidentId = this.activeFault.incidentId;
    const targetId = this.activeFault.target;
    this.status = 'RECOVERING';
    if (targetId) this.operationalModel.recover(targetId);
    this.pushEvent('RECOVERY', `${incidentId}: Recovery action applied (${mode})`, 'info');
    this.pushEvent('VALIDATE', `${incidentId}: Running post-recovery health and dependency checks`, 'info');

    setTimeout(() => {
      this.metrics = this.baselineMetrics();
      this.lastMttrMs = this.detectedAt ? Date.now() - this.detectedAt : null;
      if (targetId) this.operationalModel.validate(targetId);
      this.activeFault = null;
      this.activeScenario = null;
      this.detectedAt = null;
      this.status = 'NOMINAL';
      this.pushEvent('SYSTEM', `${incidentId}: Recovery validated — operational model nominal (${mode})`, 'success');
      if (this.lastMttrMs) this.pushEvent('EVIDENCE', `${incidentId}: Incident evidence captured; MTTR ${(this.lastMttrMs / 1000).toFixed(1)}s`, 'success');
    }, 650);

    return { ok: true, snapshot: this.getSnapshot() };
  }
}
