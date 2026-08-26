# Industrial Communications — v0.6

v0.6 adds deterministic industrial-communications behavior to Factory Operations. The goal is reliability testing and operator evidence, not protocol-complete emulation.

## MQTT equipment messaging

`ORL-MQTT-01` is an in-memory simulated broker for six modeled factory assets:

- `LITH-01`
- `ETCH-01`
- `DEP-01`
- `MET-01`
- `AMHS-01`
- `MES-01`

Each endpoint exposes modeled state, telemetry, and health topics such as:

`factory/equipment/LITH-01/telemetry`

The communications model records:

- broker state
- connected endpoint count
- QoS
- global and per-endpoint sequence evidence
- successful publish count
- dropped message count
- last message timestamp
- reconnect count
- post-reconnect validation

### MQTT Broker Outage

Expected lifecycle:

`ONLINE → OFFLINE → RECONNECTING → ONLINE`

Expected reliability behavior:

1. inject broker outage
2. all six endpoints disconnect
3. attempted equipment publishes are recorded as dropped
4. active WIP is protected with a production HOLD after detection
5. recovery starts the broker reconnect state
6. all endpoint sessions reconnect
7. equipment telemetry is republished
8. communications validation must PASS
9. held production is reconciled and released
10. incident evidence remains visible after recovery

## OPC-UA metrology adapter

`ORL-OPCUA-01` is a simulated OPC-UA adapter representing a session that monitors modeled metrology state.

Modeled endpoint:

`opc.tcp://orl-factory:4840`

Monitored node:

`ns=2;s=Equipment/MET-01/State`

The adapter records:

- adapter state
- session state
- active session count
- Good reads
- stale reads
- reconnect count
- last read status
- validation state and detail

### OPC-UA Session Loss

Expected lifecycle:

`ONLINE / ACTIVE → SESSION_LOST / LOST → RECONNECTING / NEGOTIATING → ONLINE / ACTIVE`

Expected reliability behavior:

1. establish a baseline `Good` node read
2. inject session loss
3. active session count drops to zero
4. an attempted read records `BadSessionClosed`
5. quality-sensitive WIP is protected after detection
6. recovery negotiates a new session
7. `MET-01` state is read back with `Good`
8. protocol validation must PASS
9. held production is reconciled and released
10. stale-read evidence remains visible after recovery

## Operator evidence

The Factory Industrial Communications panel intentionally keeps historical incident evidence after recovery. A healthy current state therefore does not erase dropped MQTT messages or stale OPC-UA reads.

This supports the same ORL response contract used elsewhere:

`INJECT → DETECT → DIAGNOSE → ISOLATE → RECOVER → VALIDATE → EVIDENCE`

## Scope

Both protocol paths are deterministic in-memory simulations. ORL does not claim a real MQTT broker, OPC-UA server, PLC, industrial controller, or production factory integration.
