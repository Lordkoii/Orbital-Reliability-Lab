await import('/app.js');
await import('/v06-industrial-communications.js');

const $ = (id) => document.getElementById(id);
const contractNodes = [...document.querySelectorAll('.contract-flow .flow-node')];

const finalPolishStyle = document.createElement('style');
finalPolishStyle.textContent = `
  .fault-grid button:disabled { opacity: .58 !important; }
  .event time, .event b { font-size: 12px; }
  .contract-flow .flow-node small { font-size: 11px; }
  #affectedSystems .system-chip[data-role="FAILOVER"] {
    border-color: #725c2d;
    background: rgba(64, 49, 18, .28);
    color: var(--amber);
  }
`;
document.head.append(finalPolishStyle);

let latestSnapshot = null;
let trackedIncidentId = null;
let missionIncidentLow = null;
let applyScheduled = false;

function setText(id, value) {
  const el = $(id);
  if (el && el.textContent !== value) el.textContent = value;
}

function effectiveImpact(snapshot) {
  const impact = snapshot.operationalImpact;
  const failover = snapshot.missionNetwork?.failover;
  if (
    snapshot.environment.id === 'mission'
    && impact.level === 'CRITICAL'
    && failover?.state === 'ACTIVE'
    && ['GROUND', 'GATEWAY'].includes(failover.type)
  ) {
    const noun = failover.type === 'GROUND' ? 'Ground-link' : 'Telemetry-gateway';
    return {
      ...impact,
      level: 'DEGRADED',
      headline: `${noun} failover active`,
      detail: `${failover.to} is carrying mission telemetry. Service continuity is restored on the redundant path; post-failover validation remains pending.`
    };
  }
  return impact;
}

function presentationReadiness(network) {
  const checks = network.readiness.checks.map((check) => ({ ...check }));
  if (network.validation.state === 'PENDING' && !checks.some((check) => check.id === 'post-failover-validation')) {
    checks.push({
      id: 'post-failover-validation',
      label: 'Post-failover validation',
      status: 'WARN',
      detail: 'Continuity restored; recovery validation still required'
    });
  }
  const score = Math.round((checks.reduce((sum, check) => sum + (check.status === 'PASS' ? 1 : check.status === 'WARN' ? 0.5 : 0), 0) / checks.length) * 100);
  return { state: network.readiness.state, score, checks };
}

function updateIncidentLow(snapshot, frames) {
  const incidentId = snapshot.activeFault?.incidentId || null;
  if (incidentId && incidentId !== trackedIncidentId) {
    trackedIncidentId = incidentId;
    missionIncidentLow = null;
  }
  if (incidentId) {
    missionIncidentLow = missionIncidentLow == null
      ? frames.lastWindow.continuityPct
      : Math.min(missionIncidentLow, frames.lastWindow.continuityPct);
  } else if (!snapshot.lastMttrMs) {
    trackedIncidentId = null;
    missionIncidentLow = null;
  }
  setText('missionIncidentLow', missionIncidentLow == null ? '—' : `${missionIncidentLow.toFixed(2)}%`);
}

function routeNode(network, id) {
  const node = network.nodes.find((item) => item.id === id);
  const health = node?.health || 'NOMINAL';
  const state = node?.state || 'READY';
  return `<span class="path-node route-node" data-health="${health}" data-route-state="${state}"><span>${id}</span><small>${state}</small></span>`;
}

function renderRoute(snapshot) {
  const network = snapshot.missionNetwork;
  const route = network.route.path.map((id, index) => `${index ? '<span class="path-arrow route-arrow">→</span>' : ''}${routeNode(network, id)}`).join('');
  const routeEl = $('missionRoute');
  if (routeEl && routeEl.innerHTML !== route) routeEl.innerHTML = route;

  const failover = network.failover;
  const switchEl = $('routeSwitch');
  if (!switchEl) return;

  let html = '';
  let state = '';
  if (failover.from && failover.to && ['ACTIVE', 'VALIDATED'].includes(failover.state)) {
    state = failover.state;
    html = `<span class="switch-node switch-from">${failover.from}<small>${failover.state === 'VALIDATED' ? 'RESTORED' : 'FAULT'}</small></span><span class="switch-arrow">→</span><span class="switch-node switch-to">${failover.to}<small>${failover.state === 'VALIDATED' ? 'VALIDATED ROUTE' : 'FAILOVER ACTIVE'}</small></span>`;
  } else if (failover.type === 'NETWORK_PARTITION') {
    state = 'BLOCKED';
    html = `<span class="switch-node switch-from">${failover.from || 'NETWORK'}<small>PARTITIONED</small></span><span class="switch-arrow">×</span><span class="switch-node switch-blocked">NO ALTERNATE ROUTE<small>RECOVERY REQUIRED</small></span>`;
  }

  switchEl.hidden = !html;
  if (html && switchEl.innerHTML !== html) switchEl.innerHTML = html;
  if (state) switchEl.dataset.state = state;
  else delete switchEl.dataset.state;
}

function renderReadiness(snapshot) {
  const network = snapshot.missionNetwork;
  const view = presentationReadiness(network);
  const badge = $('missionReadiness');
  if (badge) {
    const label = `MISSION ${view.state}`;
    if (badge.textContent !== label) badge.textContent = label;
    badge.dataset.state = view.state;
  }
  setText('readinessScore', String(view.score));

  const html = view.checks.map((check) => `<div class="readiness-check" data-check-id="${check.id}" data-status="${check.status}"><b>${check.status} · ${check.label}</b><span>${check.detail}</span></div>`).join('');
  const checks = $('readinessChecks');
  if (checks && checks.innerHTML !== html) checks.innerHTML = html;
}

function renderImpact(snapshot) {
  const impact = effectiveImpact(snapshot);
  setText('impactLevel', impact.level);
  setText('impactBadge', impact.level);
  setText('impactHeadline', impact.headline);
  setText('impactDetail', impact.detail);
  const badge = $('impactBadge');
  if (badge) badge.dataset.level = impact.level;
}

function renderAffectedRoles(snapshot) {
  const chips = [...document.querySelectorAll('#affectedSystems .system-chip')];
  const failoverTo = snapshot.missionNetwork?.failover?.state === 'ACTIVE'
    ? snapshot.missionNetwork.failover.to
    : null;
  chips.forEach((chip) => {
    if (failoverTo && chip.textContent.trim() === failoverTo) chip.dataset.role = 'FAILOVER';
    else delete chip.dataset.role;
  });
}

function renderRecoveryLabel(snapshot) {
  const mttr = $('mttr');
  const label = mttr?.parentElement?.querySelector('span');
  if (!label) return;
  const desired = snapshot.activeFault ? 'PREVIOUS RECOVERY' : 'LAST RECOVERY';
  if (label.textContent !== desired) label.textContent = desired;
}

function renderFailoverLabel(snapshot) {
  const label = $('failoverEvidenceLabel');
  if (!label || !snapshot.missionNetwork) return;
  const desired = snapshot.missionNetwork.failover.state === 'IDLE' ? 'FAILOVER EVIDENCE' : 'LAST FAILOVER / EVIDENCE';
  if (label.textContent !== desired) label.textContent = desired;
}

function renderContract(snapshot) {
  let completedThrough = 0;
  let activeStep = null;

  if (snapshot.status === 'DEGRADED' && snapshot.activeFault) {
    completedThrough = 1;
    activeStep = 2;
  } else if (snapshot.status === 'INCIDENT' && snapshot.activeFault) {
    completedThrough = 4;
    activeStep = 5;
  } else if (snapshot.status === 'RECOVERING') {
    completedThrough = 5;
    activeStep = 6;
  } else if (snapshot.status === 'NOMINAL' && snapshot.lastMttrMs) {
    completedThrough = 7;
  }

  contractNodes.forEach((node, index) => {
    const step = index + 1;
    const state = step <= completedThrough ? 'COMPLETE' : step === activeStep ? 'ACTIVE' : 'PENDING';
    if (node.dataset.stageState !== state) node.dataset.stageState = state;
  });
}

function applyPresentation(snapshot) {
  if (!snapshot) return;
  latestSnapshot = snapshot;
  renderContract(snapshot);
  renderRecoveryLabel(snapshot);

  if (snapshot.environment.id !== 'mission' || !snapshot.missionNetwork) return;

  updateIncidentLow(snapshot, snapshot.missionNetwork.frames);
  renderReadiness(snapshot);
  renderRoute(snapshot);
  renderImpact(snapshot);
  renderAffectedRoles(snapshot);
  renderFailoverLabel(snapshot);
}

function scheduleApply() {
  if (applyScheduled) return;
  applyScheduled = true;
  requestAnimationFrame(() => {
    applyScheduled = false;
    applyPresentation(latestSnapshot);
  });
}

const observed = [
  $('missionReadiness'),
  $('missionRoute'),
  $('readinessChecks'),
  $('impactLevel'),
  $('impactHeadline'),
  $('impactDetail'),
  $('affectedSystems'),
  $('failoverState')
].filter(Boolean);

const observer = new MutationObserver(scheduleApply);
observed.forEach((el) => observer.observe(el, { childList: true, characterData: true, subtree: true }));

async function refreshPresentation() {
  try {
    const snapshot = await fetch('/api/telemetry', { cache: 'no-store' }).then((response) => response.json());
    applyPresentation(snapshot);
  } catch {
    // app.js owns the primary link-loss presentation.
  }
}

await refreshPresentation();
setInterval(refreshPresentation, 500);
