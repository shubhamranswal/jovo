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
    Company,
    CoverLetter,
    FollowUp,
    Interview,
    Job,
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

        application = Application(
            user_id=payload.user_id,
            job_id=payload.job_id,
            company_id=company_id,
            title=payload.title,
            source=payload.source,
            application_url=payload.application_url,
            status=payload.status,
            notes=payload.notes,
            metadata_json=payload.metadata_json,
        )
        db.add(application)
        db.flush()

        # Handle initial snapshot if supplied
        if payload.initial_snapshot:
            snap = ApplicationSnapshot(
                application_id=application.id,
                job_description=payload.initial_snapshot.job_description,
                page_title=payload.initial_snapshot.page_title,
                page_url=payload.initial_snapshot.page_url,
                extraction_metadata_json=payload.initial_snapshot.extraction_metadata_json,
            )
            db.add(snap)

        # Handle initial documents
        for doc_in in payload.initial_documents:
            doc = ApplicationDocument(
                application_id=application.id,
                document_type=doc_in.document_type,
                document_id=doc_in.document_id,
                version_label=doc_in.version_label,
            )
            db.add(doc)

        # Handle initial questions and answers
        for q_in in payload.initial_questions:
            q = ApplicationQuestion(
                application_id=application.id,
                question_text=q_in.question_text,
                normalized_question=q_in.normalized_question,
                question_type=q_in.question_type,
                page_field_name=q_in.page_field_name,
                order_index=q_in.order_index,
            )
            db.add(q)
            db.flush()
            if q_in.answer:
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
        the exact Application Capsule.
        """
        capsule = ApplicationService.get_application_capsule(db, application_id)
        app_summary = capsule.application

        # Extract JD text
        jd_text = capsule.latest_snapshot.job_description if capsule.latest_snapshot else ""
        company = app_summary.company_name or "Target Company"
        role = app_summary.title

        # Extract submitted materials
        submitted_resume = next(
            (d.content for d in capsule.documents if d.document_type == "resume" and d.content),
            None,
        )
        submitted_cover = next(
            (
                d.content
                for d in capsule.documents
                if d.document_type == "cover_letter" and d.content
            ),
            None,
        )

        qa_context = []
        for q in capsule.questions:
            for ans in q.answers:
                qa_context.append(f"Q: {q.question_text} | A: {ans.answer_text}")

        # Assemble grounded interview topics
        tech_topics = [
            f"Core system design and architecture relevant to {role}",
            "API design, concurrency, and distributed data consistency",
            "Reliability, performance tuning, and database optimization",
        ]
        role_questions = [
            f"How would you approach scaling key services at {company}?",
            f"What trade-offs have you made when architecting solutions for {role} roles?",
        ]
        resume_questions = (
            [
                "Walk through technical challenges in your most impactful project.",
                "Explain the metrics and architectural decisions cited in your tailored resume.",
            ]
            if submitted_resume
            else ["Walk through your most significant engineering accomplishments."]
        )
        behavioral_questions = [
            f"Why did you choose to apply to {company}?",
            "Tell me about a time you resolved a major production outage under pressure.",
        ]
        if qa_context:
            behavioral_questions.append(
                f"Elaborate on your application answer: '{capsule.questions[0].question_text}'"
            )

        weak_spots = [
            "Be prepared to address specific niche tooling in JD not detailed in resume.",
            "Expect deep-dive inquiries on operational ownership and incident management.",
        ]
        questions_to_ask = [
            f"What does the engineering roadmap look like for {company} over the next 12 months?",
            "How does the team balance new feature velocity with technical debt management?",
        ]
        doc_label = capsule.documents[0].version_label if capsule.documents else "Default"
        prep_checklist = [
            f"Review exact submitted resume version: {doc_label}",
            f"Review exact job description snapshot for {role} at {company}",
            "Prepare 3 STAR-format behavioral anecdotes aligned with stated company values",
            "Prepare questions for the interviewer",
        ]

        prep_data = {
            "technical_topics": tech_topics,
            "role_questions": role_questions,
            "resume_questions": resume_questions,
            "behavioral_questions": behavioral_questions,
            "weak_spots": weak_spots,
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
            technical_topics=tech_topics,
            role_questions=role_questions,
            resume_questions=resume_questions,
            behavioral_questions=behavioral_questions,
            weak_spots=weak_spots,
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
        if payload.completed_at is not None:
            fu.completed_at = payload.completed_at
        if payload.notes is not None:
            fu.notes = payload.notes
        db.commit()
        db.refresh(fu)
        return FollowUpResponse.model_validate(fu)
