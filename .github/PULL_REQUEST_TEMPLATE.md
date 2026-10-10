## Summary of Changes

Describe the problem solved, feature added, or improvement made in this pull request.

## Related Issue / Context

Fixes #(issue number) or relates to:

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] ATS Adapter enhancement (improving Workday or generic detection)
- [ ] UI / Design refinement
- [ ] Documentation update
- [ ] Performance or security improvement

## Architectural & Product Truth Checklist

- [ ] **Evidence Grounding**: No candidate experience or qualifications were fabricated.
- [ ] **Extension Security**: No sensitive fields (passwords, tokens, payment) are captured or filled.
- [ ] **No Autonomous Submission**: The extension does not silently submit forms.
- [ ] **Application Memory**: Application Capsule preservation and immutability are respected.

## Testing Performed

- [ ] Backend tests passing (`pytest apps/api/tests`)
- [ ] Extension unit tests passing (`npm --workspace=@jobos/extension test`)
- [ ] TypeScript typecheck passing (`npm run typecheck`)
- [ ] Linter & formatter passing (`npm run lint` & `npm run format:check`)

## Screenshots / Demo (if applicable)

Attach screenshots or recordings demonstrating the change.
