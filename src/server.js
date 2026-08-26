import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReliabilityEngine } from './reliability-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const engine = new ReliabilityEngine();
const port = Number(process.env.PORT || 3000);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function sendJson(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
async function readJson(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (!raw) return {}; try { return JSON.parse(raw); } catch { return {}; } }
async function serveStatic(res, pathname) { const safePath = pathname === '/' ? '/index.html' : pathname; const resolved = path.normalize(path.join(publicDir, safePath)); if (!resolved.startsWith(publicDir)) return false; try { const file = await readFile(resolved); const ext = path.extname(resolved); res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' }); res.end(file); return true; } catch { return false; } }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    const snapshot = engine.getSnapshot();
    const factoryComms = snapshot.industrialCommunications;
    return sendJson(res, snapshot.status === 'INCIDENT' ? 503 : 200, {
      ok: snapshot.status !== 'INCIDENT',
      status: snapshot.status,
      environment: snapshot.environment.id,
      impact: snapshot.operationalImpact.level,
      productionHold: snapshot.production?.metrics.heldLots || 0,
      missionReadiness: snapshot.missionNetwork?.readiness.state || null,
      industrialCommunications: factoryComms ? {
        mqtt: factoryComms.broker.state,
        connectedEndpoints: factoryComms.metrics.connectedEndpoints,
        totalEndpoints: factoryComms.metrics.totalEndpoints,
        validation: factoryComms.validation.state,
        opcUa: {
          state: factoryComms.opcUa.state,
          sessionState: factoryComms.opcUa.sessionState,
          sessions: factoryComms.opcUa.sessions,
          validation: factoryComms.opcUa.validation.state
        }
      } : null,
      updatedAt: snapshot.updatedAt
    });
  }
  if (req.method === 'GET' && pathname === '/api/telemetry') return sendJson(res, 200, engine.getSnapshot());
  if (req.method === 'GET' && pathname === '/api/environments') return sendJson(res, 200, { environments: engine.listEnvironments() });
  if (req.method === 'GET' && pathname === '/api/scenarios') return sendJson(res, 200, { scenarios: engine.getScenarios() });
  if (req.method === 'GET' && pathname === '/api/events') return sendJson(res, 200, { events: engine.events });
  if (req.method === 'GET' && pathname === '/api/production') return sendJson(res, 200, { production: engine.getSnapshot().production });
  if (req.method === 'GET' && pathname === '/api/mission/network') return sendJson(res, 200, { missionNetwork: engine.getSnapshot().missionNetwork });
  if (req.method === 'GET' && pathname === '/api/factory/communications') {
    const snapshot = engine.getSnapshot();
    if (snapshot.environment.id !== 'factory') return sendJson(res, 409, { error: 'Industrial communications are only available in Factory Operations' });
    return sendJson(res, 200, { industrialCommunications: snapshot.industrialCommunications });
  }
  if (req.method === 'GET' && pathname === '/api/metrics') {
    const snapshot = engine.getSnapshot();
    const stateMap = { NOMINAL: 0, DEGRADED: 1, INCIDENT: 2, RECOVERING: 3 };
    const unhealthy = snapshot.systems.filter((system) => system.health !== 'NOMINAL').length;
    const lines = [
      '# HELP orbital_system_state 0=nominal, 1=degraded, 2=incident, 3=recovering', '# TYPE orbital_system_state gauge', `orbital_system_state ${stateMap[snapshot.status] ?? -1}`,
      '# HELP orbital_environment_info Active simulation environment', '# TYPE orbital_environment_info gauge', `orbital_environment_info{environment="${snapshot.environment.id}"} 1`,
      '# HELP orbital_unhealthy_assets Number of assets not in nominal health', '# TYPE orbital_unhealthy_assets gauge', `orbital_unhealthy_assets ${unhealthy}`,
      '# HELP orbital_telemetry_latency_ms Simulated service or control-path latency', '# TYPE orbital_telemetry_latency_ms gauge', `orbital_telemetry_latency_ms ${snapshot.metrics.latencyMs.toFixed(2)}`,
      '# HELP orbital_packet_loss_percent Simulated communications packet loss percentage', '# TYPE orbital_packet_loss_percent gauge', `orbital_packet_loss_percent ${snapshot.metrics.packetLossPct.toFixed(3)}`,
      '# HELP orbital_cpu_percent Simulated compute utilization percentage', '# TYPE orbital_cpu_percent gauge', `orbital_cpu_percent ${snapshot.metrics.cpuPct.toFixed(2)}`,
      '# HELP orbital_throughput_rps Simulated event throughput per second', '# TYPE orbital_throughput_rps gauge', `orbital_throughput_rps ${snapshot.metrics.throughputRps.toFixed(2)}`,
      '# HELP orbital_incidents_total Total controlled incidents injected since process start', '# TYPE orbital_incidents_total counter', `orbital_incidents_total ${snapshot.incidentCounter}`,
      '# HELP orbital_last_mttr_seconds Most recent mean time to recovery sample', '# TYPE orbital_last_mttr_seconds gauge', `orbital_last_mttr_seconds ${snapshot.lastMttrMs ? (snapshot.lastMttrMs / 1000).toFixed(3) : 0}`
    ];
    for (const system of snapshot.systems) lines.push(`orbital_asset_health{environment="${snapshot.environment.id}",asset="${system.id}",state="${system.state}",health="${system.health}"} ${system.health === 'NOMINAL' ? 1 : 0}`);
    if (snapshot.missionNetwork) {
      const network = snapshot.missionNetwork;
      const readinessMap = { 'NO-GO': 0, DEGRADED: 1, READY: 2 };
      lines.push(
        '# HELP orbital_mission_frames_received_total Mission telemetry frames received', '# TYPE orbital_mission_frames_received_total counter', `orbital_mission_frames_received_total ${network.frames.received}`,
        '# HELP orbital_mission_frames_lost_total Mission telemetry frames lost', '# TYPE orbital_mission_frames_lost_total counter', `orbital_mission_frames_lost_total ${network.frames.lost}`,
        '# HELP orbital_mission_telemetry_continuity_percent Latest mission telemetry continuity percentage', '# TYPE orbital_mission_telemetry_continuity_percent gauge', `orbital_mission_telemetry_continuity_percent ${network.frames.lastWindow.continuityPct.toFixed(3)}`,
        '# HELP orbital_mission_failover_interruption_ms Most recent simulated mission route interruption', '# TYPE orbital_mission_failover_interruption_ms gauge', `orbital_mission_failover_interruption_ms ${network.failover.totalInterruptionMs || 0}`,
        '# HELP orbital_mission_readiness_score Mission readiness check score from 0 to 100', '# TYPE orbital_mission_readiness_score gauge', `orbital_mission_readiness_score ${network.readiness.score}`,
        '# HELP orbital_mission_readiness_info Mission readiness state', '# TYPE orbital_mission_readiness_info gauge', `orbital_mission_readiness_info{state="${network.readiness.state}"} ${readinessMap[network.readiness.state] ?? -1}`
      );
    }
    if (snapshot.production && snapshot.industrialCommunications) {
      const comms = snapshot.industrialCommunications;
      const mqttStateMap = { OFFLINE: 0, RECONNECTING: 1, ONLINE: 2 };
      const validationMap = { FAIL: 0, PENDING: 1, RUNNING: 2, PASS: 3 };
      const opcUaStateMap = { SESSION_LOST: 0, RECONNECTING: 1, ONLINE: 2 };
      const opcUaSessionMap = { LOST: 0, NEGOTIATING: 1, ACTIVE: 2 };
      lines.push('# HELP orbital_factory_wip_lots Factory lots not yet completed', '# TYPE orbital_factory_wip_lots gauge', `orbital_factory_wip_lots ${snapshot.production.metrics.wipLots}`,
        '# HELP orbital_factory_held_lots Factory lots held by operational protection', '# TYPE orbital_factory_held_lots gauge', `orbital_factory_held_lots ${snapshot.production.metrics.heldLots}`,
        '# HELP orbital_factory_wafers_wip Wafers currently in WIP', '# TYPE orbital_factory_wafers_wip gauge', `orbital_factory_wafers_wip ${snapshot.production.metrics.wafersInWip}`,
        '# HELP orbital_factory_completed_lots Completed production lots', '# TYPE orbital_factory_completed_lots counter', `orbital_factory_completed_lots ${snapshot.production.metrics.completedLots}`,
        '# HELP orbital_factory_mqtt_state Simulated MQTT broker state', '# TYPE orbital_factory_mqtt_state gauge', `orbital_factory_mqtt_state{state="${comms.broker.state}"} ${mqttStateMap[comms.broker.state] ?? -1}`,
        '# HELP orbital_factory_mqtt_connected_endpoints Connected simulated MQTT equipment endpoints', '# TYPE orbital_factory_mqtt_connected_endpoints gauge', `orbital_factory_mqtt_connected_endpoints ${comms.metrics.connectedEndpoints}`,
        '# HELP orbital_factory_mqtt_messages_published_total Simulated MQTT messages published', '# TYPE orbital_factory_mqtt_messages_published_total counter', `orbital_factory_mqtt_messages_published_total ${comms.metrics.messagesPublished}`,
        '# HELP orbital_factory_mqtt_messages_dropped_total Simulated MQTT messages dropped', '# TYPE orbital_factory_mqtt_messages_dropped_total counter', `orbital_factory_mqtt_messages_dropped_total ${comms.metrics.messagesDropped}`,
        '# HELP orbital_factory_mqtt_reconnects_total Simulated MQTT reconnect cycles', '# TYPE orbital_factory_mqtt_reconnects_total counter', `orbital_factory_mqtt_reconnects_total ${comms.metrics.reconnectCount}`,
        '# HELP orbital_factory_mqtt_validation_state Communications validation state', '# TYPE orbital_factory_mqtt_validation_state gauge', `orbital_factory_mqtt_validation_state{state="${comms.validation.state}"} ${validationMap[comms.validation.state] ?? -1}`,
        '# HELP orbital_factory_opcua_state Simulated OPC-UA adapter state', '# TYPE orbital_factory_opcua_state gauge', `orbital_factory_opcua_state{state="${comms.opcUa.state}"} ${opcUaStateMap[comms.opcUa.state] ?? -1}`,
        '# HELP orbital_factory_opcua_session_state Simulated OPC-UA session state', '# TYPE orbital_factory_opcua_session_state gauge', `orbital_factory_opcua_session_state{state="${comms.opcUa.sessionState}"} ${opcUaSessionMap[comms.opcUa.sessionState] ?? -1}`,
        '# HELP orbital_factory_opcua_sessions Active simulated OPC-UA sessions', '# TYPE orbital_factory_opcua_sessions gauge', `orbital_factory_opcua_sessions ${comms.opcUa.sessions}`,
        '# HELP orbital_factory_opcua_reads_total Successful OPC-UA monitored-node reads', '# TYPE orbital_factory_opcua_reads_total counter', `orbital_factory_opcua_reads_total ${comms.metrics.opcUaReads}`,
        '# HELP orbital_factory_opcua_stale_reads_total Failed or stale OPC-UA reads', '# TYPE orbital_factory_opcua_stale_reads_total counter', `orbital_factory_opcua_stale_reads_total ${comms.metrics.opcUaStaleReads}`,
        '# HELP orbital_factory_opcua_reconnects_total Simulated OPC-UA session reconnects', '# TYPE orbital_factory_opcua_reconnects_total counter', `orbital_factory_opcua_reconnects_total ${comms.metrics.opcUaReconnectCount}`,
        '# HELP orbital_factory_opcua_validation_state OPC-UA validation state', '# TYPE orbital_factory_opcua_validation_state gauge', `orbital_factory_opcua_validation_state{state="${comms.opcUa.validation.state}"} ${validationMap[comms.opcUa.validation.state] ?? -1}`);
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(`${lines.join('\n')}\n`);
  }

  if (req.method === 'POST' && pathname === '/api/environment') { const body = await readJson(req); const result = engine.setEnvironment(body.id); return sendJson(res, result.ok ? 200 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/scenarios/run') { const body = await readJson(req); const result = engine.runScenario(body.id); return sendJson(res, result.ok ? 202 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/systems/advance') { const body = await readJson(req); const result = engine.advanceSystem(body.id); return sendJson(res, result.ok ? 200 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/mission/frames') { const body = await readJson(req); const result = engine.advanceMissionFrames(body.count || 120); return sendJson(res, result.ok ? 200 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/production/lots') { const body = await readJson(req); const result = engine.createLot(body); return sendJson(res, result.ok ? 201 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/production/advance') { const body = await readJson(req); const result = engine.advanceLot(body.id); return sendJson(res, result.ok ? 200 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/factory/communications/publish') {
    const result = engine.publishFactoryCommunications();
    return sendJson(res, result.ok ? 200 : 409, result);
  }
  if (req.method === 'POST' && pathname === '/api/factory/communications/opcua/read') {
    const result = engine.readFactoryOpcUa();
    return sendJson(res, result.ok ? 200 : 409, result);
  }
  if (req.method === 'POST' && pathname === '/api/faults') { const body = await readJson(req); const result = engine.injectFault(body.type, { target: body.target || null }); return sendJson(res, result.ok ? 202 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/recover') { const result = engine.recover('manual'); return sendJson(res, result.ok ? 202 : 409, result); }
  if (req.method === 'POST' && pathname === '/api/auto-recovery') { const body = await readJson(req); return sendJson(res, 200, engine.setAutoRecovery(body.enabled)); }
  if (req.method === 'POST' && pathname === '/api/reset') return sendJson(res, 200, engine.reset());

  if (req.method === 'GET' && await serveStatic(res, pathname)) return;
  sendJson(res, 404, { error: 'Not found' });
});
server.listen(port, '0.0.0.0', () => console.log(`Orbital Reliability Lab listening on http://localhost:${port}`));
