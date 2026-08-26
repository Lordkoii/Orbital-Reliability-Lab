# Orbital Reliability Lab Roadmap

ORL targets engineering concepts shared by high-consequence manufacturing and space/mission operations without claiming affiliation with or reproducing proprietary systems from any company.

## v0.2 — Systems Core

- [x] Shared reliability lifecycle
- [x] Environment registry
- [x] Mission Operations environment
- [x] Factory Operations environment
- [x] Scenario library and environment API
- [x] Dual-environment dashboard

## v0.3 — Operational State Models

- [x] Mission primary / standby ground paths
- [x] Dependency-aware mission failures
- [x] Ground-station failover state transitions
- [x] Factory equipment lifecycle state machine
- [x] Factory HOLD / STARVED / quality-impact behavior
- [x] Operational impact model and affected-system tracking
- [x] Per-asset Prometheus health metrics
- [x] Lifecycle controls and dependency-flow dashboard

## v0.4 — Factory Production Model

- [x] lot / wafer / recipe simulation
- [x] process-route tracking across LITH / ETCH / DEP / MET
- [x] production WIP and completion states
- [x] per-lot history and assigned-tool tracking
- [x] mini-MES API and dashboard model
- [x] incident-aware lot HOLD behavior
- [x] post-recovery reconciliation and RELEASE
- [x] WIP / held / completed Prometheus metrics

## v0.5 — Mission Network Model

- [x] richer primary / secondary telemetry routing
- [x] redundant telemetry gateways
- [x] telemetry frame / sequence accounting
- [x] continuity percentage and frame-loss evidence
- [x] command and tracking dependency graph
- [x] ground-link and gateway failover timing
- [x] network partition and service dependency scenarios
- [x] mission readiness state and checks
- [x] post-recovery continuity validation
- [x] mission network API, metrics, and dashboard evidence

## v0.6 — Industrial Communications

- [x] simulated MQTT broker and equipment telemetry topics
- [x] simulated OPC-UA adapter and metrology session
- [x] communications health monitoring and protocol evidence
- [x] MQTT broker outage / reconnect scenario
- [x] OPC-UA session-loss / reconnect scenario
- [x] production and quality protection during communications incidents
- [x] post-reconnect publish/readback validation
- [x] MQTT and OPC-UA API, health, metrics, and dashboard evidence

## v0.7 — Observability Platform

- [ ] PostgreSQL event and telemetry history
- [ ] expanded Prometheus metrics
- [ ] Grafana dashboards
- [ ] SLO / availability views
- [ ] incident history and trend analysis

## v0.8 — Manufacturing Intelligence

- [ ] process drift simulation
- [ ] SPC / control-limit detection
- [ ] yield and quality metrics
- [ ] richer automated lot hold / release workflow

## v0.9 — Automated Qualification

- [ ] factory FAT/SAT-style validation suites
- [ ] mission readiness suites
- [ ] machine-readable evidence and HTML reports
- [ ] scenario matrix in CI

## v1.0 — Unified Operations Lab

A polished, documented platform demonstrating reliability, automation, validation, observability, incident response, factory systems, production execution, mission operations, and network continuity in one coherent portfolio project.
