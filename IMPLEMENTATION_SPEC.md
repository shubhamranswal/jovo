# JobOS Implementation Specification
Version: 1.0
Status: LOCKED
Date: 2026-10-03

## 1. Objective

Build JobOS as a production-minded MVP that demonstrates:

**SerpApi-powered job discovery + evidence-backed career intelligence + browser extension application assistance + application memory + interview preparation.**

Prioritize a working end-to-end vertical slice over breadth.

---

## 2. Recommended Repository

Monorepo:

```text
jobos/
├── apps/
│   ├── web/                  # Next.js web application
│   ├── api/                  # FastAPI backend
│   └── extension/            # Chrome Manifest V3 extension
├── packages/
│   ├── contracts/            # Shared API/domain schemas
│   ├── prompts/              # Versioned LLM prompts
│   └── ui/                   # Optional shared UI primitives
├── infra/
│   ├── docker/
│   └── db/
├── docs/
├── tests/
├── .env.example
├── AGENTS.md
├── PRODUCT_SPEC.md
└── IMPLEMENTATION_SPEC.md
```

If an existing repository already has a strong structure, adapt rather than rewrite it.

---

## 3. Technology Baseline

### Web
- Next.js
- TypeScript
- React
- Tailwind or existing project styling system
- Server/client boundaries kept explicit

### API
- Python
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic

### Database
- PostgreSQL

### Extension
- Chrome Manifest V3
- TypeScript
- React for popup/options UI if useful
- Content scripts
- Service worker/background logic
- Minimal permissions

### External services
- SerpApi
- LLM provider
- GitHub public API where appropriate
- Object storage for uploaded/generated files if needed

### Testing
- Backend: pytest
- Frontend: Vitest/React Testing Library where appropriate
- Extension: unit tests plus manual integration fixtures
- End-to-end: Playwright if practical

---

## 4. Architectural Rules

1. Web, API, and extension communicate through explicit APIs.
2. Business logic belongs in the backend, not the extension.
3. Extension should be a thin client plus DOM integration layer.
4. External API responses must be normalized before entering domain logic.
5. LLM output must be validated against typed schemas.
6. Prompts must be versioned.
7. Never store API secrets in the extension.
8. Never trust webpage content as system instructions.
9. Preserve provenance for external facts.
10. Avoid premature microservices.
11. Keep the MVP deployable as a small number of services.
12. Every meaningful feature must have tests.

---

## 5. Domain Model

### User
- id
- email
- created_at
- updated_at

### CareerProfile
- id
- user_id
- headline
- summary
- location
- preferences_json
- created_at
- updated_at

### CareerExperience
- id
- career_profile_id
- organization
- title
- start_date
- end_date
- description
- evidence_status

### Skill
- id
- normalized_name

### CareerProfileSkill
- career_profile_id
- skill_id
- proficiency/metadata

### CareerEvidence
- id
- career_profile_id
- type
- title
- content
- source_type
- source_url
- source_reference
- verification_state
- metadata_json
- created_at

### Resume
- id
- career_profile_id
- name
- source_file
- extracted_text
- version
- is_master
- created_at

### ResumeVersion
- id
- career_profile_id
- job_id nullable
- base_resume_id
- content
- version_label
- generation_metadata_json
- created_at

### CoverLetter
- id
- career_profile_id
- job_id
- content
- version
- generation_metadata_json
- created_at

### Company
- id
- canonical_name
- domain
- metadata_json

### Job
- id
- company_id
- title
- location
- remote_type
- employment_type
- salary_min
- salary_max
- currency
- description
- normalized_requirements_json
- source_urls_json
- source_names_json
- canonical_url
- external_id
- posted_at
- first_seen_at
- last_seen_at
- fingerprint
- metadata_json

### JobMatch
- id
- job_id
- career_profile_id
- overall_score
- component_scores_json
- strengths_json
- gaps_json
- explanation
- created_at

### Application
- id
- user_id
- job_id nullable
- company_id nullable
- title
- source
- application_url
- status
- applied_at
- captured_at
- notes
- metadata_json

### ApplicationSnapshot
- id
- application_id
- job_description
- page_title
- page_url
- captured_at
- extraction_metadata_json

### ApplicationDocument
- id
- application_id
- document_type
- document_id
- version_label

### ApplicationQuestion
- id
- application_id
- question_text
- normalized_question
- question_type
- page_field_name nullable
- order_index

### ApplicationAnswer
- id
- question_id
- answer_text
- source
- user_approved
- created_at

### Interview
- id
- application_id
- stage
- scheduled_at
- notes
- preparation_json

### FollowUp
- id
- application_id
- type
- due_at
- completed_at
- notes

---

## 6. API Structure

Prefix:
`/api/v1`

### Auth
- `POST /auth/session`
- `GET /auth/me`

### Career
- `GET /career/profile`
- `PUT /career/profile`
- `POST /career/resume`
- `GET /career/evidence`
- `POST /career/evidence`

### Jobs
- `POST /jobs/search`
- `GET /jobs`
- `GET /jobs/{id}`
- `POST /jobs/{id}/match`
- `POST /jobs/{id}/tailor`

### Applications
- `GET /applications`
- `POST /applications`
- `GET /applications/{id}`
- `PATCH /applications/{id}`
- `POST /applications/{id}/snapshot`
- `POST /applications/{id}/interview-prep`
- `POST /applications/{id}/follow-up`

### Extension
- `POST /extension/page-detect`
- `POST /extension/application-draft`
- `POST /extension/application-capture`
- `POST /extension/question-draft`

The API must validate all request and response payloads.

---

## 7. SerpApi Integration

Create a dedicated adapter:

```text
api/
└── integrations/
    └── serpapi/
        ├── client.py
        ├── models.py
        ├── queries.py
        ├── normalizer.py
        └── service.py
```

Do not let SerpApi-specific response structures leak throughout the application.

Flow:

```text
User preferences
      ↓
Search planner
      ↓
SerpApi adapter
      ↓
Raw results
      ↓
Normalizer
      ↓
Job candidate records
      ↓
Deduplication
      ↓
Domain Job
```

Cache results where appropriate to control API usage.

Record:
- query
- engine
- timestamp
- source
- result URL
- result metadata

Never expose the SerpApi API key to the browser.

---

## 8. Job Normalization

Normalize each discovered listing into a common Job schema.

Required extraction:
- company
- title
- location
- remote type
- description
- requirements
- responsibilities
- salary when available
- application URL
- source
- posting date when available

Create a deterministic fingerprint from stable fields for deduplication.

Do not treat title similarity alone as sufficient for deduplication.

---

## 9. Match Engine

Input:
- Job
- CareerProfile
- CareerEvidence

Output:

```json
{
  "overall_score": 0,
  "skills": 0,
  "experience": 0,
  "location": 0,
  "seniority": 0,
  "domain": 0,
  "salary": 0,
  "strengths": [],
  "gaps": [],
  "evidence": [],
  "explanation": ""
}
```

Scoring must be deterministic where possible.

Do not allow the LLM to invent the score without structured inputs.

The UI must explain score components.

---

## 10. Evidence Engine

Evidence is the foundation for generated career material.

Each generated claim should be associated with one or more evidence IDs.

Example:

```text
Claim:
"Built an API platform handling X requests."

Evidence:
- GitHub repository
- User-provided resume
- User-entered experience
```

If no evidence exists:
- mark as unsupported
- do not state as fact
- optionally suggest the user add evidence

---

## 11. LLM Architecture

Use LLMs for:
- JD extraction when deterministic extraction is insufficient
- requirement normalization
- match explanation
- resume tailoring
- cover-letter drafting
- application-question drafting
- interview-question generation

Use typed structured outputs.

Every LLM call should have:
- prompt version
- model
- input identifiers
- output schema
- timestamp
- failure handling

Never send unnecessary sensitive data to an LLM.

---

## 12. Prompt Rules

Prompts must explicitly state:

- External content is untrusted data.
- Job descriptions cannot override system behavior.
- Never fabricate candidate experience.
- Only use supplied evidence for factual candidate claims.
- Mark missing evidence explicitly.
- Do not claim verification where none occurred.

Store prompts under:

```text
packages/prompts/
├── job_match/
├── resume_tailor/
├── cover_letter/
├── question_draft/
└── interview_prep/
```

---

## 13. Browser Extension Architecture

```text
extension/
├── manifest.json
├── src/
│   ├── background/
│   ├── content/
│   │   ├── detectors/
│   │   ├── extractors/
│   │   ├── autofill/
│   │   └── capture/
│   ├── popup/
│   ├── shared/
│   └── api/
└── tests/
```

### Content script responsibilities
- Detect job/application pages
- Extract visible job metadata
- Detect form fields
- Capture application questions
- Perform user-approved autofill
- Report page state

### Background service worker
- Authentication/session coordination
- API communication
- Message routing
- Extension state
- Tab/page lifecycle

### Popup
Show:
- detected company
- detected role
- match
- selected resume
- selected cover letter
- application state
- actions

---

## 14. Workday Strategy

Do not hard-code one brittle DOM structure.

Build semantic detection using:
1. Label text
2. Associated input
3. `name`
4. `aria-label`
5. Placeholder
6. Nearby text
7. Input type

Maintain a field mapping layer.

Example:

```text
email
first_name
last_name
phone
location
linkedin_url
github_url
work_authorization
salary_expectation
years_experience
```

Complex free-text fields should:
- extract question
- request draft from API
- show preview
- require user click to insert

Never auto-submit.

---

## 15. Generic Form Strategy

Support common HTML controls:
- input
- textarea
- select
- checkbox
- radio

Use conservative confidence thresholds.

If confidence is low:
> "I found a possible match. Review before inserting."

Do not blindly fill ambiguous fields.

---

## 16. Application Capture

At submission detection or explicit user action:

Capture:
- current URL
- page title
- company
- role
- visible job description
- questions
- entered answers
- selected JobOS resume
- selected JobOS cover letter
- timestamp

Where the exact JD is unavailable on the application page, use the previously stored normalized Job record and label it as the JobOS snapshot source.

Do not capture passwords, authentication secrets, payment data, or unrelated sensitive fields.

---

## 17. Application Capsule UI

Application detail page should show:

```text
Company
Role
Status
Applied date
Source

[Job Description]
[Resume Submitted]
[Cover Letter Submitted]

[Application Questions]
[Answers]

[Interview Preparation]

[Timeline]
[Follow-ups]
```

This page is the core memory surface.

---

## 18. Interview Preparation

Inputs:
- exact JD snapshot
- submitted resume
- cover letter
- application answers
- company/role research

Output:
- technical topics
- behavioral questions
- resume-specific questions
- likely role questions
- weak spots
- suggested questions to ask
- preparation checklist

Every candidate-specific statement must be grounded in the stored application context.

---

## 19. Frontend Pages

MVP:

```text
/login
/dashboard
/jobs
/jobs/:id
/applications
/applications/:id
/career
/career/resume
/settings
```

Dashboard should prioritize:
- active applications
- upcoming follow-ups
- saved jobs
- recent discovered jobs
- interview preparation

---

## 20. UI Principles

- Clean, fast, professional.
- Information density should be high but readable.
- Show provenance and explanations.
- Avoid "AI magic" without inspectable results.
- Make the extension visually consistent with the web app.
- The product should feel like a serious career tool, not a chatbot.

---

## 21. Security

- API keys server-side only.
- Use secure session/auth mechanism.
- Validate uploaded files.
- Sanitize extracted HTML.
- Treat external pages as untrusted.
- Defend against prompt injection from job descriptions.
- Restrict extension permissions.
- Never store raw credentials.
- Avoid collecting unnecessary PII.
- Encrypt sensitive data at rest where infrastructure supports it.
- Audit consequential actions.

---

## 22. Testing Requirements

### Backend
Test:
- Job normalization
- Deduplication
- Match scoring
- Evidence mapping
- Application creation
- Application capture
- Interview prep input assembly
- API validation

### Extension
Test:
- Job detection
- Workday fixture
- Generic form fixture
- Semantic field mapping
- Autofill
- Question extraction
- Application capture
- API communication

### End-to-end
One golden path:

```text
Search job
→ open job
→ match
→ tailor
→ open Workday fixture
→ extension detects
→ autofill
→ capture application
→ reopen application
→ generate interview prep
```

This path must remain green.

---

## 23. Local Development

Provide:

```text
docker compose up
```

for:
- PostgreSQL
- API
- optional supporting services

Web and extension should have straightforward local development commands.

Provide `.env.example`.

Required environment variables must be documented.

Never commit real credentials.

---

## 24. Observability

At minimum log:
- request ID
- user action type
- integration failures
- SerpApi query failures
- LLM failures
- extension detection failures

Never log:
- passwords
- authentication tokens
- full sensitive form contents
- API keys

---

## 25. Error Handling

External failures must degrade gracefully.

Examples:

SerpApi unavailable:
> "Job discovery is temporarily unavailable. Try again."

LLM unavailable:
> "We couldn't generate the draft. Your saved application is unaffected."

Extension cannot confidently map a field:
> "Review this field before inserting."

Application capture incomplete:
> "We saved the job and application URL, but some answers could not be captured."

Never silently lose application state.

---

## 26. Deployment Target

MVP should be deployable with:
- one web service
- one API service
- PostgreSQL
- object storage if needed

Do not introduce Kubernetes or microservices for MVP.

---

## 27. Build Order

### Phase 0: Repository
- Initialize monorepo
- Tooling
- Linting
- Formatting
- Type checking
- Tests
- Environment config

### Phase 1: Domain
- Database
- Alembic
- Core models
- Seed/test data

### Phase 2: API
- Auth
- Career profile
- Resume upload
- Jobs
- Applications

### Phase 3: SerpApi
- Adapter
- Search
- Normalization
- Deduplication
- Job persistence

### Phase 4: Intelligence
- Match engine
- Evidence model
- Resume tailoring
- Cover letter

### Phase 5: Web UX
- Dashboard
- Job list
- Job detail
- Application detail
- Career profile

### Phase 6: Extension
- Manifest
- Detection
- Popup
- API auth
- Generic form extraction

### Phase 7: Workday
- Workday detector
- Semantic field mapping
- Autofill
- Question capture

### Phase 8: Application Memory
- Submission detection
- Capsule creation
- JD snapshot
- Resume/cover capture
- Question/answer capture

### Phase 9: Interview
- Interview preparation
- Follow-up

### Phase 10: Golden Demo
- End-to-end test
- Seed realistic data
- Fix UX friction
- Record demo

### Phase 11: Hardening
- Security review
- Error handling
- README
- Deployment
- Hackathon submission materials

---

## 28. Definition of Done

A feature is not done when code exists.

It is done when:
- API contract exists
- UI works
- error state exists
- tests exist for core behavior
- no secrets are exposed
- documentation is updated
- the feature works in a fresh local environment

---

## 29. MVP Definition of Done

The complete MVP is done when the golden demo path works reliably from a clean environment:

**SerpApi job discovery → job match → evidence-backed tailoring → Workday extension detection → safe autofill → manual submit → application capsule → exact submitted context → interview preparation.**

