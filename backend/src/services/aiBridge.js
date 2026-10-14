'use strict';

/**
 * ExportReady :: AI Microservice Bridge
 * Bridges Express backend to Python FastAPI AI service (:8000),
 * with a reliable deterministic JavaScript fallback for CI/offline testing.
 */

const AI_SERVICE_BASE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MANDATORY_LEGAL_DISCLAIMER =
  'ExportReady is an informational decision-support tool. It is not legal, regulatory or consulting advice, ' +
  'not a certification, audit or inspection, and does not guarantee FDA clearance, Green List admission or release ' +
  'of any shipment at the US border. Results depend entirely on the information and evidence you provide and on the ' +
  'rule base as of the displayed rule versions, which may lag official changes. Regulatory decisions rest with FDA and ' +
  'the competent authorities. Consult qualified regulatory professionals before shipping.';

/**
 * NLP Buyer Condition Matcher
 */
async function matchBuyerConditions({ text, threshold = 0.65, rules = [] }) {
  try {
    const res = await fetch(`${AI_SERVICE_BASE_URL}/nlp/match-conditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, threshold, rules }),
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fall through to deterministic JS fallback
  }

  return localDeterministicNlpMatcher(text, threshold, rules);
}

function localDeterministicNlpMatcher(text, threshold = 0.65, rules = []) {
  if (!text || typeof text !== 'string') {
    return { total_clauses_evaluated: 0, candidates: [] };
  }

  // Split into clauses preserving decimal points (e.g. 4.2.3, 820.75)
  const clauses = text
    .split(/(?<!\b(?:e\.g|i\.e|no|vs|\d))\.(?!\d)|\n+|;/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const keywordsToRule = [
    { patterns: [/420/i, /martensitic/i, /astm\s*f899/i, /mill\s*cert/i, /chemical\s*comp/i], rule: 'ER-MAT-005', score: 0.88 },
    { patterns: [/traceab/i, /heat\s*lot/i, /raw\s*material\s*ident/i], rule: 'ER-MAT-006', score: 0.82 },
    { patterns: [/passivat/i, /nitric/i, /citric/i, /astm\s*a967/i], rule: 'ER-PAS-009', score: 0.85 },
    { patterns: [/immersion/i, /bath/i, /acid\s*bath/i], rule: 'ER-PAS-010', score: 0.76 },
    { patterns: [/copper\s*sulfate/i], rule: 'ER-PAS-011', score: 0.89 },
    { patterns: [/water\s*boil/i, /boil\s*test/i, /astm\s*f1089/i], rule: 'ER-PAS-012', score: 0.87 },
    { patterns: [/bioburden/i, /clean/i, /ultrasonic/i], rule: 'ER-CLN-007', score: 0.83 },
    { patterns: [/udi/i, /unique\s*device/i, /gudid/i, /barcode/i, /21\s*cfr\s*801/i], rule: 'ER-UDI-020', score: 0.86 },
    { patterns: [/calibrat/i, /micrometer/i, /gauge/i], rule: 'ER-CAL-021', score: 0.84 },
    { patterns: [/iso\s*13485/i, /quality\s*manual/i, /qms/i], rule: 'ER-QMS-004', score: 0.85 },
    { patterns: [/green\s*list/i, /import\s*alert/i, /76-01/i, /dwpe/i], rule: 'ER-REG-001', score: 0.92 },
    { patterns: [/device\s*master\s*record/i, /\bdmr\b/i], rule: 'ER-DOC-013', score: 0.84 },
    { patterns: [/device\s*history\s*record/i, /\bdhr\b/i], rule: 'ER-DOC-014', score: 0.84 },
  ];

  const candidates = [];
  const seenRules = new Set();

  for (const clause of clauses) {
    for (const mapping of keywordsToRule) {
      const matchCount = mapping.patterns.filter((p) => p.test(clause)).length;
      if (matchCount > 0 && mapping.score >= threshold) {
        if (!seenRules.has(mapping.rule)) {
          seenRules.add(mapping.rule);
          const ruleObj = rules.find((r) => r.rule_code === mapping.rule);
          candidates.push({
            clause,
            matched_rule_code: mapping.rule,
            rule_title: ruleObj ? ruleObj.title : mapping.rule,
            confidence_score: mapping.score,
            statutory_citations: {
              astm_standard: mapping.rule.startsWith('ER-MAT') ? 'ASTM F899' : mapping.rule.startsWith('ER-PAS') ? 'ASTM A967' : null,
              cfr_citation: mapping.rule === 'ER-UDI-020' ? '21 CFR 801.20' : '21 CFR 820.70',
            },
            confirmed_by_user: false,
            requires_human_confirmation: true,
          });
        }
      }
    }
  }

  return {
    total_clauses_evaluated: clauses.length,
    candidates,
  };
}

/**
 * Smart OCR Document Inspector
 */
async function inspectOcrDocument({ rawText, declaredInstrumentType = 'cutting', fileName = 'document.pdf' }) {
  try {
    const res = await fetch(`${AI_SERVICE_BASE_URL}/ocr/inspect-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: rawText,
        declared_instrument_type: declaredInstrumentType,
        filename: fileName,
      }),
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fall through to deterministic JS fallback
  }

  return localDeterministicOcrInspector(rawText, declaredInstrumentType, fileName);
}

function localDeterministicOcrInspector(text, declaredInstrumentType, fileName) {
  const content = text || '';

  // Extract Grade
  let materialGrade = null;
  const gradeMatches = content.match(/\b(AISI\s*)?(304|316L?|410|420[AB]?|440C|17-4PH)\b/i);
  if (gradeMatches) {
    materialGrade = gradeMatches[0].toUpperCase().replace(/\s+/, ' ');
    if (!materialGrade.startsWith('AISI') && !materialGrade.includes('17-4')) {
      materialGrade = `AISI ${materialGrade}`;
    }
  }

  // Extract Heat Lot
  let heatLot = null;
  const heatMatch = content.match(/(?:heat(?:\s*(?:no|number|lot))?|lot\s*(?:no|number)?)\s*[:#]?\s*([A-Z0-9-]+)/i);
  if (heatMatch) {
    heatLot = heatMatch[1].toUpperCase();
  }

  // Extract Standard
  let standard = null;
  const stdMatch = content.match(/\b(ASTM\s*[FA]\d+|ISO\s*\d+(?:-\d+)?|EN\s*10204(?:\s*3\.[12])?)\b/i);
  if (stdMatch) {
    standard = stdMatch[0].toUpperCase();
  }

  // Extract Dates
  let issueDate = null;
  let expiryDate = null;
  const dateMatches = content.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (dateMatches && dateMatches.length > 0) {
    issueDate = dateMatches[0];
    if (dateMatches.length > 1) {
      expiryDate = dateMatches[1];
    }
  }

  // Chemistry
  const chemistry = {};
  const crMatch = content.match(/Cr\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (crMatch) chemistry.Cr = parseFloat(crMatch[1]);
  const niMatch = content.match(/Ni\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (niMatch) chemistry.Ni = parseFloat(niMatch[1]);
  const cMatch = content.match(/C\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (cMatch) chemistry.C = parseFloat(cMatch[1]);

  const flags = [];
  let discrepancyAlert = false;

  // Discrepancy Gate: AISI 304 for cutting/martensitic instruments
  if (materialGrade && materialGrade.includes('304')) {
    discrepancyAlert = true;
    flags.push({
      code: 'GRADE_MISMATCH',
      severity: 'high',
      field: 'material_grade',
      message:
        'CRITICAL STATUTORY DISCREPANCY: Mill Test Certificate indicates austenitic stainless steel AISI 304 ' +
        '(~18% Cr, ~8% Ni). Per ASTM F899, surgical cutting instruments require hardened martensitic steel ' +
        '(such as AISI 420A/420B/420C) or precipitation-hardening steel. Non-hardenable austenitic 304 cannot ' +
        'hold an edge and is subject to FDA detention under Import Alert 76-01 for adulteration.',
    });
  }

  // Check expired date
  if (expiryDate && new Date(expiryDate) < new Date('2026-01-01')) {
    discrepancyAlert = true;
    flags.push({
      code: 'CERTIFICATE_EXPIRED',
      severity: 'high',
      field: 'expiry_date',
      message: `Certificate has expired on ${expiryDate}. Current evidence requires active valid calibration or accreditation.`,
    });
  }

  return {
    extraction_id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    filename: fileName,
    fields: {
      material_grade: { value: materialGrade, confidence: materialGrade ? 0.95 : 0.0 },
      heat_lot_number: { value: heatLot, confidence: heatLot ? 0.92 : 0.0 },
      testing_standard: { value: standard, confidence: standard ? 0.94 : 0.0 },
      issue_date: { value: issueDate, confidence: issueDate ? 0.95 : 0.0 },
      expiry_date: { value: expiryDate, confidence: expiryDate ? 0.9 : 0.5 },
      chemistry,
    },
    flags,
    discrepancy_alert: discrepancyAlert,
    suggested_proof_grade: discrepancyAlert ? 'self_declared' : 'document_backed',
    assisted_review_ready: true,
  };
}

/**
 * Grounded RAG Compliance Copilot
 */
async function queryRag({ query, contextRuleCodes = [] }) {
  try {
    const res = await fetch(`${AI_SERVICE_BASE_URL}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context_rule_codes: contextRuleCodes }),
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // Fall through to deterministic JS fallback
  }

  return localDeterministicRag(query, contextRuleCodes);
}

function localDeterministicRag(query, contextRuleCodes) {
  const qLower = (query || '').toLowerCase();

  // Strict Guardrail: Refuse legal advice evasion / fake documents
  const illegalPatterns = [/fake/i, /bribe/i, /evade/i, /bypass\s*customs/i, /forge/i, /falsif/i, /guarantee.*clear/i];
  for (const pat of illegalPatterns) {
    if (pat.test(qLower)) {
      return {
        query,
        answer:
          "I can't answer that question. ExportReady strictly refuses queries requesting assistance with regulatory evasion, " +
          'document falsification, or guarantees of border clearance. ExportReady operates solely as an objective compliance ' +
          'readiness decision support tool.',
        citations: [],
        sop_outline: [],
        disclaimer: MANDATORY_LEGAL_DISCLAIMER,
        refused: true,
      };
    }
  }

  if (qLower.includes('passivat') || qLower.includes('a967') || contextRuleCodes.includes('ER-PAS-009')) {
    return {
      query,
      answer:
        'Passivation of surgical instruments must conform to ASTM A967 and FDA QMSR 21 CFR 820.75 process validation [S1]. ' +
        'Bath formulation (citric or nitric acid), immersion temperature, concentration, and immersion duration must be defined in ' +
        'controlled procedures. Finished lots must pass lot-release testing such as copper sulfate (ASTM A967 Practice 22) or ' +
        '24-hour water immersion / boil test (ASTM F1089) [S2].',
      citations: [
        {
          citation_id: 'S1',
          source_name: 'ASTM A967 Chemical Passivation of Stainless Steel Parts',
          cfr_section: '21 CFR 820.75',
          statutory_basis: 'FDA QMSR §820.75 Process Validation; ASTM A967',
        },
        {
          citation_id: 'S2',
          source_name: 'ASTM F1089 Standard Test Method for Corrosion of Surgical Instruments',
          cfr_section: '21 CFR 820.70(h)',
          statutory_basis: 'Finished device surface corrosion resistance standard',
        },
      ],
      sop_outline: [
        '1. Establish validated acid bath parameters (e.g., Citric acid 4-10% at 50-60°C for 20-30 min).',
        '2. Perform installation qualification (IQ) and operational qualification (OQ) of heated ultrasonic tanks.',
        '3. Execute performance qualification (PQ) demonstrating 3 consecutive compliant production runs.',
        '4. Implement daily titration logging and copper sulfate test verification on every production lot.',
      ],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      refused: false,
    };
  }

  if (qLower.includes('green list') || qLower.includes('76-01') || qLower.includes('dwpe')) {
    return {
      query,
      answer:
        'Under FDA Import Alert 76-01, surgical instruments manufactured in Pakistan are subject to Detention Without Physical ' +
        'Examination (DWPE) unless the firm is explicitly listed on the Green List [S1]. Green List admission requires submitting ' +
        'a formal petition to FDA Division of Import Operations demonstrating an established Quality Management System compliant ' +
        'with 21 CFR Part 820 / QMSR and documented 5 consecutive non-violative commercial shipments.',
      citations: [
        {
          citation_id: 'S1',
          source_name: 'FDA Import Alert 76-01',
          cfr_section: 'FD&C Act §801(a)',
          statutory_basis: 'Detention Without Physical Examination of Medical Instruments from Pakistan',
        },
      ],
      sop_outline: [
        '1. Ensure active FDA establishment registration and device listings (FURLS).',
        '2. Conduct comprehensive ISO 13485:2016 / QMSR audit via accredited third party.',
        '3. Assemble 5 complete shipment dossiers with full material certs (ASTM F899) and passivation verification.',
        '4. Submit formal petition to FDA DIO at ImportsEnforcement@fda.hhs.gov.',
      ],
      disclaimer: MANDATORY_LEGAL_DISCLAIMER,
      refused: false,
    };
  }

  // Default response
  return {
    query,
    answer:
      'Medical device export to the United States requires compliance with FDA QMSR (21 CFR Part 820), proper device listing ' +
      'under 21 CFR 807, and complete technical documentation including raw material certificates per ASTM F899 [S1]. ' +
      'All compliance records must be maintained in the Device Master Record (DMR) and Device History Record (DHR).',
    citations: [
      {
        citation_id: 'S1',
        source_name: 'FDA QMSR & Medical Device Regulatory Scheme',
        cfr_section: '21 CFR Part 820',
        statutory_basis: 'Quality Management System Regulation',
      },
    ],
    sop_outline: [
      '1. Review applicable statutory requirements from the 25 Master Compliance Rules.',
      '2. Collect third-party or document-backed evidence in the Evidence Vault.',
      '3. Run order compliance evaluation before committing to shipment deadlines.',
    ],
    disclaimer: MANDATORY_LEGAL_DISCLAIMER,
    refused: false,
  };
}

module.exports = {
  matchBuyerConditions,
  inspectOcrDocument,
  queryRag,
  MANDATORY_LEGAL_DISCLAIMER,
};
