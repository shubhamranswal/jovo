import uuid
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from apps.api.db.models.career import CareerProfile
    from apps.api.db.models.job import Job


class Resume(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Uploaded base/master resume."""

    __tablename__ = "resumes"

    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_file: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="resumes",
    )
    derived_versions: Mapped[list["ResumeVersion"]] = relationship(
        "ResumeVersion",
        back_populates="base_resume",
    )


class ResumeVersion(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tailored or versioned resume for a specific job application."""

    __tablename__ = "resume_versions"

    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    base_resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version_label: Mapped[str] = mapped_column(String(100), nullable=False)
    generation_metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="resume_versions",
    )
    job: Mapped[Optional["Job"]] = relationship(
        "Job",
        back_populates="resume_versions",
    )
    base_resume: Mapped[Optional["Resume"]] = relationship(
        "Resume",
        back_populates="derived_versions",
    )


class CoverLetter(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Job-specific tailored cover letter."""

    __tablename__ = "cover_letters"

    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    generation_metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="cover_letters",
    )
    job: Mapped["Job"] = relationship(
        "Job",
        back_populates="cover_letters",
    )
