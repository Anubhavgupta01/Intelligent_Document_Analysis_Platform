from typing import Any, Dict, List, Tuple
import re


class InMemoryRAGIndex:
    """Small lexical retrieval index with page-aware source metadata."""

    def __init__(self, embedding_model_name: str = "lexical-embeddings") -> None:
        self.embedding_model_name = embedding_model_name
        self.doc_id_to_chunks: Dict[str, List[Dict[str, Any]]] = {}

    @staticmethod
    def chunk_text(text: str, max_tokens: int = 256) -> List[str]:
        words = re.split(r"\s+", text.strip())
        chunks: List[str] = []
        current: List[str] = []
        for word in words:
            if not word:
                continue
            current.append(word)
            if len(current) >= max_tokens:
                chunks.append(" ".join(current))
                current = []
        if current:
            chunks.append(" ".join(current))
        return chunks

    def build_index_for_document(
        self,
        document_id: str,
        text: str,
        pages: list[dict[str, Any]] | None = None,
    ) -> None:
        """Index page chunks and retain their page number for citations."""
        page_items = pages or [{"page": 1, "text": text}]
        indexed: List[Dict[str, Any]] = []
        for page_item in page_items:
            page_number = int(page_item.get("page", 1))
            page_text = str(page_item.get("text", "")).strip()
            for chunk_index, chunk in enumerate(self.chunk_text(page_text)):
                indexed.append({
                    "text": chunk,
                    "page": page_number,
                    "chunk_index": chunk_index,
                })
        if not indexed and text.strip():
            indexed.append({"text": text.strip(), "page": 1, "chunk_index": 0})
        for index, item in enumerate(indexed):
            item["score"] = max(0.9 - (index * 0.05), 0.1)
        self.doc_id_to_chunks[document_id] = indexed

    def retrieve_with_metadata(self, document_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        if document_id not in self.doc_id_to_chunks:
            raise KeyError("document_id not indexed")

        query_terms = {term.lower() for term in re.findall(r"\w+", query) if len(term) > 2}
        chunks = self.doc_id_to_chunks[document_id]
        ranked: list[tuple[float, int, Dict[str, Any]]] = []
        for index, item in enumerate(chunks):
            text_terms = {term.lower() for term in re.findall(r"\w+", item["text"]) if len(term) > 2}
            overlap = len(query_terms & text_terms) / max(len(query_terms), 1)
            score = min(1.0, 0.35 + (overlap * 0.65)) if query_terms else item["score"]
            ranked.append((score, index, {**item, "score": round(score, 3)}))
        ranked.sort(key=lambda entry: (-entry[0], entry[1]))
        return [entry[2] for entry in ranked[:top_k]]

    def retrieve(self, document_id: str, query: str, top_k: int = 4) -> List[Tuple[str, float]]:
        return [(item["text"], item["score"]) for item in self.retrieve_with_metadata(document_id, query, top_k)]
