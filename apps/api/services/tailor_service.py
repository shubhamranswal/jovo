import uuid
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from apps.api.core.config import settings
from apps.api.db.models import (
    CareerProfile,
    CoverLetter,
    Job,
    Resume,
    ResumeVersion,
)
from apps.api.integrations.llm import (
    FakeLLMProvider,
    GeminiProvider,
    LLMMessage,
    LLMProviderProtocol,
)
from apps.api.schemas.resume import CoverLetterResponse, ResumeVersionResponse
from apps.api.schemas.tailor import JobTailorRequest, JobTailorResponse
from apps.api.services.match_engine import MatchEngine
from packages.prompts.cover_letter.v1 import (
    COVER_LETTER_SYSTEM_PROMPT,
    COVER_LETTER_USER_TEMPLATE,
)
from packages.prompts.resume_tailor.v1 import (
    RESUME_TAILOR_SYSTEM_PROMPT,
    RESUME_TAILOR_USER_TEMPLATE,
)


class TailorService:
    """Service to tailor resumes and generate cover letters grounded in Career Evidence."""

    @staticmethod
    def get_default_llm_provider() -> LLMProviderProtocol:
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
            return GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.LLM_MODEL)
        return FakeLLMProvider()

    @classmethod
    async def tailor_application_materials(
        cls,
        db: Session,
        job_id: UUID,
        payload: JobTailorRequest,
        llm_provider: LLMProviderProtocol | None = None,
    ) -> JobTailorResponse:
        job = db.scalar(select(Job).where(Job.id == job_id).options(joinedload(Job.company)))
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found",
            )

        profile = db.scalar(
            select(CareerProfile)
            .where(CareerProfile.id == payload.career_profile_id)
            .options(
                joinedload(CareerProfile.skills),
                joinedload(CareerProfile.experiences),
                joinedload(CareerProfile.evidence),
                joinedload(CareerProfile.resumes),
            )
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Career profile {payload.career_profile_id} not found",
            )

        # Retrieve base resume
        base_resume: Resume | None = None
        if payload.base_resume_id:
            base_resume = db.scalar(
                select(Resume).where(
                    Resume.id == payload.base_resume_id,
                    Resume.career_profile_id == profile.id,
                )
            )
            if not base_resume:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Base resume {payload.base_resume_id} not found for this profile",
                )
        else:
            base_resume = next((r for r in profile.resumes if r.is_master), None)
            if not base_resume and profile.resumes:
                base_resume = profile.resumes[0]

        if not base_resume:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "No base or master resume found for career profile. "
                    "Please upload a master resume first."
                ),
            )

        # 1. Deterministic match evaluation grounded in career evidence
        job_match = MatchEngine.evaluate_match(db, job_id, profile.id)

        # Prepare career evidence summary
        evidence_lines = []
        evidence_used: list[dict[str, Any]] = []
        for ev in profile.evidence:
            item_desc = (
                f"- [{ev.type.upper()}] {ev.title} "
                f"(Status: {ev.verification_state}, Source: {ev.source_type})"
            )
            ev_content = getattr(ev, "content", None) or getattr(ev, "description", None)
            if ev_content:
                item_desc += f": {ev_content}"
            evidence_lines.append(item_desc)
            evidence_used.append(
                {
                    "id": str(ev.id),
                    "type": ev.type,
                    "title": ev.title,
                    "verification_state": ev.verification_state,
                    "source_type": ev.source_type,
                }
            )

        evidence_str = "\n".join(evidence_lines) if evidence_lines else "None provided."

        # Prepare experiences summary
        experience_lines = []
        for exp in profile.experiences:
            org_name = getattr(exp, "organization", "Organization")
            exp_line = (
                f"- {exp.title} at {org_name} ({exp.start_date} to {exp.end_date or 'Present'})"
            )
            if exp.description:
                exp_line += f": {exp.description}"
            experience_lines.append(exp_line)
        experiences_str = "\n".join(experience_lines) if experience_lines else "None provided."

        # Prepare job details
        company_name = job.company.canonical_name if job.company else "the company"
        requirements_str = "\n".join(f"- {r}" for r in (job.normalized_requirements_json or []))
        if not requirements_str:
            requirements_str = "See job description."
        gaps_str = "\n".join(f"- {g}" for g in (job_match.gaps_json or []))
        if not gaps_str:
            gaps_str = "None identified."

        provider = llm_provider or cls.get_default_llm_provider()

        # 2. Tailor Resume (Produces new ResumeVersion, never overwrites master resume)
        resume_user_msg = RESUME_TAILOR_USER_TEMPLATE.format(
            job_title=job.title,
            company_name=company_name,
            job_requirements=requirements_str,
            job_description=job.description,
            master_resume_content=base_resume.extracted_text,
            candidate_evidence=evidence_str,
            identified_gaps=gaps_str,
        )

        llm_resume_resp = await provider.generate(
            [
                LLMMessage(role="system", content=RESUME_TAILOR_SYSTEM_PROMPT),
                LLMMessage(role="user", content=resume_user_msg),
            ]
        )

        version_label = f"Tailored for {job.title} at {company_name}"[:100]
        tailored_resume = ResumeVersion(
            career_profile_id=profile.id,
            job_id=job.id,
            base_resume_id=base_resume.id,
            content=llm_resume_resp.content,
            version_label=version_label,
            generation_metadata_json={
                "base_resume_id": str(base_resume.id),
                "model": llm_resume_resp.model,
                "match_overall_score": job_match.overall_score,
                "evidence_count": len(evidence_used),
                "identified_gaps": job_match.gaps_json or [],
            },
        )
        db.add(tailored_resume)
        db.commit()
        db.refresh(tailored_resume)

        now = datetime.now(UTC)
        if tailored_resume.id is None:
            tailored_resume.id = uuid.uuid4()
        if getattr(tailored_resume, "created_at", None) is None:
            tailored_resume.created_at = now
        if getattr(tailored_resume, "updated_at", None) is None:
            tailored_resume.updated_at = now

        # 3. Generate Cover Letter grounded in verified evidence
        cl_user_msg = COVER_LETTER_USER_TEMPLATE.format(
            company_name=company_name,
            job_title=job.title,
            job_description=job.description,
            candidate_headline=profile.headline or "Software Engineer",
            candidate_summary=profile.summary or "",
            candidate_evidence=evidence_str,
            candidate_experiences=experiences_str,
        )

        llm_cl_resp = await provider.generate(
            [
                LLMMessage(role="system", content=COVER_LETTER_SYSTEM_PROMPT),
                LLMMessage(role="user", content=cl_user_msg),
            ]
        )

        latest_cl = db.scalar(
            select(CoverLetter)
            .where(
                CoverLetter.job_id == job.id,
                CoverLetter.career_profile_id == profile.id,
            )
            .order_by(desc(CoverLetter.version))
        )
        next_version = (latest_cl.version + 1) if latest_cl else 1

        cover_letter = CoverLetter(
            career_profile_id=profile.id,
            job_id=job.id,
            content=llm_cl_resp.content,
            version=next_version,
            generation_metadata_json={
                "tailored_resume_version_id": str(tailored_resume.id),
                "model": llm_cl_resp.model,
                "evidence_count": len(evidence_used),
            },
        )
        db.add(cover_letter)
        db.commit()
        db.refresh(cover_letter)

        if cover_letter.id is None:
            cover_letter.id = uuid.uuid4()
        if getattr(cover_letter, "created_at", None) is None:
            cover_letter.created_at = now
        if getattr(cover_letter, "updated_at", None) is None:
            cover_letter.updated_at = now

        # Build explainable changes and warnings
        changes_explanation = [
            f"Tailored content highlights background and evidence matching {job.title}.",
            f"Grounded strictly using {len(evidence_used)} verified career evidence items.",
        ]
        warnings = [
            f"Gap detected: {g.replace('MISSING EVIDENCE: ', '')}"
            for g in (job_match.gaps_json or [])
        ]

        return JobTailorResponse(
            job_id=job.id,
            career_profile_id=profile.id,
            tailored_resume=ResumeVersionResponse.model_validate(tailored_resume),
            cover_letter=CoverLetterResponse.model_validate(cover_letter),
            changes_explanation=changes_explanation,
            evidence_used=evidence_used,
            gaps=job_match.gaps_json or [],
            warnings=warnings,
        )
