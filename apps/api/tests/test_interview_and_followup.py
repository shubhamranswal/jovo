import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from apps.api.db.models import (
    Base,
    CareerEvidence,
    CareerExperience,
    CareerProfile,
    CareerProfileSkill,
    Company,
    CoverLetter,
    Job,
    Resume,
    ResumeVersion,
    Skill,
    User,
)
from apps.api.schemas.application import (
    ApplicationAnswerCreate,
    ApplicationCreate,
    ApplicationDocumentCreate,
    ApplicationQuestionCreate,
)
from apps.api.schemas.interview import FollowUpCreate, FollowUpUpdate
from apps.api.services.application_service import ApplicationService


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite engine for Phase 9 testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def test_user(db_session: Session) -> User:
    user = User(
        id=uuid.uuid4(),
        email="elena.rostova@example.com",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_company(db_session: Session) -> Company:
    company = Company(
        id=uuid.uuid4(),
        canonical_name="Datamesh Corp",
        domain="datamesh.io",
        metadata_json={"industry": "Distributed Infrastructure"},
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company


@pytest.fixture
def test_job(db_session: Session, test_company: Company) -> Job:
    job = Job(
        id=uuid.uuid4(),
        company_id=test_company.id,
        title="Staff Platform Engineer",
        description=(
            "Architect global stream-processing pipelines. Requires Go, Raft, Kubernetes, and Zig."
        ),
        location="Remote, Global",
        employment_type="Full-time",
        salary_min=Decimal("230000.00"),
        salary_max=Decimal("275000.00"),
        currency="USD",
        fingerprint="fingerprint-datamesh-101",
        metadata_json={"skills": ["Go", "Raft", "Kubernetes", "Zig"]},
        canonical_url="https://datamesh.io/careers/staff-platform",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


@pytest.fixture
def test_career_profile(db_session: Session, test_user: User) -> CareerProfile:
    profile = CareerProfile(
        id=uuid.uuid4(),
        user_id=test_user.id,
        headline="Principal Systems Architect",
        summary="Specialist in distributed consensus and memory-safe systems.",
        preferences_json={"remote": True},
    )
    db_session.add(profile)
    db_session.flush()

    # Skills: Go, Raft, Kubernetes (Zig is intentionally omitted to verify gap detection)
    for skill_name in ["Go", "Raft", "Kubernetes"]:
        sk = Skill(id=uuid.uuid4(), normalized_name=skill_name.lower())
        db_session.add(sk)
        db_session.flush()
        cps = CareerProfileSkill(
            career_profile_id=profile.id,
            skill_id=sk.id,
            proficiency="expert",
        )
        db_session.add(cps)

    # Experience
    exp = CareerExperience(
        id=uuid.uuid4(),
        career_profile_id=profile.id,
        organization="Nexus Cloud",
        title="Lead Platform Architect",
        description="Designed fault-tolerant consensus clusters in Go managing 500k ops/sec.",
        evidence_status="verified",
    )
    db_session.add(exp)

    # Evidence
    ev = CareerEvidence(
        id=uuid.uuid4(),
        career_profile_id=profile.id,
        type="github_repo",
        title="Distributed Raft Consensus Engine in Go",
        content="Engineered linearizable state machine replication in Go with snapshotting.",
        source_type="github",
        verification_state="verified",
    )
    db_session.add(ev)

    db_session.commit()
    db_session.refresh(profile)
    return profile


def test_interview_prep_grounding_and_gap_detection(
    db_session: Session,
    test_user: User,
    test_career_profile: CareerProfile,
    test_job: Job,
    test_company: Company,
):
    """Verify prep derives from frozen JD, resume, Q&A, and flags evidence gaps."""
    # 1. Create tailored materials
    base_resume = Resume(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        name="Master Resume",
        extracted_text="Base Master Resume.",
        is_master=True,
    )
    tailored_resume = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=base_resume.id,
        job_id=test_job.id,
        version_label="v1-datamesh-tailored",
        content=(
            "Elena Rostova | Principal Systems Architect\n"
            "Key accomplishment: Scaled Go and Raft pipeline to 500k ops/sec at Nexus Cloud."
        ),
    )
    cover_letter = CoverLetter(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        job_id=test_job.id,
        version=1,
        content=(
            "Dear Datamesh Hiring Team,\nI have spent 8 years building distributed storage cores."
        ),
    )
    db_session.add_all([base_resume, tailored_resume, cover_letter])
    db_session.commit()

    # 2. Submit application with materials and approved Q&A
    app_summary = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Extension Autofill",
            application_url=test_job.canonical_url,
            status="Applied",
            initial_documents=[
                ApplicationDocumentCreate(
                    document_type="resume",
                    document_id=tailored_resume.id,
                    version_label=tailored_resume.version_label,
                ),
                ApplicationDocumentCreate(
                    document_type="cover_letter",
                    document_id=cover_letter.id,
                    version_label="v1-cover-letter",
                ),
            ],
            initial_questions=[
                ApplicationQuestionCreate(
                    question_text="How do you handle log compaction under high write load?",
                    order_index=1,
                    answer=ApplicationAnswerCreate(
                        answer_text=(
                            "We implemented background chunked snapshotting with LSM storage."
                        ),
                        source="User Edited LLM Draft",
                        user_approved=True,
                    ),
                )
            ],
        ),
    )

    # 3. Generate Interview Preparation
    prep = ApplicationService.prepare_interview(
        db_session,
        app_summary.id,
        stage="Technical Architecture",
    )

    assert prep.stage == "Technical Architecture"
    assert prep.grounded_in_capsule is True

    # Role summary mentions company and role
    assert "Datamesh Corp" in prep.role_summary
    assert "Staff Platform Engineer" in prep.role_summary

    # Readiness assessment: Zig was required by JD but missing in profile -> "Evidence Gap"
    assert prep.readiness is not None
    assert prep.readiness.category == "Evidence Gap"
    assert any("Zig" in sig or "Gaps" in sig for sig in prep.readiness.signals)

    # Evidence gap explicitly flagged without hallucinating Zig background
    assert len(prep.evidence_gaps) >= 1
    assert any("Zig: Evidence not found in your profile." in gap for gap in prep.evidence_gaps)

    # Application-specific questions probe the exact tailored resume claim
    assert len(prep.structured_questions) > 0
    app_questions = [q for q in prep.structured_questions if q.category == "Application-Specific"]
    assert len(app_questions) >= 1
    assert any("Scaled Go and Raft" in q.question for q in app_questions)

    # Application follow-up probes the exact submitted answer
    qa_followups = [q for q in prep.structured_questions if q.category == "Application-Followup"]
    assert len(qa_followups) >= 1
    assert any("background chunked snapshotting" in q.question for q in qa_followups)
    assert any("log compaction" in q.why_asked for q in qa_followups)


def test_historical_integrity_under_job_and_profile_mutations(
    db_session: Session,
    test_user: User,
    test_career_profile: CareerProfile,
    test_job: Job,
    test_company: Company,
):
    """Interview prep uses frozen snapshot and historical resume even if live records mutate."""
    # 1. Create tailored resume v1
    base_res = Resume(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        name="Master",
        extracted_text="Master text",
        is_master=True,
    )
    res_v1 = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=base_res.id,
        job_id=test_job.id,
        version_label="v1-original-submission",
        content="Original submission resume: Architected low-latency gRPC router at Nexus.",
    )
    db_session.add_all([base_res, res_v1])
    db_session.commit()

    # 2. Submit application
    app_summary = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Workday",
            status="Applied",
            initial_documents=[
                ApplicationDocumentCreate(
                    document_type="resume",
                    document_id=res_v1.id,
                    version_label="v1-original-submission",
                )
            ],
        ),
    )

    # 3. Time passes. Live job is heavily altered or deleted
    test_job.title = "Junior React Developer"
    test_job.description = "We now only hire frontend UI builders."
    test_job.metadata_json = {"skills": ["React", "CSS"]}

    # Candidate creates a newer resume v2 for another company
    res_v2 = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=base_res.id,
        version_label="v2-later-unrelated",
        content="Unrelated resume: AI Prompt Designer.",
    )
    db_session.add(res_v2)
    db_session.commit()

    # 4. Generate interview prep for the original Datamesh application
    prep = ApplicationService.prepare_interview(db_session, app_summary.id, "System Design")

    # The preparation MUST reflect the frozen Staff Platform Engineer role and v1 resume
    assert "Staff Platform Engineer" in prep.role_summary
    assert "Junior React Developer" not in prep.role_summary

    # Application-specific question must use v1 resume content, not v2
    app_questions = [q for q in prep.structured_questions if q.category == "Application-Specific"]
    assert any("low-latency gRPC router" in q.question for q in app_questions)
    assert not any("AI Prompt Designer" in q.question for q in app_questions)


def test_follow_up_lifecycle_and_statuses(
    db_session: Session,
    test_user: User,
    test_job: Job,
    test_company: Company,
):
    """Verify follow-up creation, retrieval, completion, and skip status transitions."""
    app_record = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Portal",
            status="Applied",
        ),
    )

    # 1. Schedule a follow-up
    due_date = datetime.now(UTC) + timedelta(days=4)
    fu1 = ApplicationService.add_follow_up(
        db_session,
        app_record.id,
        FollowUpCreate(
            type="interview_follow_up",
            due_at=due_date,
            notes="Send thank-you email to engineering director.",
        ),
    )
    assert fu1.type == "interview_follow_up"
    assert fu1.status == "Pending"
    assert fu1.completed_at is None
    assert fu1.notes == "Send thank-you email to engineering director."

    # Schedule second follow-up
    fu2 = ApplicationService.add_follow_up(
        db_session,
        app_record.id,
        FollowUpCreate(
            type="recruiter_follow_up",
            due_at=datetime.now(UTC) + timedelta(days=7),
            notes="Check on team match feedback.",
        ),
    )

    # 2. List follow-ups
    items = ApplicationService.list_follow_ups(db_session, app_record.id)
    assert len(items) == 2
    assert items[0].id == fu1.id
    assert items[1].id == fu2.id

    # 3. Mark fu1 as Completed
    completed_fu1 = ApplicationService.update_follow_up(
        db_session,
        fu1.id,
        FollowUpUpdate(status="Completed"),
    )
    assert completed_fu1.status == "Completed"
    assert completed_fu1.completed_at is not None

    # 4. Mark fu2 as Skipped
    skipped_fu2 = ApplicationService.update_follow_up(
        db_session,
        fu2.id,
        FollowUpUpdate(status="Skipped"),
    )
    assert skipped_fu2.status == "Skipped"
    assert skipped_fu2.completed_at is not None
    assert "[SKIPPED]" in (skipped_fu2.notes or "")

    # 5. Reopen fu1 back to Pending
    reopened_fu1 = ApplicationService.update_follow_up(
        db_session,
        fu1.id,
        FollowUpUpdate(status="Pending"),
    )
    assert reopened_fu1.status == "Pending"
    assert reopened_fu1.completed_at is None


def test_golden_phase_9_journey(
    db_session: Session,
    test_user: User,
    test_career_profile: CareerProfile,
    test_job: Job,
    test_company: Company,
):
    """The Golden Phase 9 Flow:

    Application Capsule
            ↓
    Frozen JD + Submitted Resume + Approved Q&A
            ↓
    "Prepare for Interview"
            ↓
    Grounded preparation generated (Role summary, Readiness, Questions, Gaps)
            ↓
    Candidate schedules Follow-up
            ↓
    Follow-up is tracked and marked completed
            ↓
    Capsule timeline audit trail confirms all milestones
    """
    # 1. Candidate submitted application
    base_res = Resume(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        name="Master",
        extracted_text="Base text",
        is_master=True,
    )
    res_v3 = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=base_res.id,
        job_id=test_job.id,
        version_label="v3-golden-final",
        content=(
            "Elena Rostova | Principal Systems Architect\n"
            "Proven milestone: Built linearizable Raft cluster with sub-5ms commit latency."
        ),
    )
    db_session.add_all([base_res, res_v3])
    db_session.commit()

    app_created = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Workday Chrome Extension",
            application_url=test_job.canonical_url,
            status="Applied",
            initial_documents=[
                ApplicationDocumentCreate(
                    document_type="resume",
                    document_id=res_v3.id,
                    version_label="v3-golden-final",
                )
            ],
            initial_questions=[
                ApplicationQuestionCreate(
                    question_text="Describe how you test distributed failure domains.",
                    order_index=1,
                    answer=ApplicationAnswerCreate(
                        answer_text="Jepsen partition injection and automated Chaos Mesh drills.",
                        source="Candidate Approved Autofill",
                        user_approved=True,
                    ),
                )
            ],
        ),
    )

    # 2. Candidate clicks "Prepare for Interview"
    prep = ApplicationService.prepare_interview(
        db_session,
        app_created.id,
        stage="Technical Deep-Dive",
    )
    assert prep.stage == "Technical Deep-Dive"
    assert len(prep.structured_questions) >= 4
    assert any("sub-5ms commit latency" in q.question for q in prep.structured_questions)
    assert any("Jepsen partition injection" in q.question for q in prep.structured_questions)

    # 3. Candidate schedules follow-up
    due = datetime.now(UTC) + timedelta(days=2)
    fu = ApplicationService.add_follow_up(
        db_session,
        app_created.id,
        FollowUpCreate(
            type="interview_follow_up",
            due_at=due,
            notes="Send thank-you email highlighting Chaos Mesh discussion.",
        ),
    )
    assert fu.status == "Pending"

    # 4. Candidate completes follow-up
    done_fu = ApplicationService.update_follow_up(
        db_session,
        fu.id,
        FollowUpUpdate(status="Completed"),
    )
    assert done_fu.status == "Completed"

    # 5. Retrieve full Application Capsule and verify historical memory
    capsule = ApplicationService.get_application_capsule(db_session, app_created.id)
    assert capsule.application.status == "Applied"
    assert len(capsule.interviews) == 1
    assert len(capsule.follow_ups) == 1
    assert capsule.follow_ups[0].status == "Completed"

    # Verify interview preparation JSON is preserved in the capsule
    interview_record = capsule.interviews[0]
    assert interview_record.preparation_json["role_summary"] == prep.role_summary
    assert len(interview_record.preparation_json["structured_questions"]) >= 4
