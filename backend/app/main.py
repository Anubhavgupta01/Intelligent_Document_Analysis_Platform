from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, Form, HTTPException, Request
from typing import Optional
import uuid
import os

from dotenv import load_dotenv

load_dotenv()

from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document

from .deps import summarize_text, answer_question, generate_key_points, generate_action_tasks
from .rag import InMemoryRAGIndex
from .models import generate_chat_response, log_ai_configuration
from .auth import auth_router, get_current_user

app = FastAPI(title="Intelligent Document Analysis Platform API")
# Include authentication router
app.include_router(auth_router)

@app.on_event("startup")
async def startup_event():
    log_ai_configuration()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory document/text store and RAG index
# Each entry: {"user_id": str, "text": str}
DOCUMENTS: dict[str, dict] = {}
RAG = InMemoryRAGIndex()


class SummarizeRequest(BaseModel):
    text: Optional[str] = None
    document_id: Optional[str] = None


class QARequest(BaseModel):
    context: Optional[str] = None
    question: str
    document_id: Optional[str] = None


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    message: str
    document_id: Optional[str] = None
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str


@app.get("/health")
async def health():
    return {"status": "ok"}


import logging
logger = logging.getLogger(__name__)


def extract_text_from_file_data(data: bytes, filename: str, content_type: str) -> str:
    filename_lower = (filename or "").strip().lower()
    content_type_lower = (content_type or "").strip().lower()
    file_size = len(data)

    logger.info(f"Processing text extraction: filename='{filename}', content_type='{content_type}', size={file_size} bytes")

    if not data or file_size == 0:
        logger.warning(f"File '{filename}' upload is empty (0 bytes)")
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

    # 1. PDF Detection: check magic bytes (%PDF- in first 1024 bytes), extension (.pdf), or content-type (pdf)
    has_pdf_header = b"%PDF-" in data[:1024]
    has_pdf_ext = filename_lower.endswith(".pdf")
    has_pdf_mime = "pdf" in content_type_lower

    is_pdf = has_pdf_header or has_pdf_ext or has_pdf_mime

    if is_pdf:
        logger.info(
            f"File '{filename}' detected as PDF (header_match={has_pdf_header}, "
            f"ext_match={has_pdf_ext}, mime_match={has_pdf_mime}, size={file_size} bytes)"
        )
        from io import BytesIO
        try:
            reader = PdfReader(BytesIO(data))
            num_pages = len(reader.pages)
            logger.info(f"PDF '{filename}' parsed structure successfully; total pages: {num_pages}")
            pages_text = []

            for i, page in enumerate(reader.pages):
                page_text = ""
                try:
                    page_text = page.extract_text() or ""
                except Exception as page_err:
                    logger.warning(f"pypdf standard extract_text failed on page {i+1}/{num_pages} of '{filename}': {page_err}")

                # Fallback to layout mode if standard extraction yielded empty text
                if not page_text.strip():
                    try:
                        page_text = page.extract_text(extraction_mode="layout") or ""
                        if page_text.strip():
                            logger.info(f"Page {i+1} standard mode was empty; layout mode successfully extracted {len(page_text.strip())} chars")
                    except Exception as layout_err:
                        logger.warning(f"pypdf layout extract_text failed on page {i+1}/{num_pages} of '{filename}': {layout_err}")

                logger.info(f"Page {i+1}/{num_pages} extracted {len(page_text.strip())} chars")
                pages_text.append(page_text)

            text = "\n".join(pages_text).strip()
            if text:
                logger.info(f"Successfully extracted {len(text)} total characters from PDF '{filename}' across {num_pages} pages")
                return text
            else:
                logger.warning(f"PDF '{filename}' contained 0 extractable text characters across {num_pages} pages")
                raise HTTPException(
                    status_code=400,
                    detail="This PDF file appears to be scanned or image-based with no embedded text layer. Please upload a text-searchable PDF or document."
                )
        except HTTPException:
            raise
        except Exception as pdf_err:
            logger.exception(f"PdfReader failed to parse PDF '{filename}' (size={file_size} bytes): {pdf_err}")
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF file structure: {str(pdf_err)}")

    # 2. DOCX Detection
    is_docx = (
        filename_lower.endswith((".docx", ".doc"))
        or "word" in content_type_lower
        or "officedocument" in content_type_lower
        or (data.startswith(b"PK\x03\x04") and not is_pdf)
    )
    if is_docx:
        logger.info(f"File '{filename}' detected as DOCX (size={file_size} bytes)")
        from io import BytesIO
        try:
            doc = Document(BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs).strip()
            if text:
                logger.info(f"Successfully extracted {len(text)} total characters from DOCX '{filename}'")
                return text
            else:
                logger.warning(f"DOCX '{filename}' contains 0 readable text paragraphs")
                raise HTTPException(status_code=400, detail="The DOCX file contains no readable text paragraphs.")
        except HTTPException:
            raise
        except Exception as docx_err:
            logger.exception(f"DOCX parser failed for '{filename}' (size={file_size} bytes): {docx_err}")
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX file structure: {str(docx_err)}")

    # 3. Plain Text Fallback
    logger.info(f"File '{filename}' falling back to plain text decoding (size={file_size} bytes)")
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
        try:
            text = data.decode(encoding).strip()
            if text and any(c.isalnum() for c in text):
                logger.info(f"Successfully decoded plain text ({encoding}) with {len(text)} characters for '{filename}'")
                return text
        except UnicodeDecodeError:
            continue

    logger.warning(f"Unable to extract text from file '{filename}' (size={file_size} bytes, content_type='{content_type}')")
    raise HTTPException(status_code=400, detail="Unable to extract text from file")


@app.post("/upload")
async def upload(file: UploadFile = File(...), _current_user: dict = Depends(get_current_user)):
    try:
        data = await file.read()
        if not data or len(data) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes)")

        text = extract_text_from_file_data(data, file.filename or "", file.content_type or "")

        doc_id = str(uuid.uuid4())
        DOCUMENTS[doc_id] = text

        # Build RAG index for this document
        try:
            RAG.build_index_for_document(doc_id, text)
        except Exception as rag_err:
            logger.warning(f"RAG indexing warning for doc {doc_id}: {rag_err}")

        return {"document_id": doc_id, "characters": len(text)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in /upload endpoint for file '{file.filename}': {e}")
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")
    finally:
        await file.close()

@app.post("/summarize")
async def summarize(request: Request, _current_user: dict = Depends(get_current_user)):
    target_doc_id = None
    target_text = None

    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                target_doc_id = body.get("document_id")
                target_text = body.get("text")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            target_doc_id = form.get("document_id")
            target_text = form.get("text")
        except Exception:
            pass

    if not target_doc_id and not target_text:
        raise HTTPException(status_code=400, detail="Provide document_id or text")

    if target_doc_id:
        context = DOCUMENTS.get(target_doc_id)
        if context is None:
            raise HTTPException(status_code=404, detail="document_id not found")
    else:
        context = target_text or ""

    if not context.strip():
        raise HTTPException(status_code=400, detail="Extracted document text is empty")

    try:
        summary = summarize_text(context)
        key_points = generate_key_points(context, num_points=3)
        tasks = generate_action_tasks(context, num_tasks=2)
        return {"summary": summary, "key_points": key_points, "tasks": tasks}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Summarization endpoint failed: {e}")
        err_str = str(e)
        if "401" in err_str or "Unauthorized" in err_str or "invalid" in err_str.lower():
            raise HTTPException(status_code=401, detail="Hugging Face API key invalid or unauthorized")
        elif "429" in err_str or "Rate limit" in err_str:
            raise HTTPException(status_code=429, detail="Hugging Face API rate limit exceeded")
        elif "503" in err_str or "loading" in err_str.lower() or "unavailable" in err_str.lower():
            raise HTTPException(status_code=503, detail="AI Model service is currently loading or unavailable")
        else:
            raise HTTPException(status_code=500, detail=f"Summarization error: {err_str}")


@app.post("/qa")
async def qa(request: Request, _current_user: dict = Depends(get_current_user)):
    target_doc_id = None
    target_context = None
    q = None

    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                target_doc_id = body.get("document_id")
                target_context = body.get("context")
                q = body.get("question")
        except Exception:
            pass
    else:
        try:
            form = await request.form()
            target_doc_id = form.get("document_id")
            target_context = form.get("context")
            q = form.get("question")
        except Exception:
            pass

    if not q or not str(q).strip():
        raise HTTPException(status_code=400, detail="Missing question")
    if not target_doc_id and not target_context:
        raise HTTPException(status_code=400, detail="Provide document_id or context")

    doc_text = ""
    if target_doc_id:
        try:
            chunks = RAG.retrieve(target_doc_id, q, top_k=4)
            retrieved = "\n---\n".join(c for c, _ in chunks)
            doc_text = retrieved if retrieved.strip() else DOCUMENTS.get(target_doc_id, "")
        except Exception:
            doc_text = DOCUMENTS.get(target_doc_id, "")
        if not doc_text:
            raise HTTPException(status_code=404, detail="document_id not found")
    else:
        doc_text = target_context or ""

    answer = answer_question(doc_text, q)
    return {"answer": answer}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, _current_user: dict = Depends(get_current_user)):
    """
    Chat endpoint using Meta LLaMA 3.1-8B-Instruct
    Accepts a message and conversation history, returns AI response
    """
    try:
        # Convert Pydantic models to dict format for the model
        messages = []
        
        # Add system message for context
        # Get uploaded document
        document_text = ""

        if request.document_id:
            document_text = DOCUMENTS.get(request.document_id, "")

        messages.append({
            "role": "system",
            "content": f"""
            You are a helpful AI research assistant.
            Answer the user's questions using the uploaded document below.
            Document:
            {document_text}
            """
        })
        
        # Add conversation history
        for msg in request.history:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": request.message
        })
        
        # Generate response using Meta LLaMA
        response = generate_chat_response(messages, max_new_tokens=512)
        
        return ChatResponse(response=response)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat endpoint error: {e}")
        err_str = str(e)
        if "401" in err_str or "Unauthorized" in err_str or "invalid" in err_str.lower():
            raise HTTPException(status_code=401, detail="Hugging Face API key invalid or unauthorized")
        elif "429" in err_str or "Rate limit" in err_str:
            raise HTTPException(status_code=429, detail="Hugging Face API rate limit exceeded")
        elif "503" in err_str or "loading" in err_str.lower() or "unavailable" in err_str.lower():
            raise HTTPException(status_code=503, detail="AI Model service is currently loading or unavailable")
        else:
            raise HTTPException(status_code=500, detail=f"Chat generation error: {err_str}")
