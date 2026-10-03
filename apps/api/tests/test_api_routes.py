import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.db.session import get_db
from apps.api.main import app
from apps.api.schemas.application import (
    ApplicationCapsuleResponse,
    ApplicationDocumentResponse,
    ApplicationQuestionResponse,
    ApplicationSnapshotResponse,
    ApplicationSummaryResponse,
)
from apps.api.schemas.career import (
    CareerEvidenceResponse,
    CareerExperienceResponse,
    CareerProfileResponse,
)
from apps.api.schemas.interview import InterviewPrepResponse
from apps.api.schemas.job import JobMatchResponse, JobResponse
from apps.api.schemas.resume import CoverLetterResponse, ResumeResponse, ResumeVersionResponse
from apps.api.services.application_service import ApplicationService
from apps.api.services.career_service import CareerService
from apps.api.services.job_service import JobService
from apps.api.services.resume_service import ResumeService


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture(autouse=True)
def override_db(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_career_profile_endpoints(monkeypatch):
    user_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    now = datetime.now(UTC)

    mock_profile = CareerProfileResponse(
        id=profile_id,
        user_id=user_id,
        headline="Senior Backend Engineer",
        summary="Building distributed systems",
        location="Remote, US",
        preferences_json={"remote": True},
        created_at=now,
        updated_at=now,
        experiences=[],
        skills=[],
        evidence=[],
    )

    monkeypatch.setattr(CareerService, "get_profile_by_user", lambda db, uid: mock_profile)
    monkeypatch.setattr(CareerService, "create_profile", lambda db, payload: mock_profile)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET profile
        res = await client.get(f"/api/v1/career/profile?user_id={user_id}")
        assert res.status_code == 200
        assert res.json()["headline"] == "Senior Backend Engineer"

        # POST profile
        create_payload = {
            "user_id": str(user_id),
            "headline": "Senior Backend Engineer",
            "summary": "Building distributed systems",
            "location": "Remote, US",
            "preferences_json": {"remote": True},
        }
        res_create = await client.post("/api/v1/career/profile", json=create_payload)
        assert res_create.status_code == 201
        assert res_create.json()["id"] == str(profile_id)


@pytest.mark.asyncio
async def test_career_evidence_and_experience_endpoints(monkeypatch):
    profile_id = uuid.uuid4()
    now = datetime.now(UTC)

    mock_exp = CareerExperienceResponse(
        id=uuid.uuid4(),
        career_profile_id=profile_id,
        organization="Acme Corp",
        title="Backend Engineer",
        start_date=None,
        end_date=None,
        description="Built async APIs",
        evidence_status="verified",
        created_at=now,
        updated_at=now,
    )
    monkeypatch.setattr(CareerService, "add_experience", lambda db, pid, payload: mock_exp)

    mock_evidence = CareerEvidenceResponse(
        id=uuid.uuid4(),
        career_profile_id=profile_id,
        type="github_repo",
        title="FastAPI Orchestrator",
        content="Open source orchestration platform",
        source_type="github",
        source_url="https://github.com/user/orchestrator",
        source_reference=None,
        verification_state="verified",
        metadata_json={},
        created_at=now,
        updated_at=now,
    )
    monkeypatch.setattr(CareerService, "add_evidence", lambda db, pid, payload: mock_evidence)
    monkeypatch.setattr(CareerService, "list_evidence", lambda db, pid: [mock_evidence])

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Add experience
        res_exp = await client.post(
            f"/api/v1/career/profile/{profile_id}/experiences",
            json={"organization": "Acme Corp", "title": "Backend Engineer"},
        )
        assert res_exp.status_code == 201
        assert res_exp.json()["organization"] == "Acme Corp"

        # Add evidence
        res_ev = await client.post(
            f"/api/v1/career/profile/{profile_id}/evidence",
            json={
                "type": "github_repo",
                "title": "FastAPI Orchestrator",
                "content": "Open source orchestration platform",
                "source_type": "github",
            },
        )
        assert res_ev.status_code == 201
        assert res_ev.json()["title"] == "FastAPI Orchestrator"

        # List evidence
        res_list = await client.get(f"/api/v1/career/profile/{profile_id}/evidence")
        assert res_list.status_code == 200
        assert len(res_list.json()) == 1


@pytest.mark.asyncio
async def test_jobs_and_matching_endpoints(monkeypatch):
    job_id = uuid.uuid4()
    company_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    now = datetime.now(UTC)

    mock_job = JobResponse(
        id=job_id,
        company_id=company_id,
        company_name="Stripe",
        title="Staff Infrastructure Engineer",
        location="Remote",
        remote_type="remote",
        employment_type="full-time",
        salary_min=None,
        salary_max=None,
        currency="USD",
        description="Scalable distributed platform.",
        normalized_requirements_json=["python", "distributed systems"],
        source_urls_json=[],
        source_names_json=[],
        canonical_url=None,
        external_id=None,
        posted_at=None,
        first_seen_at=now,
        last_seen_at=now,
        fingerprint="test-fingerprint",
        metadata_json={},
        created_at=now,
        updated_at=now,
    )
    monkeypatch.setattr(JobService, "create_job", lambda db, payload: mock_job)
    monkeypatch.setattr(JobService, "get_job", lambda db, jid: mock_job)
    monkeypatch.setattr(JobService, "list_jobs", lambda db, q: ([mock_job], 1))

    mock_match = JobMatchResponse(
        id=uuid.uuid4(),
        job_id=job_id,
        career_profile_id=profile_id,
        overall_score=88,
        component_scores_json={"skills": 90, "experience": 85},
        strengths_json=["Strong skill alignment"],
        gaps_json=[],
        explanation="88% match based on skills and experience",
        created_at=now,
    )
    monkeypatch.setattr(JobService, "calculate_match", lambda db, jid, pid: mock_match)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create Job
        res_create = await client.post(
            "/api/v1/jobs",
            json={
                "company_name": "Stripe",
                "title": "Staff Infrastructure Engineer",
                "description": "Scalable distributed platform.",
            },
        )
        assert res_create.status_code == 201
        assert res_create.json()["title"] == "Staff Infrastructure Engineer"

        # List Jobs
        res_list = await client.get("/api/v1/jobs?query=infrastructure")
        assert res_list.status_code == 200
        assert res_list.json()["total"] == 1

        # Match Job
        res_match = await client.post(
            f"/api/v1/jobs/{job_id}/match",
            json={"career_profile_id": str(profile_id)},
        )
        assert res_match.status_code == 200
        assert res_match.json()["overall_score"] == 88


@pytest.mark.asyncio
async def test_resumes_and_cover_letters_endpoints(monkeypatch):
    resume_id = uuid.uuid4()
    profile_id = uuid.uuid4()
    job_id = uuid.uuid4()
    now = datetime.now(UTC)

    mock_resume = ResumeResponse(
        id=resume_id,
        career_profile_id=profile_id,
        name="Master Resume",
        source_file=None,
        extracted_text="Master resume text",
        version=1,
        is_master=True,
        created_at=now,
        updated_at=now,
    )
    monkeypatch.setattr(ResumeService, "upload_resume", lambda db, p: mock_resume)

    mock_version = ResumeVersionResponse(
        id=uuid.uuid4(),
        career_profile_id=profile_id,
        job_id=job_id,
        base_resume_id=resume_id,
        content="Tailored resume text for Stripe",
        version_label="v1-stripe-tailored",
        generation_metadata_json={},
        created_at=now,
        updated_at=now,
    )
    monkeypatch.setattr(ResumeService, "create_resume_version", lambda db, p: mock_version)

    mock_cover = CoverLetterResponse(
        id=uuid.uuid4(),
        career_profile_id=profile_id,
        job_id=job_id,
        content="Cover letter text",
        version=1,
        generation_metadata_json={},
        created_at=now,
        updated_at=now,
    )
    monkeypatch.setattr(ResumeService, "create_cover_letter", lambda db, p: mock_cover)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Upload resume
        res_up = await client.post(
            "/api/v1/career/resume",
            json={
                "career_profile_id": str(profile_id),
                "name": "Master Resume",
                "extracted_text": "Master resume text",
                "is_master": True,
            },
        )
        assert res_up.status_code == 201
        assert res_up.json()["is_master"] is True

        # Create tailored version
        res_ver = await client.post(
            "/api/v1/career/resume/version",
            json={
                "career_profile_id": str(profile_id),
                "job_id": str(job_id),
                "content": "Tailored resume text for Stripe",
                "version_label": "v1-stripe-tailored",
            },
        )
        assert res_ver.status_code == 201
        assert res_ver.json()["version_label"] == "v1-stripe-tailored"

        # Create cover letter
        res_cov = await client.post(
            "/api/v1/career/cover-letter",
            json={
                "career_profile_id": str(profile_id),
                "job_id": str(job_id),
                "content": "Cover letter text",
            },
        )
        assert res_cov.status_code == 201
        assert res_cov.json()["content"] == "Cover letter text"


@pytest.mark.asyncio
async def test_application_capsule_and_interview_prep(monkeypatch):
    app_id = uuid.uuid4()
    user_id = uuid.uuid4()
    job_id = uuid.uuid4()
    now = datetime.now(UTC)

    summary = ApplicationSummaryResponse(
        id=app_id,
        user_id=user_id,
        job_id=job_id,
        company_id=None,
        company_name="Stripe",
        title="Software Engineer",
        source="SerpApi / Workday",
        application_url="https://stripe.com/jobs/123",
        status="Applied",
        applied_at=now,
        captured_at=now,
        notes=None,
        metadata_json={},
        created_at=now,
        updated_at=now,
    )

    snapshot = ApplicationSnapshotResponse(
        id=uuid.uuid4(),
        application_id=app_id,
        job_description="Exact JD captured at submit time.",
        page_title="Apply for Software Engineer",
        page_url="https://stripe.com/jobs/123",
        captured_at=now,
        extraction_metadata_json={},
    )

    document = ApplicationDocumentResponse(
        id=uuid.uuid4(),
        application_id=app_id,
        document_type="resume",
        document_id=uuid.uuid4(),
        version_label="v1-stripe-tailored",
        content="Tailored resume text content",
        created_at=now,
        updated_at=now,
    )

    question = ApplicationQuestionResponse(
        id=uuid.uuid4(),
        application_id=app_id,
        question_text="Why Stripe?",
        normalized_question=None,
        question_type="textarea",
        page_field_name="why_stripe",
        order_index=1,
        answers=[],
        created_at=now,
        updated_at=now,
    )

    capsule = ApplicationCapsuleResponse(
        application=summary,
        latest_snapshot=snapshot,
        documents=[document],
        questions=[question],
        interviews=[],
        follow_ups=[],
    )

    monkeypatch.setattr(ApplicationService, "create_application", lambda db, p: summary)
    monkeypatch.setattr(ApplicationService, "get_application_capsule", lambda db, aid: capsule)
    monkeypatch.setattr(ApplicationService, "list_applications", lambda db, uid, s: [summary])

    mock_prep = InterviewPrepResponse(
        application_id=app_id,
        stage="Technical",
        technical_topics=["Distributed APIs", "PostgreSQL scaling"],
        role_questions=["How to handle idempotency in payments?"],
        resume_questions=["Discuss your tailored metrics."],
        behavioral_questions=["Why Stripe?"],
        weak_spots=["Highlight production incident triage."],
        questions_to_ask=["What does the roadmap look like?"],
        preparation_checklist=["Review submitted tailored resume"],
        grounded_in_capsule=True,
        generated_at=now,
    )
    monkeypatch.setattr(ApplicationService, "prepare_interview", lambda db, aid, s: mock_prep)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create Application
        res_app = await client.post(
            "/api/v1/applications",
            json={
                "user_id": str(user_id),
                "title": "Software Engineer",
                "source": "SerpApi / Workday",
                "company_name": "Stripe",
            },
        )
        assert res_app.status_code == 201
        assert res_app.json()["title"] == "Software Engineer"

        # List Applications
        res_list = await client.get(f"/api/v1/applications?user_id={user_id}")
        assert res_list.status_code == 200
        assert len(res_list.json()) == 1

        # GET Application Capsule (Core Memory)
        res_cap = await client.get(f"/api/v1/applications/{app_id}")
        assert res_cap.status_code == 200
        cap_data = res_cap.json()
        assert cap_data["latest_snapshot"]["job_description"] == "Exact JD captured at submit time."
        assert len(cap_data["documents"]) == 1
        assert cap_data["documents"][0]["version_label"] == "v1-stripe-tailored"
        assert len(cap_data["questions"]) == 1

        # POST Interview Prep (Grounded in Capsule)
        prep_url = f"/api/v1/applications/{app_id}/interview-prep?stage=Technical"
        res_prep = await client.post(prep_url)
        assert res_prep.status_code == 201
        prep_data = res_prep.json()
        assert prep_data["grounded_in_capsule"] is True
        assert len(prep_data["technical_topics"]) == 2
        assert "Distributed APIs" in prep_data["technical_topics"]


@pytest.mark.asyncio
async def test_api_validation_errors():
    """Verify that requests with invalid or missing required fields return
    422 Unprocessable Entity.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Career profile create with missing required user_id
        res_prof = await client.post("/api/v1/career/profile", json={})
        assert res_prof.status_code == 422

        # Job create with missing required title and description
        res_job = await client.post("/api/v1/jobs", json={"company_name": "Test"})
        assert res_job.status_code == 422

        # Application create with missing required fields
        res_app = await client.post("/api/v1/applications", json={})
        assert res_app.status_code == 422


@pytest.mark.asyncio
async def test_api_not_found_errors(monkeypatch):
    """Verify that accessing non-existent entities returns 404 Not Found."""
    from fastapi import HTTPException

    def raise_404(*args, **kwargs):
        raise HTTPException(status_code=404, detail="Entity not found")

    monkeypatch.setattr(JobService, "get_job", raise_404)
    monkeypatch.setattr(CareerService, "get_profile", raise_404)
    monkeypatch.setattr(ApplicationService, "get_application_capsule", raise_404)

    random_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_job = await client.get(f"/api/v1/jobs/{random_id}")
        assert res_job.status_code == 404

        res_prof = await client.get(f"/api/v1/career/profile/{random_id}")
        assert res_prof.status_code == 404

        res_app = await client.get(f"/api/v1/applications/{random_id}")
        assert res_app.status_code == 404


@pytest.mark.asyncio
async def test_job_identify_endpoint(monkeypatch):
    """Verify POST /api/v1/jobs/identify correctly matches jobs for the extension."""
    job_id = uuid.uuid4()
    comp_id = uuid.uuid4()
    mock_job = MagicMock()
    mock_job.id = job_id
    mock_job.company_id = comp_id
    mock_job.title = "Senior Platform Engineer"
    mock_job.location = "San Francisco, CA"
    mock_job.remote_type = "hybrid"
    mock_job.employment_type = "full-time"
    mock_job.salary_min = 160000
    mock_job.salary_max = 210000
    mock_job.currency = "USD"
    mock_job.description = "Design and build cloud infrastructure."
    mock_job.normalized_requirements_json = ["Python", "Kubernetes"]
    mock_job.source_urls_json = ["https://example.com/jobs/123"]
    mock_job.source_names_json = ["SerpApi"]
    mock_job.canonical_url = "https://example.com/jobs/123"
    mock_job.external_id = "EXT-123"
    mock_job.fingerprint = "fp-12345"
    mock_job.metadata_json = {}
    mock_job.company_name = "Acme Cloud"
    mock_job.posted_at = datetime.now(UTC)
    mock_job.created_at = datetime.now(UTC)
    mock_job.company = MagicMock(canonical_name="Acme Cloud")

    def mock_identify_hit(db, url=None, title=None, company_name=None, external_id=None):
        return mock_job, 0.95

    monkeypatch.setattr(JobService, "identify_job", mock_identify_hit)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/jobs/identify",
            json={"url": "https://example.com/jobs/123", "title": "Senior Platform Engineer"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["matched"] is True
        assert data["confidence"] == 0.95
        assert data["job"]["title"] == "Senior Platform Engineer"
        assert data["job"]["company_name"] == "Acme Cloud"

        # Test unmatched
        monkeypatch.setattr(JobService, "identify_job", lambda *args, **kwargs: (None, 0.0))
        res_miss = await client.post(
            "/api/v1/jobs/identify",
            json={"url": "https://unknown.com/job/999"},
        )
        assert res_miss.status_code == 200
        data_miss = res_miss.json()
        assert data_miss["matched"] is False
        assert data_miss["job"] is None


@pytest.mark.asyncio
async def test_career_draft_answer_endpoint(monkeypatch):
    """Verify POST /api/v1/career/draft-answer returns grounded answer."""
    from apps.api.schemas.career import QuestionDraftResponse

    profile_id = uuid.uuid4()
    job_id = uuid.uuid4()

    async def mock_draft(db, payload, llm_provider=None):
        return QuestionDraftResponse(
            question_text=payload.question_text,
            draft_answer="I have 5 years experience scaling Python distributed services.",
            evidence_used=[{"title": "Distributed Query Engine", "source_type": "github"}],
            missing_evidence=[],
            confidence=0.92,
        )

    monkeypatch.setattr(CareerService, "draft_question_answer", mock_draft)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/career/draft-answer",
            json={
                "career_profile_id": str(profile_id),
                "question_text": "Describe your distributed systems experience.",
                "job_id": str(job_id),
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["confidence"] == 0.92
        assert "scaling Python distributed services" in data["draft_answer"]
        assert len(data["evidence_used"]) == 1
