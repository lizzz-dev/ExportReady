import React, { useState, useEffect } from 'react';
import {
  Factory,
  Shield,
  Lock,
  PlusCircle,
  Edit2,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  FileText,
  KeyRound,
} from 'lucide-react';
import { api, getActivePersona, DEMO_PERSONAS, setActivePersona } from '../api/client';

export default function FactoryAndAdmin() {
  const [activeSubTab, setActiveSubTab] = useState('factory'); // 'factory' | 'rules' | 'legal'
  const [factoryProfile, setFactoryProfile] = useState(null);
  const [legalPolicy, setLegalPolicy] = useState(null);
  const [adminRules, setAdminRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Factory edit form
  const [chamberReg, setChamberReg] = useState('');
  const [fdaEst, setFdaEst] = useState('');
  const [greenList, setGreenList] = useState(false);
  const [savingFactory, setSavingFactory] = useState(false);

  // Rule edit modal state
  const [editingRule, setEditingRule] = useState(null);
  const [ruleEffort, setRuleEffort] = useState(0);
  const [ruleAbsolute, setRuleAbsolute] = useState(false);
  const [ruleDesc, setRuleDesc] = useState('');

  const persona = getActivePersona();
  const isAdmin = persona.id === 'admin';

  useEffect(() => {
    loadData();
  }, [persona.id]);

  async function loadData() {
    setLoading(true);
    try {
      if (persona.factoryId) {
        const fact = await api.getFactoryProfile();
        setFactoryProfile(fact);
        setChamberReg(fact.chamber_registration_number || '');
        setFdaEst(fact.fda_establishment_number || '');
        setGreenList(Boolean(fact.fda_green_list_status));
      }

      const policy = await api.getLegalPolicy();
      setLegalPolicy(policy);

      const rules = await api.getAdminRules();
      setAdminRules(rules || []);
    } catch (err) {
      console.error('Failed to load profile/admin data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveFactoryProfile(e) {
    e.preventDefault();
    setSavingFactory(true);
    try {
      const updated = await api.updateFactoryProfile({
        chamber_registration_number: chamberReg,
        fda_establishment_number: fdaEst,
        fda_green_list_status: greenList,
      });
      setFactoryProfile(updated);
      alert('Factory profile & Green List status updated. Note: Re-evaluating orders will now reflect this status change.');
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingFactory(false);
    }
  }

  async function handleSaveRule(e) {
    e.preventDefault();
    if (!editingRule) return;

    try {
      const updated = await api.updateAdminRule(editingRule.rule_code, {
        default_effort_days: parseInt(ruleEffort, 10),
        is_absolute: Boolean(ruleAbsolute),
        description: ruleDesc,
      });
      setEditingRule(null);
      await loadData();
      alert(`Rule ${updated.rule_code} updated! New Version: ${updated.version}. Past order assessments remain pinned to previous version.`);
    } catch (err) {
      alert(`Rule update failed: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
            <Factory className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Factory Profile, Admin Rules & Legal Hub</h2>
            <p className="text-xs text-slate-400">
              Features F2, F15, F16 · Multi-Tenant Settings, Rule Versioning & Privacy Guarantees
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-1">
          <button
            onClick={() => setActiveSubTab('factory')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'factory' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Factory Profile (F2)
          </button>
          <button
            onClick={() => setActiveSubTab('rules')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'rules' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin Rules (F15)
          </button>
          <button
            onClick={() => setActiveSubTab('legal')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'legal' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Legal & Privacy (F16)
          </button>
        </div>
      </div>

      {activeSubTab === 'factory' && (
        /* Factory Profile View (Feature F2) */
        <div className="glass-panel max-w-3xl rounded-2xl p-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white">Sialkot Manufacturing Factory Profile (Feature F2)</h3>
            <p className="text-xs text-slate-400">
              Manage your legal establishment identity, Chamber of Commerce registration, and FDA Green List status.
            </p>
          </div>

          <form onSubmit={handleSaveFactoryProfile} className="mt-6 space-y-4 text-xs">
            <div>
              <label className="text-slate-400">Legal Company Name (Factory Tenant)</label>
              <input
                type="text"
                disabled
                value={factoryProfile?.legal_name || persona.label}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 font-bold text-slate-300 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400">Sialkot Chamber of Commerce & Industry (SCCI) Reg #</label>
                <input
                  type="text"
                  value={chamberReg}
                  onChange={(e) => setChamberReg(e.target.value)}
                  placeholder="e.g. SCCI-786"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-400">FDA Establishment Identifier (FEI) / Reg #</label>
                <input
                  type="text"
                  value={fdaEst}
                  onChange={(e) => setFdaEst(e.target.value)}
                  placeholder="e.g. 3015891234"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Interactive Green List Toggle */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white">FDA Import Alert 76-01 Green List Status</span>
                  <p className="mt-1 text-[11px] text-slate-400 max-w-md">
                    Toggle to observe how the Decision Engine dynamically switches rule ER-REG-001 between MET and an
                    ABSOLUTE BLOCKER. Non-Green List factories are subject to automatic detention (DWPE).
                  </p>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={greenList}
                    onChange={(e) => setGreenList(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full peer-focus:outline-none" />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                {greenList ? (
                  <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Green List Verified (Exempt from automatic detention)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-bold text-rose-400">
                    <AlertTriangle className="h-4 w-4" /> Not on Green List (Automatic Detention Without Physical Examination)
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingFactory}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 font-bold text-white transition hover:bg-teal-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {savingFactory ? 'Updating Profile...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSubTab === 'rules' && (
        /* Admin Rule Manager View (Feature F15) */
        <div className="glass-panel rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-bold text-white">Statutory Rule Base & Versioning Manager (Feature F15)</h3>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'Administrator Access Granted: Edit statutory effort days, absolute flags, and watch version auto-increment.'
                  : 'Read-Only Mode: Switch to the Platform Administrator persona above to edit rules.'}
              </p>
            </div>
            {isAdmin && (
              <span className="rounded-lg bg-teal-500/20 px-3 py-1 text-xs font-bold text-teal-300">
                ADMIN PRIVILEGES ACTIVE
              </span>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-semibold">Rule Code</th>
                  <th className="py-2.5 font-semibold">Title</th>
                  <th className="py-2.5 font-semibold">Absolute?</th>
                  <th className="py-2.5 font-semibold">Default Effort</th>
                  <th className="py-2.5 font-semibold">Version</th>
                  <th className="py-2.5 font-semibold">Standard Citation</th>
                  {isAdmin && <th className="py-2.5 text-right font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {adminRules.map((rule) => (
                  <tr key={rule.rule_code} className="hover:bg-slate-800/30">
                    <td className="py-3 font-mono font-bold text-teal-400">{rule.rule_code}</td>
                    <td className="py-3 font-medium text-white">{rule.title}</td>
                    <td className="py-3">
                      {rule.is_absolute ? (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                          YES (BLOCKER)
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No (Gap)</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-cyan-400">{rule.default_effort_days}d</td>
                    <td className="py-3">
                      <span className="rounded bg-teal-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-300">
                        v{rule.version || 1}
                      </span>
                    </td>
                    <td className="py-3 text-[11px] text-slate-400">{rule.cfr_section || rule.fda_source_section}</td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleEffort(rule.default_effort_days);
                            setRuleAbsolute(rule.is_absolute);
                            setRuleDesc(rule.description);
                          }}
                          className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-teal-600 hover:text-white"
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Rule Modal */}
          {editingRule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-bold text-white">Edit Compliance Rule Parameters</h4>
                    <span className="font-mono text-xs text-teal-400">{editingRule.rule_code} (Current v{editingRule.version})</span>
                  </div>
                  <button onClick={() => setEditingRule(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleSaveRule} className="mt-4 space-y-4 text-xs">
                  <div>
                    <label className="text-slate-300">Default Remediation Effort Days</label>
                    <input
                      type="number"
                      required
                      value={ruleEffort}
                      onChange={(e) => setRuleEffort(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isAbs"
                      checked={ruleAbsolute}
                      onChange={(e) => setRuleAbsolute(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-teal-600"
                    />
                    <label htmlFor="isAbs" className="text-slate-300 font-semibold">
                      Is Absolute Statutory Precondition? (Unmet evidence forces automatic Blocker verdict)
                    </label>
                  </div>

                  <div>
                    <label className="text-slate-300">Rule Description</label>
                    <textarea
                      rows={4}
                      value={ruleDesc}
                      onChange={(e) => setRuleDesc(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white outline-none"
                    />
                  </div>

                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-300">
                    Substantive changes will automatically increment rule version (v{editingRule.version} → v{editingRule.version + 1}).
                    Past order evaluations remain permanently pinned to their original historical version for audit integrity.
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingRule(null)}
                      className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-500"
                    >
                      Save & Bump Version
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'legal' && (
        /* Legal Privacy & Non-Disclosure Hub (Feature F16) */
        <div className="glass-panel max-w-4xl rounded-2xl p-6 shadow-xl">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white">Legal Disclaimers, Data Privacy & Non-Disclosure (F16)</h3>
            <p className="text-xs text-slate-400">
              Contractual terms, multi-tenant isolation guarantees, and academic prototype context.
            </p>
          </div>

          <div className="mt-6 space-y-6 text-xs text-slate-300">
            {legalPolicy?.sections?.map((sec) => (
              <div key={sec.id} className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
                <h4 className="font-bold text-teal-300 text-sm">{sec.title}</h4>
                <p className="mt-2 text-slate-300 leading-relaxed">{sec.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
