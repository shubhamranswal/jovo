from typing import Any

from pydantic import BaseModel, Field

from apps.api.schemas.job import JobResponse


class JobDiscoveryRequest(BaseModel):
    """User search preferences sent to JobOS for live SerpApi job discovery."""

    role: str = Field(..., min_length=1, max_length=255, description="Target role / keywords")
    skills: list[str] = Field(default_factory=list, description="Key skills to include in search")
    company: str | None = Field(default=None, description="Optional target company filter")
    location: str | None = Field(default=None, description="Location filter")
    remote: bool | None = Field(default=None, description="Whether to filter for remote roles")
    experience_level: str | None = Field(
        default=None, description="Experience level (e.g. 'Senior', 'Lead')"
    )
    employment_type: str | None = Field(
        default=None, description="Employment type (e.g. 'full-time', 'contract')"
    )
    start: int = Field(default=0, ge=0, description="SerpApi pagination start offset")
    persist: bool = Field(
        default=True, description="Whether to persist newly discovered jobs to DB"
    )


class JobDiscoveryResponse(BaseModel):
    """Normalized results returned from SerpApi job discovery."""

    query_executed: str
    total_discovered: int
    newly_persisted: int
    duplicates_skipped: int
    jobs: list[JobResponse]
    search_metadata: dict[str, Any] = Field(default_factory=dict)
