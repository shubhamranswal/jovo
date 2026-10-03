from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.api.db.models import (
    CoverLetter,
    Resume,
    ResumeVersion,
)
from apps.api.schemas.resume import (
    CoverLetterCreate,
    ResumeUploadRequest,
    ResumeVersionCreate,
)


class ResumeService:
    @staticmethod
    def upload_resume(db: Session, payload: ResumeUploadRequest) -> Resume:
        if payload.is_master:
            # If this is marked master, demote any previous master resume for this profile
            previous_masters = db.scalars(
                select(Resume).where(
                    Resume.career_profile_id == payload.career_profile_id,
                    Resume.is_master.is_(True),
                )
            ).all()
            for r in previous_masters:
                r.is_master = False

        # Calculate version
        latest_ver = (
            db.scalar(
                select(Resume.version)
                .where(Resume.career_profile_id == payload.career_profile_id)
                .order_by(Resume.version.desc())
            )
            or 0
        )

        resume = Resume(
            career_profile_id=payload.career_profile_id,
            name=payload.name,
            source_file=payload.source_file,
            extracted_text=payload.extracted_text,
            version=latest_ver + 1,
            is_master=payload.is_master,
        )
        db.add(resume)
        db.commit()
        db.refresh(resume)
        return resume

    @staticmethod
    def get_resume(db: Session, resume_id: UUID) -> Resume:
        resume = db.scalar(select(Resume).where(Resume.id == resume_id))
        if not resume:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resume {resume_id} not found",
            )
        return resume

    @staticmethod
    def list_resumes(db: Session, career_profile_id: UUID) -> list[Resume]:
        return list(
            db.scalars(
                select(Resume)
                .where(Resume.career_profile_id == career_profile_id)
                .order_by(Resume.is_master.desc(), Resume.created_at.desc())
            )
        )

    @staticmethod
    def create_resume_version(db: Session, payload: ResumeVersionCreate) -> ResumeVersion:
        version = ResumeVersion(
            career_profile_id=payload.career_profile_id,
            job_id=payload.job_id,
            base_resume_id=payload.base_resume_id,
            content=payload.content,
            version_label=payload.version_label,
            generation_metadata_json=payload.generation_metadata_json,
        )
        db.add(version)
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def get_resume_versions_for_job(
        db: Session, job_id: UUID, career_profile_id: UUID
    ) -> list[ResumeVersion]:
        return list(
            db.scalars(
                select(ResumeVersion).where(
                    ResumeVersion.job_id == job_id,
                    ResumeVersion.career_profile_id == career_profile_id,
                )
            )
        )

    @staticmethod
    def create_cover_letter(db: Session, payload: CoverLetterCreate) -> CoverLetter:
        latest_ver = (
            db.scalar(
                select(CoverLetter.version)
                .where(
                    CoverLetter.career_profile_id == payload.career_profile_id,
                    CoverLetter.job_id == payload.job_id,
                )
                .order_by(CoverLetter.version.desc())
            )
            or 0
        )

        cover_letter = CoverLetter(
            career_profile_id=payload.career_profile_id,
            job_id=payload.job_id,
            content=payload.content,
            version=latest_ver + 1,
            generation_metadata_json=payload.generation_metadata_json,
        )
        db.add(cover_letter)
        db.commit()
        db.refresh(cover_letter)
        return cover_letter

    @staticmethod
    def get_cover_letters_for_job(
        db: Session, job_id: UUID, career_profile_id: UUID
    ) -> list[CoverLetter]:
        return list(
            db.scalars(
                select(CoverLetter).where(
                    CoverLetter.job_id == job_id,
                    CoverLetter.career_profile_id == career_profile_id,
                )
            )
        )
