from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.common import BaseSchema


class InterviewCreate(BaseModel):
    stage: str = Field(..., min_length=1, max_length=100)
    scheduled_at: datetime | None = None
    notes: str | None = None
    preparation_json: dict[str, Any] = Field(default_factory=dict)


class InterviewResponse(BaseSchema):
    id: UUID
    application_id: UUID
    stage: str
    scheduled_at: datetime | None
    notes: str | None
    preparation_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class InterviewPrepContext(BaseModel):
    """Structured context assembled from the exact submitted application capsule."""

    application_id: UUID
    company_name: str
    role_title: str
    job_description_snapshot: str
    submitted_resume_content: str | None = None
    submitted_cover_letter_content: str | None = None
    submitted_qa: list[dict[str, str]] = Field(default_factory=list)


class InterviewPrepResponse(BaseModel):
    """Interview preparation generated from the exact application memory."""

    application_id: UUID
    stage: str
    technical_topics: list[str] = Field(default_factory=list)
    role_questions: list[str] = Field(default_factory=list)
    resume_questions: list[str] = Field(default_factory=list)
    behavioral_questions: list[str] = Field(default_factory=list)
    weak_spots: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    preparation_checklist: list[str] = Field(default_factory=list)
    grounded_in_capsule: bool = True
    generated_at: datetime


class FollowUpCreate(BaseModel):
    type: str = Field(..., min_length=1, max_length=100)
    due_at: datetime
    notes: str | None = None


class FollowUpUpdate(BaseModel):
    completed_at: datetime | None = None
    notes: str | None = None


class FollowUpResponse(BaseSchema):
    id: UUID
    application_id: UUID
    type: str
    due_at: datetime
    completed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
