"""
Context Builder for NextStep RAG Pipeline.
Deduplicates, groups, truncates, and formats retrieved documents into structured context for the LLM.
"""

from collections import defaultdict
import os
from typing import Dict, List, Optional, Tuple

from app.core.logger import logger
from rag.retriever import RetrievedDoc


class ContextBuilder:
    """
    Constructs high-signal, clean prompt context from retrieved career documents.
    Respects token/character limits and formats source citations clearly.
    """

    def __init__(self, max_tokens: int = 3500, max_characters: Optional[int] = None):
        # 1 token ~= 4 characters on average for English text
        self.max_tokens = int(os.getenv("MAX_CONTEXT_TOKENS", str(max_tokens)))
        self.max_characters = max_characters or (self.max_tokens * 4)

    def build_context(self, documents: List[RetrievedDoc]) -> Tuple[str, List[str]]:
        """
        Build structured context string from retrieved documents.
        Returns:
            Tuple of (formatted_context_string, list_of_cited_sources)
        """
        if not documents:
            logger.warning("No documents retrieved; building empty context.")
            return "No matching career documents were found in the knowledge base.", []

        # 1. Group documents by logical category or source
        categorized_docs: Dict[str, List[RetrievedDoc]] = defaultdict(list)
        for doc in documents:
            category = doc.metadata.get("category", "General Guidance").title()
            categorized_docs[category].append(doc)

        # 2. Assemble context blocks within character budget
        context_parts: List[str] = []
        cited_sources: List[str] = []
        current_char_count = 0

        # Sort categories for clean presentation
        category_order = ["Careers", "Skills", "Certifications", "Technologies", "Projects", "Learning_Resources"]
        sorted_categories = sorted(
            categorized_docs.keys(),
            key=lambda c: category_order.index(c) if c in category_order else 99,
        )

        for cat in sorted_categories:
            docs_in_cat = categorized_docs[cat]
            cat_header = f"\n=== {cat.upper()} ==="
            cat_parts = [cat_header]

            for doc in docs_in_cat:
                source_label = doc.source
                if source_label not in cited_sources:
                    cited_sources.append(source_label)

                doc_block = (
                    f"\n[Source: {source_label} | Score: {doc.score:.2f}]\n"
                    f"{doc.text.strip()}\n"
                )

                # Check budget
                if current_char_count + len(doc_block) > self.max_characters:
                    logger.info(
                        f"Context character budget reached ({current_char_count}/{self.max_characters}). "
                        "Truncating remaining documents."
                    )
                    break

                cat_parts.append(doc_block)
                current_char_count += len(doc_block)

            if len(cat_parts) > 1:
                context_parts.append("\n".join(cat_parts))

            if current_char_count >= self.max_characters:
                break

        full_context = "\n".join(context_parts).strip()
        return full_context, cited_sources
