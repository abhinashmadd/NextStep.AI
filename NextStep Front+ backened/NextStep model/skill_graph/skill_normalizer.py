"""
Skill Normalization System for NextStep Career Guidance.
Maps varied spelling, abbreviations, synonyms, and phrasing to canonical skill entities.
"""

import json
import os
import re
from typing import Dict, List, Optional, Set
from app.core.logger import logger


DEFAULT_SKILL_ALIASES: Dict[str, List[str]] = {
    "Python": ["python", "python3", "python programming", "python 3", "py", "py3"],
    "JavaScript": ["javascript", "js", "java script", "ecmascript", "es6", "vanilla js"],
    "Node.js": ["node.js", "nodejs", "node", "node js"],
    "React": ["react", "react.js", "reactjs", "react js"],
    "Linux": ["linux", "linux os", "linux command line", "bash", "shell scripting", "ubuntu", "unix", "centos"],
    "Networking": ["networking", "computer networking", "tcp/ip", "network protocols", "network fundamentals", "dns", "subnetting"],
    "Network Security": ["network security", "netsec", "firewalls", "firewall management", "ids", "ips", "ids/ips", "snort"],
    "Security Fundamentals": ["security fundamentals", "cybersecurity fundamentals", "infosec basics", "information security", "cyber security basics", "cia triad"],
    "Security Monitoring": ["security monitoring", "soc monitoring", "log monitoring", "threat monitoring"],
    "SIEM": ["siem", "siem tools", "splunk", "elastic siem", "microsoft sentinel", "qradar", "log analysis"],
    "Incident Response": ["incident response", "ir", "incident handling", "incident triage", "breach investigation"],
    "Port Scanning": ["port scanning", "port scanner", "nmap", "nmap scanning", "network scanning"],
    "SQL": ["sql", "structured query language", "postgresql", "postgres", "mysql", "sqlite", "relational databases"],
    "Docker": ["docker", "containerization", "containers", "dockerfile", "docker containers"],
    "Kubernetes": ["kubernetes", "k8s", "container orchestration", "helm"],
    "Git": ["git", "github", "gitlab", "version control", "vcs"],
    "Cryptography": ["cryptography", "crypto", "encryption", "pki", "ssl", "tls", "ssl/tls", "hashing"],
    "Machine Learning": ["machine learning", "ml", "statistical learning", "predictive modeling", "scikit-learn", "sklearn"],
    "Deep Learning": ["deep learning", "dl", "neural networks", "pytorch", "tensorflow", "keras"],
    "Data Structures": ["data structures", "dsa", "data structures and algorithms"],
    "Algorithms": ["algorithms", "algorithmic problem solving", "sorting and searching"],
    "Backend Development": ["backend development", "backend", "server-side development", "rest api", "rest apis", "fastapi", "flask", "django"],
    "Cloud Computing": ["cloud computing", "cloud", "aws", "amazon web services", "azure", "google cloud", "gcp"],
    "CI/CD": ["ci/cd", "continuous integration", "github actions", "gitlab ci", "jenkins"],
    "Data Visualization": ["data visualization", "data viz", "tableau", "power bi", "bi dashboards", "matplotlib", "seaborn"],
}


class SkillNormalizer:
    """
    Normalizes arbitrary skill names into canonical Skill Graph terms.
    """

    def __init__(self, custom_mapping_path: Optional[str] = None):
        self._canonical_to_aliases: Dict[str, Set[str]] = {}
        self._alias_to_canonical: Dict[str, str] = {}
        self._load_defaults()

        if custom_mapping_path and os.path.exists(custom_mapping_path):
            self.load_from_file(custom_mapping_path)

    def _clean_token(self, text: str) -> str:
        s = text.strip().lower()
        s = re.sub(r"[^\w\s\.\+#/-]", "", s)
        s = re.sub(r"\s+", " ", s)
        return s

    def _load_defaults(self):
        for canonical, aliases in DEFAULT_SKILL_ALIASES.items():
            canonical_clean = self._clean_token(canonical)
            self._canonical_to_aliases[canonical] = set()

            # Canonical itself is an alias
            self._alias_to_canonical[canonical_clean] = canonical
            self._canonical_to_aliases[canonical].add(canonical_clean)

            for alias in aliases:
                alias_clean = self._clean_token(alias)
                self._alias_to_canonical[alias_clean] = canonical
                self._canonical_to_aliases[canonical].add(alias_clean)

    def load_from_file(self, filepath: str) -> None:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Support list of skills with aliases
            skills_list = data.get("skills", []) if isinstance(data, dict) else data
            for item in skills_list:
                canonical = item.get("name") or item.get("canonical")
                if canonical:
                    aliases = item.get("aliases", [])
                    for a in aliases:
                        self.add_alias(canonical, a)
        except Exception as e:
            logger.warning(f"Could not load custom aliases from {filepath}: {e}")

    def add_alias(self, canonical: str, alias: str) -> None:
        if not canonical or not alias:
            return
        if canonical not in self._canonical_to_aliases:
            self._canonical_to_aliases[canonical] = set()
            self._alias_to_canonical[self._clean_token(canonical)] = canonical

        alias_clean = self._clean_token(alias)
        self._alias_to_canonical[alias_clean] = canonical
        self._canonical_to_aliases[canonical].add(alias_clean)

    def normalize(self, raw_skill: str) -> Optional[str]:
        """
        Normalize a skill string to its canonical name.
        Returns canonical name if recognized, or cleaned title-cased string if high-confidence,
        or None if invalid/empty.
        """
        if not raw_skill or not raw_skill.strip():
            return None

        clean = self._clean_token(raw_skill)

        # 1. Exact alias lookup
        if clean in self._alias_to_canonical:
            return self._alias_to_canonical[clean]

        # 2. Substring matching for phrases like "hands-on python development"
        for alias_token, canonical in self._alias_to_canonical.items():
            # Whole word boundary match
            pattern = rf"\b{re.escape(alias_token)}\b"
            if re.search(pattern, clean):
                return canonical

        # 3. Canonical direct case-insensitive match
        for canonical in self._canonical_to_aliases.keys():
            if clean == self._clean_token(canonical):
                return canonical

        return None

    def get_all_canonical(self) -> List[str]:
        return sorted(list(self._canonical_to_aliases.keys()))

    def get_aliases(self, canonical: str) -> List[str]:
        return sorted(list(self._canonical_to_aliases.get(canonical, set())))


# Global singleton
skill_normalizer = SkillNormalizer()
