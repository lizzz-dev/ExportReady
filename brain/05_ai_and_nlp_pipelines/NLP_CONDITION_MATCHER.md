# NLP Buyer-Condition Matcher (F6)

Status: Implemented and tested in `ai-service/app/nlp_matcher.py` (FastAPI `:8000`); persistence by `backend/`.

## 1. Purpose
Buyers add contractual quality clauses ("all lots shall carry EN 10204 3.1 certificates", "UDI per 21 CFR 801").
The matcher proposes which of the 25 rules each clause maps to, so they're evaluated alongside system-inferred rules.

**The matcher never decides a verdict and never auto-applies a rule — candidate matches are always marked `confirmed_by_user: false` and `requires_human_confirmation: true`. A human must confirm.**

## 2. Pipeline
1. **Input:** `orders.buyer_contract_text`.
2. **Sentence segmentation:** spaCy (`en_core_web_sm`).
3. **Obligation filter:** keep sentences with cues (`shall`, `must`, `required`, `ensure`, `certif*`, `comply`, `conform`, `per`, `in accordance with`) — reduces noise.
4. **Embedding:** `sentence-transformers/all-MiniLM-L6-v2` (384-dim) for each kept sentence.
5. **Rule embeddings:** precomputed for `title + ". " + description` of each active rule (cached; recomputed when a rule's `version` changes).
6. **Similarity:** cosine similarity matrix; candidate if `score ≥ 0.65`. Keep top-3 rules per sentence.
7. **Dedup:** one candidate per (order, rule) keeping the highest score; skip rules already `system_inferred` for the order (nothing to add).
8. **Output:** list of `{clause, matched_rule_code, rule_title, confidence_score, statutory_citations, confirmed_by_user: false, requires_human_confirmation: true}`.
9. **Dual-Mode Offline / CI Reliability:** When `sentence-transformers` and `spaCy` are present, deep embeddings are computed. If missing or running offline/CI, a deterministic vectorizer with regex sentence splitting (handling decimal clauses like `4.2.3`, `No.`, `vs.`, and semicolons) and token-weighted TF-IDF scoring over `rules_master_25.json` ensures 100% reliable local test execution without external downloads.

## 3. Confirmation loop
- Backend inserts candidates as `order_rules(source_type='buyer_condition', confirmed_by_user=FALSE)` (planned columns `match_score`, `source_sentence` — see [DATA_DICTIONARY.md](../02_architecture/DATA_DICTIONARY.md) §5).
- UI shows each candidate with its source sentence and score. User **Accepts** (`confirmed_by_user = TRUE`) or **Rejects** (row deleted).
- The decision engine ignores unconfirmed buyer-condition rows.
- Users may also add a rule manually.

## 4. Threshold rationale
0.65 is the initial operating point. It is tuned/reported in evaluation (precision/recall on labelled contract sentences; see
[EVALUATION_METRICS.md](../08_testing_and_evaluation/EVALUATION_METRICS.md)). Prefer recall at this stage because a human filters false positives.

## 5. Failure modes & handling
| Risk | Mitigation |
|---|---|
| Paraphrase with unusual wording | Human can add rules manually |
| Negation ("need not comply") | Surface sentence text so reviewer sees context |
| Non-English text | Out of scope V2; warn if language detection is not English |
| Model unavailable | API returns 503; order intake still works without NLP |
