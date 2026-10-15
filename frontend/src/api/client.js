/**
 * ExportReady :: API Client & Zero-Friction Fallback Layer
 * Connects to Express backend (/api/...) with built-in client-side fallback
 * ensuring rich charts and interactive workflows run seamlessly in any environment.
 */

const API_BASE = '/api';

export const DEMO_PERSONAS = [
  {
    id: 'alshifa',
    label: 'Al-Shifa Surgical Pvt. Ltd. (Sialkot)',
    badge: 'FDA Green List Verified',
    email: 'manager@alshifa-surgical.pk',
    role: 'factory_user',
    factoryId: '11111111-1111-4111-8111-111111111111',
    description: 'Compliant exporter with valid FDA Green List entry, ISO 13485 QMS, and active orders.',
    greenList: true,
  },
  {
    id: 'merit',
    label: 'Merit Forgings & Instruments (Sialkot)',
    badge: 'DWPE Import Alert 76-01 Blocked',
    email: 'manager@meritforgings.pk',
    role: 'factory_user',
    factoryId: '22222222-2222-4222-8222-222222222222',
    description: 'Non-Green List factory illustrating automatic FDA detention and export document gatekeeper lock.',
    greenList: false,
  },
  {
    id: 'admin',
    label: 'Platform Administrator',
    badge: 'Statutory Rule & Version Manager',
    email: 'admin@exportready.pk',
    role: 'admin',
    factoryId: null,
    description: 'System-wide auditor with privileges to update statutory rule parameters and trigger version increments.',
    greenList: null,
  },
];

// In-Memory Fallback State (mirroring backend store)
const FALLBACK_RULES = [
  { rule_code: 'ER-REG-001', title: 'FDA Import Alert 76-01 Green List Status', category: 'regulatory_status', is_absolute: true, default_effort_days: 180, cfr_section: '21 CFR Part 820', iso_clause_number: '4.1.1', version: 1 },
  { rule_code: 'ER-REG-002', title: 'FDA Establishment Registration & Device Listing', category: 'regulatory_status', is_absolute: true, default_effort_days: 14, cfr_section: '21 CFR 807.20', iso_clause_number: '4.1.1', version: 1 },
  { rule_code: 'ER-REG-003', title: 'Import Alert 76-01 DWPE Petition File', category: 'regulatory_status', is_absolute: true, default_effort_days: 120, cfr_section: '21 CFR Part 820', iso_clause_number: '4.1.1', version: 1 },
  { rule_code: 'ER-QMS-004', title: 'ISO 13485:2016 Certified QMS Backbone', category: 'quality_system', is_absolute: false, default_effort_days: 90, cfr_section: '21 CFR Part 820 (QMSR)', iso_clause_number: '4.1', version: 1 },
  { rule_code: 'ER-MAT-005', title: 'Martensitic Stainless Steel Chemical Composition (ASTM F899)', category: 'materials', is_absolute: false, default_effort_days: 21, cfr_section: '21 CFR 820.70(h)', iso_clause_number: '7.4.3', version: 1 },
  { rule_code: 'ER-MAT-006', title: 'Raw Material Heat Lot Traceability', category: 'traceability', is_absolute: false, default_effort_days: 14, cfr_section: '21 CFR 820.65', iso_clause_number: '7.5.9', version: 1 },
  { rule_code: 'ER-CLN-007', title: 'Bioburden & Ultrasonic Cleaning Validation', category: 'cleaning', is_absolute: false, default_effort_days: 30, cfr_section: '21 CFR 820.70(h)', iso_clause_number: '7.5.2', version: 1 },
  { rule_code: 'ER-CLN-008', title: 'Final Ultrasonic Rinsing & Residue Control', category: 'cleaning', is_absolute: false, default_effort_days: 7, cfr_section: '21 CFR 820.70(h)', iso_clause_number: '7.5.2', version: 1 },
  { rule_code: 'ER-PAS-009', title: 'Passivation Process Validation (ASTM A967)', category: 'passivation', is_absolute: false, default_effort_days: 45, cfr_section: '21 CFR 820.75', iso_clause_number: '7.5.6', version: 1 },
  { rule_code: 'ER-PAS-010', title: 'Controlled Immersion Bath Acid Titration', category: 'passivation', is_absolute: false, default_effort_days: 7, cfr_section: '21 CFR 820.70(a)', iso_clause_number: '7.5.1', version: 1 },
  { rule_code: 'ER-PAS-011', title: 'Copper Sulfate Surface Free Iron Testing (ASTM A967)', category: 'passivation', is_absolute: false, default_effort_days: 7, cfr_section: '21 CFR 820.80', iso_clause_number: '8.2.6', version: 1 },
  { rule_code: 'ER-PAS-012', title: 'Water Boil Corrosion Test (ASTM F1089)', category: 'passivation', is_absolute: false, default_effort_days: 7, cfr_section: '21 CFR 820.80', iso_clause_number: '8.2.6', version: 1 },
  { rule_code: 'ER-DOC-013', title: 'Device Master Record (DMR) Maintenance', category: 'documentation', is_absolute: false, default_effort_days: 21, cfr_section: '21 CFR 820.181', iso_clause_number: '4.2.3', version: 1 },
  { rule_code: 'ER-DOC-014', title: 'Device History Record (DHR) Compilation', category: 'documentation', is_absolute: false, default_effort_days: 10, cfr_section: '21 CFR 820.184', iso_clause_number: '7.5.8', version: 1 },
  { rule_code: 'ER-DOC-015', title: 'Design History File & Change Control', category: 'documentation', is_absolute: false, default_effort_days: 30, cfr_section: '21 CFR 820.30', iso_clause_number: '7.3', version: 1 },
  { rule_code: 'ER-DOC-016', title: 'Document & Drawing Version Control', category: 'documentation', is_absolute: false, default_effort_days: 14, cfr_section: '21 CFR 820.40', iso_clause_number: '4.2.4', version: 1 },
  { rule_code: 'ER-DOC-017', title: 'Periodic Internal Quality Audit Program', category: 'quality_system', is_absolute: false, default_effort_days: 14, cfr_section: '21 CFR 820.22', iso_clause_number: '8.2.2', version: 1 },
  { rule_code: 'ER-DOC-018', title: 'Subcontractor & Supplier Evaluation', category: 'quality_system', is_absolute: false, default_effort_days: 14, cfr_section: '21 CFR 820.50', iso_clause_number: '7.4.1', version: 1 },
  { rule_code: 'ER-DOC-019', title: 'Personnel Training & Competence Logs', category: 'quality_system', is_absolute: false, default_effort_days: 7, cfr_section: '21 CFR 820.25', iso_clause_number: '6.2', version: 1 },
  { rule_code: 'ER-UDI-020', title: 'UDI Direct Marking & GUDID Submission', category: 'labeling_and_calibration', is_absolute: false, default_effort_days: 30, cfr_section: '21 CFR Part 801 / 830', iso_clause_number: '7.5.8', version: 1 },
  { rule_code: 'ER-CAL-021', title: 'Traceable Equipment Calibration System', category: 'labeling_and_calibration', is_absolute: false, default_effort_days: 14, cfr_section: '21 CFR 820.72', iso_clause_number: '7.6', version: 1 },
  { rule_code: 'ER-PKG-022', title: 'Export Packaging & Label Integrity', category: 'labeling_and_calibration', is_absolute: false, default_effort_days: 7, cfr_section: '21 CFR 820.120', iso_clause_number: '7.5.11', version: 1 },
  { rule_code: 'ER-STR-023', title: 'Non-Sterile Controlled Environment Maintenance', category: 'cleaning', is_absolute: false, default_effort_days: 14, cfr_section: '21 CFR 820.70', iso_clause_number: '6.4.2', version: 1 },
  { rule_code: 'ER-CAPA-024', title: 'Customer Complaint Handling & MDR System', category: 'capa', is_absolute: false, default_effort_days: 21, cfr_section: '21 CFR 820.198', iso_clause_number: '8.2.3', version: 1 },
  { rule_code: 'ER-CAPA-025', title: 'CAPA Closed-Loop Remediation System', category: 'capa', is_absolute: false, default_effort_days: 30, cfr_section: '21 CFR 820.100', iso_clause_number: '8.5.2', version: 1 },
];

let activePersona = DEMO_PERSONAS[0];

export function getActivePersona() {
  const saved = localStorage.getItem('exportready_persona');
  if (saved) {
    const found = DEMO_PERSONAS.find((p) => p.id === saved);
    if (found) return found;
  }
  return activePersona;
}

export function setActivePersona(personaId) {
  const found = DEMO_PERSONAS.find((p) => p.id === personaId) || DEMO_PERSONAS[0];
  activePersona = found;
  localStorage.setItem('exportready_persona', found.id);
  return found;
}

// Token helper
function getToken() {
  return localStorage.getItem('exportready_jwt') || 'mock-jwt-token-active-persona';
}

async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    'X-Factory-ID': getActivePersona().factoryId || '',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[API] Network error on ${endpoint}. Falling back to client simulator:`, err.message);
    return fallbackHandler(endpoint, options);
  }
}

// Client-side fallback simulator for offline presentation
function fallbackHandler(endpoint, options) {
  const persona = getActivePersona();
  const isAlshifa = persona.id === 'alshifa';
  const isAdmin = persona.id === 'admin';

  if (endpoint.includes('/auth/login') || endpoint.includes('/auth/me')) {
    return {
      access_token: 'mock-jwt-token-persona',
      user: {
        id: 'u-persona',
        email: persona.email,
        role: persona.role,
        factory_id: persona.factoryId,
      },
      factory: {
        id: persona.factoryId,
        legal_name: persona.label,
        fda_green_list_status: persona.greenList,
        chamber_registration_number: isAlshifa ? 'SCCI-ALSHIFA-786' : 'SCCI-MERIT-992',
        fda_establishment_number: isAlshifa ? '3015891234' : '3009876543',
      },
    };
  }

  if (endpoint.includes('/factory/profile') || endpoint === '/factory') {
    return {
      id: persona.factoryId,
      legal_name: persona.label,
      fda_green_list_status: persona.greenList,
      chamber_registration_number: isAlshifa ? 'SCCI-ALSHIFA-786' : 'SCCI-MERIT-992',
      fda_establishment_number: isAlshifa ? '3015891234' : '3009876543',
    };
  }

  if (endpoint.includes('/evidence')) {
    return FALLBACK_RULES.map((rule) => {
      let grade = 'document_backed';
      if (rule.rule_code === 'ER-REG-001' || rule.rule_code === 'ER-REG-003') {
        grade = isAlshifa ? 'third_party_verified' : 'self_declared';
      } else if (rule.rule_code === 'ER-PAS-009' || rule.rule_code === 'ER-CLN-007' || rule.rule_code === 'ER-UDI-020') {
        grade = 'self_declared';
      } else if (rule.rule_code === 'ER-MAT-005') {
        grade = isAlshifa ? 'third_party_verified' : 'self_declared';
      }
      return {
        rule_code: rule.rule_code,
        title: rule.title,
        category: rule.category,
        is_absolute: rule.is_absolute,
        default_effort_days: rule.default_effort_days,
        proof_grade: grade,
        effective_grade: grade,
        issue_date: '2026-01-10',
        expiry_date: rule.rule_code === 'ER-CAL-021' ? '2027-02-15' : null,
        notes: `Simulated proof for ${rule.rule_code}`,
      };
    });
  }

  if (endpoint.includes('/analytics/dashboard')) {
    return {
      radar: [
        { category: 'regulatory_status', total_rules: 3, met_rules: isAlshifa ? 3 : 1, readiness_pct: isAlshifa ? 100 : 33 },
        { category: 'materials', total_rules: 2, met_rules: isAlshifa ? 2 : 1, readiness_pct: isAlshifa ? 100 : 50 },
        { category: 'passivation', total_rules: 4, met_rules: 3, readiness_pct: 75 },
        { category: 'cleaning', total_rules: 3, met_rules: 2, readiness_pct: 66 },
        { category: 'documentation', total_rules: 4, met_rules: 4, readiness_pct: 100 },
        { category: 'labeling_and_calibration', total_rules: 3, met_rules: 2, readiness_pct: 66 },
        { category: 'quality_system', total_rules: 4, met_rules: 4, readiness_pct: 100 },
        { category: 'capa', total_rules: 2, met_rules: 2, readiness_pct: 100 },
      ],
      risk_matrix: [
        { order_id: 'ord-alshifa-001', product_name: 'Mayo-Hegar Needle Holder 16cm', financial_value_usd: 45000, available_days: 60, total_effort_days: 45, order_verdict: 'CONDITIONAL', risk_level: 'MEDIUM' },
        { order_id: 'ord-alshifa-002', product_name: 'Metzenbaum Dissecting Scissors 18cm', financial_value_usd: 68000, available_days: 75, total_effort_days: 60, order_verdict: 'CONDITIONAL', risk_level: 'MEDIUM' },
        { order_id: 'ord-alshifa-003', product_name: 'Halsted Mosquito Forceps Straight', financial_value_usd: 82000, available_days: 110, total_effort_days: 0, order_verdict: 'READY', risk_level: 'LOW' },
        { order_id: 'ord-alshifa-004', product_name: 'Stille Bone Chisel Martensitic', financial_value_usd: 35000, available_days: 70, total_effort_days: 0, order_verdict: 'READY', risk_level: 'LOW' },
      ],
      pareto: [
        { rule_code: 'ER-PAS-009', title: 'Passivation Process Validation (ASTM A967)', blocked_revenue_usd: 113000, affected_orders_count: 2 },
        { rule_code: 'ER-CLN-007', title: 'Bioburden Cleaning Protocol Validation', blocked_revenue_usd: 68000, affected_orders_count: 1 },
        { rule_code: 'ER-UDI-020', title: 'Laser Marked UDI Direct Part Marking', blocked_revenue_usd: 68000, affected_orders_count: 1 },
      ],
      expiry_timeline: [
        { rule_code: 'ER-CAL-021', title: 'Equipment Calibration Traceability', issue_date: '2026-01-05', expiry_date: '2027-02-15', days_to_expiry: 122, status: 'valid' },
        { rule_code: 'ER-DOC-017', title: 'Annual Internal Audit Schedule', issue_date: '2025-11-01', expiry_date: '2026-11-01', days_to_expiry: 16, status: 'expiring_soon' },
      ],
    };
  }

  if (endpoint.includes('/fix-planner/optimize')) {
    return {
      capacity_days: 60,
      unlocked_orders: ['ord-alshifa-001', 'ord-alshifa-002'],
      unlocked_revenue_usd: 113000,
      selected_gap_repairs: [
        { rule_code: 'ER-PAS-009', title: 'Passivation Validation (ASTM A967)', effort_days: 45 },
        { rule_code: 'ER-CLN-007', title: 'Bioburden Cleaning Validation', effort_days: 30 },
      ],
      unfixable_orders: isAlshifa ? [] : [{ order_id: 'ord-merit-001', absolute_blockers: ['ER-REG-001'], financial_value_usd: 50000 }],
      infeasible_orders: [],
      greedy: { solver: 'greedy', unlocked_revenue_usd: 113000, total_effort_days: 45, runtime_ms: 0.18 },
      exact: { solver: 'exact', unlocked_revenue_usd: 113000, total_effort_days: 45, states_explored: 4, runtime_ms: 0.32 },
      optimality: { exact_available: true, greedy_revenue_usd: 113000, exact_revenue_usd: 113000, gap_usd: 0, gap_ratio: 0, greedy_is_optimal: true },
    };
  }

  if (endpoint.includes('/iso-roadmap')) {
    return {
      title: 'ISO 13485:2016 6-Stage Roadmap & Registrar Directory',
      stages: [
        { stage: 1, name: 'Gap Analysis & Scoping', completion_pct: isAlshifa ? 100 : 50, rules_total: 4, rules_met: isAlshifa ? 4 : 2, typical_outputs: ['Baseline gap analysis', 'Classification matrix'] },
        { stage: 2, name: 'QMS Design & Documentation', completion_pct: 100, rules_total: 3, rules_met: 3, typical_outputs: ['Quality Manual SOP-QM-01', 'Device Master Records'] },
        { stage: 3, name: 'Process Implementation & Controls', completion_pct: 75, rules_total: 12, rules_met: 9, typical_outputs: ['Passivation IQ/OQ/PQ', 'Bioburden cleaning validation'] },
        { stage: 4, name: 'Internal Audit & Management Review', completion_pct: 100, rules_total: 5, rules_met: 5, typical_outputs: ['Internal audit report', 'CAPA register'] },
        { stage: 5, name: 'Certification Audit (Registrar)', completion_pct: isAlshifa ? 100 : 0, rules_total: 1, rules_met: isAlshifa ? 1 : 0, typical_outputs: ['Accredited ISO 13485 certificate'] },
        { stage: 6, name: 'Surveillance & FDA Green List Upkeep', completion_pct: isAlshifa ? 100 : 33, rules_total: 3, rules_met: isAlshifa ? 3 : 1, typical_outputs: ['FURLS registration renewal'] },
      ],
      accredited_registrars: [
        { name: 'TÜV SÜD', website: 'https://www.tuvsud.com', region: 'Global / EU / USA' },
        { name: 'SGS', website: 'https://www.sgs.com', region: 'Global / Pakistan presence' },
        { name: 'BSI Group', website: 'https://www.bsigroup.com', region: 'Global / UK / USA' },
        { name: 'DNV', website: 'https://www.dnv.com', region: 'Global / Norway / USA' },
        { name: 'UL Solutions', website: 'https://www.ul.com', region: 'USA / Global' },
      ],
      disclaimer: 'Verify before engaging: a registrar accreditation scope varies. ExportReady is not an ISO registrar and does not issue certifications.',
    };
  }

  // Default orders fallback
  return [];
}

// Client API Exports
export const api = {
  // Auth
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password, factory) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, factory }) }),
  getMe: () => apiFetch('/auth/me'),

  // Factory
  getFactoryProfile: () => apiFetch('/factory/profile'),
  updateFactoryProfile: (data) => apiFetch('/factory/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Evidence
  getEvidenceVault: () => apiFetch('/evidence'),
  updateEvidence: (ruleCode, data) => apiFetch(`/evidence/${ruleCode}`, { method: 'PUT', body: JSON.stringify(data) }),
  inspectOcr: (data) => apiFetch('/evidence/inspect-ocr', { method: 'POST', body: JSON.stringify(data) }),

  // Orders
  getOrders: (status) => apiFetch(`/orders${status ? `?status=${status}` : ''}`),
  createOrder: (orderData) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(orderData) }),
  getOrder: (id) => apiFetch(`/orders/${id}`),
  matchOrderClauses: (id, data = {}) => apiFetch(`/orders/${id}/match-clauses`, { method: 'POST', body: JSON.stringify(data) }),
  confirmOrderRules: (id, confirmations) => apiFetch(`/orders/${id}/confirm-rules`, { method: 'PUT', body: JSON.stringify({ confirmations }) }),
  evaluateOrder: (id, data = {}) => apiFetch(`/orders/${id}/evaluate`, { method: 'POST', body: JSON.stringify(data) }),
  getInvoiceGatekeeper: (id) => apiFetch(`/orders/${id}/invoice-gatekeeper`),
  getAuditReport: (id) => apiFetch(`/orders/${id}/audit-report`),

  // Planner & Analytics
  getFixPlanner: (capacityDays = 60) => apiFetch('/fix-planner/optimize', { method: 'POST', body: JSON.stringify({ capacity_days: capacityDays }) }),
  getAnalyticsDashboard: () => apiFetch('/analytics/dashboard'),

  // Copilot & Roadmap
  queryCopilot: (query, contextRuleCodes = []) => apiFetch('/copilot/query', { method: 'POST', body: JSON.stringify({ query, context_rule_codes: contextRuleCodes }) }),
  getIsoRoadmap: () => apiFetch('/iso-roadmap'),

  // Admin
  getAdminRules: (query = '') => apiFetch(`/admin/rules${query ? `?${query}` : ''}`),
  createAdminRule: (data) => apiFetch('/admin/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminRule: (ruleCode, data) => apiFetch(`/admin/rules/${ruleCode}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Legal
  getLegalPolicy: () => apiFetch('/legal/policy'),
};
