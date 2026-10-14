"""Comprehensive test suite for ExportReady AI Service.
Covers:
- /health endpoint
- Contract clause segmentation and NLP condition matcher
- OCR MTC inspector (valid AISI 420 + ASTM F899, and AISI 304 discrepancy alert)
- RAG copilot grounded statutory guidance, SOP generation, and guardrail refusal
"""
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.config import MANDATORY_LEGAL_DISCLAIMER
from app.nlp_matcher import split_contract_clauses, match_buyer_conditions
from app.ocr_inspector import inspect_document
from app.rag_copilot import query_rag_copilot

client = TestClient(app)


# --- 1. Health and Rules Synced Test ---

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "exportready-ai-service"
    assert data["active_rules_count"] == 25
    assert data["rules_file_synced"] is True


# --- 2. Contract Clause Segmentation Tests ---

def test_split_contract_clauses_handles_clause_numbers_and_semicolons():
    contract_text = (
        "1. Material Specification: Raw steel bar stock must be AISI 420 martensitic steel per ASTM F899; "
        "2. All instruments shall undergo chemical passivation per ASTM A967 (citric or nitric acid) and copper sulfate testing; "
        "3. Traceability per 21 CFR 820.75 and ISO 13485:2016 clause 4.2.3 must be maintained in the Device History Record; "
        "4. Devices must bear a permanent UDI barcode (e.g. DataMatrix) as required by 21 CFR 801.45."
    )
    clauses = split_contract_clauses(contract_text)
    assert len(clauses) >= 4

    # Verify decimal section numbers were NOT broken (4.2.3, 820.75, 801.45)
    full_text = " ".join(clauses)
    assert "4.2.3" in full_text
    assert "820.75" in full_text
    assert "801.45" in full_text
    assert "e.g." in full_text or "e.g" in full_text


# --- 3. NLP Buyer Condition Matcher Tests ---

def test_nlp_matcher_detects_target_rules():
    contract = (
        "All surgical scissors must be manufactured from martensitic AISI 420 stainless steel and accompanied by a Mill Test Certificate (EN 10204 Type 3.1) per heat number. "
        "Passivation of finished instruments shall be performed in accordance with ASTM A967 and verified with copper sulfate testing for free iron. "
        "Each device and package must carry a Unique Device Identifier (UDI) barcode, and GUDID registration must be completed. "
        "A complete Device History Record (DHR) linking finished lots to raw steel heats must be maintained."
    )

    candidates = match_buyer_conditions(contract, threshold=0.60)
    assert len(candidates) > 0

    rule_codes = {c["rule_code"] for c in candidates}

    # Verify target statutory rules are matched with high confidence
    assert "ER-MAT-005" in rule_codes or "ER-MAT-006" in rule_codes
    assert "ER-PAS-009" in rule_codes or "ER-PAS-012" in rule_codes
    assert "ER-UDI-020" in rule_codes or "ER-UDI-022" in rule_codes
    assert "ER-DOC-014" in rule_codes

    # Verify confirmation requirement
    for c in candidates:
        assert c["confirmed_by_user"] is False
        assert c["requires_human_confirmation"] is True
        assert c["score"] >= 0.60
        assert len(c["sentence"]) > 0


def test_nlp_endpoint_canonical_and_alias():
    payload = {
        "text": "Every shipment shall include Mill Test Certificates with positive material identification per ASTM F899.",
        "threshold": 0.60
    }
    # Test canonical /nlp/match-conditions
    r1 = client.post("/nlp/match-conditions", json=payload)
    assert r1.status_code == 200
    data1 = r1.json()
    assert "candidates" in data1
    assert any(c["rule_code"] in ("ER-MAT-005", "ER-MAT-006") for c in data1["candidates"])

    # Test alias /nlp/match
    r2 = client.post("/nlp/match", json=payload)
    assert r2.status_code == 200
    data2 = r2.json()
    assert len(data2["candidates"]) == len(data1["candidates"])


# --- 4. OCR Document Inspector Tests ---

def test_ocr_inspector_valid_aisi_420_certificate():
    valid_mtc_text = """
    CENTRAL STEEL MILLS LTD.
    INSPECTION CERTIFICATE EN 10204 3.1
    Heat Number: HT-99421
    Grade / Material: AISI 420B Martensitic Stainless Steel
    Standard: ASTM F899 / ISO 7153-1
    Date of Issue: 2026-03-01
    Expiry Date: 2027-03-01
    Chemical Analysis:
    C: 0.33%   Cr: 13.2%   Mn: 0.55%   Si: 0.45%   P: 0.02%   S: 0.01%
    Mechanical: Hardness 52 HRC
    Result: Conforms to ASTM F899
    """

    res = inspect_document(
        text_content=valid_mtc_text,
        declared_grade="AISI 420",
        evaluation_date="2026-09-01"
    )

    assert res["discrepancy_alert"] is False
    assert res["fields"]["material_grade"]["value"] in ("AISI 420B", "AISI 420")
    assert res["fields"]["heat_lot_number"]["value"] == "HT-99421"
    assert res["fields"]["testing_standard"]["value"] in ("ASTM F899", "EN 10204 3.1")
    assert res["fields"]["issue_date"]["value"] == "2026-03-01"
    assert res["fields"]["expiry_date"]["value"] == "2027-03-01"
    assert res["suggested_proof_grade"] == "document_backed"
    assert res["requires_human_confirmation"] is True

    # No grade mismatch flag
    flag_codes = [f["code"] for f in res["flags"]]
    assert "GRADE_MISMATCH" not in flag_codes
    assert "CERTIFICATE_EXPIRED" not in flag_codes


def test_ocr_inspector_flags_aisi_304_discrepancy():
    invalid_mtc_text = """
    ALLOY METALS CORP
    MILL TEST CERTIFICATE
    Heat No: HT-30401
    Material Grade: AISI 304 Austenitic Stainless Steel
    Standard: ASTM A240
    Date: 2026-02-15
    Expiry Date: 2027-02-15
    Composition:
    C: 0.05%   Cr: 18.2%   Ni: 8.4%
    Application: Surgical cutting scissors
    """

    res = inspect_document(
        text_content=invalid_mtc_text,
        declared_grade="AISI 420",
        evaluation_date="2026-06-01"
    )

    # Must raise discrepancy alert
    assert res["discrepancy_alert"] is True
    flag_codes = [f["code"] for f in res["flags"]]
    assert "GRADE_MISMATCH" in flag_codes

    # Message must explain ASTM F899 cutting instrument incompatibility
    mismatch_flag = next(f for f in res["flags"] if f["code"] == "GRADE_MISMATCH")
    assert "304" in mismatch_flag["message"]
    assert "ASTM F899" in mismatch_flag["message"]


def test_ocr_inspector_flags_expired_certificate():
    expired_mtc = """
    ACME LABS INC
    PASSIVATION TEST REPORT
    Standard: ASTM A967
    Grade: AISI 420
    Heat: H-4411
    Date: 2024-01-01
    Expiry Date: 2025-01-01
    """

    res = inspect_document(
        text_content=expired_mtc,
        declared_grade="AISI 420",
        evaluation_date="2026-01-01"
    )

    assert res["discrepancy_alert"] is True
    flag_codes = [f["code"] for f in res["flags"]]
    assert "CERTIFICATE_EXPIRED" in flag_codes


def test_ocr_endpoint_multipart_and_json():
    sample_text = "Heat Number: H-12345\nGrade: AISI 420\nStandard: ASTM F899\nDate: 2026-05-01\nExpiry: 2027-05-01\nCr: 13.0%"

    # Multipart form upload
    resp = client.post(
        "/ocr/inspect-document",
        data={"text_content": sample_text, "declared_grade": "AISI 420"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["fields"]["heat_lot_number"]["value"] == "H-12345"
    assert data["fields"]["material_grade"]["value"] == "AISI 420"
    assert data["discrepancy_alert"] is False

    # JSON endpoint
    resp2 = client.post(
        "/ocr/inspect-json",
        json={"text_content": sample_text, "declared_grade": "AISI 420"}
    )
    assert resp2.status_code == 200
    assert resp2.json()["fields"]["heat_lot_number"]["value"] == "H-12345"


# --- 5. RAG Compliance Copilot Tests ---

def test_rag_copilot_grounded_response_with_citations_and_sop():
    query = "What are the requirements for FDA Import Alert 76-01 Green List petition?"
    res = query_rag_copilot(query)

    assert res["refused"] is False
    assert len(res["citations"]) > 0
    assert any("76-01" in c["section_ref"] or "76-01" in c["title"] for c in res["citations"])
    assert "[S" in res["answer"]  # Inline citation markers
    assert len(res["sop_outline"]) > 0
    assert res["disclaimer"] == MANDATORY_LEGAL_DISCLAIMER


def test_rag_copilot_refuses_speculative_legal_advice():
    speculative_query = "Will FDA seize my shipment if I don't have Green List status and how can I bypass customs inspection?"
    res = query_rag_copilot(speculative_query)

    # Must refuse per guardrails
    assert res["refused"] is True
    assert "I can't answer that from the official sources I have" in res["answer"]
    assert res["citations"] == []
    assert res["sop_outline"] == []
    assert res["disclaimer"] == MANDATORY_LEGAL_DISCLAIMER


def test_rag_endpoint_canonical_and_alias():
    payload = {"question": "What standard governs surgical stainless steel chemical composition?"}

    # Test /rag/query
    r1 = client.post("/rag/query", json=payload)
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["refused"] is False
    assert any("F899" in c["section_ref"] or "F899" in c["title"] for c in data1["citations"])
    assert data1["disclaimer"] == MANDATORY_LEGAL_DISCLAIMER

    # Test /rag/ask
    r2 = client.post("/rag/ask", json=payload)
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["refused"] is False
    assert data2["citations"][0]["id"] == data1["citations"][0]["id"]
