import { env } from "cloudflare:workers";
import { ensureUser, type NovaUser } from "@/lib/nova/persistence";
import { DEFAULT_PREFERENCES, evaluateJob, validatePreferences, type CareerJob, type CareerPreferences, type CareerSource, type Provider } from "./core";
import { fetchPostings } from "./providers";
import { suggestedCareerSources } from "./source-catalog";

function db() { const binding = (env as unknown as { DB?: D1Database }).DB; if (!binding) throw new Error("Career storage is unavailable"); return binding; }
function parseArray(value: string): string[] { try { const data: unknown = JSON.parse(value); return Array.isArray(data) ? data.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
type PreferenceRow = { target_roles_json: string; locations_json: string; excluded_employers_json: string; approved_skills_json: string; minimum_salary: number };
async function preferences(user: NovaUser): Promise<CareerPreferences> {
  const row = await db().prepare("SELECT * FROM career_preferences WHERE user_id = ?").bind(user.userId).first<PreferenceRow>();
  if (!row) return DEFAULT_PREFERENCES;
  return { targetRoles: parseArray(row.target_roles_json), locations: parseArray(row.locations_json), excludedEmployers: parseArray(row.excluded_employers_json), approvedSkills: parseArray(row.approved_skills_json), minimumSalary: row.minimum_salary };
}
type SourceRow = { id: string; provider: Provider; board_token: string; employer: string; active: number };
async function sources(user: NovaUser): Promise<CareerSource[]> {
  const result = await db().prepare("SELECT id, provider, board_token, employer, active FROM career_sources WHERE user_id = ? ORDER BY created_at DESC").bind(user.userId).all<SourceRow>();
  return result.results.map(row => ({ id: row.id, provider: row.provider, boardToken: row.board_token, employer: row.employer, active: !!row.active }));
}
export async function loadCareer(user: NovaUser) {
  await ensureUser(user);
  const [prefs, boards, jobsResult, runsResult] = await Promise.all([
    preferences(user), sources(user),
    db().prepare(`SELECT j.*, e.eligibility, e.fit_score, e.reasons_json, e.uncertainties_json FROM career_jobs j
      LEFT JOIN career_evaluations e ON e.job_id = j.id AND e.user_id = ?
      WHERE j.user_id = ? ORDER BY e.fit_score DESC, j.discovered_at DESC LIMIT 200`).bind(user.userId, user.userId).all<Record<string, unknown>>(),
    db().prepare("SELECT * FROM career_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 10").bind(user.userId).all<Record<string, unknown>>(),
  ]);
  const jobs = jobsResult.results.map(row => ({ id: String(row.id), employer: String(row.employer), title: String(row.title), location: String(row.location), workplaceType: row.workplace_type ? String(row.workplace_type) : null,
    salaryMin: row.salary_min === null ? null : Number(row.salary_min), salaryMax: row.salary_max === null ? null : Number(row.salary_max), salaryCurrency: row.salary_currency ? String(row.salary_currency) : null,
    description: String(row.description), sourceUrl: String(row.source_url), applyUrl: row.apply_url ? String(row.apply_url) : null,
    provider: String(row.provider), postedAt: row.posted_at === null ? null : Number(row.posted_at), discoveredAt: Number(row.discovered_at), lastSeenAt: Number(row.last_seen_at), availability: String(row.availability),
    evaluation: { eligibility: String(row.eligibility ?? "review"), fitScore: Number(row.fit_score ?? 0), reasons: parseArray(String(row.reasons_json ?? "[]")), uncertainties: parseArray(String(row.uncertainties_json ?? "[]")) } }));
  const runs = runsResult.results.map(row => ({ id: String(row.id), status: String(row.status), sourceCount: Number(row.source_count), processedSourceCount: Number(row.processed_source_count ?? 0) || (row.completed_at === null ? 0 : Number(row.source_count)), currentSource: row.current_source ? String(row.current_source) : null, fetchedCount: Number(row.fetched_count), savedCount: Number(row.saved_count), errors: parseArray(String(row.errors_json)), startedAt: Number(row.started_at), completedAt: row.completed_at === null ? null : Number(row.completed_at) }));
  return { preferences: prefs, sources: boards, jobs, runs, schedulerEnabled: false, applicationsEnabled: false };
}

export async function savePreferences(user: NovaUser, input: unknown) {
  const prefs = validatePreferences(input);
  await ensureUser(user);
  await db().prepare(`INSERT INTO career_preferences (user_id,target_roles_json,locations_json,excluded_employers_json,approved_skills_json,minimum_salary,updated_at)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET target_roles_json=excluded.target_roles_json,locations_json=excluded.locations_json,
    excluded_employers_json=excluded.excluded_employers_json,approved_skills_json=excluded.approved_skills_json,minimum_salary=excluded.minimum_salary,updated_at=excluded.updated_at`)
    .bind(user.userId, JSON.stringify(prefs.targetRoles), JSON.stringify(prefs.locations), JSON.stringify(prefs.excludedEmployers), JSON.stringify(prefs.approvedSkills), prefs.minimumSalary, Date.now()).run();
  const result = await db().prepare("SELECT * FROM career_jobs WHERE user_id = ? LIMIT 500").bind(user.userId).all<Record<string, unknown>>();
  for (const row of result.results) await saveEvaluation(user.userId, String(row.id), evaluateJob({ employer: String(row.employer), title: String(row.title), location: String(row.location), workplaceType: row.workplace_type ? String(row.workplace_type) : null, salaryMin: row.salary_min === null ? null : Number(row.salary_min), salaryMax: row.salary_max === null ? null : Number(row.salary_max), salaryCurrency: row.salary_currency ? String(row.salary_currency) : null, description: String(row.description) } as CareerJob, prefs));
  return prefs;
}

export async function addSource(user: NovaUser, input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const provider = value.provider;
  const boardToken = typeof value.boardToken === "string" ? value.boardToken.trim() : "";
  const employer = typeof value.employer === "string" ? value.employer.trim() : "";
  if (!["greenhouse", "lever", "ashby"].includes(String(provider)) || !/^[A-Za-z0-9_-]{1,80}$/.test(boardToken) || !employer || employer.length > 120) throw new Error("Enter a valid provider, board token, and employer");
  await ensureUser(user);
  const boards = await sources(user);
  if (boards.length >= 10 && !boards.some(board => board.provider === provider && board.boardToken === boardToken)) throw new Error("Maximum 10 public boards per discovery run");
  await db().prepare("INSERT INTO career_sources (id,user_id,provider,board_token,employer,active,created_at) VALUES (?,?,?,?,?,1,?) ON CONFLICT(user_id,provider,board_token) DO UPDATE SET employer=excluded.employer,active=1")
    .bind(crypto.randomUUID(), user.userId, provider, boardToken, employer, Date.now()).run();
}
export async function addSuggestedSources(user: NovaUser) {
  await ensureUser(user);
  const boards = await sources(user);
  for (const suggestion of suggestedCareerSources) {
    if (boards.length >= 10) break;
    if (boards.some(board => board.provider === suggestion.provider && board.boardToken === suggestion.boardToken)) continue;
    await addSource(user, suggestion);
    boards.push({ ...suggestion, id: "added", active: true });
  }
}
export async function removeSource(user: NovaUser, id: string) { await db().prepare("DELETE FROM career_sources WHERE id = ? AND user_id = ?").bind(id, user.userId).run(); }

async function saveEvaluation(userId: string, jobId: string, evaluation: ReturnType<typeof evaluateJob>) {
  await db().prepare(`INSERT INTO career_evaluations (job_id,user_id,eligibility,fit_score,reasons_json,uncertainties_json,evaluated_at)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET eligibility=excluded.eligibility,fit_score=excluded.fit_score,reasons_json=excluded.reasons_json,uncertainties_json=excluded.uncertainties_json,evaluated_at=excluded.evaluated_at`)
    .bind(jobId, userId, evaluation.eligibility, evaluation.fitScore, JSON.stringify(evaluation.reasons), JSON.stringify(evaluation.uncertainties), Date.now()).run();
}
async function saveJob(userId: string, job: CareerJob, prefs: CareerPreferences) {
  const id = crypto.randomUUID(); const now = Date.now();
  const previous = await db().prepare("SELECT id FROM career_jobs WHERE user_id = ? AND dedupe_key = ?").bind(userId,job.dedupeKey).first<{id:string}>();
  await db().prepare(`INSERT INTO career_jobs (id,user_id,source_id,dedupe_key,provider,external_id,employer,title,location,workplace_type,salary_min,salary_max,salary_currency,description,source_url,apply_url,posted_at,discovered_at,last_seen_at,availability,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,dedupe_key) DO UPDATE SET source_id=excluded.source_id,title=excluded.title,location=excluded.location,workplace_type=excluded.workplace_type,salary_min=excluded.salary_min,salary_max=excluded.salary_max,salary_currency=excluded.salary_currency,description=excluded.description,source_url=excluded.source_url,apply_url=excluded.apply_url,posted_at=excluded.posted_at,last_seen_at=excluded.last_seen_at,availability='open',metadata_json=excluded.metadata_json`)
    .bind(id,userId,job.sourceId,job.dedupeKey,job.provider,job.externalId,job.employer,job.title,job.location,job.workplaceType,job.salaryMin,job.salaryMax,job.salaryCurrency,job.description,job.sourceUrl,job.applyUrl,job.postedAt,now,now,"open",job.metadataJson).run();
  const row = await db().prepare("SELECT id FROM career_jobs WHERE user_id = ? AND dedupe_key = ?").bind(userId,job.dedupeKey).first<{id:string}>();
  if (row) await saveEvaluation(userId,row.id,evaluateJob(job,prefs));
  return !previous;
}

export async function runDiscovery(user: NovaUser) {
  await ensureUser(user);
  const recent = await db().prepare("SELECT status, started_at FROM career_runs WHERE user_id = ? ORDER BY started_at DESC LIMIT 1").bind(user.userId).first<{status:string;started_at:number}>();
  if (recent && Date.now() - recent.started_at < 60_000) throw new Error("Wait one minute before starting another discovery run");
  const boards = (await sources(user)).filter(source => source.active).slice(0, 10);
  if (!boards.length) throw new Error("Add a public job board before running discovery");
  const prefs = await preferences(user); const id = crypto.randomUUID(); const startedAt = Date.now();
  await db().prepare("INSERT INTO career_runs (id,user_id,status,source_count,fetched_count,saved_count,errors_json,started_at) VALUES (?,?, 'running', ?,0,0,'[]',?)").bind(id,user.userId,boards.length,startedAt).run();
  let fetchedCount = 0; let savedCount = 0; const errors: string[] = [];
  // Fetch at most two public feeds at once; keep storage writes sequential so run
  // progress and per-source availability updates remain deterministic.
  for (let batchStart = 0; batchStart < boards.length; batchStart += 2) {
    const batch = boards.slice(batchStart, batchStart + 2);
    await db().prepare("UPDATE career_runs SET current_source=?,processed_source_count=?,fetched_count=?,saved_count=?,errors_json=? WHERE id=? AND user_id=?")
      .bind(batch.map(board => board.employer).join(", "),batchStart,fetchedCount,savedCount,JSON.stringify(errors),id,user.userId).run();
    const results = await Promise.allSettled(batch.map(board => fetchPostings(board)));
    for (const [offset, result] of results.entries()) {
      const board = batch[offset];
      if (result.status === "fulfilled") {
        try {
          const jobs = result.value; fetchedCount += jobs.length;
          for (const job of jobs) { if (await saveJob(user.userId,job,prefs)) savedCount++; }
          if (jobs.length < 500) await db().prepare("UPDATE career_jobs SET availability = 'not_seen' WHERE user_id = ? AND source_id = ? AND last_seen_at < ?").bind(user.userId,board.id,startedAt).run();
        } catch (error) { errors.push(`${board.employer} (${board.provider}): ${error instanceof Error ? error.message : "Unknown error"}`); }
      } else errors.push(`${board.employer} (${board.provider}): ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`);
      await db().prepare("UPDATE career_runs SET processed_source_count=?,fetched_count=?,saved_count=?,errors_json=? WHERE id=? AND user_id=?")
        .bind(batchStart + offset + 1,fetchedCount,savedCount,JSON.stringify(errors),id,user.userId).run();
    }
  }
  const status = errors.length ? (fetchedCount ? "partial" : "failed") : "complete";
  await db().prepare("UPDATE career_runs SET status=?,current_source=NULL,fetched_count=?,saved_count=?,errors_json=?,completed_at=? WHERE id=? AND user_id=?")
    .bind(status,fetchedCount,savedCount,JSON.stringify(errors),Date.now(),id,user.userId).run();
  return { id,status,sourceCount:boards.length,fetchedCount,savedCount,errors };
}
