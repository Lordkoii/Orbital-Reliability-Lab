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

- lot / wafer / recipe simulation
- process-route tracking across LITH / ETCH / DEP / MET
- production WIP and completion states
- equipment alarms and maintenance states
- mini-MES event model

## v0.5 — Mission Network Model

- richer primary / secondary telemetry routing
- command and tracking dependency graph
- ground-link failover timing and continuity metrics
- network partition and service dependency scenarios
- mission readiness state

## v0.6 — Industrial Communications

- MQTT broker and equipment telemetry topics
- OPC-UA simulation and adapter
- communications health monitoring
- protocol fault and reconnect scenarios

## v0.7 — Observability Platform

- PostgreSQL event and telemetry history
- expanded Prometheus metrics
- Grafana dashboards
- SLO / availability views
- incident history and trend analysis

## v0.8 — Manufacturing Intelligence

- process drift simulation
- SPC / control-limit detection
- yield and quality metrics
- automated lot hold / release workflow

## v0.9 — Automated Qualification

- factory FAT/SAT-style validation suites
- mission readiness suites
- machine-readable evidence and HTML reports
- scenario matrix in CI

## v1.0 — Unified Operations Lab

A polished, documented platform demonstrating reliability, automation, validation, observability, incident response, factory systems, and mission operations in one coherent portfolio project.
