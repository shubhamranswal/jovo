from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.common import BaseSchema


class ResumeUploadRequest(BaseModel):
    career_profile_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    extracted_text: str = Field(..., min_length=1)
    source_file: str | None = None
    is_master: bool = False


class ResumeResponse(BaseSchema):
    id: UUID
    career_profile_id: UUID
    name: str
    source_file: str | None
    extracted_text: str
    version: int
    is_master: bool
    created_at: datetime
    updated_at: datetime


class ResumeVersionCreate(BaseModel):
    career_profile_id: UUID
    job_id: UUID | None = None
    base_resume_id: UUID | None = None
    content: str = Field(..., min_length=1)
    version_label: str = Field(..., min_length=1, max_length=100)
    generation_metadata_json: dict[str, Any] = Field(default_factory=dict)


class ResumeVersionResponse(BaseSchema):
    id: UUID
    career_profile_id: UUID
    job_id: UUID | None
    base_resume_id: UUID | None
    content: str
    version_label: str
    generation_metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CoverLetterCreate(BaseModel):
    career_profile_id: UUID
    job_id: UUID
    content: str = Field(..., min_length=1)
    generation_metadata_json: dict[str, Any] = Field(default_factory=dict)


class CoverLetterResponse(BaseSchema):
    id: UUID
    career_profile_id: UUID
    job_id: UUID
    content: str
    version: int
    generation_metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime
