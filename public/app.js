const $ = (id) => document.getElementById(id);
const faultButtons = [...document.querySelectorAll('[data-fault]')];
let latestSnapshot;

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

function render(snapshot) {
  latestSnapshot = snapshot;
  $('statusHero').dataset.state = snapshot.status;
  $('systemStatus').textContent = snapshot.status;
  $('uptime').textContent = fmtTime(snapshot.uptimeSeconds);
  $('incidentCount').textContent = snapshot.incidentCounter;
  $('mttr').textContent = snapshot.lastMttrMs ? `${(snapshot.lastMttrMs / 1000).toFixed(1)}s` : '—';
  $('autoState').textContent = snapshot.autoRecovery ? 'ARMED' : 'MANUAL';
  $('autoRecovery').checked = snapshot.autoRecovery;

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
  $('statusSubtext').textContent = snapshot.activeFault
    ? `${snapshot.activeFault.incidentId} · ${snapshot.activeFault.label}`
    : snapshot.status === 'RECOVERING'
      ? 'Recovery in progress. Running validation checks.'
      : 'All telemetry channels operating within expected thresholds.';
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
    $('statusSubtext').textContent = 'Unable to reach local telemetry service.';
  }
}

faultButtons.forEach((button) => button.addEventListener('click', async () => {
  await fetch('/api/faults', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: button.dataset.fault })
  });
  refresh();
}));

$('recoverButton').addEventListener('click', async () => {
  await fetch('/api/recover', { method: 'POST' });
  refresh();
});
$('resetButton').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' });
  refresh();
});
$('autoRecovery').addEventListener('change', async (event) => {
  await fetch('/api/auto-recovery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: event.target.checked })
  });
  refresh();
});

await refresh();
setInterval(refresh, 650);
