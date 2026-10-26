import { env } from "cloudflare:workers";
import { ensureUser, type NovaUser } from "@/lib/nova/persistence";
import { buildResumeMaterial, reviewBlockers, validatePolicyDraft, type ApprovedFact, type BaseResume, type JobContext } from "./materials";

function db() { const database = (env as unknown as { DB?: D1Database }).DB; if (!database) throw new Error("Career storage is unavailable"); return database; }
function strings(value: string): string[] { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
type FactRow = { id: string; claim: string; source_label: string; approved_at: number };
type ResumeRow = { id: string; version: number; content: string; approved_at: number };
type JobRow = { id: string; employer: string; title: string; description: string; location: string; salary_min: number | null; salary_max: number | null; salary_currency: string | null; eligibility?: string };
type ArtifactRow = { id: string; job_id: string; version: number; content: string; fact_ids_json: string; checksum: string; created_at: number };
function fact(row: FactRow): ApprovedFact { return { id: row.id, claim: row.claim, sourceLabel: row.source_label, approvedAt: row.approved_at }; }
function resume(row: ResumeRow): BaseResume { return { id: row.id, version: row.version, content: row.content, approvedAt: row.approved_at }; }
function job(row: JobRow): JobContext { return { id: row.id, employer: row.employer, title: row.title, description: row.description, location: row.location, salaryMin: row.salary_min, salaryMax: row.salary_max, salaryCurrency: row.salary_currency }; }
async function latestResume(userId: string) { const row = await db().prepare("SELECT id,version,content,approved_at FROM career_base_resumes WHERE user_id=? ORDER BY version DESC LIMIT 1").bind(userId).first<ResumeRow>(); return row ? resume(row) : null; }
async function activeFacts(userId: string) { const result = await db().prepare("SELECT id,claim,source_label,approved_at FROM career_profile_facts WHERE user_id=? AND revoked_at IS NULL ORDER BY approved_at DESC LIMIT 100").bind(userId).all<FactRow>(); return result.results.map(fact); }
async function ownedJob(userId: string, jobId: string) {
  const row = await db().prepare("SELECT j.id,j.employer,j.title,j.description,j.location,j.salary_min,j.salary_max,j.salary_currency,e.eligibility FROM career_jobs j LEFT JOIN career_evaluations e ON e.job_id=j.id AND e.user_id=? WHERE j.user_id=? AND j.id=?")
    .bind(userId,userId,jobId).first<JobRow>();
  if (!row) throw new Error("Job not found");
  return row;
}
async function event(userId: string, jobId: string, artifactId: string | null, action: string, details: Record<string, unknown>) {
  await db().prepare("INSERT INTO career_dry_run_events (id,user_id,job_id,artifact_id,action,details_json,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),userId,jobId,artifactId,action,JSON.stringify(details),Date.now()).run();
}

export async function loadPhase2(user: NovaUser) {
  await ensureUser(user);
  const [facts, base, policyRow, queueResult, eventsResult] = await Promise.all([
    activeFacts(user.userId), latestResume(user.userId),
    db().prepare("SELECT * FROM career_policy_drafts WHERE user_id=?").bind(user.userId).first<{allowed_employers_json:string;locations_json:string;minimum_salary:number;daily_cap:number}>(),
    db().prepare(`SELECT j.id,j.employer,j.title,j.description,j.location,j.salary_min,j.salary_max,j.salary_currency,e.eligibility,r.status,r.blockers_json,r.artifact_id,a.version AS artifact_version
      FROM career_jobs j LEFT JOIN career_evaluations e ON e.job_id=j.id AND e.user_id=?
      LEFT JOIN career_review_items r ON r.job_id=j.id AND r.user_id=?
      LEFT JOIN career_artifacts a ON a.id=r.artifact_id AND a.user_id=?
      WHERE j.user_id=? AND COALESCE(e.eligibility,'review') != 'excluded' ORDER BY j.discovered_at DESC LIMIT 100`).bind(user.userId,user.userId,user.userId,user.userId).all<JobRow & {status:string|null;blockers_json:string|null;artifact_id:string|null;artifact_version:number|null}>(),
    db().prepare("SELECT id,job_id,action,artifact_id,created_at FROM career_dry_run_events WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.userId).all<{id:string;job_id:string;action:string;artifact_id:string|null;created_at:number}>(),
  ]);
  const queue = queueResult.results.map(row => ({ jobId: row.id, employer: row.employer, title: row.title, eligibility: row.eligibility ?? "review", status: row.status ?? "needs_review", artifactId: row.artifact_id, artifactVersion: row.artifact_version,
    blockers: [...new Set([...reviewBlockers(job(row), !!base, facts.length),...strings(row.blockers_json ?? "[]")])] }));
  const policy = policyRow ? { allowedEmployers: strings(policyRow.allowed_employers_json), locations: strings(policyRow.locations_json), minimumSalary: policyRow.minimum_salary, dailyCap: policyRow.daily_cap, status: "draft" as const }
    : { allowedEmployers: [], locations: [], minimumSalary: 110000, dailyCap: 0, status: "draft" as const };
  return { facts, baseResume: base ? { id: base.id, version: base.version, content: base.content, approvedAt: base.approvedAt } : null, policy, queue,
    events: eventsResult.results.map(row => ({ id: row.id, jobId: row.job_id, action: row.action, artifactId: row.artifact_id, createdAt: row.created_at })), applicationsEnabled: false, policyCanActivate: false };
}

export async function approveFact(user: NovaUser, input: unknown) {
  const row = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const claim = typeof row.claim === "string" ? row.claim.trim() : "";
  const sourceLabel = typeof row.sourceLabel === "string" ? row.sourceLabel.trim() : "";
  if (row.approved !== true || !claim || claim.length > 600 || !sourceLabel || sourceLabel.length > 160) throw new Error("Enter a claim, its source, and confirm approval");
  await ensureUser(user); const now = Date.now();
  await db().prepare("INSERT INTO career_profile_facts (id,user_id,claim,source_label,approved_at,created_at) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),user.userId,claim,sourceLabel,now,now).run();
}
export async function revokeFact(user: NovaUser, id: string) {
  await db().prepare("UPDATE career_profile_facts SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(Date.now(),id,user.userId).run();
}
export async function approveResume(user: NovaUser, input: unknown) {
  const row = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const content = typeof row.content === "string" ? row.content.trim() : "";
  if (row.approved !== true || content.length < 50 || content.length > 30000) throw new Error("Paste a resume of 50 to 30,000 characters and confirm its accuracy");
  await ensureUser(user);
  const last = await db().prepare("SELECT MAX(version) AS version FROM career_base_resumes WHERE user_id=?").bind(user.userId).first<{version:number|null}>();
  const next = (last?.version ?? 0) + 1; const now = Date.now();
  await db().prepare("INSERT INTO career_base_resumes (id,user_id,version,content,approved_at,created_at) VALUES (?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),user.userId,next,content,now,now).run();
  return next;
}
export async function savePolicyDraft(user: NovaUser, input: unknown) {
  const draft = validatePolicyDraft(input); await ensureUser(user);
  await db().prepare(`INSERT INTO career_policy_drafts (user_id,allowed_employers_json,locations_json,minimum_salary,daily_cap,status,updated_at) VALUES (?,?,?,?,?,'draft',?)
    ON CONFLICT(user_id) DO UPDATE SET allowed_employers_json=excluded.allowed_employers_json,locations_json=excluded.locations_json,minimum_salary=excluded.minimum_salary,daily_cap=excluded.daily_cap,status='draft',updated_at=excluded.updated_at`)
    .bind(user.userId,JSON.stringify(draft.allowedEmployers),JSON.stringify(draft.locations),draft.minimumSalary,draft.dailyCap,Date.now()).run();
  return draft;
}
export async function prepareMaterial(user: NovaUser, jobId: string) {
  await ensureUser(user); const jobRow = await ownedJob(user.userId,jobId);
  if (jobRow.eligibility === "excluded") throw new Error("Excluded jobs cannot receive a draft");
  const base = await latestResume(user.userId); if (!base) throw new Error("Approve a base resume first");
  const facts = await activeFacts(user.userId);
  const material = buildResumeMaterial(base,facts,job(jobRow));
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(material.content));
  const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,"0")).join("");
  const prior = await db().prepare("SELECT MAX(version) AS version FROM career_artifacts WHERE user_id=? AND job_id=?").bind(user.userId,jobId).first<{version:number|null}>();
  const version = (prior?.version ?? 0) + 1; const id = crypto.randomUUID(); const now = Date.now();
  await db().prepare("INSERT INTO career_artifacts (id,user_id,job_id,base_resume_id,version,content,fact_ids_json,checksum,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id,user.userId,jobId,base.id,version,material.content,JSON.stringify(material.factIds),checksum,now).run();
  const blockers = reviewBlockers(job(jobRow),true,facts.length);
  if (material.noMatchedFacts) blockers.push("No approved facts matched this posting");
  await db().prepare(`INSERT INTO career_review_items (job_id,user_id,status,blockers_json,artifact_id,updated_at) VALUES (?,?,'draft_ready',?,?,?)
    ON CONFLICT(job_id) DO UPDATE SET status='draft_ready',blockers_json=excluded.blockers_json,artifact_id=excluded.artifact_id,updated_at=excluded.updated_at`)
    .bind(jobId,user.userId,JSON.stringify(blockers),id,now).run();
  await event(user.userId,jobId,id,"material_prepared",{version,baseResumeVersion:base.version,factIds:material.factIds,checksum,externalSubmission:false});
  return { id,version,content:material.content,factIds:material.factIds,checksum,blockers,externalSubmission:false };
}
export async function previewDryRun(user: NovaUser, jobId: string) {
  const jobRow = await ownedJob(user.userId,jobId);
  const artifact = await db().prepare("SELECT id,job_id,version,content,fact_ids_json,checksum,created_at FROM career_artifacts WHERE user_id=? AND job_id=? ORDER BY version DESC LIMIT 1")
    .bind(user.userId,jobId).first<ArtifactRow>();
  if (!artifact) throw new Error("Prepare materials before opening a dry-run preview");
  const facts = await activeFacts(user.userId); const base = await latestResume(user.userId);
  const blockers = reviewBlockers(job(jobRow),!!base,facts.length);
  const selectedFactIds = strings(artifact.fact_ids_json);
  if (selectedFactIds.some(id => !facts.some(fact => fact.id === id))) blockers.push("A fact used in this draft has since been revoked; prepare a new version");
  const review = await db().prepare("SELECT blockers_json FROM career_review_items WHERE user_id=? AND job_id=?").bind(user.userId,jobId).first<{blockers_json:string}>();
  for (const blocker of strings(review?.blockers_json ?? "[]")) if (!blockers.includes(blocker)) blockers.push(blocker);
  await event(user.userId,jobId,artifact.id,"dry_run_previewed",{version:artifact.version,externalSubmission:false});
  return { job: { id:jobRow.id,title:jobRow.title,employer:jobRow.employer }, artifact: { id:artifact.id,version:artifact.version,content:artifact.content,checksum:artifact.checksum,factIds:selectedFactIds }, blockers,
    screeningAnswers: [], formStatus: "not_opened", action: "Review the employer's original form manually; Atlas has not filled or submitted it.", externalSubmission:false };
}
