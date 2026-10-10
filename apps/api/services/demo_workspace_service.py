import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from apps.api.db.models import (
    Application,
    ApplicationAnswer,
    ApplicationDocument,
    ApplicationQuestion,
    ApplicationSnapshot,
    CareerEvidence,
    CareerExperience,
    CareerProfile,
    CareerProfileSkill,
    CoverLetter,
    FollowUp,
    Job,
    Resume,
    ResumeVersion,
    Skill,
    User,
)
from apps.api.services.job_service import JobService
from apps.api.services.match_engine import MatchEngine

# Canonical Seeded Candidate Data Grounded Strictly in Shubham_SE.pdf
DEMO_CANDIDATE_EMAIL = "shubhamranswal@gmail.com"
DEMO_CANDIDATE_NAME = "Shubham Singh Ranswal"
DEMO_CANDIDATE_PHONE = "+91 9560793525"
DEMO_CANDIDATE_LOCATION = "Noida, Uttar Pradesh"
DEMO_CANDIDATE_HEADLINE = (
    "Software Engineer II - Secure Systems, Cryptography, HSM, Backend & AI Tooling"
)
DEMO_CANDIDATE_SUMMARY = (
    "Software Engineer II specializing in secure systems, cryptography, hardware security modules "
    "(HSM), backend architecture, and AI-driven developer tooling. Proven track record engineering "
    "payment workflows on Thales payShield 10K, building high-performance Golang automation utilities, "
    "designing FastAPI backend services, and developing agentic/offline LLM platforms."
)

DEMO_MASTER_RESUME_TEXT = """SHUBHAM SINGH RANSWAL
Software Engineer II - Secure Systems, Cryptography, HSM, Backend & AI Tooling
+91 9560793525 | Noida, Uttar Pradesh | shubhamranswal@gmail.com
linkedin.com/in/shubhamranswal | github.com/shubhamranswal | Portfolio

EXPERIENCE
Software Engineer II Nov 2024 - Present
Thales Noida, India
Promoted from Software Engineer I
• Engineered and customized secure payment workflows on Thales payShield 10K HSM, including RSA-protected TR-31 key blocks and Multi-LMK implementations aligned with PKCS and ISO/ANSI cryptographic standards
• Engineered a Golang-based MultiLMK automation utility reducing HSM configuration and firmware validation time by 50% through multi-threaded execution, automated validation and stress-testing workflows
• Designed FastAPI backend tooling and developed LogChat, an offline-first AI log investigation platform using local LLMs and agentic workflows, ensuring sensitive logs remain entirely within secure environments
• Integrated Thales Advanced Bot Protection (ABP) SDK with Kotlin, Flutter, and React Native applications to secure mobile API interactions against bot and automation-based abuse

Trainee (Software) Aug 2024 - Oct 2024
Uttarakhand Space Application Centre Dehradun, India
• Built a multi-module renewable energy mapping system integrating geospatial visualization, project dashboards, and automated data pipelines covering 800+ assets across the state
• Developed an AI-powered chatbot using Gemini API for querying power-plant metadata and generating insights from structured datasets with Google Static Maps integration

PROJECTS
KeyVault Lite | Python, FastAPI, SQLite GitHub
• Developed a lightweight Key Management Service (KMS) inspired by real-world HSM and cloud KMS workflows
• Implemented envelope encryption, RBAC-based access control, key versioning, and tamper-evident audit logging
• Designed security-first backend workflows emphasizing trust boundaries, auditability, and cryptographic key lifecycle management

DevLens | Golang, CLI Tooling GitHub
• Built a CLI tool to quickly analyze and understand unfamiliar codebases through structured repository inspection
• Implemented heuristic-based framework detection, project classification, and entry-point analysis workflows
• Added support for local and remote GitHub repo analysis with optional JSON output for structured reporting

SKILLS
Languages: Golang, Python, C++, SQL, Dart, Kotlin
Security & Cryptography: Thales payShield 10K HSM, AES, DES/3DES, RSA, TR31, PKCS
Backend & Systems: FastAPI, REST APIs, CI/CD, System Integration, Linux
AI & Intelligent Tooling: Generative AI, Agentic AI, Local LLM Workflows, AI-driven Developer Tooling
Mobile & SDK Integration: Flutter, React Native, Firebase, ABP SDK
Tools & Platforms: Git, Bitbucket, Bamboo, Jira, Confluence, Google Cloud Platform
Product Certifications: CipherTrust Data Security Platform (CDSP), DSF - Agent Gateway

EDUCATION
B.Tech. in Computer Science & Engineering Aug 2020 – Jul 2024
Bipin Tripathi Kumaon Institute of Technology, Dwarahat Aggregate: 73.57%"""

# Seeded Demo Job Specifications
DEMO_JOBS_SPEC = [
    {
        "external_id": "DEMO-JOB-GO-01",
        "title": "Senior Go Backend Engineer",
        "company_name": "CloudScale Infrastructure (Demo)",
        "company_domain": "cloudscale-demo.internal",
        "location": "Remote",
        "remote_type": "remote",
        "employment_type": "full_time",
        "salary_min": 165000,
        "salary_max": 195000,
        "currency": "USD",
        "description": (
            "CloudScale Infrastructure is seeking a Senior Go Backend Engineer to lead high-concurrency "
            "platform services. You will design multi-threaded automation utilities, optimize backend API "
            "runtimes, and implement automated validation pipelines. Strong proficiency with Golang, REST APIs, "
            "distributed systems, and Linux performance tuning required."
        ),
        "requirements": [
            "golang",
            "concurrency",
            "distributed systems",
            "rest apis",
            "ci/cd",
            "linux",
        ],
        "initial_status": "Saved",
    },
    {
        "external_id": "DEMO-JOB-SEC-02",
        "title": "Security & Cryptography Engineer",
        "company_name": "Apex Cryptosystems (Demo)",
        "company_domain": "apex-crypto-demo.internal",
        "location": "Noida, India (Hybrid)",
        "remote_type": "hybrid",
        "employment_type": "full_time",
        "salary_min": 2800000,
        "salary_max": 3600000,
        "currency": "INR",
        "description": (
            "Apex Cryptosystems builds high-assurance cryptographic payment gateways. We are hiring a "
            "Security & Cryptography Engineer to implement hardware security module (HSM) workflows, "
            "manage TR-31 key blocks, and enforce PKCS / ISO/ANSI cryptographic standards across payment "
            "switches."
        ),
        "requirements": [
            "thales payshield 10k hsm",
            "cryptography",
            "rsa",
            "tr31",
            "pkcs",
            "aes",
            "fastapi",
            "linux",
        ],
        "initial_status": "Offer",
    },
    {
        "external_id": "DEMO-JOB-AI-03",
        "title": "AI Infrastructure & Developer Tooling Engineer",
        "company_name": "Aegis AI Tooling (Demo)",
        "company_domain": "aegis-ai-demo.internal",
        "location": "San Francisco, CA (Remote)",
        "remote_type": "remote",
        "employment_type": "full_time",
        "salary_min": 170000,
        "salary_max": 210000,
        "currency": "USD",
        "description": (
            "Aegis AI Tooling is engineering privacy-first developer platforms. We are seeking a backend engineer "
            "to build offline-first AI log investigation tools using local LLMs and agentic workflows. "
            "Experience with FastAPI, Python backends, and structured repository inspection tools is required."
        ),
        "requirements": [
            "python",
            "fastapi",
            "generative ai",
            "agentic ai",
            "local llm workflows",
            "sqlite",
            "git",
        ],
        "initial_status": "Interviewing",
    },
    {
        "external_id": "DEMO-JOB-SYS-04",
        "title": "Platform & Mobile Security Engineer",
        "company_name": "Sentinel Security Labs (Demo)",
        "company_domain": "sentinel-labs-demo.internal",
        "location": "Bengaluru, India",
        "remote_type": "onsite",
        "employment_type": "full_time",
        "salary_min": 2400000,
        "salary_max": 3200000,
        "currency": "INR",
        "description": (
            "Sentinel Security Labs provides advanced mobile application protection. We are seeking an engineer "
            "to integrate Advanced Bot Protection (ABP) SDKs across mobile clients (Flutter, React Native, Kotlin) "
            "and defend backend REST APIs from credential stuffing and automated abuse."
        ),
        "requirements": [
            "abp sdk",
            "flutter",
            "react native",
            "kotlin",
            "rest apis",
            "security",
        ],
        "initial_status": "Applied",
    },
    {
        "external_id": "DEMO-JOB-LEG-05",
        "title": "Legacy Systems Architect",
        "company_name": "FinTech Legacy Partners (Demo)",
        "company_domain": "fintech-legacy-demo.internal",
        "location": "London, UK (Remote)",
        "remote_type": "remote",
        "employment_type": "full_time",
        "salary_min": 90000,
        "salary_max": 110000,
        "currency": "GBP",
        "description": (
            "Maintenance and incremental refactoring of legacy monolithic C++ payment routing engines "
            "and database backends."
        ),
        "requirements": ["c++", "monolith", "legacy systems", "sql"],
        "initial_status": "Rejected",
    },
]


class DemoWorkspaceService:
    """Ensures deterministic, idempotent first-run demo workspace grounded in Shubham Singh Ranswal's resume."""

    @classmethod
    def ensure_demo_workspace(cls, db: Session) -> CareerProfile:
        """Idempotently initializes candidate profile, master resume, verified evidence,

        demo job catalog, and historical application capsules.
        """
        # 1. Ensure User & Profile
        user = db.scalar(select(User).where(User.email == DEMO_CANDIDATE_EMAIL))
        if not user:
            # Check if an existing generic user exists (e.g. from previous run), update or create
            generic_user = db.scalar(select(User).where(User.email == "alex.chen@example.com"))
            if generic_user:
                generic_user.email = DEMO_CANDIDATE_EMAIL
                user = generic_user
            else:
                user = User(email=DEMO_CANDIDATE_EMAIL)
                db.add(user)
                db.flush()

        profile = db.scalar(
            select(CareerProfile)
            .where(CareerProfile.user_id == user.id)
            .options(
                joinedload(CareerProfile.experiences),
                joinedload(CareerProfile.skills).joinedload(CareerProfileSkill.skill),
                joinedload(CareerProfile.evidence),
                joinedload(CareerProfile.resumes),
            )
        )
        if not profile:
            profile = CareerProfile(
                user_id=user.id,
                headline=DEMO_CANDIDATE_HEADLINE,
                summary=DEMO_CANDIDATE_SUMMARY,
                location=DEMO_CANDIDATE_LOCATION,
                preferences_json={
                    "full_name": DEMO_CANDIDATE_NAME,
                    "email": DEMO_CANDIDATE_EMAIL,
                    "phone": DEMO_CANDIDATE_PHONE,
                    "linkedin": "https://linkedin.com/in/shubhamranswal",
                    "github": "https://github.com/shubhamranswal",
                    "remote": True,
                    "is_demo": True,
                    "workspace_name": "Demo Workspace",
                    "preferred_roles": [
                        "Software Engineer II",
                        "Senior Backend Engineer",
                        "Security & Cryptography Engineer",
                        "Go Backend Engineer",
                        "AI Infrastructure Engineer",
                    ],
                },
            )
            db.add(profile)
            db.flush()
        else:
            # Update headline, summary, preferences to guarantee Shubham's authoritative data
            profile.headline = DEMO_CANDIDATE_HEADLINE
            profile.summary = DEMO_CANDIDATE_SUMMARY
            profile.location = DEMO_CANDIDATE_LOCATION
            current_prefs = dict(profile.preferences_json or {})
            current_prefs.update(
                {
                    "full_name": DEMO_CANDIDATE_NAME,
                    "email": DEMO_CANDIDATE_EMAIL,
                    "phone": DEMO_CANDIDATE_PHONE,
                    "linkedin": "https://linkedin.com/in/shubhamranswal",
                    "github": "https://github.com/shubhamranswal",
                    "is_demo": True,
                    "workspace_name": "Demo Workspace",
                }
            )
            profile.preferences_json = current_prefs
            db.flush()

        # 2. Ensure Master Resume
        master_resume = db.scalar(
            select(Resume).where(Resume.career_profile_id == profile.id, Resume.is_master.is_(True))
        )
        if not master_resume:
            master_resume = Resume(
                career_profile_id=profile.id,
                name=f"{DEMO_CANDIDATE_NAME} - Master Technical Resume",
                extracted_text=DEMO_MASTER_RESUME_TEXT,
                is_master=True,
                version=1,
            )
            db.add(master_resume)
        else:
            master_resume.name = f"{DEMO_CANDIDATE_NAME} - Master Technical Resume"
            master_resume.extracted_text = DEMO_MASTER_RESUME_TEXT

        # 3. Ensure Verified Career Experiences
        cls._ensure_experiences(db, profile.id)

        # 4. Ensure Verified Skills
        cls._ensure_skills(db, profile.id)

        # 5. Ensure Verified Career Evidence
        cls._ensure_evidence(db, profile.id)

        db.commit()
        db.refresh(profile)

        # 6. Ensure Demo Jobs Catalog
        created_jobs = cls._ensure_demo_jobs(db)

        # 7. Ensure Historical Demo Applications & Application Capsules
        cls._ensure_demo_applications(db, profile, created_jobs)

        db.commit()
        return profile

    @classmethod
    def _ensure_experiences(cls, db: Session, profile_id: uuid.UUID) -> None:
        experiences_data = [
            {
                "org": "Thales",
                "title": "Software Engineer II",
                "start": date(2024, 11, 1),
                "end": None,
                "desc": (
                    "Promoted from Software Engineer I. Engineered and customized secure payment workflows "
                    "on Thales payShield 10K HSM, including RSA-protected TR-31 key blocks and Multi-LMK "
                    "implementations aligned with PKCS and ISO/ANSI cryptographic standards. Engineered a Golang-based "
                    "MultiLMK automation utility reducing HSM configuration and firmware validation time by 50% "
                    "through multi-threaded execution, automated validation and stress-testing workflows. Designed "
                    "FastAPI backend tooling and developed LogChat, an offline-first AI log investigation platform "
                    "using local LLMs and agentic workflows, ensuring sensitive logs remain entirely within secure "
                    "environments. Integrated Thales Advanced Bot Protection (ABP) SDK with Kotlin, Flutter, and React "
                    "Native applications to secure mobile API interactions against bot and automation-based abuse."
                ),
            },
            {
                "org": "Uttarakhand Space Application Centre",
                "title": "Trainee (Software)",
                "start": date(2024, 8, 1),
                "end": date(2024, 10, 31),
                "desc": (
                    "Built a multi-module renewable energy mapping system integrating geospatial visualization, "
                    "project dashboards, and automated data pipelines covering 800+ assets across the state. "
                    "Developed an AI-powered chatbot using Gemini API for querying power-plant metadata and "
                    "generating insights from structured datasets with Google Static Maps integration."
                ),
            },
        ]

        existing_exps = {
            (exp.organization, exp.title): exp
            for exp in db.scalars(
                select(CareerExperience).where(CareerExperience.career_profile_id == profile_id)
            )
        }

        for exp_info in experiences_data:
            key = (exp_info["org"], exp_info["title"])
            if key not in existing_exps:
                new_exp = CareerExperience(
                    career_profile_id=profile_id,
                    organization=exp_info["org"],
                    title=exp_info["title"],
                    start_date=exp_info["start"],
                    end_date=exp_info["end"],
                    description=exp_info["desc"],
                    evidence_status="verified",
                )
                db.add(new_exp)
            else:
                existing_exps[key].description = exp_info["desc"]
                existing_exps[key].evidence_status = "verified"

    @classmethod
    def _ensure_skills(cls, db: Session, profile_id: uuid.UUID) -> None:
        raw_skills = [
            "golang",
            "python",
            "c++",
            "sql",
            "dart",
            "kotlin",
            "thales payshield 10k hsm",
            "cryptography",
            "rsa",
            "tr31",
            "pkcs",
            "aes",
            "fastapi",
            "rest apis",
            "ci/cd",
            "linux",
            "generative ai",
            "agentic ai",
            "local llm workflows",
            "flutter",
            "react native",
            "firebase",
            "abp sdk",
            "git",
            "bitbucket",
            "bamboo",
            "jira",
            "confluence",
            "google cloud platform",
            "ciphertrust data security platform (cdsp)",
            "dsf - agent gateway",
        ]

        existing_skills = {
            cps.skill.normalized_name: cps
            for cps in db.scalars(
                select(CareerProfileSkill)
                .where(CareerProfileSkill.career_profile_id == profile_id)
                .options(joinedload(CareerProfileSkill.skill))
            )
            if cps.skill
        }

        for sk_name in raw_skills:
            if sk_name not in existing_skills:
                skill = db.scalar(select(Skill).where(Skill.normalized_name == sk_name))
                if not skill:
                    skill = Skill(normalized_name=sk_name)
                    db.add(skill)
                    db.flush()
                cps = CareerProfileSkill(
                    career_profile_id=profile_id,
                    skill_id=skill.id,
                    proficiency="advanced",
                    metadata_json={"source": "resume_verified", "candidate": DEMO_CANDIDATE_NAME},
                )
                db.add(cps)

    @classmethod
    def _ensure_evidence(cls, db: Session, profile_id: uuid.UUID) -> None:
        evidence_items = [
            {
                "type": "github_repo",
                "title": "KeyVault Lite",
                "content": (
                    "Lightweight Key Management Service (KMS) in Python, FastAPI, and SQLite inspired by "
                    "real-world HSM and cloud KMS workflows. Implemented envelope encryption, RBAC-based access control, "
                    "key versioning, and tamper-evident audit logging."
                ),
                "source_type": "github",
                "source_url": "https://github.com/shubhamranswal/keyvault-lite",
            },
            {
                "type": "github_repo",
                "title": "DevLens",
                "content": (
                    "Golang CLI tool to analyze codebases through structured repository inspection. "
                    "Implemented heuristic-based framework detection, project classification, and entry-point analysis "
                    "with structured JSON reporting."
                ),
                "source_type": "github",
                "source_url": "https://github.com/shubhamranswal/devlens",
            },
            {
                "type": "enterprise_project",
                "title": "Thales payShield 10K MultiLMK Automation Utility",
                "content": (
                    "Golang automation utility reducing HSM configuration and firmware validation time by 50% "
                    "through multi-threaded execution, automated validation, and TR-31/PKCS stress-testing workflows."
                ),
                "source_type": "work_project",
                "source_url": "https://github.com/shubhamranswal",
            },
            {
                "type": "ai_platform",
                "title": "LogChat Offline AI Log Investigation Platform",
                "content": (
                    "Designed FastAPI backend tooling and developed LogChat, an offline-first AI log investigation "
                    "platform using local LLMs and agentic workflows, keeping sensitive logs within secure environments."
                ),
                "source_type": "work_project",
                "source_url": "https://github.com/shubhamranswal",
            },
            {
                "type": "certification",
                "title": "CipherTrust Data Security Platform (CDSP)",
                "content": (
                    "Professional product certification in enterprise data security, tokenization, key management, "
                    "and cryptographic lifecycle governance."
                ),
                "source_type": "certification",
                "source_url": None,
            },
            {
                "type": "certification",
                "title": "DSF - Agent Gateway",
                "content": (
                    "Product certification in Data Security Fabric agent gateway integration, activity monitoring, "
                    "and policy enforcement."
                ),
                "source_type": "certification",
                "source_url": None,
            },
        ]

        existing_evidence = {
            ev.title: ev
            for ev in db.scalars(
                select(CareerEvidence).where(CareerEvidence.career_profile_id == profile_id)
            )
        }

        for ev in evidence_items:
            if ev["title"] not in existing_evidence:
                new_ev = CareerEvidence(
                    career_profile_id=profile_id,
                    type=ev["type"],
                    title=ev["title"],
                    content=ev["content"],
                    source_type=ev["source_type"],
                    source_url=ev["source_url"],
                    verification_state="verified",
                    metadata_json={"grounded": True, "candidate": DEMO_CANDIDATE_NAME},
                )
                db.add(new_ev)

    @classmethod
    def _ensure_demo_jobs(cls, db: Session) -> dict[str, Job]:
        jobs_by_ext_id: dict[str, Job] = {}

        for spec in DEMO_JOBS_SPEC:
            ext_id = spec["external_id"]
            existing = db.scalar(
                select(Job).where(Job.external_id == ext_id).options(joinedload(Job.company))
            )
            if existing:
                jobs_by_ext_id[ext_id] = existing
                continue

            # Create Company
            company = JobService.get_or_create_company(
                db, spec["company_name"], spec["company_domain"]
            )
            fingerprint = f"demo:{ext_id.lower()}:{spec['company_domain']}"

            job = Job(
                company_id=company.id,
                title=spec["title"],
                location=spec["location"],
                remote_type=spec["remote_type"],
                employment_type=spec["employment_type"],
                salary_min=spec["salary_min"],
                salary_max=spec["salary_max"],
                currency=spec["currency"],
                description=spec["description"],
                normalized_requirements_json=spec["requirements"],
                source_urls_json=[f"https://{spec['company_domain']}/careers/{ext_id}"],
                source_names_json=["Demo Fixture"],
                canonical_url=f"https://{spec['company_domain']}/careers/{ext_id}",
                external_id=ext_id,
                fingerprint=fingerprint,
                metadata_json={
                    "is_demo": True,
                    "fixture_tag": "DEMO FIXTURE",
                    "provenance": "demo_catalog",
                    "skills": spec["requirements"],
                },
            )
            db.add(job)
            db.flush()
            jobs_by_ext_id[ext_id] = job

        return jobs_by_ext_id

    @classmethod
    def _ensure_demo_applications(
        cls, db: Session, profile: CareerProfile, jobs: dict[str, Job]
    ) -> None:
        """Seed representative historical Application Capsules for demo jobs."""
        now = datetime.now(UTC)

        # 1. Apex Cryptosystems (DEMO-JOB-SEC-02) -> STATUS: Offer
        cls._ensure_single_capsule(
            db=db,
            user_id=profile.user_id,
            profile_id=profile.id,
            job=jobs.get("DEMO-JOB-SEC-02"),
            status="Offer",
            applied_at=now - timedelta(days=21),
            source="Workday",
            notes="Full candidate loop completed. Received official written offer.",
            tailored_resume_summary=(
                "Specialized Cryptography & HSM Engineer with verified production experience on "
                "Thales payShield 10K, TR-31 key blocks, and PKCS compliance."
            ),
            cover_letter_content=(
                "Dear Apex Cryptosystems Hiring Team,\n\n"
                "I am excited to apply for the Security & Cryptography Engineer position. "
                "In my current role at Thales, I engineer and customize payment workflows on Thales "
                "payShield 10K HSM, including RSA-protected TR-31 key blocks and Multi-LMK automations "
                "in Golang that cut validation time by 50%. My hands-on work with KeyVault Lite reinforces "
                "my commitment to envelope encryption and strict cryptographic trust boundaries.\n\n"
                "I look forward to contributing to Apex Cryptosystems' mission.\n\n"
                f"Sincerely,\n{DEMO_CANDIDATE_NAME}"
            ),
            questions=[
                {
                    "text": "Describe your experience with hardware security modules (HSM) and key management standards.",
                    "type": "textarea",
                    "ans": (
                        "Engineered payment workflows on Thales payShield 10K HSM with RSA-protected TR-31 key "
                        "blocks and Multi-LMK implementations conforming to PKCS and ISO/ANSI standards. Also authored "
                        "KeyVault Lite implementing envelope encryption and key lifecycle governance."
                    ),
                    "source": "llm_draft",
                },
                {
                    "text": "Are you legally authorized to work in India without sponsorship?",
                    "type": "select",
                    "ans": "Yes, authorized without sponsorship.",
                    "source": "autofill",
                },
            ],
            interview_stage="Final Offer Review",
            followup_due=now + timedelta(days=3),
            followup_notes="Review compensation details and sign formal offer acceptance letter.",
        )

        # 2. Aegis AI Tooling (DEMO-JOB-AI-03) -> STATUS: Interviewing
        cls._ensure_single_capsule(
            db=db,
            user_id=profile.user_id,
            profile_id=profile.id,
            job=jobs.get("DEMO-JOB-AI-03"),
            status="Interviewing",
            applied_at=now - timedelta(days=9),
            source="Greenhouse",
            notes="Passed initial phone screen. Technical architecture round scheduled.",
            tailored_resume_summary=(
                "AI Infrastructure & Tooling Engineer specializing in FastAPI backends, local LLM agentic "
                "workflows (LogChat), and Go CLI analysis tooling (DevLens)."
            ),
            cover_letter_content=(
                "Dear Aegis AI Tooling Team,\n\n"
                "I am writing to express my interest in the AI Infrastructure & Developer Tooling Engineer role. "
                "I designed FastAPI backend tooling and created LogChat—an offline-first AI log investigation platform "
                "using local LLMs and agentic workflows that keeps sensitive infrastructure logs securely bounded. "
                "Additionally, I built DevLens in Go for automated repo inspection.\n\n"
                f"Best regards,\n{DEMO_CANDIDATE_NAME}"
            ),
            questions=[
                {
                    "text": "How do you ensure data confidentiality when deploying LLM agentic workflows?",
                    "type": "textarea",
                    "ans": (
                        "In LogChat, I engineered an offline-first execution environment relying on local LLMs and "
                        "strict network egress controls, guaranteeing that raw application logs and sensitive credentials "
                        "never leave internal security boundaries."
                    ),
                    "source": "llm_draft",
                }
            ],
            interview_stage="Technical Architecture Screen",
            followup_due=now + timedelta(days=2),
            followup_notes="Prepare architecture walkthrough on LogChat local LLM orchestration and DevLens AST parsing.",
        )

        # 3. Sentinel Security Labs (DEMO-JOB-SYS-04) -> STATUS: Applied
        cls._ensure_single_capsule(
            db=db,
            user_id=profile.user_id,
            profile_id=profile.id,
            job=jobs.get("DEMO-JOB-SYS-04"),
            status="Applied",
            applied_at=now - timedelta(days=4),
            source="Workday",
            notes="Submitted via Workday candidate portal with verified ABP SDK integration evidence.",
            tailored_resume_summary=(
                "Platform & Mobile Security Engineer with direct experience integrating Thales Advanced Bot Protection "
                "(ABP) SDK into Kotlin, Flutter, and React Native mobile applications."
            ),
            cover_letter_content=(
                "Dear Sentinel Security Labs Team,\n\n"
                "I am eager to apply for the Platform & Mobile Security Engineer role. At Thales, I successfully "
                "integrated our Advanced Bot Protection (ABP) SDK with Kotlin, Flutter, and React Native applications "
                "to defend mobile API backends against bot and automation abuse.\n\n"
                f"Sincerely,\n{DEMO_CANDIDATE_NAME}"
            ),
            questions=[
                {
                    "text": "What mobile platforms have you integrated security SDKs with?",
                    "type": "textarea",
                    "ans": (
                        "Integrated Thales Advanced Bot Protection (ABP) SDK across Kotlin, Flutter, and React Native "
                        "production applications to secure API exchanges against bot abuse."
                    ),
                    "source": "llm_draft",
                }
            ],
            interview_stage="Recruiter Screen",
            followup_due=now + timedelta(days=5),
            followup_notes="Follow up with talent acquisition on status of application review.",
        )

        # 4. FinTech Legacy Partners (DEMO-JOB-LEG-05) -> STATUS: Rejected
        cls._ensure_single_capsule(
            db=db,
            user_id=profile.user_id,
            profile_id=profile.id,
            job=jobs.get("DEMO-JOB-LEG-05"),
            status="Rejected",
            applied_at=now - timedelta(days=45),
            source="Generic ATS",
            notes="Position closed; team prioritized legacy C++ mainframe experience.",
            tailored_resume_summary="Systems Engineer with C++ fundamentals and Linux background.",
            cover_letter_content=None,
            questions=[],
            interview_stage=None,
            followup_due=None,
            followup_notes=None,
        )

        # 5. CloudScale Infrastructure (DEMO-JOB-GO-01) -> STATUS: Saved (Interactive for user!)
        cls._ensure_single_capsule(
            db=db,
            user_id=profile.user_id,
            profile_id=profile.id,
            job=jobs.get("DEMO-JOB-GO-01"),
            status="Saved",
            applied_at=None,
            source="Demo Catalog",
            notes="Saved demo job. Ready to be tailored and submitted through controlled application workflow.",
            tailored_resume_summary=None,
            cover_letter_content=None,
            questions=[],
            interview_stage=None,
            followup_due=None,
            followup_notes=None,
        )

    @classmethod
    def _ensure_single_capsule(
        cls,
        db: Session,
        user_id: uuid.UUID,
        profile_id: uuid.UUID,
        job: Job | None,
        status: str,
        applied_at: datetime | None,
        source: str,
        notes: str,
        tailored_resume_summary: str | None,
        cover_letter_content: str | None,
        questions: list[dict[str, str]],
        interview_stage: str | None,
        followup_due: datetime | None,
        followup_notes: str | None,
    ) -> None:
        if not job:
            return

        app = db.scalar(
            select(Application)
            .where(Application.user_id == user_id, Application.job_id == job.id)
            .options(
                joinedload(Application.snapshots),
                joinedload(Application.documents),
                joinedload(Application.questions).joinedload(ApplicationQuestion.answers),
                joinedload(Application.interviews),
                joinedload(Application.follow_ups),
            )
        )

        now = datetime.now(UTC)

        if not app:
            app = Application(
                user_id=user_id,
                job_id=job.id,
                company_id=job.company_id,
                title=job.title,
                source=source,
                application_url=job.canonical_url,
                status=status,
                applied_at=applied_at,
                captured_at=now,
                notes=notes,
                metadata_json={
                    "is_demo": True,
                    "fixture_tag": "DEMO APPLICATION",
                    "provenance": "demo_workspace",
                },
            )
            db.add(app)
            db.flush()

        # Calculate explainable match
        MatchEngine.evaluate_match(db, job.id, profile_id)

        # 1. Snapshot
        if not app.snapshots:
            snap = ApplicationSnapshot(
                application_id=app.id,
                job_description=job.description,
                page_title=f"{job.title} - {job.company.canonical_name if job.company else 'Demo'}",
                page_url=job.canonical_url,
                extraction_metadata_json={
                    "role_title": job.title,
                    "company": job.company.canonical_name if job.company else "Demo",
                    "location": job.location,
                    "is_demo": True,
                    "source": source,
                },
            )
            db.add(snap)

        # 2. Documents
        if tailored_resume_summary and not any(d.document_type == "resume" for d in app.documents):
            tailored_content = (
                f"{DEMO_MASTER_RESUME_TEXT}\n\n"
                f"--- TAILORED HIGHLIGHTS FOR {job.title.upper()} ---\n"
                f"• {tailored_resume_summary}\n"
                f"• Grounded in verified evidence from Thales, KeyVault Lite, DevLens, and CDSP."
            )
            rv = ResumeVersion(
                career_profile_id=profile_id,
                job_id=job.id,
                version_label=f"Tailored for {job.title} at {job.company.canonical_name if job.company else 'Demo'}",
                content=tailored_content,
                generation_metadata_json={"is_demo": True, "evidence_count": 4},
            )
            db.add(rv)
            db.flush()

            doc_r = ApplicationDocument(
                application_id=app.id,
                document_type="resume",
                document_id=rv.id,
                version_label=rv.version_label,
            )
            db.add(doc_r)

        if cover_letter_content and not any(
            d.document_type == "cover_letter" for d in app.documents
        ):
            cl = CoverLetter(
                career_profile_id=profile_id,
                job_id=job.id,
                content=cover_letter_content,
                version=1,
            )
            db.add(cl)
            db.flush()

            doc_c = ApplicationDocument(
                application_id=app.id,
                document_type="cover_letter",
                document_id=cl.id,
                version_label=f"Cover Letter v1 ({job.title})",
            )
            db.add(doc_c)

        # 3. Questions
        if questions and not app.questions:
            for idx, q_data in enumerate(questions):
                aq = ApplicationQuestion(
                    application_id=app.id,
                    question_text=q_data["text"],
                    question_type=q_data.get("type", "textarea"),
                    order_index=idx + 1,
                )
                db.add(aq)
                db.flush()

                ans = ApplicationAnswer(
                    question_id=aq.id,
                    answer_text=q_data["ans"],
                    source=q_data.get("source", "llm_draft"),
                    user_approved=True,
                )
                db.add(ans)

        # 4. Interview Prep
        if interview_stage and not app.interviews:
            from apps.api.services.application_service import ApplicationService

            ApplicationService.prepare_interview(db, app.id, stage=interview_stage)

        # 5. Follow-ups
        if followup_due and not app.follow_ups:
            fu = FollowUp(
                application_id=app.id,
                type="offer_deadline" if status == "Offer" else "recruiter_checkin",
                due_at=followup_due,
                notes=followup_notes,
            )
            db.add(fu)
