"""OCR Document Inspector (F4)
Spec: brain/05_ai_and_nlp_pipelines/OCR_DOCUMENT_INSPECTOR.md

Extracts and parses Mill Test Certificates (MTC) and quality testing certificates.
Validates steel grade chemistry, checks ASTM F899 martensitic requirements,
detects AISI 304 vs 420 discrepancy, and prepares structured fields for Assisted Review.
"""
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, date
import uuid
import re
import io

# Recognized stainless steel grades
MARTENSITIC_GRADES = ["AISI 420", "AISI 420A", "AISI 420B", "AISI 420C", "AISI 410", "AISI 440A", "AISI 440C", "17-4PH"]
AUSTENITIC_GRADES = ["AISI 304", "AISI 304L", "AISI 316", "AISI 316L", "1.4301"]
ALL_GRADES = MARTENSITIC_GRADES + AUSTENITIC_GRADES

# Recognized standards
RECOGNIZED_STANDARDS = [
    "ASTM F899", "ASTM A967", "ASTM A967/A967M", "ASTM F1089", "ASTM A380",
    "ISO 7153-1", "ISO 13485", "EN 10204 TYPE 3.1", "EN 10204 3.1", "EN 10204 TYPE 3.2",
    "EN 10204 3.2", "EN 10204", "ISO/IEC 17025"
]

# Date patterns
DATE_REGEX_LIST = [
    r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b",           # YYYY-MM-DD
    r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b",           # DD-MM-YYYY or MM-DD-YYYY
    r"\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})\b",
    r"\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[\s,]+\d{4})\b"
]


def extract_text_from_bytes(file_bytes: bytes, filename: str = "") -> str:
    """Extracts raw text from PDF or image bytes with graceful library fallbacks."""
    if not file_bytes:
        return ""

    filename_lower = filename.lower()

    # Try PDF extraction via pdfplumber
    if filename_lower.endswith(".pdf") or file_bytes.startswith(b"%PDF"):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages_text = [page.extract_text() or "" for page in pdf.pages]
                full_text = "\n".join(pages_text).strip()
                if full_text:
                    return full_text
        except Exception:
            pass

        # Fallback PDF text stream scan
        try:
            raw_decoded = file_bytes.decode("latin1", errors="ignore")
            matches = re.findall(r"\(([^\(\)]{3,100})\)\s*Tj", raw_decoded)
            if matches:
                return " ".join(matches)
        except Exception:
            pass

    # Try Image extraction via pytesseract
    try:
        from PIL import Image
        import pytesseract
        image = Image.open(io.BytesIO(file_bytes))
        ocr_text = pytesseract.image_to_string(image)
        if ocr_text.strip():
            return ocr_text
    except Exception:
        pass

    # Fallback: try utf-8 / latin-1 decode
    try:
        return file_bytes.decode("utf-8", errors="ignore")
    except Exception:
        return file_bytes.decode("latin-1", errors="ignore")


def parse_date_string(date_str: str) -> Optional[date]:
    """Parses various date formats to a standard date object."""
    clean = date_str.strip().replace(",", " ")
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
                "%d %b %Y", "%d %B %Y", "%b %d %Y", "%B %d %Y"):
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue
    return None


def parse_certificate_text(text: str) -> Dict[str, Any]:
    """Parses key attributes and chemical composition from certificate text."""
    fields: Dict[str, Any] = {}

    # 1. Material grade
    grade_val = None
    grade_conf = 0.0
    for grade in ["AISI 420B", "AISI 420A", "AISI 420C", "AISI 420", "AISI 410", "AISI 440C", "17-4PH", "AISI 316L", "AISI 304L", "AISI 304", "AISI 316", "304", "420", "410"]:
        pattern = rf"\b(?:grade|type|material|steel|aisi|sus|din)?\s*[:#-]?\s*({re.escape(grade)})\b"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            raw_grade = match.group(1).upper()
            if not raw_grade.startswith("AISI") and raw_grade in ("420", "410", "304", "316"):
                raw_grade = f"AISI {raw_grade}"
            grade_val = raw_grade
            grade_conf = 0.95
            break

    if not grade_val:
        # Fallback loose search for 420/410/304
        loose = re.search(r"\b(420[A-C]?|410|304L?|316L?)\b", text, re.IGNORECASE)
        if loose:
            val = loose.group(1).upper()
            grade_val = f"AISI {val}" if not val.startswith("AISI") else val
            grade_conf = 0.80

    fields["material_grade"] = {"value": grade_val, "confidence": grade_conf}

    # 2. Heat / Lot number
    heat_match = re.search(r"\b(?:heat|lot|batch|melt|charge)\s*(?:no|number|#)?\s*[:.-]?\s*([A-Z0-9\-_]{3,20})\b", text, re.IGNORECASE)
    if heat_match:
        fields["heat_lot_number"] = {"value": heat_match.group(1), "confidence": 0.92}
    else:
        fields["heat_lot_number"] = {"value": None, "confidence": 0.0}

    # 3. Testing Standard
    std_val = None
    std_conf = 0.0
    for std in RECOGNIZED_STANDARDS:
        if re.search(rf"\b{re.escape(std)}\b", text, re.IGNORECASE):
            std_val = std
            std_conf = 0.94
            break
    fields["testing_standard"] = {"value": std_val, "confidence": std_conf}

    # 4. Dates
    found_dates = []
    for pattern in DATE_REGEX_LIST:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            d_str = match.group(1)
            parsed_d = parse_date_string(d_str)
            if parsed_d:
                found_dates.append((parsed_d, match.start()))

    # Sort found dates by occurrence
    found_dates.sort(key=lambda x: x[1])

    issue_date_val = None
    expiry_date_val = None

    # Check for explicit 'issue date' or 'date of issue'
    issue_match = re.search(r"(?:issue\s*date|date\s*of\s*issue|dated|certificate\s*date)\s*[:.-]?\s*([^\n\r,]{6,25})", text, re.IGNORECASE)
    if issue_match:
        parsed = parse_date_string(issue_match.group(1))
        if parsed:
            issue_date_val = parsed.isoformat()

    # Check for explicit 'expiry date' or 'valid until'
    exp_match = re.search(r"(?:expir(?:y|ation)\s*date|valid\s*(?:through|until)|renewal\s*date)\s*[:.-]?\s*([^\n\r,]{6,25})", text, re.IGNORECASE)
    if exp_match:
        parsed = parse_date_string(exp_match.group(1))
        if parsed:
            expiry_date_val = parsed.isoformat()

    # Fallback to positional dates
    if not issue_date_val and found_dates:
        issue_date_val = found_dates[0][0].isoformat()
    if not expiry_date_val and len(found_dates) > 1:
        expiry_date_val = found_dates[1][0].isoformat()

    fields["issue_date"] = {"value": issue_date_val, "confidence": 0.90 if issue_date_val else 0.0}
    fields["expiry_date"] = {"value": expiry_date_val, "confidence": 0.85 if expiry_date_val else 0.0}

    # 5. Chemistry breakdown (% Cr, C, Ni, Mo, etc.)
    chemistry: Dict[str, Any] = {}
    chem_patterns = {
        "Cr": r"\b(?:Cr|Chromium)\s*[:=-]?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%",
        "C": r"\b(?:C|Carbon)\s*[:=-]?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%",
        "Ni": r"\b(?:Ni|Nickel)\s*[:=-]?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%",
        "Mo": r"\b(?:Mo|Molybdenum)\s*[:=-]?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%",
        "Mn": r"\b(?:Mn|Manganese)\s*[:=-]?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%",
        "Si": r"\b(?:Si|Silicon)\s*[:=-]?\s*(\d{1,2}(?:\.\d{1,3})?)\s*%",
    }
    for elem, pat in chem_patterns.items():
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            try:
                chemistry[elem] = {"value": float(m.group(1)), "confidence": 0.91}
            except ValueError:
                pass

    fields["chemistry"] = chemistry
    return fields


def inspect_document(
    file_bytes: Optional[bytes] = None,
    file_name: str = "",
    text_content: Optional[str] = None,
    declared_grade: Optional[str] = "AISI 420",
    evaluation_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Inspects a Mill Test Certificate or testing document and flags discrepancies.
    Assisted Review pattern: provides structured findings for human confirmation.
    """
    extraction_id = str(uuid.uuid4())

    # Obtain text
    if text_content and text_content.strip():
        raw_text = text_content
    elif file_bytes:
        raw_text = extract_text_from_bytes(file_bytes, file_name)
    else:
        raw_text = ""

    parsed_fields = parse_certificate_text(raw_text)
    flags: List[Dict[str, str]] = []
    discrepancy_alert = False

    detected_grade = parsed_fields.get("material_grade", {}).get("value")
    clean_declared = (declared_grade or "").strip().upper()

    # 1. Discrepancy Gate: AISI 304 detected for surgical cutting steel
    if detected_grade in AUSTENITIC_GRADES or "304" in (detected_grade or ""):
        discrepancy_alert = True
        flags.append({
            "code": "GRADE_MISMATCH",
            "severity": "high",
            "message": (
                f"Discrepancy Alert: Non-martensitic austenitic grade {detected_grade} detected. "
                "AISI 304/316 austenitic stainless steel cannot be hardened by heat treatment to the required "
                "Rockwell hardness and does not conform to ASTM F899 martensitic requirements for surgical cutting instruments."
            )
        })
    elif detected_grade and clean_declared and clean_declared not in detected_grade and detected_grade not in clean_declared:
        discrepancy_alert = True
        flags.append({
            "code": "GRADE_MISMATCH",
            "severity": "high",
            "message": f"Discrepancy Alert: Certificate states {detected_grade}, which contradicts the declared grade {clean_declared}."
        })

    # 2. Chemical composition verification against ASTM F899 limits
    cr_data = parsed_fields.get("chemistry", {}).get("Cr")
    if cr_data and detected_grade in ("AISI 420", "AISI 420A", "AISI 420B", "AISI 410"):
        cr_val = cr_data["value"]
        if detected_grade.startswith("AISI 420") and (cr_val < 12.0 or cr_val > 14.0):
            flags.append({
                "code": "CHEMISTRY_OUT_OF_SPEC",
                "severity": "high",
                "message": f"Chromium content ({cr_val}%) violates ASTM F899 limits (12.0% - 14.0%) for AISI 420."
            })
            discrepancy_alert = True
        elif detected_grade == "AISI 410" and (cr_val < 11.5 or cr_val > 13.5):
            flags.append({
                "code": "CHEMISTRY_OUT_OF_SPEC",
                "severity": "high",
                "message": f"Chromium content ({cr_val}%) violates ASTM F899 limits (11.5% - 13.5%) for AISI 410."
            })
            discrepancy_alert = True

    # 3. Expiry Check
    exp_data = parsed_fields.get("expiry_date", {}).get("value")
    if exp_data:
        try:
            exp_date = datetime.strptime(exp_data, "%Y-%m-%d").date()
            ref_date = datetime.strptime(evaluation_date, "%Y-%m-%d").date() if evaluation_date else date.today()
            if exp_date < ref_date:
                discrepancy_alert = True
                flags.append({
                    "code": "CERTIFICATE_EXPIRED",
                    "severity": "high",
                    "message": f"Certificate expired on {exp_data}, prior to the evaluation/shipment reference date {ref_date.isoformat()}."
                })
        except ValueError:
            pass

    # 4. Missing Heat Number Flag
    if not parsed_fields.get("heat_lot_number", {}).get("value"):
        flags.append({
            "code": "MISSING_HEAT_NUMBER",
            "severity": "medium",
            "message": "Traceability warning: Heat / Lot number could not be extracted from certificate."
        })

    return {
        "extraction_id": extraction_id,
        "fields": parsed_fields,
        "discrepancy_alert": discrepancy_alert,
        "flags": flags,
        "suggested_proof_grade": "document_backed",
        "raw_text_preview": raw_text[:300] if raw_text else "",
        "requires_human_confirmation": True
    }
