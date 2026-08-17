const clone = (value) => JSON.parse(JSON.stringify(value));
const clampInt = (value, min, max) => Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));
const pct = (part, whole) => whole > 0 ? (part / whole) * 100 : 100;

const INITIAL_FRAMES = 1000;

export class MissionNetworkModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.frames = {
      sent: INITIAL_FRAMES,
      received: INITIAL_FRAMES,
      lost: 0,
      lastSequence: INITIAL_FRAMES,
      lastReceivedSequence: INITIAL_FRAMES,
      sequenceGaps: 0,
      continuityPct: 100,
      lastWindow: { sent: 120, received: 120, lost: 0, continuityPct: 100 }
    };
    this.nodes = {
      'GS-A': { id: 'GS-A', role: 'PRIMARY_GROUND', state: 'PRIMARY', health: 'NOMINAL' },
      'GS-B': { id: 'GS-B', role: 'REDUNDANT_GROUND', state: 'STANDBY', health: 'NOMINAL' },
      'TEL-GW-01': { id: 'TEL-GW-01', role: 'PRIMARY_GATEWAY', state: 'ACTIVE', health: 'NOMINAL' },
      'TEL-GW-02': { id: 'TEL-GW-02', role: 'REDUNDANT_GATEWAY', state: 'STANDBY', health: 'NOMINAL' },
      'NET-CORE-01': { id: 'NET-CORE-01', role: 'MISSION_NETWORK', state: 'ROUTING', health: 'NOMINAL' },
      'TRACK-01': { id: 'TRACK-01', role: 'TRACKING_CONSUMER', state: 'READY', health: 'NOMINAL' },
      'CMD-01': { id: 'CMD-01', role: 'COMMAND_CONSUMER', state: 'READY', health: 'NOMINAL' },
      'MDB-01': { id: 'MDB-01', role: 'MISSION_DATA', state: 'READY', health: 'NOMINAL' }
    };
    this.route = {
      groundStation: 'GS-A',
      telemetryGateway: 'TEL-GW-01',
      mode: 'PRIMARY',
      path: ['GS-A', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01']
    };
    this.transport = 'NOMINAL';
    this.partition = { active: false, scope: null, detail: null };
    this.incident = null;
    this.failover = {
      state: 'IDLE',
      type: null,
      from: null,
      to: null,
      detectionMs: null,
      routeTransitionMs: null,
      totalInterruptionMs: null,
      validated: false,
      validatedRoute: null
    };
    this.validation = {
      state: 'PASS',
      continuityPct: 100,
      sequenceGaps: 0,
      detail: 'Primary mission telemetry path validated.'
    };
    this.readiness = this.buildReadiness();
    return this.snapshot();
  }

  updateNode(id, patch) {
    if (this.nodes[id]) Object.assign(this.nodes[id], patch);
  }

  refreshRoute() {
    this.route.path = [this.route.groundStation, this.route.telemetryGateway, 'NET-CORE-01', 'MDB-01'];
  }

  shouldDrop(sequence) {
    if (this.transport === 'INTERRUPTED' || this.transport === 'PARTITIONED') return true;
    if (this.transport === 'DEGRADED') return sequence % 5 === 0;
    return false;
  }

  advanceFrames(count = 120) {
    const requested = clampInt(count, 1, 5000) || 120;
    let received = 0;
    let lost = 0;
    for (let i = 0; i < requested; i += 1) {
      const sequence = this.frames.lastSequence + 1;
      this.frames.lastSequence = sequence;
      this.frames.sent += 1;
      if (this.shouldDrop(sequence)) {
        this.frames.lost += 1;
        this.frames.sequenceGaps += 1;
        lost += 1;
      } else {
        this.frames.received += 1;
        this.frames.lastReceivedSequence = sequence;
        received += 1;
      }
    }
    this.frames.continuityPct = pct(this.frames.received, this.frames.sent);
    this.frames.lastWindow = {
      sent: requested,
      received,
      lost,
      continuityPct: pct(received, requested)
    };
    this.readiness = this.buildReadiness();
    return this.snapshot();
  }

  inject(targetId, faultType) {
    this.incident = {
      target: targetId,
      faultType,
      injectedAtMs: Date.now(),
      detectedAtMs: null,
      recovering: false
    };
    this.failover = {
      state: 'ARMED',
      type: null,
      from: targetId,
      to: null,
      detectionMs: null,
      routeTransitionMs: null,
      totalInterruptionMs: null,
      validated: false,
      validatedRoute: null
    };
    this.validation = {
      state: 'PENDING',
      continuityPct: this.frames.lastWindow.continuityPct,
      sequenceGaps: this.frames.lastWindow.lost,
      detail: 'Post-incident continuity validation required.'
    };

    if (targetId === 'GS-A') {
      this.transport = 'DEGRADED';
      this.updateNode('GS-A', { state: 'DEGRADED', health: 'DEGRADED' });
      this.updateNode('GS-B', { state: 'STANDBY', health: 'NOMINAL' });
      this.advanceFrames(40);
    } else if (targetId === 'TEL-GW-01') {
      this.transport = 'INTERRUPTED';
      this.updateNode('TEL-GW-01', { state: 'UNAVAILABLE', health: 'CRITICAL' });
      this.updateNode('TEL-GW-02', { state: 'STANDBY', health: 'NOMINAL' });
      this.advanceFrames(24);
    } else if (targetId === 'NET-CORE-01') {
      this.transport = 'PARTITIONED';
      this.partition = { active: true, scope: 'MISSION_BACKBONE', detail: 'Telemetry and command consumers are isolated from the mission network fabric.' };
      this.updateNode('NET-CORE-01', { state: 'PARTITIONED', health: 'CRITICAL' });
      this.updateNode('TRACK-01', { state: 'BLOCKED', health: 'CRITICAL' });
      this.updateNode('CMD-01', { state: 'BLOCKED', health: 'CRITICAL' });
      this.route.mode = 'PARTITIONED';
      this.advanceFrames(32);
    } else if (targetId === 'CMD-01') {
      this.updateNode('CMD-01', { state: 'DEGRADED', health: 'DEGRADED' });
      this.advanceFrames(24);
    }

    this.readiness = this.buildReadiness();
    return this.snapshot();
  }

  detect(targetId) {
    if (!this.incident) return this.snapshot();
    const now = Date.now();
    this.incident.detectedAtMs = now;
    const detectionMs = Math.max(1, now - this.incident.injectedAtMs);

    if (targetId === 'GS-A') {
      this.performFailover({ type: 'GROUND', from: 'GS-A', to: 'GS-B', detectionMs, routeTransitionMs: 180 });
      this.updateNode('GS-A', { state: 'FAULT', health: 'CRITICAL' });
      this.updateNode('GS-B', { state: 'PRIMARY', health: 'NOMINAL' });
      this.route.groundStation = 'GS-B';
      this.route.mode = 'REDUNDANT';
      this.transport = 'NOMINAL';
      this.refreshRoute();
      this.advanceFrames(60);
    } else if (targetId === 'TEL-GW-01') {
      this.performFailover({ type: 'GATEWAY', from: 'TEL-GW-01', to: 'TEL-GW-02', detectionMs, routeTransitionMs: 140 });
      this.updateNode('TEL-GW-01', { state: 'FAULT', health: 'CRITICAL' });
      this.updateNode('TEL-GW-02', { state: 'ACTIVE', health: 'NOMINAL' });
      this.route.telemetryGateway = 'TEL-GW-02';
      this.route.mode = 'REDUNDANT';
      this.transport = 'NOMINAL';
      this.refreshRoute();
      this.advanceFrames(60);
    } else if (targetId === 'NET-CORE-01') {
      this.failover = {
        state: 'BLOCKED',
        type: 'NETWORK_PARTITION',
        from: 'NET-CORE-01',
        to: null,
        detectionMs,
        routeTransitionMs: null,
        totalInterruptionMs: detectionMs,
        validated: false,
        validatedRoute: null
      };
      this.advanceFrames(40);
    } else if (targetId === 'CMD-01') {
      this.updateNode('CMD-01', { state: 'FAULT', health: 'CRITICAL' });
      this.failover.detectionMs = detectionMs;
      this.failover.state = 'NOT_REQUIRED';
      this.failover.type = 'SERVICE';
    }

    this.readiness = this.buildReadiness();
    return this.snapshot();
  }

  performFailover({ type, from, to, detectionMs, routeTransitionMs }) {
    this.failover = {
      state: 'ACTIVE',
      type,
      from,
      to,
      detectionMs,
      routeTransitionMs,
      totalInterruptionMs: detectionMs + routeTransitionMs,
      validated: false,
      validatedRoute: null
    };
  }

  recover(targetId) {
    if (this.incident) this.incident.recovering = true;

    if (targetId === 'GS-A') {
      this.updateNode('GS-A', { state: 'RECOVERING', health: 'RECOVERING' });
      this.transport = 'NOMINAL';
      this.advanceFrames(40);
    } else if (targetId === 'TEL-GW-01') {
      this.updateNode('TEL-GW-01', { state: 'RECOVERING', health: 'RECOVERING' });
      this.transport = 'NOMINAL';
      this.advanceFrames(40);
    } else if (targetId === 'NET-CORE-01') {
      this.partition = { active: false, scope: null, detail: null };
      this.transport = 'NOMINAL';
      this.updateNode('NET-CORE-01', { state: 'RECOVERING', health: 'RECOVERING' });
      this.updateNode('TRACK-01', { state: 'READY', health: 'NOMINAL' });
      this.updateNode('CMD-01', { state: 'READY', health: 'NOMINAL' });
      this.route.mode = 'RECOVERING';
      this.advanceFrames(40);
    } else if (targetId === 'CMD-01') {
      this.updateNode('CMD-01', { state: 'RECOVERING', health: 'RECOVERING' });
      this.advanceFrames(40);
    }

    this.readiness = this.buildReadiness();
    return this.snapshot();
  }

  validate(targetId) {
    const validatedRoute = [...this.route.path];
    this.transport = 'NOMINAL';
    const validationSample = this.advanceFrames(120);

    if (targetId === 'GS-A') {
      this.updateNode('GS-A', { state: 'PRIMARY', health: 'NOMINAL' });
      this.updateNode('GS-B', { state: 'STANDBY', health: 'NOMINAL' });
      this.route.groundStation = 'GS-A';
      this.route.mode = 'PRIMARY';
    } else if (targetId === 'TEL-GW-01') {
      this.updateNode('TEL-GW-01', { state: 'ACTIVE', health: 'NOMINAL' });
      this.updateNode('TEL-GW-02', { state: 'STANDBY', health: 'NOMINAL' });
      this.route.telemetryGateway = 'TEL-GW-01';
      this.route.mode = 'PRIMARY';
    } else if (targetId === 'NET-CORE-01') {
      this.updateNode('NET-CORE-01', { state: 'ROUTING', health: 'NOMINAL' });
      this.route.mode = 'PRIMARY';
    } else if (targetId === 'CMD-01') {
      this.updateNode('CMD-01', { state: 'READY', health: 'NOMINAL' });
    }

    this.refreshRoute();
    this.validation = {
      state: validationSample.frames.lastWindow.continuityPct >= 99 ? 'PASS' : 'FAIL',
      continuityPct: validationSample.frames.lastWindow.continuityPct,
      sequenceGaps: validationSample.frames.lastWindow.lost,
      detail: validationSample.frames.lastWindow.continuityPct >= 99
        ? 'Telemetry continuity and mission dependencies validated after recovery.'
        : 'Telemetry continuity failed post-recovery validation.'
    };
    if (this.failover.state !== 'IDLE' && this.failover.state !== 'NOT_REQUIRED') {
      this.failover.state = 'VALIDATED';
      this.failover.validated = this.validation.state === 'PASS';
      this.failover.validatedRoute = validatedRoute;
    }
    this.incident = null;
    this.readiness = this.buildReadiness();
    return this.snapshot();
  }

  buildReadiness() {
    const activeGround = this.nodes?.[this.route?.groundStation];
    const activeGateway = this.nodes?.[this.route?.telemetryGateway];
    const core = this.nodes?.['NET-CORE-01'];
    const command = this.nodes?.['CMD-01'];
    const tracking = this.nodes?.['TRACK-01'];
    const latestContinuity = this.frames?.lastWindow?.continuityPct ?? 100;

    const checks = [
      {
        id: 'ground-path',
        label: 'Ground path available',
        status: activeGround && activeGround.health !== 'CRITICAL' ? 'PASS' : 'FAIL',
        detail: activeGround ? `${activeGround.id} · ${activeGround.state}` : 'No ground route selected'
      },
      {
        id: 'telemetry-gateway',
        label: 'Telemetry gateway available',
        status: activeGateway && activeGateway.health !== 'CRITICAL' ? 'PASS' : 'FAIL',
        detail: activeGateway ? `${activeGateway.id} · ${activeGateway.state}` : 'No telemetry gateway selected'
      },
      {
        id: 'network-fabric',
        label: 'Mission network fabric',
        status: !this.partition?.active && core?.health !== 'CRITICAL' ? 'PASS' : 'FAIL',
        detail: this.partition?.active ? 'Partition detected' : `${core?.id || 'NET-CORE-01'} · ${core?.state || 'UNKNOWN'}`
      },
      {
        id: 'tracking',
        label: 'Tracking dependency',
        status: tracking?.health === 'CRITICAL' ? 'FAIL' : 'PASS',
        detail: tracking ? `${tracking.id} · ${tracking.state}` : 'Tracking dependency unavailable'
      },
      {
        id: 'command',
        label: 'Command dependency',
        status: command?.health === 'CRITICAL' ? 'FAIL' : command?.health === 'DEGRADED' || command?.health === 'RECOVERING' ? 'WARN' : 'PASS',
        detail: command ? `${command.id} · ${command.state}` : 'Command dependency unavailable'
      },
      {
        id: 'continuity',
        label: 'Telemetry continuity ≥ 99%',
        status: latestContinuity >= 99 ? 'PASS' : latestContinuity >= 95 ? 'WARN' : 'FAIL',
        detail: `${latestContinuity.toFixed(2)}% in latest frame window`
      }
    ];

    const hasFail = checks.some((check) => check.status === 'FAIL');
    const hasWarn = checks.some((check) => check.status === 'WARN');
    const pendingValidation = this.validation?.state === 'PENDING';
    const state = hasFail ? 'NO-GO' : (hasWarn || pendingValidation || this.incident ? 'DEGRADED' : 'READY');
    const score = Math.round((checks.reduce((sum, check) => sum + (check.status === 'PASS' ? 1 : check.status === 'WARN' ? 0.5 : 0), 0) / checks.length) * 100);
    return { state, score, checks };
  }

  snapshot() {
    return {
      route: clone(this.route),
      nodes: Object.values(this.nodes || {}).map(clone),
      frames: clone(this.frames),
      transport: this.transport,
      partition: clone(this.partition),
      failover: clone(this.failover),
      validation: clone(this.validation),
      readiness: clone(this.readiness),
      dependencies: {
        telemetry: ['GS-A|GS-B', 'TEL-GW-01|TEL-GW-02', 'NET-CORE-01', 'MDB-01'],
        tracking: ['TEL-GW-01|TEL-GW-02', 'NET-CORE-01', 'TRACK-01'],
        command: ['NET-CORE-01', 'MDB-01', 'CMD-01']
      }
    };
  }
}
