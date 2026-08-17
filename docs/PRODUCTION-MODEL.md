# Factory Production Model — v0.4

v0.4 introduces a deliberately simplified production-execution model. It demonstrates software concepts around MES-style lot tracking without claiming to model a real semiconductor fab or proprietary process.

## Core objects

### Recipe

`ORL-DEMO-01` defines a four-operation route:

1. `LITHOGRAPHY` on `LITH-01`
2. `ETCH` on `ETCH-01`
3. `DEPOSITION` on `DEP-01`
4. `METROLOGY` on `MET-01`

### Lot

Each lot tracks:

- lot ID
- wafer count
- recipe ID
- route position
- current operation
- assigned tool
- progress percentage
- WIP status
- hold reason
- event history
- created/updated timestamps

## State model

A normal operation alternates between:

`QUEUED → RUNNING → QUEUED(next operation)`

After metrology:

`RUNNING → COMPLETED`

Reliability protection adds:

`QUEUED/RUNNING → HOLD → validated release`

## Reliability integration

The production model is owned by the shared `ReliabilityEngine`.

- `MES-01` incident: all WIP lots are held to protect production-state integrity.
- `AMHS-01` incident: WIP is held while material movement is unavailable.
- `MET-01` incident: lots assigned to metrology are held to protect quality release.
- Recovery does not immediately release production.
- Release occurs after the reliability engine finishes post-recovery validation.

This creates the observable lifecycle:

`FAULT → DETECT → HOLD → RECOVER → VALIDATE → RECONCILE → RELEASE`

## Metrics

Prometheus output includes:

- `orbital_factory_wip_lots`
- `orbital_factory_held_lots`
- `orbital_factory_wafers_wip`
- `orbital_factory_completed_lots`

## API

- `GET /api/production`
- `POST /api/production/lots`
- `POST /api/production/advance`

The model is intentionally deterministic so automated tests and demos can reproduce the same route and failure behavior consistently.
