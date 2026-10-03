from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.common import BaseSchema


class CompanyBase(BaseModel):
    canonical_name: str = Field(..., min_length=1, max_length=255)
    domain: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class CompanyResponse(CompanyBase, BaseSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime


class JobCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    company_domain: str | None = None
    title: str = Field(..., min_length=1, max_length=255)
    location: str | None = None
    remote_type: str | None = None
    employment_type: str | None = None
    salary_min: Decimal | None = None
    salary_max: Decimal | None = None
    currency: str | None = None
    description: str = Field(..., min_length=1)
    normalized_requirements_json: list[Any] = Field(default_factory=list)
    source_urls_json: list[str] = Field(default_factory=list)
    source_names_json: list[str] = Field(default_factory=list)
    canonical_url: str | None = None
    external_id: str | None = None
    posted_at: datetime | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class JobResponse(BaseSchema):
    id: UUID
    company_id: UUID
    company_name: str | None = None
    title: str
    location: str | None
    remote_type: str | None
    employment_type: str | None
    salary_min: Decimal | None
    salary_max: Decimal | None
    currency: str | None
    description: str
    normalized_requirements_json: list[Any]
    source_urls_json: list[str]
    source_names_json: list[str]
    canonical_url: str | None
    external_id: str | None
    posted_at: datetime | None
    first_seen_at: datetime
    last_seen_at: datetime
    fingerprint: str
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class JobSearchQuery(BaseModel):
    query: str | None = None
    location: str | None = None
    remote_type: str | None = None
    employment_type: str | None = None
    min_salary: Decimal | None = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class JobMatchRequest(BaseModel):
    career_profile_id: UUID


class JobMatchResponse(BaseSchema):
    id: UUID
    job_id: UUID
    career_profile_id: UUID
    overall_score: int = Field(..., ge=0, le=100)
    component_scores_json: dict[str, Any] = Field(default_factory=dict)
    strengths_json: list[Any] = Field(default_factory=list)
    gaps_json: list[Any] = Field(default_factory=list)
    explanation: str
    created_at: datetime


class JobIdentifyRequest(BaseModel):
    url: str | None = None
    title: str | None = None
    company_name: str | None = None
    external_id: str | None = None


class JobIdentifyResponse(BaseModel):
    matched: bool
    job: JobResponse | None = None
    confidence: float = 0.0
