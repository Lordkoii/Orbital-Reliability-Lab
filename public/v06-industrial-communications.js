const byId = (id) => document.getElementById(id);

const style = document.createElement('style');
style.textContent = `
  .industrial-comms-section { margin-top: 14px; }
  .industrial-comms-panel { min-height: 0; }
  .comms-mode-badge {
    border: 1px solid #3a4650;
    color: #95a3ad;
    padding: 7px 10px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    letter-spacing: .12em;
  }
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
  .comms-stat strong[data-state="RECONNECTING"],
  .comms-stat strong[data-state="STANDBY"] { color: var(--amber); }
  .comms-stat strong[data-state="OFFLINE"],
  .comms-stat strong[data-state="SESSION_LOST"] { color: var(--red); }
  .comms-stat strong[data-alert="true"] { color: var(--red); }
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
  .protocol-card[data-state="OFFLINE"],
  .protocol-card[data-state="SESSION_LOST"] { border-color: #74383c; background: rgba(67, 20, 24, .18); }
  .protocol-card[data-state="RECONNECTING"] { border-color: #725c2d; background: rgba(64, 49, 18, .16); }
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
  .protocol-head span[data-state="STANDBY"],
  .protocol-head span[data-state="RECONNECTING"],
  .protocol-head span[data-state="RUNNING"],
  .protocol-head span[data-state="PENDING"] {
    border-color: #725c2d;
    color: var(--amber);
  }
  .protocol-head span[data-state="OFFLINE"],
  .protocol-head span[data-state="SESSION_LOST"],
  .protocol-head span[data-state="FAIL"] {
    border-color: #74383c;
    color: var(--red);
  }
  .protocol-card p {
    color: #91a3af;
    font-size: 12px;
    line-height: 1.5;
    margin: 9px 0;
  }
  .protocol-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
  .protocol-meta b[data-state="PASS"], .protocol-meta b[data-state="ACTIVE"] { color: var(--green); }
  .protocol-meta b[data-state="RUNNING"], .protocol-meta b[data-state="PENDING"], .protocol-meta b[data-state="NEGOTIATING"] { color: var(--amber); }
  .protocol-meta b[data-state="FAIL"], .protocol-meta b[data-state="LOST"] { color: var(--red); }
  .comms-validation-detail {
    margin-top: 9px !important;
    padding-top: 9px;
    border-top: 1px solid #24313a;
    color: #8194a1 !important;
    font-size: 11px !important;
  }
  .opcua-paths {
    display: grid;
    gap: 5px;
    margin: 10px 0 2px;
    padding: 8px 9px;
    border: 1px solid #24313a;
    background: rgba(7, 12, 16, .45);
  }
  .opcua-paths span { color: #718594; font-size: 9px; }
  .opcua-paths code { display: block; margin-top: 2px; color: #9aabb6; font-size: 9px; overflow-wrap: anywhere; }
  .comms-publish-button, .opcua-read-button { margin-top: 13px; width: 100%; }
  .endpoint-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }
  .endpoint-card {
    border: 1px solid #273640;
    background: rgba(10, 16, 21, .72);
    padding: 12px;
    transition: border-color .2s ease, background .2s ease;
  }
  .endpoint-card[data-connected="false"] { border-color: #74383c; background: rgba(67, 20, 24, .16); }
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
  .endpoint-meta b[data-alert="true"] { color: var(--red); }
  @media(max-width:900px) {
    .comms-summary { grid-template-columns: 1fr 1fr; }
    .comms-layout { grid-template-columns: 1fr; }
    .protocol-meta { grid-template-columns: 1fr 1fr; }
  }
  @media(max-width:600px) {
    .comms-summary, .endpoint-grid, .protocol-meta { grid-template-columns: 1fr; }
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
      <span class="comms-mode-badge">SIMULATION MODE</span>
    </div>
    <p class="panel-copy">Factory assets expose deterministic communications evidence through simulated MQTT messaging and an OPC-UA metrology adapter. Protocol faults protect production until reconnect and readback validation pass.</p>
    <div class="comms-summary">
      <div class="comms-stat"><span>MQTT BROKER</span><strong id="mqttBrokerState">—</strong></div>
      <div class="comms-stat"><span>CONNECTED ENDPOINTS</span><strong id="mqttConnected">—</strong></div>
      <div class="comms-stat"><span>MESSAGES PUBLISHED</span><strong id="mqttPublished">0</strong></div>
      <div class="comms-stat"><span>MESSAGES DROPPED</span><strong id="mqttDropped">0</strong></div>
    </div>
    <div class="comms-layout">
      <div>
        <div class="protocol-card" id="mqttProtocolCard">
          <div class="protocol-head"><strong id="mqttBrokerId">ORL-MQTT-01</strong><span id="mqttBrokerBadge">ONLINE</span></div>
          <p>In-memory MQTT simulation for factory equipment telemetry, state, and health topics.</p>
          <div class="protocol-meta">
            <span>IMPLEMENTATION<b id="mqttImplementation">—</b></span>
            <span>LAST MESSAGE<b id="mqttLastMessage">—</b></span>
            <span>VALIDATION<b id="mqttValidation">—</b></span>
          </div>
          <p class="comms-validation-detail" id="mqttValidationDetail">Broker online; all registered equipment endpoints connected.</p>
          <button class="secondary comms-publish-button" id="publishFactorySnapshotButton">Publish Equipment Snapshot</button>
        </div>
        <div class="protocol-card opcua-card" id="opcUaProtocolCard">
          <div class="protocol-head"><strong id="opcUaId">ORL-OPCUA-01</strong><span id="opcUaState">ONLINE</span></div>
          <p id="opcUaNote">Simulated OPC-UA session monitoring metrology state and health.</p>
          <div class="opcua-paths">
            <span>ENDPOINT<code id="opcUaEndpoint">—</code></span>
            <span>MONITORED NODE<code id="opcUaNode">—</code></span>
          </div>
          <div class="protocol-meta">
            <span>SESSION<b id="opcUaSessionState">—</b></span>
            <span>SESSIONS<b id="opcUaSessions">0</b></span>
            <span>VALIDATION<b id="opcUaValidation">—</b></span>
            <span>GOOD READS<b id="opcUaReads">0</b></span>
            <span>STALE READS<b id="opcUaStaleReads">0</b></span>
            <span>LAST STATUS<b id="opcUaLastStatus">NO READ</b></span>
          </div>
          <p class="comms-validation-detail" id="opcUaValidationDetail">Adapter online; monitored metrology node is readable.</p>
          <button class="secondary opcua-read-button" id="readOpcUaButton">Read Metrology Node</button>
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
  const validation = model.validation;
  byId('mqttBrokerState').textContent = broker.state;
  byId('mqttBrokerState').dataset.state = broker.state;
  byId('mqttConnected').textContent = `${model.metrics.connectedEndpoints}/${model.metrics.totalEndpoints}`;
  byId('mqttPublished').textContent = model.metrics.messagesPublished.toLocaleString();
  byId('mqttDropped').textContent = model.metrics.messagesDropped.toLocaleString();
  byId('mqttDropped').dataset.alert = String(model.metrics.messagesDropped > 0 && model.outage.active);
  byId('mqttBrokerId').textContent = broker.id;
  byId('mqttBrokerBadge').textContent = broker.state;
  byId('mqttBrokerBadge').dataset.state = broker.state;
  byId('mqttProtocolCard').dataset.state = broker.state;
  byId('mqttImplementation').textContent = broker.implementation.replaceAll('_', ' ');
  byId('mqttLastMessage').textContent = timeLabel(broker.lastMessageAt);
  byId('mqttValidation').textContent = validation.state;
  byId('mqttValidation').dataset.state = validation.state;
  byId('mqttValidationDetail').textContent = validation.detail;

  const mqttButton = byId('publishFactorySnapshotButton');
  mqttButton.textContent = broker.state === 'OFFLINE' ? 'Attempt Equipment Publish' : broker.state === 'RECONNECTING' ? 'Reconnect In Progress' : 'Publish Equipment Snapshot';
  mqttButton.disabled = broker.state === 'RECONNECTING';

  byId('opcUaId').textContent = opcUa.id;
  byId('opcUaState').textContent = opcUa.state;
  byId('opcUaState').dataset.state = opcUa.state;
  byId('opcUaProtocolCard').dataset.state = opcUa.state;
  byId('opcUaNote').textContent = opcUa.note;
  byId('opcUaEndpoint').textContent = opcUa.endpointUrl;
  byId('opcUaNode').textContent = opcUa.monitoredNode;
  byId('opcUaSessionState').textContent = opcUa.sessionState;
  byId('opcUaSessionState').dataset.state = opcUa.sessionState;
  byId('opcUaSessions').textContent = String(opcUa.sessions);
  byId('opcUaValidation').textContent = opcUa.validation.state;
  byId('opcUaValidation').dataset.state = opcUa.validation.state;
  byId('opcUaReads').textContent = String(opcUa.reads);
  byId('opcUaStaleReads').textContent = String(opcUa.staleReads);
  byId('opcUaLastStatus').textContent = opcUa.lastValue?.statusCode || 'NO READ';
  byId('opcUaLastStatus').dataset.state = opcUa.lastValue?.statusCode === 'Good' ? 'PASS' : opcUa.lastValue ? 'FAIL' : '';
  byId('opcUaValidationDetail').textContent = opcUa.validation.detail;
  const opcUaButton = byId('readOpcUaButton');
  opcUaButton.textContent = opcUa.state === 'SESSION_LOST' ? 'Attempt Stale Node Read' : opcUa.state === 'RECONNECTING' ? 'Session Reconnecting' : 'Read Metrology Node';
  opcUaButton.disabled = opcUa.state === 'RECONNECTING';

  byId('industrialEndpointGrid').innerHTML = model.endpoints.map((endpoint) => `
    <article class="endpoint-card" data-endpoint-id="${endpoint.assetId}" data-connected="${endpoint.connected}">
      <div class="endpoint-top"><strong>${endpoint.assetId}</strong><span>${endpoint.connected ? 'CONNECTED' : 'DISCONNECTED'}</span></div>
      <div class="endpoint-topic">${endpoint.topics.telemetry}</div>
      <div class="endpoint-meta"><span>QoS <b>${endpoint.qos}</b></span><span>SEQ <b>${endpoint.lastSequence || '—'}</b></span><span>MSG <b>${endpoint.messagesPublished}</b></span><span>DROP <b data-alert="${endpoint.messagesDropped > 0 && model.outage.active}">${endpoint.messagesDropped}</b></span></div>
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
    const state = byId('mqttBrokerState')?.textContent;
    button.disabled = state === 'RECONNECTING';
  }
});

byId('readOpcUaButton')?.addEventListener('click', async () => {
  const button = byId('readOpcUaButton');
  button.disabled = true;
  try {
    await fetch('/api/factory/communications/opcua/read', { method: 'POST' });
    await refreshIndustrialCommunications();
  } finally {
    const state = byId('opcUaState')?.textContent;
    button.disabled = state === 'RECONNECTING';
  }
});

await refreshIndustrialCommunications();
setInterval(refreshIndustrialCommunications, 500);
