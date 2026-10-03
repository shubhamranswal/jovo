# JobOS Versioned Prompts

This package contains versioned prompts for all LLM-driven intelligence components in JobOS.

## Prompt Directories

- `job_match/`: Prompt templates for requirement extraction and match explanation.
- `resume_tailor/`: Prompt templates for evidence-grounded resume tailoring.
- `cover_letter/`: Prompt templates for evidence-grounded cover letters.
- `question_draft/`: Prompt templates for application question drafting.
- `interview_prep/`: Prompt templates for interview prep generation from submitted application context.

## Rules

- All prompts must enforce that external web/JD content is untrusted data.
- Never invent candidate experience.
- Prompts must be versioned.
