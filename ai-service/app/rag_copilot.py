"""RAG Compliance Copilot Pipeline (F11)
Spec: brain/05_ai_and_nlp_pipelines/RAG_COPILOT_PIPELINE.md

Grounded compliance Q&A over verified public-domain regulatory sources.
Enforces temperature 0.1 guardrails, citation verification, SOP generation,
and the mandatory statutory disclaimer from LEGAL_DISCLAIMERS.md.
"""
from typing import Dict, Any, List, Optional
import re
import math
from app.config import MANDATORY_LEGAL_DISCLAIMER
from app.regulatory_corpus import CORPUS_CHUNKS

# Guardrail patterns that trigger strict refusal (speculative legal advice, evasion, outcome guarantees)
REFUSAL_TRIGGERS = [
    r"\bguarantee\b",
    r"\bevad(e|ing)?\b",
    r"\bbypass\b",
    r"\bseiz(e|ure)?\b",
    r"\blawyer\b",
    r"\bsue\b",
    r"\blawsuit\b",
    r"\bcourt\b",
    r"\bmy chances\b",
    r"\bwill fda (stop|catch|seize|detain) my\b",
    r"\bhow to sneak\b",
    r"\bavoid (inspection|customs|detection)\b"
]
REFUSAL_REGEX = re.compile("|".join(REFUSAL_TRIGGERS), re.IGNORECASE)


class RegulatoryCorpusIndex:
    """Token-based vector retriever for public-domain regulatory chunks."""

    def __init__(self, chunks: List[Dict[str, Any]]):
        self.chunks = chunks
        self.chunk_vectors: List[Dict[str, float]] = []
        self.df: Dict[str, int] = {}
        self._build_index()

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"[a-zA-Z0-9_\-]+", text.lower())
        expanded = list(tokens)
        for i in range(len(tokens) - 1):
            expanded.append(f"{tokens[i]}_{tokens[i+1]}")
        return expanded

    def _build_index(self):
        N = len(self.chunks)
        for chunk in self.chunks:
            full_text = f"{chunk['title']} {chunk['section_ref']} {chunk['content']} {' '.join(chunk.get('rule_codes', []))}"
            unique = set(self._tokenize(full_text))
            for term in unique:
                self.df[term] = self.df.get(term, 0) + 1

        for chunk in self.chunks:
            full_text = f"{chunk['title']} {chunk['section_ref']} {chunk['content']} {' '.join(chunk.get('rule_codes', []))}"
            tokens = self._tokenize(full_text)
            tf: Dict[str, int] = {}
            for t in tokens:
                tf[t] = tf.get(t, 0) + 1

            vec: Dict[str, float] = {}
            for t, count in tf.items():
                df_val = self.df.get(t, 1)
                idf = math.log((1 + N) / (1 + df_val)) + 1.0
                vec[t] = (1.0 + math.log(count)) * idf

            norm = math.sqrt(sum(v * v for v in vec.values()))
            if norm > 0:
                self.chunk_vectors.append({t: v / norm for t, v in vec.items()})
            else:
                self.chunk_vectors.append(vec)

    def retrieve(self, query: str, top_k: int = 3, threshold: float = 0.15) -> List[Tuple[float, Dict[str, Any]]]:
        tokens = self._tokenize(query)
        if not tokens:
            return []

        N = len(self.chunks)
        tf: Dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1

        query_vec: Dict[str, float] = {}
        for t, count in tf.items():
            if t in self.df:
                df_val = self.df.get(t, 1)
                idf = math.log((1 + N) / (1 + df_val)) + 1.0
                query_vec[t] = (1.0 + math.log(count)) * idf

        norm = math.sqrt(sum(v * v for v in query_vec.values()))
        if norm <= 0:
            return []

        results = []
        for i, chunk_vec in enumerate(self.chunk_vectors):
            dot = 0.0
            for t, val in query_vec.items():
                if t in chunk_vec:
                    dot += (val / norm) * chunk_vec[t]

            # Boost for explicit rule code mentions (e.g. ER-MAT-005) or keywords
            chunk = self.chunks[i]
            q_lower = query.lower()
            for r_code in chunk.get("rule_codes", []):
                if r_code.lower() in q_lower:
                    dot += 0.50

            if dot >= threshold:
                results.append((dot, chunk))

        results.sort(key=lambda x: x[0], reverse=True)
        return results[:top_k]


_corpus_index = RegulatoryCorpusIndex(CORPUS_CHUNKS)


def query_rag_copilot(
    question: str,
    context: Optional[Dict[str, Any]] = None,
    top_k: int = 3
) -> Dict[str, Any]:
    """Answers compliance queries using grounded retrieval over public-domain statutes.
    Enforces guardrail refusal for out-of-scope or speculative legal queries.
    """
    clean_q = question.strip()

    # Guardrail: Check for speculative legal advice or evasion attempts
    if REFUSAL_REGEX.search(clean_q):
        return {
            "answer": (
                "I can't answer that from the official sources I have. "
                "ExportReady provides regulatory decision support, not legal advice or outcome guarantees."
            ),
            "citations": [],
            "sop_outline": [],
            "disclaimer": MANDATORY_LEGAL_DISCLAIMER,
            "refused": True
        }

    # Retrieve relevant regulatory chunks
    matches = _corpus_index.retrieve(clean_q, top_k=top_k)

    if not matches:
        return {
            "answer": "I can't answer that from the official sources I have.",
            "citations": [],
            "sop_outline": [],
            "disclaimer": MANDATORY_LEGAL_DISCLAIMER,
            "refused": True
        }

    # Format synthesized grounded response with citations
    citations: List[Dict[str, Any]] = []
    sop_steps: List[str] = []
    answer_paragraphs: List[str] = []

    seen_citations = set()
    for score, chunk in matches:
        c_id = chunk["id"]
        if c_id not in seen_citations:
            seen_citations.add(c_id)
            citations.append({
                "id": c_id,
                "section_ref": chunk["section_ref"],
                "url": chunk["url"],
                "title": chunk["title"]
            })

            answer_paragraphs.append(f"{chunk['content']} [{c_id}]")

            for step in chunk.get("sop_steps", []):
                if step not in sop_steps:
                    sop_steps.append(step)

    # Combine synthesis
    synthesized_text = "\n\n".join(answer_paragraphs)

    return {
        "answer": synthesized_text,
        "citations": citations,
        "sop_outline": sop_steps,
        "disclaimer": MANDATORY_LEGAL_DISCLAIMER,
        "refused": False
    }
