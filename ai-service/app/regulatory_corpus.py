"""Curated Public-Domain Regulatory Corpus for ExportReady RAG Copilot.
Includes:
- FDA Import Alert 76-01 (DWPE & Green List petition process)
- FDA QMSR 21 CFR Part 820 (incorporating ISO 13485:2016 by reference)
- Statutory references for ASTM F899, ASTM A967, ASTM F1089
- 21 CFR 801, 807, 830 (Establishment registration, device listing, UDI, GUDID)
- Standard Operating Procedure (SOP) blueprints for export compliance

COPYRIGHT COMPLIANCE: Public-domain US government statutes and team-authored
summaries only. No copyrighted ASTM or ISO standard prose is reproduced.
"""
from typing import List, Dict, Any

CORPUS_CHUNKS: List[Dict[str, Any]] = [
    {
        "id": "S1",
        "section_ref": "FDA Import Alert 76-01 (Green List)",
        "url": "https://www.accessdata.fda.gov/cms_ia/default.html",
        "title": "Import Alert 76-01: Detention Without Physical Examination (Pakistan)",
        "content": (
            "FDA Import Alert 76-01 mandates Detention Without Physical Examination (DWPE) "
            "for surgical and medical instruments exported from Pakistan unless the specific manufacturing "
            "establishment (exact legal entity name AND physical street address) is listed on the Green List. "
            "Green List status is non-transferable to subcontractors. Removal from DWPE requires a formal petition "
            "to FDA CDRH supported by an independent third-party QSR/QMSR audit report and verified material control."
        ),
        "rule_codes": ["ER-REG-001"],
        "sop_steps": [
            "Verify current firm name and exact physical street address against the official FDA Import Alert 76-01 Green List database.",
            "Obtain and archive a verified PDF/screenshot of the Green List entry along with the current retrieval date.",
            "Schedule an independent third-party audit against 21 CFR Part 820 / ISO 13485:2016 to support Green List maintenance or petitioning.",
            "Ensure all shipping documentation (commercial invoice, airway bill) reflects the exact firm name and address on the Green List."
        ]
    },
    {
        "id": "S2",
        "section_ref": "FD&C Act §510(i) & 21 CFR 807.20 / 807.40",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-807",
        "title": "FDA Establishment Registration, Device Listing, and US Agent",
        "content": (
            "Foreign manufacturers exporting medical devices to the United States must register their facility "
            "via FDA Unified Registration and Listing System (FURLS), list every exported device product code, "
            "designate an authorized U.S. Agent, and complete annual registration renewal between October 1 and "
            "December 31. Failure to register renders exported devices misbranded under FD&C Act §502(o)."
        ),
        "rule_codes": ["ER-REG-002"],
        "sop_steps": [
            "Log into FDA FURLS and verify active Establishment Identifier (FEI) and annual registration status.",
            "Confirm that every exported instrument product code (e.g. HRQ for manual surgical instruments) is listed.",
            "Validate active contractual appointment of the designated U.S. Agent and verify their current contact details.",
            "Archive the annual registration renewal confirmation letter in the compliance evidence vault."
        ]
    },
    {
        "id": "S3",
        "section_ref": "21 CFR 807.81 & 21 CFR 878.4800",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-878",
        "title": "Premarket Classification and 510(k) Status",
        "content": (
            "Under 21 CFR 878.4800, most non-powered manual surgical instruments for general use are Class I devices "
            "exempt from 510(k) premarket notification, subject to limitations on exemptions (21 CFR 878.9). "
            "Exempt status requires a documented rationale demonstrating that the instrument has no restricted indications, "
            "is not powered, and does not involve specialized endoscopic, ophthalmic, neurosurgical, or implant uses."
        ),
        "rule_codes": ["ER-REG-003"],
        "sop_steps": [
            "Verify product code in the FDA Product Classification Database to confirm Class I status and 510(k) exemption.",
            "Draft a 510(k) Exemption Justification Memo documenting intended use, non-powered general manual operation, and device specifications.",
            "For non-exempt instruments, obtain 510(k) clearance letter from FDA prior to export.",
            "Store exemption documentation or 510(k) clearance letter in the Device Master Record (DMR)."
        ]
    },
    {
        "id": "S4",
        "section_ref": "21 CFR Part 820 (QMSR) & ISO 13485:2016 cl. 5.6, 8.2.4",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820",
        "title": "FDA Quality Management System Regulation (QMSR) Internal Audits",
        "content": (
            "Effective February 2, 2026, the FDA Quality Management System Regulation (QMSR) directly incorporates "
            "ISO 13485:2016 by reference under 21 CFR 820.10. Internal audits (clause 8.2.4) must be conducted at planned "
            "intervals by independent, qualified auditors. Top management must review QMS adequacy at least annually (clause 5.6)."
        ),
        "rule_codes": ["ER-QMS-004"],
        "sop_steps": [
            "Establish an annual internal audit schedule covering all QMS processes and manufacturing work operations.",
            "Assign trained auditors independent of the specific operational area being evaluated.",
            "Document audit findings, log nonconformities, and verify corrective action implementation.",
            "Conduct executive Management Review meeting with documented inputs/outputs per ISO 13485 clause 5.6."
        ]
    },
    {
        "id": "S5",
        "section_ref": "21 CFR 820.50 / 820.80 & ASTM F899",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820",
        "title": "Raw Steel Mill Test Certificates (MTC) and Grade Control",
        "content": (
            "Under QMSR purchasing and acceptance controls (ISO 13485 cl. 7.4.3), raw stainless steel lots "
            "(AISI 410, 420A/B/C martensitic grades) must be accompanied by a Mill Test Certificate (EN 10204 Type 3.1 or 3.2). "
            "Chemical composition must comply with ASTM F899 limits (Chromium 11.5–13.5% for 410; 12.0–14.0% for 420). "
            "Austenitic stainless steels (e.g. AISI 304) cannot be hardened by heat treatment and are prohibited for cutting instruments."
        ),
        "rule_codes": ["ER-MAT-005", "ER-MAT-006", "ER-MAT-007"],
        "sop_steps": [
            "Require steel suppliers to provide EN 10204 Type 3.1 chemical and mechanical inspection certificates with each heat.",
            "Verify that Chromium content is between 12.0% and 14.0% for AISI 420 or 11.5% and 13.5% for AISI 410 per ASTM F899.",
            "Perform incoming Positive Material Identification (PMI via XRF/spectroscopy) on representative samples.",
            "Quarantine and reject any austenitic steel (e.g. AISI 304) designated for surgical cutting tools."
        ]
    },
    {
        "id": "S6",
        "section_ref": "21 CFR 820.75 & ASTM A967/A967M, ASTM F1089",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820",
        "title": "Passivation Validation and Corrosion Testing",
        "content": (
            "Chemical passivation (nitric or citric acid per ASTM A967) restores the corrosion-resistant chromium oxide layer. "
            "Passivation baths must be monitored for acid concentration and temperature. Each production lot must pass "
            "corrosion resistance testing: the copper sulfate test (ASTM A967 Practice D for free iron detection) and "
            "the boil test (ASTM F1089 / ISO 13402 in distilled water) without rust or staining."
        ),
        "rule_codes": ["ER-PAS-009", "ER-PAS-010", "ER-PAS-011", "ER-PAS-012"],
        "sop_steps": [
            "Validate passivation process parameters (immersion time, temperature, bath chemistry) per ASTM A967.",
            "Conduct daily or per-batch titration logs of nitric/citric acid baths and monitor rinse water conductivity.",
            "Test finished parts with acidified copper sulfate solution (Practice D) to ensure absence of free iron plating.",
            "Execute boil test per ASTM F1089 on sample units from every lot; document inspection results in the DHR."
        ]
    },
    {
        "id": "S7",
        "section_ref": "21 CFR 820.181 / 820.184 & ISO 13485 cl. 4.2.3, 7.5.9",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820",
        "title": "Device Master Record (DMR) and Device History Record (DHR)",
        "content": (
            "The factory must maintain a Device Master Record (Medical Device File) containing engineering drawings, "
            "material specifications, and passivation parameters. For each batch, a Device History Record (DHR) must be compiled "
            "documenting manufacturing dates, quantity released, acceptance records, label samples, and full traceability "
            "linking finished lot numbers back to the raw steel heat number."
        ),
        "rule_codes": ["ER-DOC-013", "ER-DOC-014", "ER-DOC-015", "ER-DOC-016"],
        "sop_steps": [
            "Establish controlled Device Master Record (DMR) for each surgical instrument product code.",
            "Maintain Batch Travellers (DHR) traveling with the physical lot through forging, grinding, heat treat, and passivation.",
            "Record raw steel heat number and furnace batch ID on the DHR traveler.",
            "Archive completed DHRs and test logs for a minimum of 2 years post commercial distribution."
        ]
    },
    {
        "id": "S8",
        "section_ref": "21 CFR 801.20, 801.45, & 21 CFR 830",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-830",
        "title": "Unique Device Identifier (UDI), Direct Part Marking, and GUDID",
        "content": (
            "Exported medical devices must bear a Unique Device Identifier (UDI) in plain text and AIDC (barcode/DataMatrix) format. "
            "Under 21 CFR 801.45, reusable surgical instruments requiring reprocessing between uses must bear permanent direct part marking "
            "(laser etching or electrochemical mark) that withstands repeated autoclaving. Device Identification (DI) records "
            "must be published in FDA's Global Unique Device Identification Database (GUDID)."
        ),
        "rule_codes": ["ER-UDI-020", "ER-UDI-021", "ER-UDI-022"],
        "sop_steps": [
            "Acquire GS1 or HIBCC company prefix and generate Device Identifiers (DI) and Production Identifiers (PI).",
            "Validate laser marking parameters to ensure permanent direct marking legibility after repeated autoclave cycles.",
            "Verify barcode readability and grading (ISO/IEC 15415/15416) on finished unit packages.",
            "Publish device records to FDA GUDID via Web Interface or HL7 SPL before U.S. commercial distribution."
        ]
    },
    {
        "id": "S9",
        "section_ref": "21 CFR 820.72 & ISO 13485 cl. 7.6 / ISO/IEC 17025",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820",
        "title": "Calibration System and Standards Traceability",
        "content": (
            "All inspection, measuring, and test equipment (micrometers, vernier calipers, hardness testers, furnace pyrometers, "
            "and PMI spectrometers) must be routinely calibrated against reference standards traceable to national or "
            "international standards (e.g. NIST). Calibration laboratories must hold ISO/IEC 17025 accreditation."
        ),
        "rule_codes": ["ER-CAL-018", "ER-CAL-019"],
        "sop_steps": [
            "Maintain a master calibration register with unique equipment IDs, tolerance limits, and recalibration intervals.",
            "Apply tamper-evident calibration status labels showing last calibration date and next due date.",
            "Contract only ISO/IEC 17025 accredited calibration laboratories for reference standards and master gauge blocks.",
            "Conduct out-of-tolerance impact assessments whenever a gauge fails recalibration."
        ]
    },
    {
        "id": "S10",
        "section_ref": "21 CFR 820.100 & ISO 13485 cl. 8.5.2, 8.5.3",
        "url": "https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820",
        "title": "Corrective and Preventive Action (CAPA) and Nonconforming Product",
        "content": (
            "The factory must maintain documented procedures for identifying, segregating, and dispositioning nonconforming product. "
            "Recurring testing failures (such as failed copper sulfate or boil tests), calibration discrepancies, or audit findings "
            "must trigger formal CAPA investigations including root-cause determination and verification of corrective action effectiveness."
        ),
        "rule_codes": ["ER-CAPA-025", "ER-DOC-017"],
        "sop_steps": [
            "Immediately segregate nonconforming parts in a designated physical quarantine area with red quarantine tags.",
            "Log a Nonconformance Report (NCR) documenting defect details, affected lot size, and disposition decision.",
            "Initiate a CAPA investigation for repeat defects, identifying root cause (e.g., bath contamination, inadequate rinse).",
            "Verify effectiveness of corrective actions prior to formal CAPA closure and review trends in Management Review."
        ]
    }
]
