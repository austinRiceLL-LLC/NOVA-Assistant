export const applicationFields = [
  "fullName", "preferredName", "email", "phone", "city", "region", "country",
  "linkedinUrl", "portfolioUrl", "githubUrl", "school", "degree", "graduationDate",
  "availability", "workAuthorization", "sponsorship", "clearance", "additionalInformation",
] as const;
export type ApplicationField = typeof applicationFields[number];
export type ApplicationProfileData = Record<ApplicationField, string>;
export const emptyApplicationProfile = (): ApplicationProfileData => Object.fromEntries(applicationFields.map(field => [field, ""])) as ApplicationProfileData;

const limits: Partial<Record<ApplicationField, number>> = { additionalInformation: 2000 };
const urls = new Set<ApplicationField>(["linkedinUrl", "portfolioUrl", "githubUrl"]);
export function validateApplicationProfile(input: unknown): ApplicationProfileData {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid application details");
  const record = input as Record<string, unknown>;
  if (Object.keys(record).some(key => !applicationFields.includes(key as ApplicationField))) throw new Error("Invalid application detail field");
  const result = emptyApplicationProfile();
  for (const field of applicationFields) {
    const value = record[field] ?? "";
    if (typeof value !== "string" || value.length > (limits[field] ?? 300) || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error(`Invalid ${field} value`);
    const trimmed = value.trim();
    if (urls.has(field) && trimmed) {
      try { const url = new URL(trimmed); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); }
      catch { throw new Error(`Enter an HTTPS URL for ${field}`); }
    }
    result[field] = trimmed;
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error("Enter a valid email address");
  return result;
}

export const maxResumeBytes = 750_000;
export type ResumeKind = "text/plain" | "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export function validateResumeFile(name: string, bytes: Uint8Array): ResumeKind {
  if (!name || name.length > 160 || [...name].some(character => character === "/" || character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error("Invalid resume filename");
  if (bytes.length === 0 || bytes.length > maxResumeBytes) throw new Error("Resume file must be 750 KB or smaller");
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (extension === "docx" && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "txt") {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!decoded.includes("\0")) return "text/plain";
  }
  throw new Error("Upload a valid PDF, DOCX, or UTF-8 TXT resume");
}
