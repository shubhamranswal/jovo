<div align="center">

<img src="assets/brand/jovo-logo-128.png" alt="Jovo Logo" width="100" height="100" />

# Jovo

### Apply smarter. Get hired faster.

_The open-source job application operating system with persistent memory._

[![Tests Passing](<https://img.shields.io/badge/Tests-48%20Passed%20(100%25)-success?style=for-the-badge&logo=pytest&logoColor=white>)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](package.json)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](apps/api)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](pyproject.toml)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js&logoColor=white)](apps/web)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](apps/web)
[![Chrome MV3](https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](apps/extension)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](infra/docker)
[![SerpApi](https://img.shields.io/badge/Discovery-SerpApi_Official-008080?style=flat-square&logo=google&logoColor=white)](apps/api/integrations/serpapi)
[![Gemini AI](https://img.shields.io/badge/AI_Engine-Gemini_2.5_Flash-8E75C2?style=flat-square&logo=googlegemini&logoColor=white)](packages/prompts)
[![Code Style](https://img.shields.io/badge/Code_Style-Ruff_%7C_Prettier-000000?style=flat-square)](eslint.config.mjs)

<p align="center">
  <a href="#what-is-jovo">Overview</a> •
  <a href="#key-features">Features</a> •
  <a href="#the-wait-it-did-what-moment">The MVP Moment</a> •
  <a href="#application-capsule">Application Capsule</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Quick Start</a> •
  <a href="#browser-extension">Extension</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#security--privacy">Security</a>
</p>

</div>

---

## What is Jovo?

**Jovo** is a job search operating system that connects the entire job hunting lifecycle into a unified, evidence-grounded loop: **Discover → Understand → Tailor → Apply → Remember → Prepare → Follow Up**.

Unlike job boards that end when you click "Apply" or autofill scripts that forget what they just pasted into a form, Jovo remembers the complete, immutable context of every application you submit—freezing the exact job description, tailored resume, cover letter, and approved form answers inside a permanent **Application Capsule**.

---

## The Problem

Today's job search experience is deeply fragmented:

1. **Context Amnesia**: You apply to dozens of jobs across different ATS portals (Workday, Greenhouse, Lever). Weeks later, a recruiter emails you for an interview. The job posting is taken down, and you have no idea which resume version you sent or how you answered their custom screening questions.
2. **AI Fabrication & Hallucination**: Generic AI tools invent fake skills, exaggerated metrics, or unbacked experiences on your resume, which quickly unravel during technical screens.
3. **Disconnected Autofill**: Browser extensions mechanically blast random data into form fields without respecting security boundaries, understanding career context, or recording what was actually submitted.

---

## The Idea

> **Apply smarter. Get hired faster. Remember everything.**

Jovo turns every job application into a durable historical record. By combining **SerpApi Google Jobs live discovery**, **explainable evidence-grounded tailoring**, a **conservative Manifest V3 browser extension**, and an **Application Capsule**, Jovo guarantees that you enter every interview with exact recall of what you promised.

---

## The "Wait... it did WHAT?" Moment

Imagine applying for a Senior Platform Engineer role on a company's Workday portal:

1. The Jovo Chrome Extension detects the portal, extracts the role, and links it to your discovered job.
2. It autofills verified personal info while skipping password and sensitive fields.
3. It detects a tricky prompt: _"Describe a high-severity production outage you mitigated."_
4. It drafts an answer backed strictly by your verified GitHub incident evidence. You review, edit, and approve it before insertion.
5. You manually click submit.
6. **Three weeks later**, the recruiter invites you to a technical screen. The job posting has been deleted from the web.
7. You open your Jovo Application Capsule:
   - The **exact frozen job description** is right there.
   - The **exact tailored resume and cover letter** versions are intact.
   - The **exact answers you submitted** to their screening questions are recorded.
   - Jovo automatically generates **grounded interview preparation**, quizzing you on the specific claims you made and flagging areas where the job asked for skills you lack evidence for.

---

## How It Works

```text
       1. DISCOVER
(SerpApi Google Jobs)
         ↓
      2. UNDERSTAND
(Explainable match & gap analysis)
         ↓
       3. TAILOR
(Evidence-grounded resume & cover letter)
         ↓
       4. APPLY
(Jovo Extension: safe autofill + reviewed Q&A)
         ↓
      5. REMEMBER
(Immutable Application Capsule frozen at submission)
         ↓
      6. PREPARE
(Grounded interview prep probing exact claims & gaps)
         ↓
     7. FOLLOW UP
(Scheduled follow-up reminders & lifecycle tracking)
```

---

## Key Features

### Core MVP Capabilities (Implemented)

#### 🔍 Jovo Search

Live job discovery powered by the official **SerpApi Google Jobs engine**. Features structured search planning across titles, locations, and remote preferences with automatic deduplication against your persistent job catalog.

#### ✍️ Jovo Apply

Intelligent application generation that analyzes job descriptions and tailors resume bullet points and cover letters. **Zero hallucination**: every claim must trace directly to a verified career experience or GitHub evidence artifact in your career profile.

#### 📦 Jovo Track

Unified dashboard for tracking applications across their entire lifecycle (`Draft`, `Applied`, `Interviewing`, `Offered`, `Rejected`, `Withdrawn`). Each application is backed by an Application Capsule.

#### ⏰ Jovo Follow-up

Candidate-first follow-up scheduler. Set actionable reminders for recruiter check-ins, interview debriefs, and application updates. Features explicit statuses (`Pending`, `Completed`, `Skipped`) with zero automated emails or unauthorized recruiter contact.

#### 🧩 Jovo Extension

Chrome Manifest V3 extension providing conservative, human-in-the-loop assistance directly on Workday and generic career portals.

---

### Product Roadmap (Planned)

#### 🧠 Jovo Copilot _(Roadmap)_

Planned conversational career AI assistant for strategic career planning, interactive mock interviews, and automated status synchronization. Current profile evidence verification and gap identification serve as the foundation for this upcoming surface.

---

## Application Capsule

The **Application Capsule** is Jovo's core differentiator. It transforms ephemeral job submissions into permanent, actionable career memory.

For every application, the capsule preserves:

- **Exact Job Description**: Frozen snapshot captured at the time of application, resilient against postings being edited or deleted.
- **Exact Resume Version**: The tailored resume markdown/text actually submitted to the employer.
- **Exact Cover Letter**: The tailored cover letter version generated for the role.
- **Application Questions**: Every free-text screening prompt detected on the employer's form.
- **Candidate-Approved Answers**: The exact text reviewed and approved by the candidate.
- **Application Metadata**: Submission timestamp, portal URL, and ATS type.
- **Audit Timeline**: Chronological log of creation, snapshot capture, materials attachment, submission, interview prep, and follow-ups.
- **Interview Preparation & Follow-Up History**: Downstream prep and follow-ups tied directly to the frozen application materials.

---

## SerpApi Integration

SerpApi is a core infrastructural pillar of Jovo's job intelligence, not a decorative feature.

```text
User Search Intent (Role, Location, Remote)
                   ↓
          Jovo Search Planner
                   ↓
        SerpApi Google Jobs Engine
                   ↓
         Live Job Result Stream
                   ↓
     Normalization & Deduplication
                   ↓
        Jovo Catalog & Intelligence
                   ↓
           Application Flow
```

- **Dedicated Adapter**: Isolated under `apps/api/integrations/serpapi/client.py` using `httpx`.
- **Server-Side Only**: SerpApi credentials never touch browser bundles or extension code.
- **Result Normalization**: Raw Google Jobs responses are mapped cleanly into typed Jovo domain schemas.
- **Deduplication Engine**: Fingerprints job postings using title, company, location, and canonical URL to prevent catalog bloat.

---

## Browser Extension

The Jovo Extension (`apps/extension`) runs on **Chrome Manifest V3** and follows strict safety principles:

- **Safe Field Autofill**: Automatically maps safe profile attributes (First Name, Last Name, Email, Phone, LinkedIn, GitHub, Website) using semantic heuristics and label matching.
- **Sensitive Field Shielding**: Strictly ignores and never captures passwords, PINs, tokens, credit cards, SSN, or national ID fields.
- **Evidence-Grounded Question Drafting**: Drafts candidate answers grounded solely in career evidence. Never fabricates metrics or leadership claims.
- **Human Review & Explicit Approval**: Drafted answers are displayed inside the extension popup for candidate review and editing before being inserted into the webpage DOM.
- **Zero Autonomous Submission**: Jovo assists with form filling but **never** clicks the final "Submit" button automatically. The candidate remains in full control.

---

## Architecture

```text
┌────────────────────────────────────────────────────────┐
│                      Jovo Web UI                       │
│             (Next.js 15 App Router / React)            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Jovo Extension                      │
│            (Chrome MV3 / Content & Popup)              │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON
┌───────────────────────────▼────────────────────────────┐
│                       Jovo API                         │
│                  (FastAPI / Python)                    │
├───────────────────────────┬────────────────────────────┤
│   SerpApi Integration     │   LLM Intelligence Layer   │
│  (Google Jobs Discovery)  │   (Evidence Grounding)     │
└─────────────┬─────────────┴─────────────┬──────────────┘
              │                           │
┌─────────────▼───────────────────────────▼──────────────┐
│                  PostgreSQL Database                   │
│   (Career Profile, Jobs, Capsules, Snapshots, Q&A)     │
└────────────────────────────────────────────────────────┘
```

---

## Project Structure

```text
jobos/
├── assets/
│   └── brand/               # Canonical Jovo logo, icons, Open Graph images
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── core/            # App configuration & settings
│   │   ├── db/              # SQLAlchemy models & session
│   │   ├── integrations/    # SerpApi client & normalizer
│   │   ├── routers/         # API endpoints (jobs, career, applications, health)
│   │   ├── schemas/         # Pydantic v2 validation contracts
│   │   ├── services/        # Job, career, and application business logic
│   │   └── tests/           # Pytest unit & integration test suite
│   ├── extension/           # Chrome Manifest V3 extension
│   │   ├── icons/           # Extension icons (16, 32, 48, 128)
│   │   ├── src/             # Background worker, content scripts, popup UI
│   │   └── tests/           # Extension unit & smoke tests
│   └── web/                 # Next.js web application
│       ├── public/          # Favicon, icons, brand assets
│       └── src/             # App router pages, components, API client
├── packages/
│   ├── contracts/           # Shared TypeScript interfaces & types
│   └── prompts/             # Versioned LLM prompts with strict grounding
├── tests/
│   └── fixtures/            # ATS application test HTML fixtures
├── .env.example             # Documented environment variables template
├── LICENSE                  # MIT License
└── README.md                # Public documentation
```

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **npm 10+**
- **PostgreSQL 15+**

### 1. Clone & Set Up Python Virtual Environment

```bash
git clone https://github.com/your-username/jovo.git
cd jovo

# Create and activate virtual environment at root
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install Python backend dependencies
pip install -e .
```

### 2. Install Node.js Workspaces

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Fill in your database URL and API keys:

- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://user:password@localhost:5432/jovo`)
- `SERPAPI_API_KEY`: Your SerpApi key from [serpapi.com](https://serpapi.com)
- `GEMINI_API_KEY`: Your Google Gemini API key

### 4. Run Database Migrations

```bash
alembic upgrade head
```

### 5. Start the Services

**Backend API:**

```bash
uvicorn apps.api.main:app --reload --port 8000
```

When `DEMO_MODE=true` (the default in `.env.example`), the server automatically initializes the **Demo Workspace** on startup. No account creation or login is needed.

**Web Application:**

```bash
npm --workspace=@jobos/web run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the Jovo console immediately.

**Build Chrome Extension:**

```bash
npm --workspace=@jobos/extension run build
```

Load the unpacked extension in Chrome:

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select `apps/extension/dist`

---

## Demo Workspace & Ground Truth Candidate

When running in demo mode (`DEMO_MODE=true`), Jovo is immediately usable without signup:

- **Seeded Candidate**: Grounded strictly in the authoritative resume of **Shubham Singh Ranswal** (Software Engineer II at Thales, cryptography/HSM, payShield 10K, TR-31 key blocks, MultiLMK Go utility, LogChat offline AI log platform, KeyVault Lite, DevLens, CDSP/DSF certifications).
- **Seeded Demo Openings**: Realistic, clearly-labeled demo jobs (`DEMO FIXTURE`) matching the candidate's technical profile.
- **Historical Application Capsules**: Pre-seeded capsules demonstrating the complete lifecycle (`Offer`, `Interviewing`, `Applied`, `Rejected`, and `Saved`).
- **Controlled Application Workflow**: When applying to a job in demo mode, Jovo simulates the ATS submission in a controlled environment ("Demo submission • Not sent to employer") requiring explicit candidate confirmation before freezing the capsule and transitioning to `Applied`.
- **Repeatability & Reset**: The workspace is completely idempotent. To reset back to the pristine initial demo state:
  ```bash
  python scripts/reset_demo_workspace.py
  ```
  Or call `POST /api/v1/demo/reset`.

---

## SerpApi Discovery & Server-Side Failover

Jovo Search utilizes the official SerpApi Google Jobs engine for live opportunity discovery:

1. **Primary & Fallback API Keys**:
   - `SERPAPI_API_KEY`: Primary key used for live searches.
   - `SERPAPI_FALLBACK_API_KEY`: Secondary key for automated server-side failover.
2. **Intelligent Failover Policy**:
   - Failover is triggered _only_ upon quota exhaustion, rate limiting (HTTP 429), or authentication errors (HTTP 401/403).
   - Generic network timeouts or client validation errors do _not_ blindly switch keys.
   - Neither key is ever exposed to the client browser or logged in plaintext.
3. **Explicit Discovery**: To preserve your SerpApi search quota, browsing the catalog or filtering locally operates offline without consuming API quota. Live searches are triggered only when explicitly clicking **Live SerpApi Discovery**.

---

## Environment Variables

See [`.env.example`](.env.example) for the complete reference:

| Variable                   | Description                                         | Default                       |
| :------------------------- | :-------------------------------------------------- | :---------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string                        | `postgresql://...`            |
| `DEMO_MODE`                | Enables deterministic first-run candidate & catalog | `true`                        |
| `SERPAPI_API_KEY`          | Primary SerpApi API key for live Google Jobs search | Required for live search      |
| `SERPAPI_FALLBACK_API_KEY` | Secondary SerpApi API key for server-side failover  | Optional (for failover)       |
| `GEMINI_API_KEY`           | Gemini API key for evidence-grounded AI tailoring   | Optional (falls back to mock) |
| `LLM_MODEL`                | Gemini model name                                   | `gemini-2.5-flash`            |
| `API_HOST` / `API_PORT`    | FastAPI server host and port                        | `0.0.0.0:8000`                |
| `NEXT_PUBLIC_API_URL`      | Web frontend target API URL                         | `http://localhost:8000`       |

> 🔒 **Security Notice:** Never commit `.env` or expose API keys. The Chrome extension communicates exclusively with the local backend API and never stores or sees provider keys.

---

## Testing

Run all test suites across Python, TypeScript, and the Chrome extension:

```bash
# Backend pytest suite (42 unit & integration tests)
.\.venv\Scripts\python.exe -m pytest apps/api/tests

# Backend code formatting & linter
.\.venv\Scripts\python.exe -m ruff check apps/api packages/prompts

# Full monorepo TypeScript typecheck
npm run typecheck

# Full monorepo linter & formatting check
npm run lint
npm run format:check

# Chrome extension unit tests & build
npm --workspace=@jobos/extension test
npm --workspace=@jobos/extension run build

# Chrome extension 12-point smoke test
node apps/extension/run-smoke.mjs

# Next.js web production build
npm --workspace=@jobos/web run build
```

---

## Security & Privacy

- **Zero Secret Exposure**: Third-party API keys (SerpApi, Gemini) remain strictly server-side.
- **Anti-Prompt-Injection**: External job postings and application fields are treated as hostile, untrusted inputs. Prompt templates instruct the model to ignore override attempts.
- **Anti-Hallucination Grounding**: Tailored resumes, cover letters, and interview questions must cite verified evidence from your profile. Missing skills are explicitly labeled as evidence gaps rather than fabricated.
- **Sensitive Field Filtering**: Extension content scripts blacklist password, card, authentication, and government ID inputs.
- **Human-in-the-Loop**: The extension never submits forms autonomously. All AI drafts require candidate review.

---

## Current Limitations

- **ATS Coverage**: Dedicated adapter exists for Workday; other ATS portals rely on the generic form discrimination engine.
- **Complex Dynamic Dropdowns**: Multi-nested custom shadow-DOM dropdowns (common on complex enterprise forms) may require manual candidate selection.
- **Multi-Step Workflows**: Applications with 5+ separate wizard pages require clicking next manually between steps.

---

## Hackathon Context

Jovo was initially developed for the **SerpApi India Hackathon 2026** as a complete, production-minded job application operating system.

SerpApi is a core infrastructural pillar of Jovo Search, powering the live discovery pipeline that ingests authentic, structured employer opportunities directly into Jovo's evidence-grounding engine and Application Capsule lifecycle.

---

## Roadmap

- [ ] **Jovo Copilot**: Conversational AI assistant for interview coaching, salary negotiation strategy, and profile guidance
- [ ] **Automated Status Synchronization**: Email status detection for interview invitations, rejections, and offer updates
- [ ] **Extended ATS Coverage**: Dedicated DOM adapters for Greenhouse, Lever, and SmartRecruiters
- [ ] **Application Dossier Export**: Exportable Application Capsule PDF reports for candidate review before rounds
- [ ] **Live Interview Audio Simulator**: Real-time voice simulation probing candidate claims powered by Gemini Live API

---

## Contributing

We welcome community contributions! Whether you are improving ATS adapters, adding new heuristic mappers, enhancing LLM prompt grounding, or fixing issues:

1. Review our [**Contributing Guide**](CONTRIBUTING.md) for architecture rules, setup instructions, and testing workflows.
2. Review our [**Code of Conduct**](CODE_OF_CONDUCT.md).
3. Open an issue or fork the repo and submit a PR against `main`.

---

## Community & Code of Conduct

Jovo is an open, welcoming community for engineers and job seekers. All contributors are expected to uphold the standards described in our [**Code of Conduct**](CODE_OF_CONDUCT.md).

---

## Security & Vulnerability Reporting

If you believe you have found a security vulnerability in Jovo, please do not disclose it publicly. Review our [**Security Policy**](SECURITY.md) for instructions on confidential disclosure.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<img src="https://komarev.com/ghpvc/?username=shubhamranswal&color=00000000&label=" width="1" height="1" />
