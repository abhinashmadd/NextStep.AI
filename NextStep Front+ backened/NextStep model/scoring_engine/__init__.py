"""
NextStep Scoring Engine.
Multi-dimensional career compatibility scoring integrating Skill Graph gap analysis,
interest alignment, education matching, project relevance, certification value,
experience estimation, and configurable scoring weights.
"""

from scoring_engine.engine import ScoringEngine, get_scoring_engine
from scoring_engine.weights import ScoringWeights, DEFAULT_WEIGHTS
from scoring_engine.career_ranker import CareerRanker, RankedCareer

__all__ = [
    "ScoringEngine",
    "get_scoring_engine",
    "ScoringWeights",
    "DEFAULT_WEIGHTS",
    "CareerRanker",
    "RankedCareer",
]
