const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function json(path, options) {
  const response = await fetch(`${base}${path}`, options);
  if (!response.ok && response.status !== 503) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return response.json();
}

console.log('1/5 Resetting lab...');
await json('/api/reset', { method: 'POST' });
let state = await json('/api/telemetry');
if (state.status !== 'NOMINAL') throw new Error(`Expected NOMINAL, got ${state.status}`);

console.log('2/5 Injecting packet-loss fault...');
await json('/api/faults', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'packet_loss' })
});

console.log('3/5 Waiting for detection...');
await sleep(1000);
state = await json('/api/telemetry');
if (state.status !== 'INCIDENT') throw new Error(`Expected INCIDENT, got ${state.status}`);

console.log('4/5 Waiting for automatic recovery + validation...');
await sleep(3300);
state = await json('/api/telemetry');
if (state.status !== 'NOMINAL' || !state.lastMttrMs) {
  throw new Error(`Recovery validation failed: ${JSON.stringify(state)}`);
}

console.log('5/5 Confirming incident evidence...');
const { events } = await json('/api/events');
const required = ['FAULT', 'DETECT', 'ISOLATE', 'RECOVERY', 'VALIDATE', 'RCA'];
for (const source of required) {
  if (!events.some(event => event.source === source)) throw new Error(`Missing ${source} evidence`);
}

console.log(`PASS — system recovered; MTTR ${(state.lastMttrMs / 1000).toFixed(1)}s; ${events.length} evidence events captured.`);
