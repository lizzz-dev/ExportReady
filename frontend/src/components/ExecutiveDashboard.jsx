import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  FileCheck2,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api, getActivePersona } from '../api/client';

export default function ExecutiveDashboard({ onSelectOrder }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const persona = getActivePersona();

  useEffect(() => {
    loadDashboard();
  }, [persona.id]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await api.getAnalyticsDashboard();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-teal-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <span className="font-mono text-sm tracking-wide">Synthesizing compliance analytics pipeline...</span>
        </div>
      </div>
    );
  }

  // Calculate top KPI numbers
  const totalPipelineVal = (data.risk_matrix || []).reduce((sum, o) => sum + (Number(o.financial_value_usd) || 0), 0);
  const readyOrders = (data.risk_matrix || []).filter((o) => o.order_verdict === 'READY').length;
  const conditionalOrders = (data.risk_matrix || []).filter((o) => o.order_verdict === 'CONDITIONAL').length;
  const blockedOrders = (data.risk_matrix || []).filter((o) => o.order_verdict === 'BLOCKED').length;
  const totalOrders = (data.risk_matrix || []).length || 1;
  const readinessScore = Math.round((readyOrders / totalOrders) * 100);
  const totalEffortDays = (data.risk_matrix || []).reduce((sum, o) => sum + (o.total_effort_days || 0), 0);

  // Radar data format
  const radarData = (data.radar || []).map((r) => ({
    category: r.category.replace(/_/g, ' ').toUpperCase(),
    readiness: r.readiness_pct,
    total: r.total_rules,
    met: r.met_rules,
  }));

  // Scatter chart data
  const scatterData = (data.risk_matrix || []).map((o) => ({
    x: o.available_days,
    y: o.total_effort_days,
    z: o.financial_value_usd,
    name: o.product_name,
    orderId: o.order_id,
    verdict: o.order_verdict,
    risk: o.risk_level,
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner Notice for Persona */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${persona.greenList ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {persona.greenList ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{persona.label}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${persona.greenList ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {persona.badge}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Executive Analytics & Compliance Command Center (Feature F10)
            </p>
          </div>
        </div>
        <button
          onClick={loadDashboard}
          className="self-start rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 sm:self-auto"
        >
          Refresh Data
        </button>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="glass-panel relative overflow-hidden rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Order Pipeline</span>
            <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">${totalPipelineVal.toLocaleString()}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-semibold text-teal-400">{totalOrders}</span> US export purchase orders
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-panel relative overflow-hidden rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Readiness Score</span>
            <div className={`rounded-lg p-2 ${readinessScore >= 75 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{readinessScore}%</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className="font-semibold text-emerald-400">{readyOrders} Ready</span> · <span className="text-amber-400">{conditionalOrders} Conditional</span> · <span className="text-rose-400">{blockedOrders} Blocked</span>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-panel relative overflow-hidden rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Remediation Workload</span>
            <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{totalEffortDays} <span className="text-sm font-normal text-slate-400">days</span></div>
            <div className="mt-1 text-xs text-slate-400">
              Cumulative gap repair effort across pipeline
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="glass-panel relative overflow-hidden rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">FDA Status (IA 76-01)</span>
            <div className={`rounded-lg p-2 ${persona.greenList ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {persona.greenList ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-xl font-bold ${persona.greenList ? 'text-emerald-400' : 'text-rose-400'}`}>
              {persona.greenList ? 'Green List Active' : 'Automatic DWPE'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {persona.greenList ? 'Exempt from port detention' : 'Detained without physical examination'}
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Charts (Compliance Radar & Order Risk Matrix) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Compliance Radar */}
        <div className="glass-panel rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-teal-400" />
              <h3 className="font-semibold text-white">Compliance Subsystem Radar</h3>
            </div>
            <span className="text-xs text-slate-400">9 Statutory Domains</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Readiness percentage across 25 master rules (FDA 76-01, 21 CFR 820 QMSR, ASTM F899/A967).
          </p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar name="Readiness %" dataKey="readiness" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.4} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs shadow-lg">
                        <div className="font-bold text-teal-300">{d.category}</div>
                        <div className="text-slate-300">Readiness: {d.readiness}%</div>
                        <div className="text-slate-400">{d.met} of {d.total} rules verified</div>
                      </div>
                    );
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Order Pipeline Risk Matrix */}
        <div className="glass-panel rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h3 className="font-semibold text-white">Order Pipeline Risk Matrix</h3>
            </div>
            <span className="text-xs text-slate-400">Available Days vs Effort Days</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Orders plotted by calendar lead time remaining vs. total repair effort days.
          </p>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" dataKey="x" name="Available Days" unit="d" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="Effort Days" unit="d" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <ZAxis type="number" dataKey="z" range={[80, 400]} name="Value (USD)" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs shadow-xl">
                        <div className="font-bold text-white">{d.name}</div>
                        <div className="mt-1 text-slate-300">Value: <span className="font-semibold text-emerald-400">${d.z.toLocaleString()}</span></div>
                        <div className="text-slate-400">Available Days: {d.x}d · Effort: {d.y}d</div>
                        <div className="mt-1">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            d.verdict === 'READY' ? 'bg-emerald-500/20 text-emerald-400' :
                            d.verdict === 'CONDITIONAL' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-rose-500/20 text-rose-400'
                          }`}>
                            {d.verdict}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter name="Orders" data={scatterData}>
                  {scatterData.map((entry, index) => {
                    const color =
                      entry.verdict === 'READY' ? '#10b981' :
                      entry.verdict === 'CONDITIONAL' ? '#f59e0b' : '#f43f5e';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> FEASIBLE / Ready</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> AT_RISK / Conditional</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span> NOT_FEASIBLE / Blocked</span>
          </div>
        </div>
      </div>

      {/* Row 2: Charts (Revenue Bottleneck Pareto & Expiry Timeline) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 3: Pareto Bottlenecks */}
        <div className="glass-panel rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-rose-400" />
              <h3 className="font-semibold text-white">Revenue Bottleneck Pareto</h3>
            </div>
            <span className="text-xs text-slate-400">Top Blocked Value (USD)</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Regulatory gap rules ranked by the total dollar value of affected export shipments.
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pareto || []} layout="vertical" margin={{ left: 30, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `$${v / 1000}k`} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis dataKey="rule_code" type="category" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  formatter={(val, name, item) => [`$${Number(val).toLocaleString()}`, 'Blocked Revenue']}
                  labelFormatter={(code) => `${code}: ${data.pareto?.find(p => p.rule_code === code)?.title || ''}`}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="blocked_revenue_usd" fill="#f43f5e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Expiry Timeline */}
        <div className="glass-panel rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-cyan-400" />
              <h3 className="font-semibold text-white">Calibration & Certificate Expiry</h3>
            </div>
            <span className="text-xs text-slate-400">Audit Proof Timelines</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Monitoring calibration certificates, lab reports, and audits nearing renewal.
          </p>
          <div className="mt-4 space-y-2.5 overflow-y-auto max-h-60 pr-1">
            {(data.expiry_timeline || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active expiration dates recorded in current factory vault.
              </div>
            ) : (
              (data.expiry_timeline || []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs transition hover:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-teal-400">{item.rule_code}</span>
                    <div>
                      <div className="font-medium text-slate-200">{item.title}</div>
                      <div className="text-[11px] text-slate-400">Expires: {item.expiry_date}</div>
                    </div>
                  </div>
                  <div>
                    {item.status === 'expired' ? (
                      <span className="rounded bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-400">
                        EXPIRED ({Math.abs(item.days_to_expiry)}d ago)
                      </span>
                    ) : item.status === 'expiring_soon' ? (
                      <span className="rounded bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-400">
                        EXPIRING ({item.days_to_expiry}d left)
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-400">
                        VALID ({item.days_to_expiry}d left)
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
