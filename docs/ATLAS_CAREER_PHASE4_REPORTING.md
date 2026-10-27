# Atlas Career reporting groundwork

This branch is stacked on the Phase 3 pilot branch. It adds read-only reporting and exports. It does not create a Cron Trigger, send a digest, submit an application, or deploy the app.

## What is available

- The Career Overview tab displays full-database counts of discovered, eligible, and review-needed jobs, confirmed applications, unverified attempts, and application exceptions. It shows new discoveries and confirmations in the last seven days.
- Missing compensation remains unknown. Interview conversion is explicitly unavailable until outcomes are tracked; it is not reported as zero.
- Authenticated CSV exports cover up to 5,000 saved jobs or application attempts for the signed-in user. Larger exports fail rather than silently truncating. Job descriptions and resume content are excluded. Cells from external job boards are escaped to prevent spreadsheet formula execution.
- `GET /api/career/report` returns the overview; `?format=jobs.csv` and `?format=applications.csv` return downloadable records with private, no-store response headers.

## Scheduler deployment requirement

Atlas currently uses the Sites hosting configuration in `.openai/hosting.json` and has no configured Cron Trigger in a deployable Worker configuration. Cloudflare requires both a `scheduled()` handler and a configured trigger for recurring execution. A UI setting alone would not run searches while Atlas is closed. Scheduled discovery therefore remains off until the deployment route and trigger ownership are established, then can be built with a per-user opt-in, run claiming, rate limits, and visible last-run status.

## Verification

Run `npm run test:core`, `npm run typecheck`, `npm run lint`, and `npm run build`. CSV tests cover formula protection, quoting, zero values, and unknown values. No test contacts an employer site or sends application data.
