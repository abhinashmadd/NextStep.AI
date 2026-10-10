"""
Skill Extraction Engine for NextStep.
Extracts canonical skills and estimates evidence-grounded proficiency levels (1-5)
from user profile text, resumes, projects, certifications, and queries.
"""

import re
from typing import Any, Dict, List, Optional
from app.core.logger import logger
from skill_graph.schemas import StudentSkill
from skill_graph.skill_normalizer import SkillNormalizer, skill_normalizer


# Evidence modifier keywords
LEVEL_MODIFIERS = {
    5: ["expert", "mastery", "principal", "architected", "production lead", "staff engineer"],
    4: ["advanced", "highly experienced", "senior", "production", "scalable", "in-depth", "years of experience"],
    3: ["built", "developed", "implemented", "created", "proficient", "intermediate", "practical experience", "hands-on", "project"],
    2: ["know", "familiar", "learned", "working knowledge", "elementary", "comfortable with", "understand"],
    1: ["basic", "beginner", "started", "introductory", "learning", "elementary basics", "minimal"],
}


class SkillExtractor:
    """
    Extracts skills and infers conservative, evidence-grounded proficiency levels.
    """

    def __init__(self, normalizer: Optional[SkillNormalizer] = None):
        self.normalizer = normalizer or skill_normalizer

    def _infer_skill_level_from_context(self, context_sentence: str) -> int:
        """
        Determines proficiency level from sentence phrasing.
        Conservative default is 2 (Elementary) for standard mentions,
        1 (Beginner) if 'basic/learning' mentioned,
        3 (Intermediate) if concrete project verbs 'built/developed' are present.
        Never assigns 4 or 5 without explicit senior/expert terms.
        """
        lower = context_sentence.lower()

        for level, keywords in sorted(LEVEL_MODIFIERS.items(), key=lambda x: x[0], reverse=True):
            for kw in keywords:
                if re.search(rf"\b{re.escape(kw)}\b", lower):
                    return level

        return 2  # Default conservative elementary level

    def extract_from_text(self, text: str, source: str = "extracted") -> List[StudentSkill]:
        """
        Extract canonical skills and estimate levels from free-form text.
        """
        if not text or not text.strip():
            return []

        extracted_skills: Dict[str, StudentSkill] = {}
        sentences = re.split(r"[.\n;!?]+", text)

        all_canonical = self.normalizer.get_all_canonical()

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            for canonical in all_canonical:
                aliases = self.normalizer.get_aliases(canonical)
                matched = False

                for alias in aliases:
                    # Match exact word boundaries
                    pattern = rf"(?i)\b{re.escape(alias)}\b"
                    if re.search(pattern, sentence):
                        matched = True
                        break

                if matched:
                    level = self._infer_skill_level_from_context(sentence)
                    confidence = 0.85 if level in [1, 2, 3] else 0.75

                    if canonical in extracted_skills:
                        # Keep the higher evidenced level
                        if level > extracted_skills[canonical].level:
                            extracted_skills[canonical].level = level
                    else:
                        extracted_skills[canonical] = StudentSkill(
                            skill=canonical,
                            level=level,
                            confidence=confidence,
                            source=source,
                        )

        # Handle specific common compounds e.g. "built a port scanner" -> "Port Scanning" level 2
        lower_text = text.lower()
        if "port scanner" in lower_text or "port scanning" in lower_text:
            if "Port Scanning" not in extracted_skills:
                extracted_skills["Port Scanning"] = StudentSkill(
                    skill="Port Scanning",
                    level=2,
                    confidence=0.9,
                    source=source,
                )

        results = list(extracted_skills.values())
        logger.info(f"Extracted {len(results)} skills from text (length {len(text)})")
        return results

    def extract_from_profile(self, profile_data: Dict[str, Any]) -> List[StudentSkill]:
        """
        Extract and normalize skills from structured student profile dictionary.
        """
        skills_map: Dict[str, StudentSkill] = {}

        # 1. Explicit skills list
        explicit_skills = profile_data.get("skills", [])
        if isinstance(explicit_skills, list):
            for item in explicit_skills:
                if isinstance(item, dict):
                    raw_name = item.get("skill") or item.get("name")
                    level = int(item.get("level", 2))
                    confidence = float(item.get("confidence", 1.0))
                    src = item.get("source", "student_profile")
                else:
                    raw_name = str(item)
                    level = 2
                    confidence = 1.0
                    src = "student_profile"

                canonical = self.normalizer.normalize(raw_name)
                if canonical:
                    skills_map[canonical] = StudentSkill(
                        skill=canonical,
                        level=max(1, min(5, level)),
                        confidence=confidence,
                        source=src,
                    )

        # 2. Extract from projects and evidence descriptions
        text_corpus = []
        for key in ["projects", "experience", "student_evidence", "evidence", "interests"]:
            val = profile_data.get(key)
            if isinstance(val, list):
                text_corpus.extend(str(v) for v in val)
            elif isinstance(val, str):
                text_corpus.append(val)

        if text_corpus:
            combined_text = " ".join(text_corpus)
            evidence_skills = self.extract_from_text(combined_text, source="extracted")
            for es in evidence_skills:
                if es.skill in skills_map:
                    # If already present as explicit, preserve explicit but allow level upgrade if evidence is stronger
                    if es.level > skills_map[es.skill].level:
                        skills_map[es.skill].level = es.level
                else:
                    skills_map[es.skill] = es

        return list(skills_map.values())


# Global singleton
skill_extractor = SkillExtractor()
