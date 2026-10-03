from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


# ----------------------------------------------------
# Raw / Intermediate SerpApi Response Models
# ----------------------------------------------------
class SerpApiApplyOption(BaseModel):
    title: str | None = None
    link: str | None = None


class SerpApiDetectedExtensions(BaseModel):
    posted_at: str | None = None
    schedule_type: str | None = None
    work_from_home: bool | None = None
    salary: str | None = None


class SerpApiJobHighlight(BaseModel):
    title: str | None = None
    items: list[str] = Field(default_factory=list)


class SerpApiJobItem(BaseModel):
    """Raw item from SerpApi google_jobs results array."""

    title: str
    company_name: str
    location: str | None = None
    via: str | None = None
    description: str | None = None
    job_id: str | None = None
    thumbnail: str | None = None
    extensions: list[str] = Field(default_factory=list)
    detected_extensions: SerpApiDetectedExtensions | None = None
    job_highlights: list[SerpApiJobHighlight] = Field(default_factory=list)
    apply_options: list[SerpApiApplyOption] = Field(default_factory=list)
    share_link: str | None = None


class SerpApiSearchMetadata(BaseModel):
    id: str | None = None
    status: str | None = None
    created_at: str | None = None
    total_time_taken: float | None = None


class SerpApiSearchParameters(BaseModel):
    engine: str = "google_jobs"
    q: str
    location: str | None = None
    hl: str = "en"
    start: int = 0


class SerpApiRawResponse(BaseModel):
    """Envelope returned by SerpApi."""

    search_metadata: SerpApiSearchMetadata | None = None
    search_parameters: dict[str, Any] | None = None
    jobs_results: list[SerpApiJobItem] = Field(default_factory=list)
    error: str | None = None


# ----------------------------------------------------
# Normalized Discovered Job
# ----------------------------------------------------
class NormalizedDiscoveredJob(BaseModel):
    """Normalized candidate job ready for JobOS domain models and deduplication."""

    title: str
    company_name: str
    location: str | None = None
    remote_type: str | None = None
    employment_type: str | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    currency: str | None = None
    description: str
    normalized_requirements: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)
    source_names: list[str] = Field(default_factory=list)
    canonical_url: str | None = None
    external_id: str | None = None
    posted_at: datetime | None = None
    fingerprint: str
    provenance: dict[str, Any] = Field(default_factory=dict)
