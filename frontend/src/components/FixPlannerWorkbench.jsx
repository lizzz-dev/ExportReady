import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Sliders,
  DollarSign,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { api, getActivePersona } from '../api/client';

export default function FixPlannerWorkbench() {
  const [capacityDays, setCapacityDays] = useState(60);
  const [planningData, setPlanningData] = useState(null);
  const [loading, setLoading] = useState(true);
  const persona = getActivePersona();

  useEffect(() => {
    runPlanner(capacityDays);
  }, [persona.id]);

  async function runPlanner(days) {
    setLoading(true);
    try {
      const res = await api.getFixPlanner(days);
      setPlanningData(res);
    } catch (err) {
      console.error('Failed to run fix planner:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSliderChange(e) {
    const val = parseInt(e.target.value, 10);
    setCapacityDays(val);
  }

  function handleSliderCommit() {
    runPlanner(capacityDays);
  }

  const greedy = planningData?.greedy;
  const exact = planningData?.exact;
  const optimality = planningData?.optimality;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SUKP Knapsack Fix Planner (Feature F9)</h2>
            <p className="text-xs text-slate-400">
              Set Union Knapsack Problem (SUKP) · Greedy Heuristic vs. Exact Dynamic Programming Solver
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span>Shared gap repairs paid once (Set Union)</span>
        </div>
      </div>

      {/* Capacity Slider Card */}
      <div className="glass-panel rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sliders className="h-4 w-4 text-teal-400" />
              <span>Available Factory Preparation Capacity</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Adjust available calendar days before upcoming shipment deadlines to calculate maximum unlocked revenue.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-teal-500/40 bg-teal-950/40 px-4 py-2 text-center">
              <span className="text-[10px] uppercase font-semibold text-teal-400">Selected Capacity</span>
              <div className="text-2xl font-extrabold text-white">{capacityDays} <span className="text-xs font-normal text-slate-400">days</span></div>
            </div>
          </div>
        </div>

        {/* Range Slider */}
        <div className="mt-6 space-y-2">
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={capacityDays}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-teal-500 focus:outline-none"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500">
            <span>5 Days (Tight)</span>
            <span>30 Days (1 Month)</span>
            <span>60 Days (Default)</span>
            <span>90 Days (1 Quarter)</span>
            <span>120 Days (Expanded)</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-teal-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            <span className="font-mono text-xs">Executing SUKP optimization algorithms...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Side-by-Side Comparison: Solver 1 (Greedy) vs Solver 2 (Exact) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Solver 1: Greedy Heuristic */}
            <div className="glass-panel relative overflow-hidden rounded-2xl border border-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="font-bold text-white">Solver 1: Order-Grouped Greedy</h3>
                    <span className="text-[10px] text-slate-400">O(n log n) Fast Heuristic Approximator</span>
                  </div>
                </div>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  {greedy?.runtime_ms || 0.1} ms
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[10px] uppercase text-slate-400">Unlocked Revenue</span>
                  <div className="mt-1 text-2xl font-extrabold text-white">
                    ${(greedy?.unlocked_revenue_usd || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[10px] uppercase text-slate-400">Effort Utilized</span>
                  <div className="mt-1 text-2xl font-extrabold text-amber-400">
                    {greedy?.total_effort_days || 0} <span className="text-xs text-slate-400">/ {capacityDays}d</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs">
                <span className="font-semibold text-slate-300">Algorithm Properties:</span>
                <p className="mt-1 text-slate-400 text-[11px]">
                  Sorts orders by dollar value per marginal day of required gap repair. Extremely fast for real-time
                  intake, but can occasionally get trapped in local optima when order packages compete.
                </p>
              </div>
            </div>

            {/* Solver 2: Exact Solver */}
            <div className="glass-panel relative overflow-hidden rounded-2xl border border-teal-500/40 p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-teal-400" />
                  <div>
                    <h3 className="font-bold text-white">Solver 2: Exact SUKP Solver</h3>
                    <span className="text-[10px] text-teal-300">Provably Optimal Dynamic Programming</span>
                  </div>
                </div>
                <span className="rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-teal-300">
                  {exact?.runtime_ms || 0.25} ms
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[10px] uppercase text-slate-400">Optimal Unlocked Revenue</span>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-400">
                    ${(exact?.unlocked_revenue_usd || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/60 p-3">
                  <span className="text-[10px] uppercase text-slate-400">Effort Utilized</span>
                  <div className="mt-1 text-2xl font-extrabold text-teal-300">
                    {exact?.total_effort_days || 0} <span className="text-xs text-slate-400">/ {capacityDays}d</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs">
                <span className="font-semibold text-slate-300">Optimality Verification:</span>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  {optimality?.greedy_is_optimal ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-4 w-4" /> Greedy Heuristic matches Exact Solution (0% Gap)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <AlertTriangle className="h-4 w-4" /> Optimality Gap: ${optimality?.gap_usd?.toLocaleString()} ({Math.round((optimality?.gap_ratio || 0) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Fix Plan Output: Selected Gap Repairs to Execute */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white">Recommended Fix Plan for {capacityDays}-Day Capacity</h3>
                <p className="text-xs text-slate-400">
                  Deduplicated statutory repairs that unlock the maximum possible export revenue.
                </p>
              </div>
              <span className="rounded-lg bg-teal-500/20 px-3 py-1 font-mono text-xs font-bold text-teal-300">
                {(planningData?.selected_gap_repairs || []).length} Actions
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {(planningData?.selected_gap_repairs || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No repairs fit in the selected capacity or all available orders are already compliant.
                </div>
              ) : (
                (planningData.selected_gap_repairs || []).map((repair, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-teal-400">{repair.rule_code}</span>
                          <span className="font-semibold text-white">{repair.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Fixing this rule resolves compliance gaps across multiple pending orders simultaneously.
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold text-cyan-400">{repair.effort_days} days</span>
                      <div className="text-[10px] text-slate-500">Sequential effort</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Unfixable Orders Note (e.g. Absolute Blockers) */}
            {(planningData?.unfixable_orders || []).length > 0 && (
              <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-rose-400" />
                  <span>Unfixable Orders (Absolute Statutory Blockers)</span>
                </div>
                <p className="mt-1 text-[11px] opacity-90">
                  {planningData.unfixable_orders.length} order(s) carry absolute blockers (e.g. FDA Import Alert 76-01 Green List
                  omission) which cannot be solved simply by workshop fixes. Green List petition requires formal regulatory clearance.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
