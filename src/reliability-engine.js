const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class ReliabilityEngine {
  constructor() {
    this.startedAt = Date.now();
    this.autoRecovery = true;
    this.incidentCounter = 0;
    this.reset();
  }

  reset() {
    this.metrics = {
      latencyMs: 22,
      packetLossPct: 0.1,
      cpuPct: 31,
      throughputRps: 1260,
      availabilityPct: 99.99
    };
    this.activeFault = null;
    this.status = 'NOMINAL';
    this.detectedAt = null;
    this.lastMttrMs = null;
    this.events = [this.event('SYSTEM', 'Telemetry service initialized', 'info')];
    this.recoveryTimer = null;
  }

  event(source, message, severity = 'info') {
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      source,
      message,
      severity
    };
  }

  pushEvent(source, message, severity = 'info') {
    this.events.unshift(this.event(source, message, severity));
    this.events = this.events.slice(0, 80);
  }

  getSnapshot() {
    this.jitter();
    return {
      status: this.status,
      metrics: { ...this.metrics },
      activeFault: this.activeFault,
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

  injectFault(type) {
    if (this.activeFault) {
      return { ok: false, reason: 'An incident is already active', snapshot: this.getSnapshot() };
    }

    const definitions = {
      latency: {
        label: 'Telemetry latency degradation',
        mutate: () => {
          this.metrics.latencyMs = 860;
          this.metrics.cpuPct = 79;
          this.metrics.throughputRps = 740;
        }
      },
      packet_loss: {
        label: 'Packet loss anomaly',
        mutate: () => {
          this.metrics.packetLossPct = 18.4;
          this.metrics.latencyMs = 270;
          this.metrics.throughputRps = 510;
        }
      },
      service_down: {
        label: 'Telemetry API outage',
        mutate: () => {
          this.metrics.availabilityPct = 0;
          this.metrics.throughputRps = 0;
          this.metrics.latencyMs = 9999;
        }
      },
      cpu_spike: {
        label: 'Compute saturation',
        mutate: () => {
          this.metrics.cpuPct = 98.7;
          this.metrics.latencyMs = 430;
          this.metrics.throughputRps = 620;
        }
      }
    };

    const fault = definitions[type];
    if (!fault) return { ok: false, reason: 'Unknown fault type', snapshot: this.getSnapshot() };

    this.incidentCounter += 1;
    this.activeFault = {
      type,
      label: fault.label,
      incidentId: `IR-${String(this.incidentCounter).padStart(3, '0')}`,
      injectedAt: new Date().toISOString()
    };
    fault.mutate();
    this.status = 'DEGRADED';
    this.pushEvent('FAULT', `${this.activeFault.incidentId}: ${fault.label} injected`, 'warning');

    setTimeout(() => this.detectActiveFault(), 700);
    return { ok: true, snapshot: this.getSnapshot() };
  }

  detectActiveFault() {
    if (!this.activeFault) return;
    this.status = 'INCIDENT';
    this.detectedAt = Date.now();
    this.pushEvent('DETECT', `${this.activeFault.incidentId}: Threshold breach confirmed`, 'critical');
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
    this.status = 'RECOVERING';
    this.pushEvent('VALIDATE', `${incidentId}: Running post-recovery health checks`, 'info');

    setTimeout(() => {
      this.metrics = {
        latencyMs: 24,
        packetLossPct: 0.1,
        cpuPct: 34,
        throughputRps: 1290,
        availabilityPct: 99.99
      };
      this.lastMttrMs = this.detectedAt ? Date.now() - this.detectedAt : null;
      this.activeFault = null;
      this.detectedAt = null;
      this.status = 'NOMINAL';
      this.pushEvent('SYSTEM', `${incidentId}: Recovery validated — system nominal (${mode})`, 'success');
      if (this.lastMttrMs) {
        this.pushEvent('RCA', `${incidentId}: Incident evidence captured; MTTR ${(this.lastMttrMs / 1000).toFixed(1)}s`, 'success');
      }
    }, 650);

    return { ok: true, snapshot: this.getSnapshot() };
  }
}
