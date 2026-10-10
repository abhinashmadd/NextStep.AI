"""
Document Ingestion Pipeline for NextStep Knowledge Base.
Scans knowledge_base/, parses JSON/JSONL/Markdown files, cleans content, chunks documents,
enriches metadata, computes incremental content hashes, generates embeddings,
and updates the vector database.
"""

import glob
import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from app.core.logger import logger
from rag.vector_store import BaseVectorStore, VectorDocument, get_vector_store


class KnowledgeBaseIngestion:
    """
    Handles incremental loading and ingestion of career knowledge base documents.
    """

    def __init__(
        self,
        knowledge_base_dir: str = "knowledge_base",
        vector_store: Optional[BaseVectorStore] = None,
        manifest_path: str = "data/vector_db/ingestion_manifest.json",
        chunk_size: int = 600,
        chunk_overlap: int = 100,
    ):
        self.kb_dir = knowledge_base_dir
        self.vector_store = vector_store or get_vector_store()
        self.manifest_path = manifest_path
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.manifest = self._load_manifest()

    def _load_manifest(self) -> Dict[str, str]:
        """Loads the content hash manifest to support incremental ingestion."""
        if os.path.exists(self.manifest_path):
            try:
                with open(self.manifest_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Could not read ingestion manifest ({e}); starting fresh.")
        return {}

    def _save_manifest(self) -> None:
        """Persists the updated manifest of processed file hashes."""
        os.makedirs(os.path.dirname(self.manifest_path), exist_ok=True)
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(self.manifest, f, indent=2)

    def _compute_file_hash(self, filepath: str) -> str:
        """Computes SHA-256 hash of a file for incremental change detection."""
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _clean_text(self, text: str) -> str:
        """Cleans and normalizes text whitespace and formatting."""
        text = re.sub(r"\r\n", "\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _chunk_text(self, text: str, header_context: str = "") -> List[str]:
        """
        Splits text into meaningful semantic chunks respecting sentence boundaries.
        Prepends header context to each chunk to preserve retrieval context.
        """
        cleaned = self._clean_text(text)
        if len(cleaned) <= self.chunk_size:
            chunk = f"{header_context}\n{cleaned}".strip() if header_context else cleaned
            return [chunk]

        # Split into sentences or paragraphs
        paragraphs = cleaned.split("\n\n")
        chunks: List[str] = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                current_chunk = f"{current_chunk}\n\n{para}" if current_chunk else para
            else:
                if current_chunk:
                    full_chunk = f"{header_context}\n{current_chunk}".strip() if header_context else current_chunk
                    chunks.append(full_chunk)

                # If a single paragraph is larger than chunk size, split by lines/sentences
                if len(para) > self.chunk_size:
                    sentences = re.split(r"(?<=[.!?])\s+", para)
                    sub_chunk = ""
                    for s in sentences:
                        if len(sub_chunk) + len(s) + 1 <= self.chunk_size:
                            sub_chunk = f"{sub_chunk} {s}" if sub_chunk else s
                        else:
                            if sub_chunk:
                                full_s_chunk = f"{header_context}\n{sub_chunk}".strip() if header_context else sub_chunk
                                chunks.append(full_s_chunk)
                            sub_chunk = s
                    current_chunk = sub_chunk
                else:
                    current_chunk = para

        if current_chunk:
            full_chunk = f"{header_context}\n{current_chunk}".strip() if header_context else current_chunk
            chunks.append(full_chunk)

        return chunks

    def _parse_json_document(self, filepath: str, data: Dict[str, Any]) -> List[VectorDocument]:
        """Converts structured JSON knowledge document into VectorDocuments."""
        docs: List[VectorDocument] = []
        base_id = data.get("id") or os.path.splitext(os.path.basename(filepath))[0]
        category = data.get("category") or os.path.basename(os.path.dirname(filepath))
        title = data.get("title") or base_id.replace("_", " ").title()
        source = data.get("source") or f"NextStep KB - {title}"

        # Common metadata
        base_meta = {
            "source_file": filepath,
            "category": category,
            "title": title,
            "source": source,
            "career": data.get("target_career") or data.get("career", ""),
            "role": data.get("title", ""),
            "difficulty": data.get("difficulty", "all"),
            "industry": data.get("industry", ""),
            "education": ", ".join(data.get("education_requirements", [])) if isinstance(data.get("education_requirements"), list) else str(data.get("education_requirements", "")),
        }

        # 1. Career profiles
        if "overview" in data or "career_roadmap" in data:
            overview_text = (
                f"Career Role: {title}\n"
                f"Industry: {base_meta['industry']}\n"
                f"Difficulty: {base_meta['difficulty']}\n"
                f"Overview: {data.get('overview', '')}\n"
            )
            if data.get("required_technical_skills"):
                tech_skills_str = "\n".join(f"- {s}" for s in data["required_technical_skills"])
                overview_text += f"\nRequired Technical Skills:\n{tech_skills_str}\n"

            if data.get("required_soft_skills"):
                soft_skills_str = "\n".join(f"- {s}" for s in data["required_soft_skills"])
                overview_text += f"\nRequired Soft Skills:\n{soft_skills_str}\n"

            if data.get("recommended_certifications"):
                certs_str = "\n".join(f"- {c}" for c in data["recommended_certifications"])
                overview_text += f"\nRecommended Certifications:\n{certs_str}\n"

            if data.get("career_roadmap"):
                roadmap_str = "\n".join(data["career_roadmap"])
                overview_text += f"\nCareer Roadmap & Progression:\n{roadmap_str}\n"

            chunks = self._chunk_text(overview_text, header_context=f"Career Profile: {title}")
            for c_idx, chunk in enumerate(chunks):
                meta = dict(base_meta)
                meta["skills"] = ", ".join(data.get("required_technical_skills", []))
                docs.append(VectorDocument(id=f"{base_id}_chunk_{c_idx}", text=chunk, metadata=meta))

        # 2. Lists of items (skills catalog, certifications, technologies, projects, resources)
        list_keys = ["skills", "certifications", "technologies", "projects", "resources", "trees"]
        for lk in list_keys:
            if lk in data and isinstance(data[lk], list):
                for item_idx, item in enumerate(data[lk]):
                    item_name = item.get("name") or item.get("title") or f"{lk}_{item_idx}"
                    header = f"{title} > {item_name}"
                    item_json_str = json.dumps(item, indent=2)

                    meta = dict(base_meta)
                    meta["role"] = item.get("target_career") or base_meta["career"]
                    meta["skills"] = ", ".join(item.get("skills_developed", [])) or item.get("name", "")
                    meta["difficulty"] = item.get("difficulty") or item.get("level") or base_meta["difficulty"]

                    # Convert structured fields to descriptive readable paragraph
                    item_text = f"Item: {item_name}\nCategory: {category}\n"
                    for k, v in item.items():
                        if isinstance(v, list):
                            item_text += f"{k.replace('_', ' ').title()}: {', '.join(str(x) for x in v)}\n"
                        elif isinstance(v, dict):
                            item_text += f"{k.replace('_', ' ').title()}: {json.dumps(v)}\n"
                        else:
                            item_text += f"{k.replace('_', ' ').title()}: {v}\n"

                    chunks = self._chunk_text(item_text, header_context=header)
                    for c_idx, chunk in enumerate(chunks):
                        docs.append(VectorDocument(id=f"{base_id}_{lk}_{item_idx}_{c_idx}", text=chunk, metadata=meta))

        return docs

    def _parse_markdown_document(self, filepath: str, content: str) -> List[VectorDocument]:
        """Parses Markdown files with optional YAML frontmatter."""
        docs: List[VectorDocument] = []
        base_id = os.path.splitext(os.path.basename(filepath))[0]
        category = os.path.basename(os.path.dirname(filepath))

        frontmatter: Dict[str, Any] = {}
        body = content

        # Extract YAML frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                raw_fm = parts[1]
                body = parts[2]
                for line in raw_fm.splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        frontmatter[k.strip()] = v.strip().strip('"').strip("'")

        title = frontmatter.get("title") or base_id.replace("_", " ").title()
        meta = {
            "source_file": filepath,
            "category": frontmatter.get("category", category),
            "title": title,
            "source": frontmatter.get("source", f"NextStep KB - {title}"),
            "career": frontmatter.get("target_career", ""),
            "role": title,
            "difficulty": frontmatter.get("difficulty", "intermediate"),
            "industry": frontmatter.get("industry", ""),
            "education": frontmatter.get("education", ""),
        }

        chunks = self._chunk_text(body, header_context=f"Document: {title}")
        for c_idx, chunk in enumerate(chunks):
            chunk_meta = dict(meta)
            docs.append(VectorDocument(id=f"{base_id}_md_{c_idx}", text=chunk, metadata=chunk_meta))

        return docs

    def ingest_all(self, force_reingest: bool = False) -> Dict[str, Any]:
        """
        Scans knowledge_base/ recursively and processes all JSON, JSONL, and Markdown files.
        Skips unchanged files based on SHA-256 hash unless force_reingest is True.
        """
        logger.info(f"Starting knowledge base ingestion from '{self.kb_dir}' (force={force_reingest})")
        if not os.path.exists(self.kb_dir):
            raise FileNotFoundError(f"Knowledge base directory '{self.kb_dir}' not found.")

        if self.vector_store.count() == 0:
            logger.info("Vector store is empty; forcing full ingestion.")
            force_reingest = True

        scanned_files = 0
        skipped_files = 0
        processed_files = 0
        all_new_documents: List[VectorDocument] = []
        updated_manifest = dict(self.manifest) if not force_reingest else {}

        if force_reingest:
            logger.info("Clearing vector store for full re-ingestion.")
            self.vector_store.clear()

        # Find all files
        pattern = os.path.join(self.kb_dir, "**", "*.*")
        file_paths = glob.glob(pattern, recursive=True)

        for filepath in file_paths:
            ext = os.path.splitext(filepath)[1].lower()
            if ext not in [".json", ".jsonl", ".md"]:
                continue

            scanned_files += 1
            file_hash = self._compute_file_hash(filepath)

            # Check incremental hash
            if not force_reingest and self.manifest.get(filepath) == file_hash:
                skipped_files += 1
                continue

            processed_files += 1
            logger.info(f"Processing knowledge document: {filepath}")

            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()

                docs_for_file: List[VectorDocument] = []
                if ext == ".json":
                    data = json.loads(content)
                    docs_for_file = self._parse_json_document(filepath, data)
                elif ext == ".jsonl":
                    for line in content.splitlines():
                        if line.strip():
                            line_data = json.loads(line)
                            docs_for_file.extend(self._parse_json_document(filepath, line_data))
                elif ext == ".md":
                    docs_for_file = self._parse_markdown_document(filepath, content)

                all_new_documents.extend(docs_for_file)
                updated_manifest[filepath] = file_hash
            except Exception as e:
                logger.error(f"Failed to process {filepath}: {e}")

        # Add to vector store
        if all_new_documents:
            logger.info(f"Storing {len(all_new_documents)} chunks into the vector store...")
            self.vector_store.add_documents(all_new_documents)
            self.manifest = updated_manifest
            self._save_manifest()
        else:
            logger.info("No new or modified documents detected. Ingestion up to date.")

        summary = {
            "scanned_files": scanned_files,
            "processed_files": processed_files,
            "skipped_files": skipped_files,
            "chunks_ingested": len(all_new_documents),
            "total_documents_in_store": self.vector_store.count(),
            "status": "success",
        }
        logger.info(f"Ingestion completed: {summary}")
        return summary


def run_ingestion(force_reingest: bool = False) -> Dict[str, Any]:
    """Helper entry point for CLI or API invocation."""
    ingestor = KnowledgeBaseIngestion()
    return ingestor.ingest_all(force_reingest=force_reingest)
