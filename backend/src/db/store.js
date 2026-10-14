'use strict';
/**
 * ExportReady :: Data Repository Store
 * Supports in-memory transactional store seeded from rules_master_25.json,
 * with optional PostgreSQL client passthrough when DATABASE_URL is set.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Path to rules single source of truth
const RULES_JSON_PATH = path.resolve(
  __dirname,
  '../../../brain/03_rules_knowledge_base/rules_master_25.json'
);

// Load master rules
let rawRules = [];
try {
  rawRules = JSON.parse(fs.readFileSync(RULES_JSON_PATH, 'utf8'));
} catch (err) {
  console.warn(`[Store] Could not load rules from ${RULES_JSON_PATH}: ${err.message}`);
}

class InMemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.rules = new Map();
    this.factories = new Map();
    this.users = new Map();
    this.factoryEvidence = new Map(); // key: `${factory_id}:${rule_id}`
    this.orders = new Map(); // key: order_id
    this.orderRules = new Map(); // key: order_id -> Array of order_rule
    this.assessmentFindings = []; // Array of findings

    this._seedRules();
    this._seedFactoriesAndUsers();
    this._seedEvidence();
    this._seedOrders();
  }

  _seedRules() {
    rawRules.forEach((r, idx) => {
      const id = `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`;
      this.rules.set(r.rule_code, {
        id,
        rule_code: r.rule_code,
        title: r.title,
        description: r.description,
        is_absolute: Boolean(r.is_absolute),
        default_effort_days: Number(r.default_effort_days || 0),
        fda_source_section: r.fda_source_section || null,
        cfr_section: r.cfr_section || null,
        iso_clause_number: r.iso_clause_number || null,
        category: r.category || 'general',
        version: 1,
        active: true,
        metadata: r.metadata || {},
        updated_at: new Date().toISOString(),
      });
    });
  }

  _seedFactoriesAndUsers() {
    // 1. Al-Shifa Surgical (Green List Compliant)
    const f1Id = '11111111-1111-4111-8111-111111111111';
    this.factories.set(f1Id, {
      id: f1Id,
      legal_name: 'Al-Shifa Surgical Pvt. Ltd. (Sialkot)',
      chamber_registration_number: 'SCCI-ALSHIFA-786',
      fda_establishment_number: '3015891234',
      fda_green_list_status: true,
      created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    });

    // 2. Merit Forgings (Non-Green List, Illustrates DWPE Blocker)
    const f2Id = '22222222-2222-4222-8222-222222222222';
    this.factories.set(f2Id, {
      id: f2Id,
      legal_name: 'Merit Forgings & Instruments (Sialkot)',
      chamber_registration_number: 'SCCI-MERIT-992',
      fda_establishment_number: '3009876543',
      fda_green_list_status: false,
      created_at: new Date('2026-01-10T00:00:00Z').toISOString(),
    });

    // Pre-seeded Users
    const u1Id = 'u1111111-1111-4111-8111-111111111111';
    this.users.set('manager@alshifa-surgical.pk', {
      id: u1Id,
      email: 'manager@alshifa-surgical.pk',
      factory_id: f1Id,
      role: 'factory_user',
      password_hash: bcrypt.hashSync('Alshifa@2026', 10),
      created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    });

    const u2Id = 'u2222222-2222-4222-8222-222222222222';
    this.users.set('manager@meritforgings.pk', {
      id: u2Id,
      email: 'manager@meritforgings.pk',
      factory_id: f2Id,
      role: 'factory_user',
      password_hash: bcrypt.hashSync('Merit@2026', 10),
      created_at: new Date('2026-01-10T00:00:00Z').toISOString(),
    });

    const u3Id = 'u3333333-3333-4333-8333-333333333333';
    this.users.set('admin@exportready.pk', {
      id: u3Id,
      email: 'admin@exportready.pk',
      factory_id: null,
      role: 'admin',
      password_hash: bcrypt.hashSync('Admin@ExportReady2026', 10),
      created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    });
  }

  _seedEvidence() {
    const f1Id = '11111111-1111-4111-8111-111111111111';
    const f2Id = '22222222-2222-4222-8222-222222222222';

    // Al-Shifa evidence: strong regulatory base, few specific operational gaps
    const f1Grades = {
      'ER-REG-001': { grade: 'third_party_verified', notes: 'FDA Green List listed under firm FEI 3015891234.' },
      'ER-REG-002': { grade: 'third_party_verified', notes: 'FURLS registration active FY2026/2027.' },
      'ER-REG-003': { grade: 'third_party_verified', notes: 'Import Alert 76-01 Green list petition verified.' },
      'ER-QMS-004': { grade: 'third_party_verified', notes: 'ISO 13485:2016 certificate SGS-PK26-9041 valid through 2028.' },
      'ER-MAT-005': { grade: 'third_party_verified', file_url: '/uploads/mtc_heat_88219.pdf', issue_date: '2026-01-15', notes: 'Martensitic AISI 420 mill cert.' },
      'ER-MAT-006': { grade: 'document_backed', issue_date: '2026-01-20', notes: 'Heat lot traceability tags matching forging shop lot.' },
      'ER-CLN-007': { grade: 'self_declared', notes: 'Bioburden ultrasonic wash protocol in draft (GAP).' },
      'ER-CLN-008': { grade: 'document_backed', notes: 'Final ultrasonic rinsing SOP-CLN-02.' },
      'ER-PAS-009': { grade: 'self_declared', notes: 'Passivation bath validation IQ/OQ/PQ protocol under execution (GAP).' },
      'ER-PAS-010': { grade: 'document_backed', notes: 'Daily nitric/citric acid immersion titration logs.' },
      'ER-PAS-011': { grade: 'document_backed', notes: 'ASTM A967 copper sulfate test logs lot-by-lot.' },
      'ER-PAS-012': { grade: 'document_backed', notes: 'ASTM F1089 water boil test 24h results.' },
      'ER-DOC-013': { grade: 'document_backed', notes: 'Device Master Record (DMR) for forceps and needle holders.' },
      'ER-DOC-014': { grade: 'document_backed', notes: 'Device History Records (DHR) template.' },
      'ER-DOC-015': { grade: 'document_backed', notes: 'Design History File.' },
      'ER-DOC-016': { grade: 'document_backed', notes: 'Document control procedure SOP-DOC-01.' },
      'ER-DOC-017': { grade: 'document_backed', notes: 'Internal quality audit schedule.' },
      'ER-DOC-018': { grade: 'document_backed', notes: 'Supplier evaluation file.' },
      'ER-DOC-019': { grade: 'document_backed', notes: 'Personnel training logs.' },
      'ER-UDI-020': { grade: 'self_declared', notes: 'Laser marker commissioned, GUDID portal registration pending (GAP).' },
      'ER-CAL-021': { grade: 'document_backed', issue_date: '2026-01-05', expiry_date: '2027-02-15', notes: 'Traceable gauge calibration certs.' },
      'ER-PKG-022': { grade: 'document_backed', notes: 'Packaging and labeling specs.' },
      'ER-STR-023': { grade: 'document_backed', notes: 'Non-sterile cleanroom bioburden controls.' },
      'ER-CAPA-024': { grade: 'document_backed', notes: 'Customer complaints handling SOP.' },
      'ER-CAPA-025': { grade: 'document_backed', notes: 'Corrective and Preventive Action procedure SOP-QMS-12.' },
    };

    for (const [code, data] of Object.entries(f1Grades)) {
      const rule = this.rules.get(code);
      if (!rule) continue;
      this.factoryEvidence.set(`${f1Id}:${rule.id}`, {
        id: `ev-${f1Id.slice(0, 8)}-${rule.rule_code}`,
        factory_id: f1Id,
        rule_id: rule.id,
        rule_code: rule.rule_code,
        proof_grade: data.grade,
        file_url: data.file_url || null,
        issue_date: data.issue_date || '2026-01-01',
        expiry_date: data.expiry_date || null,
        notes: data.notes || '',
        updated_at: new Date().toISOString(),
      });
    }

    // Merit Forgings evidence: lacks Green list (ER-REG-001/003 self declared -> Blocker)
    const f2Grades = {
      'ER-REG-001': { grade: 'self_declared', notes: 'Not listed on FDA Import Alert 76-01 Green list (BLOCKER).' },
      'ER-REG-002': { grade: 'document_backed', notes: 'FURLS registration on file.' },
      'ER-REG-003': { grade: 'self_declared', notes: 'Green list petition not yet submitted (BLOCKER).' },
      'ER-MAT-005': { grade: 'self_declared', notes: 'Supplier raw mill cert missing (GAP).' },
    };

    for (const [code, data] of Object.entries(f2Grades)) {
      const rule = this.rules.get(code);
      if (!rule) continue;
      this.factoryEvidence.set(`${f2Id}:${rule.id}`, {
        id: `ev-${f2Id.slice(0, 8)}-${rule.rule_code}`,
        factory_id: f2Id,
        rule_id: rule.id,
        rule_code: rule.rule_code,
        proof_grade: data.grade,
        file_url: data.file_url || null,
        issue_date: data.issue_date || '2026-01-01',
        expiry_date: data.expiry_date || null,
        notes: data.notes || '',
        updated_at: new Date().toISOString(),
      });
    }
  }

  _seedOrders() {
    const f1Id = '11111111-1111-4111-8111-111111111111';
    const f2Id = '22222222-2222-4222-8222-222222222222';

    const sampleOrders = [
      {
        id: 'ord-alshifa-001',
        factory_id: f1Id,
        product_name: 'Mayo-Hegar Needle Holder 16cm (Martensitic AISI 420)',
        product_code: 'NDH-420',
        quantity: 2500,
        shipment_deadline: '2027-04-15',
        financial_value_usd: 45000.0,
        buyer_contract_text:
          'All needle holders shall be fabricated from martensitic AISI 420 stainless steel with mill certificate per ASTM F899. Passivation per ASTM A967 and copper sulfate testing required.',
        status: 'evaluated',
        created_at: new Date('2026-02-01T00:00:00Z').toISOString(),
      },
      {
        id: 'ord-alshifa-002',
        factory_id: f1Id,
        product_name: 'Metzenbaum Dissecting Scissors Curved 18cm',
        product_code: 'MTC-18C',
        quantity: 4000,
        shipment_deadline: '2027-05-01',
        financial_value_usd: 68000.0,
        buyer_contract_text:
          'Surgical cutting instruments must have validated bioburden cleaning per 21 CFR 820.70(h) and laser marked UDI barcode per 21 CFR 801.',
        status: 'evaluated',
        created_at: new Date('2026-02-05T00:00:00Z').toISOString(),
      },
      {
        id: 'ord-alshifa-003',
        factory_id: f1Id,
        product_name: 'Halsted Mosquito Hemostatic Forceps Straight 12.5cm',
        product_code: 'FOR-125',
        quantity: 6000,
        shipment_deadline: '2027-06-10',
        financial_value_usd: 82000.0,
        buyer_contract_text:
          'Instruments shall comply with ISO 13485 QMS and pass ASTM F1089 water boil corrosion test.',
        status: 'evaluated',
        created_at: new Date('2026-02-10T00:00:00Z').toISOString(),
      },
      {
        id: 'ord-alshifa-004',
        factory_id: f1Id,
        product_name: 'Stille Bone Chisel 20cm Martensitic Steel',
        product_code: 'CHS-020',
        quantity: 1500,
        shipment_deadline: '2027-04-30',
        financial_value_usd: 35000.0,
        buyer_contract_text:
          'Bone chisels must have mill test certificate per ASTM F899 with heat lot number.',
        status: 'evaluated',
        created_at: new Date('2026-02-15T00:00:00Z').toISOString(),
      },
      {
        id: 'ord-merit-001',
        factory_id: f2Id,
        product_name: 'Kelly Hemostatic Forceps Curved 14cm',
        product_code: 'KEL-140',
        quantity: 3000,
        shipment_deadline: '2027-04-01',
        financial_value_usd: 50000.0,
        buyer_contract_text: 'Shipment to US port of entry Houston TX.',
        status: 'evaluated',
        created_at: new Date('2026-02-20T00:00:00Z').toISOString(),
      },
    ];

    sampleOrders.forEach((order) => {
      this.orders.set(order.id, order);

      // Pre-seed system-inferred rules for each order
      const rulesForOrder = [];
      for (const rule of this.rules.values()) {
        rulesForOrder.push({
          id: `or-${order.id}-${rule.rule_code}`,
          order_id: order.id,
          rule_id: rule.id,
          rule_code: rule.rule_code,
          source_type: 'system_inferred',
          confirmed_by_user: true,
        });
      }
      this.orderRules.set(order.id, rulesForOrder);
    });
  }

  // --- Rules ---
  getRules({ category, active } = {}) {
    let list = Array.from(this.rules.values());
    if (category) {
      list = list.filter((r) => r.category === category);
    }
    if (active !== undefined) {
      const bActive = String(active) === 'true';
      list = list.filter((r) => r.active === bActive);
    }
    return list.sort((a, b) => a.rule_code.localeCompare(b.rule_code));
  }

  getRuleByCode(ruleCode) {
    return this.rules.get(ruleCode) || null;
  }

  getRuleById(ruleId) {
    for (const rule of this.rules.values()) {
      if (rule.id === ruleId) return rule;
    }
    return null;
  }

  createRule(ruleData) {
    if (this.rules.has(ruleData.rule_code)) {
      throw new Error(`Rule code ${ruleData.rule_code} already exists`);
    }
    const id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newRule = {
      id,
      rule_code: ruleData.rule_code,
      title: ruleData.title,
      description: ruleData.description,
      is_absolute: Boolean(ruleData.is_absolute),
      default_effort_days: Number(ruleData.default_effort_days || 0),
      fda_source_section: ruleData.fda_source_section || null,
      cfr_section: ruleData.cfr_section || null,
      iso_clause_number: ruleData.iso_clause_number || null,
      category: ruleData.category || 'general',
      version: 1,
      active: true,
      metadata: ruleData.metadata || {},
      updated_at: new Date().toISOString(),
    };
    this.rules.set(newRule.rule_code, newRule);
    return newRule;
  }

  updateRule(ruleCode, updates) {
    const existing = this.rules.get(ruleCode);
    if (!existing) return null;

    // Check if substantive fields changed that require incrementing version
    const substantiveFields = [
      'title',
      'description',
      'is_absolute',
      'default_effort_days',
      'fda_source_section',
      'cfr_section',
      'iso_clause_number',
    ];
    let bumped = false;
    for (const field of substantiveFields) {
      if (updates[field] !== undefined && updates[field] !== existing[field]) {
        bumped = true;
        break;
      }
    }

    const updated = {
      ...existing,
      ...updates,
      version: bumped ? existing.version + 1 : existing.version,
      updated_at: new Date().toISOString(),
    };
    this.rules.set(ruleCode, updated);
    return updated;
  }

  // --- Factories & Users ---
  getFactoryById(factoryId) {
    return this.factories.get(factoryId) || null;
  }

  updateFactory(factoryId, updates) {
    const factory = this.factories.get(factoryId);
    if (!factory) return null;
    const updated = {
      ...factory,
      ...updates,
    };
    this.factories.set(factoryId, updated);
    return updated;
  }

  getUserByEmail(email) {
    return this.users.get(email.toLowerCase()) || null;
  }

  getUserById(userId) {
    for (const u of this.users.values()) {
      if (u.id === userId) return u;
    }
    return null;
  }

  createUser(userData) {
    const email = userData.email.toLowerCase();
    if (this.users.has(email)) {
      throw new Error(`Email ${email} is already registered`);
    }
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = {
      id,
      email,
      factory_id: userData.factory_id || null,
      role: userData.role || 'factory_user',
      password_hash: userData.password_hash,
      created_at: new Date().toISOString(),
    };
    this.users.set(email, user);
    return user;
  }

  createFactory(factoryData) {
    const id = `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const factory = {
      id,
      legal_name: factoryData.legal_name,
      chamber_registration_number: factoryData.chamber_registration_number || null,
      fda_establishment_number: factoryData.fda_establishment_number || null,
      fda_green_list_status: Boolean(factoryData.fda_green_list_status),
      created_at: new Date().toISOString(),
    };
    this.factories.set(id, factory);
    return factory;
  }

  // --- Evidence ---
  getEvidenceByFactory(factoryId) {
    const result = [];
    for (const [key, ev] of this.factoryEvidence.entries()) {
      if (key.startsWith(`${factoryId}:`)) {
        const rule = this.getRuleById(ev.rule_id);
        result.push({
          ...ev,
          rule: rule || null,
        });
      }
    }
    return result;
  }

  getEvidenceByRuleId(factoryId, ruleId) {
    return this.factoryEvidence.get(`${factoryId}:${ruleId}`) || null;
  }

  upsertEvidence(factoryId, ruleId, evidenceData) {
    const key = `${factoryId}:${ruleId}`;
    const rule = this.getRuleById(ruleId) || this.getRuleByCode(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    const existing = this.factoryEvidence.get(`${factoryId}:${rule.id}`);
    const record = {
      id: existing ? existing.id : `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      factory_id: factoryId,
      rule_id: rule.id,
      rule_code: rule.rule_code,
      proof_grade: evidenceData.proof_grade || 'self_declared',
      file_url: evidenceData.file_url !== undefined ? evidenceData.file_url : (existing ? existing.file_url : null),
      issue_date: evidenceData.issue_date !== undefined ? evidenceData.issue_date : (existing ? existing.issue_date : null),
      expiry_date: evidenceData.expiry_date !== undefined ? evidenceData.expiry_date : (existing ? existing.expiry_date : null),
      notes: evidenceData.notes !== undefined ? evidenceData.notes : (existing ? existing.notes : ''),
      updated_at: new Date().toISOString(),
    };

    this.factoryEvidence.set(`${factoryId}:${rule.id}`, record);
    return record;
  }

  // --- Orders ---
  getOrdersByFactory(factoryId, status) {
    const list = [];
    for (const order of this.orders.values()) {
      if (order.factory_id === factoryId) {
        if (!status || order.status === status) {
          list.push(order);
        }
      }
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getOrderById(factoryId, orderId) {
    const order = this.orders.get(orderId);
    if (!order || order.factory_id !== factoryId) return null;
    return order;
  }

  createOrder(factoryId, orderData) {
    const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newOrder = {
      id,
      factory_id: factoryId,
      product_name: orderData.product_name,
      product_code: orderData.product_code || null,
      quantity: Number(orderData.quantity),
      shipment_deadline: orderData.shipment_deadline,
      financial_value_usd: Number(orderData.financial_value_usd || 0),
      buyer_contract_text: orderData.buyer_contract_text || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.orders.set(id, newOrder);

    // Auto-seed default system rules for new order
    const rulesForOrder = [];
    for (const rule of this.rules.values()) {
      if (rule.active) {
        rulesForOrder.push({
          id: `or-${id}-${rule.rule_code}`,
          order_id: id,
          rule_id: rule.id,
          rule_code: rule.rule_code,
          source_type: 'system_inferred',
          confirmed_by_user: true,
        });
      }
    }
    this.orderRules.set(id, rulesForOrder);

    return newOrder;
  }

  updateOrder(factoryId, orderId, updates) {
    const order = this.getOrderById(factoryId, orderId);
    if (!order) return null;
    const updated = {
      ...order,
      ...updates,
    };
    this.orders.set(orderId, updated);
    return updated;
  }

  // --- Order Rules & Buyer Conditions ---
  getOrderRules(orderId) {
    return this.orderRules.get(orderId) || [];
  }

  addBuyerConditionCandidates(orderId, candidates) {
    let current = this.orderRules.get(orderId) || [];
    for (const cand of candidates) {
      const rule = this.getRuleByCode(cand.rule_code);
      if (!rule) continue;
      const existingIdx = current.findIndex((r) => r.rule_id === rule.id);
      if (existingIdx >= 0) {
        // Only update if not already system_inferred
        if (current[existingIdx].source_type === 'buyer_condition') {
          current[existingIdx].match_score = cand.score;
          current[existingIdx].source_sentence = cand.sentence;
        }
      } else {
        current.push({
          id: `or-${orderId}-${rule.rule_code}`,
          order_id: orderId,
          rule_id: rule.id,
          rule_code: rule.rule_code,
          source_type: 'buyer_condition',
          confirmed_by_user: false,
          match_score: cand.score,
          source_sentence: cand.sentence,
        });
      }
    }
    this.orderRules.set(orderId, current);
    return current;
  }

  confirmOrderRule(orderId, ruleCodeOrId, confirmed) {
    const current = this.orderRules.get(orderId) || [];
    let modified = false;
    for (const r of current) {
      if (r.rule_code === ruleCodeOrId || r.rule_id === ruleCodeOrId) {
        r.confirmed_by_user = Boolean(confirmed);
        modified = true;
      }
    }
    if (modified) {
      this.orderRules.set(orderId, current);
    }
    return current;
  }

  // --- Assessment Findings ---
  saveAssessmentFindings(orderId, findings, evaluationDate, summary, orderVerdict) {
    // Record into assessmentFindings array
    const timestamp = new Date().toISOString();
    findings.forEach((f) => {
      this.assessmentFindings.push({
        id: `af-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        order_id: orderId,
        rule_id: f.rule_id,
        rule_code: f.rule_code,
        verdict_status: f.verdict_status,
        assigned_effort_days: f.assigned_effort_days,
        audit_risk: f.audit_risk,
        is_absolute: f.is_absolute,
        reason: f.reason,
        rule_version: f.rule_version,
        evaluated_at: timestamp,
      });
    });

    // Update order status and cache latest assessment
    const order = this.orders.get(orderId);
    if (order) {
      order.status = 'evaluated';
      order.last_evaluated_at = timestamp;
      order.latest_evaluation = {
        order_id: orderId,
        evaluation_date: evaluationDate,
        order_verdict: orderVerdict,
        summary,
        findings,
      };
      this.orders.set(orderId, order);
    }
  }

  getAssessmentFindings(orderId) {
    return this.assessmentFindings.filter((f) => f.order_id === orderId);
  }

  getLatestAssessment(orderId) {
    const order = this.orders.get(orderId);
    return order ? order.latest_evaluation || null : null;
  }
}

// Singleton in-memory store
const memoryStore = new InMemoryStore();

module.exports = {
  memoryStore,
  InMemoryStore,
};
