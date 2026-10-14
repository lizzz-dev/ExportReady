"""NLP Buyer-Condition Matcher (F6)
Spec: brain/05_ai_and_nlp_pipelines/NLP_CONDITION_MATCHER.md

Segments buyer contracts into individual clauses, filters obligation cues,
computes semantic similarity against the 25 master rules, and returns candidate
rule mappings requiring mandatory human confirmation.
"""
from typing import List, Dict, Any, Optional, Tuple
import re
import math
from app.config import load_rules_master, DEFAULT_SIMILARITY_THRESHOLD

# Obligation cues that signal a contractual requirement
OBLIGATION_PATTERNS = [
    r"\bshall\b",
    r"\bmust\b",
    r"\brequir(ed|es|ement|ing)?\b",
    r"\bensure(s|d)?\b",
    r"\bcertif(ied|icate|ication|ies)?\b",
    r"\bcompl(y|ies|iance|ied)\b",
    r"\bconform(s|ed|ance|ing)?\b",
    r"\bper\b",
    r"\bin accordance with\b",
    r"\bstandard(s)?\b",
    r"\bverified\b",
    r"\bvalidated\b",
    r"\btested\b",
    r"\btraceab(le|ility)\b",
    r"\bmaintain(ed)?\b",
    r"\bsubmit(ted)?\b",
    r"\blabel(ed|led|ing|ling)?\b",
    r"\bquarantine\b",
]
OBLIGATION_REGEX = re.compile("|".join(OBLIGATION_PATTERNS), re.IGNORECASE)

# Abbreviations that must not cause sentence splits
ABBREVIATIONS = (
    "e.g.", "i.e.", "vs.", "no.", "dr.", "fig.", "cl.", "sec.", "vol.",
    "u.s.", "u.s.a.", "para.", "ref.", "approx.", "est.", "inc.", "ltd.", "pvt."
)


def split_contract_clauses(text: str) -> List[str]:
    """Splits contract text into distinct candidate clauses.
    Handles:
      - Clause numbering (e.g. 4.2.3, 820.75, 76-01, 13485:2016)
      - Semicolons separating requirements
      - Bullet points and lettered lists (a), (b), 1., 2., -, *
      - Common abbreviations (e.g., vs., No.)
    """
    if not text or not text.strip():
        return []

    # Normalize line breaks and clean whitespace
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")

    # Protect common abbreviations and decimal section numbers by temporary tokens
    protected_tokens: Dict[str, str] = {}

    def protect_decimals(match: re.Match) -> str:
        token = f"__DECIMAL_{len(protected_tokens)}__"
        protected_tokens[token] = match.group(0)
        return token

    # Protect decimals like 4.2.3 or 820.75 or 3.1
    temp_text = re.sub(r"\b\d+\.\d+(?:\.\d+)?\b", protect_decimals, normalized)

    # Protect abbreviations
    for abbr in ABBREVIATIONS:
        pattern = re.compile(re.escape(abbr), re.IGNORECASE)
        matches = list(pattern.finditer(temp_text))
        for m in reversed(matches):
            token = f"__ABBR_{len(protected_tokens)}__"
            protected_tokens[token] = m.group(0)
            temp_text = temp_text[:m.start()] + token + temp_text[m.end():]

    # Split on newlines, bullet points, semicolons, or sentence-ending periods/exclamations/questions
    raw_segments = re.split(r"(?:[\n\r]+|\s*;\s*|(?<=[.!?])\s+(?=[A-Z0-9\(\[\-\*]))", temp_text)

    clauses: List[str] = []
    for seg in raw_segments:
        # Restore protected tokens
        clean_seg = seg
        for token, original in protected_tokens.items():
            clean_seg = clean_seg.replace(token, original)

        # Strip bullet prefixes like "- ", "* ", "(1) ", "1. ", "(a) "
        clean_seg = re.sub(r"^\s*(?:[\-\*\•]|\(?\w+[\.\)]|\d+[\.\)])\s*", "", clean_seg).strip()

        # Remove trailing period if present
        if clean_seg.endswith("."):
            clean_seg = clean_seg[:-1].strip()

        if len(clean_seg) >= 10:  # Ignore trivial fragments
            clauses.append(clean_seg)

    return clauses


# Try importing spaCy and sentence_transformers
_transformer_model = None
_spacy_nlp = None
_model_load_attempted = False


def _try_load_ml_models():
    global _transformer_model, _spacy_nlp, _model_load_attempted
    if _model_load_attempted:
        return
    _model_load_attempted = True
    try:
        import spacy
        _spacy_nlp = spacy.load("en_core_web_sm")
    except Exception:
        _spacy_nlp = None

    try:
        from sentence_transformers import SentenceTransformer
        _transformer_model = SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        _transformer_model = None


class DeterministicRuleVectorizer:
    """Deterministic token-weighted TF-IDF & keyword matcher for 25 rules.
    Runs 100% offline with zero dependencies, guaranteeing reproducible results.
    """

    def __init__(self, rules: List[Dict[str, Any]]):
        self.rules = rules
        self.rule_docs: Dict[str, str] = {}
        self.doc_freq: Dict[str, int] = {}
        self.rule_vectors: Dict[str, Dict[str, float]] = {}
        self._build_index()

    def _tokenize(self, text: str) -> List[str]:
        # Extract alphanumeric words and standard references (e.g. f899, a967, 10204, 420)
        raw_tokens = re.findall(r"[a-zA-Z0-9_\-]+", text.lower())
        tokens = list(raw_tokens)
        # Suffix unification (plural/singular)
        for t in raw_tokens:
            if t.endswith("s") and len(t) > 3:
                tokens.append(t[:-1])
            if t.endswith("ies") and len(t) > 4:
                tokens.append(t[:-3] + "y")
            if t.endswith("ed") and len(t) > 4:
                tokens.append(t[:-2])
            if t.endswith("ing") and len(t) > 5:
                tokens.append(t[:-3])

        # Add bigrams for standard names (e.g. astm_f899, en_10204, aisi_420)
        expanded = list(tokens)
        for i in range(len(raw_tokens) - 1):
            expanded.append(f"{raw_tokens[i]}_{raw_tokens[i+1]}")
        return expanded

    def _build_index(self):
        N = len(self.rules)
        for r in self.rules:
            code = r["rule_code"]
            parts = [
                r["rule_code"],
                r["title"],
                r["description"],
                r.get("category", ""),
                r.get("fda_source_section", "") or "",
                r.get("cfr_section", "") or "",
                r.get("iso_clause_number", "") or "",
            ]
            meta = r.get("metadata") or {}
            if meta.get("astm_reference"):
                parts.append(meta["astm_reference"])
            if meta.get("qmsr_note"):
                parts.append(meta["qmsr_note"])
            if meta.get("evidence_required"):
                parts.extend(meta["evidence_required"])
            if meta.get("verification_method"):
                parts.append(meta["verification_method"])

            doc_text = " ".join(parts).lower()
            self.rule_docs[code] = doc_text
            unique_terms = set(self._tokenize(doc_text))
            for term in unique_terms:
                self.doc_freq[term] = self.doc_freq.get(term, 0) + 1

        # Calculate TF-IDF vectors for each rule
        for code, doc_text in self.rule_docs.items():
            tokens = self._tokenize(doc_text)
            tf: Dict[str, int] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1

            vec: Dict[str, float] = {}
            for t, count in tf.items():
                df = self.doc_freq.get(t, 1)
                idf = math.log((1 + N) / (1 + df)) + 1.0
                sublinear_tf = 1.0 + math.log(count)
                vec[t] = sublinear_tf * idf

            # Normalize
            norm = math.sqrt(sum(v * v for v in vec.values()))
            if norm > 0:
                self.rule_vectors[code] = {t: v / norm for t, v in vec.items()}
            else:
                self.rule_vectors[code] = vec

    def compute_similarity(self, clause_text: str, rule_code: str) -> float:
        clause_tokens = self._tokenize(clause_text)
        if not clause_tokens or rule_code not in self.rule_vectors:
            return 0.0

        rule_vec = self.rule_vectors[rule_code]
        N = len(self.rules)

        tf: Dict[str, int] = {}
        for t in clause_tokens:
            tf[t] = tf.get(t, 0) + 1

        clause_vec: Dict[str, float] = {}
        for t, count in tf.items():
            if t in self.doc_freq:
                df = self.doc_freq.get(t, 1)
                idf = math.log((1 + N) / (1 + df)) + 1.0
                sublinear_tf = 1.0 + math.log(count)
                clause_vec[t] = sublinear_tf * idf

        norm = math.sqrt(sum(v * v for v in clause_vec.values()))
        if norm <= 0:
            return 0.0

        dot = 0.0
        for t, val in clause_vec.items():
            if t in rule_vec:
                dot += (val / norm) * rule_vec[t]

        # Domain exact phrase bonus (e.g. exact standard/material match)
        rule_doc = self.rule_docs[rule_code]
        lower_clause = clause_text.lower()

        # Specific keyword synergies
        specific_cues = {
            "ER-MAT-005": ["420", "410", "mill test", "mtc", "en 10204", "heat number", "raw steel", "martensitic", "astm f899", "f899"],
            "ER-MAT-006": ["pmi", "spectrometric", "positive material", "xrf", "astm f899", "f899"],
            "ER-MAT-007": ["rockwell", "hardness", "hrc", "heat treatment", "tempering", "astm f899"],
            "ER-MAT-008": ["approved supplier", "asl", "purchasing control", "supplier evaluation"],
            "ER-PAS-009": ["passivation", "astm a967", "citric", "nitric", "bath validation", "a967"],
            "ER-PAS-010": ["bath chemistry", "titration", "rinse water"],
            "ER-PAS-011": ["boil test", "astm f1089", "boiling", "f1089"],
            "ER-PAS-012": ["copper sulfate", "free iron", "practice d"],
            "ER-DOC-013": ["dmr", "device master record", "medical device file"],
            "ER-DOC-014": ["dhr", "device history record", "batch traveller", "lot traceability", "heat number"],
            "ER-DOC-015": ["document control", "change management", "change control"],
            "ER-DOC-016": ["record retention", "quality records", "retention period"],
            "ER-DOC-017": ["nonconforming", "ncr", "concession", "scrap"],
            "ER-CAL-018": ["calibration", "calibrated", "gauge", "micrometer", "vernier"],
            "ER-CAL-019": ["traceability to national", "17025", "calibration standard", "iso 17025", "iso/iec 17025"],
            "ER-UDI-020": ["udi", "unique device", "label", "aidc", "barcode", "gtin", "device identifier", "21 cfr 801"],
            "ER-UDI-021": ["direct part marking", "laser mark", "permanent mark", "reusable", "21 cfr 801.45"],
            "ER-UDI-022": ["gudid", "accessgudid", "duns", "device identification database", "21 cfr 830"],
            "ER-CLN-023": ["cleaning process", "ultrasonic", "cleaning validation", "cleanliness"],
            "ER-CLN-024": ["bioburden", "sterility", "contamination control", "hygiene"],
            "ER-CAPA-025": ["capa", "corrective and preventive", "root cause", "corrective action"],
            "ER-REG-001": ["green list", "import alert 76-01", "dwpe", "detention without physical"],
            "ER-REG-002": ["establishment registration", "device listing", "us agent", "furls", "21 cfr 807"],
            "ER-REG-003": ["510(k)", "premarket", "510k", "class i exempt", "878.4800"],
            "ER-QMS-004": ["internal quality audit", "management review", "iso 13485", "qmsr"],
        }

        matched_cues = 0
        if rule_code in specific_cues:
            for cue in specific_cues[rule_code]:
                if cue in lower_clause:
                    matched_cues += 1

        if matched_cues > 0:
            # Calibrate boost so strong contractual matches pass >= 0.65 cleanly
            dot = min(1.0, dot * 1.5 + 0.25 + 0.15 * min(3, matched_cues - 1))

        return float(round(dot, 4))


# Global vectorizer instance
_vectorizer: Optional[DeterministicRuleVectorizer] = None


def get_vectorizer() -> DeterministicRuleVectorizer:
    global _vectorizer
    if _vectorizer is None:
        rules = load_rules_master()
        _vectorizer = DeterministicRuleVectorizer(rules)
    return _vectorizer


def match_buyer_conditions(
    text: str,
    rules: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    filter_obligations: bool = True,
) -> List[Dict[str, Any]]:
    """Analyzes buyer contract text and finds matching compliance rules.
    Always flags candidates with confirmed_by_user = False.
    """
    if rules is None:
        rules = load_rules_master()

    clauses = split_contract_clauses(text)
    if not clauses:
        return []

    _try_load_ml_models()
    vectorizer = get_vectorizer()

    candidates: List[Dict[str, Any]] = []
    seen_matches = set()  # (rule_code, sentence) dedup

    for clause in clauses:
        # Check obligation cues if requested
        if filter_obligations and not OBLIGATION_REGEX.search(clause):
            # If no obligation cue is found, still allow if standard/rule-specific term is present
            lower_c = clause.lower()
            if not any(k in lower_c for k in ["astm", "iso", "cfr", "fda", "en 10204", "aisi", "udi", "gudid", "mtc", "capa"]):
                continue

        # Evaluate against all rules
        clause_matches: List[Tuple[float, Dict[str, Any]]] = []
        for r in rules:
            code = r["rule_code"]
            score = vectorizer.compute_similarity(clause, code)
            if score >= threshold:
                clause_matches.append((score, r))

        # Sort matches by score descending, keep top 3
        clause_matches.sort(key=lambda x: x[0], reverse=True)
        for score, matched_rule in clause_matches[:3]:
            key = (matched_rule["rule_code"], clause)
            if key not in seen_matches:
                seen_matches.add(key)
                candidates.append({
                    "rule_code": matched_rule["rule_code"],
                    "rule_title": matched_rule["title"],
                    "score": round(score, 4),
                    "sentence": clause,
                    "confirmed_by_user": False,
                    "requires_human_confirmation": True,
                })

    # Sort final candidates by score descending
    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates
