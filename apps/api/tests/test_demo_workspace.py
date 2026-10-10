from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from apps.api.db.models import Application, Job, User
from apps.api.db.session import SessionLocal
from apps.api.integrations.serpapi import (
    SerpApiClient,
    SerpApiHttpError,
    SerpApiSearchParameters,
)
from apps.api.main import app
from apps.api.schemas.application import ApplicationCreate
from apps.api.services.application_service import ApplicationService
from apps.api.services.demo_workspace_service import (
    DEMO_CANDIDATE_EMAIL,
    DEMO_CANDIDATE_NAME,
    DEMO_JOBS_SPEC,
    DemoWorkspaceService,
)


@pytest.fixture
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Deterministic Demo Candidate Seeding & Grounding Tests
# ---------------------------------------------------------------------------
def test_demo_workspace_deterministic_seeding(db_session):
    """Verify that DemoWorkspaceService seeds Shubham Singh Ranswal grounded
    strictly in his resume.
    """
    profile = DemoWorkspaceService.ensure_demo_workspace(db_session)

    assert profile is not None
    assert profile.user.email == DEMO_CANDIDATE_EMAIL
    assert profile.preferences_json.get("full_name") == DEMO_CANDIDATE_NAME
    assert profile.location == "Noida, Uttar Pradesh"
    assert "payShield 10K" in profile.summary

    # Check Master Resume
    master_resume = [r for r in profile.resumes if r.is_master]
    assert len(master_resume) == 1
    assert "SHUBHAM SINGH RANSWAL" in master_resume[0].extracted_text
    assert "TR-31" in master_resume[0].extracted_text
    assert "MultiLMK" in master_resume[0].extracted_text
    assert "LogChat" in master_resume[0].extracted_text

    # Check Verified Experiences
    orgs = [exp.organization for exp in profile.experiences]
    assert "Thales" in orgs
    assert "Uttarakhand Space Application Centre" in orgs

    # Check Verified Evidence
    ev_titles = [ev.title for ev in profile.evidence]
    assert "KeyVault Lite" in ev_titles
    assert "DevLens" in ev_titles
    assert "Thales payShield 10K MultiLMK Automation Utility" in ev_titles
    assert "LogChat Offline AI Log Investigation Platform" in ev_titles
    assert "CipherTrust Data Security Platform (CDSP)" in ev_titles
    assert "DSF - Agent Gateway" in ev_titles

    # Check Verified Skills
    skill_names = [s.skill.normalized_name for s in profile.skills if s.skill]
    assert "golang" in skill_names
    assert "python" in skill_names
    assert "fastapi" in skill_names
    assert "thales payshield 10k hsm" in skill_names
    assert "tr31" in skill_names


# ---------------------------------------------------------------------------
# 2. Idempotent Seeding & Non-Duplication Tests
# ---------------------------------------------------------------------------
def test_demo_workspace_idempotence(db_session):
    """Verify that calling ensure_demo_workspace repeatedly creates zero duplicate
    users, jobs, or applications.
    """
    # First ensure
    profile1 = DemoWorkspaceService.ensure_demo_workspace(db_session)
    user_count_1 = db_session.query(User).filter(User.email == DEMO_CANDIDATE_EMAIL).count()
    job_count_1 = db_session.query(Job).filter(Job.external_id.like("DEMO-JOB-%")).count()
    demo_job_ids = [
        j.id for j in db_session.query(Job).filter(Job.external_id.like("DEMO-JOB-%")).all()
    ]
    demo_app_count_1 = (
        db_session.query(Application)
        .filter(Application.user_id == profile1.user_id, Application.job_id.in_(demo_job_ids))
        .count()
    )
    app_count_1 = (
        db_session.query(Application).filter(Application.user_id == profile1.user_id).count()
    )

    # Second ensure
    profile2 = DemoWorkspaceService.ensure_demo_workspace(db_session)
    user_count_2 = db_session.query(User).filter(User.email == DEMO_CANDIDATE_EMAIL).count()
    job_count_2 = db_session.query(Job).filter(Job.external_id.like("DEMO-JOB-%")).count()
    demo_app_count_2 = (
        db_session.query(Application)
        .filter(Application.user_id == profile2.user_id, Application.job_id.in_(demo_job_ids))
        .count()
    )
    app_count_2 = (
        db_session.query(Application).filter(Application.user_id == profile2.user_id).count()
    )

    assert profile1.id == profile2.id
    assert user_count_1 == user_count_2 == 1
    assert job_count_1 == job_count_2 == len(DEMO_JOBS_SPEC)
    assert demo_app_count_1 == demo_app_count_2 == len(DEMO_JOBS_SPEC)
    assert app_count_1 == app_count_2


# ---------------------------------------------------------------------------
# 3. Demo Catalog & Provenance Tests
# ---------------------------------------------------------------------------
def test_demo_jobs_provenance(db_session):
    """Verify that demo jobs carry explicit is_demo and fixture metadata."""
    DemoWorkspaceService.ensure_demo_workspace(db_session)

    demo_jobs = db_session.query(Job).filter(Job.external_id.like("DEMO-JOB-%")).all()
    assert len(demo_jobs) == len(DEMO_JOBS_SPEC)

    for dj in demo_jobs:
        assert dj.metadata_json.get("is_demo") is True
        assert dj.metadata_json.get("fixture_tag") == "DEMO FIXTURE"
        assert "Demo Fixture" in dj.source_names_json


# ---------------------------------------------------------------------------
# 4. Application Status Transitions & Deduplication
# ---------------------------------------------------------------------------
def test_application_transition_saved_to_applied(db_session):
    """Verify that applying to a Saved job transitions the existing record
    without duplicate creation.
    """
    profile = DemoWorkspaceService.ensure_demo_workspace(db_session)

    # Locate the saved demo job (CloudScale Go)
    saved_job = db_session.query(Job).filter(Job.external_id == "DEMO-JOB-GO-01").first()
    assert saved_job is not None

    existing_app = (
        db_session.query(Application)
        .filter(Application.user_id == profile.user_id, Application.job_id == saved_job.id)
        .first()
    )
    assert existing_app is not None
    assert existing_app.status == "Saved"
    app_id = existing_app.id

    # User starts and submits the application flow
    payload = ApplicationCreate(
        user_id=profile.user_id,
        job_id=saved_job.id,
        title=saved_job.title,
        company_name=saved_job.company.canonical_name,
        source="Controlled ATS Demo",
        status="Applied",
        notes="Candidate confirmed simulated application submission.",
    )
    updated_summary = ApplicationService.create_application(db_session, payload)

    # Verify ID is preserved (no duplicate created)
    assert updated_summary.id == app_id
    assert updated_summary.status == "Applied"
    assert updated_summary.applied_at is not None

    # Verify count for this job remains exactly 1
    total_apps_for_job = (
        db_session.query(Application)
        .filter(Application.user_id == profile.user_id, Application.job_id == saved_job.id)
        .count()
    )
    assert total_apps_for_job == 1


# ---------------------------------------------------------------------------
# 5. Historical Application Capsules Coverage
# ---------------------------------------------------------------------------
def test_historical_demo_capsules_statuses(db_session):
    """Verify that historical demo applications exist with varied statuses and full capsules."""
    profile = DemoWorkspaceService.ensure_demo_workspace(db_session)

    apps = db_session.query(Application).filter(Application.user_id == profile.user_id).all()
    statuses = {a.status for a in apps}

    # Must contain representative statuses
    assert "Offer" in statuses
    assert "Interviewing" in statuses
    assert "Applied" in statuses
    assert "Rejected" in statuses

    # Verify Offer capsule contains snapshot, documents, questions, and interview
    offer_app = next(a for a in apps if a.status == "Offer")
    capsule = ApplicationService.get_application_capsule(db_session, offer_app.id)

    assert capsule.latest_snapshot is not None
    assert len(capsule.documents) >= 2  # tailored resume and cover letter
    assert len(capsule.questions) >= 1
    assert len(capsule.interviews) >= 1


# ---------------------------------------------------------------------------
# 6. SerpApi Server-Side Failover Tests (Mocked - 0 Live Calls)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_serpapi_failover_on_quota_error():
    """Verify that SerpApiClient falls back to SERPAPI_FALLBACK_API_KEY when
    primary fails with quota error.
    """
    client = SerpApiClient(
        api_key="primary_mock_key",
        fallback_api_key="fallback_mock_key",
    )

    mock_params = SerpApiSearchParameters(q="Senior Go Backend Engineer")

    # Primary returns 429 quota exhaustion; Fallback returns 200 with results
    call_keys = []

    async def mock_execute(http_client, key, params):
        call_keys.append(key)
        if key == "primary_mock_key":
            return (
                429,
                {"error": "Your account has run out of searches"},
                '{"error": "Your account has run out of searches"}',
            )
        return (
            200,
            {
                "search_metadata": {"id": "mock_123", "status": "Success"},
                "jobs_results": [
                    {
                        "title": "Senior Go Engineer",
                        "company_name": "Mock Tech",
                        "location": "Remote",
                        "description": "Mock JD",
                    }
                ],
            },
            "{}",
        )

    with patch.object(client, "_execute_request", side_effect=mock_execute):
        resp = await client.search_jobs(mock_params)

        assert len(resp.jobs_results) == 1
        assert resp.jobs_results[0].title == "Senior Go Engineer"
        # Verify primary was tried first, then fallback
        assert call_keys == ["primary_mock_key", "fallback_mock_key"]


@pytest.mark.asyncio
async def test_serpapi_no_failover_on_client_error():
    """Verify that client syntax / parameter errors (400) do NOT needlessly
    fail over to the fallback key.
    """
    client = SerpApiClient(
        api_key="primary_mock_key",
        fallback_api_key="fallback_mock_key",
    )

    mock_params = SerpApiSearchParameters(q="invalid_query")
    call_keys = []

    async def mock_execute(http_client, key, params):
        call_keys.append(key)
        return 400, {"error": "Invalid query parameter syntax"}, "{}"

    with patch.object(client, "_execute_request", side_effect=mock_execute):
        with pytest.raises(SerpApiHttpError) as exc_info:
            await client.search_jobs(mock_params)

        # Only primary was called; no blind failover occurred
        assert call_keys == ["primary_mock_key"]
        assert "Invalid query parameter syntax" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 7. Demo Reset Endpoint Test
# ---------------------------------------------------------------------------
def test_demo_reset_endpoint(client, db_session):
    """Verify that POST /api/v1/demo/reset re-ensures the workspace and resets
    application states.
    """
    resp = client.post("/api/v1/demo/reset")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "reset_completed"
    assert data["workspace"] == "Demo Workspace"
    assert data["candidate"] == "Shubham Singh Ranswal"

    status_resp = client.get("/api/v1/demo/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["demo_mode"] is True
