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


class InterviewReadinessResponse(BaseModel):
    """Explainable interview readiness assessment without fake probabilities."""

    category: str = Field(
        ...,
        description="Explainable readiness level: 'Strong', 'Needs Review', or 'Evidence Gap'",
    )
    explanation: str = Field(
        ...,
        description="Clear rationale detailing why this readiness tier was assigned",
    )
    signals: list[str] = Field(
        default_factory=list,
        description="Concrete signals assessing competency coverage, evidence support, and gaps",
    )


class InterviewQuestionItem(BaseModel):
    """Structured interview question with grounding, rationale, and preparation advice."""

    id: str
    question: str
    category: str = Field(
        ...,
        description="'Technical', 'Behavioral', 'Application-Specific', or 'Application-Followup'",
    )
    why_asked: str
    relevant_evidence: str = Field(
        ...,
        description="Evidence item backing candidate, or 'Evidence not found in your profile.'",
    )
    prep_notes: str
    user_answer: str | None = None


class InterviewPrepResponse(BaseModel):
    """Interview preparation generated from the exact application memory."""

    application_id: UUID
    stage: str
    role_summary: str = Field(
        default="",
        description="Summary of what the employer prioritizes based on the frozen JD",
    )
    readiness: InterviewReadinessResponse | None = None
    structured_questions: list[InterviewQuestionItem] = Field(default_factory=list)
    technical_topics: list[str] = Field(default_factory=list)
    role_questions: list[str] = Field(default_factory=list)
    resume_questions: list[str] = Field(default_factory=list)
    behavioral_questions: list[str] = Field(default_factory=list)
    application_specific_questions: list[str] = Field(default_factory=list)
    application_followup_questions: list[str] = Field(default_factory=list)
    evidence_gaps: list[str] = Field(default_factory=list)
    weak_spots: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    preparation_checklist: list[str] = Field(default_factory=list)
    evidence_to_review: list[dict[str, Any]] = Field(default_factory=list)
    grounded_in_capsule: bool = True
    generated_at: datetime


class FollowUpCreate(BaseModel):
    type: str = Field(..., min_length=1, max_length=100)
    due_at: datetime
    notes: str | None = None


class FollowUpUpdate(BaseModel):
    completed_at: datetime | None = None
    notes: str | None = None
    status: str | None = Field(
        default=None,
        description="Target status: 'Pending', 'Completed', or 'Skipped'",
    )


class FollowUpResponse(BaseSchema):
    id: UUID
    application_id: UUID
    type: str
    due_at: datetime
    completed_at: datetime | None
    notes: str | None
    status: str = Field(
        default="Pending",
        description="Computed follow-up status: 'Pending', 'Completed', or 'Skipped'",
    )
    created_at: datetime
    updated_at: datetime
