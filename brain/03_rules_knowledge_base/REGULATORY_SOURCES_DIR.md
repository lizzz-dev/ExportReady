# Regulatory Sources Directory

Official sources behind the 25 rules. **Link-status column:** `confirmed` = URL pattern known to be stable official
eCFR/FDA/ASTM landing; `verify` = deep link not re-checked in this build — confirm before submitting the thesis.
Last reviewed: authoring of V2 (re-check retrieval dates when citing).

## 1. FDA

| Source | Used by | URL | Status |
|---|---|---|---|
| FDA Import Alerts database (search "76-01") | ER-REG-001 | https://www.accessdata.fda.gov/cms_ia/default.html | confirmed (HTTP 200) |
| Import Alert 76-01 — Detention Without Physical Examination of Surgical/Medical Instruments from Pakistan (incl. Green List) | ER-REG-001 | Open via the Import Alerts database above | verify |
| QMSR final rule — 89 FR 7496 (2 Feb 2024); effective 2 Feb 2026 | all QMS rules | https://www.federalregister.gov (search "Quality Management System Regulation") | verify |
| FDA QMSR information page | all QMS rules | https://www.fda.gov/medical-devices (search "QMSR") | verify |
| Establishment registration & device listing | ER-REG-002 | https://www.fda.gov/medical-devices/how-study-and-market-your-device/device-registration-and-listing | verify |
| Product classification database | ER-REG-003 | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpcd/classification.cfm | verify |
| GUDID / AccessGUDID | ER-UDI-020…022 | https://accessgudid.nlm.nih.gov | confirmed (HTTP 200) |
| openFDA Device APIs | possible lookups | https://open.fda.gov/apis/device/ | confirmed |
| FDA reprocessing guidance (2015) | ER-CLN-024 | search FDA guidance "Reprocessing Medical Devices in Health Care Settings" | verify |

## 2. eCFR (21 CFR)

| Part | Used by | URL | Status |
|---|---|---|---|
| Part 820 (QSR / QMSR) | most rules | https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820 | confirmed |
| Part 807 (registration, 510(k)) | ER-REG-002, 003 | https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-807 | confirmed |
| Part 801 (labeling, UDI) | ER-UDI-020, 021, ER-CLN-024 | https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-801 | confirmed |
| Part 830 (UDI, GUDID) | ER-UDI-020…022 | https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-830 | confirmed |
| §878.4800 (manual surgical instrument) | ER-REG-003 | https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-878 | confirmed (part level) |

## 3. Standards (paid — cite, do not reproduce)

| Standard | Used by | Where |
|---|---|---|
| ASTM F899 — Wrought Stainless Steels for Surgical Instruments | ER-MAT-005…008, ER-DOC-013/014 | https://www.astm.org (search F899) |
| ASTM A967/A967M — Chemical Passivation Treatments | ER-PAS-009…012, ER-CLN-023 | https://www.astm.org (search A967) |
| ASTM A380/A380M — Cleaning, Descaling, Passivation | ER-PAS, ER-CLN | https://www.astm.org |
| ASTM F1089 — Corrosion of Surgical Instruments | ER-PAS-011/012 | https://www.astm.org |
| ASTM E18 — Rockwell Hardness; E572 — XRF of stainless steel | ER-MAT-006/007, ER-CAL-018 | https://www.astm.org |
| ISO 13485:2016 | all (via QMSR) | https://www.iso.org/standard/59752.html |
| ISO/IEC 17025:2017 | ER-CAL-019 | https://www.iso.org/standard/66912.html |
| ISO 11737-1, ISO 17664, ISO 7153-1, ISO 13402, EN 10204 | respective rules | https://www.iso.org / CEN |

## 4. Copyright & compliance rules for this project

1. **US federal regulations (CFR, FDA guidance, Import Alerts) are public domain** — may be quoted with attribution and retrieval date.
2. **ASTM and ISO standards are copyrighted.** The repository and RAG corpus must contain **only**: standard designation, title, scope-level paraphrase written by the team, and numeric limits already embedded in rule metadata *as references to be validated by the user against their licensed copy*. **Never** paste standard text, tables or figures.
3. The RAG Copilot must not ingest purchased standards; its corpus is limited to public-domain/government sources and team-authored summaries.
4. Every rule keeps its citation (`cfr_section`, `iso_clause_number`, `fda_source_section`, `metadata.astm_reference`) so users can consult the originals.
5. Display retrieval dates for any Import Alert/Green List information; it changes without notice.
6. The system does not reproduce the Green List itself; users record their own verified entry as evidence for ER-REG-001.
