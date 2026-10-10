# Contributing to Jovo

Thank you for your interest in contributing to **Jovo**! Jovo is an open-source, evidence-grounded job application operating system with persistent application memory.

This guide outlines our development workflow, architectural constraints, and contribution guidelines.

---

## Code of Conduct

All contributors and maintainers are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

---

## Core Product Principles

Before submitting code, please remember our product principles (from `AGENTS.md` and `PRODUCT_SPEC.md`):

1. **Zero Hallucination / Evidence Grounding**: The system must never fabricate candidate experience, unverified skills, metrics, or credentials. Everything must be traceable to verified career profile evidence.
2. **Conservative Browser Extension**: The Chrome extension assists the user with safe fields (Name, Email, Phone, Resume, URLs) and drafts free-text answers for human review. It **never** auto-submits applications and **never** touches passwords, payment, or auth tokens.
3. **Application Memory**: The core differentiator is freezing submitted application state (exact JD, tailored resume, cover letter, and approved Q&A) into an immutable **Application Capsule**.

---

## Development Setup

### Prerequisites

- **Python 3.11+**
- **Node.js 20+** and **npm 10+**
- **PostgreSQL 15+**

### 1. Fork & Clone

```bash
git clone https://github.com/<your-username>/jovo.git
cd jovo
```

### 2. Python Backend Setup

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install editable package with dev dependencies
pip install -e .
```

### 3. Node.js Monorepo Setup

```bash
npm install
```

### 4. Environment Configuration

```bash
cp .env.example .env
```

Configure your local PostgreSQL connection string in `.env`. By default, `DEMO_MODE=true` initializes a deterministic candidate profile and sample catalog on startup.

### 5. Database Migrations

```bash
alembic upgrade head
```

---

## Running the Services

### Backend API (FastAPI)

```bash
uvicorn apps.api.main:app --reload --port 8000
```

- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Web Dashboard (Next.js)

```bash
npm --workspace=@jobos/web run dev
```

- Web Console: [http://localhost:3000](http://localhost:3000)

### Chrome Extension (Manifest V3)

```bash
npm --workspace=@jobos/extension run build
```

To test in Google Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select `apps/extension/dist`

---

## Testing & Quality Gates

Every pull request must pass all tests and lint checks:

```bash
# 1. Backend tests (pytest)
pytest apps/api/tests

# 2. Python linter & formatter
ruff check apps/api packages/prompts
ruff format --check apps/api packages/prompts

# 3. Monorepo TypeScript typecheck
npm run typecheck

# 4. Monorepo lint & prettier check
npm run lint
npm run format:check

# 5. Extension test suite
npm --workspace=@jobos/extension test
```

---

## Pull Request Workflow

1. Create a branch for your feature or fix (`git checkout -b feature/workday-fix`).
2. Make isolated, well-documented changes.
3. Ensure existing tests pass and add new tests covering your changes.
4. Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add Greenhouse adapter for extension`
   - `fix: prevent duplicate job indexing on SerpApi search`
   - `docs: update setup instructions in README`
   - `test: add unit tests for sensitive field rejection`
5. Open a Pull Request on GitHub against `main`. Provide a clear description of the problem solved and test results.

---

## Questions & Discussions

Feel free to open an issue or start a discussion on our GitHub repository. We look forward to building with you!
