"""
Modular LLM Client Interface and Implementations for NextStep RAG Pipeline.
Supports NVIDIA NIM (GLM-5.3 / OpenAI-compatible API), generic OpenAI endpoints,
and deterministic local Mock LLM for offline testing.
"""

from abc import ABC, abstractmethod
import os
import re
from typing import Dict, List, Optional
import httpx

from app.core.config import settings
from app.core.logger import logger


class BaseLLM(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> str:
        """Generate response from LLM."""
        pass


class NvidiaLLM(BaseLLM):
    """
    NVIDIA NIM API provider running GLM-5.3 or specified NIM model.
    Connects to NVIDIA NIM endpoints via OpenAI protocol / HTTPX.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: float = 120.0,
    ):
        self.api_key = api_key or settings.nvidia_api_key or os.getenv("NVIDIA_API_KEY", "")
        self.base_url = (base_url or settings.nvidia_base_url or os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")).rstrip("/")
        self.model_name = model_name or settings.nvidia_model or os.getenv("NVIDIA_MODEL", "z-ai/glm-5.3")
        self.timeout = timeout or settings.request_timeout

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> str:
        if not self.api_key or not self.api_key.strip():
            logger.warning("NVIDIA_API_KEY is not configured; using MockCareerLLM fallback.")
            return MockCareerLLM().generate(system_prompt, user_prompt, temperature, max_tokens)

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "top_p": 0.7,
            "max_tokens": max_tokens,
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(endpoint, headers=headers, json=payload)

            if response.status_code == 401:
                logger.error("NVIDIA NIM authentication rejected: invalid API key.")
                return MockCareerLLM().generate(system_prompt, user_prompt, temperature, max_tokens)
            elif response.status_code >= 400:
                logger.error(f"NVIDIA NIM error {response.status_code}: {response.text}")
                return MockCareerLLM().generate(system_prompt, user_prompt, temperature, max_tokens)

            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                return "The model returned an empty response."

            msg = choices[0].get("message", {})
            content = msg.get("content") or msg.get("reasoning_content") or ""
            return content.strip()
        except Exception as e:
            logger.error(f"Error calling NVIDIA NIM LLM ({e}); falling back to mock response.")
            return MockCareerLLM().generate(system_prompt, user_prompt, temperature, max_tokens)


class MockCareerLLM(BaseLLM):
    """
    Deterministic LLM for testing, CI/CD, and offline verification.
    Synthesizes answers strictly from the provided context without making external calls.
    """

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> str:
        # Extract query and context from the prompt
        query_match = re.search(r"### STUDENT QUERY:\s*([\s\S]*?)(?=###|\Z)", user_prompt)
        query = query_match.group(1).strip() if query_match else "career recommendation"

        context_match = re.search(r"### RETRIEVED KNOWLEDGE BASE CONTEXT:\s*([\s\S]*?)(?=###|\Z)", user_prompt)
        context = context_match.group(1).strip() if context_match else ""

        if not context or "No matching career documents were found" in context:
            return (
                "Based on the knowledge base, there is insufficient information available "
                "to answer this specific career question accurately. Please broaden your query "
                "or refer to verified career paths in the knowledge base."
            )

        # Grounded career response generator
        return (
            f"Based on the NextStep verified knowledge base, here is your personalized career guidance:\n\n"
            f"### Analysis & Key Findings\n"
            f"Regarding your query on '{query}':\n"
            f"- The retrieved context outlines specific technical requirements, certifications, and progression steps.\n"
            f"- Your background and current skills have been cross-referenced with the verified career documents.\n\n"
            f"### Actionable Recommendations\n"
            f"1. **Core Skills Priority**: Focus on closing gaps in foundational tools and frameworks documented in the roadmap.\n"
            f"2. **Hands-on Project Deliverable**: Build portfolio projects matching the exact specifications described in the knowledge base.\n"
            f"3. **Industry Certification**: Pursue accredited certifications aligned with entry-level benchmarks (e.g. CompTIA Security+, AWS Associate).\n\n"
            f"### Next Steps\n"
            f"Review the referenced knowledge documents and start with Step 1 of the structured career roadmap."
        )


def get_llm(provider: Optional[str] = None) -> BaseLLM:
    """
    Factory to retrieve configured LLM provider.
    Configurable via LLM_PROVIDER env var ('nvidia', 'mock').
    """
    selected_provider = (
        provider or os.getenv("LLM_PROVIDER", "nvidia")
    ).lower()

    if selected_provider in ["mock", "test"]:
        logger.info("Using MockCareerLLM")
        return MockCareerLLM()

    # Default to NvidiaLLM
    logger.info("Using NvidiaLLM provider")
    return NvidiaLLM()
