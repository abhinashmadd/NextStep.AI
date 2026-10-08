import os
import sys
import json

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Ensure UTF-8 output encoding for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.config import settings
from app.models.schemas import AnalyzeRequest
from app.services.workflow_service import workflow_service


def run_nvidia_test():
    print("=" * 60)
    print("NextStep NVIDIA NIM GLM-5.3 Integration Test")
    print("=" * 60)
    print(f"Base URL    : {settings.nvidia_base_url}")
    print(f"Model       : {settings.nvidia_model}")
    print(f"Key Status  : {'Configured (' + settings.masked_api_key + ')' if settings.is_nvidia_configured else 'NOT CONFIGURED'}")
    print("-" * 60)

    # Required Test Input from Specification
    test_request = AnalyzeRequest(
        student_profile="B.Tech student",
        target_career="Backend Developer",
        student_evidence=(
            "Built a Python REST API using FastAPI and SQLite. "
            "The project uses GitHub for version control but has no automated tests or Docker deployment."
        ),
        career_requirements=[
            "Python",
            "REST APIs",
            "SQL",
            "Git",
            "Testing",
            "Docker",
        ],
    )

    print("Test Input:")
    print(f"  Student Profile     : {test_request.student_profile}")
    print(f"  Target Career       : {test_request.target_career}")
    print(f"  Student Evidence    : {test_request.student_evidence}")
    print(f"  Career Requirements : {test_request.career_requirements}")
    print("-" * 60)
    print("Invoking NVIDIA NIM GLM-5.3 via NextStep Workflow...")

    try:
        result = workflow_service.execute_analysis(test_request)
        print("\nAnalysis Result Received Successfully!\n")
        print(json.dumps(result.model_dump(), indent=2))

        # Verification Assertions
        print("-" * 60)
        print("Verification Checks:")

        # Check demonstrated skills
        print(f"✓ Demonstrated Skills ({len(result.demonstrated_skills)}): {result.demonstrated_skills}")

        # Check skill gaps
        print(f"✓ Skill Gaps ({len(result.skill_gaps)}): {result.skill_gaps}")

        # Check readiness score
        print(f"✓ Deterministic Readiness Score: {result.readiness_score}%")

        # Check next best action
        print(f"✓ Next Best Action Title: {result.next_best_action.title}")
        print(f"  Reason: {result.next_best_action.reason}")
        print(f"  Expected Outcome: {result.next_best_action.expected_outcome}")
        print(f"  Difficulty: {result.next_best_action.difficulty}")
        print(f"  Estimated Time: {result.next_best_action.estimated_time}")

        assert len(result.demonstrated_skills) > 0, "Expected at least one demonstrated skill"
        assert len(result.skill_gaps) > 0, "Expected at least one skill gap"
        assert result.readiness_score > 0, "Expected non-zero readiness score"
        assert result.next_best_action.title, "Expected a valid next best action title"

        print("-" * 60)
        print("ALL TEST CHECKS PASSED SUCCESSFULLY!")
        print("=" * 60)
        return True

    except Exception as exc:
        print(f"\nTEST FAILED with error: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_nvidia_test()
    sys.exit(0 if success else 1)
