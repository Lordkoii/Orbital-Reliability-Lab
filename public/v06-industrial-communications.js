const byId = (id) => document.getElementById(id);

const style = document.createElement('style');
style.textContent = `
  .industrial-comms-section { margin-top: 14px; }
  .industrial-comms-panel { min-height: 0; }
  .comms-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 16px 0;
  }
  .comms-stat {
    border: 1px solid #273640;
    background: rgba(8, 14, 18, .58);
    padding: 13px 14px;
  }
  .comms-stat span {
    display: block;
    color: #758a99;
    font-size: 10px;
    letter-spacing: .12em;
  }
  .comms-stat strong {
    display: block;
    margin-top: 7px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 20px;
    font-weight: 500;
  }
  .comms-stat strong[data-state="ONLINE"] { color: var(--green); }
  .comms-stat strong[data-state="DEGRADED"],
  .comms-stat strong[data-state="STANDBY"] { color: var(--amber); }
  .comms-stat strong[data-state="OFFLINE"] { color: var(--red); }
  .comms-layout {
    display: grid;
    grid-template-columns: .9fr 1.1fr;
    gap: 12px;
  }
  .protocol-card {
    border: 1px solid #2b3944;
    background: #0c1217;
    padding: 15px;
  }
  .protocol-card + .protocol-card { margin-top: 10px; }
  .protocol-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .protocol-head strong { font-size: 13px; letter-spacing: .04em; }
  .protocol-head span {
    border: 1px solid #315846;
    color: var(--green);
    padding: 5px 7px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    letter-spacing: .08em;
  }
  .protocol-head span[data-state="STANDBY"] {
    border-color: #725c2d;
    color: var(--amber);
  }
  .protocol-card p {
    color: #91a3af;
    font-size: 12px;
    line-height: 1.5;
    margin: 9px 0;
  }
  .protocol-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 12px;
  }
  .protocol-meta span {
    color: #718594;
    font-size: 10px;
  }
  .protocol-meta b {
    display: block;
    color: #c0ccd4;
    margin-top: 3px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 11px;
    font-weight: 500;
  }
  .comms-publish-button { margin-top: 13px; width: 100%; }
  .endpoint-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }
  .endpoint-card {
    border: 1px solid #273640;
    background: rgba(10, 16, 21, .72);
    padding: 12px;
  }
  .endpoint-card[data-connected="false"] { border-color: #74383c; }
  .endpoint-top { display: flex; justify-content: space-between; gap: 10px; }
  .endpoint-top strong { font-size: 12px; }
  .endpoint-top span {
    color: var(--green);
    font-size: 9px;
    font-family: "SFMono-Regular", Consolas, monospace;
  }
  .endpoint-card[data-connected="false"] .endpoint-top span { color: var(--red); }
  .endpoint-topic {
    margin-top: 9px;
    color: #7f94a2;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .endpoint-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
    color: #708594;
    font-size: 9px;
  }
  .endpoint-meta b { color: #aebdc7; font-weight: 500; }
  @media(max-width:900px) {
    .comms-summary { grid-template-columns: 1fr 1fr; }
    .comms-layout { grid-template-columns: 1fr; }
  }
  @media(max-width:600px) {
    .comms-summary, .endpoint-grid { grid-template-columns: 1fr; }
  }
`;
document.head.append(style);

const section = document.createElement('section');
section.id = 'industrialCommunicationsSection';
section.className = 'industrial-comms-section';
section.hidden = true;
section.innerHTML = `
  <article class="panel industrial-comms-panel">
    <div class="panel-title">
      <div>
        <p class="eyebrow">FACTORY INDUSTRIAL COMMUNICATIONS / v0.6</p>
        <h3>Equipment Messaging & Protocol Health</h3>
      </div>
      <span class="live"><i></i> SIMULATED</span>
    </div>
    <p class="panel-copy">Factory assets publish deterministic state and health evidence through an ORL MQTT topology. OPC-UA adapter state is reserved for the next communications increment.</p>
    <div class="comms-summary">
      <div class="comms-stat"><span>MQTT BROKER</span><strong id="mqttBrokerState">—</strong></div>
      <div class="comms-stat"><span>CONNECTED ENDPOINTS</span><strong id="mqttConnected">—</strong></div>
      <div class="comms-stat"><span>MESSAGES PUBLISHED</span><strong id="mqttPublished">0</strong></div>
      <div class="comms-stat"><span>MESSAGES DROPPED</span><strong id="mqttDropped">0</strong></div>
    </div>
    <div class="comms-layout">
      <div>
        <div class="protocol-card">
          <div class="protocol-head"><strong id="mqttBrokerId">ORL-MQTT-01</strong><span id="mqttBrokerBadge">ONLINE</span></div>
          <p>In-memory MQTT simulation for factory equipment telemetry, state, and health topics.</p>
          <div class="protocol-meta">
            <span>IMPLEMENTATION<b id="mqttImplementation">—</b></span>
            <span>LAST MESSAGE<b id="mqttLastMessage">—</b></span>
          </div>
          <button class="secondary comms-publish-button" id="publishFactorySnapshotButton">Publish Equipment Snapshot</button>
        </div>
        <div class="protocol-card">
          <div class="protocol-head"><strong id="opcUaId">ORL-OPCUA-01</strong><span id="opcUaState">STANDBY</span></div>
          <p id="opcUaNote">Reserved for the next v0.6 increment.</p>
          <div class="protocol-meta">
            <span>IMPLEMENTATION<b id="opcUaImplementation">—</b></span>
            <span>SESSIONS<b id="opcUaSessions">0</b></span>
          </div>
        </div>
      </div>
      <div class="endpoint-grid" id="industrialEndpointGrid"></div>
    </div>
  </article>
`;

const production = byId('productionSection');
if (production?.parentElement) production.parentElement.insertBefore(section, production);
else document.querySelector('main')?.append(section);

function timeLabel(value) {
  if (!value) return 'NO TRAFFIC';
  return new Date(value).toLocaleTimeString([], { hour12: false });
}

function render(data) {
  const model = data.industrialCommunications;
  if (!model) return;
  const broker = model.broker;
  const opcUa = model.opcUa;
  byId('mqttBrokerState').textContent = broker.state;
  byId('mqttBrokerState').dataset.state = broker.state;
  byId('mqttConnected').textContent = `${model.metrics.connectedEndpoints}/${model.metrics.totalEndpoints}`;
  byId('mqttPublished').textContent = model.metrics.messagesPublished.toLocaleString();
  byId('mqttDropped').textContent = model.metrics.messagesDropped.toLocaleString();
  byId('mqttBrokerId').textContent = broker.id;
  byId('mqttBrokerBadge').textContent = broker.state;
  byId('mqttBrokerBadge').dataset.state = broker.state;
  byId('mqttImplementation').textContent = broker.implementation.replaceAll('_', ' ');
  byId('mqttLastMessage').textContent = timeLabel(broker.lastMessageAt);
  byId('opcUaId').textContent = opcUa.id;
  byId('opcUaState').textContent = opcUa.state;
  byId('opcUaState').dataset.state = opcUa.state;
  byId('opcUaImplementation').textContent = opcUa.implementation.replaceAll('_', ' ');
  byId('opcUaSessions').textContent = String(opcUa.sessions);
  byId('opcUaNote').textContent = opcUa.note;
  byId('industrialEndpointGrid').innerHTML = model.endpoints.map((endpoint) => `
    <article class="endpoint-card" data-endpoint-id="${endpoint.assetId}" data-connected="${endpoint.connected}">
      <div class="endpoint-top"><strong>${endpoint.assetId}</strong><span>${endpoint.connected ? 'CONNECTED' : 'DISCONNECTED'}</span></div>
      <div class="endpoint-topic">${endpoint.topics.telemetry}</div>
      <div class="endpoint-meta"><span>QoS <b>${endpoint.qos}</b></span><span>SEQ <b>${endpoint.lastSequence || '—'}</b></span><span>MSG <b>${endpoint.messagesPublished}</b></span></div>
    </article>
  `).join('');
}

async function refreshIndustrialCommunications() {
  try {
    const telemetry = await fetch('/api/telemetry', { cache: 'no-store' }).then((response) => response.json());
    const factory = telemetry.environment?.id === 'factory';
    section.hidden = !factory;
    if (!factory) return;
    const response = await fetch('/api/factory/communications', { cache: 'no-store' });
    if (!response.ok) return;
    render(await response.json());
  } catch {
    // app.js owns primary link-loss handling.
  }
}

byId('publishFactorySnapshotButton')?.addEventListener('click', async () => {
  const button = byId('publishFactorySnapshotButton');
  button.disabled = true;
  try {
    await fetch('/api/factory/communications/publish', { method: 'POST' });
    await refreshIndustrialCommunications();
  } finally {
    button.disabled = false;
  }
});

await refreshIndustrialCommunications();
setInterval(refreshIndustrialCommunications, 700);
