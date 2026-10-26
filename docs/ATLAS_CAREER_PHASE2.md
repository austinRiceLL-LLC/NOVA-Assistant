# Atlas Career: Phase 2 materials and review

This change is stacked on the Phase 1 Career discovery branch. It adds only local material preparation and review. Apply `drizzle/0003_faithful_secret_warriors.sql` after the Phase 1 migration when provisioning a review environment. Do not deploy either migration until the corresponding PRs have been reviewed and deployment is separately authorized.

## Flow

1. The user pastes a plain-text base resume and explicitly approves its accuracy. Every save creates an immutable version in `career_base_resumes`.
2. The user adds individual career claims, each with a source label and an explicit approval checkbox. Revocation hides the claim from future drafts without changing existing artifact history.
3. A user selects a discovered, non-excluded job and presses **Prepare draft**. `lib/career/materials.ts` copies the approved base resume exactly, then appends up to eight exact approved claims whose words overlap the posting. It does not generate or embellish employment, education, clearance, authorization, or screening answers.
4. The artifact is versioned per job in `career_artifacts` with the base resume ID, referenced fact IDs, and SHA-256 checksum. A review item and a dry-run audit event are stored. **Dry-run preview** shows the saved text, unresolved blockers, and that the employer form has not been opened or submitted.
5. The user may save a proposed standing policy, but `career_policy_drafts.status` is always `draft`. There is no activation route, executor, email, browser bot, or application submission path.

All new read and write queries use the authenticated user ID. Resume text and career claims stay in user-scoped D1 tables and are never placed in general audit details. The API does not call a model or send profile data to any external service. The job's original employer URL remains available in Phase 1 for manual navigation.

## Verification

```powershell
npm run test:core
npm run typecheck
npm run lint
npm run build
node --test tests/rendered-html.test.mjs
```

Tests use local data and verify that unapproved claims never enter drafts, a base resume must be approved, sensitive requirements remain blockers, and a policy cannot become active. Apply all SQL files in order to a fresh SQLite database to verify migration syntax. Visual review at desktop and mobile widths is still needed before deployment.

## Known limits and next gate

Drafts are plain text and conservative: if no approved fact matches, the artifact is just the approved base resume and the queue explains the gap. They are not a guarantee of ATS ranking or job eligibility. Employer application forms and required questions are not fetched or answered. Phase 3 requires a separately reviewed permitted employer flow, server-side policy enforcement, explicit enrollment, and submission evidence before any external application can be sent.
