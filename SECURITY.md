# Security Policy

## Supported Versions

Security updates are actively applied to the following release branches:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

---

## Security Principles & Architectural Guarantees

Jovo handles sensitive career and application data. The architecture enforces strict security guardrails by design:

1. **Zero Secret Exposure to Client Bundles**:
   - Provider API keys (SerpApi, Google Gemini, GitHub tokens) are strictly stored and used on the FastAPI backend.
   - The Chrome extension and Next.js client bundles never receive, store, or require third-party provider keys.
2. **Sensitive Form Field Shielding**:
   - The Chrome extension content scripts enforce heuristic and explicit blacklists prohibiting autofill, extraction, or caching of passwords, PINs, OTPs, CVVs, credit card numbers, Social Security Numbers (SSN), Aadhaar numbers, or authentication tokens.
3. **Anti-Prompt-Injection Safeguards**:
   - External job descriptions, company summaries, and career web pages are treated as **untrusted user input**. Prompt templates enforce strict instruction separation to prevent prompt injection attacks.
4. **Human-in-the-Loop Safeguards**:
   - The browser extension never autonomously clicks the final "Submit" button on employer portals.
   - All AI-drafted free-text screening responses require candidate review and explicit insertion approval before touching the page DOM.

---

## Reporting a Vulnerability

If you discover a potential security vulnerability in Jovo, please do **NOT** open a public issue.

Please disclose it confidentially to:

- **Email**: [shubhamranswal@gmail.com](mailto:shubhamranswal@gmail.com)
- **Subject**: `[SECURITY VULNERABILITY] Jovo: <Short Description>`

Please include in your report:

- A description of the vulnerability and its potential impact.
- Steps to reproduce or proof-of-concept code/URL.
- Any suggested mitigations.

### Response Timeline

- **Initial Acknowledgment**: Within 48 hours.
- **Triage & Status Update**: Within 5 business days.
- **Fix & Public Advisory**: Once patched and coordinated with the reporter.

Thank you for helping keep Jovo and our community secure!
