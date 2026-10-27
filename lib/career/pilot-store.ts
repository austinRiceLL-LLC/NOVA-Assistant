import { env } from "cloudflare:workers";
import { ensureUser, type NovaUser } from "@/lib/nova/persistence";

function db() { const database = (env as unknown as { DB?: D1Database }).DB; if (!database) throw new Error("Career storage is unavailable"); return database; }

export async function loadPilot(user: NovaUser) {
  await ensureUser(user);
  const [control, applications, sites, events] = await Promise.all([
    db().prepare("SELECT status,policy_version,approved_at FROM career_apply_controls WHERE user_id=?").bind(user.userId).first<{status:string;policy_version:number;approved_at:number|null}>(),
    db().prepare("SELECT a.id,a.job_id,a.status,a.started_at,a.updated_at,a.confirmation_id,j.employer,j.title,j.apply_url FROM career_applications a JOIN career_jobs j ON j.id=a.job_id AND j.user_id=a.user_id WHERE a.user_id=? ORDER BY a.started_at DESC LIMIT 50").bind(user.userId).all<{id:string;job_id:string;status:string;started_at:number;updated_at:number;confirmation_id:string|null;employer:string;title:string;apply_url:string|null}>(),
    db().prepare("SELECT COUNT(*) AS total FROM career_site_capabilities WHERE enabled=1 AND form_verified=1").first<{total:number}>(),
    db().prepare("SELECT e.id,e.application_id,e.to_status,e.reason,e.created_at,j.employer,j.title FROM career_application_events e JOIN career_applications a ON a.id=e.application_id AND a.user_id=e.user_id JOIN career_jobs j ON j.id=a.job_id AND j.user_id=a.user_id WHERE e.user_id=? ORDER BY e.created_at DESC LIMIT 50").bind(user.userId).all<{id:string;application_id:string;to_status:string;reason:string;created_at:number;employer:string;title:string}>(),
  ]);
  return { status: control?.status ?? "disabled", policyVersion: control?.policy_version ?? 0, approvedAt: control?.approved_at ?? null,
    verifiedSiteCount: sites?.total ?? 0, liveAdapterAvailable: false, autonomousSubmissionsEnabled: false, humanChallengeMode: "pause_for_user" as const,
    applications: applications.results.map(row => ({ id: row.id, jobId: row.job_id, employer: row.employer, title: row.title, applyUrl: row.apply_url, status: row.status, startedAt: row.started_at, updatedAt: row.updated_at, confirmationId: row.confirmation_id })),
    events: events.results.map(row => ({ id: row.id, applicationId: row.application_id, employer: row.employer, title: row.title, status: row.to_status, reason: row.reason, createdAt: row.created_at })) };
}

export async function stopPilot(user: NovaUser, action: "pause" | "disable") {
  await ensureUser(user);
  const now = Date.now();
  if (action === "disable") {
    await db().prepare("INSERT INTO career_apply_controls (user_id,status,policy_version,policy_json,updated_at) VALUES (?,'disabled',0,'{}',?) ON CONFLICT(user_id) DO UPDATE SET status='disabled',policy_version=0,policy_json='{}',approved_at=NULL,updated_at=excluded.updated_at")
      .bind(user.userId,now).run();
  } else {
    await db().prepare("UPDATE career_apply_controls SET status='paused',updated_at=? WHERE user_id=? AND status='active'").bind(now,user.userId).run();
  }
  return loadPilot(user);
}
