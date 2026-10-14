"""ExportReady AI Service - FastAPI Application
Provides microservice endpoints for:
- NLP Buyer-Condition Matching (/nlp/match-conditions and /nlp/match)
- Smart OCR Document Inspection (/ocr/inspect-document and /ocr/inspect)
- Grounded Regulatory RAG Copilot (/rag/query and /rag/ask)
"""
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

from app.config import (
    load_rules_master,
    DEFAULT_SIMILARITY_THRESHOLD,
    SERVICE_PORT,
    SERVICE_HOST,
    SERVICE_TOKEN,
    MANDATORY_LEGAL_DISCLAIMER,
)
from app.nlp_matcher import match_buyer_conditions
from app.ocr_inspector import inspect_document
from app.rag_copilot import query_rag_copilot

app = FastAPI(
    title="ExportReady AI Compliance Service",
    description="Microservice for NLP buyer-condition parsing, OCR certificate inspection, and RAG regulatory guidance.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / Response Models ---

class NLPMatchRequest(BaseModel):
    text: str = Field(..., description="Buyer contract or purchase order text to analyze for regulatory conditions")
    rules: Optional[List[Dict[str, Any]]] = Field(None, description="Optional rules catalogue override; defaults to master 25 rules")
    threshold: Optional[float] = Field(DEFAULT_SIMILARITY_THRESHOLD, description="Similarity cutoff threshold")


class NLPCandidate(BaseModel):
    rule_code: str
    rule_title: str
    score: float
    sentence: str
    confirmed_by_user: bool = False
    requires_human_confirmation: bool = True


class NLPMatchResponse(BaseModel):
    candidates: List[NLPCandidate]


class OCRInspectJSONRequest(BaseModel):
    text_content: str = Field(..., description="Raw text of Mill Test Certificate or testing document")
    declared_grade: Optional[str] = Field("AISI 420", description="Declared material grade from product specifications")
    evaluation_date: Optional[str] = Field(None, description="Optional reference date (YYYY-MM-DD) to test certificate validity against")


class Citation(BaseModel):
    id: str
    section_ref: str
    url: str
    title: str


class RAGQueryRequest(BaseModel):
    question: str = Field(..., description="Compliance or regulatory question")
    context: Optional[Dict[str, Any]] = Field(None, description="Optional factory/order context")
    top_k: Optional[int] = Field(3, description="Number of source chunks to retrieve")


class RAGQueryResponse(BaseModel):
    answer: str
    citations: List[Citation]
    sop_outline: List[str]
    disclaimer: str
    refused: bool


# --- Endpoints ---

@app.get("/health", summary="Health and liveness check")
async def health_check():
    """Liveness check and rule catalogue synchronization status."""
    rules = load_rules_master()
    return {
        "status": "healthy",
        "service": "exportready-ai-service",
        "version": "1.0.0",
        "active_rules_count": len(rules),
        "rules_file_synced": True,
    }


# 1. NLP Buyer Condition Matcher (Supports both canonical and alias path)
@app.post(
    "/nlp/match-conditions",
    response_model=NLPMatchResponse,
    summary="Match buyer contract conditions against compliance rules",
)
@app.post(
    "/nlp/match",
    response_model=NLPMatchResponse,
    summary="Alias for contract condition matching",
    include_in_schema=False,
)
async def match_conditions_endpoint(request: NLPMatchRequest):
    """Segments contract clauses and matches them against the 25 compliance rules.
    Every candidate is flagged with confirmed_by_user = False.
    """
    candidates = match_buyer_conditions(
        text=request.text,
        rules=request.rules,
        threshold=request.threshold or DEFAULT_SIMILARITY_THRESHOLD,
    )
    return {"candidates": candidates}


# 2. OCR Document Inspector
@app.post(
    "/ocr/inspect-document",
    summary="Inspect Mill Test Certificate (MTC) or testing record from file or text",
)
@app.post(
    "/ocr/inspect",
    summary="Alias for OCR document inspection",
    include_in_schema=False,
)
async def inspect_document_endpoint(
    file: Optional[UploadFile] = File(None),
    declared_grade: Optional[str] = Form("AISI 420"),
    text_content: Optional[str] = Form(None),
    evaluation_date: Optional[str] = Form(None),
):
    """Extracts MTC fields, verifies ASTM F899 martensitic requirements,
    detects AISI 304 discrepancy, and prepares structured fields for Assisted Review.
    """
    file_bytes = None
    file_name = ""
    if file:
        file_bytes = await file.read()
        file_name = file.filename or ""

    result = inspect_document(
        file_bytes=file_bytes,
        file_name=file_name,
        text_content=text_content,
        declared_grade=declared_grade,
        evaluation_date=evaluation_date,
    )
    return result


@app.post(
    "/ocr/inspect-json",
    summary="Inspect MTC from raw text in JSON payload",
    include_in_schema=False,
)
async def inspect_document_json_endpoint(request: OCRInspectJSONRequest):
    """Alternative JSON body endpoint for text-based certificate inspection."""
    return inspect_document(
        text_content=request.text_content,
        declared_grade=request.declared_grade,
        evaluation_date=request.evaluation_date,
    )


# 3. RAG Compliance Copilot
@app.post(
    "/rag/query",
    response_model=RAGQueryResponse,
    summary="Query RAG copilot for grounded statutory compliance guidance",
)
@app.post(
    "/rag/ask",
    response_model=RAGQueryResponse,
    summary="Alias for RAG copilot query",
    include_in_schema=False,
)
async def rag_query_endpoint(request: RAGQueryRequest):
    """Grounded Q&A over public-domain regulatory corpus with clickable citations
    and actionable SOP outlines. Refuses out-of-scope or speculative legal advice.
    """
    return query_rag_copilot(
        question=request.question,
        context=request.context,
        top_k=request.top_k or 3,
    )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=SERVICE_HOST, port=SERVICE_PORT, reload=True)
