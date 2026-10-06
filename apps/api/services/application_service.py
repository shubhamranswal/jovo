from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from apps.api.db.models import (
    Application,
    ApplicationAnswer,
    ApplicationDocument,
    ApplicationQuestion,
    ApplicationSnapshot,
    CareerProfile,
    CareerProfileSkill,
    Company,
    CoverLetter,
    FollowUp,
    Interview,
    Job,
    Resume,
    ResumeVersion,
)
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
    InterviewQuestionItem,
    InterviewReadinessResponse,
    InterviewResponse,
)


class ApplicationService:
    @staticmethod
    def create_application(db: Session, payload: ApplicationCreate) -> ApplicationSummaryResponse:
        company_id = payload.company_id
        if not company_id and payload.company_name:
            company = db.scalar(
                select(Company).where(Company.canonical_name == payload.company_name.strip())
            )
            if not company:
                company = Company(canonical_name=payload.company_name.strip())
                db.add(company)
                db.flush()
            company_id = company.id

        # Deterministic deduplication: check if an application already exists for this user and job
        existing_app: Application | None = None
        if payload.job_id:
            existing_app = db.scalar(
                select(Application).where(
                    Application.user_id == payload.user_id,
                    Application.job_id == payload.job_id,
                )
            )

        if existing_app:
            application = existing_app
            if payload.title:
                application.title = payload.title
            if payload.source:
                application.source = payload.source
            if payload.application_url:
                application.application_url = payload.application_url
            if payload.notes:
                application.notes = payload.notes
            if payload.status:
                application.status = payload.status
                if payload.status == "Applied" and not application.applied_at:
                    application.applied_at = datetime.now(UTC)
            application.captured_at = datetime.now(UTC)
            if payload.metadata_json:
                merged_meta = dict(application.metadata_json or {})
                merged_meta.update(payload.metadata_json)
                application.metadata_json = merged_meta
        else:
            application = Application(
                user_id=payload.user_id,
                job_id=payload.job_id,
                company_id=company_id,
                title=payload.title,
                source=payload.source,
                application_url=payload.application_url,
                status=payload.status,
                applied_at=datetime.now(UTC) if payload.status == "Applied" else None,
                captured_at=datetime.now(UTC),
                notes=payload.notes,
                metadata_json=payload.metadata_json,
            )
            db.add(application)
            db.flush()

        # Handle exact job description snapshot
        if payload.initial_snapshot:
            snap = ApplicationSnapshot(
                application_id=application.id,
                job_description=payload.initial_snapshot.job_description,
                page_title=payload.initial_snapshot.page_title,
                page_url=payload.initial_snapshot.page_url,
                extraction_metadata_json=payload.initial_snapshot.extraction_metadata_json,
            )
            db.add(snap)
            application.captured_at = datetime.now(UTC)
        elif payload.job_id and not application.snapshots:
            # Automatically freeze a snapshot of the JD at application time
            job = db.scalar(select(Job).where(Job.id == payload.job_id))
            if job:
                snap = ApplicationSnapshot(
                    application_id=application.id,
                    job_description=job.description,
                    page_title=job.title,
                    page_url=job.canonical_url or payload.application_url,
                    extraction_metadata_json={
                        "role_title": job.title,
                        "company": payload.company_name
                        or (job.company.canonical_name if job.company else None),
                        "location": job.location,
                        "salary_min": str(job.salary_min) if job.salary_min is not None else None,
                        "salary_max": str(job.salary_max) if job.salary_max is not None else None,
                        "currency": job.currency,
                        "skills": (job.metadata_json or {}).get("skills", [])
                        if isinstance(job.metadata_json, dict)
                        else [],
                        "source": (job.source_names_json[0] if job.source_names_json else None)
                        or payload.source,
                        "original_job_url": job.canonical_url,
                        "captured_at": datetime.now(UTC).isoformat(),
                    },
                )
                db.add(snap)
                application.captured_at = datetime.now(UTC)

        # Handle initial documents (resolves exact versions and avoids duplicates)
        for doc_in in payload.initial_documents:
            doc_id = doc_in.document_id
            doc_label = doc_in.version_label

            # Auto-resolve tailored resume or cover letter if document_id was omitted
            if not doc_id and payload.job_id:
                if doc_in.document_type == "resume":
                    tailored_rv = db.scalar(
                        select(ResumeVersion)
                        .where(ResumeVersion.job_id == payload.job_id)
                        .order_by(ResumeVersion.created_at.desc())
                    )
                    if tailored_rv:
                        doc_id = tailored_rv.id
                        doc_label = tailored_rv.version_label
                elif doc_in.document_type == "cover_letter":
                    cl = db.scalar(
                        select(CoverLetter)
                        .where(CoverLetter.job_id == payload.job_id)
                        .order_by(CoverLetter.created_at.desc())
                    )
                    if cl:
                        doc_id = cl.id
                        doc_label = f"Cover Letter v{cl.version}"

            # Only add if not already attached to this application
            already_attached = any(
                d.document_type == doc_in.document_type and d.document_id == doc_id
                for d in application.documents
            )
            if not already_attached:
                doc = ApplicationDocument(
                    application_id=application.id,
                    document_type=doc_in.document_type,
                    document_id=doc_id,
                    version_label=doc_label,
                )
                db.add(doc)

        # Handle initial questions and candidate-approved answers
        for q_in in payload.initial_questions:
            existing_q = next(
                (
                    q
                    for q in application.questions
                    if q.question_text.strip() == q_in.question_text.strip()
                ),
                None,
            )
            if existing_q:
                q = existing_q
            else:
                q = ApplicationQuestion(
                    application_id=application.id,
                    question_text=q_in.question_text.strip(),
                    normalized_question=q_in.normalized_question,
                    question_type=q_in.question_type,
                    page_field_name=q_in.page_field_name,
                    order_index=q_in.order_index,
                )
                db.add(q)
                db.flush()

            if q_in.answer:
                if q.answers:
                    q.answers[0].answer_text = q_in.answer.answer_text
                    q.answers[0].source = q_in.answer.source
                    q.answers[0].user_approved = q_in.answer.user_approved
                else:
                    ans = ApplicationAnswer(
                        question_id=q.id,
                        answer_text=q_in.answer.answer_text,
                        source=q_in.answer.source,
                        user_approved=q_in.answer.user_approved,
                    )
                    db.add(ans)

        db.commit()
        db.refresh(application)
        return ApplicationService._to_summary(db, application)

    @staticmethod
    def _to_summary(db: Session, app: Application) -> ApplicationSummaryResponse:
        company_name = None
        if app.company_id:
            company = db.scalar(select(Company).where(Company.id == app.company_id))
            if company:
                company_name = company.canonical_name

        return ApplicationSummaryResponse(
            id=app.id,
            user_id=app.user_id,
            job_id=app.job_id,
            company_id=app.company_id,
            company_name=company_name,
            title=app.title,
            source=app.source,
            application_url=app.application_url,
            status=app.status,
            applied_at=app.applied_at,
            captured_at=app.captured_at,
            notes=app.notes,
            metadata_json=app.metadata_json,
            created_at=app.created_at,
            updated_at=app.updated_at,
        )

    @staticmethod
    def get_application(db: Session, application_id: UUID) -> Application:
        app = db.scalar(select(Application).where(Application.id == application_id))
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {application_id} not found",
            )
        return app

    @staticmethod
    def update_application(
        db: Session, application_id: UUID, payload: ApplicationUpdate
    ) -> ApplicationSummaryResponse:
        app = ApplicationService.get_application(db, application_id)
        if payload.title is not None:
            app.title = payload.title
        if payload.status is not None:
            app.status = payload.status
        if payload.notes is not None:
            app.notes = payload.notes
        if payload.applied_at is not None:
            app.applied_at = payload.applied_at
        if payload.metadata_json is not None:
            app.metadata_json = payload.metadata_json

        db.commit()
        db.refresh(app)
        return ApplicationService._to_summary(db, app)

    @staticmethod
    def list_applications(
        db: Session, user_id: UUID | None = None, status_filter: str | None = None
    ) -> list[ApplicationSummaryResponse]:
        stmt = select(Application).order_by(Application.created_at.desc())
        if user_id is not None:
            stmt = stmt.where(Application.user_id == user_id)
        if status_filter:
            stmt = stmt.where(Application.status == status_filter)

        apps = list(db.scalars(stmt))
        return [ApplicationService._to_summary(db, a) for a in apps]

    @staticmethod
    def get_application_capsule(db: Session, application_id: UUID) -> ApplicationCapsuleResponse:
        """Assembles the complete historical Application Capsule."""
        app = (
            db.execute(
                select(Application)
                .where(Application.id == application_id)
                .options(
                    joinedload(Application.snapshots),
                    joinedload(Application.documents),
                    joinedload(Application.questions).joinedload(ApplicationQuestion.answers),
                    joinedload(Application.interviews),
                    joinedload(Application.follow_ups),
                )
            )
            .unique()
            .scalar_one_or_none()
        )
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {application_id} not found",
            )

        summary = ApplicationService._to_summary(db, app)

        # 1. Latest snapshot
        latest_snapshot = None
        if app.snapshots:
            sorted_snaps = sorted(app.snapshots, key=lambda s: s.captured_at, reverse=True)
            s = sorted_snaps[0]
            latest_snapshot = ApplicationSnapshotResponse.model_validate(s)
        elif app.job_id:
            # Fall back to linked Job description if page snapshot unavailable
            job = db.scalar(select(Job).where(Job.id == app.job_id))
            if job:
                latest_snapshot = ApplicationSnapshotResponse(
                    id=job.id,
                    application_id=app.id,
                    job_description=job.description,
                    page_title=job.title,
                    page_url=job.canonical_url,
                    captured_at=job.first_seen_at,
                    extraction_metadata_json={"source": "job_record_fallback"},
                )

        # 2. Submitted Documents with resolved content
        document_responses = []
        for d in app.documents:
            content = None
            if d.document_type == "resume" and d.document_id:
                rv = db.scalar(select(ResumeVersion).where(ResumeVersion.id == d.document_id))
                if rv:
                    content = rv.content
                else:
                    base_res = db.scalar(select(Resume).where(Resume.id == d.document_id))
                    if base_res:
                        content = base_res.extracted_text
            elif d.document_type == "cover_letter" and d.document_id:
                cl = db.scalar(select(CoverLetter).where(CoverLetter.id == d.document_id))
                if cl:
                    content = cl.content

            document_responses.append(
                ApplicationDocumentResponse(
                    id=d.id,
                    application_id=d.application_id,
                    document_type=d.document_type,
                    document_id=d.document_id,
                    version_label=d.version_label,
                    content=content,
                    created_at=d.created_at,
                    updated_at=d.updated_at,
                )
            )

        # 3. Questions and Answers
        question_responses = [
            ApplicationQuestionResponse.model_validate(q)
            for q in sorted(app.questions, key=lambda q: q.order_index)
        ]

        # 4. Interviews
        interview_responses = [InterviewResponse.model_validate(i) for i in app.interviews]

        # 5. Follow-ups
        follow_up_responses = [FollowUpResponse.model_validate(f) for f in app.follow_ups]

        return ApplicationCapsuleResponse(
            application=summary,
            latest_snapshot=latest_snapshot,
            documents=document_responses,
            questions=question_responses,
            interviews=interview_responses,
            follow_ups=follow_up_responses,
        )

    @staticmethod
    def capture_snapshot(
        db: Session, application_id: UUID, payload: ApplicationSnapshotCreate
    ) -> ApplicationSnapshotResponse:
        app = ApplicationService.get_application(db, application_id)
        snapshot = ApplicationSnapshot(
            application_id=app.id,
            job_description=payload.job_description,
            page_title=payload.page_title,
            page_url=payload.page_url,
            extraction_metadata_json=payload.extraction_metadata_json,
        )
        app.captured_at = datetime.now(UTC)
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return ApplicationSnapshotResponse.model_validate(snapshot)

    @staticmethod
    def capture_document(
        db: Session, application_id: UUID, payload: ApplicationDocumentCreate
    ) -> ApplicationDocumentResponse:
        app = ApplicationService.get_application(db, application_id)
        doc = ApplicationDocument(
            application_id=app.id,
            document_type=payload.document_type,
            document_id=payload.document_id,
            version_label=payload.version_label,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return ApplicationDocumentResponse.model_validate(doc)

    @staticmethod
    def capture_question_and_answer(
        db: Session,
        application_id: UUID,
        payload: ApplicationQuestionCreate,
    ) -> ApplicationQuestionResponse:
        app = ApplicationService.get_application(db, application_id)
        q = ApplicationQuestion(
            application_id=app.id,
            question_text=payload.question_text,
            normalized_question=payload.normalized_question,
            question_type=payload.question_type,
            page_field_name=payload.page_field_name,
            order_index=payload.order_index,
        )
        db.add(q)
        db.flush()

        if payload.answer:
            ans = ApplicationAnswer(
                question_id=q.id,
                answer_text=payload.answer.answer_text,
                source=payload.answer.source,
                user_approved=payload.answer.user_approved,
            )
            db.add(ans)

        db.commit()
        db.refresh(q)
        return ApplicationQuestionResponse.model_validate(q)

    @staticmethod
    def prepare_interview(
        db: Session, application_id: UUID, stage: str = "Technical"
    ) -> InterviewPrepResponse:
        """Generates grounded interview preparation derived strictly from
        the exact Application Capsule and verified career evidence.
        """
        capsule = ApplicationService.get_application_capsule(db, application_id)
        app_summary = capsule.application

        # Extract JD text and snapshot metadata
        jd_text = capsule.latest_snapshot.job_description if capsule.latest_snapshot else ""
        meta = capsule.latest_snapshot.extraction_metadata_json if capsule.latest_snapshot else {}
        company = app_summary.company_name or "Target Company"
        role = app_summary.title

        jd_skills = meta.get("skills", []) if isinstance(meta, dict) else []
        if not jd_skills:
            common_keywords = [
                "Go",
                "Python",
                "TypeScript",
                "React",
                "Node.js",
                "Kubernetes",
                "Docker",
                "AWS",
                "GCP",
                "Distributed Systems",
                "SQL",
                "PostgreSQL",
                "Raft",
                "Redis",
                "Microservices",
                "System Design",
                "CI/CD",
                "Security",
                "REST",
                "gRPC",
            ]
            jd_skills = [k for k in common_keywords if k.lower() in jd_text.lower()]

        # Extract exact submitted materials
        resume_doc = next(
            (d for d in capsule.documents if d.document_type == "resume"),
            None,
        )
        submitted_resume = resume_doc.content if resume_doc else None
        resume_label = resume_doc.version_label if resume_doc else "Master Resume"

        cover_doc = next(
            (d for d in capsule.documents if d.document_type == "cover_letter"),
            None,
        )
        submitted_cover = cover_doc.content if cover_doc else None
        cover_label = cover_doc.version_label if cover_doc else "Standard Cover Letter"

        # Extract candidate verified profile and evidence
        profile = db.scalar(
            select(CareerProfile)
            .where(CareerProfile.user_id == app_summary.user_id)
            .options(
                joinedload(CareerProfile.skills).joinedload(CareerProfileSkill.skill),
                joinedload(CareerProfile.experiences),
                joinedload(CareerProfile.evidence),
            )
        )
        verified_skills = [
            cps.skill.normalized_name for cps in (profile.skills if profile else []) if cps.skill
        ]
        verified_skills_lower = {s.lower() for s in verified_skills}
        verified_evidence = profile.evidence if profile else []
        verified_experiences = profile.experiences if profile else []

        # Analyze competency coverage and detect evidence gaps (anti-hallucination)
        matched_competencies = []
        evidence_gaps = []
        evidence_mapping: dict[str, str] = {}

        for comp in jd_skills:
            comp_lower = comp.lower()
            found_skill = comp_lower in verified_skills_lower
            ev_match = next(
                (
                    ev
                    for ev in verified_evidence
                    if comp_lower in ev.title.lower() or comp_lower in ev.content.lower()
                ),
                None,
            )
            exp_match = next(
                (
                    exp
                    for exp in verified_experiences
                    if comp_lower in (exp.description or "").lower()
                    or comp_lower in exp.title.lower()
                ),
                None,
            )
            resume_match = submitted_resume and comp_lower in submitted_resume.lower()

            if found_skill or ev_match or exp_match or resume_match:
                matched_competencies.append(comp)
                if ev_match:
                    evidence_mapping[comp] = (
                        f"Verified evidence: '{ev_match.title}' ({ev_match.source_type})"
                    )
                elif exp_match:
                    evidence_mapping[comp] = (
                        f"Documented experience: '{exp_match.title}' at {exp_match.organization}"
                    )
                elif found_skill:
                    evidence_mapping[comp] = f"Profile documented skill: {comp}"
                else:
                    evidence_mapping[comp] = (
                        f"Referenced in submitted tailored resume ({resume_label})"
                    )
            else:
                evidence_gaps.append(f"{comp}: Evidence not found in your profile.")

        # Candidate-approved Q&A extraction
        qa_context = []
        for q in capsule.questions:
            for ans in q.answers:
                if ans.user_approved:
                    qa_context.append(
                        {
                            "question": q.question_text,
                            "answer": ans.answer_text,
                            "source": ans.source,
                        }
                    )

        # Calculate explainable readiness assessment
        signals = [
            f"Competency Coverage: {len(matched_competencies)} of {max(1, len(jd_skills))} "
            f"requirements backed by candidate evidence/resume",
            (
                f"Preserved Materials: Tailored resume ({resume_label}) "
                f"and cover letter ({cover_label})"
            ),
            f"Application Answers: {len(qa_context)} candidate-approved form answers recorded",
        ]
        if evidence_gaps:
            signals.append(
                f"Identified Gaps: {len(evidence_gaps)} requirements lack verified profile evidence"
            )

        if not evidence_gaps and len(matched_competencies) > 0:
            readiness_cat = "Strong"
            readiness_explanation = (
                f"Candidate profile and submitted materials provide verified evidence "
                f"for all primary competencies stated in the frozen job description "
                f"for {role} at {company}."
            )
        elif len(evidence_gaps) > 0:
            readiness_cat = "Evidence Gap"
            gap_names = [g.split(":")[0] for g in evidence_gaps[:3]]
            readiness_explanation = (
                f"Candidate profile lacks verified evidence for {len(evidence_gaps)} stated "
                f"requirements ({', '.join(gap_names)}). "
                f"Interviewers are likely to probe these competencies."
            )
        else:
            readiness_cat = "Needs Review"
            readiness_explanation = (
                f"Application materials recorded for {role}, but additional verified evidence "
                f"is recommended to substantiate alignment with {company}'s requirements."
            )

        readiness = InterviewReadinessResponse(
            category=readiness_cat,
            explanation=readiness_explanation,
            signals=signals,
        )

        # Assemble grounded structured questions
        structured_questions: list[InterviewQuestionItem] = []

        # 1. Technical Questions (derived from JD requirements)
        for comp in jd_skills[:4]:
            if comp in matched_competencies:
                structured_questions.append(
                    InterviewQuestionItem(
                        id=f"tech-{len(structured_questions) + 1}",
                        question=(
                            f"Explain how you design and implement resilient systems using {comp}."
                        ),
                        category="Technical",
                        why_asked=(
                            f"Core competency in frozen job description for {role} at {company}."
                        ),
                        relevant_evidence=evidence_mapping.get(comp, f"Verified skill: {comp}"),
                        prep_notes=(
                            "Discuss production architecture, concurrency constraints, "
                            f"and trade-offs when applying {comp}."
                        ),
                    )
                )
            else:
                structured_questions.append(
                    InterviewQuestionItem(
                        id=f"tech-{len(structured_questions) + 1}",
                        question=(
                            f"How would you approach ramping up on {comp} "
                            f"in {company}'s production environment?"
                        ),
                        category="Technical",
                        why_asked=(
                            "Requirement identified in job description "
                            "where profile lacks evidence."
                        ),
                        relevant_evidence="Evidence not found in your profile.",
                        prep_notes=(
                            "Highlight fundamental architectural principles and learning agility."
                        ),
                    )
                )

        # 2. Behavioral Questions (derived from background and role responsibilities)
        structured_questions.append(
            InterviewQuestionItem(
                id=f"beh-{len(structured_questions) + 1}",
                question=f"Why did you choose to apply to {company} as a {role}?",
                category="Behavioral",
                why_asked=f"Assesses candidate motivation and company alignment with {company}.",
                relevant_evidence=(
                    f"Cover letter statement: '{submitted_cover[:120]}...'"
                    if submitted_cover
                    else "Career profile headline and summary alignment."
                ),
                prep_notes="Frame answer around product impact, challenges, and culture.",
            )
        )
        first_exp = verified_experiences[0] if verified_experiences else None
        exp_ref = (
            f"Verified experience: {first_exp.title} at {first_exp.organization}"
            if first_exp
            else "Documented career experience."
        )
        structured_questions.append(
            InterviewQuestionItem(
                id=f"beh-{len(structured_questions) + 1}",
                question=(
                    "Tell me about a high-severity production incident you resolved under pressure."
                ),
                category="Behavioral",
                why_asked=(
                    f"Assesses operational maturity and incident management required for {role}."
                ),
                relevant_evidence=exp_ref,
                prep_notes=(
                    "Use STAR method: Situation, Task, Action (triage/root-cause fix), Result."
                ),
            )
        )

        # 3. Application-Specific Questions (grounded ONLY in submitted resume claims)
        app_claims = []
        if submitted_resume:
            for line in submitted_resume.split("\n"):
                clean = line.strip()
                if clean and len(clean) > 25 and not clean.startswith("#"):
                    app_claims.append(clean)
                    if len(app_claims) >= 2:
                        break
        if not app_claims and verified_evidence:
            app_claims.append(verified_evidence[0].content[:120])

        for idx, claim in enumerate(app_claims):
            structured_questions.append(
                InterviewQuestionItem(
                    id=f"app-{idx + 1}",
                    question=(
                        f'Your application highlights: "{claim[:90]}". '
                        "Explain: architecture, trade-offs, and measurable outcome."
                    ),
                    category="Application-Specific",
                    why_asked="Interviewer probing specific claims cited in submitted resume.",
                    relevant_evidence=(
                        f"Extracted from submitted tailored resume version ({resume_label})."
                    ),
                    prep_notes=(
                        "Be ready with technical depth: architecture, "
                        "latency metrics, and failure modes."
                    ),
                )
            )

        # 4. Application-Followup Questions (derived from approved application Q&A)
        app_followup_strings = []
        for item in qa_context:
            structured_questions.append(
                InterviewQuestionItem(
                    id=f"qa-{len(structured_questions) + 1}",
                    question=(
                        f'In your application, you submitted: "{item["answer"][:70]}". '
                        "How did you handle the associated risks, edge cases, or trade-offs?"
                    ),
                    category="Application-Followup",
                    why_asked=(
                        f"Probing follow-up on approved application question: '{item['question']}'"
                    ),
                    relevant_evidence=(
                        f"Recorded application answer ({item.get('source', 'Application Form')})."
                    ),
                    prep_notes=(
                        "Elaborate with tactical context beyond the initial application text field."
                    ),
                )
            )
            app_followup_strings.append(
                f"Follow-up on '{item['question']}': "
                f"How did you mitigate risks when '{item['answer'][:40]}'?"
            )

        # Role summary
        role_summary = (
            f"Based on the frozen job description, {company} prioritizes "
            f"{', '.join(jd_skills[:3]) if jd_skills else 'high-performance systems'} "
            f"for the {role} role. Candidates are evaluated on distributed architecture, "
            f"operational reliability, and proven production execution."
        )

        tech_topics = [
            f"Core system design and architecture relevant to {role}",
            "API design, concurrency, and distributed data consistency",
            "Reliability, performance tuning, and database optimization",
        ]
        role_questions = [
            f"How would you approach scaling key services at {company}?",
            f"What trade-offs have you made when architecting solutions for {role} roles?",
        ]
        resume_questions = [
            q.question for q in structured_questions if q.category == "Application-Specific"
        ]
        behavioral_questions = [
            f"Why did you choose to apply to {company}?",
            "Tell me about a time you resolved a major production outage under pressure.",
        ]
        if qa_context:
            behavioral_questions.append(
                f"Elaborate on your application answer: '{qa_context[0]['question']}'"
            )

        questions_to_ask = [
            f"What does the engineering roadmap look like for {company} over the next 12 months?",
            "How does the team balance new feature velocity with technical debt and reliability?",
            f"What are the biggest architectural bottlenecks facing the {role} team today?",
        ]
        prep_checklist = [
            f"Review exact submitted resume version: {resume_label}",
            f"Review exact job description snapshot for {role} at {company}",
            "Prepare STAR-format behavioral anecdotes aligned with stated company values",
            "Review answers submitted on application form for potential interviewer follow-ups",
            "Prepare responses addressing flagged profile evidence gaps",
        ]

        prep_data = {
            "role_summary": role_summary,
            "readiness": readiness.model_dump(),
            "structured_questions": [q.model_dump() for q in structured_questions],
            "technical_topics": tech_topics,
            "role_questions": role_questions,
            "resume_questions": resume_questions,
            "behavioral_questions": behavioral_questions,
            "application_specific_questions": resume_questions,
            "application_followup_questions": app_followup_strings,
            "evidence_gaps": evidence_gaps,
            "weak_spots": evidence_gaps
            if evidence_gaps
            else ["Review operational ownership and incident management."],
            "questions_to_ask": questions_to_ask,
            "preparation_checklist": prep_checklist,
            "submitted_qa_count": len(qa_context),
            "has_jd_snapshot": bool(jd_text),
            "has_cover_letter": bool(submitted_cover),
        }

        # Persist interview record
        interview = Interview(
            application_id=application_id,
            stage=stage,
            notes=f"Interview preparation generated for {stage} stage.",
            preparation_json=prep_data,
        )
        db.add(interview)
        db.commit()
        db.refresh(interview)

        return InterviewPrepResponse(
            application_id=application_id,
            stage=stage,
            role_summary=role_summary,
            readiness=readiness,
            structured_questions=structured_questions,
            technical_topics=tech_topics,
            role_questions=role_questions,
            resume_questions=resume_questions,
            behavioral_questions=behavioral_questions,
            application_specific_questions=resume_questions,
            application_followup_questions=app_followup_strings,
            evidence_gaps=evidence_gaps,
            weak_spots=evidence_gaps
            if evidence_gaps
            else ["Review operational ownership and incident management."],
            questions_to_ask=questions_to_ask,
            preparation_checklist=prep_checklist,
            grounded_in_capsule=True,
            generated_at=datetime.now(UTC),
        )

    @staticmethod
    def add_follow_up(
        db: Session, application_id: UUID, payload: FollowUpCreate
    ) -> FollowUpResponse:
        app = ApplicationService.get_application(db, application_id)
        fu = FollowUp(
            application_id=app.id,
            type=payload.type,
            due_at=payload.due_at,
            notes=payload.notes,
        )
        db.add(fu)
        db.commit()
        db.refresh(fu)
        return FollowUpResponse.model_validate(fu)

    @staticmethod
    def list_follow_ups(db: Session, application_id: UUID) -> list[FollowUpResponse]:
        ApplicationService.get_application(db, application_id)
        items = list(
            db.scalars(
                select(FollowUp)
                .where(FollowUp.application_id == application_id)
                .order_by(FollowUp.due_at.asc())
            )
        )
        return [FollowUpResponse.model_validate(i) for i in items]

    @staticmethod
    def update_follow_up(
        db: Session, follow_up_id: UUID, payload: FollowUpUpdate
    ) -> FollowUpResponse:
        fu = db.scalar(select(FollowUp).where(FollowUp.id == follow_up_id))
        if not fu:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Follow-up {follow_up_id} not found",
            )
        now = datetime.now(UTC)
        if payload.status:
            if payload.status == "Completed":
                fu.completed_at = payload.completed_at or now
                if fu.notes and "[SKIPPED]" in fu.notes:
                    fu.notes = fu.notes.replace("[SKIPPED]", "").strip()
            elif payload.status == "Skipped":
                fu.completed_at = payload.completed_at or now
                curr_note = fu.notes or ""
                if "[SKIPPED]" not in curr_note:
                    fu.notes = f"[SKIPPED] {curr_note}".strip()
            elif payload.status == "Pending":
                fu.completed_at = None
                if fu.notes and "[SKIPPED]" in fu.notes:
                    fu.notes = fu.notes.replace("[SKIPPED]", "").strip()
        elif payload.completed_at is not None:
            fu.completed_at = payload.completed_at

        if payload.notes is not None:
            fu.notes = payload.notes

        db.commit()
        db.refresh(fu)
        return FollowUpResponse.model_validate(fu)
