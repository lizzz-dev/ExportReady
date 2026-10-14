# RAG Compliance Copilot Pipeline (F11)

Status: Implemented and tested in `ai-service/app/rag_copilot.py` and `ai-service/app/regulatory_corpus.py` (FastAPI `:8000`), with pgvector planned for backend persistence.

## 1. Corpus (legal-safe)
Only **public-domain / government sources** and **team-authored summaries**: 21 CFR Parts 801/807/820/830 (eCFR), FDA guidance, Import
Alert 76-01 text, QMSR preamble, plus the 25 rule records (`rules`). **No ASTM/ISO standard text** — see
[REGULATORY_SOURCES_DIR.md](../03_rules_knowledge_base/REGULATORY_SOURCES_DIR.md) §4.

## 2. Ingestion
1. Fetch/cache source document with retrieval date.
2. Split by section/heading, then into chunks of ~400 tokens with 60-token overlap; never cross a CFR section boundary when avoidable.
3. Embed with `all-MiniLM-L6-v2` → 384-dim.
4. Store in planned `rag_chunks(id, source_id, content, embedding vector(384), citation_url, section_ref, retrieved_at)` with an HNSW or IVFFlat cosine index (`vector_cosine_ops`).

## 3. Query flow
1. User question (+ optional order/rule context from backend).
2. Embed question → top-k (k = 5) by cosine distance; discard chunks below similarity 0.35.
3. If no chunk survives → return the refusal message (no LLM call).
4. Build prompt (below) with chunks labelled `[S1]…[Sk]` including `citation_url`.
5. LLM call, **temperature 0.1**, max tokens bounded.
6. Post-check: every sentence in the answer must carry a citation marker `[Sn]` that exists; otherwise drop the sentence or refuse.
7. Return answer + citations (`section_ref`, `citation_url`).

## 4. Guardrail prompt (system)
```
You are ExportReady's compliance copilot for Pakistani surgical-instrument exporters.
Answer ONLY from the numbered sources provided. Cite every claim as [S#].
If the sources do not contain the answer, reply exactly: "I can't answer that from the official sources I have."
Never state or imply that the user's factory or product is compliant, certified, or will clear FDA/customs.
Never give legal advice. Do not use outside knowledge. Do not quote copyrighted standards.
Keep answers concise and end with: "This is decision support, not legal advice."
```

## 5. Context grounding
When asked about an order, the backend passes the latest findings summary (rule codes, verdicts) as *data*, not as an authority;
the copilot explains rules but does not change verdicts.

## 6. Evaluation
Groundedness (every claim cited and supported), citation correctness, refusal precision on out-of-scope questions
([EVALUATION_METRICS.md](../08_testing_and_evaluation/EVALUATION_METRICS.md)).
