import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from apps.api.db.models.job import Company, Job
    from apps.api.db.models.user import User


class Application(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Job application record (the core Application Capsule container)."""

    __tablename__ = "applications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    application_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50),
        default="Saved",
        index=True,
        nullable=False,
    )
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="applications")
    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="applications")
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="applications")
    snapshots: Mapped[list["ApplicationSnapshot"]] = relationship(
        "ApplicationSnapshot",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    documents: Mapped[list["ApplicationDocument"]] = relationship(
        "ApplicationDocument",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    questions: Mapped[list["ApplicationQuestion"]] = relationship(
        "ApplicationQuestion",
        back_populates="application",
        order_by="ApplicationQuestion.order_index",
        cascade="all, delete-orphan",
    )
    interviews: Mapped[list["Interview"]] = relationship(
        "Interview",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    follow_ups: Mapped[list["FollowUp"]] = relationship(
        "FollowUp",
        back_populates="application",
        cascade="all, delete-orphan",
    )


class ApplicationSnapshot(Base, UUIDPrimaryKeyMixin):
    """Captured snapshot of the exact JD and application page state at submission."""

    __tablename__ = "application_snapshots"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    page_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    page_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    extraction_metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="snapshots",
    )


class ApplicationDocument(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Association of submitted documents (resume / cover letter) to the application."""

    __tablename__ = "application_documents"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    document_type: Mapped[str] = mapped_column(String(50), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    version_label: Mapped[str] = mapped_column(String(100), nullable=False)

    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="documents",
    )


class ApplicationQuestion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Captured or detected application question from an ATS or form."""

    __tablename__ = "application_questions"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    question_type: Mapped[str] = mapped_column(String(50), nullable=False)
    page_field_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="questions",
    )
    answers: Mapped[list["ApplicationAnswer"]] = relationship(
        "ApplicationAnswer",
        back_populates="question",
        cascade="all, delete-orphan",
    )


class ApplicationAnswer(Base, UUIDPrimaryKeyMixin):
    """User approved answer submitted for an application question."""

    __tablename__ = "application_answers"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("application_questions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(
        String(50),
        default="user_typed",
        nullable=False,
    )
    user_approved: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    question: Mapped["ApplicationQuestion"] = relationship(
        "ApplicationQuestion",
        back_populates="answers",
    )


class Interview(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Interview round scheduled for an application, with preparation intelligence."""

    __tablename__ = "interviews"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    stage: Mapped[str] = mapped_column(String(100), nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    preparation_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="interviews",
    )


class FollowUp(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Follow-up action item and reminder associated with an application."""

    __tablename__ = "follow_ups"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="follow_ups",
    )
