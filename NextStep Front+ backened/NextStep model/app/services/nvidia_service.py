import json
import re
from typing import Dict, Any, List, Optional
# pyrefly: ignore [missing-import]
import httpx

from app.core.config import settings
from app.core.logger import logger
from app.core.exceptions import (
    MissingAPIKeyError,
    InvalidAPIKeyError,
    NVIDIAAPITimeoutError,
    NVIDIAAPIError,
    InvalidAIResponseError,
    EmptyEvidenceError,
)

# Optional import of openai SDK (with fallback to pure HTTPX if native DLLs are restricted)
try:
    from openai import OpenAI, AuthenticationError, APITimeoutError, APIStatusError, APIConnectionError
    OPENAI_AVAILABLE = True
except Exception as e:
    OPENAI_AVAILABLE = False
    logger.warning(f"OpenAI SDK binary loading unavailable ({e}); utilizing HTTPX client.")


class NvidiaAIService:
    """
    Secure backend-only service interfacing with NVIDIA NIM GLM-5.3.
    Communicates via the OpenAI-compatible API protocol.
    Supports both OpenAI SDK and HTTPX fallback for maximum reliability.
    """

    def __init__(self):
        self._openai_client: Optional[Any] = None

    def _get_openai_client(self):
        """Lazily initialize and validate the OpenAI SDK client."""
        if not settings.is_nvidia_configured:
            logger.error("NVIDIA API call failed: NVIDIA_API_KEY is not configured.")
            raise MissingAPIKeyError()

        if self._openai_client is None and OPENAI_AVAILABLE:
            self._openai_client = OpenAI(
                base_url=settings.nvidia_base_url,
                api_key=settings.nvidia_api_key,
                timeout=settings.request_timeout,
            )
        return self._openai_client

    def _call_nvidia_completions(self, messages: List[Dict[str, str]]) -> str:
        """
        Execute chat completion request to NVIDIA NIM.
        Uses OpenAI SDK if available, gracefully falling back to HTTPX if
        environment policy restrictions (e.g., AppLocker/WDAC) prevent jiter DLL loading.
        """
        if not settings.is_nvidia_configured:
            logger.error("NVIDIA API call failed: NVIDIA_API_KEY is not configured.")
            raise MissingAPIKeyError()

        # Try OpenAI SDK first
        if OPENAI_AVAILABLE:
            try:
                client = self._get_openai_client()
                if client:
                    completion = client.chat.completions.create(
                        model=settings.nvidia_model,
                        messages=messages,
                        temperature=0.2,
                        top_p=0.7,
                        max_tokens=4096,
                    )
                    choice = completion.choices[0]
                    content = choice.message.content
                    if not content and hasattr(choice.message, "reasoning_content"):
                        content = choice.message.reasoning_content
                    return content or ""
            except AuthenticationError as e:
                logger.error("NVIDIA NIM authentication rejected: invalid or unauthorized API key.")
                raise InvalidAPIKeyError() from e
            except APITimeoutError as e:
                logger.error(f"NVIDIA NIM GLM-5.3 timed out after {settings.request_timeout}s.")
                raise NVIDIAAPITimeoutError() from e
            except APIStatusError as e:
                logger.error(f"NVIDIA NIM API error status code {e.status_code}: {e.message}")
                raise NVIDIAAPIError(
                    message=f"NVIDIA NIM returned status {e.status_code}: {e.message}",
                    status_code=e.status_code if e.status_code < 500 else 502,
                ) from e
            except APIConnectionError as e:
                logger.error("Failed to connect to NVIDIA NIM endpoints.")
                raise NVIDIAAPIError(message="Failed to connect to NVIDIA NIM gateway.", status_code=503) from e
            except (ImportError, OSError) as e:
                # Catch native DLL / AppLocker errors from jiter and proceed to HTTPX fallback
                logger.warning(f"OpenAI SDK native module encountered policy block ({e}). Switching to HTTPX client.")
            except Exception as e:
                if "DLL load failed" in str(e) or "policy has blocked" in str(e):
                    logger.warning("Application Control blocked native module in OpenAI SDK. Switching to HTTPX client.")
                else:
                    logger.error(f"Unexpected error communicating with NVIDIA NIM: {str(e)}")
                    raise NVIDIAAPIError(message=f"NVIDIA NIM invocation failure: {str(e)}") from e

        # Fallback to pure-Python HTTPX client (OpenAI-compatible protocol)
        endpoint = f"{settings.nvidia_base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.nvidia_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.nvidia_model,
            "messages": messages,
            "temperature": 0.2,
            "top_p": 0.7,
            "max_tokens": 4096,
        }

        try:
            with httpx.Client(timeout=settings.request_timeout) as http_client:
                response = http_client.post(endpoint, headers=headers, json=payload)
        except httpx.TimeoutException as e:
            logger.error(f"NVIDIA NIM GLM-5.3 timed out after {settings.request_timeout}s.")
            raise NVIDIAAPITimeoutError() from e
        except httpx.RequestError as e:
            logger.error(f"Failed to connect to NVIDIA NIM gateway: {str(e)}")
            raise NVIDIAAPIError(message=f"Failed to connect to NVIDIA NIM gateway: {str(e)}", status_code=503) from e

        if response.status_code == 401:
            logger.error("NVIDIA NIM authentication rejected: invalid or unauthorized API key.")
            raise InvalidAPIKeyError()
        elif response.status_code >= 400:
            logger.error(f"NVIDIA NIM returned error status {response.status_code}")
            raise NVIDIAAPIError(
                message=f"NVIDIA NIM returned status {response.status_code}",
                status_code=response.status_code if response.status_code < 500 else 502,
            )

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise InvalidAIResponseError("NVIDIA NIM response contained no choices.")

        msg = choices[0].get("message", {})
        content = msg.get("content")
        if not content:
            content = msg.get("reasoning_content")

        return content or ""

    def _extract_json_payload(self, text: str) -> Dict[str, Any]:
        """
        Robustly extract and parse JSON from the model's text response,
        handling markdown blocks, surrounding explanations, and trailing text.
        """
        if not text:
            raise InvalidAIResponseError("Model returned empty response content.")

        clean_text = text.strip()

        # 1. Handle ```json ... ``` blocks
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_text)
        if json_match:
            candidate = json_match.group(1).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                # Try raw_decode on the candidate block as well
                try:
                    s_idx = candidate.find("{")
                    if s_idx != -1:
                        obj, _ = json.JSONDecoder().raw_decode(candidate[s_idx:])
                        if isinstance(obj, dict):
                            return obj
                except Exception:
                    pass

        # 2. Try parsing full text directly
        try:
            return json.loads(clean_text)
        except json.JSONDecodeError:
            pass

        # 3. Locate opening brace and use JSONDecoder().raw_decode to parse without failing on trailing text
        start_idx = clean_text.find("{")
        if start_idx != -1:
            try:
                decoder = json.JSONDecoder()
                obj, _ = decoder.raw_decode(clean_text[start_idx:])
                if isinstance(obj, dict):
                    return obj
            except Exception as e:
                logger.debug(f"raw_decode failed: {e}")

        # 4. Fallback: try balanced bracket extraction
        open_count = 0
        start = -1
        for i, char in enumerate(clean_text):
            if char == "{":
                if open_count == 0:
                    start = i
                open_count += 1
            elif char == "}":
                open_count -= 1
                if open_count == 0 and start != -1:
                    candidate = clean_text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        continue

        logger.error(f"No valid JSON structure found in model response (len {len(text)}). Preview: {repr(text[:300])}")
        raise InvalidAIResponseError("No valid JSON block detected in NVIDIA GLM-5.3 output.")

    def analyze_career_readiness(
        self,
        student_profile: str,
        target_career: str,
        student_evidence: str,
        career_requirements: List[str],
    ) -> Dict[str, Any]:
        """
        Evaluates student profile and evidence against career requirements
        using NVIDIA NIM GLM-5.3.
        """
        # Validate inputs
        if not student_evidence or not student_evidence.strip():
            logger.warning("Empty student evidence supplied.")
            raise EmptyEvidenceError()

        requirements_str = ", ".join(career_requirements)

        system_prompt = (
            "You are NextStep AI, an expert technical career guidance and skill verification evaluator.\n"
            "Keep internal reasoning concise and focused. Directly output the complete valid JSON object.\n"
            "Your role is to strictly analyze student evidence (projects, code, repositories, experience) "
            "against the target career requirements.\n"
            "Rules:\n"
            "1. Only grant 'demonstrated_skills' if there is concrete evidence in the student's background.\n"
            "2. Identify clear 'skill_gaps' for requirements not yet proven.\n"
            "3. Identify practical 'strengths' and 'weaknesses'.\n"
            "4. Recommend EXACTLY ONE 'next_best_action' (highest ROI next step to close a critical gap).\n"
            "5. You MUST return ONLY valid JSON matching this exact schema, with no conversational filler:\n"
            "{\n"
            '  "demonstrated_skills": ["string"],\n'
            '  "skill_evidence": [{"skill": "string", "evidence": "string"}],\n'
            '  "skill_gaps": ["string"],\n'
            '  "strengths": ["string"],\n'
            '  "weaknesses": ["string"],\n'
            '  "readiness_score": 0,\n'
            '  "next_best_action": {\n'
            '    "title": "string",\n'
            '    "reason": "string",\n'
            '    "expected_outcome": "string",\n'
            '    "difficulty": "string",\n'
            '    "estimated_time": "string"\n'
            "  }\n"
            "}"
        )

        user_prompt = (
            f"Student Profile:\n{student_profile.strip()}\n\n"
            f"Target Career / Job Role:\n{target_career.strip()}\n\n"
            f"Career Requirements:\n{requirements_str}\n\n"
            f"Student Evidence:\n{student_evidence.strip()}\n\n"
            "Perform rigorous skill extraction and gap analysis. Output pure JSON."
        )

        logger.info(
            f"Dispatching career analysis to NVIDIA NIM GLM-5.3 for role: '{target_career}' "
            f"(requirements count: {len(career_requirements)})"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        raw_content = self._call_nvidia_completions(messages)

        if not raw_content:
            logger.error("NVIDIA NIM response contained empty content.")
            raise InvalidAIResponseError("NVIDIA NIM GLM-5.3 returned an empty response.")

        # Parse JSON
        parsed_result = self._extract_json_payload(raw_content)

        # Normalize skill_evidence if returned as dict
        if isinstance(parsed_result.get("skill_evidence"), dict):
            parsed_result["skill_evidence"] = [
                {"skill": k, "evidence": v}
                for k, v in parsed_result["skill_evidence"].items()
            ]

        return parsed_result


# Singleton instance
nvidia_ai_service = NvidiaAIService()
