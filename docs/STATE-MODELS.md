# Operational State Models — v0.3

v0.3 moves Orbital Reliability Lab beyond global telemetry changes. Assets now carry their own operational state, health, notes, dependencies, and failure effects.

## Mission Operations

Nominal ground path:

`GS-A (PRIMARY) → TEL-GW-01 → MDB-01`

Redundant ground path:

`GS-B (STANDBY)`

A controlled GS-A incident now progresses through operational states:

`PRIMARY → DEGRADED → FAULT → RECOVERING → PRIMARY`

While GS-A is isolated, the model transitions GS-B through:

`STANDBY → FAILOVER → PRIMARY`

and temporarily updates the active telemetry path to:

`GS-B → TEL-GW-01 → MDB-01`

Other mission scenarios propagate impact into dependent consumers. A telemetry gateway outage, for example, blocks the tracking service until telemetry flow is restored.

## Factory Operations

Process equipment implements a simplified lifecycle:

`IDLE → SETUP → RUNNING → COMPLETE → IDLE`

The lifecycle is intentionally generic. It demonstrates state-machine, validation, and operator-control concepts without modeling proprietary semiconductor process recipes.

Failure states are applied separately from lifecycle state:

- `WARNING`
- `FAULT`
- `HOLD`
- `STARVED`
- `RECOVERING`

Examples:

### MES outage

`MES-01 → FAULT`

Tracked equipment is placed on `HOLD` to preserve production-state integrity.

### Material handling saturation

`AMHS-01 → FAULT`

Process equipment becomes `STARVED` because new material movement cannot be trusted.

### Metrology link loss

`MET-01 → FAULT`

The operational impact becomes a quality hold because measurement data is unavailable.

## Operational impact object

The Systems Core exposes an impact model with:

- severity level
- operator-facing headline
- impact detail
- affected asset list
- active mission path or factory process flow

This is displayed in the dashboard and returned through `/api/telemetry`.

## Design boundary

These models are deliberately simplified portfolio simulations. They demonstrate software reliability, state management, failover, operational safety, and testability. They do not represent or claim to reproduce proprietary SpaceX, Tesla, Terafab, Starlink, or semiconductor manufacturing systems.
