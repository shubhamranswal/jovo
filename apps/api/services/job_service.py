import hashlib
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from apps.api.db.models import (
    Company,
    Job,
    JobMatch,
)
from apps.api.schemas.job import JobCreate, JobSearchQuery


class JobService:
    @staticmethod
    def generate_fingerprint(
        company_name: str, title: str, location: str | None, description: str
    ) -> str:
        """Create deterministic fingerprint for deduplication."""
        loc_part = (location or "").lower().strip()
        comp_part = company_name.lower().strip()
        title_part = title.lower().strip()
        desc_part = description[:300].strip()
        raw = f"{comp_part}|{title_part}|{loc_part}|{desc_part}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def get_or_create_company(db: Session, name: str, domain: str | None = None) -> Company:
        clean_name = name.strip()[:255]
        clean_domain = domain.strip()[:255] if domain else None
        company = db.scalar(select(Company).where(Company.canonical_name == clean_name))
        if not company:
            company = Company(
                canonical_name=clean_name,
                domain=clean_domain,
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        return company

    @staticmethod
    def create_job(db: Session, payload: JobCreate) -> Job:
        company = JobService.get_or_create_company(db, payload.company_name, payload.company_domain)
        fingerprint = JobService.generate_fingerprint(
            payload.company_name, payload.title, payload.location, payload.description
        )

        existing = db.scalar(select(Job).where(Job.fingerprint == fingerprint))
        if existing:
            return existing

        job = Job(
            company_id=company.id,
            title=(payload.title[:255] if payload.title else "Untitled Role"),
            location=(payload.location[:255] if payload.location else None),
            remote_type=(payload.remote_type[:50] if payload.remote_type else None),
            employment_type=(payload.employment_type[:50] if payload.employment_type else None),
            salary_min=payload.salary_min,
            salary_max=payload.salary_max,
            currency=(payload.currency[:10] if payload.currency else None),
            description=payload.description,
            normalized_requirements_json=payload.normalized_requirements_json,
            source_urls_json=payload.source_urls_json,
            source_names_json=payload.source_names_json,
            canonical_url=payload.canonical_url,
            external_id=(payload.external_id[:255] if payload.external_id else None),
            posted_at=payload.posted_at,
            fingerprint=fingerprint,
            metadata_json=payload.metadata_json,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    @staticmethod
    def get_job(db: Session, job_id: UUID) -> Job:
        job = db.scalar(select(Job).where(Job.id == job_id).options(joinedload(Job.company)))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )
        return job

    @staticmethod
    def _seed_demo_job_if_empty(db: Session) -> None:
        """Seed deterministic demo job matching Workday fixture if catalog is empty."""
        has_any = db.scalar(select(Job.id).limit(1))
        if not has_any:
            JobService.get_or_create_company(db, "Acme Cloud", "acmecloud.com")
            JobService.create_job(
                db,
                JobCreate(
                    title="Senior Platform Engineer",
                    company_name="Acme Cloud",
                    company_domain="acmecloud.com",
                    location="San Francisco, CA (Hybrid)",
                    remote_type="hybrid",
                    employment_type="full_time",
                    salary_min=165000,
                    salary_max=215000,
                    currency="USD",
                    description=(
                        "We are seeking a Senior Platform Engineer to build scalable microservices "
                        "and high-throughput distributed queues. You will partner with our cloud "
                        "infrastructure team to scale distributed databases and low-latency API "
                        "gateways."
                    ),
                    normalized_requirements_json=[
                        "python",
                        "fastapi",
                        "postgresql",
                        "docker",
                        "distributed systems",
                    ],
                    source_urls_json=[
                        "https://acmecloud.wd1.myworkdayjobs.com/en-US/careers/job/REQ-84920"
                    ],
                    source_names_json=["Workday"],
                    canonical_url="https://acmecloud.wd1.myworkdayjobs.com/en-US/careers/job/REQ-84920",
                    external_id="REQ-84920",
                ),
            )

    @staticmethod
    def list_jobs(db: Session, query_params: JobSearchQuery) -> tuple[list[Job], int]:
        from apps.api.core.config import settings

        if settings.DEMO_MODE:
            from apps.api.services.demo_workspace_service import DemoWorkspaceService

            DemoWorkspaceService.ensure_demo_workspace(db)
        else:
            JobService._seed_demo_job_if_empty(db)
        stmt = select(Job).options(joinedload(Job.company))

        if query_params.query:
            term = f"%{query_params.query}%"
            stmt = stmt.where(or_(Job.title.ilike(term), Job.description.ilike(term)))
        if query_params.location:
            stmt = stmt.where(Job.location.ilike(f"%{query_params.location}%"))
        if query_params.remote_type:
            stmt = stmt.where(Job.remote_type == query_params.remote_type)
        if query_params.employment_type:
            stmt = stmt.where(Job.employment_type == query_params.employment_type)
        if query_params.min_salary:
            stmt = stmt.where(Job.salary_min >= query_params.min_salary)

        total = len(list(db.scalars(stmt)))
        jobs = list(db.scalars(stmt.offset(query_params.offset).limit(query_params.limit)))
        return jobs, total

    @staticmethod
    def calculate_match(db: Session, job_id: UUID, career_profile_id: UUID) -> JobMatch:
        """Deterministic, explainable job match computation based on career evidence."""
        from apps.api.services.match_engine import MatchEngine

        return MatchEngine.evaluate_match(db, job_id, career_profile_id)

    @staticmethod
    def get_match(db: Session, job_id: UUID, career_profile_id: UUID) -> JobMatch | None:
        return db.scalar(
            select(JobMatch).where(
                JobMatch.job_id == job_id,
                JobMatch.career_profile_id == career_profile_id,
            )
        )

    @staticmethod
    def identify_job(
        db: Session,
        url: str | None = None,
        title: str | None = None,
        company_name: str | None = None,
        external_id: str | None = None,
    ) -> tuple[Job | None, float]:
        """Identifies an existing Job in JobOS matching URL, external ID, or company + title.

        Returns (Job, confidence score 0.0 - 1.0).
        """
        # 1. Exact canonical URL or external_id match
        if external_id:
            job = db.scalar(
                select(Job).where(Job.external_id == external_id).options(joinedload(Job.company))
            )
            if job:
                return job, 1.0

        if url:
            clean_url = url.split("?")[0].rstrip("/")
            # Check canonical_url
            job = db.scalar(
                select(Job)
                .where(Job.canonical_url.ilike(f"{clean_url}%"))
                .options(joinedload(Job.company))
            )
            if job:
                return job, 0.95

            # Check inside source_urls_json or canonical_url contains
            all_jobs = list(db.scalars(select(Job).options(joinedload(Job.company))))
            for j in all_jobs:
                if j.canonical_url and (
                    clean_url in j.canonical_url or j.canonical_url in clean_url
                ):
                    return j, 0.9
                source_urls = j.source_urls_json or []
                for s_url in source_urls:
                    if s_url and (clean_url in s_url or s_url in clean_url):
                        return j, 0.9

        # 2. Match by company name and title
        if company_name and title:
            comp_clean = company_name.strip().lower()
            title_clean = title.strip().lower()

            all_jobs = list(db.scalars(select(Job).options(joinedload(Job.company))))
            for j in all_jobs:
                j_comp = (j.company.canonical_name if j.company else "").lower()
                j_title = j.title.lower()

                comp_match = comp_clean in j_comp or j_comp in comp_clean
                title_match = title_clean in j_title or j_title in title_clean

                if comp_match and title_match:
                    return j, 0.85
                elif comp_match and (title_clean[:10] in j_title):
                    return j, 0.75

        return None, 0.0
