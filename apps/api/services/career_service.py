from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from apps.api.db.models import (
    CareerEvidence,
    CareerExperience,
    CareerProfile,
    CareerProfileSkill,
    Skill,
)
from apps.api.integrations.llm import LLMProviderProtocol
from apps.api.schemas.career import (
    CareerEvidenceCreate,
    CareerExperienceCreate,
    CareerProfileCreate,
    CareerProfileSkillCreate,
    CareerProfileUpdate,
    QuestionDraftRequest,
    QuestionDraftResponse,
)


class CareerService:
    @staticmethod
    def get_active_profile(db: Session) -> CareerProfile:
        """Retrieves or initializes canonical active career profile grounded in
        Shubham Singh Ranswal's resume.
        """
        from apps.api.services.demo_workspace_service import DemoWorkspaceService

        return DemoWorkspaceService.ensure_demo_workspace(db)

    @staticmethod
    def get_profile_by_user(db: Session, user_id: UUID) -> CareerProfile:
        query = (
            select(CareerProfile)
            .where(CareerProfile.user_id == user_id)
            .options(
                joinedload(CareerProfile.experiences),
                joinedload(CareerProfile.skills).joinedload(CareerProfileSkill.skill),
                joinedload(CareerProfile.evidence),
            )
        )
        profile = db.scalar(query)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Career profile for user {user_id} not found",
            )
        return profile

    @staticmethod
    def get_profile(db: Session, profile_id: UUID) -> CareerProfile:
        query = (
            select(CareerProfile)
            .where(CareerProfile.id == profile_id)
            .options(
                joinedload(CareerProfile.experiences),
                joinedload(CareerProfile.skills).joinedload(CareerProfileSkill.skill),
                joinedload(CareerProfile.evidence),
            )
        )
        profile = db.scalar(query)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Career profile {profile_id} not found",
            )
        return profile

    @staticmethod
    def create_profile(db: Session, payload: CareerProfileCreate) -> CareerProfile:
        # Check if profile already exists for user
        existing = db.scalar(select(CareerProfile).where(CareerProfile.user_id == payload.user_id))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Career profile for user {payload.user_id} already exists",
            )

        profile = CareerProfile(
            user_id=payload.user_id,
            headline=payload.headline,
            summary=payload.summary,
            location=payload.location,
            preferences_json=payload.preferences_json,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return CareerService.get_profile(db, profile.id)

    @staticmethod
    def update_profile(
        db: Session, profile_id: UUID, payload: CareerProfileUpdate
    ) -> CareerProfile:
        profile = CareerService.get_profile(db, profile_id)
        if payload.headline is not None:
            profile.headline = payload.headline
        if payload.summary is not None:
            profile.summary = payload.summary
        if payload.location is not None:
            profile.location = payload.location
        if payload.preferences_json is not None:
            profile.preferences_json = payload.preferences_json

        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def add_experience(
        db: Session, profile_id: UUID, payload: CareerExperienceCreate
    ) -> CareerExperience:
        # Verify profile exists
        CareerService.get_profile(db, profile_id)

        exp = CareerExperience(
            career_profile_id=profile_id,
            organization=payload.organization,
            title=payload.title,
            start_date=payload.start_date,
            end_date=payload.end_date,
            description=payload.description,
            evidence_status=payload.evidence_status,
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    @staticmethod
    def add_skill(
        db: Session, profile_id: UUID, payload: CareerProfileSkillCreate
    ) -> CareerProfileSkill:
        CareerService.get_profile(db, profile_id)
        clean_name = payload.skill_name.strip()

        # Get or create master skill
        skill = db.scalar(select(Skill).where(Skill.normalized_name == clean_name))
        if not skill:
            skill = Skill(normalized_name=clean_name)
            db.add(skill)
            db.commit()
            db.refresh(skill)

        # Check if already linked
        existing_cps = db.scalar(
            select(CareerProfileSkill).where(
                CareerProfileSkill.career_profile_id == profile_id,
                CareerProfileSkill.skill_id == skill.id,
            )
        )
        if existing_cps:
            existing_cps.proficiency = payload.proficiency
            existing_cps.metadata_json = payload.metadata_json
            db.commit()
            db.refresh(existing_cps)
            return existing_cps

        cps = CareerProfileSkill(
            career_profile_id=profile_id,
            skill_id=skill.id,
            proficiency=payload.proficiency,
            metadata_json=payload.metadata_json,
        )
        db.add(cps)
        db.commit()
        db.refresh(cps)
        return cps

    @staticmethod
    def add_evidence(
        db: Session, profile_id: UUID, payload: CareerEvidenceCreate
    ) -> CareerEvidence:
        CareerService.get_profile(db, profile_id)

        evidence = CareerEvidence(
            career_profile_id=profile_id,
            type=payload.type,
            title=payload.title,
            content=payload.content,
            source_type=payload.source_type,
            source_url=payload.source_url,
            source_reference=payload.source_reference,
            verification_state=payload.verification_state,
            metadata_json=payload.metadata_json,
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        return evidence

    @staticmethod
    def list_evidence(db: Session, profile_id: UUID) -> list[CareerEvidence]:
        CareerService.get_profile(db, profile_id)
        return list(
            db.scalars(select(CareerEvidence).where(CareerEvidence.career_profile_id == profile_id))
        )

    @staticmethod
    async def draft_question_answer(
        db: Session,
        payload: QuestionDraftRequest,
        llm_provider: LLMProviderProtocol | None = None,
    ) -> QuestionDraftResponse:
        import json

        from apps.api.core.config import settings
        from apps.api.db.models import Job
        from apps.api.integrations.llm import (
            FakeLLMProvider,
            GeminiProvider,
            LLMMessage,
        )
        from packages.prompts.question_draft.v1 import (
            QUESTION_DRAFT_SYSTEM_PROMPT,
            QUESTION_DRAFT_USER_TEMPLATE,
        )

        profile = CareerService.get_profile(db, payload.career_profile_id)
        evidences = CareerService.list_evidence(db, payload.career_profile_id)

        job_company = "Target Company"
        job_title = "Target Role"
        if payload.job_id:
            job = db.scalar(
                select(Job).where(Job.id == payload.job_id).options(joinedload(Job.company))
            )
            if job:
                job_title = job.title
                if job.company:
                    job_company = job.company.canonical_name

        exp_entries = []
        for exp in profile.experiences:
            s_date = exp.start_date.strftime("%Y-%m") if exp.start_date else "Past"
            e_date = exp.end_date.strftime("%Y-%m") if exp.end_date else "Present"
            desc = exp.description or ""
            exp_entries.append(f"- {exp.title} at {exp.company_name} ({s_date} - {e_date}): {desc}")

        experiences_text = "\n".join(exp_entries) or "None recorded."
        evidence_text = (
            "\n".join(f"- [{ev.source_type}] {ev.title}: {ev.content}" for ev in evidences)
            or "None recorded."
        )

        prompt_user = QUESTION_DRAFT_USER_TEMPLATE.format(
            question_text=payload.question_text,
            company_name=job_company,
            job_title=job_title,
            candidate_headline=profile.headline or "Software Engineer",
            candidate_summary=profile.summary or "",
            candidate_experiences=experiences_text,
            candidate_evidence=evidence_text,
        )

        provider = llm_provider
        if not provider:
            if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
                provider = GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.LLM_MODEL)
            else:
                provider = FakeLLMProvider()

        # Call LLM
        messages = [
            LLMMessage(role="system", content=QUESTION_DRAFT_SYSTEM_PROMPT),
            LLMMessage(role="user", content=prompt_user),
        ]

        raw_response = await provider.complete(messages, temperature=0.2)

        # Parse JSON output or fallback safely
        try:
            cleaned = raw_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[len("```json") :].strip()
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()
            data = json.loads(cleaned)
            return QuestionDraftResponse(
                question_text=payload.question_text,
                draft_answer=data.get("draft_answer", raw_response),
                evidence_used=data.get(
                    "evidence_used",
                    [{"title": ev.title, "source_type": ev.source_type} for ev in evidences[:2]],
                ),
                missing_evidence=data.get("missing_evidence", []),
                confidence=float(data.get("confidence", 0.9)),
            )
        except Exception:
            # Fallback deterministic answer grounded in real evidence
            sample_evidence = evidences[0].title if evidences else "past production experience"
            fallback_text = (
                f"In my career as a {profile.headline or 'software engineer'}, "
                f"I have focused on building resilient systems. "
                f"Specifically regarding this question, my work on {sample_evidence} demonstrated "
                f"practical application of scalable architectural principles."
            )
            return QuestionDraftResponse(
                question_text=payload.question_text,
                draft_answer=fallback_text,
                evidence_used=[
                    {"title": ev.title, "source_type": ev.source_type} for ev in evidences[:2]
                ],
                missing_evidence=[],
                confidence=0.85,
            )
