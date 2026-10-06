import uuid
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from apps.api.db.models import (
    Application,
    ApplicationSnapshot,
    Base,
    CareerProfile,
    Company,
    CoverLetter,
    Job,
    Resume,
    ResumeVersion,
    User,
)
from apps.api.schemas.application import (
    ApplicationAnswerCreate,
    ApplicationCreate,
    ApplicationDocumentCreate,
    ApplicationQuestionCreate,
)
from apps.api.services.application_service import ApplicationService


@pytest.fixture
def db_session():
    """Create an isolated in-memory SQLite database session for testing."""
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
        email="candidate@example.com",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_career_profile(db_session: Session, test_user: User) -> CareerProfile:
    profile = CareerProfile(
        id=uuid.uuid4(),
        user_id=test_user.id,
        headline="Senior Systems Engineer",
        summary="Distributed systems and platform engineering specialist.",
        preferences_json={"remote": True},
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)
    return profile


@pytest.fixture
def test_company(db_session: Session) -> Company:
    company = Company(
        id=uuid.uuid4(),
        canonical_name="Acme Cloud Technologies",
        domain="acmecloud.io",
        metadata_json={"industry": "Cloud Computing"},
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
        title="Staff Infrastructure Engineer",
        description=(
            "Lead our high-throughput distributed messaging core. "
            "Requires Go, Kubernetes, Raft consensus."
        ),
        location="San Francisco, CA / Remote",
        employment_type="Full-time",
        salary_min=Decimal("220000.00"),
        salary_max=Decimal("260000.00"),
        currency="USD",
        fingerprint="fingerprint-acme-job-101",
        metadata_json={"skills": ["Go", "Kubernetes", "Distributed Systems", "Raft"]},
        canonical_url="https://acme.wd1.myworkdayjobs.com/en-US/careers/job/101",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def test_application_creation_and_automatic_snapshot(
    db_session: Session,
    test_user: User,
    test_job: Job,
    test_company: Company,
):
    """Verify application creation automatically freezes the job description and metadata."""
    payload = ApplicationCreate(
        user_id=test_user.id,
        job_id=test_job.id,
        company_id=test_company.id,
        title=test_job.title,
        source="Workday Extension",
        application_url=test_job.canonical_url,
        status="Saved",
    )

    app_record = ApplicationService.create_application(db_session, payload)
    assert app_record is not None
    assert app_record.user_id == test_user.id
    assert app_record.job_id == test_job.id
    assert app_record.title == "Staff Infrastructure Engineer"
    assert app_record.company_name == "Acme Cloud Technologies"
    assert app_record.status == "Saved"

    # Verify automatic snapshot was created and frozen in database
    snapshots = (
        db_session.query(ApplicationSnapshot)
        .filter(ApplicationSnapshot.application_id == app_record.id)
        .all()
    )
    assert len(snapshots) == 1
    snapshot = snapshots[0]
    assert snapshot.job_description == test_job.description
    assert snapshot.page_url == test_job.canonical_url
    assert "Raft" in snapshot.extraction_metadata_json.get("skills", [])


def test_deterministic_deduplication(
    db_session: Session,
    test_user: User,
    test_job: Job,
    test_company: Company,
):
    """Subsequent captures for same (user_id, job_id) update in place without duplicating."""
    # Initial capture when browsing / saving
    initial_payload = ApplicationCreate(
        user_id=test_user.id,
        job_id=test_job.id,
        company_id=test_company.id,
        title=test_job.title,
        source="JobOS Web",
        status="Saved",
    )
    first_app = ApplicationService.create_application(db_session, initial_payload)
    first_id = first_app.id

    # Second capture when submitting via extension
    submit_payload = ApplicationCreate(
        user_id=test_user.id,
        job_id=test_job.id,
        company_id=test_company.id,
        title=test_job.title,
        source="Workday Extension",
        status="Applied",
        notes="Applied via Chrome Extension with tailored resume.",
        initial_questions=[
            ApplicationQuestionCreate(
                question_text="Years of Go experience?",
                order_index=1,
                answer=ApplicationAnswerCreate(
                    answer_text="7+ years building high-concurrency systems.",
                    source="Extension Autofill",
                    user_approved=True,
                ),
            )
        ],
    )
    second_app = ApplicationService.create_application(db_session, submit_payload)

    # Must be the exact same application row (deduplicated)
    assert second_app.id == first_id
    assert second_app.status == "Applied"
    assert second_app.applied_at is not None
    assert second_app.notes == "Applied via Chrome Extension with tailored resume."

    # Verify only ONE application exists for this user and job
    total_apps = (
        db_session.query(Application)
        .filter(Application.user_id == test_user.id, Application.job_id == test_job.id)
        .count()
    )
    assert total_apps == 1

    # Verify question was attached to the existing application
    capsule = ApplicationService.get_application_capsule(db_session, first_id)
    assert len(capsule.questions) == 1
    assert capsule.questions[0].question_text == "Years of Go experience?"
    assert (
        capsule.questions[0].answers[0].answer_text
        == "7+ years building high-concurrency systems."
    )


def test_exact_jd_snapshot_immutability(
    db_session: Session,
    test_user: User,
    test_job: Job,
    test_company: Company,
):
    """The frozen JD snapshot in the capsule must survive live job modifications and deletions."""
    original_jd = test_job.description

    # Create application with snapshot
    app_record = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Workday",
            status="Applied",
        ),
    )

    # Live job is later heavily altered or taken down by the company
    test_job.description = "JOB EXPIRED / REPLACED: We are now hiring Junior Web Designers."
    test_job.title = "Junior Web Designer"
    db_session.commit()

    # Retrieve Application Capsule
    capsule = ApplicationService.get_application_capsule(db_session, app_record.id)
    assert capsule is not None

    # The frozen snapshot must preserve the original JD, NOT the mutated one
    assert capsule.latest_snapshot is not None
    assert capsule.latest_snapshot.job_description == original_jd
    assert "Junior Web Designer" not in capsule.latest_snapshot.job_description
    assert "Raft consensus" in capsule.latest_snapshot.job_description


def test_exact_resume_and_cover_letter_versioning(
    db_session: Session,
    test_user: User,
    test_career_profile: CareerProfile,
    test_job: Job,
    test_company: Company,
):
    """Capsule preserves the exact tailored resume version and cover letter text submitted."""
    # Create base master resume
    base_resume = Resume(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        name="Master Resume 2026",
        extracted_text="Alex Rivera - Software Engineer - General Master Resume.",
        is_master=True,
    )
    db_session.add(base_resume)
    db_session.commit()

    # Create Tailored Resume Version 1 specifically for Acme
    resume_v1 = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=base_resume.id,
        job_id=test_job.id,
        version_label="v1-acme-staff-infra",
        content=(
            "Alex Rivera - Staff Infrastructure Engineer\n"
            "Specialized in Go, Raft, Distributed Queues for Acme."
        ),
    )
    # Create Cover Letter 1 specifically for Acme
    cover_letter_v1 = CoverLetter(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        job_id=test_job.id,
        version=1,
        content=(
            "Dear Acme Cloud Technologies Hiring Team,\n"
            "I have designed distributed Raft clusters..."
        ),
    )
    db_session.add_all([resume_v1, cover_letter_v1])
    db_session.commit()

    # Create application linking v1 materials
    app_record = ApplicationService.create_application(
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
                    document_id=resume_v1.id,
                    version_label="v1-acme-staff-infra",
                ),
                ApplicationDocumentCreate(
                    document_type="cover_letter",
                    document_id=cover_letter_v1.id,
                    version_label="cl-acme-cloud",
                ),
            ],
        ),
    )

    # Later, candidate creates Version 2 for another job
    resume_v2 = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=base_resume.id,
        version_label="v2-crypto-systems",
        content="Alex Rivera - Blockchain Core Architect.",
    )
    db_session.add(resume_v2)
    db_session.commit()

    # Retrieve capsule
    capsule = ApplicationService.get_application_capsule(db_session, app_record.id)
    assert len(capsule.documents) == 2

    resume_doc = next(d for d in capsule.documents if d.document_type == "resume")
    cover_doc = next(d for d in capsule.documents if d.document_type == "cover_letter")

    # Verify exact version labels and resolved content
    assert resume_doc.version_label == "v1-acme-staff-infra"
    assert resume_doc.content is not None
    assert "Specialized in Go, Raft, Distributed Queues for Acme." in resume_doc.content
    assert "Blockchain" not in resume_doc.content

    assert cover_doc.version_label == "cl-acme-cloud"
    assert cover_doc.content is not None
    assert "Dear Acme Cloud Technologies" in cover_doc.content


def test_question_and_candidate_approval_preservation(
    db_session: Session,
    test_user: User,
    test_job: Job,
    test_company: Company,
):
    """Candidate-edited answers and approval flags are preserved faithfully in capsule."""
    app_record = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Workday",
            status="Applied",
            initial_questions=[
                ApplicationQuestionCreate(
                    question_text="Describe a complex outage you mitigated.",
                    order_index=1,
                    answer=ApplicationAnswerCreate(
                        answer_text=(
                            "Diagnosed a split-brain condition in an etcd cluster, "
                            "restored quorum safely in 18 minutes."
                        ),
                        source="User Edited LLM Draft",
                        user_approved=True,
                    ),
                ),
                ApplicationQuestionCreate(
                    question_text="Preferred timezone?",
                    order_index=2,
                    answer=ApplicationAnswerCreate(
                        answer_text="UTC-8 (Pacific)",
                        source="Profile Autofill",
                        user_approved=True,
                    ),
                ),
            ],
        ),
    )

    capsule = ApplicationService.get_application_capsule(db_session, app_record.id)
    assert len(capsule.questions) == 2

    q1 = next(q for q in capsule.questions if "outage" in q.question_text)
    assert len(q1.answers) == 1
    ans1 = q1.answers[0]
    assert "split-brain condition" in ans1.answer_text
    assert ans1.user_approved is True
    assert ans1.source == "User Edited LLM Draft"


def test_golden_application_memory_journey(
    db_session: Session,
    test_user: User,
    test_career_profile: CareerProfile,
    test_job: Job,
    test_company: Company,
):
    """The Golden Demo Flow:

    1. Job discovered via SerpApi
    2. Tailored materials created and frozen
    3. Extension detects and autofills application
    4. Observational submission captured into Application Capsule
    5. Live job posting subsequently mutated/deleted
    6. Candidate reopens capsule weeks later
    7. All original context (JD, exact resume, cover letter, answers, timeline) intact
    8. Grounded interview preparation generated from exact preserved capsule
    """
    # 1. Tailor materials
    resume = Resume(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        name="Master Resume",
        extracted_text="Master Resume raw text",
        is_master=True,
    )
    tailored_resume = ResumeVersion(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        base_resume_id=resume.id,
        job_id=test_job.id,
        version_label="v1-golden-tailored",
        content="Alex Rivera | Staff Infrastructure | Proven Raft & Go experience.",
    )
    tailored_cover_letter = CoverLetter(
        id=uuid.uuid4(),
        career_profile_id=test_career_profile.id,
        job_id=test_job.id,
        version=1,
        content=(
            "Dear Acme Team,\n"
            "Excited to submit my application for Staff Infrastructure Engineer."
        ),
    )
    db_session.add_all([resume, tailored_resume, tailored_cover_letter])
    db_session.commit()

    # 2. Extension observational capture
    submitted_app = ApplicationService.create_application(
        db_session,
        ApplicationCreate(
            user_id=test_user.id,
            job_id=test_job.id,
            company_id=test_company.id,
            title=test_job.title,
            source="Workday Extension",
            application_url=test_job.canonical_url,
            status="Applied",
            notes="Manually submitted on Acme Workday portal.",
            initial_documents=[
                ApplicationDocumentCreate(
                    document_type="resume",
                    document_id=tailored_resume.id,
                    version_label=tailored_resume.version_label,
                ),
                ApplicationDocumentCreate(
                    document_type="cover_letter",
                    document_id=tailored_cover_letter.id,
                    version_label="v1-golden-tailored",
                ),
            ],
            initial_questions=[
                ApplicationQuestionCreate(
                    question_text="Why Acme Cloud Technologies?",
                    order_index=1,
                    answer=ApplicationAnswerCreate(
                        answer_text=(
                            "Acme powers the next generation of resilient edge infrastructure."
                        ),
                        source="User Edited",
                        user_approved=True,
                    ),
                )
            ],
        ),
    )

    # 3. Time passes. Live job posting is modified or removed from live web
    original_jd = test_job.description
    test_job.description = "404 - Job No Longer Available."
    test_job.canonical_url = "https://example.com/expired"
    db_session.commit()

    # 4. Candidate returns weeks later to prepare for interview
    capsule = ApplicationService.get_application_capsule(db_session, submitted_app.id)

    # 5. Core Promise Verification:
    # "Wait... it remembers everything I did on the application?"
    assert capsule.application.title == "Staff Infrastructure Engineer"
    assert capsule.application.company_name == "Acme Cloud Technologies"
    assert capsule.application.status == "Applied"
    assert capsule.application.applied_at is not None

    # Exact JD preserved
    assert capsule.latest_snapshot is not None
    assert capsule.latest_snapshot.job_description == original_jd
    assert "404" not in capsule.latest_snapshot.job_description

    # Exact documents preserved
    res_doc = next(d for d in capsule.documents if d.document_type == "resume")
    cl_doc = next(d for d in capsule.documents if d.document_type == "cover_letter")
    assert res_doc.content == tailored_resume.content
    assert cl_doc.content == tailored_cover_letter.content

    # Exact answers preserved
    assert len(capsule.questions) == 1
    assert capsule.questions[0].question_text == "Why Acme Cloud Technologies?"
    assert (
        capsule.questions[0].answers[0].answer_text
        == "Acme powers the next generation of resilient edge infrastructure."
    )

    # 6. Generate grounded interview preparation directly from capsule
    interview_prep = ApplicationService.prepare_interview(
        db_session,
        submitted_app.id,
        stage="Technical Screen",
    )

    assert interview_prep.stage == "Technical Screen"
    assert interview_prep.grounded_in_capsule is True
    assert len(interview_prep.technical_topics) > 0
    assert any("Acme" in q for q in interview_prep.behavioral_questions)
    assert any("Why Acme Cloud Technologies?" in q for q in interview_prep.behavioral_questions)

    # Reload capsule and verify interview record is linked
    reloaded_capsule = ApplicationService.get_application_capsule(
        db_session, submitted_app.id
    )
    assert len(reloaded_capsule.interviews) == 1
    assert reloaded_capsule.interviews[0].stage == "Technical Screen"
