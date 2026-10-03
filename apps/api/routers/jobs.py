from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.integrations.serpapi import (
    SearchPlannerPreferences,
    SerpApiConfigError,
    SerpApiDiscoveryService,
    SerpApiHttpError,
)
from apps.api.schemas.common import PaginatedResponse
from apps.api.schemas.discovery import JobDiscoveryRequest, JobDiscoveryResponse
from apps.api.schemas.job import (
    JobCreate,
    JobIdentifyRequest,
    JobIdentifyResponse,
    JobMatchRequest,
    JobMatchResponse,
    JobResponse,
    JobSearchQuery,
)
from apps.api.schemas.tailor import JobTailorRequest, JobTailorResponse
from apps.api.services.job_service import JobService
from apps.api.services.tailor_service import TailorService

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("/search", response_model=JobDiscoveryResponse)
async def discover_jobs(
    payload: JobDiscoveryRequest,
    db: Session = Depends(get_db),
):
    """Execute live SerpApi job discovery based on user career search preferences."""
    preferences = SearchPlannerPreferences(
        role=payload.role,
        skills=payload.skills,
        company=payload.company,
        location=payload.location,
        remote=payload.remote,
        experience_level=payload.experience_level,
        employment_type=payload.employment_type,
        start=payload.start,
    )
    service = SerpApiDiscoveryService()
    try:
        result = await service.discover_jobs(db, preferences, persist=payload.persist)
    except SerpApiConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except SerpApiHttpError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    job_responses = []
    for j in result.jobs:
        resp = JobResponse.model_validate(j)
        company = getattr(j, "company", None)
        if company:
            resp.company_name = getattr(company, "canonical_name", None)
        job_responses.append(resp)

    return JobDiscoveryResponse(
        query_executed=result.query_executed,
        total_discovered=result.total_discovered,
        newly_persisted=result.newly_persisted,
        duplicates_skipped=result.duplicates_skipped,
        jobs=job_responses,
        search_metadata=result.search_metadata,
    )


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_or_ingest_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
):
    job = JobService.create_job(db, payload)
    resp = JobResponse.model_validate(job)
    company = getattr(job, "company", None)
    if company:
        resp.company_name = getattr(company, "canonical_name", None)
    return resp


@router.get("", response_model=PaginatedResponse[JobResponse])
def list_jobs(
    query: str | None = Query(None, description="Search keyword"),
    location: str | None = Query(None, description="Location search"),
    remote_type: str | None = Query(None, description="Remote type"),
    employment_type: str | None = Query(None, description="Employment type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * page_size
    search_params = JobSearchQuery(
        query=query,
        location=location,
        remote_type=remote_type,
        employment_type=employment_type,
        limit=page_size,
        offset=offset,
    )
    jobs, total = JobService.list_jobs(db, search_params)

    items = []
    for j in jobs:
        r = JobResponse.model_validate(j)
        company = getattr(j, "company", None)
        if company:
            r.company_name = getattr(company, "canonical_name", None)
        items.append(r)

    return PaginatedResponse[JobResponse](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    job = JobService.get_job(db, job_id)
    resp = JobResponse.model_validate(job)
    company = getattr(job, "company", None)
    if company:
        resp.company_name = getattr(company, "canonical_name", None)
    return resp


@router.post("/{job_id}/match", response_model=JobMatchResponse)
def match_job_with_career_profile(
    job_id: UUID,
    payload: JobMatchRequest,
    db: Session = Depends(get_db),
):
    match = JobService.calculate_match(db, job_id, payload.career_profile_id)
    return JobMatchResponse.model_validate(match)


@router.get("/{job_id}/match/{career_profile_id}", response_model=JobMatchResponse)
def get_job_match(
    job_id: UUID,
    career_profile_id: UUID,
    db: Session = Depends(get_db),
):
    match = JobService.get_match(db, job_id, career_profile_id)
    if not match:
        match = JobService.calculate_match(db, job_id, career_profile_id)
    return JobMatchResponse.model_validate(match)


@router.post("/identify", response_model=JobIdentifyResponse)
def identify_job_by_url_or_meta(
    payload: JobIdentifyRequest,
    db: Session = Depends(get_db),
):
    """Identifies an existing Job in JobOS by URL, external ID, or company & title."""
    job, confidence = JobService.identify_job(
        db,
        url=payload.url,
        title=payload.title,
        company_name=payload.company_name,
        external_id=payload.external_id,
    )
    if not job:
        return JobIdentifyResponse(matched=False, job=None, confidence=0.0)

    job_resp = JobResponse.model_validate(job)
    company = getattr(job, "company", None)
    if company:
        job_resp.company_name = getattr(company, "canonical_name", None)
    return JobIdentifyResponse(matched=True, job=job_resp, confidence=confidence)


@router.post("/{job_id}/tailor", response_model=JobTailorResponse)
async def tailor_application_materials(
    job_id: UUID,
    payload: JobTailorRequest,
    db: Session = Depends(get_db),
):
    """Generate evidence-grounded tailored resume and cover letter for target job."""
    return await TailorService.tailor_application_materials(db, job_id, payload)
