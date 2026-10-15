import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  FileSearch,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Edit2,
  Save,
  Filter,
} from 'lucide-react';
import { api, getActivePersona } from '../api/client';

const MTC_SAMPLE_1 = `MILL TEST CERTIFICATE / MATERIAL INSPECTION CERTIFICATE
Standard: EN 10204 Type 3.1
Producer: Sialkot Stainless Mills Ltd. (ISO 13485 / ISO 9001)
Material Grade: AISI 420 Martensitic Stainless Steel
Testing Standard: ASTM F899 / ASTM A967
Heat Number / Lot: HT-88219-MART
Issue Date: 2026-01-15
Expiry Date: 2027-01-15
Condition: Annealed & Hardened Bar Stock

CHEMICAL COMPOSITION (%):
Cr: 13.4%   C: 0.28%   Ni: 0.22%   Mn: 0.65%   Si: 0.40%   P: 0.02%   S: 0.01%

MECHANICAL & CORROSION TESTS:
Hardness: 52 HRC
Boil Water Corrosion Test (ASTM F1089): PASS (No rust spots after 24 hrs)
Copper Sulfate Free Iron Test (ASTM A967): PASS (Practice 22 compliant)`;

const MTC_SAMPLE_2_DISCREPANCY = `MATERIAL TEST CERTIFICATE
Producer: Subcontracted Re-rolling Mill (Gujranwala/Sialkot)
Material Grade: AISI 304 Austenitic Stainless Steel
Standard: ASTM F899 (Claimed)
Lot Number: LOT-304-DISCREPANT
Issue Date: 2026-01-20
Expiry Date: 2027-01-20

CHEMICAL COMPOSITION (%):
Cr: 18.2%   Ni: 8.4%   C: 0.07%   Mn: 1.5%   Si: 0.5%

REMARKS:
Material provided for surgical scissors forging. Non-hardenable by standard thermal treatment.`;

export default function EvidenceVault() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [editingRule, setEditingRule] = useState(null);
  const [editGrade, setEditGrade] = useState('document_backed');
  const [editNotes, setEditNotes] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');

  // OCR Drawer State
  const [showOcrDrawer, setShowOcrDrawer] = useState(false);
  const [ocrText, setOcrText] = useState(MTC_SAMPLE_1);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  const persona = getActivePersona();

  useEffect(() => {
    loadEvidence();
  }, [persona.id]);

  async function loadEvidence() {
    setLoading(true);
    try {
      const list = await api.getEvidenceVault();
      setEvidenceList(list || []);
    } catch (err) {
      console.error('Failed to load evidence vault:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(item) {
    setEditingRule(item);
    setEditGrade(item.proof_grade || 'self_declared');
    setEditNotes(item.notes || '');
    setEditIssueDate(item.issue_date || '2026-01-01');
    setEditExpiryDate(item.expiry_date || '');
  }

  async function handleSaveEvidence(e) {
    e.preventDefault();
    if (!editingRule) return;

    try {
      await api.updateEvidence(editingRule.rule_code, {
        proof_grade: editGrade,
        notes: editNotes,
        issue_date: editIssueDate || null,
        expiry_date: editExpiryDate || null,
      });
      setEditingRule(null);
      await loadEvidence();
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  }

  async function handleRunOcr(textToInspect) {
    setOcrLoading(true);
    try {
      const res = await api.inspectOcr({
        rawText: textToInspect || ocrText,
        declared_instrument_type: 'cutting',
      });
      setOcrResult(res);
    } catch (err) {
      alert(`OCR inspection failed: ${err.message}`);
    } finally {
      setOcrLoading(false);
    }
  }

  const categories = ['ALL', 'regulatory_status', 'materials', 'passivation', 'cleaning', 'documentation', 'labeling_and_calibration', 'quality_system', 'capa'];
  const filteredEvidence = evidenceList.filter((item) => {
    if (filterCategory === 'ALL') return true;
    return item.category === filterCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
            <FileCheck2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">4-Tier Compliance Evidence Vault (F3, F4)</h2>
            <p className="text-xs text-slate-400">
              {persona.label} · Verified Proof Grades, Audit Trails & Smart OCR Discrepancy Gate
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowOcrDrawer(true);
            setOcrResult(null);
          }}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-teal-500"
        >
          <FileSearch className="h-4 w-4" />
          Smart OCR Document Inspector (F4)
        </button>
      </div>

      {/* Proof Tier Legend */}
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
          <div className="font-bold text-emerald-400">Tier 1: Third-Party Verified</div>
          <div className="mt-1 text-[11px] text-slate-400">Audit-risk free (ISO 13485 accredited cert, Green List, MTC 3.1).</div>
        </div>
        <div className="rounded-lg border border-teal-500/30 bg-teal-950/20 p-3">
          <div className="font-bold text-teal-400">Tier 2: Document-Backed</div>
          <div className="mt-1 text-[11px] text-slate-400">Satisfies rule with audit risk note (Internal SOPs, bath titration logs).</div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3">
          <div className="font-bold text-amber-400">Tier 3: Self-Declared</div>
          <div className="mt-1 text-[11px] text-slate-400">Compliance Gap / Blocker; requires remediation effort days.</div>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3">
          <div className="font-bold text-rose-400">Tier 4: Expired Proof</div>
          <div className="mt-1 text-[11px] text-slate-400">Forces immediate Blocker status; requires urgent renewal.</div>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Filter className="mr-1 h-3.5 w-3.5 text-slate-500" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              filterCategory === cat
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat === 'ALL' ? 'All Rules (25)' : cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Evidence Table */}
      <div className="glass-panel overflow-hidden rounded-xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                <th className="p-3 font-semibold">Rule Code</th>
                <th className="p-3 font-semibold">Rule Title & Standard</th>
                <th className="p-3 font-semibold">Proof Grade</th>
                <th className="p-3 font-semibold">Effort (Days)</th>
                <th className="p-3 font-semibold">Valid Dates</th>
                <th className="p-3 font-semibold">Notes & Evidence Details</th>
                <th className="p-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredEvidence.map((ev) => {
                const isAbsolute = ev.is_absolute;
                return (
                  <tr key={ev.rule_code} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-teal-400">
                      {ev.rule_code}
                      {isAbsolute && (
                        <span className="ml-1 rounded bg-rose-500/20 px-1 py-0.5 text-[9px] font-bold text-rose-300">
                          ABSOLUTE
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-white">{ev.title}</div>
                      <div className="text-[11px] text-slate-500">{ev.cfr_section || ev.fda_source_section}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        ev.effective_grade === 'third_party_verified' ? 'bg-emerald-500/20 text-emerald-300' :
                        ev.effective_grade === 'document_backed' ? 'bg-teal-500/20 text-teal-300' :
                        ev.effective_grade === 'expired' ? 'bg-rose-500/20 text-rose-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {ev.effective_grade.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-mono">
                      {ev.default_effort_days > 0 ? (
                        <span className="text-cyan-400">{ev.default_effort_days}d</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-slate-400 font-mono">
                      {ev.expiry_date ? `${ev.issue_date} → ${ev.expiry_date}` : ev.issue_date || '—'}
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{ev.notes || 'No file or notes attached'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleStartEdit(ev)}
                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-teal-600 hover:text-white"
                      >
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Evidence Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white">Update Compliance Proof Grade</h3>
                <span className="font-mono text-xs text-teal-400">{editingRule.rule_code} — {editingRule.title}</span>
              </div>
              <button onClick={() => setEditingRule(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEvidence} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="text-slate-300">Proof Grade</label>
                <select
                  value={editGrade}
                  onChange={(e) => setEditGrade(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none focus:border-teal-500"
                >
                  <option value="third_party_verified">Third-Party Verified (Highest Confidence)</option>
                  <option value="document_backed">Document-Backed (Audit Risk Note)</option>
                  <option value="self_declared">Self-Declared (Unproven Gap)</option>
                  <option value="expired">Expired (Forces Blocker)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300">Issue Date</label>
                  <input
                    type="date"
                    value={editIssueDate}
                    onChange={(e) => setEditIssueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300">Notes / Certificate Verification Details</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                  placeholder="Record certificate number, lab name, or SOP reference..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 font-semibold text-white hover:bg-teal-500"
                >
                  <Save className="h-4 w-4" /> Save Proof
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart OCR Document Inspector Drawer (Feature F4) */}
      {showOcrDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-400" />
                <h3 className="font-bold text-white">Smart OCR Document Inspector (Feature F4)</h3>
              </div>
              <button onClick={() => setShowOcrDrawer(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Extracts chemical composition and heat lot numbers from Mill Test Certificates (MTC).
              Validates steel grade against ASTM F899 and flags non-martensitic discrepancies (such as AISI 304).
            </p>

            {/* Presets Button Row */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-300">1-Click Test Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setOcrText(MTC_SAMPLE_1);
                  handleRunOcr(MTC_SAMPLE_1);
                }}
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40"
              >
                Sample 1: Valid AISI 420 Martensitic MTC (ASTM F899)
              </button>
              <button
                type="button"
                onClick={() => {
                  setOcrText(MTC_SAMPLE_2_DISCREPANCY);
                  handleRunOcr(MTC_SAMPLE_2_DISCREPANCY);
                }}
                className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/40"
              >
                Sample 2: Non-Compliant AISI 304 MTC (Triggers Discrepancy Gate)
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Text Area Input */}
              <div>
                <label className="text-xs font-medium text-slate-300">Raw Certificate Text / Scanned OCR Payload</label>
                <textarea
                  rows={14}
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 font-mono text-[11px] text-slate-300 outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => handleRunOcr()}
                  disabled={ocrLoading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white transition hover:bg-teal-500 disabled:opacity-50"
                >
                  <FileSearch className="h-4 w-4" />
                  {ocrLoading ? 'Parsing Metallurgy via OCR Pipeline...' : 'Run Automated Extraction'}
                </button>
              </div>

              {/* Extraction Results */}
              <div>
                <label className="text-xs font-medium text-slate-300">Extracted Metallurgy & Discrepancy Gate</label>
                {ocrResult ? (
                  <div className="mt-1.5 space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs">
                    {/* Discrepancy Alert Banner */}
                    {ocrResult.discrepancy_alert ? (
                      <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-rose-200">
                        <div className="flex items-center gap-2 font-bold text-rose-300">
                          <AlertTriangle className="h-4 w-4 text-rose-400" />
                          CRITICAL STATUTORY DISCREPANCY DETECTED
                        </div>
                        <p className="mt-1 text-[11px] opacity-90">
                          {ocrResult.flags[0]?.message}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 text-emerald-200">
                        <div className="flex items-center gap-2 font-bold text-emerald-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          METALLURGICAL VALIDATION PASSED
                        </div>
                        <p className="mt-1 text-[11px] opacity-90">
                          Martensitic stainless steel composition conforms to ASTM F899 standards for surgical instruments.
                        </p>
                      </div>
                    )}

                    {/* Extracted Fields Matrix */}
                    <div className="grid grid-cols-2 gap-3 text-slate-300">
                      <div className="rounded bg-slate-800/80 p-2.5">
                        <span className="text-[10px] text-slate-500 uppercase">Material Grade</span>
                        <div className="font-bold text-white text-sm">{ocrResult.fields?.material_grade?.value || '—'}</div>
                      </div>
                      <div className="rounded bg-slate-800/80 p-2.5">
                        <span className="text-[10px] text-slate-500 uppercase">Heat / Lot #</span>
                        <div className="font-bold text-white text-sm">{ocrResult.fields?.heat_lot_number?.value || '—'}</div>
                      </div>
                      <div className="rounded bg-slate-800/80 p-2.5">
                        <span className="text-[10px] text-slate-500 uppercase">Testing Standard</span>
                        <div className="font-bold text-white">{ocrResult.fields?.testing_standard?.value || 'ASTM F899'}</div>
                      </div>
                      <div className="rounded bg-slate-800/80 p-2.5">
                        <span className="text-[10px] text-slate-500 uppercase">Suggested Proof Grade</span>
                        <div className="font-bold text-teal-400">{ocrResult.suggested_proof_grade}</div>
                      </div>
                    </div>

                    {/* Chemical Composition */}
                    {ocrResult.fields?.chemistry && Object.keys(ocrResult.fields.chemistry).length > 0 && (
                      <div className="rounded-lg bg-slate-800/40 p-3">
                        <span className="font-semibold text-slate-300 text-[11px]">Chemistry Breakdown:</span>
                        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
                          {Object.entries(ocrResult.fields.chemistry).map(([el, val]) => (
                            <span key={el} className="rounded bg-slate-800 px-2 py-1 text-teal-300">
                              {el}: <strong>{val}%</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400">
                      <strong>Assisted Review Rule:</strong> OCR extractions are never authoritative. Review the fields
                      above before applying to your Evidence Vault.
                    </div>
                  </div>
                ) : (
                  <div className="mt-1.5 flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
                    Select a sample above or paste an MTC and click "Run Automated Extraction"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
