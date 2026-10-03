from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db.models import Job
from apps.api.integrations.serpapi.client import SerpApiClient, SerpApiClientProtocol
from apps.api.integrations.serpapi.normalizer import SerpApiNormalizer
from apps.api.integrations.serpapi.queries import SearchPlanner, SearchPlannerPreferences
from apps.api.schemas.job import JobCreate
from apps.api.services.job_service import JobService


class DiscoveryExecutionResult:
    def __init__(
        self,
        query_executed: str,
        total_discovered: int,
        newly_persisted: int,
        duplicates_skipped: int,
        jobs: list[Job],
        search_metadata: dict[str, Any] | None = None,
    ):
        self.query_executed = query_executed
        self.total_discovered = total_discovered
        self.newly_persisted = newly_persisted
        self.duplicates_skipped = duplicates_skipped
        self.jobs = jobs
        self.search_metadata = search_metadata or {}


class SerpApiDiscoveryService:
    """End-to-end job discovery coordinator:

    Search Planner -> SerpApi Client -> Result Normalizer -> Deduplication -> DB Persistence.
    """

    def __init__(self, client: SerpApiClientProtocol | None = None):
        self._client = client or SerpApiClient()

    async def discover_jobs(
        self,
        db: Session,
        preferences: SearchPlannerPreferences,
        persist: bool = True,
    ) -> DiscoveryExecutionResult:
        # 1. Plan search query
        params = SearchPlanner.plan_query(preferences)
        plan_metadata = SearchPlanner.serialize_plan_metadata(preferences, params)

        # 2. Execute SerpApi search
        raw_response = await self._client.search_jobs(params)

        # 3. Normalize results & deduplicate
        seen_fingerprints: set[str] = set()
        resolved_jobs: list[Job] = []
        newly_persisted_count = 0
        duplicates_skipped_count = 0

        for item in raw_response.jobs_results:
            normalized = SerpApiNormalizer.normalize_job(
                item=item,
                search_query=params.q,
                query_metadata=plan_metadata,
            )

            # Intra-batch deduplication
            if normalized.fingerprint in seen_fingerprints:
                duplicates_skipped_count += 1
                continue
            seen_fingerprints.add(normalized.fingerprint)

            # Check if job already exists in database
            existing_job = db.scalar(select(Job).where(Job.fingerprint == normalized.fingerprint))

            if existing_job:
                resolved_jobs.append(existing_job)
                duplicates_skipped_count += 1
            elif persist:
                # Convert normalized job into JobCreate payload
                job_create_payload = JobCreate(
                    company_name=normalized.company_name,
                    title=normalized.title,
                    location=normalized.location,
                    remote_type=normalized.remote_type,
                    employment_type=normalized.employment_type,
                    salary_min=normalized.salary_min,
                    salary_max=normalized.salary_max,
                    currency=normalized.currency,
                    description=normalized.description,
                    normalized_requirements_json=normalized.normalized_requirements,
                    source_urls_json=normalized.source_urls,
                    source_names_json=normalized.source_names,
                    canonical_url=normalized.canonical_url,
                    external_id=normalized.external_id,
                    posted_at=normalized.posted_at,
                    metadata_json=normalized.provenance,
                )
                persisted_job = JobService.create_job(db, job_create_payload)
                resolved_jobs.append(persisted_job)
                newly_persisted_count += 1

        return DiscoveryExecutionResult(
            query_executed=params.q,
            total_discovered=len(raw_response.jobs_results),
            newly_persisted=newly_persisted_count,
            duplicates_skipped=duplicates_skipped_count,
            jobs=resolved_jobs,
            search_metadata=plan_metadata,
        )
