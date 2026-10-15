import React, { useState, useEffect } from 'react';
import {
  FileText,
  PlusCircle,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  ArrowRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { api, getActivePersona } from '../api/client';

const SAMPLE_PO_PRESETS = [
  {
    label: 'Preset 1: Needle Holder (ASTM F899 + A967 Passivation)',
    name: 'Mayo-Hegar Needle Holder 16cm (Martensitic AISI 420)',
    code: 'NDH-420',
    quantity: 2500,
    deadline: '2027-04-15',
    value: 45000,
    text: 'Instruments shall be fabricated from martensitic AISI 420 stainless steel with Mill Test Certificate per ASTM F899. Passivation per ASTM A967 and copper sulfate testing required.',
  },
  {
    label: 'Preset 2: Scissors (Bioburden Cleaning + UDI Direct Marking)',
    name: 'Metzenbaum Dissecting Scissors Curved 18cm',
    code: 'MTC-18C',
    quantity: 4000,
    deadline: '2027-05-01',
    value: 68000,
    text: 'Surgical cutting instruments must have validated bioburden cleaning per 21 CFR 820.70(h) and laser marked UDI barcode per 21 CFR 801.',
  },
  {
    label: 'Preset 3: Halsted Forceps (ISO 13485 QMS + Water Boil Test)',
    name: 'Halsted Mosquito Hemostatic Forceps Straight 12.5cm',
    code: 'FOR-125',
    quantity: 6000,
    deadline: '2027-06-10',
    value: 82000,
    text: 'Instruments shall comply with ISO 13485 QMS and pass ASTM F1089 water boil corrosion test.',
  },
];

export default function OrderEvaluationWorkbench() {
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [gatekeeper, setGatekeeper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [matchingNlp, setMatchingNlp] = useState(false);
  const [nlpCandidates, setNlpCandidates] = useState([]);
  const [filterVerdict, setFilterVerdict] = useState('ALL');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // New order form state
  const [newOrderForm, setNewOrderForm] = useState(SAMPLE_PO_PRESETS[0]);

  const persona = getActivePersona();

  useEffect(() => {
    loadOrders();
  }, [persona.id]);

  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetails(selectedOrderId);
    }
  }, [selectedOrderId]);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await api.getOrders();
      setOrders(res || []);
      if (res && res.length > 0) {
        setSelectedOrderId(res[0].id);
      } else {
        setSelectedOrder(null);
        setEvaluation(null);
        setGatekeeper(null);
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrderDetails(id) {
    try {
      const ord = await api.getOrder(id);
      setSelectedOrder(ord);
      if (ord.latest_evaluation) {
        setEvaluation(ord.latest_evaluation);
      }
      // Check gatekeeper status
      const gate = await api.getInvoiceGatekeeper(id);
      setGatekeeper(gate);
    } catch (err) {
      console.error('Failed to load order details:', err);
    }
  }

  async function handleRunEvaluation() {
    if (!selectedOrderId) return;
    setEvaluating(true);
    try {
      const res = await api.evaluateOrder(selectedOrderId, { safety_buffer_days: 5 });
      setEvaluation(res);
      // Reload gatekeeper status
      const gate = await api.getInvoiceGatekeeper(selectedOrderId);
      setGatekeeper(gate);
      // Refresh order list
      const updatedList = await api.getOrders();
      setOrders(updatedList || []);
    } catch (err) {
      alert(`Evaluation failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleRunNlpMatching() {
    if (!selectedOrderId) return;
    setMatchingNlp(true);
    try {
      const res = await api.matchOrderClauses(selectedOrderId);
      setNlpCandidates(res.candidates || []);
      // Refresh order rules
      loadOrderDetails(selectedOrderId);
    } catch (err) {
      alert(`NLP matching failed: ${err.message}`);
    } finally {
      setMatchingNlp(false);
    }
  }

  async function handleToggleRuleConfirm(ruleCode, confirmed) {
    if (!selectedOrderId) return;
    try {
      await api.confirmOrderRules(selectedOrderId, [{ rule_code: ruleCode, confirmed }]);
      // Update local candidates state
      setNlpCandidates((prev) =>
        prev.map((c) => (c.matched_rule_code === ruleCode ? { ...c, confirmed_by_user: confirmed } : c))
      );
      loadOrderDetails(selectedOrderId);
    } catch (err) {
      alert(`Failed to update confirmation: ${err.message}`);
    }
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    try {
      const created = await api.createOrder({
        product_name: newOrderForm.name,
        product_code: newOrderForm.code,
        quantity: parseInt(newOrderForm.quantity, 10),
        shipment_deadline: newOrderForm.deadline,
        financial_value_usd: parseFloat(newOrderForm.value),
        buyer_contract_text: newOrderForm.text,
      });
      setShowNewOrderModal(false);
      await loadOrders();
      setSelectedOrderId(created.id);
    } catch (err) {
      alert(`Failed to create order: ${err.message}`);
    }
  }

  const findingsList = evaluation?.findings || [];
  const filteredFindings = findingsList.filter((f) => {
    if (filterVerdict === 'ALL') return true;
    if (filterVerdict === 'BLOCKER') return f.verdict_status === 'blocker';
    if (filterVerdict === 'GAP') return f.verdict_status === 'gap';
    if (filterVerdict === 'MET') return f.verdict_status === 'met';
    if (filterVerdict === 'RISK') return f.audit_risk === true;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls: Selector & Create Order Button */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Order Compliance Evaluation Workbench</h2>
            <p className="text-xs text-slate-400">
              Features F5, F6, F7, F8, F13 & F14 · NLP Matching & Deterministic Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedOrderId || ''}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 outline-none focus:border-teal-500"
          >
            {orders.map((ord) => (
              <option key={ord.id} value={ord.id}>
                {ord.product_name} (${(Number(ord.financial_value_usd) || 0).toLocaleString()})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-500"
          >
            <PlusCircle className="h-4 w-4" />
            New Order Intake
          </button>
        </div>
      </div>

      {selectedOrder && (
        <>
          {/* Hero Evaluation Status Banner */}
          <div className={`overflow-hidden rounded-2xl border p-6 shadow-2xl transition-all ${
            evaluation?.order_verdict === 'READY'
              ? 'border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40'
              : evaluation?.order_verdict === 'CONDITIONAL'
              ? 'border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40'
              : 'border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40'
          }`}>
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Order Readiness Verdict</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="font-mono text-xs text-slate-400">{selectedOrder.product_code || 'CODE-EXP'}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`text-3xl font-extrabold tracking-tight ${
                    evaluation?.order_verdict === 'READY' ? 'text-emerald-400' :
                    evaluation?.order_verdict === 'CONDITIONAL' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {evaluation?.order_verdict || 'PENDING EVALUATION'}
                  </span>
                  {evaluation?.feasibility && (
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      evaluation.feasibility.verdict === 'FEASIBLE' ? 'bg-emerald-500/20 text-emerald-300' :
                      evaluation.feasibility.verdict === 'AT_RISK' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {evaluation.feasibility.verdict}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-medium text-slate-300">{selectedOrder.product_name}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Deadline: <span className="text-white font-medium">{selectedOrder.shipment_deadline}</span> · Value: <span className="text-emerald-400 font-semibold">${Number(selectedOrder.financial_value_usd).toLocaleString()}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleRunEvaluation}
                  disabled={evaluating}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-teal-900/30 transition hover:bg-teal-500 disabled:opacity-50"
                >
                  <Play className={`h-4 w-4 ${evaluating ? 'animate-spin' : ''}`} />
                  {evaluating ? 'Executing Engine...' : 'Run Deterministic Evaluation'}
                </button>

                <button
                  onClick={handleRunNlpMatching}
                  disabled={matchingNlp}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  {matchingNlp ? 'Extracting Clauses...' : 'NLP Buyer Matcher (F6)'}
                </button>

                {evaluation && (
                  <button
                    onClick={() => setShowDossierModal(true)}
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    <Printer className="h-4 w-4 text-purple-400" />
                    Audit Dossier (F14)
                  </button>
                )}
              </div>
            </div>

            {/* Feasibility Rationale & Metric Strip */}
            {evaluation?.feasibility && (
              <div className="mt-6 border-t border-slate-800/80 pt-4">
                <div className="flex flex-col gap-4 text-xs text-slate-300 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>{evaluation.feasibility.rationale}</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span>Available: <strong className="text-white">{evaluation.feasibility.available_days}d</strong></span>
                    <span>Effort: <strong className="text-cyan-400">{evaluation.feasibility.total_effort_days}d</strong></span>
                    <span>Safety Buffer: <strong className="text-amber-400">{evaluation.feasibility.safety_buffer_days}d</strong></span>
                    <span>Margin: <strong className={evaluation.feasibility.margin_days >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{evaluation.feasibility.margin_days}d</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Document Gatekeeper Traffic Light (Feature F13) */}
          {gatekeeper && (
            <div className={`rounded-xl border p-4 shadow-lg ${
              gatekeeper.can_export
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                : 'border-rose-500/30 bg-rose-950/20 text-rose-200'
            }`}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${gatekeeper.can_export ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {gatekeeper.can_export ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Feature F13: Export Document Gatekeeper</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        gatekeeper.can_export ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'
                      }`}>
                        {gatekeeper.gatekeeper_result}
                      </span>
                    </div>
                    <p className="text-xs opacity-80">
                      {gatekeeper.can_export
                        ? 'All applicable statutory rules verified. Commercial Invoice & Packing List generation is AUTHORIZED.'
                        : `Commercial Invoice is BLOCKED. ${gatekeeper.violations_count} unverified compliance gap(s) or blocker(s) must be resolved.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span>CI: <strong className={gatekeeper.can_export ? 'text-emerald-400' : 'text-rose-400'}>{gatekeeper.commercial_invoice_status}</strong></span>
                  <span>·</span>
                  <span>PL: <strong className={gatekeeper.can_export ? 'text-emerald-400' : 'text-rose-400'}>{gatekeeper.packing_list_status}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* NLP Buyer Conditions Drawer / Panel (Feature F6) */}
          {nlpCandidates.length > 0 && (
            <div className="glass-panel rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  <h3 className="font-semibold text-white">NLP Buyer Condition Matcher (F6) — Human Confirmation Required</h3>
                </div>
                <span className="text-xs text-slate-400">{nlpCandidates.length} Clause Candidate(s) Detected</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                The AI matcher proposes rules based on buyer PO clauses. Per regulatory requirements, candidates are never
                auto-applied until confirmed by quality personnel.
              </p>

              <div className="mt-4 space-y-3">
                {nlpCandidates.map((cand, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-teal-400">{cand.matched_rule_code}</span>
                          <span className="text-slate-200 font-medium">{cand.rule_title}</span>
                          <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-mono text-teal-300">
                            {Math.round(cand.confidence_score * 100)}% match
                          </span>
                        </div>
                        <p className="mt-1.5 italic text-slate-400">"{cand.clause}"</p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleRuleConfirm(cand.matched_rule_code, true)}
                          className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                            cand.confirmed_by_user
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          Confirm Rule
                        </button>
                        <button
                          onClick={() => handleToggleRuleConfirm(cand.matched_rule_code, false)}
                          className={`rounded px-2 py-1 text-xs font-semibold transition ${
                            cand.confirmed_by_user === false
                              ? 'bg-rose-900/50 text-rose-300'
                              : 'bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white'
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings Filter & Table (Feature F7) */}
          <div className="glass-panel rounded-xl p-5 shadow-xl">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-white">Rule Evaluation Findings</h3>
                <p className="text-xs text-slate-400">
                  Deterministic evaluation against statutory rules (FDA Import Alert 76-01, 21 CFR 820 QMSR, ASTM F899/A967).
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {['ALL', 'BLOCKER', 'GAP', 'MET', 'RISK'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterVerdict(f)}
                    className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                      filterVerdict === f
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Findings Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 font-medium">Rule Code</th>
                    <th className="py-2.5 font-medium">Statutory Rule Title</th>
                    <th className="py-2.5 font-medium">Verdict</th>
                    <th className="py-2.5 font-medium">Effort</th>
                    <th className="py-2.5 font-medium">CFR / Standard</th>
                    <th className="py-2.5 font-medium">Audit Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {filteredFindings.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        {evaluation ? 'No findings match current filter.' : 'Run evaluation to inspect findings.'}
                      </td>
                    </tr>
                  ) : (
                    filteredFindings.map((f) => (
                      <tr key={f.rule_code} className="hover:bg-slate-800/30">
                        <td className="py-3 font-mono font-bold text-teal-400">{f.rule_code}</td>
                        <td className="py-3 font-medium text-white">{f.title}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                            f.verdict_status === 'met' ? 'bg-emerald-500/20 text-emerald-400' :
                            f.verdict_status === 'gap' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            {f.verdict_status.toUpperCase()}
                            {f.audit_risk && <span className="text-amber-300">(!Risk)</span>}
                          </span>
                        </td>
                        <td className="py-3 font-mono">
                          {f.assigned_effort_days > 0 ? (
                            <span className="font-semibold text-cyan-400">{f.assigned_effort_days}d</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 text-[11px] text-slate-400">
                          {f.citations?.cfr_section || f.citations?.fda_source_section || '21 CFR 820'}
                        </td>
                        <td className="py-3 text-[11px] text-slate-400">{f.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">New Export Purchase Order Intake (F5)</h3>
              <button onClick={() => setShowNewOrderModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Presets selector */}
            <div className="mt-4">
              <span className="text-xs font-semibold text-slate-400">Load Realistic Sialkot PO Template:</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {SAMPLE_PO_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNewOrderForm(preset)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-teal-500"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="text-slate-300">Product Name</label>
                <input
                  type="text"
                  required
                  value={newOrderForm.name}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300">FDA Product Code</label>
                  <input
                    type="text"
                    value={newOrderForm.code}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, code: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300">Quantity (Units)</label>
                  <input
                    type="number"
                    required
                    value={newOrderForm.quantity}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, quantity: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300">Value (USD)</label>
                  <input
                    type="number"
                    value={newOrderForm.value}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, value: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300">Shipment Deadline</label>
                <input
                  type="date"
                  required
                  value={newOrderForm.deadline}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, deadline: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300">Buyer Quality Clauses / Contract Text (analyzed by NLP matcher)</label>
                <textarea
                  rows={4}
                  value={newOrderForm.text}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, text: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-5 py-2 font-semibold text-white hover:bg-teal-500"
                >
                  Create & Initialize Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Traceable Audit Dossier Modal (Feature F14) */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-8 shadow-2xl">
            <div className="no-print flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-teal-400" />
                <h3 className="font-bold text-white">Printable US FDA Export Audit Dossier (F14)</h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-500"
                >
                  Print / Save PDF
                </button>
                <button onClick={() => setShowDossierModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="mt-6 space-y-6 text-xs text-slate-200">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-teal-400">ExportReady :: Compliance Readiness Audit Dossier</h1>
                <p className="text-slate-400">Decision-Support Report for Surgical Instrument Export to the United States</p>
                <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-900/60 p-4">
                  <div>
                    <div className="text-slate-400">Manufacturer / Exporter:</div>
                    <div className="font-bold text-white text-sm">{persona.label}</div>
                    <div className="text-slate-400">FDA Status: {persona.badge}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Product / Order:</div>
                    <div className="font-bold text-white text-sm">{selectedOrder?.product_name}</div>
                    <div className="text-slate-400">Shipment Deadline: {selectedOrder?.shipment_deadline}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white">Statutory Rules Evaluation Summary</h4>
                <div className="mt-2 grid grid-cols-4 gap-3 text-center">
                  <div className="rounded bg-slate-900 p-2"><div className="text-lg font-bold text-emerald-400">{evaluation?.summary?.met}</div><div className="text-[10px] text-slate-400">MET</div></div>
                  <div className="rounded bg-slate-900 p-2"><div className="text-lg font-bold text-amber-400">{evaluation?.summary?.gap}</div><div className="text-[10px] text-slate-400">GAPS</div></div>
                  <div className="rounded bg-slate-900 p-2"><div className="text-lg font-bold text-rose-400">{evaluation?.summary?.blocker}</div><div className="text-[10px] text-slate-400">BLOCKERS</div></div>
                  <div className="rounded bg-slate-900 p-2"><div className="text-lg font-bold text-teal-400">{evaluation?.summary?.total_effort_days}d</div><div className="text-[10px] text-slate-400">EFFORT DAYS</div></div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white">Detailed Rule-by-Rule Audit Matrix</h4>
                <table className="mt-2 w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="py-2">Code</th>
                      <th className="py-2">Statutory Standard</th>
                      <th className="py-2">Verdict</th>
                      <th className="py-2">Effort</th>
                      <th className="py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {evaluation?.findings?.map((f) => (
                      <tr key={f.rule_code}>
                        <td className="py-2 font-mono font-bold text-teal-400">{f.rule_code}</td>
                        <td className="py-2">{f.title}</td>
                        <td className="py-2 font-bold">{f.verdict_status.toUpperCase()}</td>
                        <td className="py-2">{f.assigned_effort_days}d</td>
                        <td className="py-2 text-slate-400">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-[10px] text-slate-400">
                <strong>STATUTORY DISCLAIMER:</strong> ExportReady is an informational decision-support tool. It is not legal,
                regulatory or consulting advice, not a certification, audit or inspection, and does not guarantee FDA clearance,
                Green List admission or release of any shipment at the US border.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
