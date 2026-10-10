import sys
import json
import httpx

# Ensure UTF-8 output encoding for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"


def verify_flow():
    print("=" * 65)
    print("NextStep Backend API Complete Flow Verification")
    print("=" * 65)

    with httpx.Client(base_url=BASE_URL, timeout=180.0) as client:
        # Step 1: Health Check
        print("\n1. Testing GET /api/ai/health ...")
        res = client.get("/api/ai/health")
        print(f"Status: {res.status_code}")
        print(f"Body  : {res.json()}")
        assert res.status_code == 200
        assert res.json()["nvidia_configured"] is True

        # Step 2: Error Handling Test (Empty Evidence)
        print("\n2. Testing POST /api/ai/analyze with empty evidence (Validation error) ...")
        bad_payload = {
            "student_profile": "B.Tech student",
            "target_career": "Backend Developer",
            "student_evidence": "   ",
            "career_requirements": ["Python", "Docker"],
        }
        res = client.post("/api/ai/analyze", json=bad_payload)
        print(f"Status: {res.status_code} (Expected: 400 or 422)")
        print(f"Body  : {res.json()}")
        assert res.status_code in [400, 422]

        # Step 3: Initial Full Analysis Flow
        print("\n3. Testing POST /api/ai/analyze with complete test payload ...")
        payload = {
            "student_profile": "B.Tech student",
            "target_career": "Backend Developer",
            "student_evidence": (
                "Built a Python REST API using FastAPI and SQLite. "
                "The project uses GitHub for version control but has no automated tests or Docker deployment."
            ),
            "career_requirements": [
                "Python",
                "REST APIs",
                "SQL",
                "Git",
                "Testing",
                "Docker",
            ],
        }
        res = client.post("/api/ai/analyze", json=payload)
        print(f"Status: {res.status_code}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

        analysis = res.json()
        print("\nAnalysis Result from API:")
        print(json.dumps(analysis, indent=2))

        print("\n✓ Demonstrated Skills :", analysis["demonstrated_skills"])
        print("✓ Skill Gaps          :", analysis["skill_gaps"])
        print(f"✓ Readiness Score     : {analysis['readiness_score']}%")
        print(f"✓ Next Best Action    : {analysis['next_best_action']['title']}")

        # Step 4: Progression Workflow - Re-analysis with new evidence
        print("\n4. Testing POST /api/ai/re-analyze (Workflow step: student completes Next Best Action) ...")
        reanalyze_payload = {
            "student_profile": "B.Tech student",
            "target_career": "Backend Developer",
            "prior_evidence": payload["student_evidence"],
            "new_evidence": (
                "Completed pytest suite with 15 automated unit and integration tests for all FastAPI endpoints. "
                "Added a GitHub Actions CI workflow that runs pytest on every push."
            ),
            "career_requirements": payload["career_requirements"],
        }
        re_res = client.post("/api/ai/re-analyze", json=reanalyze_payload)
        print(f"Status: {re_res.status_code}")
        assert re_res.status_code == 200, f"Expected 200, got {re_res.status_code}: {re_res.text}"

        updated_analysis = re_res.json()
        print("\nUpdated Analysis After Adding New Evidence:")
        print(f"✓ Updated Demonstrated Skills : {updated_analysis['demonstrated_skills']}")
        print(f"✓ Updated Skill Gaps          : {updated_analysis['skill_gaps']}")
        print(f"✓ Updated Readiness Score     : {updated_analysis['readiness_score']}% (Prior: {analysis['readiness_score']}%)")
        print(f"✓ Updated Next Best Action    : {updated_analysis['next_best_action']['title']}")

        print("\n" + "=" * 65)
        print("COMPLETE API WORKFLOW VERIFIED SUCCESSFULLY!")
        print("=" * 65)


if __name__ == "__main__":
    verify_flow()
