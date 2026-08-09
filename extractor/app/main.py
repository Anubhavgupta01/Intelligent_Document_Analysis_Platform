from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional

import re
from io import BytesIO

import httpx
from pypdf import PdfReader
from bs4 import BeautifulSoup

app = FastAPI(title="Text Extractor Service")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


class UrlRequest(BaseModel):
	url: HttpUrl


@app.get("/health")
async def health():
	return {"status": "ok"}


async def extract_text_from_pdf_bytes(data: bytes) -> str:
	reader = PdfReader(BytesIO(data))
	texts = []
	for page in reader.pages:
		t = ""
		try:
			t = page.extract_text() or ""
		except Exception:
			t = ""
		if not t.strip():
			try:
				t = page.extract_text(extraction_mode="layout") or ""
			except Exception:
				t = ""
		texts.append(t)
	return "\n".join(texts).strip()


async def extract_text_from_url(url: str) -> str:
	async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
		resp = await client.get(url)
		resp.raise_for_status()
		content_type = resp.headers.get("content-type", "")
		data = resp.content
		if "pdf" in content_type or url.lower().endswith(".pdf") or b"%PDF-" in data[:1024]:
			return await extract_text_from_pdf_bytes(data)
		# HTML fallback
		soup = BeautifulSoup(data, "html.parser")
		# Remove scripts/styles
		for tag in soup(["script", "style", "noscript"]):
			tag.extract()
		text = soup.get_text(separator="\n")
		# Collapse whitespace
		text = re.sub(r"\s+", " ", text)
		return text.strip()


@app.post("/extract")
async def extract(file: Optional[UploadFile] = File(None), url: Optional[str] = Form(None), json: Optional[UrlRequest] = None):
	if json is not None:
		url = str(json.url)
	if file is None and not url:
		raise HTTPException(status_code=400, detail="Provide a PDF file or a URL")
	if file is not None:
		try:
			data = await file.read()
			text = await extract_text_from_pdf_bytes(data)
			return {"text": text}
		finally:
			await file.close()
	else:
		text = await extract_text_from_url(url)
		return {"text": text}
