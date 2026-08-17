# Incident Walkthrough: Packet Loss

This scenario demonstrates the full lab loop without pretending the underlying telemetry is real spacecraft data.

## 1. Baseline

The service begins `NOMINAL` with low latency, near-zero packet loss, moderate CPU utilization, and normal event throughput.

## 2. Inject

A controlled `packet_loss` fault pushes simulated uplink loss to 18.4% and reduces throughput.

```bash
curl -X POST http://localhost:3000/api/faults \
  -H "Content-Type: application/json" \
  -d '{"type":"packet_loss"}'
```

The system enters `DEGRADED` immediately.

## 3. Detect and isolate

After the detection window, the engine confirms a threshold breach, changes the state to `INCIDENT`, records the detection event, and records isolation of the fault domain.

`GET /api/health` returns HTTP `503` during the confirmed incident.

## 4. Recover

With automatic recovery armed, a recovery sequence begins. Manual recovery is also available through `POST /api/recover`.

## 5. Validate

The system enters `RECOVERING` while post-recovery health checks execute. It does **not** return to `NOMINAL` until validation finishes.

## 6. Preserve evidence

The event stream preserves the ordered evidence trail:

`FAULT → DETECT → ISOLATE → RECOVERY → VALIDATE → SYSTEM → RCA`

The final RCA event includes the measured recovery duration.

## Why this matters

The useful engineering idea is not the simulated space theme. It is the discipline of proving four things:

1. We can intentionally reproduce a failure.
2. We can detect the failure from observable symptoms.
3. We can recover without assuming the action succeeded.
4. We can preserve enough evidence to improve the system afterward.
