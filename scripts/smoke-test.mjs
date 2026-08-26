const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function json(path, options) {
  const response = await fetch(`${base}${path}`, options);
  if (!response.ok && response.status !== 503) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

console.log('1/6 Resetting lab...');
await json('/api/reset', { method: 'POST' });
let state = await json('/api/telemetry');
if (state.status !== 'NOMINAL') throw new Error(`Expected NOMINAL, got ${state.status}`);

console.log('2/6 Injecting packet-loss fault...');
await json('/api/faults', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'packet_loss' })
});

console.log('3/6 Waiting for detection...');
await sleep(1000);
state = await json('/api/telemetry');
if (state.status !== 'INCIDENT') throw new Error(`Expected INCIDENT, got ${state.status}`);

console.log('4/6 Waiting for automatic recovery + validation...');
await sleep(3300);
state = await json('/api/telemetry');
if (state.status !== 'NOMINAL' || !state.lastMttrMs) {
  throw new Error(`Recovery validation failed: ${JSON.stringify(state)}`);
}

console.log('5/6 Confirming incident evidence...');
const { events } = await json('/api/events');
const required = ['FAULT', 'DETECT', 'ISOLATE', 'RECOVERY', 'VALIDATE', 'EVIDENCE'];
for (const source of required) {
  if (!events.some(event => event.source === source)) throw new Error(`Missing ${source} evidence`);
}

console.log('6/6 Confirming Factory communications return a deterministic nominal baseline...');
await json('/api/environment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'factory' })
});
state = await json('/api/telemetry');
const comms = state.industrialCommunications;
if (!comms || comms.broker.state !== 'ONLINE' || comms.metrics.connectedEndpoints !== 6 || comms.validation.state !== 'PASS') {
  throw new Error(`Factory communications baseline failed: ${JSON.stringify(comms)}`);
}
if (comms.opcUa.state !== 'ONLINE' || comms.opcUa.sessionState !== 'ACTIVE' || comms.opcUa.validation.state !== 'PASS') {
  throw new Error(`OPC-UA baseline failed: ${JSON.stringify(comms.opcUa)}`);
}

console.log(`PASS — recovery evidence captured; Factory MQTT and OPC-UA baselines validated.`);
