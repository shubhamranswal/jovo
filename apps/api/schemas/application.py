from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.schemas.common import BaseSchema
from apps.api.schemas.interview import FollowUpResponse, InterviewResponse


# ----------------------------------------------------
# Application Snapshot
# ----------------------------------------------------
class ApplicationSnapshotCreate(BaseModel):
    job_description: str = Field(..., min_length=1)
    page_title: str | None = None
    page_url: str | None = None
    extraction_metadata_json: dict[str, Any] = Field(default_factory=dict)


class ApplicationSnapshotResponse(BaseSchema):
    id: UUID
    application_id: UUID
    job_description: str
    page_title: str | None
    page_url: str | None
    captured_at: datetime
    extraction_metadata_json: dict[str, Any]


# ----------------------------------------------------
# Application Document
# ----------------------------------------------------
class ApplicationDocumentCreate(BaseModel):
    document_type: str = Field(..., min_length=1, max_length=50)  # "resume" or "cover_letter"
    document_id: UUID | None = None
    version_label: str = Field(..., min_length=1, max_length=100)


class ApplicationDocumentResponse(BaseSchema):
    id: UUID
    application_id: UUID
    document_type: str
    document_id: UUID | None
    version_label: str
    content: str | None = None  # Exact text content of the submitted document
    created_at: datetime
    updated_at: datetime


# ----------------------------------------------------
# Application Question & Answer
# ----------------------------------------------------
class ApplicationAnswerCreate(BaseModel):
    answer_text: str = Field(..., min_length=1)
    source: str = Field(default="user_typed", max_length=50)  # autofill, llm_draft, user_typed
    user_approved: bool = True


class ApplicationAnswerResponse(BaseSchema):
    id: UUID
    question_id: UUID
    answer_text: str
    source: str
    user_approved: bool
    created_at: datetime


class ApplicationQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=1)
    normalized_question: str | None = None
    question_type: str = Field(default="text", max_length=50)
    page_field_name: str | None = None
    order_index: int = 0
    answer: ApplicationAnswerCreate | None = None


class ApplicationQuestionResponse(BaseSchema):
    id: UUID
    application_id: UUID
    question_text: str
    normalized_question: str | None
    question_type: str
    page_field_name: str | None
    order_index: int
    answers: list[ApplicationAnswerResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ----------------------------------------------------
# Core Application & Application Capsule
# ----------------------------------------------------
class ApplicationCreate(BaseModel):
    user_id: UUID
    job_id: UUID | None = None
    company_id: UUID | None = None
    company_name: str | None = None
    title: str = Field(..., min_length=1, max_length=255)
    source: str = Field(..., min_length=1, max_length=100)
    application_url: str | None = None
    status: str = Field(default="Saved", max_length=50)
    notes: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)

    # Optional initial capture components at creation time
    initial_snapshot: ApplicationSnapshotCreate | None = None
    initial_documents: list[ApplicationDocumentCreate] = Field(default_factory=list)
    initial_questions: list[ApplicationQuestionCreate] = Field(default_factory=list)


class ApplicationUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    notes: str | None = None
    applied_at: datetime | None = None
    metadata_json: dict[str, Any] | None = None


class ApplicationSummaryResponse(BaseSchema):
    id: UUID
    user_id: UUID
    job_id: UUID | None
    company_id: UUID | None
    company_name: str | None = None
    title: str
    source: str
    application_url: str | None
    status: str
    applied_at: datetime | None
    captured_at: datetime | None
    notes: str | None
    metadata_json: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ApplicationCapsuleResponse(BaseSchema):
    """The complete Application Capsule containing all historical application memory."""

    application: ApplicationSummaryResponse
    latest_snapshot: ApplicationSnapshotResponse | None = None
    documents: list[ApplicationDocumentResponse] = Field(default_factory=list)
    questions: list[ApplicationQuestionResponse] = Field(default_factory=list)
    interviews: list[InterviewResponse] = Field(default_factory=list)
    follow_ups: list[FollowUpResponse] = Field(default_factory=list)
