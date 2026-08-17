# Mission Network Model — v0.5

The v0.5 Mission Network Model adds deterministic telemetry routing, continuity measurement, redundancy, network partitions, dependency effects, and mission readiness to Orbital Reliability Lab.

This is an independent, abstract simulation for engineering practice. It does not model or claim access to proprietary systems from SpaceX, Starlink, Tesla, Terafab, or any other company.

## Topology

Nominal mission route:

`GS-A → TEL-GW-01 → NET-CORE-01 → MDB-01`

Redundant resources:

- `GS-A` — primary ground path
- `GS-B` — redundant ground path
- `TEL-GW-01` — primary telemetry gateway
- `TEL-GW-02` — redundant telemetry gateway
- `NET-CORE-01` — abstract mission network fabric
- `TRACK-01` — tracking consumer
- `CMD-01` — command consumer
- `MDB-01` — mission data service

## Telemetry frame accounting

The model starts with a known sequence baseline and advances frames deterministically. It records:

- total frames sent
- total frames received
- total frames lost
- last transmitted sequence
- last received sequence
- sequence gaps
- cumulative continuity percentage
- latest-window sent/received/lost counts
- latest-window continuity percentage

During nominal operation a transmitted window has 100% continuity.

During the simulated `GS-A` degraded window every fifth frame is dropped, creating an 80% continuity sample before failover.

During an interrupted gateway or partitioned network window, the affected sample is fully lost until a usable route exists again.

## Failover evidence

Ground and gateway failovers record:

- failover type
- source route component
- destination route component
- detection time
- simulated route-transition time
- total simulated interruption
- validation state
- route validated before primary restoration

Example ground response:

`GS-A DEGRADED → GS-A FAULT → GS-B PRIMARY → TELEMETRY RESTORED → VALIDATE → PRIMARY RESTORED`

Example gateway response:

`TEL-GW-01 UNAVAILABLE → TEL-GW-01 FAULT → TEL-GW-02 ACTIVE → TELEMETRY RESTORED → VALIDATE → PRIMARY RESTORED`

The route-transition values are simulation constants used to make the validation/evidence path deterministic. They are not measurements from a real-world system.

## Network partition behavior

The `Mission Network Partition` scenario targets `NET-CORE-01`.

At detection:

- `NET-CORE-01` becomes partitioned
- `TRACK-01` becomes blocked
- `CMD-01` becomes blocked
- telemetry windows are lost while the partition remains active
- mission readiness becomes `NO-GO`

Recovery restores the network fabric and dependent service paths, but readiness is not considered fully restored until a post-recovery telemetry validation window passes.

## Mission readiness

Readiness uses six checks:

1. ground path available
2. telemetry gateway available
3. mission network fabric healthy
4. tracking dependency healthy
5. command dependency healthy
6. latest telemetry continuity at least 99%

Check states are `PASS`, `WARN`, or `FAIL`.

Overall mission readiness is:

- `READY` — no failed/warned checks, no pending validation, no active incident
- `DEGRADED` — warning or pending-validation conditions exist
- `NO-GO` — one or more critical checks fail

A readiness score from 0–100 is also produced for dashboard and metric visibility. It is an operator-facing simulation aid, not an aerospace certification score.

## API

### `GET /api/mission/network`

Returns route, network nodes, frame accounting, partition state, failover evidence, validation, readiness, and dependency metadata.

### `POST /api/mission/frames`

Example body:

```json
{ "count": 120 }
```

Advances deterministic mission telemetry frames while preserving the active transport condition.

## Prometheus-style metrics

v0.5 adds:

- `orbital_mission_frames_received_total`
- `orbital_mission_frames_lost_total`
- `orbital_mission_telemetry_continuity_percent`
- `orbital_mission_failover_interruption_ms`
- `orbital_mission_readiness_score`
- `orbital_mission_readiness_info`

## Testing

The Node test suite covers:

- nominal route/readiness
- deterministic frame accounting
- ground failover and primary restoration
- telemetry-gateway failover and primary restoration
- network partition `NO-GO` behavior
- recovery continuity validation

Playwright API and dashboard tests exercise the same behavior through the HTTP and browser surfaces.
