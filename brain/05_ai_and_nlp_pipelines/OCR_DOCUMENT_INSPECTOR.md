# OCR Document Inspector (F4)

Status: Specified, not implemented. Lives in `ai-service/`.

## 1. Scope
Primary document: **Mill Test Certificate (MTC)** for raw steel (rule ER-MAT-005; cross-check for ER-MAT-006).
The same pipeline can be extended to other documents later.

## 2. Pipeline
1. **Ingest:** PDF / PNG / JPG (size and MIME validated; max 10 MB).
2. **Text extraction:** `pdfplumber` for digital PDFs; if page text is empty/low-quality → rasterise and run `pytesseract` (English).
3. **Parse (regex + layout heuristics)** into:
   `heat_number, grade, standard (e.g. EN 10204 3.1), producer, issue_date, chemistry{C, Cr, Ni, Mn, Si, P, S, Mo}, mechanical{hardness, condition}`.
4. **Validate** (rule-based, no ML):
   - Required fields present (heat number, grade, chemistry, producer).
   - Chromium within the limits recorded in `rules.metadata` / ER-MAT-005 text: **410 → 11.5–13.5 %**, **420 → 12.0–14.0 %** (to be confirmed by the user against their licensed ASTM F899; not reproduced here).
   - **Grade consistency — AISI 420 vs 304 check:** 304 is austenitic (~18–20 % Cr, ~8–10.5 % Ni) and cannot be hardened by heat treatment. If the order/product declares a hardened martensitic grade (410/420) and the MTC grade reads 304 — or nickel ≈ 8 % with Cr ≈ 18 % — raise `GRADE_MISMATCH` (severity high).
   - Standard/type: warn if not EN 10204 3.1/3.2.
   - Dates: issue date present and not in the future.
5. **Confidence:** per-field OCR confidence (tesseract word confidence / regex match quality). Fields below 0.80 are highlighted.

## 3. Assisted Review pattern
OCR is **never authoritative**.

```
upload → extract → show side-by-side (document | parsed fields + flags)
      → human edits/confirms → ONLY THEN create/update factory_evidence
```
- Staging record (planned `ocr_extractions`) stores raw text, parsed fields, flags, `status: pending|confirmed|discarded`, `confirmed_by`.
- Confirmation sets `proof_grade` suggestion = `document_backed` (a human may upgrade to `third_party_verified` only with a recognised third-party/mill 3.1/3.2 certificate).
- Flags do not change verdicts directly; they inform the reviewer and appear in the dossier.

## 4. Output contract (see REST_API_ENDPOINTS.md)
`{ extraction_id, fields:{…, confidence}, flags:[{code, severity, message}], suggested_proof_grade }`

## 5. Limits
Handwriting, low-resolution scans, multi-heat certificates require manual entry. Accuracy is measured per field in evaluation
([EVALUATION_METRICS.md](../08_testing_and_evaluation/EVALUATION_METRICS.md)).
