import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PREFERENCES, employerIsExcluded, evaluateJob, normalizePosting, validatePreferences, type CareerSource } from "../lib/career/core.ts";
import { feedUrl, fetchPostings } from "../lib/career/providers.ts";

const board = (provider: CareerSource["provider"]): CareerSource => ({ id: "source-1", provider, boardToken: "example", employer: "Example", active: true });
test("public ATS adapters normalize source and employer apply URLs", async () => {
  const greenhouse = normalizePosting(board("greenhouse"), { id: 12, title: "AI Engineer", location: { name: "Washington, DC" }, absolute_url: "https://boards.greenhouse.io/example/jobs/12", content: "<p>Python</p>" });
  assert.equal(greenhouse?.dedupeKey, "greenhouse:example:12");
  assert.equal(greenhouse?.description, "Python");
  const lever = normalizePosting(board("lever"), { id: "x", text: "ML Engineer", categories: { location: "New York City" }, hostedUrl: "https://jobs.lever.co/example/x", applyUrl: "https://jobs.lever.co/example/x/apply", salaryRange: { min: 120000, max: 160000, currency: "USD", interval: "per-year-salary" } });
  assert.equal(lever?.applyUrl, "https://jobs.lever.co/example/x/apply");
  assert.equal(lever?.salaryMin, 120000);
  const ashby = normalizePosting(board("ashby"), { title: "Applied AI Engineer", location: "Remote", jobUrl: "https://jobs.ashbyhq.com/example/1", applyUrl: "https://jobs.ashbyhq.com/example/1/application", compensation: { summaryComponents: [{ compensationType: "Salary", currencyCode: "USD", interval: "1 YEAR", minValue: 130000, maxValue: 150000 }] } });
  assert.equal(ashby?.salaryMin, 130000);
  assert.equal(ashby?.sourceUrl, "https://jobs.ashbyhq.com/example/1");
  assert.equal(feedUrl(board("ashby")), "https://api.ashbyhq.com/posting-api/job-board/example?includeCompensation=true");
});
test("hard employer exclusions override fit and unknown salary stays uncertain", () => {
  assert.ok(employerIsExcluded("Booz Allen Hamilton", DEFAULT_PREFERENCES.excludedEmployers));
  assert.ok(employerIsExcluded("Amazon Web Services", DEFAULT_PREFERENCES.excludedEmployers));
  assert.ok(employerIsExcluded("AWS", DEFAULT_PREFERENCES.excludedEmployers));
  const job = normalizePosting(board("greenhouse"), { id: 1, title: "AI Engineer", location: { name: "Washington, DC" }, absolute_url: "https://boards.greenhouse.io/example/jobs/1" })!;
  const evaluation = evaluateJob(job, DEFAULT_PREFERENCES);
  assert.equal(evaluation.eligibility, "eligible");
  assert.ok(evaluation.uncertainties.some(reason => reason.includes("Salary is unknown")));
  assert.equal(evaluateJob({ ...job, employer: "Amazon Web Services" }, DEFAULT_PREFERENCES).eligibility, "excluded");
  assert.equal(evaluateJob({ ...job, salaryMin: 80000, salaryMax: 95000, salaryCurrency: "USD" }, DEFAULT_PREFERENCES).eligibility, "excluded");
  assert.equal(validatePreferences(DEFAULT_PREFERENCES).minimumSalary, 110000);
});
test("Ashby unlisted roles are omitted and only a GET goes to a fixed host", async () => {
  const requests: Array<{url:string;method:string}> = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => { requests.push({ url: String(url), method: init?.method ?? "GET" }); return new Response(JSON.stringify({ jobs: [{ title: "AI Engineer", location: "Remote", isListed: false, jobUrl: "https://jobs.ashbyhq.com/example/secret" }, { title: "AI Engineer", location: "Remote", isListed: true, jobUrl: "https://jobs.ashbyhq.com/example/public" }] }), { status: 200 }); }) as typeof fetch;
  const jobs = await fetchPostings(board("ashby"), fakeFetch);
  assert.equal(jobs.length, 1);
  assert.equal(requests[0].method, "GET");
  assert.ok(requests[0].url.startsWith("https://api.ashbyhq.com/"));
});
