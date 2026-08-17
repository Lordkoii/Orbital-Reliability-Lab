const $ = (id) => document.getElementById(id);
const faultButtons = [...document.querySelectorAll('[data-fault]')];
const environmentButtons = [...document.querySelectorAll('[data-environment]')];

const fmtTime = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `T+ ${h}:${m}:${s}`;
};
const pct = (v, max) => `${Math.min(100, Math.max(3, (v / max) * 100))}%`;

function setMeter(el, width, danger) {
  el.style.width = width;
  el.style.background = danger ? 'var(--red)' : 'var(--cyan)';
}

function renderSystems(systems) {
  $('systemsGrid').innerHTML = systems.map((system) => {
    const severity = system.state === 'NOMINAL' ? 'success' : system.state === 'RECOVERING' ? 'warning' : 'critical';
    return `<div class="event ${severity}"><time>${system.id}</time><b>${system.type.toUpperCase()}</b><p>${system.name} · ${system.state}</p></div>`;
  }).join('');
}

function renderScenarios(scenarios, activeFault) {
  $('scenarioList').innerHTML = scenarios.map((scenario, index) => `
    <button data-scenario="${scenario.id}" ${activeFault ? 'disabled' : ''}>
      <span>${String(index + 1).padStart(2, '0')}</span><b>${scenario.name}</b><small>${scenario.target} · ${scenario.summary}</small>
    </button>`).join('');

  document.querySelectorAll('[data-scenario]').forEach((button) => button.addEventListener('click', async () => {
    await fetch('/api/scenarios/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: button.dataset.scenario })
    });
    refresh();
  }));
}

function render(snapshot) {
  $('statusHero').dataset.state = snapshot.status;
  $('systemStatus').textContent = snapshot.status;
  $('uptime').textContent = fmtTime(snapshot.uptimeSeconds);
  $('incidentCount').textContent = snapshot.incidentCounter;
  $('mttr').textContent = snapshot.lastMttrMs ? `${(snapshot.lastMttrMs / 1000).toFixed(1)}s` : '—';
  $('autoRecovery').checked = snapshot.autoRecovery;

  const environment = snapshot.environment;
  $('environmentCode').textContent = `${environment.code} / SYSTEM STATE`;
  $('environmentName').textContent = environment.code;
  $('environmentDescription').textContent = environment.description;
  $('systemsTitle').textContent = `${environment.name} Systems`;
  $('scenarioDescription').textContent = `${environment.objective} Run a controlled scenario to validate the shared response path.`;
  $('latencyContext').textContent = environment.metricLabels.latency[1];
  $('packetContext').textContent = environment.metricLabels.packetLoss[1];
  $('cpuContext').textContent = environment.metricLabels.compute[1];
  $('throughputContext').textContent = environment.metricLabels.throughput[1];

  renderSystems(snapshot.systems);
  renderScenarios(snapshot.scenarios, snapshot.activeFault);

  const m = snapshot.metrics;
  $('latency').textContent = Math.round(m.latencyMs).toLocaleString();
  $('packetLoss').textContent = m.packetLossPct.toFixed(1);
  $('cpu').textContent = m.cpuPct.toFixed(0);
  $('throughput').textContent = Math.round(m.throughputRps).toLocaleString();
  setMeter($('latencyBar'), pct(m.latencyMs, 1000), m.latencyMs > 100);
  setMeter($('packetBar'), pct(m.packetLossPct, 20), m.packetLossPct > 1);
  setMeter($('cpuBar'), pct(m.cpuPct, 100), m.cpuPct > 85);
  setMeter($('throughputBar'), pct(m.throughputRps, 1450), m.throughputRps < 900);

  const active = Boolean(snapshot.activeFault);
  faultButtons.forEach((button) => button.disabled = active);
  environmentButtons.forEach((button) => button.disabled = active);
  $('statusSubtext').textContent = snapshot.activeFault
    ? `${snapshot.activeFault.incidentId} · ${snapshot.activeFault.label}${snapshot.activeFault.target ? ` · ${snapshot.activeFault.target}` : ''}`
    : snapshot.status === 'RECOVERING'
      ? 'Recovery in progress. Running post-recovery validation.'
      : `${environment.name} nominal. ${environment.objective}`;
}

function renderEvents(events) {
  $('eventLog').innerHTML = events.map((e) => {
    const time = new Date(e.at).toLocaleTimeString([], { hour12: false });
    return `<div class="event ${e.severity}"><time>${time}</time><b>${e.source}</b><p>${e.message}</p></div>`;
  }).join('');
}

async function refresh() {
  try {
    const [telemetry, events] = await Promise.all([
      fetch('/api/telemetry').then(r => r.json()),
      fetch('/api/events').then(r => r.json())
    ]);
    render(telemetry);
    renderEvents(events.events);
  } catch {
    $('systemStatus').textContent = 'LINK LOST';
    $('statusSubtext').textContent = 'Unable to reach local systems core.';
  }
}

environmentButtons.forEach((button) => button.addEventListener('click', async () => {
  await fetch('/api/environment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: button.dataset.environment })
  });
  refresh();
}));

faultButtons.forEach((button) => button.addEventListener('click', async () => {
  await fetch('/api/faults', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: button.dataset.fault })
  });
  refresh();
}));

$('recoverButton').addEventListener('click', async () => { await fetch('/api/recover', { method: 'POST' }); refresh(); });
$('resetButton').addEventListener('click', async () => { await fetch('/api/reset', { method: 'POST' }); refresh(); });
$('autoRecovery').addEventListener('change', async (event) => {
  await fetch('/api/auto-recovery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: event.target.checked })
  });
  refresh();
});

await refresh();
setInterval(refresh, 650);
