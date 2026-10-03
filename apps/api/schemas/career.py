from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.common import BaseSchema


# ----------------------------------------------------
# Skills
# ----------------------------------------------------
class SkillCreate(BaseModel):
    normalized_name: str = Field(..., min_length=1, max_length=100)


class SkillResponse(BaseSchema):
    id: UUID
    normalized_name: str


class CareerProfileSkillCreate(BaseModel):
    skill_name: str = Field(..., min_length=1, max_length=100)
    proficiency: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class CareerProfileSkillResponse(BaseSchema):
    id: UUID
    skill_id: UUID
    skill_name: str
    proficiency: str | None
    metadata_json: dict[str, Any]


# ----------------------------------------------------
# Experiences
# ----------------------------------------------------
class CareerExperienceCreate(BaseModel):
    organization: str = Field(..., min_length=1, max_length=255)
    title: str = Field(..., min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None
    evidence_status: str = Field(default="unverified", max_length=50)


class CareerExperienceResponse(BaseSchema):
    id: UUID
    career_profile_id: UUID
    organization: str
    title: str
    start_date: date | None
    end_date: date | None
    description: str | None
    evidence_status: str
    created_at: datetime
    updated_at: datetime


# ----------------------------------------------------
# Career Evidence
# ----------------------------------------------------
class CareerEvidenceCreate(BaseModel):
    type: str = Field(..., min_length=1, max_length=100)  # github_repo, project, bullet, cert
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    source_type: str = Field(..., min_length=1, max_length=100)  # github, resume_upload, manual
    source_url: str | None = None
    source_reference: str | None = None
    verification_state: str = Field(default="unverified", max_length=50)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class CareerEvidenceResponse(BaseSchema):
    id: UUID
    career_profile_id: UUID
    type: str
    title: str
    content: str
    source_type: str
    source_url: str | None
    source_reference: str | None
    verification_state: str
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ----------------------------------------------------
# Career Profile
# ----------------------------------------------------
class CareerProfileCreate(BaseModel):
    user_id: UUID
    headline: str | None = None
    summary: str | None = None
    location: str | None = None
    preferences_json: dict[str, Any] = Field(default_factory=dict)


class CareerProfileUpdate(BaseModel):
    headline: str | None = None
    summary: str | None = None
    location: str | None = None
    preferences_json: dict[str, Any] | None = None


class CareerProfileResponse(BaseSchema):
    id: UUID
    user_id: UUID
    headline: str | None
    summary: str | None
    location: str | None
    preferences_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    experiences: list[CareerExperienceResponse] = Field(default_factory=list)
    skills: list[CareerProfileSkillResponse] = Field(default_factory=list)
    evidence: list[CareerEvidenceResponse] = Field(default_factory=list)


class QuestionDraftRequest(BaseModel):
    career_profile_id: UUID
    question_text: str = Field(..., min_length=1)
    job_id: UUID | None = None


class QuestionDraftResponse(BaseModel):
    question_text: str
    draft_answer: str
    evidence_used: list[dict[str, Any]] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
