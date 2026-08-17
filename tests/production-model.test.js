import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductionModel } from '../src/production-model.js';

test('seeds a 25-wafer demonstration lot', () => {
  const model = new ProductionModel();
  const snapshot = model.snapshot();
  assert.equal(snapshot.lots.length, 1);
  assert.equal(snapshot.lots[0].wafers, 25);
  assert.equal(snapshot.lots[0].currentOperation, 'LITHOGRAPHY');
  assert.equal(snapshot.metrics.wipLots, 1);
});

test('advances a lot through the four-operation route', () => {
  const model = new ProductionModel();
  const id = model.snapshot().lots[0].id;
  for (let i = 0; i < 8; i += 1) model.advanceLot(id);
  const lot = model.getLot(id);
  assert.equal(lot.status, 'COMPLETED');
  assert.equal(lot.progressPct, 100);
  assert.equal(model.metrics().completedLots, 1);
});

test('holds and releases WIP with history evidence', () => {
  const model = new ProductionModel();
  const id = model.snapshot().lots[0].id;
  model.advanceLot(id);
  model.hold('MES unavailable');
  assert.equal(model.getLot(id).status, 'HOLD');
  assert.match(model.getLot(id).holdReason, /MES/);
  model.release();
  assert.equal(model.getLot(id).status, 'RUNNING');
  assert.ok(model.getLot(id).history.some(event => event.event === 'LOT_HELD'));
  assert.ok(model.getLot(id).history.some(event => event.event === 'LOT_RELEASED'));
});
