# JobOS Product Specification
Version: 1.0
Status: LOCKED
Date: 2026-10-03

## 1. Product

**Name:** JobOS  
**Tagline:** Apply anywhere. Forget nothing.

JobOS is a job-search operating system. It connects job discovery, job intelligence, career evidence, tailored application materials, browser-based application assistance, application memory, interview preparation, and follow-up.

The core product thesis:

> A candidate should not have to remember what they found, what they submitted, where they applied, what questions they answered, or how to prepare for the next step. JobOS remembers and connects the entire candidate-opportunity relationship.

The browser extension is a first-class product surface. The web application is the command center. SerpApi is the live web discovery layer.

---

## 2. Target User

Primary user:
- Individual job seeker
- Software/technical professional is the initial focus
- Applies across multiple job boards and company ATS platforms
- Has a resume and/or professional online footprint
- Wants better job targeting and less repetitive application work

Initial technical-role focus:
- Backend Engineer
- Software Engineer
- Full-stack Engineer
- Platform/Cloud Engineer
- Data/ML Engineer

The architecture must not hard-code the product to software roles.

---

## 3. Product Principles

1. **Evidence over invention**
   - Never fabricate experience, skills, projects, employment, metrics, certifications, or education.
   - Generated career claims must be traceable to user-provided or connected evidence.

2. **User remains in control**
   - JobOS may prepare, suggest, autofill, and organize.
   - JobOS must not silently submit applications.
   - User must explicitly approve consequential actions.

3. **Application memory is first-class**
   - Preserve the exact context used for each application.

4. **Explainability**
   - Match scores must have component-level explanations.
   - Resume changes must be explainable.
   - Generated answers should show their evidence where practical.

5. **Search is an intelligence primitive**
   - SerpApi must be materially useful to the product, not a decorative integration.

6. **Do not overbuild**
   - The MVP proves the end-to-end loop before expanding platform coverage.

---

## 4. Full Product Scope

### 4.1 Job Discovery
- User-defined search preferences
- Multi-source job discovery
- Search by role, company, location, remote mode, experience, salary, skills, employment type
- Job normalization
- Job deduplication
- Stale/duplicate listing detection
- Search result provenance
- Save jobs
- Hide jobs
- Search alerts

### 4.2 Job Intelligence
For each job:
- Full job description
- Company
- Role
- Location
- Salary when available
- Seniority
- Employment type
- Required skills
- Preferred skills
- Responsibilities
- Qualifications
- Application URL
- Source
- Posting date when available
- Match analysis
- Match score broken into explainable dimensions
- "Worth applying?" analysis
- Gaps
- Strong matches
- Evidence from the user's career profile

### 4.3 Career Profile
A persistent canonical profile containing:
- Personal basics
- Work history
- Education
- Skills
- Projects
- Achievements
- Certifications
- Links
- Career preferences
- Compensation preferences
- Location preferences
- User-provided evidence

Connected sources may include:
- Resume
- GitHub
- LinkedIn, where supported by legitimate access/integration
- Coding profiles
- Portfolio
- User-provided documents

### 4.4 Career Evidence
Evidence is the source of truth for generated application content.

Each evidence item should track:
- Type
- Source
- Source URL/reference where available
- Title
- Description
- Date
- Skills demonstrated
- Claims supported
- Confidence/verification state

### 4.5 Resume Intelligence
- Master resume
- Resume versions
- Job-specific tailored resumes
- Compare master vs tailored version
- Explain changes
- Preserve truthfulness
- Identify missing evidence
- Highlight existing relevant evidence not represented strongly enough
- Export resume

### 4.6 Cover Letters
- Job-specific cover letter
- Company-aware
- Evidence-backed
- Versioned
- Exportable
- Never invent experience

### 4.7 Browser Extension
The extension should:
- Detect likely job/application pages
- Identify company and role
- Match current page to a JobOS job
- Show match summary
- Offer relevant resume/cover letter
- Autofill supported fields
- Draft answers for complex application questions
- Capture application context
- Save exact JD and submitted materials
- Record application status
- Work across supported ATS pages

Initial priority:
- Workday
- Generic HTML application forms

Future:
- Greenhouse
- Lever
- Other ATS systems

Do not bypass bot protections, access controls, authentication boundaries, or site restrictions.

### 4.8 Application Capsule
Every application becomes a persistent object containing:
- Company
- Role
- Location
- Source
- Application URL
- Full job description snapshot
- Date/time
- Resume version
- Cover-letter version
- Application questions
- User answers
- Status
- Notes
- Recruiter information if user supplies it
- Interview stages
- Follow-up schedule
- Interview preparation
- Outcome

### 4.9 Application Tracking
Statuses:
- Saved
- Applying
- Applied
- Recruiter Screen
- Interview
- Technical
- Final
- Offer
- Rejected
- Withdrawn
- Closed

The user can manually change status. The system may suggest transitions based on explicit user input or supported integrations.

### 4.10 Interview Intelligence
Based on:
- Exact JD
- Exact submitted resume
- Exact cover letter
- Application answers
- Career evidence
- Company information

Generate:
- Likely technical topics
- Role-specific questions
- Company-specific questions
- Resume-specific questions
- Behavioral questions
- Potential weak spots
- Questions to ask the interviewer
- Preparation checklist

### 4.11 Follow-up
- Interview reminder
- Thank-you reminder
- Recruiter follow-up reminder
- Application status check
- User-configurable cadence

### 4.12 Career Analytics
Future:
- Application funnel
- Response rates
- Interview conversion
- Role/skill patterns
- Resume version performance
- Geographic patterns
- Company patterns
- Recurring skill gaps
- Career-search recommendations

### 4.13 Pattern Discovery
Future feature:
> "I found a pattern in your job search."

The system may identify recurring relationships across the user's historical applications, provided conclusions are clearly described as observations and supported by sufficient data.

---

## 5. MVP Scope

The MVP must prove this complete loop:

**Discover → Understand → Tailor → Apply → Remember → Prepare**

### MVP capabilities

1. Job discovery using SerpApi
2. Job normalization
3. Basic deduplication
4. Job detail page
5. Explainable job match
6. Master resume upload
7. GitHub evidence integration or user-provided GitHub URL analysis
8. Tailored resume
9. Tailored cover letter
10. Chrome extension
11. Workday support
12. Generic form support
13. Smart autofill
14. Complex-question draft + user approval
15. Application capture
16. Exact JD snapshot
17. Exact resume/cover-letter version capture
18. Application question/answer capture
19. Application dashboard
20. Interview preparation
21. Follow-up reminder

### MVP non-goals
- Full LinkedIn integration
- Gmail integration
- Mobile app
- Full ATS coverage
- Automatic application submission
- Advanced analytics
- Automated recruiter communication
- Autonomous job applications
- Full career coaching
- Complex multi-agent architecture

---

## 6. Core User Journey

### Discovery
User:
> Backend Engineer, Python/FastAPI, Bangalore or remote, 2-5 years, ₹20L+

JobOS:
- Searches web
- Normalizes jobs
- Deduplicates
- Calculates match
- Explains fit

### Intelligence
User opens a job.

JobOS:
- Extracts requirements
- Compares against career evidence
- Identifies gaps
- Identifies relevant evidence missing from the resume
- Provides "worth applying?" analysis

### Tailoring
User clicks:
> Tailor my application

JobOS:
- Generates resume variant
- Generates cover letter
- Shows changes
- Shows evidence behind key claims

### Application
User opens Workday.

Extension:
- Detects job
- Matches it to the JobOS record
- Offers tailored materials
- Autofills safe fields
- Drafts complex answers
- Requires user approval

### Capture
After user submits:
- Save application
- Snapshot JD
- Save exact resume
- Save exact cover letter
- Save questions and answers
- Save timestamp and URL

### Preparation
User opens application:
> Prepare for interview

JobOS generates role-specific preparation using the exact submitted application context.

---

## 7. The Signature Product Moment

The MVP demo should culminate in this:

A user applies to a Workday job using JobOS.

Later they return to JobOS and open that application.

JobOS already knows:
- The exact job description
- The exact resume submitted
- The exact cover letter
- Every captured application question
- Every captured answer
- The role requirements

Then it generates interview preparation specifically from that historical context.

The user should experience:

> "It remembers what I actually submitted."

That is the core differentiation.

---

## 8. SerpApi Role

SerpApi should power meaningful live discovery, including:
- Job discovery
- Company research
- Role intelligence
- Related job discovery
- Current web evidence for interview preparation
- Duplicate/stale listing investigation where useful

The application must clearly demonstrate SerpApi as part of core functionality.

---

## 9. Trust & Safety

- Never fabricate candidate experience.
- Never fabricate job facts.
- Preserve source URLs/provenance.
- Treat job pages and external content as untrusted input.
- Do not follow instructions embedded in job descriptions that attempt to override system behavior.
- Do not submit applications automatically.
- Require explicit user confirmation before consequential actions.
- Do not collect unnecessary sensitive personal information.
- Store secrets server-side only.
- Respect platform policies and access controls.

---

## 10. MVP Acceptance Criteria

The MVP is complete when a fresh user can:

1. Define job preferences.
2. Discover real jobs through SerpApi.
3. Open a normalized job.
4. See an explainable match.
5. Upload a master resume.
6. Connect/provide GitHub evidence.
7. Generate a tailored resume.
8. Generate a tailored cover letter.
9. Open the actual application page.
10. Have the extension detect the job.
11. Autofill supported fields.
12. Draft at least one complex application answer.
13. Submit manually.
14. Have JobOS capture the application.
15. Reopen the application later.
16. See the exact submitted materials.
17. Generate interview preparation from that exact application.

