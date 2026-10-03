from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from apps.api.db.session import get_db
from apps.api.schemas.career import (
    CareerEvidenceCreate,
    CareerEvidenceResponse,
    CareerExperienceCreate,
    CareerExperienceResponse,
    CareerProfileCreate,
    CareerProfileResponse,
    CareerProfileSkillCreate,
    CareerProfileSkillResponse,
    CareerProfileUpdate,
    QuestionDraftRequest,
    QuestionDraftResponse,
)
from apps.api.services.career_service import CareerService

router = APIRouter(prefix="/career", tags=["Career Profile"])


@router.get("/active-profile", response_model=CareerProfileResponse)
def get_active_career_profile(
    db: Session = Depends(get_db),
):
    """Retrieve or initialize the active user career profile for the session."""
    profile = CareerService.get_active_profile(db)
    return CareerProfileResponse.model_validate(profile)


@router.get("/profile", response_model=CareerProfileResponse)
def get_career_profile(
    user_id: UUID = Query(..., description="User ID associated with profile"),
    db: Session = Depends(get_db),
):
    profile = CareerService.get_profile_by_user(db, user_id)
    return CareerProfileResponse.model_validate(profile)


@router.get("/profile/{profile_id}", response_model=CareerProfileResponse)
def get_career_profile_by_id(
    profile_id: UUID,
    db: Session = Depends(get_db),
):
    profile = CareerService.get_profile(db, profile_id)
    return CareerProfileResponse.model_validate(profile)


@router.post(
    "/profile",
    response_model=CareerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_career_profile(
    payload: CareerProfileCreate,
    db: Session = Depends(get_db),
):
    profile = CareerService.create_profile(db, payload)
    return CareerProfileResponse.model_validate(profile)


@router.put("/profile/{profile_id}", response_model=CareerProfileResponse)
def update_career_profile(
    profile_id: UUID,
    payload: CareerProfileUpdate,
    db: Session = Depends(get_db),
):
    profile = CareerService.update_profile(db, profile_id, payload)
    return CareerProfileResponse.model_validate(profile)


@router.post(
    "/profile/{profile_id}/experiences",
    response_model=CareerExperienceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_experience(
    profile_id: UUID,
    payload: CareerExperienceCreate,
    db: Session = Depends(get_db),
):
    exp = CareerService.add_experience(db, profile_id, payload)
    return CareerExperienceResponse.model_validate(exp)


@router.post(
    "/profile/{profile_id}/skills",
    response_model=CareerProfileSkillResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_skill(
    profile_id: UUID,
    payload: CareerProfileSkillCreate,
    db: Session = Depends(get_db),
):
    skill = CareerService.add_skill(db, profile_id, payload)
    return CareerProfileSkillResponse(
        id=skill.id,
        skill_id=skill.skill_id,
        skill_name=skill.skill.normalized_name if skill.skill else payload.skill_name,
        proficiency=skill.proficiency,
        metadata_json=skill.metadata_json,
    )


@router.get(
    "/profile/{profile_id}/evidence",
    response_model=list[CareerEvidenceResponse],
)
def list_evidence(
    profile_id: UUID,
    db: Session = Depends(get_db),
):
    evidence_list = CareerService.list_evidence(db, profile_id)
    return [CareerEvidenceResponse.model_validate(e) for e in evidence_list]


@router.post(
    "/profile/{profile_id}/evidence",
    response_model=CareerEvidenceResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_evidence(
    profile_id: UUID,
    payload: CareerEvidenceCreate,
    db: Session = Depends(get_db),
):
    evidence = CareerService.add_evidence(db, profile_id, payload)
    return CareerEvidenceResponse.model_validate(evidence)


@router.post(
    "/draft-answer",
    response_model=QuestionDraftResponse,
)
async def draft_question_answer(
    payload: QuestionDraftRequest,
    db: Session = Depends(get_db),
):
    """Drafts an application question response strictly grounded in candidate's career evidence."""
    return await CareerService.draft_question_answer(db, payload)
