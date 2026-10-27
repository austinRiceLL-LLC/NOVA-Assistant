import { employerIsExcluded, normalizeWords } from "./core.ts";

export type SubmissionPolicy = {
  status: "disabled" | "paused" | "active";
  version: number;
  allowedEmployers: string[];
  allowedHosts: string[];
  locations: string[];
  jobClasses: string[];
  minimumSalary: number;
  dailyCap: number;
  approvedAt: number | null;
};

export type SubmissionCandidate = {
  jobId: string;
  employer: string;
  title: string;
  location: string;
  applyUrl: string | null;
  eligibility: "eligible" | "review" | "excluded";
  salaryMin: number | null;
  salaryCurrency: string | null;
  artifactId: string | null;
  artifactCurrent: boolean;
  dryRunCompleted: boolean;
  unansweredQuestions: number;
  humanChallengePending: boolean;
  alreadyAttempted: boolean;
  submissionsToday: number;
};

export type SiteCapability = {
  host: string;
  method: "employer_authorized_api";
  evidenceUrl: string;
  verifiedAt: number;
  credentialConfigured: boolean;
  formVerified: boolean;
};

const restrictedHosts = new Set(["linkedin.com", "www.linkedin.com", "indeed.com", "www.indeed.com", "joinhandshake.com", "app.joinhandshake.com", "ziprecruiter.com", "www.ziprecruiter.com"]);

function applyHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    if (restrictedHosts.has(host) || [...restrictedHosts].some(item => host.endsWith(`.${item}`))) return null;
    return host;
  } catch { return null; }
}

export function submissionBlockers(policy: SubmissionPolicy, candidate: SubmissionCandidate, capability: SiteCapability | null): string[] {
  const blockers: string[] = [];
  const host = applyHost(candidate.applyUrl);
  if (policy.status !== "active" || !policy.approvedAt) blockers.push("Standing submission policy is not active");
  if (!policy.version || policy.dailyCap < 1 || policy.dailyCap > 2 || candidate.submissionsToday >= policy.dailyCap) blockers.push("Pilot daily limit is unavailable or reached");
  if (!policy.allowedEmployers.some(item => normalizeWords(item) === normalizeWords(candidate.employer))) blockers.push("Employer is not explicitly allowed");
  if (employerIsExcluded(candidate.employer, ["Booz Allen", "Amazon"])) blockers.push("Employer is excluded");
  if (!policy.locations.some(item => normalizeWords(item).length > 0 && normalizeWords(candidate.location).includes(normalizeWords(item)))) blockers.push("Location is outside the standing policy");
  if (!policy.jobClasses.some(item => normalizeWords(item).length > 0 && normalizeWords(candidate.title).includes(normalizeWords(item)))) blockers.push("Job class is outside the standing policy");
  if (candidate.eligibility !== "eligible") blockers.push("Eligibility requires review");
  if (candidate.salaryCurrency !== "USD" || candidate.salaryMin === null || candidate.salaryMin < policy.minimumSalary) blockers.push("Salary does not meet the verified annual USD minimum");
  if (!host || !policy.allowedHosts.includes(host)) blockers.push("Employer application host is not approved");
  if (!capability || !host || capability.host !== host || capability.method !== "employer_authorized_api" || !capability.evidenceUrl || !capability.verifiedAt || !capability.credentialConfigured || !capability.formVerified) blockers.push("No verified permitted submission capability for this site");
  if (!candidate.artifactId || !candidate.artifactCurrent) blockers.push("Current approved application material is missing");
  if (!candidate.dryRunCompleted) blockers.push("A successful dry run is required");
  if (candidate.unansweredQuestions > 0) blockers.push("Application questions require human answers");
  if (candidate.humanChallengePending) blockers.push("Complete the site's human challenge before this attempt can continue");
  if (candidate.alreadyAttempted) blockers.push("An attempt already exists for this job");
  return blockers;
}

export type SubmissionOutcome =
  | { status: "submitted_confirmed"; confirmationId: string }
  | { status: "submitted_unverified"; reason: string }
  | { status: "human_action_required"; reason: string }
  | { status: "needs_review"; reason: string }
  | { status: "failed"; reason: string };

export function classifySubmissionResponse(response: { status: number; confirmationId?: string | null; blocked?: boolean; humanChallengeRequired?: boolean }): SubmissionOutcome {
  if (response.blocked || response.status === 401 || response.status === 429) return { status: "needs_review", reason: "Provider blocked or limited the request; no automatic retry" };
  if (response.humanChallengeRequired) return { status: "human_action_required", reason: "Site requested a human challenge; pause for the applicant and do not auto-retry" };
  if (response.status === 403) return { status: "needs_review", reason: "Provider blocked or limited the request; no automatic retry" };
  if (response.status >= 200 && response.status < 300 && response.confirmationId?.trim()) return { status: "submitted_confirmed", confirmationId: response.confirmationId.trim() };
  if (response.status >= 200 && response.status < 300) return { status: "submitted_unverified", reason: "Provider success response lacks a confirmation identifier" };
  if (response.status >= 500) return { status: "submitted_unverified", reason: "Provider outcome is uncertain; reconcile before retry" };
  return { status: "failed", reason: "Provider rejected the application" };
}
