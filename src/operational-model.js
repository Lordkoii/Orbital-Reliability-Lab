const clone = (value) => JSON.parse(JSON.stringify(value));

export class OperationalModel {
  constructor(environment) {
    this.reset(environment);
  }

  reset(environment = this.environment) {
    this.environment = environment;
    this.systems = environment.assets.map((asset) => ({
      ...clone(asset),
      state: asset.nominalState || 'READY',
      health: 'NOMINAL',
      note: 'Operating within expected conditions'
    }));
    this.impact = {
      level: 'NONE',
      headline: `${environment.name} nominal`,
      detail: environment.objective,
      affected: []
    };
    this.activePath = environment.id === 'mission'
      ? ['GS-A', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01']
      : [...environment.flow];
    return this.snapshot();
  }

  get(id) {
    return this.systems.find((system) => system.id === id) || null;
  }

  update(id, patch) {
    const system = this.get(id);
    if (system) Object.assign(system, patch);
    return system;
  }

  setImpact(level, headline, detail, affected = []) {
    this.impact = { level, headline, detail, affected: [...new Set(affected)] };
  }

  inject(targetId, faultType) {
    const target = this.get(targetId);
    if (!target) return this.snapshot();

    const targetState = this.environment.id === 'factory' && target.type === 'equipment' ? 'WARNING' : 'DEGRADED';
    this.update(targetId, {
      state: targetState,
      health: 'DEGRADED',
      note: `${faultType.replaceAll('_', ' ')} injected`
    });

    if (this.environment.id === 'mission') this.applyMissionInjection(targetId);
    else this.applyFactoryInjection(targetId);

    return this.snapshot();
  }

  detect(targetId) {
    const target = this.get(targetId);
    if (!target) return this.snapshot();

    this.update(targetId, { state: 'FAULT', health: 'CRITICAL', note: 'Confirmed fault; isolation required' });
    if (this.environment.id === 'mission') this.applyMissionDetection(targetId);
    else this.applyFactoryDetection(targetId);
    return this.snapshot();
  }

  recover(targetId) {
    const target = this.get(targetId);
    if (!target) return this.snapshot();
    this.update(targetId, { state: 'RECOVERING', health: 'RECOVERING', note: 'Recovery action in progress' });

    if (this.environment.id === 'mission' && targetId === 'GS-A') {
      this.update('GS-B', { state: 'PRIMARY', health: 'NOMINAL', note: 'Redundant ground path carrying telemetry' });
      this.update('TEL-GW-01', { state: 'READY', health: 'NOMINAL', note: 'Telemetry continuity restored through GS-B' });
      this.activePath = ['GS-B', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01'];
      this.setImpact('RECOVERING', 'Ground-path failover active', 'Telemetry has been restored through the redundant station while GS-A recovers.', ['GS-A', 'GS-B']);
    } else if (this.environment.id === 'mission' && targetId === 'TEL-GW-01') {
      this.update('TEL-GW-02', { state: 'PRIMARY', health: 'NOMINAL', note: 'Redundant telemetry gateway carrying mission traffic' });
      this.update('NET-CORE-01', { state: 'READY', health: 'NOMINAL', note: 'Mission network receiving telemetry through TEL-GW-02' });
      this.update('TRACK-01', { state: 'READY', health: 'NOMINAL', note: 'Tracking feed restored through redundant gateway' });
      this.activePath = ['GS-A', 'TEL-GW-02', 'NET-CORE-01', 'MDB-01'];
      this.setImpact('RECOVERING', 'Telemetry-gateway failover active', 'Mission telemetry has moved to TEL-GW-02 while the primary gateway recovers.', ['TEL-GW-01', 'TEL-GW-02', 'NET-CORE-01']);
    } else if (this.environment.id === 'mission' && targetId === 'NET-CORE-01') {
      this.update('TRACK-01', { state: 'READY', health: 'NOMINAL', note: 'Tracking dependency restored; validation pending' });
      this.update('CMD-01', { state: 'READY', health: 'NOMINAL', note: 'Command dependency restored; validation pending' });
      this.setImpact('RECOVERING', 'Mission network reconnecting', 'Telemetry, tracking, and command dependencies are restored and awaiting continuity validation.', ['NET-CORE-01', 'TRACK-01', 'CMD-01']);
    } else {
      this.setImpact('RECOVERING', 'Recovery in progress', `${targetId} is being restored and dependent systems are awaiting validation.`, [targetId]);
    }
    return this.snapshot();
  }

  validate(targetId) {
    const previousPath = [...this.activePath];
    const result = this.reset(this.environment);
    if (this.environment.id === 'mission' && targetId === 'GS-A' && previousPath[0] === 'GS-B') {
      result.lastValidatedPath = 'GS-B failover path validated before primary-path restoration';
    }
    if (this.environment.id === 'mission' && targetId === 'TEL-GW-01' && previousPath[1] === 'TEL-GW-02') {
      result.lastValidatedPath = 'TEL-GW-02 failover path validated before primary-gateway restoration';
    }
    return result;
  }

  applyMissionInjection(targetId) {
    if (targetId === 'GS-A') {
      this.update('GS-B', { state: 'STANDBY', health: 'NOMINAL', note: 'Redundant path available for failover' });
      this.update('TEL-GW-01', { state: 'DEGRADED', health: 'WARNING', note: 'Primary ground input degraded' });
      this.setImpact('DEGRADED', 'Primary ground path degraded', 'Telemetry continuity is at risk; redundant path remains available.', ['GS-A', 'TEL-GW-01']);
    } else if (targetId === 'TEL-GW-01') {
      this.update('TEL-GW-02', { state: 'STANDBY', health: 'NOMINAL', note: 'Redundant gateway ready to receive mission telemetry' });
      this.update('NET-CORE-01', { state: 'DEGRADED', health: 'WARNING', note: 'Primary telemetry gateway unavailable' });
      this.update('TRACK-01', { state: 'DEGRADED', health: 'WARNING', note: 'Tracking feed waiting on validated telemetry gateway' });
      this.setImpact('DEGRADED', 'Telemetry gateway degraded', 'The primary gateway is unavailable; redundant gateway failover is armed.', ['TEL-GW-01', 'TEL-GW-02', 'NET-CORE-01', 'TRACK-01']);
    } else if (targetId === 'NET-CORE-01') {
      this.update('TRACK-01', { state: 'DEGRADED', health: 'WARNING', note: 'Mission network dependency degraded' });
      this.update('CMD-01', { state: 'DEGRADED', health: 'WARNING', note: 'Command network dependency degraded' });
      this.setImpact('DEGRADED', 'Mission network fabric degraded', 'Telemetry distribution, tracking, and command dependencies are at risk.', ['NET-CORE-01', 'TRACK-01', 'CMD-01']);
    } else if (targetId === 'CMD-01') {
      this.setImpact('DEGRADED', 'Command capacity degraded', 'Command processing remains available but exceeds normal compute thresholds.', ['CMD-01']);
    }
  }

  applyMissionDetection(targetId) {
    if (targetId === 'GS-A') {
      this.update('GS-B', { state: 'FAILOVER', health: 'WARNING', note: 'Taking over primary ground-link traffic' });
      this.update('TEL-GW-01', { state: 'FAILOVER', health: 'WARNING', note: 'Rebinding telemetry input to GS-B' });
      this.activePath = ['GS-B', 'TEL-GW-01', 'NET-CORE-01', 'MDB-01'];
      this.setImpact('CRITICAL', 'Ground-link failover initiated', 'GS-A is isolated and GS-B is assuming telemetry traffic.', ['GS-A', 'GS-B', 'TEL-GW-01']);
    } else if (targetId === 'TEL-GW-01') {
      this.update('TEL-GW-02', { state: 'FAILOVER', health: 'WARNING', note: 'Taking over telemetry ingest from TEL-GW-01' });
      this.update('NET-CORE-01', { state: 'FAILOVER', health: 'WARNING', note: 'Rebinding telemetry distribution to TEL-GW-02' });
      this.update('TRACK-01', { state: 'DEGRADED', health: 'WARNING', note: 'Tracking feed awaiting gateway route validation' });
      this.activePath = ['GS-A', 'TEL-GW-02', 'NET-CORE-01', 'MDB-01'];
      this.setImpact('CRITICAL', 'Telemetry-gateway failover initiated', 'TEL-GW-01 is isolated and TEL-GW-02 is assuming mission telemetry traffic.', ['TEL-GW-01', 'TEL-GW-02', 'NET-CORE-01', 'TRACK-01']);
    } else if (targetId === 'NET-CORE-01') {
      this.update('TRACK-01', { state: 'BLOCKED', health: 'CRITICAL', note: 'No validated telemetry network route available' });
      this.update('CMD-01', { state: 'BLOCKED', health: 'CRITICAL', note: 'Mission network partition blocks command dependency' });
      this.setImpact('CRITICAL', 'Mission network partition', 'Telemetry distribution, tracking, and command services are isolated until the network fabric is restored.', ['NET-CORE-01', 'TRACK-01', 'CMD-01']);
    } else if (targetId === 'CMD-01') {
      this.setImpact('CRITICAL', 'Command service isolated', 'Command processing is unavailable until capacity is restored and validated.', ['CMD-01']);
    }
  }

  applyFactoryInjection(targetId) {
    if (targetId === 'MET-01') {
      this.setImpact('DEGRADED', 'Metrology data degraded', 'Quality verification is at risk; upstream process tools may continue while release is withheld.', ['MET-01']);
    } else if (targetId === 'MES-01') {
      for (const id of ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']) {
        this.update(id, { health: 'WARNING', note: 'MES acknowledgements delayed' });
      }
      this.setImpact('DEGRADED', 'Production tracking degraded', 'Equipment can finish current work, but new execution should not advance without MES acknowledgements.', ['MES-01', 'LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']);
    } else if (targetId === 'AMHS-01') {
      this.setImpact('DEGRADED', 'Material movement degraded', 'New material transfers are delayed; downstream equipment availability may be starved.', ['AMHS-01']);
    }
  }

  applyFactoryDetection(targetId) {
    if (targetId === 'MET-01') {
      this.update('MET-01', { state: 'FAULT', health: 'CRITICAL', note: 'Metrology interface isolated' });
      this.setImpact('CRITICAL', 'Quality hold active', 'Material awaiting metrology cannot be released until measurement flow is restored.', ['MET-01']);
    } else if (targetId === 'MES-01') {
      for (const id of ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']) {
        this.update(id, { state: 'HOLD', health: 'WARNING', note: 'Execution held pending MES recovery' });
      }
      this.setImpact('CRITICAL', 'Factory execution hold', 'MES is isolated; tracked process equipment is held to protect production-state integrity.', ['MES-01', 'LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']);
    } else if (targetId === 'AMHS-01') {
      for (const id of ['LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']) {
        this.update(id, { state: 'STARVED', health: 'WARNING', note: 'Awaiting material delivery' });
      }
      this.setImpact('CRITICAL', 'Material flow interrupted', 'AMHS is isolated; process tools are unable to receive new material.', ['AMHS-01', 'LITH-01', 'ETCH-01', 'DEP-01', 'MET-01']);
    }
  }

  advanceFactoryAsset(id) {
    if (this.environment.id !== 'factory') return { ok: false, reason: 'Equipment lifecycle controls are only available in Factory Operations', snapshot: this.snapshot() };
    const system = this.get(id);
    if (!system || system.type !== 'equipment' || !Array.isArray(system.lifecycle)) {
      return { ok: false, reason: 'Unknown factory equipment asset', snapshot: this.snapshot() };
    }
    if (system.health !== 'NOMINAL') return { ok: false, reason: 'Cannot advance equipment while health is degraded', snapshot: this.snapshot() };

    const sequence = ['IDLE', 'SETUP', 'RUNNING', 'COMPLETE'];
    const current = sequence.indexOf(system.state);
    const next = current < 0 || current === sequence.length - 1 ? 'IDLE' : sequence[current + 1];
    this.update(id, { state: next, note: `Lifecycle advanced to ${next}` });
    this.setImpact('NONE', `${id} lifecycle updated`, `${system.name} transitioned to ${next}.`, [id]);
    return { ok: true, system: clone(this.get(id)), snapshot: this.snapshot() };
  }

  snapshot() {
    return {
      systems: clone(this.systems),
      impact: clone(this.impact),
      activePath: [...this.activePath]
    };
  }
}
