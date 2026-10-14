# Rules ↔ Statutory Mapping

Generated from [rules_master_25.json](rules_master_25.json) (the machine-readable source seeded into the `rules` table by
`database/seeds/seed_rules.js`). If the JSON changes, regenerate/update this table in the same turn.

- **Rules:** 25 — **absolute:** 3 (ER-REG-001, ER-REG-002, ER-REG-003)
- **Sum of default effort if every rule were a full gap:** 722 days
- **Categories:** regulatory_status (3), quality_management (1), raw_material (4), passivation (4), documentation_records (5), calibration (2), udi_labeling (3), cleaning_bioburden (2), capa (1)

**QMSR note.** From 2 Feb 2026 FDA's QMSR incorporates ISO 13485:2016 by reference in 21 CFR 820.10. Many rules cite legacy QSR
sections (e.g. 820.50, 820.75); the `qmsr_note` in each rule's metadata records the ISO 13485 clause that now carries the
requirement. Citations are pointers to official sources — see [REGULATORY_SOURCES_DIR.md](REGULATORY_SOURCES_DIR.md).

## Master table

| Code | Title | Category | Absolute | Effort (days) | CFR | ISO 13485 cl. | FDA / statutory source |
|---|---|---|---|---|---|---|---|
| ER-REG-001 | FDA Import Alert 76-01 Green List Status | regulatory_status | **YES** | 180 | 21 CFR Part 820 (cGMP/QMSR compliance basis for Green List admission) | 4.1.1 | FDA Import Alert 76-01 (Green List); FD&C Act §801(a) [21 U.S.C. 381(a)] |
| ER-REG-002 | FDA Establishment Registration, Device Listing and US Agent | regulatory_status | **YES** | 14 | 21 CFR 807.20; 21 CFR 807.40 | 4.1.1 | FD&C Act §510(i) [21 U.S.C. 360(i)] |
| ER-REG-003 | Premarket Classification and 510(k) Status of Exported Device | regulatory_status | **YES** | 30 | 21 CFR 807.81; 21 CFR 878.4800 (manual surgical instrument for general use); 21 CFR 807.100 | 7.2.1 | FD&C Act §510(k) [21 U.S.C. 360(k)]; FD&C Act §513 [21 U.S.C. 360c] |
| ER-QMS-004 | Internal Quality Audit and Management Review | quality_management | no | 30 | 21 CFR 820.22; 21 CFR 820.20(c) | 8.2.4; 5.6 | FD&C Act §501(h) [21 U.S.C. 351(h)]; FDA Quality System Inspection Technique (QSIT) |
| ER-MAT-005 | Raw Steel Mill Test Certificates per Heat/Lot (AISI 410 / 420) | raw_material | no | 5 | 21 CFR 820.50(b); 21 CFR 820.80(b) | 7.4.3 | Import Alert 76-01 (steel chemistry/chromium variability rationale); FD&C Act §501(h) |
| ER-MAT-006 | Incoming Steel Grade Verification (PMI / Spectrometric Analysis) | raw_material | no | 10 | 21 CFR 820.80(b); 21 CFR 820.86 | 7.4.3; 8.2.6 | Import Alert 76-01 (steel chemistry/chromium variability rationale) |
| ER-MAT-007 | Heat Treatment and Rockwell Hardness Verification | raw_material | no | 14 | 21 CFR 820.75; 21 CFR 820.80(c)-(d) | 7.5.6; 8.2.6 | FD&C Act §501(h); Import Alert 76-01 (Green List audit scope) |
| ER-MAT-008 | Approved Supplier Evaluation and Purchasing Controls | raw_material | no | 30 | 21 CFR 820.50(a)-(b) | 7.4.1; 4.1.5 | FD&C Act §501(h); FDA QSIT Purchasing Controls subsystem |
| ER-PAS-009 | Passivation Process Validation | passivation | no | 45 | 21 CFR 820.75(a)-(c) | 7.5.6 | FD&C Act §501(h); FDA Guidance 'Quality System Regulation Process Validation' / GHTF SG3 N99-10 |
| ER-PAS-010 | Passivation Bath Chemistry and Environmental Controls | passivation | no | 14 | 21 CFR 820.70(a); 21 CFR 820.70(c); 21 CFR 820.70(h) | 7.5.1; 6.4.1 | FD&C Act §501(h) |
| ER-PAS-011 | Corrosion Resistance Boil Test | passivation | no | 7 | 21 CFR 820.80(d); 21 CFR 820.90 | 8.2.6; 8.3.1 | Import Alert 76-01 (Green List audit scope); FD&C Act §501(h) |
| ER-PAS-012 | Copper Sulfate Test for Free Iron on Passivated Parts | passivation | no | 7 | 21 CFR 820.80(c)-(d); 21 CFR 820.75(b) | 7.5.6; 8.2.6 | Import Alert 76-01 (Green List audit scope); FD&C Act §501(h) |
| ER-DOC-013 | Device Master Record (DMR) / Medical Device File | documentation_records | no | 60 | 21 CFR 820.181 | 4.2.3 | FD&C Act §501(h) [21 U.S.C. 351(h)]; Import Alert 76-01 (Green List audit scope) |
| ER-DOC-014 | Device History Record (DHR) and Batch/Lot Traceability | documentation_records | no | 30 | 21 CFR 820.184; 21 CFR 820.65 | 7.5.9 | FD&C Act §501(h); Import Alert 76-01 (Green List audit scope) |
| ER-DOC-015 | Document Control and Change Management | documentation_records | no | 21 | 21 CFR 820.40 | 4.2.4 | FD&C Act §501(h) |
| ER-DOC-016 | Quality Records Retention and Control | documentation_records | no | 14 | 21 CFR 820.180 | 4.2.5 | FD&C Act §501(h) |
| ER-DOC-017 | Nonconforming Product Control | documentation_records | no | 14 | 21 CFR 820.90 | 8.3.1; 8.3.2 | FD&C Act §501(h) |
| ER-CAL-018 | Calibration System for Inspection, Measuring and Test Equipment | calibration | no | 21 | 21 CFR 820.72(a)-(b) | 7.6 | FD&C Act §501(h); FDA QSIT Production and Process Controls |
| ER-CAL-019 | Calibration Traceability to National/International Standards | calibration | no | 14 | 21 CFR 820.72(b)(2) | 7.6 | FD&C Act §501(h) |
| ER-UDI-020 | UDI on Device Label and Package | udi_labeling | no | 21 | 21 CFR 801.20; 21 CFR 830.20; 21 CFR 801.40; 21 CFR 801.18 | 7.5.8 | FD&C Act §519(f) [21 U.S.C. 360i(f)]; UDI Final Rule (78 FR 58786) |
| ER-UDI-021 | Direct Part Marking of Reusable Instruments | udi_labeling | no | 30 | 21 CFR 801.45; 21 CFR 801.35 | 7.5.8 | FD&C Act §519(f); UDI Final Rule (78 FR 58786) |
| ER-UDI-022 | GUDID Data Submission | udi_labeling | no | 21 | 21 CFR 830.300; 21 CFR 830.310; 21 CFR 830.320 | 7.5.8 | FD&C Act §519(f); FDA GUDID Guidance |
| ER-CLN-023 | Cleaning Process Validation and Product Cleanliness | cleaning_bioburden | no | 30 | 21 CFR 820.70(e); 21 CFR 820.75(a) | 7.5.2; 7.5.6 | FD&C Act §501(h) |
| ER-CLN-024 | Bioburden and Contamination Control | cleaning_bioburden | no | 30 | 21 CFR 820.70(d)-(e); 21 CFR 801.5 | 6.4.2; 7.5.2 | FD&C Act §501(h); FDA Guidance 'Reprocessing Medical Devices in Health Care Settings: Validation Methods and Labeling' (2015) |
| ER-CAPA-025 | Corrective and Preventive Action (CAPA) System | capa | no | 30 | 21 CFR 820.100(a)-(b) | 8.5.2; 8.5.3 | FD&C Act §501(h); FDA QSIT CAPA subsystem |

## ASTM / other standard references (from rule metadata)

| Code | Reference |
|---|---|
| ER-MAT-005 | ASTM F899 (Wrought Stainless Steels for Surgical Instruments); EN 10204:2004 Type 3.1 |
| ER-MAT-006 | ASTM F899; ASTM E572 (XRF analysis of stainless steel) |
| ER-MAT-007 | ASTM F899; ASTM E18 (Rockwell Hardness of Metallic Materials); ISO 7153-1 |
| ER-MAT-008 | ASTM F899 |
| ER-PAS-009 | ASTM A967/A967M (Chemical Passivation Treatments for Stainless Steel Parts); ASTM A380/A380M (Cleaning, Descaling and Passivation) |
| ER-PAS-010 | ASTM A967/A967M; ASTM A380/A380M |
| ER-PAS-011 | ASTM F1089 (Corrosion of Surgical Instruments - boil test); ASTM A967/A967M; ISO 13402 / ISO 7153-1 corrosion resistance |
| ER-PAS-012 | ASTM A967/A967M Practice D (Copper Sulfate Test); ASTM F1089 |
| ER-DOC-013 | ASTM F899 (material spec referenced in DMR) |
| ER-DOC-014 | ASTM F899 |
| ER-CAL-018 | ASTM E18 (hardness tester verification) |
| ER-CAL-019 | ISO/IEC 17025:2017 (calibration laboratory competence) |
| ER-UDI-021 | ASTM A967/A967M (post-marking passivation to protect corrosion resistance of marked areas) |
| ER-CLN-023 | ASTM A380/A380M (Cleaning and Descaling of Stainless Steel Parts); ASTM A967/A967M |
| ER-CLN-024 | ISO 11737-1 (bioburden determination); ISO 17664 (reprocessing information) |

## Engine semantics

- `is_absolute = true` → an unmet rule yields **BLOCKER** (otherwise **GAP**). See [DECISION_ENGINE_SPEC.md](../04_engine_and_algorithms/DECISION_ENGINE_SPEC.md).
- `default_effort_days` → `assigned_effort_days` for GAP/BLOCKER findings. See [TIME_FEASIBILITY_SPEC.md](../04_engine_and_algorithms/TIME_FEASIBILITY_SPEC.md).
- `version` is bumped by the seed script on substantive change; findings pin it.
