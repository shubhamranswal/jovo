from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.schemas.resume import (
    CoverLetterCreate,
    CoverLetterResponse,
    ResumeResponse,
    ResumeUploadRequest,
    ResumeVersionCreate,
    ResumeVersionResponse,
)
from apps.api.services.resume_service import ResumeService

router = APIRouter(tags=["Resumes & Cover Letters"])


@router.post(
    "/career/resume",
    response_model=ResumeResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_master_or_base_resume(
    payload: ResumeUploadRequest,
    db: Session = Depends(get_db),
):
    resume = ResumeService.upload_resume(db, payload)
    return ResumeResponse.model_validate(resume)


@router.get("/career/resume/{resume_id}", response_model=ResumeResponse)
def get_resume(
    resume_id: UUID,
    db: Session = Depends(get_db),
):
    resume = ResumeService.get_resume(db, resume_id)
    return ResumeResponse.model_validate(resume)


@router.get("/career/resumes", response_model=list[ResumeResponse])
def list_resumes_for_career_profile(
    career_profile_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    resumes = ResumeService.list_resumes(db, career_profile_id)
    return [ResumeResponse.model_validate(r) for r in resumes]


@router.post(
    "/career/resume/version",
    response_model=ResumeVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tailored_resume_version(
    payload: ResumeVersionCreate,
    db: Session = Depends(get_db),
):
    version = ResumeService.create_resume_version(db, payload)
    return ResumeVersionResponse.model_validate(version)


@router.get("/jobs/{job_id}/resumes", response_model=list[ResumeVersionResponse])
def get_resume_versions_for_job(
    job_id: UUID,
    career_profile_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    versions = ResumeService.get_resume_versions_for_job(db, job_id, career_profile_id)
    return [ResumeVersionResponse.model_validate(v) for v in versions]


@router.post(
    "/career/cover-letter",
    response_model=CoverLetterResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job_cover_letter(
    payload: CoverLetterCreate,
    db: Session = Depends(get_db),
):
    letter = ResumeService.create_cover_letter(db, payload)
    return CoverLetterResponse.model_validate(letter)


@router.get("/jobs/{job_id}/cover-letters", response_model=list[CoverLetterResponse])
def get_cover_letters_for_job(
    job_id: UUID,
    career_profile_id: UUID = Query(...),
    db: Session = Depends(get_db),
):
    letters = ResumeService.get_cover_letters_for_job(db, job_id, career_profile_id)
    return [CoverLetterResponse.model_validate(cl) for cl in letters]
