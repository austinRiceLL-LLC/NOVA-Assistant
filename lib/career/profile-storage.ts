import { env } from "cloudflare:workers";
import { ensureUser, type NovaUser } from "@/lib/nova/persistence";
import { emptyApplicationProfile, validateApplicationProfile, validateResumeFile, type ApplicationProfileData } from "./application-profile";

function db() { const database = (env as unknown as { DB?: D1Database }).DB; if (!database) throw new Error("Career storage is unavailable"); return database; }
type ProfileRow = { version: number; data_json: string; approved_at: number | null; updated_at: number };
type FileRow = { id: string; filename: string; media_type: string; byte_length: number; sha256: string; uploaded_at: number; selected_at: number | null };
export async function loadApplicationProfile(user: NovaUser) {
  const row = await db().prepare("SELECT version,data_json,approved_at,updated_at FROM career_application_profiles WHERE user_id=?").bind(user.userId).first<ProfileRow>();
  let data: ApplicationProfileData = emptyApplicationProfile(); let valid = true;
  if (row) { try { data = validateApplicationProfile(JSON.parse(row.data_json)); } catch { valid = false; } }
  return { data, version: row?.version ?? 0, approvedAt: valid ? row?.approved_at ?? null : null, updatedAt: row?.updated_at ?? null };
}
export async function saveApplicationProfile(user: NovaUser, input: unknown) {
  const data = validateApplicationProfile(input); await ensureUser(user); const now = Date.now();
  await db().prepare(`INSERT INTO career_application_profiles (user_id,version,data_json,approved_at,updated_at) VALUES (?,1,?,NULL,?)
    ON CONFLICT(user_id) DO UPDATE SET version=version+1,data_json=excluded.data_json,approved_at=NULL,updated_at=excluded.updated_at`)
    .bind(user.userId,JSON.stringify(data),now).run();
  return loadApplicationProfile(user);
}
export async function approveApplicationProfile(user: NovaUser, version: number) {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("Invalid application details version");
  const current = await loadApplicationProfile(user);
  if (!current.data.fullName || !current.data.email) throw new Error("Enter a legal name and email before approving application details");
  const result = await db().prepare("UPDATE career_application_profiles SET approved_at=?,updated_at=? WHERE user_id=? AND version=? AND approved_at IS NULL")
    .bind(Date.now(),Date.now(),user.userId,version).run();
  if (!result.meta.changes) throw new Error("Save and review the latest application details first");
  return loadApplicationProfile(user);
}
export async function listResumeFiles(user: NovaUser) {
  const rows = await db().prepare("SELECT id,filename,media_type,byte_length,sha256,uploaded_at,selected_at FROM career_resume_files WHERE user_id=? AND archived_at IS NULL ORDER BY uploaded_at DESC LIMIT 50").bind(user.userId).all<FileRow>();
  return rows.results.map(row => ({ id:row.id, filename:row.filename, mediaType:row.media_type, byteLength:row.byte_length, sha256:row.sha256, uploadedAt:row.uploaded_at, selectedAt:row.selected_at }));
}
export async function uploadResumeFile(user: NovaUser, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer()); const mediaType = validateResumeFile(file.name,bytes);
  await ensureUser(user);
  const count = await db().prepare("SELECT COUNT(*) AS count FROM career_resume_files WHERE user_id=? AND archived_at IS NULL").bind(user.userId).first<{count:number}>();
  if ((count?.count ?? 0) >= 20) throw new Error("Archive a resume before uploading more than 20 files");
  const digest = await crypto.subtle.digest("SHA-256",bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("");
  await db().prepare("INSERT INTO career_resume_files (id,user_id,filename,media_type,byte_length,sha256,content,uploaded_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),user.userId,file.name,mediaType,bytes.length,sha256,bytes,Date.now()).run();
  return listResumeFiles(user);
}
export async function archiveResumeFile(user: NovaUser, id: string) {
  const result = await db().prepare("UPDATE career_resume_files SET archived_at=? WHERE user_id=? AND id=? AND archived_at IS NULL").bind(Date.now(),user.userId,id).run();
  if (!result.meta.changes) throw new Error("Resume file not found");
  return listResumeFiles(user);
}
export async function selectResumeFile(user: NovaUser, id: string) {
  const owned = await db().prepare("SELECT id FROM career_resume_files WHERE user_id=? AND id=? AND archived_at IS NULL").bind(user.userId,id).first();
  if (!owned) throw new Error("Resume file not found");
  await db().batch([
    db().prepare("UPDATE career_resume_files SET selected_at=NULL WHERE user_id=? AND selected_at IS NOT NULL").bind(user.userId),
    db().prepare("UPDATE career_resume_files SET selected_at=? WHERE user_id=? AND id=? AND archived_at IS NULL").bind(Date.now(),user.userId,id),
  ]);
  return listResumeFiles(user);
}
export async function downloadResumeFile(user: NovaUser, id: string) {
  return db().prepare("SELECT filename,media_type,content FROM career_resume_files WHERE user_id=? AND id=? AND archived_at IS NULL").bind(user.userId,id).first<{filename:string;media_type:string;content:number[]|ArrayBuffer}>();
}
