import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReliabilityEngine } from './reliability-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const engine = new ReliabilityEngine();
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

async function serveStatic(res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.normalize(path.join(publicDir, safePath));
  if (!resolved.startsWith(publicDir)) return false;
  try {
    const file = await readFile(resolved);
    const ext = path.extname(resolved);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(file);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    const snapshot = engine.getSnapshot();
    return sendJson(res, snapshot.status === 'INCIDENT' ? 503 : 200, {
      ok: snapshot.status !== 'INCIDENT',
      status: snapshot.status,
      environment: snapshot.environment.id,
      updatedAt: snapshot.updatedAt
    });
  }
  if (req.method === 'GET' && pathname === '/api/telemetry') return sendJson(res, 200, engine.getSnapshot());
  if (req.method === 'GET' && pathname === '/api/environments') return sendJson(res, 200, { environments: engine.listEnvironments() });
  if (req.method === 'GET' && pathname === '/api/scenarios') return sendJson(res, 200, { scenarios: engine.getScenarios() });
  if (req.method === 'GET' && pathname === '/api/metrics') {
    const snapshot = engine.getSnapshot();
    const stateMap = { NOMINAL: 0, DEGRADED: 1, INCIDENT: 2, RECOVERING: 3 };
    const lines = [
      '# HELP orbital_system_state 0=nominal, 1=degraded, 2=incident, 3=recovering',
      '# TYPE orbital_system_state gauge',
      `orbital_system_state ${stateMap[snapshot.status] ?? -1}`,
      '# HELP orbital_environment_info Active simulation environment',
      '# TYPE orbital_environment_info gauge',
      `orbital_environment_info{environment="${snapshot.environment.id}"} 1`,
      '# HELP orbital_telemetry_latency_ms Simulated service or control-path latency',
      '# TYPE orbital_telemetry_latency_ms gauge',
      `orbital_telemetry_latency_ms ${snapshot.metrics.latencyMs.toFixed(2)}`,
      '# HELP orbital_packet_loss_percent Simulated communications packet loss percentage',
      '# TYPE orbital_packet_loss_percent gauge',
      `orbital_packet_loss_percent ${snapshot.metrics.packetLossPct.toFixed(3)}`,
      '# HELP orbital_cpu_percent Simulated compute utilization percentage',
      '# TYPE orbital_cpu_percent gauge',
      `orbital_cpu_percent ${snapshot.metrics.cpuPct.toFixed(2)}`,
      '# HELP orbital_throughput_rps Simulated event throughput per second',
      '# TYPE orbital_throughput_rps gauge',
      `orbital_throughput_rps ${snapshot.metrics.throughputRps.toFixed(2)}`,
      '# HELP orbital_incidents_total Total controlled incidents injected since process start',
      '# TYPE orbital_incidents_total counter',
      `orbital_incidents_total ${snapshot.incidentCounter}`,
      '# HELP orbital_last_mttr_seconds Most recent mean time to recovery sample',
      '# TYPE orbital_last_mttr_seconds gauge',
      `orbital_last_mttr_seconds ${snapshot.lastMttrMs ? (snapshot.lastMttrMs / 1000).toFixed(3) : 0}`
    ];
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`${lines.join('\n')}\n`);
  }
  if (req.method === 'GET' && pathname === '/api/events') return sendJson(res, 200, { events: engine.events });

  if (req.method === 'POST' && pathname === '/api/environment') {
    const body = await readJson(req);
    const result = engine.setEnvironment(body.id);
    return sendJson(res, result.ok ? 200 : 409, result);
  }
  if (req.method === 'POST' && pathname === '/api/scenarios/run') {
    const body = await readJson(req);
    const result = engine.runScenario(body.id);
    return sendJson(res, result.ok ? 202 : 409, result);
  }
  if (req.method === 'POST' && pathname === '/api/faults') {
    const body = await readJson(req);
    const result = engine.injectFault(body.type, { target: body.target || null });
    return sendJson(res, result.ok ? 202 : 409, result);
  }
  if (req.method === 'POST' && pathname === '/api/recover') {
    const result = engine.recover('manual');
    return sendJson(res, result.ok ? 202 : 409, result);
  }
  if (req.method === 'POST' && pathname === '/api/auto-recovery') {
    const body = await readJson(req);
    return sendJson(res, 200, engine.setAutoRecovery(body.enabled));
  }
  if (req.method === 'POST' && pathname === '/api/reset') {
    return sendJson(res, 200, engine.reset());
  }

  if (req.method === 'GET' && await serveStatic(res, pathname)) return;
  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Orbital Reliability Lab listening on http://localhost:${port}`);
});
