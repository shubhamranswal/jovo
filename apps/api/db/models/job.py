import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from apps.api.db.models.application import Application
    from apps.api.db.models.career import CareerProfile
    from apps.api.db.models.resume import CoverLetter, ResumeVersion


class Company(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Company entity with domain and metadata."""

    __tablename__ = "companies"

    canonical_name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    domain: Mapped[str | None] = mapped_column(
        String(255),
        index=True,
        nullable=True,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    jobs: Mapped[list["Job"]] = relationship(
        "Job",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list["Application"]] = relationship(
        "Application",
        back_populates="company",
    )


class Job(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Normalized job posting."""

    __tablename__ = "jobs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remote_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    salary_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    salary_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_requirements_json: Mapped[list[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    source_urls_json: Mapped[list[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    source_names_json: Mapped[list[str]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    canonical_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    fingerprint: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    # Relationships
    company: Mapped["Company"] = relationship("Company", back_populates="jobs")
    matches: Mapped[list["JobMatch"]] = relationship(
        "JobMatch",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    applications: Mapped[list["Application"]] = relationship(
        "Application",
        back_populates="job",
    )
    resume_versions: Mapped[list["ResumeVersion"]] = relationship(
        "ResumeVersion",
        back_populates="job",
    )
    cover_letters: Mapped[list["CoverLetter"]] = relationship(
        "CoverLetter",
        back_populates="job",
    )


class JobMatch(Base, UUIDPrimaryKeyMixin):
    """Explainable match score between a Job and a CareerProfile."""

    __tablename__ = "job_matches"
    __table_args__ = (UniqueConstraint("job_id", "career_profile_id", name="uq_job_match_pair"),)

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    component_scores_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    strengths_json: Mapped[list[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    gaps_json: Mapped[list[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="matches")
    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="job_matches",
    )
