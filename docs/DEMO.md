# ORL v0.6 Presentation Runbook

This runbook is the stable presentation path for Orbital Reliability Lab v0.6.0.

Before presenting:

```bash
npm install
npx playwright install chromium
npm test
npm run test:e2e
```

Start the lab:

```bash
npm start
```

Open `http://localhost:3000` at 100% browser zoom and use **Reset Environment** before each demonstration.

## Demo 1 — Mission ground-link failover

Target story:

`PRIMARY LINK FAILURE → DETECT → FAILOVER → TELEMETRY RESTORED → VALIDATE → MISSION READY`

Procedure:

1. Select **Mission Operations** and reset.
2. Turn **Automatic recovery** off.
3. Confirm `NOMINAL`, `MISSION READY`, `GS-A` primary, and 100% continuity.
4. Run **Ground Link Degradation**.
5. Pause after detection and show:
   - incident/degraded state
   - `GS-A → GS-B` failover
   - continuity incident low
   - failover interruption timing
   - readiness below 100 with post-failover validation pending
6. Click **Manual Recover**.
7. Show the completed reliability contract and Event Stream evidence.
8. Return to Mission Network and confirm:
   - validation PASS
   - readiness 100/100
   - `MISSION READY`
   - final `NOMINAL` state

## Demo 2 — MQTT broker outage

Target story:

`BROKER LOSS → ENDPOINT DISCONNECT → DROPPED TELEMETRY → WIP HOLD → RECONNECT → REPUBLISH → VALIDATION PASS`

Procedure:

1. Select **Factory Operations** and reset.
2. Start `LOT-DEMO-001` so it is `RUNNING`.
3. Click **Publish Equipment Snapshot** for baseline traffic.
4. Turn **Automatic recovery** off.
5. Run **MQTT Broker Outage**.
6. Pause after detection and show:
   - broker `OFFLINE`
   - `0/6` connected endpoints
   - all six endpoints `DISCONNECTED`
   - dropped-message evidence
   - active lot on `HOLD`
   - communications validation `PENDING`
7. Click **Manual Recover**.
8. Pause on `RECONNECTING` if presenting live.
9. Confirm final state:
   - broker `ONLINE`
   - `6/6` endpoints connected
   - validation `PASS`
   - equipment telemetry republished
   - lot released back to its previous state
   - dropped-message history retained

## Demo 3 — OPC-UA session loss

Target story:

`GOOD READ → SESSION LOSS → STALE DATA → QUALITY HOLD → SESSION RECONNECT → NODE READBACK → VALIDATION PASS`

Procedure:

1. Select **Factory Operations** and reset.
2. Start `LOT-DEMO-001` so it is `RUNNING`.
3. Click **Read Metrology Node** and confirm `Good` baseline evidence.
4. Turn **Automatic recovery** off.
5. Run **OPC-UA Session Loss**.
6. Pause after detection and show:
   - adapter `SESSION_LOST`
   - session `LOST`
   - zero active sessions
   - stale-read count
   - `BadSessionClosed`
   - validation `PENDING`
   - protected quality-sensitive WIP
7. Click **Manual Recover**.
8. Pause on `RECONNECTING / NEGOTIATING` if presenting live.
9. Confirm final state:
   - adapter `ONLINE`
   - session `ACTIVE`
   - one active session
   - last status `Good`
   - validation `PASS`
   - stale-read history retained

## Presentation guidance

The strongest story is not that a failure disappeared. The important sequence is that ORL **detects impact, protects dependent work, performs an explicit recovery action, validates the restored path, and retains evidence of what happened**.

The protocol implementations are intentionally deterministic simulations. Do not describe them as production MQTT, PLC, or OPC-UA integrations.
