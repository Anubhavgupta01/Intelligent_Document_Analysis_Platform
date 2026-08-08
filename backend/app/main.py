from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, Form, HTTPException
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
from .models import generate_chat_response
from .auth import auth_router, get_current_user

app = FastAPI(title="Intelligent Document Analysis Platform API")
# Include authentication router
app.include_router(auth_router)

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


@app.post("/upload")
async def upload(file: UploadFile = File(...), _current_user: dict = Depends(get_current_user)):
    try:
        content_type = file.content_type or ""
        text = ""
        data = await file.read()
        if content_type.endswith("pdf") or file.filename.lower().endswith(".pdf"):
            from io import BytesIO
            reader = PdfReader(BytesIO(data))
            pages_text = []
            for page in reader.pages:
                try:
                    pages_text.append(page.extract_text() or "")
                except Exception:
                    pages_text.append("")
            text = "\n".join(pages_text)
        elif content_type.endswith("msword") or content_type.endswith("officedocument.wordprocessingml.document") or file.filename.lower().endswith((".doc", ".docx")):
            from io import BytesIO
            doc = Document(BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs)
        else:
            # assume text-like
            try:
                text = data.decode("utf-8", errors="ignore")
            except Exception:
                text = ""
        if not text.strip():
            raise HTTPException(status_code=400, detail="Unable to extract text from file")
        doc_id = str(uuid.uuid4())
        DOCUMENTS[doc_id] = text
        # Build RAG index for this document
        try:
            RAG.build_index_for_document(doc_id, text)
        except Exception:
            pass
        return {"document_id": doc_id, "characters": len(text)}
    finally:
        await file.close()


@app.post("/summarize")
async def summarize(json: Optional[SummarizeRequest] = None, document_id: Optional[str] = Form(None), text: Optional[str] = Form(None), _current_user: dict = Depends(get_current_user)):
    # Prefer JSON body when provided
    if json is not None:
        if not json.document_id and not json.text:
            raise HTTPException(status_code=400, detail="Provide document_id or text")
        if json.document_id:
            context = DOCUMENTS.get(json.document_id)
            if context is None:
                raise HTTPException(status_code=404, detail="document_id not found")
        else:
            context = json.text or ""
    else:
        if not document_id and not text:
            raise HTTPException(status_code=400, detail="Provide document_id or text")
        if document_id:
            context = DOCUMENTS.get(document_id)
            if context is None:
                raise HTTPException(status_code=404, detail="document_id not found")
        else:
            context = text or ""
    summary = summarize_text(context)
    key_points = generate_key_points(context, num_points=3)
    tasks = generate_action_tasks(context, num_tasks=2)
    return {"summary": summary, "key_points": key_points, "tasks": tasks}


@app.post("/qa")
async def qa(json: Optional[QARequest] = None, question: Optional[str] = Form(None), document_id: Optional[str] = Form(None), context: Optional[str] = Form(None), _current_user: dict = Depends(get_current_user)):
    if json is not None:
        if not json.document_id and not (json.context or ""):
            raise HTTPException(status_code=400, detail="Provide document_id or context")
        if json.document_id:
            # Prefer RAG retrieval
            try:
                chunks = RAG.retrieve(json.document_id, json.question, top_k=4)
                retrieved = "\n---\n".join(c for c, _ in chunks)
                doc_text = retrieved if retrieved.strip() else DOCUMENTS.get(json.document_id, "")
            except Exception:
                doc_text = DOCUMENTS.get(json.document_id)
                if doc_text is None:
                    raise HTTPException(status_code=404, detail="document_id not found")
        else:
            doc_text = json.context or ""
        q = json.question
    else:
        if not question:
            raise HTTPException(status_code=400, detail="Missing question")
        if not document_id and not (context or ""):
            raise HTTPException(status_code=400, detail="Provide document_id or context")
        if document_id:
            try:
                chunks = RAG.retrieve(document_id, question, top_k=4)
                retrieved = "\n---\n".join(c for c, _ in chunks)
                doc_text = retrieved if retrieved.strip() else DOCUMENTS.get(document_id, "")
            except Exception:
                doc_text = DOCUMENTS.get(document_id)
                if doc_text is None:
                    raise HTTPException(status_code=404, detail="document_id not found")
        else:
            doc_text = context or ""
        q = question
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
        
    except Exception as e:
        # Log the error but don't expose internal details
        import logging
        logging.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate response")
