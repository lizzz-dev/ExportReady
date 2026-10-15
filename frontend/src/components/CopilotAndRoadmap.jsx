import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Compass,
  Building2,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { api, getActivePersona } from '../api/client';

const PRESET_QUERIES = [
  'How do we petition for FDA Import Alert 76-01 Green List?',
  'How to validate citric acid passivation per ASTM A967?',
  'What are the UDI direct part marking rules for forceps?',
  'Can you guarantee we will pass FDA inspection without audit?',
];

export default function CopilotAndRoadmap() {
  const [activeSubTab, setActiveSubTab] = useState('copilot'); // 'copilot' | 'roadmap'

  // Copilot state
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        'Welcome to ExportReady Compliance Copilot (Feature F11). I provide grounded guidance on FDA Import Alert 76-01, ' +
        'QMSR (21 CFR Part 820), ISO 13485:2016, and ASTM metallurgical standards. Choose a question below or ask anything.',
      citations: [],
      sop_outline: [],
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  // Roadmap state
  const [roadmapData, setRoadmapData] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState(1);

  const persona = getActivePersona();

  useEffect(() => {
    loadRoadmap();
  }, [persona.id]);

  async function loadRoadmap() {
    setRoadmapLoading(true);
    try {
      const res = await api.getIsoRoadmap();
      setRoadmapData(res);
    } catch (err) {
      console.error('Failed to load roadmap:', err);
    } finally {
      setRoadmapLoading(false);
    }
  }

  async function handleSendQuery(queryToSend) {
    const q = queryToSend || inputQuery;
    if (!q.trim()) return;

    const userMsg = { role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setCopilotLoading(true);

    try {
      const res = await api.queryCopilot(q);
      const assistantMsg = {
        role: 'assistant',
        text: res.answer,
        citations: res.citations || [],
        sop_outline: res.sop_outline || [],
        refused: res.refused,
        disclaimer: res.disclaimer,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Error connecting to compliance knowledge base: ${err.message}`,
          citations: [],
          sop_outline: [],
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  }

  function handleCopySop(outline, idx) {
    const text = outline.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Top Toggle Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
            {activeSubTab === 'copilot' ? <MessageSquare className="h-6 w-6" /> : <Compass className="h-6 w-6" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {activeSubTab === 'copilot' ? 'Grounded RAG Compliance Copilot (F11)' : 'ISO 13485 6-Stage Roadmap (F12)'}
            </h2>
            <p className="text-xs text-slate-400">
              Statutory guidance, verifiable citations, step-by-step SOP templates, and registrar readiness.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-800 p-1">
          <button
            onClick={() => setActiveSubTab('copilot')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'copilot' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            RAG Copilot (F11)
          </button>
          <button
            onClick={() => setActiveSubTab('roadmap')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'roadmap' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            ISO 13485 Roadmap (F12)
          </button>
        </div>
      </div>

      {activeSubTab === 'copilot' ? (
        /* Copilot Q&A View */
        <div className="glass-panel flex h-[700px] flex-col rounded-2xl shadow-2xl">
          {/* Preset Questions Chips */}
          <div className="border-b border-slate-800/80 p-4">
            <span className="text-xs font-semibold text-slate-400">Select Preset Compliance Query:</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(preset)}
                  className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300 transition hover:border-teal-500 hover:bg-slate-700"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 shrink-0 rounded-full bg-teal-500/20 p-1.5 text-teal-400">
                    <Sparkles className="h-full w-full" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 shadow-lg ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white'
                      : msg.refused
                      ? 'border border-rose-500/30 bg-rose-950/20 text-rose-200'
                      : 'border border-slate-800 bg-slate-900/80 text-slate-200'
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>

                  {/* Grounded Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 border-t border-slate-800 pt-2 text-[11px]">
                      <span className="font-semibold text-teal-300">Statutory Citations:</span>
                      <div className="mt-1 space-y-1">
                        {msg.citations.map((c, cIdx) => (
                          <div key={cIdx} className="flex items-center gap-1.5 text-slate-400">
                            <span className="rounded bg-teal-500/20 px-1 py-0.5 font-mono text-[10px] text-teal-300">
                              {c.citation_id}
                            </span>
                            <span className="text-white font-medium">{c.source_name}</span>
                            <span>({c.cfr_section})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SOP Outline Checklist */}
                  {msg.sop_outline && msg.sop_outline.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px]">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-semibold text-cyan-300">Actionable Remediation SOP Steps:</span>
                        <button
                          onClick={() => handleCopySop(msg.sop_outline, idx)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white"
                        >
                          {copiedIdx === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === idx ? 'Copied' : 'Copy SOP'}
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 text-slate-300 font-mono">
                        {msg.sop_outline.map((step, sIdx) => (
                          <div key={sIdx} className="leading-tight">{step}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Disclaimer in footer */}
                  {msg.role === 'assistant' && (
                    <div className="mt-3 text-[10px] text-slate-500 italic">
                      This is decision support, not legal advice. Citations link to official US eCFR & FDA Import Alerts.
                    </div>
                  )}
                </div>
              </div>
            ))}

            {copilotLoading && (
              <div className="flex items-center gap-2 text-xs text-teal-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                <span>Searching FDA Import Alert 76-01 & QMSR corpus...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="border-t border-slate-800 p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about FDA Green List, ASTM F899 steel standards, passivation validation..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs text-white outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                disabled={copilotLoading}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-teal-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ISO 13485 6-Stage Roadmap View */
        <div className="space-y-6">
          {/* Stepper Card */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-white">ISO 13485:2016 6-Stage Preparation Roadmap</h3>
            <p className="mt-1 text-xs text-slate-400">
              Stages mapped dynamically to your current factory evidence vault status.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {roadmapData?.stages?.map((stage) => {
                const isSelected = selectedStage === stage.stage;
                return (
                  <button
                    key={stage.stage}
                    onClick={() => setSelectedStage(stage.stage)}
                    className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-950/30'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Stage {stage.stage}</span>
                      <div className="mt-1 font-bold text-xs text-white leading-tight">{stage.name}</div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{stage.rules_met}/{stage.rules_total} rules</span>
                        <span className="font-mono font-bold text-teal-400">{stage.completion_pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-teal-500"
                          style={{ width: `${stage.completion_pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Stage Details */}
            {roadmapData?.stages && (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/80 p-5 text-xs">
                {(() => {
                  const curr = roadmapData.stages.find((s) => s.stage === selectedStage);
                  if (!curr) return null;
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-teal-300">Stage {curr.stage}: {curr.name}</h4>
                        <span className="rounded bg-teal-500/20 px-2 py-0.5 font-bold text-teal-400">
                          {curr.completion_pct}% Complete
                        </span>
                      </div>
                      <p className="mt-1.5 text-slate-300">{curr.description}</p>

                      <div className="mt-3">
                        <span className="font-semibold text-slate-400">Typical Stage Outputs / Deliverables:</span>
                        <ul className="mt-1 list-inside list-disc space-y-1 text-slate-300">
                          {curr.typical_outputs?.map((out, oIdx) => (
                            <li key={oIdx}>{out}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Accredited Registrar Directory */}
          <div className="glass-panel rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-400" />
                <h3 className="font-bold text-white">Accredited Registrar Directory (Pakistan & US FDA Scope)</h3>
              </div>
              <span className="text-xs text-slate-400">Independent Third-Party Certification Bodies</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Approved bodies providing ISO 13485:2016 certification and QMSR compliance audits for medical device exporters.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roadmapData?.accredited_registrars?.map((reg, idx) => (
                <div key={idx} className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs">
                  <div>
                    <h4 className="font-bold text-white text-sm">{reg.name}</h4>
                    <span className="text-[11px] text-slate-400">{reg.region}</span>
                  </div>
                  <a
                    href={reg.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-teal-400 hover:text-teal-300 font-semibold text-[11px]"
                  >
                    Official Portal <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400">
              <strong>Non-Registrar Advisory Notice:</strong> ExportReady is an academic decision-support prototype and does
              not issue ISO 13485 certifications. Confirm the registrar's accreditation through IAF CertSearch
              (https://www.iafcertsearch.org) before formal engagement.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
