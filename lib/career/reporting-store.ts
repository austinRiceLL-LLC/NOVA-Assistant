import { env } from "cloudflare:workers";
import { ensureUser, type NovaUser } from "@/lib/nova/persistence";
import { csvDate, csvDocument } from "./reporting";

function db() { const database = (env as unknown as { DB?: D1Database }).DB; if (!database) throw new Error("Career storage is unavailable"); return database; }
type CountRow = { total: number; eligible: number; needs_review: number; salary_known: number; recent: number };
type ApplicationCountRow = { total: number; confirmed: number; unverified: number; exceptions: number; recent_confirmed: number };

export async function loadCareerReport(user: NovaUser) {
  await ensureUser(user);
  const since = Date.now() - 7 * 24 * 60 * 60_000;
  const [jobs, applications] = await Promise.all([
    db().prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN e.eligibility='eligible' THEN 1 ELSE 0 END),0) AS eligible,
      COALESCE(SUM(CASE WHEN e.eligibility='review' OR e.eligibility IS NULL THEN 1 ELSE 0 END),0) AS needs_review,
      COALESCE(SUM(CASE WHEN j.salary_min IS NOT NULL AND j.salary_currency='USD' THEN 1 ELSE 0 END),0) AS salary_known,
      COALESCE(SUM(CASE WHEN j.discovered_at>=? THEN 1 ELSE 0 END),0) AS recent
      FROM career_jobs j LEFT JOIN career_evaluations e ON e.job_id=j.id AND e.user_id=j.user_id WHERE j.user_id=?`).bind(since,user.userId).first<CountRow>(),
    db().prepare(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status='submitted_confirmed' THEN 1 ELSE 0 END),0) AS confirmed,
      COALESCE(SUM(CASE WHEN status='submitted_unverified' THEN 1 ELSE 0 END),0) AS unverified,
      COALESCE(SUM(CASE WHEN status IN ('needs_review','failed') THEN 1 ELSE 0 END),0) AS exceptions,
      COALESCE(SUM(CASE WHEN status='submitted_confirmed' AND updated_at>=? THEN 1 ELSE 0 END),0) AS recent_confirmed
      FROM career_applications WHERE user_id=?`).bind(since,user.userId).first<ApplicationCountRow>(),
  ]);
  return { jobs: { discovered: jobs?.total ?? 0, eligible: jobs?.eligible ?? 0, needsReview: jobs?.needs_review ?? 0, salaryKnown: jobs?.salary_known ?? 0, discoveredLast7Days: jobs?.recent ?? 0 },
    applications: { attempts: applications?.total ?? 0, confirmed: applications?.confirmed ?? 0, unverified: applications?.unverified ?? 0, exceptions: applications?.exceptions ?? 0, confirmedLast7Days: applications?.recent_confirmed ?? 0 },
    generatedAt: Date.now(), autonomousSubmissionsEnabled: false };
}

type JobRow = { employer:string; title:string; location:string; salary_min:number|null; salary_max:number|null; salary_currency:string|null; eligibility:string|null; fit_score:number|null; discovered_at:number; availability:string; provider:string; source_url:string; apply_url:string|null };
type ApplicationRow = { employer:string; title:string; status:string; confirmation_id:string|null; started_at:number; updated_at:number; apply_url:string|null };

export async function exportCareerCsv(user: NovaUser, kind: "jobs" | "applications") {
  await ensureUser(user);
  if (kind === "jobs") {
    const result = await db().prepare(`SELECT j.employer,j.title,j.location,j.salary_min,j.salary_max,j.salary_currency,e.eligibility,e.fit_score,j.discovered_at,j.availability,j.provider,j.source_url,j.apply_url
      FROM career_jobs j LEFT JOIN career_evaluations e ON e.job_id=j.id AND e.user_id=j.user_id WHERE j.user_id=? ORDER BY j.discovered_at DESC,j.id LIMIT 5001`).bind(user.userId).all<JobRow>();
    if (result.results.length > 5000) throw new Error("Export exceeds 5,000 jobs");
    return csvDocument(["Employer","Role","Location","Salary minimum","Salary maximum","Currency","Eligibility","Fit score","Discovered UTC","Availability","Provider","Posting URL","Employer apply URL"],
      result.results.map(row => [row.employer,row.title,row.location,row.salary_min,row.salary_max,row.salary_currency,row.eligibility,row.fit_score,csvDate(row.discovered_at),row.availability,row.provider,row.source_url,row.apply_url]));
  }
  const result = await db().prepare(`SELECT j.employer,j.title,a.status,a.confirmation_id,a.started_at,a.updated_at,j.apply_url
    FROM career_applications a JOIN career_jobs j ON j.id=a.job_id AND j.user_id=a.user_id WHERE a.user_id=? ORDER BY a.started_at DESC,a.id LIMIT 5001`).bind(user.userId).all<ApplicationRow>();
  if (result.results.length > 5000) throw new Error("Export exceeds 5,000 applications");
  return csvDocument(["Employer","Role","Status","Confirmation ID","Attempt started UTC","Last updated UTC","Employer apply URL"],
    result.results.map(row => [row.employer,row.title,row.status,row.confirmation_id,csvDate(row.started_at),csvDate(row.updated_at),row.apply_url]));
}
