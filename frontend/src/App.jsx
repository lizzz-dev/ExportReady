import React, { useState, useEffect } from 'react';
import {
  Shield,
  Layers,
  FileCheck2,
  Wrench,
  MessageSquare,
  Building2,
  Lock,
  UserCheck,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Info,
} from 'lucide-react';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import OrderEvaluationWorkbench from './components/OrderEvaluationWorkbench';
import EvidenceVault from './components/EvidenceVault';
import FixPlannerWorkbench from './components/FixPlannerWorkbench';
import CopilotAndRoadmap from './components/CopilotAndRoadmap';
import FactoryAndAdmin from './components/FactoryAndAdmin';
import { DEMO_PERSONAS, getActivePersona, setActivePersona, api } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [persona, setPersona] = useState(getActivePersona());
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Manual auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  function handleSwitchPersona(p) {
    const updated = setActivePersona(p.id);
    setPersona(updated);
    setShowPersonaMenu(false);
  }

  async function handleManualLogin(e) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const res = await api.login(authEmail, authPassword);
      if (res?.access_token) {
        localStorage.setItem('exportready_jwt', res.access_token);
        alert(`Logged in successfully as ${res.user.email}`);
        setShowAuthModal(false);
      }
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* 1. TOP DEFENSE PERSONA SWITCHER STRIP */}
      <div className="no-print border-b border-slate-800 bg-slate-900/90 px-4 py-2 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-teal-400 uppercase tracking-wider text-[10px]">
              Final Year Project Viva Defense Mode:
            </span>
            <span className="text-slate-400">1-Click Live Switcher between Sialkot Manufacturers & Admin</span>
          </div>

          <div className="flex items-center gap-2">
            {DEMO_PERSONAS.map((p) => {
              const isActive = persona.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSwitchPersona(p)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-medium transition ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${
                    p.id === 'alshifa' ? 'bg-emerald-400' : p.id === 'merit' ? 'bg-rose-400' : 'bg-cyan-400'
                  }`} />
                  <span>{p.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER & TAB NAVIGATION */}
      <header className="no-print border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-800 text-white shadow-lg shadow-teal-900/40">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-white">ExportReady</span>
                <span className="rounded bg-teal-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-teal-300">
                  v2.0 DSS
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Medical Device Compliance Decision Support System · Sialkot
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden lg:flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="h-4 w-4" /> Command Center (F10)
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
                activeTab === 'orders'
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileCheck2 className="h-4 w-4" /> Order Evaluation (F5–F8, F13, F14)
            </button>

            <button
              onClick={() => setActiveTab('evidence')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
                activeTab === 'evidence'
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Shield className="h-4 w-4" /> Evidence Vault & OCR (F3, F4)
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
                activeTab === 'planner'
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Wrench className="h-4 w-4" /> Knapsack Planner (F9)
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
                activeTab === 'copilot'
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <MessageSquare className="h-4 w-4" /> RAG Copilot & Roadmap (F11, F12)
            </button>

            <button
              onClick={() => setActiveTab('factory')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
                activeTab === 'factory'
                  ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Building2 className="h-4 w-4" /> Factory & Admin (F2, F15, F16)
            </button>
          </nav>

          {/* User Status / Login Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              <UserCheck className="h-3.5 w-3.5 text-teal-400" />
              <span className="hidden sm:inline font-mono">{persona.email.split('@')[0]}</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex lg:hidden overflow-x-auto border-t border-slate-800/60 p-2 gap-1 text-xs">
          {['analytics', 'orders', 'evidence', 'planner', 'copilot', 'factory'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-2.5 py-1 whitespace-nowrap font-medium ${
                activeTab === tab ? 'bg-teal-600 text-white' : 'text-slate-400'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* 3. MAIN WORKBENCH CONTENT CONTAINER */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {activeTab === 'analytics' && <ExecutiveDashboard onSelectOrder={() => setActiveTab('orders')} />}
        {activeTab === 'orders' && <OrderEvaluationWorkbench />}
        {activeTab === 'evidence' && <EvidenceVault />}
        {activeTab === 'planner' && <FixPlannerWorkbench />}
        {activeTab === 'copilot' && <CopilotAndRoadmap />}
        {activeTab === 'factory' && <FactoryAndAdmin />}
      </main>

      {/* 4. PERSISTENT STATUTORY REGULATORY DISCLAIMER FOOTER */}
      <footer className="no-print border-t border-slate-800/80 bg-slate-950/80 p-5 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-4xl space-y-2">
          <div className="flex items-center justify-center gap-2 font-semibold text-slate-400">
            <Info className="h-4 w-4 text-teal-500" />
            <span>MANDATORY REGULATORY ADVISORY & DECISION-SUPPORT NOTICE</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            ExportReady is an informational decision-support tool developed as a Final Year Project at the Department of Computer Science,
            UMT Sialkot. It is <strong>not</strong> legal, regulatory or consulting advice, <strong>not</strong> a certification,
            audit or inspection, and <strong>does not guarantee</strong> FDA clearance, Green List admission or release of any shipment
            at the US border. Regulatory releases rest solely with the US Food and Drug Administration and competent border authorities.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-600 pt-1">
            <span>FDA Import Alert 76-01 (DWPE)</span>
            <span>·</span>
            <span>21 CFR Part 820 / QMSR (ISO 13485:2016)</span>
            <span>·</span>
            <span>ASTM F899 & ASTM A967</span>
            <span>·</span>
            <span>Advisor: Sir Talha Mughal</span>
          </div>
        </div>
      </footer>

      {/* Login / Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Account Authentication (Feature F1)</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleManualLogin} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="manager@alshifa-surgical.pk"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-white outline-none focus:border-teal-500"
                />
              </div>

              <div className="rounded-lg bg-slate-900/60 p-3 text-[11px] text-slate-400">
                <span className="font-semibold text-teal-400">Pre-seeded Test Credentials:</span>
                <ul className="mt-1 space-y-0.5 font-mono">
                  <li>manager@alshifa-surgical.pk / Alshifa@2026</li>
                  <li>manager@meritforgings.pk / Merit@2026</li>
                  <li>admin@exportready.pk / Admin@ExportReady2026</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="rounded-lg bg-teal-600 px-5 py-2 font-bold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
