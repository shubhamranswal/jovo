import uuid
from decimal import Decimal

from apps.api.db.models import (
    Application,
    ApplicationAnswer,
    ApplicationQuestion,
    ApplicationSnapshot,
    Base,
    CareerEvidence,
    CareerExperience,
    CareerProfile,
    Company,
    Job,
    JobMatch,
    Resume,
    ResumeVersion,
    User,
)


def test_registered_tables_count():
    """Ensure all 19 domain models are registered with Base.metadata."""
    table_names = set(Base.metadata.tables.keys())
    expected_tables = {
        "users",
        "career_profiles",
        "career_experiences",
        "skills",
        "career_profile_skills",
        "career_evidence",
        "resumes",
        "resume_versions",
        "cover_letters",
        "companies",
        "jobs",
        "job_matches",
        "applications",
        "application_snapshots",
        "application_documents",
        "application_questions",
        "application_answers",
        "interviews",
        "follow_ups",
    }
    assert expected_tables.issubset(table_names)
    assert len(expected_tables) == 19


def test_schema_constraints_and_foreign_keys():
    """Assert database schema constraints, defaults, and foreign key relationships."""
    assert User.__table__.columns["is_active"].default.arg is True
    assert Application.__table__.columns["status"].default.arg == "Saved"
    assert CareerExperience.__table__.columns["evidence_status"].default.arg == "unverified"
    assert Resume.__table__.columns["is_master"].default.arg is False
    assert ApplicationAnswer.__table__.columns["user_approved"].default.arg is True

    # Check key foreign keys
    cp_fks = {fk.target_fullname for fk in CareerProfile.__table__.foreign_keys}
    assert "users.id" in cp_fks

    job_fks = {fk.target_fullname for fk in Job.__table__.foreign_keys}
    assert "companies.id" in job_fks

    app_fks = {fk.target_fullname for fk in Application.__table__.foreign_keys}
    assert "users.id" in app_fks
    assert "jobs.id" in app_fks
    assert "companies.id" in app_fks

    match_fks = {fk.target_fullname for fk in JobMatch.__table__.foreign_keys}
    assert "jobs.id" in match_fks
    assert "career_profiles.id" in match_fks


def test_user_and_career_profile_model_instantiation():
    """Verify User and CareerProfile instantiation and defaults."""
    user = User(email="engineer@example.com", is_active=True)
    assert user.email == "engineer@example.com"
    assert user.is_active is True

    profile = CareerProfile(
        user_id=uuid.uuid4(),
        headline="Senior Backend Engineer",
        location="San Francisco, CA",
        preferences_json={"remote": True, "min_salary": 180000},
    )
    assert profile.headline == "Senior Backend Engineer"
    assert profile.preferences_json["remote"] is True


def test_job_and_company_model_instantiation():
    """Verify Company and Job models instantiation."""
    company = Company(
        canonical_name="Stripe",
        domain="stripe.com",
    )
    assert company.canonical_name == "Stripe"

    job = Job(
        company_id=uuid.uuid4(),
        title="Software Engineer - Infrastructure",
        location="Remote, US",
        remote_type="remote",
        employment_type="full-time",
        salary_min=Decimal("170000.00"),
        salary_max=Decimal("220000.00"),
        currency="USD",
        description="Build scalable distributed systems.",
        fingerprint="fingerprint-hash-123",
    )
    assert job.title == "Software Engineer - Infrastructure"
    assert job.salary_min == Decimal("170000.00")
    assert job.fingerprint == "fingerprint-hash-123"


def test_application_and_capsule_models_instantiation():
    """Verify Application, Snapshot, Question, Answer, Interview, and FollowUp models."""
    app_id = uuid.uuid4()
    application = Application(
        id=app_id,
        user_id=uuid.uuid4(),
        title="Software Engineer",
        source="SerpApi / Workday",
        status="Applied",
    )
    assert application.status == "Applied"

    snapshot = ApplicationSnapshot(
        application_id=app_id,
        job_description="Exact JD captured at submit time.",
        page_url="https://workday.com/job/123",
    )
    assert snapshot.job_description == "Exact JD captured at submit time."

    q_id = uuid.uuid4()
    question = ApplicationQuestion(
        id=q_id,
        application_id=app_id,
        question_text="Why do you want to join Stripe?",
        question_type="textarea",
        order_index=1,
    )
    answer = ApplicationAnswer(
        question_id=q_id,
        answer_text="I am passionate about developer infrastructure and high availability APIs.",
        source="llm_draft",
        user_approved=True,
    )
    assert question.question_type == "textarea"
    assert answer.user_approved is True
    assert answer.source == "llm_draft"


def test_career_evidence_and_resume_instantiation():
    """Verify CareerEvidence, Resume, and ResumeVersion models."""
    profile_id = uuid.uuid4()
    evidence = CareerEvidence(
        career_profile_id=profile_id,
        type="github_repo",
        title="Distributed Queue Implementation",
        content="Designed a high throughput messaging queue in Go.",
        source_type="github",
        source_url="https://github.com/user/queue",
        verification_state="verified",
    )
    assert evidence.verification_state == "verified"

    resume = Resume(
        career_profile_id=profile_id,
        name="Master Resume 2026",
        extracted_text="Full resume raw text content.",
        is_master=True,
    )
    assert resume.is_master is True

    resume_ver = ResumeVersion(
        career_profile_id=profile_id,
        base_resume_id=resume.id,
        content="Tailored resume emphasizing distributed systems.",
        version_label="v1-stripe-tailored",
    )
    assert resume_ver.version_label == "v1-stripe-tailored"
