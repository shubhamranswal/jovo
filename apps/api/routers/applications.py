from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.schemas.application import (
    ApplicationCapsuleResponse,
    ApplicationCreate,
    ApplicationDocumentCreate,
    ApplicationDocumentResponse,
    ApplicationQuestionCreate,
    ApplicationQuestionResponse,
    ApplicationSnapshotCreate,
    ApplicationSnapshotResponse,
    ApplicationSummaryResponse,
    ApplicationUpdate,
)
from apps.api.schemas.interview import (
    FollowUpCreate,
    FollowUpResponse,
    FollowUpUpdate,
    InterviewPrepResponse,
)
from apps.api.services.application_service import ApplicationService

router = APIRouter(prefix="/applications", tags=["Applications & Application Capsule"])


@router.post(
    "",
    response_model=ApplicationSummaryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
):
    return ApplicationService.create_application(db, payload)


@router.get("", response_model=list[ApplicationSummaryResponse])
def list_applications(
    user_id: UUID | None = Query(None, description="Optional User ID filter"),
    status: str | None = Query(None, description="Filter by status (Saved, Applied, etc.)"),
    db: Session = Depends(get_db),
):
    return ApplicationService.list_applications(db, user_id, status)


@router.get("/{application_id}", response_model=ApplicationCapsuleResponse)
def get_application_capsule(
    application_id: UUID,
    db: Session = Depends(get_db),
):
    """Retrieve the full historical Application Capsule containing all memory components."""
    return ApplicationService.get_application_capsule(db, application_id)


@router.patch("/{application_id}", response_model=ApplicationSummaryResponse)
def update_application(
    application_id: UUID,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
):
    return ApplicationService.update_application(db, application_id, payload)


@router.post(
    "/{application_id}/snapshot",
    response_model=ApplicationSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
def capture_application_snapshot(
    application_id: UUID,
    payload: ApplicationSnapshotCreate,
    db: Session = Depends(get_db),
):
    """Capture exact JD and page snapshot at application submission."""
    return ApplicationService.capture_snapshot(db, application_id, payload)


@router.post(
    "/{application_id}/documents",
    response_model=ApplicationDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def capture_application_document(
    application_id: UUID,
    payload: ApplicationDocumentCreate,
    db: Session = Depends(get_db),
):
    """Associate exact submitted resume or cover letter version."""
    return ApplicationService.capture_document(db, application_id, payload)


@router.post(
    "/{application_id}/questions",
    response_model=ApplicationQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
def capture_question_and_answer(
    application_id: UUID,
    payload: ApplicationQuestionCreate,
    db: Session = Depends(get_db),
):
    """Capture application question and user-approved submitted answer."""
    return ApplicationService.capture_question_and_answer(db, application_id, payload)


@router.post(
    "/{application_id}/interview-prep",
    response_model=InterviewPrepResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_interview_preparation(
    application_id: UUID,
    stage: str = Query("Technical", description="Interview stage (Technical, Final, etc.)"),
    db: Session = Depends(get_db),
):
    """Generate interview preparation derived from the exact submitted Application Capsule."""
    return ApplicationService.prepare_interview(db, application_id, stage)


@router.post(
    "/{application_id}/follow-ups",
    response_model=FollowUpResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_follow_up(
    application_id: UUID,
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
):
    return ApplicationService.add_follow_up(db, application_id, payload)


@router.get(
    "/{application_id}/follow-ups",
    response_model=list[FollowUpResponse],
)
def list_follow_ups(
    application_id: UUID,
    db: Session = Depends(get_db),
):
    return ApplicationService.list_follow_ups(db, application_id)


@router.patch(
    "/follow-ups/{follow_up_id}",
    response_model=FollowUpResponse,
)
def update_follow_up(
    follow_up_id: UUID,
    payload: FollowUpUpdate,
    db: Session = Depends(get_db),
):
    return ApplicationService.update_follow_up(db, follow_up_id, payload)
