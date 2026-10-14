#!/usr/bin/env node
/**
 * ExportReady :: seed_rules.js
 * ---------------------------------------------------------------------------
 * Idempotently loads the master compliance rule catalogue into `rules`.
 *
 *   node seeds/seed_rules.js [--file <path/to/rules.json>] [--dry-run]
 *
 * Connection (first match wins):
 *   DATABASE_URL                                  e.g. postgres://user:pw@host:5432/exportready
 *   PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE   (standard libpq vars)
 * A `.env` file in database/ or the repo root is loaded if `dotenv` is installed.
 *
 * Upsert semantics (ON CONFLICT (rule_code) DO UPDATE):
 *   - New rule_code              -> INSERT, version = 1
 *   - Existing, content changed  -> UPDATE, version = version + 1
 *   - Existing, content same     -> untouched (no version bump, no write)
 *   - `active` is only overwritten when the JSON explicitly supplies it, so a
 *     rule deactivated by an admin is not silently re-activated by a re-seed.
 * The whole load runs in ONE transaction: all rules apply, or none do.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Optional .env support (dotenv is not a hard dependency)
for (const envPath of [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
]) {
  if (fs.existsSync(envPath)) {
    try {
      require('dotenv').config({ path: envPath });
    } catch (_) {
      /* dotenv not installed - rely on process environment */
    }
    break;
  }
}

const DEFAULT_RULES_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  'brain',
  '03_rules_knowledge_base',
  'rules_master_25.json'
);

const REQUIRED_STRING_FIELDS = ['rule_code', 'title', 'description'];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { file: DEFAULT_RULES_FILE, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file') args.file = path.resolve(argv[(i += 1)]);
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '-h' || argv[i] === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Load + validate
// ---------------------------------------------------------------------------
function loadRules(file) {
  if (!fs.existsSync(file)) throw new Error(`Rules file not found: ${file}`);
  let rules;
  try {
    rules = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${file}: ${err.message}`);
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('Rules file must contain a non-empty JSON array');
  }

  const seen = new Set();
  const errors = [];
  rules.forEach((r, idx) => {
    const where = `rules[${idx}]${r && r.rule_code ? ` (${r.rule_code})` : ''}`;
    if (typeof r !== 'object' || r === null) return errors.push(`${where}: not an object`);
    for (const f of REQUIRED_STRING_FIELDS) {
      if (typeof r[f] !== 'string' || r[f].trim() === '') errors.push(`${where}: "${f}" is required`);
    }
    if (typeof r.is_absolute !== 'boolean') errors.push(`${where}: "is_absolute" must be boolean`);
    if (!Number.isInteger(r.default_effort_days) || r.default_effort_days < 0) {
      errors.push(`${where}: "default_effort_days" must be a non-negative integer`);
    }
    if (r.active !== undefined && typeof r.active !== 'boolean') {
      errors.push(`${where}: "active" must be boolean when provided`);
    }
    if (r.metadata !== undefined && (typeof r.metadata !== 'object' || r.metadata === null)) {
      errors.push(`${where}: "metadata" must be an object when provided`);
    }
    if (r.rule_code) {
      if (seen.has(r.rule_code)) errors.push(`${where}: duplicate rule_code`);
      seen.add(r.rule_code);
    }
  });
  if (errors.length) throw new Error(`Rule validation failed:\n  - ${errors.join('\n  - ')}`);
  return rules;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------
const UPSERT_SQL = `
  INSERT INTO rules (
    rule_code, title, description, is_absolute, default_effort_days,
    fda_source_section, cfr_section, iso_clause_number, category, metadata, active
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, COALESCE($11::boolean, TRUE))
  ON CONFLICT (rule_code) DO UPDATE SET
    title               = EXCLUDED.title,
    description         = EXCLUDED.description,
    is_absolute         = EXCLUDED.is_absolute,
    default_effort_days = EXCLUDED.default_effort_days,
    fda_source_section  = EXCLUDED.fda_source_section,
    cfr_section         = EXCLUDED.cfr_section,
    iso_clause_number   = EXCLUDED.iso_clause_number,
    category            = EXCLUDED.category,
    metadata            = EXCLUDED.metadata,
    active              = COALESCE($11::boolean, rules.active),
    -- bump version only when substantive content changed (assessment_findings pin rule_version)
    version             = rules.version + 1
  WHERE (
    rules.title, rules.description, rules.is_absolute, rules.default_effort_days,
    rules.fda_source_section, rules.cfr_section, rules.iso_clause_number,
    rules.category, rules.metadata, rules.active
  ) IS DISTINCT FROM (
    EXCLUDED.title, EXCLUDED.description, EXCLUDED.is_absolute, EXCLUDED.default_effort_days,
    EXCLUDED.fda_source_section, EXCLUDED.cfr_section, EXCLUDED.iso_clause_number,
    EXCLUDED.category, EXCLUDED.metadata, COALESCE($11::boolean, rules.active)
  )
  RETURNING rule_code, version, (xmax = 0) AS inserted;
`;

function toParams(r) {
  return [
    r.rule_code.trim(),
    r.title.trim(),
    r.description.trim(),
    r.is_absolute,
    r.default_effort_days,
    r.fda_source_section ?? null,
    r.cfr_section ?? null,
    r.iso_clause_number ?? null,
    r.category ?? null,
    JSON.stringify(r.metadata ?? {}),
    r.active ?? null,
  ];
}

async function seedRules(pool, rules, { dryRun }) {
  const client = await pool.connect();
  const stats = { inserted: 0, updated: 0, unchanged: 0 };
  try {
    await client.query('BEGIN');
    for (const rule of rules) {
      const { rows } = await client.query(UPSERT_SQL, toParams(rule));
      if (rows.length === 0) {
        stats.unchanged += 1;
      } else if (rows[0].inserted) {
        stats.inserted += 1;
        console.log(`  + inserted  ${rule.rule_code}`);
      } else {
        stats.updated += 1;
        console.log(`  ~ updated   ${rule.rule_code} (now v${rows[0].version})`);
      }
    }
    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\nDry run: transaction rolled back, no changes persisted.');
    } else {
      await client.query('COMMIT');
    }
    return stats;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node seeds/seed_rules.js [--file <rules.json>] [--dry-run]');
    return;
  }

  const rules = loadRules(args.file);
  console.log(`Loaded ${rules.length} rules from ${args.file}`);

  const pool = new Pool(
    process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}
  );

  try {
    const stats = await seedRules(pool, rules, args);
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_absolute)::int AS absolute FROM rules WHERE active'
    );
    console.log(
      `\nDone. inserted=${stats.inserted} updated=${stats.updated} unchanged=${stats.unchanged}` +
        ` | active rules in DB: ${rows[0].total} (absolute: ${rows[0].absolute})`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err.message}`);
  if (err.code === '42P01') console.error('Hint: apply database/schema.sql first.');
  process.exitCode = 1;
});
