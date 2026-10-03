import uuid
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.db.models import Company, Job
from apps.api.db.session import get_db
from apps.api.integrations.serpapi import (
    NormalizedDiscoveredJob,
    SearchPlanner,
    SearchPlannerPreferences,
    SerpApiClient,
    SerpApiConfigError,
    SerpApiDiscoveryService,
    SerpApiHttpError,
    SerpApiJobHighlight,
    SerpApiJobItem,
    SerpApiNormalizer,
    SerpApiParseError,
    SerpApiRawResponse,
)
from apps.api.main import app
from apps.api.services.job_service import JobService


# ---------------------------------------------------------------------------
# 1. Search Planner Tests
# ---------------------------------------------------------------------------
def test_search_planner_query_construction():
    """Verify deterministic query planning from user preferences."""
    # Scenario: Role + skills + location + remote
    prefs = SearchPlannerPreferences(
        role="Backend Engineer",
        skills=["Python", "FastAPI", "PostgreSQL"],
        location="India",
        remote=True,
        experience_level="Senior",
    )
    params = SearchPlanner.plan_query(prefs)

    assert "Senior" in params.q
    assert "Backend Engineer" in params.q
    assert "Python" in params.q
    assert "FastAPI" in params.q
    assert "remote" in params.q
    assert params.location == "India"
    assert params.engine == "google_jobs"


def test_search_planner_company_filter():
    """Verify company filter inclusion in planned query."""
    prefs = SearchPlannerPreferences(
        role="Software Engineer",
        company="Stripe",
    )
    params = SearchPlanner.plan_query(prefs)
    assert "at Stripe" in params.q
    assert params.q == "Software Engineer at Stripe"


# ---------------------------------------------------------------------------
# 2. Result Normalization Tests
# ---------------------------------------------------------------------------
def test_normalizer_complete_job():
    """Verify normalization of a full SerpApi job item with salary and qualifications."""
    raw_item = SerpApiJobItem(
        title="Senior Python Engineer",
        company_name="Acme Corp",
        location="Bangalore, Karnataka, India",
        via="via LinkedIn",
        description="We are looking for a Senior Python Engineer to build APIs.",
        job_id="serp-job-123",
        extensions=["1 day ago", "Full-time", "₹20L–₹35L a year", "Work from home"],
        job_highlights=[
            SerpApiJobHighlight(
                title="Qualifications",
                items=["5+ years Python", "FastAPI experience", "PostgreSQL expertise"],
            )
        ],
        apply_options=[
            {"title": "Apply on LinkedIn", "link": "https://linkedin.com/jobs/123"},
            {"title": "Apply on Company Site", "link": "https://acme.com/careers/456"},
        ],
        share_link="https://google.com/jobs/share-123",
    )

    normalized: NormalizedDiscoveredJob = SerpApiNormalizer.normalize_job(
        item=raw_item,
        search_query="Python Engineer Bangalore",
    )

    assert normalized.title == "Senior Python Engineer"
    assert normalized.company_name == "Acme Corp"
    assert normalized.location == "Bangalore, Karnataka, India"
    assert normalized.remote_type == "remote"
    assert normalized.employment_type == "Full-time"
    assert normalized.salary_min == Decimal("2000000")  # 20L
    assert normalized.salary_max == Decimal("3500000")  # 35L
    assert normalized.currency == "INR"
    assert len(normalized.normalized_requirements) == 3
    assert "5+ years Python" in normalized.normalized_requirements
    assert len(normalized.source_urls) == 3  # 2 apply links + 1 share link
    assert normalized.canonical_url == "https://linkedin.com/jobs/123"
    assert normalized.fingerprint is not None
    assert normalized.provenance["engine"] == "google_jobs"


def test_normalizer_missing_optional_fields():
    """Verify that absent fields are represented as None rather than invented."""
    raw_item = SerpApiJobItem(
        title="Software Engineer",
        company_name="Minimal Tech",
        description="Just a basic description.",
    )

    normalized = SerpApiNormalizer.normalize_job(
        item=raw_item,
        search_query="Software Engineer",
    )

    assert normalized.title == "Software Engineer"
    assert normalized.company_name == "Minimal Tech"
    assert normalized.location is None
    assert normalized.salary_min is None
    assert normalized.salary_max is None
    assert normalized.currency is None
    assert normalized.remote_type is None
    assert normalized.normalized_requirements == []
    assert normalized.source_urls == []


# ---------------------------------------------------------------------------
# 3. Deduplication Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_deduplication_batch_and_database_reuse():
    """Verify intra-batch deduplication and existing DB job reuse."""
    raw_item_1 = SerpApiJobItem(
        title="Staff Engineer",
        company_name="ScaleAI",
        location="Remote",
        description="Build scalable infra.",
        job_id="job-1",
    )
    # Duplicate with identical fingerprint
    raw_item_duplicate = SerpApiJobItem(
        title="Staff Engineer",
        company_name="ScaleAI",
        location="Remote",
        description="Build scalable infra.",
        job_id="job-dup",
    )
    # Unique job
    raw_item_2 = SerpApiJobItem(
        title="Data Engineer",
        company_name="ScaleAI",
        location="Remote",
        description="Build data pipeline.",
        job_id="job-2",
    )

    raw_response = SerpApiRawResponse(jobs_results=[raw_item_1, raw_item_duplicate, raw_item_2])

    fake_client = AsyncMock()
    fake_client.search_jobs.return_value = raw_response

    service = SerpApiDiscoveryService(client=fake_client)

    # Mock DB session
    mock_db = MagicMock()
    # First query returns None (not existing), so it gets persisted
    mock_db.scalar.return_value = None

    created_jobs = []

    def fake_create_job(db, payload):
        comp = Company(canonical_name=payload.company_name)
        fp = JobService.generate_fingerprint(
            payload.company_name, payload.title, payload.location, payload.description
        )
        j = Job(
            company_id=comp.id,
            title=payload.title,
            description=payload.description,
            fingerprint=fp,
        )
        created_jobs.append(j)
        return j

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(JobService, "create_job", fake_create_job)

        prefs = SearchPlannerPreferences(role="Staff Engineer")
        result = await service.discover_jobs(mock_db, prefs, persist=True)

        assert result.total_discovered == 3
        # Duplicate raw_item_duplicate must be skipped!
        assert result.newly_persisted == 2
        assert result.duplicates_skipped == 1
        assert len(result.jobs) == 2


# ---------------------------------------------------------------------------
# 4. SerpApiClient Error Handling Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_serpapi_missing_api_key():
    """Verify that missing API key raises SerpApiConfigError."""
    client = SerpApiClient(api_key="")
    params = SearchPlanner.plan_query(SearchPlannerPreferences(role="Engineer"))

    with pytest.raises(SerpApiConfigError) as exc_info:
        await client.search_jobs(params)
    assert "SERPAPI_API_KEY is not configured" in str(exc_info.value)


@pytest.mark.asyncio
async def test_serpapi_http_error_handling(monkeypatch):
    """Verify handling of upstream HTTP failure (e.g. 403 or 429)."""
    client = SerpApiClient(api_key="dummy-key")
    params = SearchPlanner.plan_query(SearchPlannerPreferences(role="Engineer"))

    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.text = "Monthly search rate limit exceeded."

    async def fake_get(*args, **kwargs):
        return mock_resp

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    with pytest.raises(SerpApiHttpError) as exc_info:
        await client.search_jobs(params)
    assert exc_info.value.status_code == 429
    assert "SerpApi search failed with status 429" in exc_info.value.message


@pytest.mark.asyncio
async def test_serpapi_malformed_json_handling(monkeypatch):
    """Verify handling of malformed or invalid response payload."""
    client = SerpApiClient(api_key="dummy-key")
    params = SearchPlanner.plan_query(SearchPlannerPreferences(role="Engineer"))

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.side_effect = ValueError("Invalid JSON string")

    async def fake_get(*args, **kwargs):
        return mock_resp

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    with pytest.raises(SerpApiParseError) as exc_info:
        await client.search_jobs(params)
    assert "Invalid JSON returned" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 5. API Discovery Endpoint Tests
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_api_discover_jobs_endpoint(monkeypatch):
    """Verify POST /api/v1/jobs/search integrates Search Planner and returns normalized jobs."""
    mock_raw_item = SerpApiJobItem(
        title="Backend Engineer",
        company_name="Google",
        location="Bangalore",
        description="Scalable distributed systems.",
        job_id="goog-123",
        extensions=["Full-time"],
    )
    raw_response = SerpApiRawResponse(jobs_results=[mock_raw_item])

    fake_client = AsyncMock()
    fake_client.search_jobs.return_value = raw_response

    monkeypatch.setattr(
        "apps.api.routers.jobs.SerpApiDiscoveryService",
        lambda: SerpApiDiscoveryService(client=fake_client),
    )

    mock_db = MagicMock()
    mock_db.scalar.return_value = None

    def fake_create_job(db, payload):
        comp_id = uuid.uuid4()
        comp = Company(id=comp_id, canonical_name=payload.company_name)
        fp = JobService.generate_fingerprint(
            payload.company_name, payload.title, payload.location, payload.description
        )
        now = datetime.now(UTC)
        j = Job(
            id=uuid.uuid4(),
            company_id=comp_id,
            title=payload.title,
            description=payload.description,
            fingerprint=fp,
            location=payload.location,
            remote_type=payload.remote_type,
            employment_type=payload.employment_type,
            salary_min=payload.salary_min,
            salary_max=payload.salary_max,
            currency=payload.currency,
            normalized_requirements_json=payload.normalized_requirements_json or [],
            source_urls_json=payload.source_urls_json or [],
            source_names_json=payload.source_names_json or [],
            canonical_url=payload.canonical_url,
            external_id=payload.external_id,
            posted_at=payload.posted_at,
            first_seen_at=now,
            last_seen_at=now,
            metadata_json=payload.metadata_json,
            created_at=now,
            updated_at=now,
        )
        j.company = comp
        return j

    monkeypatch.setattr(JobService, "create_job", fake_create_job)

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/api/v1/jobs/search",
                json={
                    "role": "Backend Engineer",
                    "skills": ["Python", "Go"],
                    "location": "Bangalore",
                    "remote": False,
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["total_discovered"] == 1
            assert data["newly_persisted"] == 1
            assert len(data["jobs"]) == 1
            assert data["jobs"][0]["title"] == "Backend Engineer"
            assert data["jobs"][0]["company_name"] == "Google"
            assert "Backend Engineer" in data["query_executed"]
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_api_discover_jobs_service_unavailable(monkeypatch):
    """Verify that unconfigured SerpApi returns HTTP 503."""

    class BrokenService:
        async def discover_jobs(self, *args, **kwargs):
            raise SerpApiConfigError("SERPAPI_API_KEY is not configured.")

    monkeypatch.setattr("apps.api.routers.jobs.SerpApiDiscoveryService", BrokenService)

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/api/v1/jobs/search",
                json={"role": "Backend Engineer"},
            )
            assert res.status_code == 503
            assert "SERPAPI_API_KEY is not configured" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()
