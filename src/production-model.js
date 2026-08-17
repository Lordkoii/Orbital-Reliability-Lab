const clone = (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_RECIPES = {
  'ORL-DEMO-01': {
    id: 'ORL-DEMO-01',
    name: 'Baseline Demonstration Flow',
    route: [
      { operation: 'LITHOGRAPHY', tool: 'LITH-01' },
      { operation: 'ETCH', tool: 'ETCH-01' },
      { operation: 'DEPOSITION', tool: 'DEP-01' },
      { operation: 'METROLOGY', tool: 'MET-01' }
    ]
  }
};

export class ProductionModel {
  constructor() {
    this.lotCounter = 1;
    this.reset();
  }

  reset() {
    this.lotCounter = 1;
    this.recipes = clone(DEFAULT_RECIPES);
    this.lots = [];
    this.createLot({ wafers: 25, recipeId: 'ORL-DEMO-01', id: 'LOT-DEMO-001' });
    return this.snapshot();
  }

  createLot({ wafers = 25, recipeId = 'ORL-DEMO-01', id = null } = {}) {
    const recipe = this.recipes[recipeId];
    if (!recipe) return { ok: false, reason: 'Unknown recipe', snapshot: this.snapshot() };
    const lotId = id || `LOT-${String(this.lotCounter++).padStart(6, '0')}`;
    if (this.lots.some((lot) => lot.id === lotId)) return { ok: false, reason: 'Lot already exists', snapshot: this.snapshot() };
    const now = new Date().toISOString();
    const lot = {
      id: lotId,
      wafers,
      recipeId,
      status: 'QUEUED',
      routeIndex: 0,
      currentOperation: recipe.route[0].operation,
      assignedTool: recipe.route[0].tool,
      progressPct: 0,
      holdReason: null,
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, event: 'LOT_CREATED', operation: recipe.route[0].operation, tool: recipe.route[0].tool }]
    };
    this.lots.push(lot);
    return { ok: true, lot: clone(lot), snapshot: this.snapshot() };
  }

  getLot(id) { return this.lots.find((lot) => lot.id === id) || null; }

  advanceLot(id) {
    const lot = this.getLot(id);
    if (!lot) return { ok: false, reason: 'Unknown lot', snapshot: this.snapshot() };
    if (lot.status === 'HOLD') return { ok: false, reason: `Lot is on hold: ${lot.holdReason}`, snapshot: this.snapshot() };
    if (lot.status === 'COMPLETED') return { ok: false, reason: 'Lot is already completed', snapshot: this.snapshot() };

    const recipe = this.recipes[lot.recipeId];
    const step = recipe.route[lot.routeIndex];
    const now = new Date().toISOString();

    if (lot.status === 'QUEUED') {
      lot.status = 'RUNNING';
      lot.currentOperation = step.operation;
      lot.assignedTool = step.tool;
      lot.history.push({ at: now, event: 'OPERATION_STARTED', operation: step.operation, tool: step.tool });
    } else if (lot.status === 'RUNNING') {
      lot.history.push({ at: now, event: 'OPERATION_COMPLETED', operation: step.operation, tool: step.tool });
      lot.routeIndex += 1;
      lot.progressPct = Math.round((lot.routeIndex / recipe.route.length) * 100);
      if (lot.routeIndex >= recipe.route.length) {
        lot.status = 'COMPLETED';
        lot.currentOperation = 'COMPLETE';
        lot.assignedTool = null;
        lot.history.push({ at: now, event: 'LOT_COMPLETED' });
      } else {
        const next = recipe.route[lot.routeIndex];
        lot.status = 'QUEUED';
        lot.currentOperation = next.operation;
        lot.assignedTool = next.tool;
        lot.history.push({ at: now, event: 'OPERATION_QUEUED', operation: next.operation, tool: next.tool });
      }
    }
    lot.updatedAt = now;
    return { ok: true, lot: clone(lot), snapshot: this.snapshot() };
  }

  hold(reason, affectedTools = []) {
    const now = new Date().toISOString();
    for (const lot of this.lots) {
      if (lot.status === 'COMPLETED') continue;
      if (affectedTools.length && !affectedTools.includes(lot.assignedTool)) continue;
      lot.previousStatus = lot.status;
      lot.status = 'HOLD';
      lot.holdReason = reason;
      lot.updatedAt = now;
      lot.history.push({ at: now, event: 'LOT_HELD', reason, tool: lot.assignedTool });
    }
    return this.snapshot();
  }

  release(reason = 'Reliability validation passed') {
    const now = new Date().toISOString();
    for (const lot of this.lots) {
      if (lot.status !== 'HOLD') continue;
      lot.status = lot.previousStatus === 'RUNNING' ? 'RUNNING' : 'QUEUED';
      delete lot.previousStatus;
      lot.holdReason = null;
      lot.updatedAt = now;
      lot.history.push({ at: now, event: 'LOT_RELEASED', reason, tool: lot.assignedTool });
    }
    return this.snapshot();
  }

  metrics() {
    return {
      totalLots: this.lots.length,
      wipLots: this.lots.filter((lot) => lot.status !== 'COMPLETED').length,
      runningLots: this.lots.filter((lot) => lot.status === 'RUNNING').length,
      heldLots: this.lots.filter((lot) => lot.status === 'HOLD').length,
      completedLots: this.lots.filter((lot) => lot.status === 'COMPLETED').length,
      wafersInWip: this.lots.filter((lot) => lot.status !== 'COMPLETED').reduce((sum, lot) => sum + lot.wafers, 0)
    };
  }

  snapshot() {
    return { recipes: clone(Object.values(this.recipes)), lots: clone(this.lots), metrics: this.metrics() };
  }
}
