'use strict';
/**
 * ExportReady :: Fix Planner (F9) - Set Union Knapsack Problem solvers
 * Spec: brain/04_engine_and_algorithms/KNAPSACK_OPTIMIZATION.md
 *
 * Orders are items (profit = financial_value_usd); rules are elements (weight = repair effort days).
 * Selecting several orders costs the UNION of their required repairs, so a repair shared by
 * several orders is paid once.
 *
 * Order input:  { order_id, financial_value_usd, findings, available_days? }
 *   findings        - output of evaluateOrder().findings (each blocker must carry is_absolute)
 *   available_days  - optional; calendar days to this order's own deadline. An order whose own
 *                     repairs exceed it can never ship on time and is reported as infeasible.
 *
 * Pure and deterministic (money handled in integer cents; all ties broken by order_id).
 */

function toCents(value, label) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new TypeError(`${label}: financial_value_usd must be a non-negative number`);
  return Math.round(n * 100);
}

function assertCapacity(capacityDays) {
  if (!Number.isFinite(capacityDays) || capacityDays < 0) {
    throw new TypeError('capacityDays must be a non-negative number');
  }
}

const byId = (a, b) => (a.order_id < b.order_id ? -1 : a.order_id > b.order_id ? 1 : 0);
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function normalizeOrder(order) {
  if (!order || typeof order.order_id !== 'string' || order.order_id === '') {
    throw new TypeError('each order needs a string order_id');
  }
  if (!Array.isArray(order.findings)) throw new TypeError(`${order.order_id}: findings must be an array`);

  const fixes = new Map(); // rule_code -> { title, effort_days }
  const absoluteBlockers = [];
  for (const f of order.findings) {
    if (f.verdict_status === 'met') continue;
    if (f.verdict_status === 'blocker') {
      if (typeof f.is_absolute !== 'boolean') {
        throw new TypeError(`${order.order_id}/${f.rule_code}: blocker findings must carry boolean is_absolute`);
      }
      if (f.is_absolute) {
        absoluteBlockers.push(f.rule_code);
        continue;
      }
    } else if (f.verdict_status !== 'gap') {
      throw new TypeError(`${order.order_id}/${f.rule_code}: unknown verdict_status '${f.verdict_status}'`);
    }
    if (!Number.isInteger(f.assigned_effort_days) || f.assigned_effort_days < 0) {
      throw new TypeError(`${order.order_id}/${f.rule_code}: assigned_effort_days must be a non-negative integer`);
    }
    fixes.set(f.rule_code, { title: f.title ?? f.rule_code, effort_days: f.assigned_effort_days });
  }
  absoluteBlockers.sort();

  return {
    order_id: order.order_id,
    value_cents: toCents(order.financial_value_usd, order.order_id),
    fixes,
    absoluteBlockers,
    available_days: order.available_days,
  };
}

/** Split orders into ready / unfixable / infeasible / candidates and compute shared repair weights. */
function partition(orders, capacityDays) {
  assertCapacity(capacityDays);
  if (!Array.isArray(orders)) throw new TypeError('orders must be an array');

  const normalized = orders.map(normalizeOrder).sort(byId);
  const ids = new Set();
  for (const o of normalized) {
    if (ids.has(o.order_id)) throw new TypeError(`duplicate order_id: ${o.order_id}`);
    ids.add(o.order_id);
  }

  const ready = [];
  const unfixable = [];
  const infeasible = [];
  const zeroValue = [];
  const candidates = [];

  for (const o of normalized) {
    if (o.absoluteBlockers.length > 0) {
      unfixable.push(o);
    } else if (o.fixes.size === 0) {
      ready.push(o);
    } else {
      let own = 0;
      for (const fx of o.fixes.values()) own += fx.effort_days;
      if (o.available_days !== undefined && o.available_days !== null && own > o.available_days) {
        infeasible.push({ order: o, required_days: own });
      } else if (o.value_cents === 0) {
        zeroValue.push(o);
      } else {
        candidates.push(o);
      }
    }
  }

  // Repair weight: max effort recorded for the repair across the candidates (identical in practice,
  // because effort = rule.default_effort_days for every gap/blocker).
  const weights = new Map();
  for (const o of candidates) {
    for (const [code, fx] of o.fixes) {
      weights.set(code, Math.max(weights.get(code) ?? 0, fx.effort_days));
    }
  }
  const titles = new Map();
  for (const o of candidates) for (const [code, fx] of o.fixes) if (!titles.has(code)) titles.set(code, fx.title);

  return { ready, unfixable, infeasible, zeroValue, candidates, weights, titles };
}

function buildResult(solver, p, chosen, capacityDays, extra = {}) {
  const chosenIds = new Set(chosen.map((o) => o.order_id));
  const codes = new Set();
  for (const o of chosen) for (const code of o.fixes.keys()) codes.add(code);
  const repairs = [...codes]
    .sort(cmpStr)
    .map((code) => ({ rule_code: code, title: p.titles.get(code), effort_days: p.weights.get(code) }));
  const totalEffort = repairs.reduce((a, r) => a + r.effort_days, 0);
  const revenueCents = chosen.reduce((a, o) => a + o.value_cents, 0);
  const unlockedIds = [...chosenIds].sort(cmpStr);
  const usd = (c) => c / 100;

  return {
    solver,
    capacity_days: capacityDays,
    unlocked_orders: unlockedIds,
    unlocked_revenue_usd: usd(revenueCents),
    selected_gap_repairs: repairs,
    total_effort_days: totalEffort,
    remaining_capacity_days: capacityDays - totalEffort,
    ready_orders: p.ready.map((o) => ({ order_id: o.order_id, financial_value_usd: usd(o.value_cents) })),
    unfixable_orders: p.unfixable.map((o) => ({
      order_id: o.order_id,
      financial_value_usd: usd(o.value_cents),
      absolute_blockers: o.absoluteBlockers,
      reason: 'Absolute blocker(s) cannot be cleared by workshop preparation days alone.',
    })),
    infeasible_orders: p.infeasible.map(({ order, required_days }) => ({
      order_id: order.order_id,
      financial_value_usd: usd(order.value_cents),
      required_days,
      available_days: order.available_days,
      reason: 'Repairs for this order alone exceed the days left to its own deadline.',
    })),
    not_selected_orders: [...p.candidates, ...p.zeroValue]
      .filter((o) => !chosenIds.has(o.order_id))
      .sort(byId)
      .map((o) => ({ order_id: o.order_id, financial_value_usd: usd(o.value_cents) })),
    ...extra,
  };
}

/**
 * Order-grouped greedy heuristic (fast, not guaranteed optimal): repeatedly take the order with the best
 * value / marginal-repair-days ratio, where marginal days only count repairs not already in the union.
 * Ties: higher value first, then order_id.
 */
function solveGreedy({ orders, capacityDays }) {
  const p = partition(orders, capacityDays);
  const union = new Set();
  let cost = 0;
  const chosen = [];
  const remaining = [...p.candidates];

  for (;;) {
    let best = null;
    for (const o of remaining) {
      let marginal = 0;
      for (const code of o.fixes.keys()) if (!union.has(code)) marginal += p.weights.get(code);
      if (cost + marginal > capacityDays) continue;
      const ratio = marginal === 0 ? Infinity : o.value_cents / marginal;
      if (
        best === null ||
        ratio > best.ratio ||
        (ratio === best.ratio &&
          (o.value_cents > best.order.value_cents ||
            (o.value_cents === best.order.value_cents && o.order_id < best.order.order_id)))
      ) {
        best = { order: o, ratio, marginal };
      }
    }
    if (best === null) break;
    chosen.push(best.order);
    for (const code of best.order.fixes.keys()) union.add(code);
    cost += best.marginal;
    remaining.splice(remaining.indexOf(best.order), 1);
  }
  return buildResult('greedy', p, chosen, capacityDays);
}

/**
 * Exact solver: dynamic programming over reachable union-masks (BigInt bitmask of repair rules).
 * state[mask] = best { value, cost, chosen } achieving exactly that union. Optimal. Throws
 * EXACT_STATE_LIMIT if the number of reachable unions exceeds maxStates.
 */
function solveExact({ orders, capacityDays, maxStates = 1_000_000 }) {
  const p = partition(orders, capacityDays);
  const codes = [...p.weights.keys()].sort(cmpStr);
  const bitOf = new Map(codes.map((c, i) => [c, 1n << BigInt(i)]));
  const weightByBit = codes.map((c) => p.weights.get(c));

  const maskOf = (o) => {
    let m = 0n;
    for (const code of o.fixes.keys()) m |= bitOf.get(code);
    return m;
  };
  const costOf = (mask) => {
    let c = 0;
    for (let i = 0; i < codes.length; i += 1) if ((mask >> BigInt(i)) & 1n) c += weightByBit[i];
    return c;
  };
  const better = (a, b) =>
    a.value !== b.value
      ? a.value > b.value
      : a.cost !== b.cost
        ? a.cost < b.cost
        : a.chosen.join('\u0000') < b.chosen.join('\u0000');

  const states = new Map([[0n, { value: 0, cost: 0, chosen: [] }]]);
  for (const o of p.candidates) {
    const om = maskOf(o);
    for (const [mask, st] of [...states.entries()]) {
      const merged = mask | om;
      const cost = st.cost + costOf(merged & ~mask);
      if (cost > capacityDays) continue;
      const cand = { value: st.value + o.value_cents, cost, chosen: [...st.chosen, o.order_id] };
      const existing = states.get(merged);
      if (!existing || better(cand, existing)) states.set(merged, cand);
    }
    if (states.size > maxStates) {
      const err = new Error(`Exact solver exceeded ${maxStates} states`);
      err.code = 'EXACT_STATE_LIMIT';
      throw err;
    }
  }

  let best = null;
  for (const st of states.values()) if (best === null || better(st, best)) best = st;
  const byOrderId = new Map(p.candidates.map((o) => [o.order_id, o]));
  const chosen = best.chosen.map((id) => byOrderId.get(id));
  return buildResult('exact', p, chosen, capacityDays, { states_explored: states.size });
}

function timed(fn) {
  const t0 = performance.now();
  const result = fn();
  return { result, runtime_ms: performance.now() - t0 };
}

/**
 * Runs both solvers, measures runtime, and reports the optimality comparison.
 * (Runtimes are the only non-deterministic fields; everything else is reproducible.)
 */
function compareFixPlans({ orders, capacityDays, maxStates }) {
  const g = timed(() => solveGreedy({ orders, capacityDays }));
  let e = null;
  let exactError = null;
  try {
    e = timed(() => solveExact({ orders, capacityDays, maxStates }));
  } catch (err) {
    if (err.code !== 'EXACT_STATE_LIMIT') throw err;
    exactError = err.message;
  }

  const greedy = { ...g.result, runtime_ms: g.runtime_ms };
  const exact = e ? { ...e.result, runtime_ms: e.runtime_ms } : null;

  let optimality;
  if (exact) {
    const gapUsd = Math.round((exact.unlocked_revenue_usd - greedy.unlocked_revenue_usd) * 100) / 100;
    optimality = {
      exact_available: true,
      greedy_revenue_usd: greedy.unlocked_revenue_usd,
      exact_revenue_usd: exact.unlocked_revenue_usd,
      gap_usd: gapUsd,
      gap_ratio: exact.unlocked_revenue_usd === 0 ? 0 : gapUsd / exact.unlocked_revenue_usd,
      greedy_is_optimal: gapUsd === 0,
    };
  } else {
    optimality = { exact_available: false, note: exactError };
  }

  return {
    capacity_days: capacityDays,
    unlocked_orders: (exact ?? greedy).unlocked_orders,
    unlocked_revenue_usd: (exact ?? greedy).unlocked_revenue_usd,
    selected_gap_repairs: (exact ?? greedy).selected_gap_repairs,
    ready_orders: greedy.ready_orders,
    unfixable_orders: greedy.unfixable_orders,
    infeasible_orders: greedy.infeasible_orders,
    greedy,
    exact,
    optimality,
  };
}

module.exports = { solveGreedy, solveExact, compareFixPlans };
