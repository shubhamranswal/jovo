import uuid
from datetime import date
from typing import TYPE_CHECKING, Any

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from apps.api.db.models.job import JobMatch
    from apps.api.db.models.resume import CoverLetter, Resume, ResumeVersion
    from apps.api.db.models.user import User


class CareerProfile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Canonical career profile for an individual job seeker."""

    __tablename__ = "career_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferences_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="career_profile")
    experiences: Mapped[list["CareerExperience"]] = relationship(
        "CareerExperience",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    skills: Mapped[list["CareerProfileSkill"]] = relationship(
        "CareerProfileSkill",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    evidence: Mapped[list["CareerEvidence"]] = relationship(
        "CareerEvidence",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    resumes: Mapped[list["Resume"]] = relationship(
        "Resume",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    resume_versions: Mapped[list["ResumeVersion"]] = relationship(
        "ResumeVersion",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    cover_letters: Mapped[list["CoverLetter"]] = relationship(
        "CoverLetter",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )
    job_matches: Mapped[list["JobMatch"]] = relationship(
        "JobMatch",
        back_populates="career_profile",
        cascade="all, delete-orphan",
    )


class CareerExperience(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Past work experiences with verification states."""

    __tablename__ = "career_experiences"

    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    organization: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_status: Mapped[str] = mapped_column(
        String(50),
        default="unverified",
        nullable=False,
    )

    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="experiences",
    )


class Skill(Base, UUIDPrimaryKeyMixin):
    """Normalized master skills registry."""

    __tablename__ = "skills"

    normalized_name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    career_profile_skills: Mapped[list["CareerProfileSkill"]] = relationship(
        "CareerProfileSkill",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class CareerProfileSkill(Base, UUIDPrimaryKeyMixin):
    """Association of skills to candidate career profile."""

    __tablename__ = "career_profile_skills"
    __table_args__ = (
        UniqueConstraint("career_profile_id", "skill_id", name="uq_career_profile_skill"),
    )

    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    proficiency: Mapped[str | None] = mapped_column(String(50), nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="skills",
    )
    skill: Mapped["Skill"] = relationship(
        "Skill",
        back_populates="career_profile_skills",
    )

    @property
    def skill_name(self) -> str:
        return self.skill.normalized_name if self.skill else ""


class CareerEvidence(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Traceable evidence backing career claims and tailored materials."""

    __tablename__ = "career_evidence"

    career_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("career_profiles.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(100), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_state: Mapped[str] = mapped_column(
        String(50),
        default="unverified",
        nullable=False,
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    career_profile: Mapped["CareerProfile"] = relationship(
        "CareerProfile",
        back_populates="evidence",
    )
