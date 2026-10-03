from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.resume import CoverLetterResponse, ResumeVersionResponse


class JobTailorRequest(BaseModel):
    career_profile_id: UUID = Field(..., description="Candidate career profile ID")
    base_resume_id: UUID | None = Field(
        default=None,
        description="Optional base resume to tailor from (defaults to master resume)",
    )


class JobTailorResponse(BaseModel):
    job_id: UUID
    career_profile_id: UUID
    tailored_resume: ResumeVersionResponse
    cover_letter: CoverLetterResponse
    changes_explanation: list[str] = Field(default_factory=list)
    evidence_used: list[dict[str, Any]] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
