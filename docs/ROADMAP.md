# Orbital Reliability Lab Roadmap

ORL targets engineering concepts shared by high-consequence manufacturing and space/mission operations without claiming affiliation with or reproducing proprietary systems from any company.

## v0.2 — Systems Core

- [x] Shared reliability lifecycle
- [x] Environment registry
- [x] Mission Operations environment
- [x] Factory Operations environment
- [x] Domain-specific asset models
- [x] Scenario library
- [x] Environment/scenario API
- [x] Dual-environment dashboard
- [x] Scenario and switching tests

## v0.3 — Factory Operations

- equipment state machines
- lot / wafer / recipe simulation
- equipment alarms and maintenance states
- production tracking / mini-MES model

## v0.4 — Industrial Communications

- MQTT broker + equipment telemetry topics
- OPC-UA simulation and adapter
- equipment communication health monitoring
- protocol fault scenarios

## v0.5 — Mission Operations

- ground station state models
- primary/secondary telemetry routes
- command and tracking service dependencies
- ground-link failover scenarios

## v0.6 — Observability Platform

- PostgreSQL event and telemetry history
- Prometheus metrics expansion
- Grafana dashboards
- SLO / availability views

## v0.7 — Manufacturing Intelligence

- process drift simulation
- SPC/control-limit detection
- yield and quality metrics
- automated lot hold / release workflow

## v0.8 — Mission Reliability

- readiness checks
- network partitions and failover
- telemetry continuity validation
- degraded-mode mission scenarios

## v0.9 — Automated Qualification

- factory FAT/SAT-style validation suites
- mission readiness suites
- machine-readable evidence and HTML reports
- scenario matrix in CI

## v1.0 — Unified Operations Lab

A polished, documented platform demonstrating reliability, automation, validation, observability, incident response, factory systems, and mission operations in one coherent portfolio project.
