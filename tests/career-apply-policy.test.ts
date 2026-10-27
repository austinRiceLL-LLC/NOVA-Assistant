import assert from "node:assert/strict";
import test from "node:test";
import { classifySubmissionResponse, submissionBlockers, type SiteCapability, type SubmissionCandidate, type SubmissionPolicy } from "../lib/career/apply-policy.ts";

const policy: SubmissionPolicy = { status: "active", version: 1, allowedEmployers: ["Example Defense"], allowedHosts: ["careers.example.com"], locations: ["Washington"], jobClasses: ["AI Engineer"], minimumSalary: 110000, dailyCap: 1, approvedAt: 1 };
const job: SubmissionCandidate = { jobId: "job-1", employer: "Example Defense", title: "AI Engineer", location: "Washington, DC", applyUrl: "https://careers.example.com/apply/1", eligibility: "eligible", salaryMin: 130000, salaryCurrency: "USD", artifactId: "artifact-1", artifactCurrent: true, dryRunCompleted: true, unansweredQuestions: 0, humanChallengePending: false, alreadyAttempted: false, submissionsToday: 0 };
const capability: SiteCapability = { host: "careers.example.com", method: "employer_authorized_api", evidenceUrl: "https://careers.example.com/automation-terms", verifiedAt: 1, credentialConfigured: true, formVerified: true };

test("complete employer-authorized pilot candidate clears deterministic gates", () => {
  assert.deepEqual(submissionBlockers(policy, job, capability), []);
});
test("public posting access and user policy alone never permit a submission", () => {
  assert.ok(submissionBlockers(policy, job, null).some(item => item.includes("verified permitted")));
  assert.ok(submissionBlockers({ ...policy, status: "paused" }, job, capability).some(item => item.includes("not active")));
  assert.ok(submissionBlockers(policy, { ...job, alreadyAttempted: true }, capability).some(item => item.includes("already exists")));
});
test("restricted boards, unknown salary, unanswered questions and quota require review", () => {
  const blocked = submissionBlockers({ ...policy, allowedHosts: ["www.linkedin.com"] }, { ...job, applyUrl: "https://www.linkedin.com/jobs/view/1", salaryMin: null, unansweredQuestions: 1, submissionsToday: 1 }, capability);
  assert.ok(blocked.some(item => item.includes("not approved")));
  assert.ok(blocked.some(item => item.includes("Salary")));
  assert.ok(blocked.some(item => item.includes("questions")));
  assert.ok(blocked.some(item => item.includes("daily limit")));
});
test("human challenge pauses a permitted attempt and requires user action", () => {
  assert.ok(submissionBlockers(policy, { ...job, humanChallengePending: true }, capability).some(item => item.includes("human challenge")));
  assert.equal(classifySubmissionResponse({ status: 403, humanChallengeRequired: true }).status, "human_action_required");
  assert.equal(classifySubmissionResponse({ status: 403, blocked: true, humanChallengeRequired: true }).status, "needs_review");
});
test("only provider evidence confirms a submission; uncertain outcomes cannot be retried automatically", () => {
  assert.deepEqual(classifySubmissionResponse({ status: 200, confirmationId: "abc" }), { status: "submitted_confirmed", confirmationId: "abc" });
  assert.equal(classifySubmissionResponse({ status: 200 }).status, "submitted_unverified");
  assert.equal(classifySubmissionResponse({ status: 500 }).status, "submitted_unverified");
  assert.equal(classifySubmissionResponse({ status: 429 }).status, "needs_review");
  assert.equal(classifySubmissionResponse({ status: 403 }).status, "needs_review");
});
