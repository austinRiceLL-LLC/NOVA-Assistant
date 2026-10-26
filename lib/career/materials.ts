import { normalizeWords } from "./core.ts";

export type ApprovedFact = { id: string; claim: string; sourceLabel: string; approvedAt: number };
export type BaseResume = { id: string; version: number; content: string; approvedAt: number };
export type JobContext = { id: string; employer: string; title: string; description: string; location: string; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null };
export type DraftPolicy = { allowedEmployers: string[]; locations: string[]; minimumSalary: number; dailyCap: number; status: "draft" };

const stop = new Set(["the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "have", "will", "our", "their", "job", "work", "role", "team", "experience", "years"]);
function terms(value: string): Set<string> { return new Set(normalizeWords(value).split(" ").filter(word => word.length > 2 && !stop.has(word))); }

export function buildResumeMaterial(base: BaseResume, facts: ApprovedFact[], job: JobContext) {
  if (!base.approvedAt || !base.content.trim()) throw new Error("Approve a base resume before preparing materials");
  const corpus = terms(`${job.title} ${job.description}`);
  const eligible = facts.filter(fact => fact.approvedAt > 0 && fact.claim.trim() && fact.sourceLabel.trim());
  const ranked = eligible.map(fact => ({ fact, score: [...terms(fact.claim)].filter(term => corpus.has(term)).length }))
    .sort((a, b) => b.score - a.score || a.fact.claim.localeCompare(b.fact.claim));
  const chosen = ranked.filter(item => item.score > 0).slice(0, 8).map(item => item.fact);
  const baseline = base.content.trim();
  const content = chosen.length ? `${baseline}\n\nRELEVANT APPROVED QUALIFICATIONS\n${chosen.map(fact => `- ${fact.claim}`).join("\n")}` : baseline;
  return { content, factIds: chosen.map(fact => fact.id), baseResumeId: base.id, noMatchedFacts: chosen.length === 0 };
}

export function reviewBlockers(job: JobContext, hasResume: boolean, approvedFactCount: number): string[] {
  const blockers: string[] = [];
  if (!hasResume) blockers.push("No approved base resume");
  if (!approvedFactCount) blockers.push("No approved career facts");
  if (job.salaryMin === null || job.salaryCurrency !== "USD") blockers.push("Annual USD salary is unknown");
  const description = normalizeWords(job.description);
  if (/\b(clearance|security clearance|secret|top secret)\b/.test(description)) blockers.push("Clearance requirement needs a verified answer");
  if (/\b(citizenship|work authorization|sponsorship|visa|export control)\b/.test(description)) blockers.push("Work authorization or legal requirement needs a verified answer");
  if (/\b(self identification|disability|veteran status|demographic)\b/.test(description)) blockers.push("Sensitive questionnaire requires manual review");
  return blockers;
}

export function validatePolicyDraft(value: unknown): DraftPolicy {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const strings = (key: string) => {
    const items = row[key];
    if (!Array.isArray(items) || items.length > 30 || items.some(item => typeof item !== "string" || !item.trim() || item.length > 120)) throw new Error(`Invalid ${key}`);
    return [...new Set(items.map(item => (item as string).trim()))];
  };
  const minimumSalary = Number(row.minimumSalary); const dailyCap = Number(row.dailyCap);
  if (!Number.isInteger(minimumSalary) || minimumSalary < 0 || minimumSalary > 1000000) throw new Error("Invalid minimum salary");
  if (!Number.isInteger(dailyCap) || dailyCap < 0 || dailyCap > 10) throw new Error("Invalid daily cap");
  return { allowedEmployers: strings("allowedEmployers"), locations: strings("locations"), minimumSalary, dailyCap, status: "draft" };
}
