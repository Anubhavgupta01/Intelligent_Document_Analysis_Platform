"""FastAPI application for the Intelligent Document Analysis Platform."""
from __future__ import annotations

import logging
import re
import time
import uuid
from io import BytesIO
from typing import Any, Optional

from dotenv import load_dotenv
load_dotenv()

from docx import Document
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pypdf import PdfReader

from .auth import auth_router, get_current_user
from .deps import answer_question, generate_action_tasks, generate_key_points, summarize_text
from .models import generate_chat_response, log_ai_configuration
from .rag import InMemoryRAGIndex
from .storage import (
    get_document,
    get_evaluation_summary,
    init_db,
    list_all_documents,
    list_chat_sessions,
    list_documents,
    record_evaluation,
    save_chat_session,
    save_document,
    delete_chat_session,
)

logger = logging.getLogger(__name__)

app = FastAPI(title="Intelligent Document Analysis Platform API")
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAG = InMemoryRAGIndex()


class SummarizeRequest(BaseModel):
    text: Optional[str] = None
    document_id: Optional[str] = None


class QARequest(BaseModel):
    context: Optional[str] = None
    question: str
    document_id: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    document_id: Optional[str] = None
    history: list[ChatMessage] = Field(default_factory=list)


class Citation(BaseModel):
    page: int
    quote: str
    score: float | None = None


class ResponseMetrics(BaseModel):
    latency_ms: float
    retrieval_relevance: float | None = None
    faithfulness: float | None = None


class ChatResponse(BaseModel):
    response: str
    citations: list[Citation] = Field(default_factory=list)
    metrics: ResponseMetrics | None = None


@app.on_event("startup")
async def startup_event():
    init_db()
    for document in list_all_documents():
        try:
            RAG.build_index_for_document(document["id"], document["content"], document.get("pages"))
        except Exception as error:
            logger.warning("Could not rebuild index for %s: %s", document["id"], error)
    log_ai_configuration()


@app.get("/health")
async def health():
    return {"status": "ok", "database": "sqlite", "indexed_documents": len(RAG.doc_id_to_chunks)}


def _page_text(page: dict[str, Any]) -> str:
    return str(page.get("text", "")).strip()


def extract_document_pages_from_file_data(data: bytes, filename: str, content_type: str) -> list[dict[str, Any]]:
    filename_lower = (filename or "").strip().lower()
    content_type_lower = (content_type or "").strip().lower()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    is_pdf = b"%PDF-" in data[:1024] or filename_lower.endswith(".pdf") or "pdf" in content_type_lower
    if is_pdf:
        try:
            reader = PdfReader(BytesIO(data))
            pages: list[dict[str, Any]] = []
            for index, page in enumerate(reader.pages):
                page_text = ""
                try:
                    page_text = page.extract_text() or ""
                except Exception as error:
                    logger.warning("Standard PDF extraction failed on page %s: %s", index + 1, error)
                if not page_text.strip():
                    try:
                        page_text = page.extract_text(extraction_mode="layout") or ""
                    except Exception as error:
                        logger.warning("Layout PDF extraction failed on page %s: %s", index + 1, error)
                if page_text.strip():
                    pages.append({"page": index + 1, "text": page_text.strip()})
            if not pages:
                raise HTTPException(
                    status_code=400,
                    detail="This PDF appears to be scanned or image-based with no embedded text layer. Please upload a text-searchable PDF.",
                )
            return pages
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF file structure: {error}")

    is_docx = filename_lower.endswith((".docx", ".doc")) or "word" in content_type_lower or "officedocument" in content_type_lower or (data.startswith(b"PK\x03\x04") and not is_pdf)
    if is_docx:
        try:
            document = Document(BytesIO(data))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs).strip()
            if not text:
                raise HTTPException(status_code=400, detail="The DOCX contains no readable text paragraphs.")
            return [{"page": 1, "text": text}]
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX file structure: {error}")

    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            text = data.decode(encoding).strip()
            if text and any(character.isalnum() for character in text):
                return [{"page": 1, "text": text}]
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="Unable to extract readable text from this file.")


def extract_text_from_file_data(data: bytes, filename: str, content_type: str) -> str:
    return "\n".join(_page_text(page) for page in extract_document_pages_from_file_data(data, filename, content_type)).strip()


def _get_owned_document(document_id: str, user_id: str) -> dict[str, Any]:
    document = get_document(document_id, user_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found or no longer available for this account.")
    return document


def _citations_from_items(items: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    citations: list[dict[str, Any]] = []
    seen_pages: set[int] = set()
    for item in items:
        page = int(item.get("page", 1))
        if page in seen_pages:
            continue
        quote = str(item.get("text", "")).replace("\n", " ").strip()
        if not quote:
            continue
        citations.append({"page": page, "quote": quote[:280], "score": item.get("score")})
        seen_pages.add(page)
        if len(citations) >= limit:
            break
    return citations


def _faithfulness_score(answer: str, citations: list[dict[str, Any]]) -> float:
    source_text = " ".join(str(item.get("quote", "")) for item in citations).lower()
    source_terms = {term for term in re.findall(r"\w+", source_text) if len(term) > 3}
    answer_terms = {term for term in re.findall(r"\w+", answer.lower()) if len(term) > 3}
    if not answer_terms:
        return 0.0
    return round(min(1.0, len(answer_terms & source_terms) / len(answer_terms)), 3)


def _retrieval_items(document_id: str, query: str) -> list[dict[str, Any]]:
    if document_id not in RAG.doc_id_to_chunks:
        document = get_document(document_id)
        if not document:
            return []
        RAG.build_index_for_document(document_id, document["content"], document.get("pages"))
    return RAG.retrieve_with_metadata(document_id, query, top_k=4)


@app.post("/upload")
async def upload(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        data = await file.read()
        pages = extract_document_pages_from_file_data(data, file.filename or "", file.content_type or "")
        text = "\n".join(_page_text(page) for page in pages).strip()
        document_id = str(uuid.uuid4())
        save_document(document_id, current_user["id"], file.filename or "Untitled document", file.content_type or "application/octet-stream", len(data), len(text), text, pages)
        RAG.build_index_for_document(document_id, text, pages)
        return {"document_id": document_id, "characters": len(text), "pages": len(pages)}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Unexpected upload error: %s", error)
        raise HTTPException(status_code=500, detail=f"File processing error: {error}")
    finally:
        await file.close()


@app.get("/documents")
async def documents(current_user: dict = Depends(get_current_user)):
    return {"documents": list_documents(current_user["id"]) }


@app.post("/sessions")
async def create_or_update_session(session: dict[str, Any], current_user: dict = Depends(get_current_user)):
    save_chat_session(session, current_user["id"])
    return {"status": "saved", "id": session.get("id")}


@app.get("/sessions")
async def sessions(current_user: dict = Depends(get_current_user)):
    return {"sessions": list_chat_sessions(current_user["id"]) }


@app.delete("/sessions/{session_id}")
async def remove_session(session_id: str, current_user: dict = Depends(get_current_user)):
    delete_chat_session(session_id, current_user["id"])
    return {"status": "deleted"}


async def _read_document_request(request: Request) -> tuple[str | None, str | None]:
    content_type = request.headers.get("content-type", "").lower()
    try:
        body = await request.json() if "application/json" in content_type else await request.form()
        if isinstance(body, dict):
            return body.get("document_id"), body.get("text")
        return body.get("document_id"), body.get("text")
    except Exception:
        return None, None


@app.post("/summarize")
async def summarize(request: Request, current_user: dict = Depends(get_current_user)):
    document_id, target_text = await _read_document_request(request)
    citations: list[dict[str, Any]] = []
    if document_id:
        document = _get_owned_document(document_id, current_user["id"])
        context = document["content"]
        citations = _citations_from_items(document.get("pages", []))
    else:
        context = target_text or ""
    if not context.strip():
        raise HTTPException(status_code=400, detail="Provide a document ID or readable text to summarize.")
    try:
        return {
            "summary": summarize_text(context),
            "key_points": generate_key_points(context, num_points=3),
            "tasks": generate_action_tasks(context, num_tasks=2),
            "citations": citations,
        }
    except Exception as error:
        logger.exception("Summarization failed: %s", error)
        raise HTTPException(status_code=502, detail="The AI service could not summarize this document. Please try again.")


@app.post("/qa")
async def qa(request: Request, current_user: dict = Depends(get_current_user)):
    document_id, target_context = await _read_document_request(request)
    body = await request.json() if "application/json" in request.headers.get("content-type", "").lower() else await request.form()
    question = body.get("question") if isinstance(body, dict) else None
    if not question or not str(question).strip():
        raise HTTPException(status_code=400, detail="Missing question")
    if document_id:
        _get_owned_document(document_id, current_user["id"])
        items = _retrieval_items(document_id, str(question))
        context = "\n\n".join(f"[Page {item['page']}] {item['text']}" for item in items)
        citations = _citations_from_items(items)
    else:
        context = target_context or ""
        citations = []
    if not context.strip():
        raise HTTPException(status_code=400, detail="Provide a document ID or readable context.")
    try:
        return {"answer": answer_question(context, str(question)), "citations": citations}
    except Exception:
        raise HTTPException(status_code=502, detail="The AI service could not answer this question. Please try again.")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    started_at = time.perf_counter()
    if not request.document_id:
        raise HTTPException(status_code=400, detail="Upload and select a document before asking document questions.")
    _get_owned_document(request.document_id, current_user["id"])
    items = _retrieval_items(request.document_id, request.message)
    if not items:
        raise HTTPException(status_code=404, detail="The selected document is not indexed yet. Please upload it again.")
    citations = _citations_from_items(items)
    document_text = "\n\n".join(f"[Page {item['page']}] {item['text']}" for item in items)
    messages = [{
        "role": "system",
        "content": "You are a helpful AI research assistant. Answer only from the uploaded document context. If the answer is not present, say that clearly. Always be concise and accurate.\n\nDocument context:\n" + document_text,
    }]
    messages.extend({"role": message.role, "content": message.content} for message in request.history)
    messages.append({"role": "user", "content": request.message})
    try:
        response = generate_chat_response(messages, max_new_tokens=512)
    except Exception as error:
        logger.exception("Chat endpoint error: %s", error)
        error_text = str(error).lower()
        if "401" in error_text or "unauthorized" in error_text or "invalid" in error_text:
            detail = "The Hugging Face service rejected the configured token."
        elif "429" in error_text or "rate limit" in error_text:
            detail = "The AI service rate limit was reached. Please try again shortly."
        else:
            detail = "The AI service is temporarily unavailable. Please try again."
        raise HTTPException(status_code=502, detail=detail)

    latency_ms = (time.perf_counter() - started_at) * 1000
    relevance = round(sum(float(item.get("score", 0)) for item in items) / len(items), 3)
    faithfulness = _faithfulness_score(response, citations)
    record_evaluation(current_user["id"], request.document_id, relevance, faithfulness, latency_ms, len(citations))
    return ChatResponse(
        response=response,
        citations=[Citation(**citation) for citation in citations],
        metrics=ResponseMetrics(latency_ms=round(latency_ms, 1), retrieval_relevance=relevance, faithfulness=faithfulness),
    )


@app.get("/evaluation/summary")
async def evaluation_summary(current_user: dict = Depends(get_current_user)):
    return get_evaluation_summary(current_user["id"])
