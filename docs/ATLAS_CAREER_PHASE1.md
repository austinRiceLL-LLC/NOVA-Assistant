# Atlas Career: Phase 1

## Scope and current architecture

The repository is `austinRiceLL-LLC/NOVA-Assistant` (the renamed Atlas codebase). Atlas runs on React 19, Vinext/Vite and a Cloudflare Worker. ChatGPT authentication provides a user ID; D1 stores user-scoped workspace data. The existing Composio integration and all send-confirmation rules remain separate from Career.

Career Phase 1 adds a tab in Atlas Workspace, one authenticated `/api/career` route, pure normalization and scoring in `lib/career/core.ts`, public API GET adapters in `lib/career/providers.ts`, and D1 persistence in `lib/career/store.ts`. Migration `drizzle/0002_demonic_sersi.sql` adds five Career tables. `career_jobs` has a per-user unique dedupe key; evaluations and runs are separate records. Every Career query and mutation is scoped to the authenticated user ID.

There are no application submission routes, applicant forms, email sends, browser automation, Cron Trigger, or enabled schedule. Discovery is manual only. `schedulerEnabled` and `applicationsEnabled` are always `false` in the API response.

## Local setup

1. Install Node.js 22.13+ and run `npm ci`.
2. Apply existing Drizzle SQL migrations in numeric order to the local D1 database, including `drizzle/0002_demonic_sersi.sql`, using the project's D1 provisioning workflow. The local binding is `DB` with database name `site-creator-d1`. Do not apply the migration to production until this PR is reviewed and deployment is separately authorized.
3. Run `npm run dev`, sign in or use the existing local development session, then open `/workspace#career`.
4. In Career, add a public Greenhouse, Lever, or Ashby board name and employer label. Press **Run discovery**. The server reads at most 10 configured boards and 500 listings per board, with a 10-second timeout per request. Runs within one minute of the last run are rejected.

The board name is the public path segment of the employer's hosted jobs URL, such as the `example` portion of a Greenhouse, Lever, or Ashby board URL. The server constructs requests only to the three fixed public API hosts. A missing board or provider error appears in the latest run. No synthetic job records are inserted for an empty board.

## Verification

```powershell
npm run test:core
npm run typecheck
npm run lint
npm run build
```

Career adapter tests use in-memory posting fixtures and a mocked `fetch`, so CI makes no live provider requests. Verify the dashboard visually at desktop and mobile widths before deployment. The three live provider feeds have not been exercised in production.

## Evaluation limits

Role, location, employer and posted annual USD salary checks are deterministic. Missing salary and unverified qualifications stay uncertain. Approved skills begin empty and must be entered by the user; Career does not infer them from mailbox or assistant memory. The score is a discovery aid, not a claim that the applicant meets a posting's legal, clearance, experience or work authorization requirements. A source posting may disappear or change after a run; `not_seen` indicates it was absent from the latest successful feed read, not confirmed closed.

## Next phases

Phase 2 can add a user-approved career profile, sourced qualification facts, tailored document versions and a review queue with dry-run previews. Phase 3 requires a separate authorization and demonstrated permitted employer flow before any actual application submission. Phase 4 covers reporting and operational hardening. None of these later phases are enabled here.
