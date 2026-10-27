export type Provider = "greenhouse" | "lever" | "ashby";
export type CareerSource = { id: string; provider: Provider; boardToken: string; employer: string; active: boolean };
export type CareerPreferences = {
  targetRoles: string[]; locations: string[]; excludedEmployers: string[];
  approvedSkills: string[]; minimumSalary: number;
};
export type CareerJob = {
  id?: string; sourceId: string; dedupeKey: string; provider: Provider; externalId: string | null;
  employer: string; title: string; location: string; workplaceType: string | null;
  salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null;
  description: string; sourceUrl: string; applyUrl: string | null; postedAt: number | null;
  discoveredAt?: number; lastSeenAt?: number; availability?: string; metadataJson: string;
};
export type Evaluation = { eligibility: "excluded" | "review" | "eligible"; fitScore: number; reasons: string[]; uncertainties: string[] };

export const DEFAULT_PREFERENCES: CareerPreferences = {
  targetRoles: ["AI Engineer", "AI/ML Engineer", "Machine Learning Engineer", "Applied AI Engineer", "Forward Deployed Software Engineer", "Solutions Engineer", "AI Analyst", "Data Scientist"],
  locations: ["Washington, DC", "Northern Virginia", "New York City", "East Coast", "Remote"],
  excludedEmployers: ["Booz Allen", "Amazon"],
  approvedSkills: [],
  minimumSalary: 110000,
};

export function normalizeWords(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
export function employerIsExcluded(employer: string, exclusions: string[]) {
  const name = normalizeWords(employer);
  return exclusions.some(raw => {
    const term = normalizeWords(raw);
    return term.length >= 3 && (name === term || name.startsWith(`${term} `) || name.endsWith(` ${term}`) || (term === "amazon" && (name === "aws" || name.startsWith("aws "))));
  });
}
function locationMatchesPreference(location: string, preference: string) {
  const place = normalizeWords(location).replace(/\bd c\b/g, "dc");
  const wanted = normalizeWords(preference).replace(/\bd c\b/g, "dc");
  if (place.includes(wanted)) return true;
  if (wanted === "new york city") return /\bnew york(?: city| ny)?\b/.test(place);
  if (wanted === "northern virginia") return /\b(?:arlington|alexandria|reston|tysons|mclean|fairfax|falls church|herndon)(?: va| virginia)?\b/.test(place);
  return false;
}
function adjacentAiTitle(title: string, targetRoles: string[]) {
  if (!targetRoles.some(role => /\b(ai|ml|machine learning|data scientist)\b/i.test(role))) return false;
  return /\b(?:ai|ml|llm|genai|agentic) (?:product |platform |infrastructure |evaluation |solutions |security )?(?:engineer|developer)\b/.test(title)
    || /\b(?:software|product|platform|infrastructure|solutions|security) engineer\b.*\b(?:ai|ml|llm|genai|agentic)\b/.test(title);
}
export function evaluateJob(job: CareerJob, prefs: CareerPreferences): Evaluation {
  if (employerIsExcluded(job.employer, prefs.excludedEmployers))
    return { eligibility: "excluded", fitScore: 0, reasons: [`Excluded employer: ${job.employer}`], uncertainties: [] };
  const title = normalizeWords(job.title);
  const description = normalizeWords(job.description);
  const roleMatches = prefs.targetRoles.filter(role => (` ${title} `).includes(` ${normalizeWords(role)} `));
  const adjacentRole = !roleMatches.length && adjacentAiTitle(title, prefs.targetRoles);
  const location = normalizeWords(`${job.location} ${job.workplaceType ?? ""}`);
  const locationMatches = prefs.locations.filter(item => locationMatchesPreference(location, item));
  const skillMatches = prefs.approvedSkills.filter(skill => description.includes(normalizeWords(skill)));
  const reasons: string[] = [];
  const uncertainties: string[] = [];
  let score = 0;
  if (roleMatches.length) { score += 50; reasons.push(`Role matches ${roleMatches[0]}`); }
  else if (adjacentRole) { score += 35; reasons.push("Adjacent AI engineering title"); uncertainties.push("Adjacent title needs your review"); }
  else uncertainties.push("Title does not match a target role");
  if (locationMatches.length) { score += 25; reasons.push(`Location matches ${locationMatches[0]}`); }
  else uncertainties.push("Location preference needs review");
  if (job.salaryMin !== null && job.salaryCurrency === "USD") {
    if (job.salaryMin >= prefs.minimumSalary) { score += 15; reasons.push(`Posted salary starts at $${job.salaryMin.toLocaleString("en-US")}`); }
    else if (job.salaryMax !== null && job.salaryMax < prefs.minimumSalary) reasons.push("Posted salary range is below preference");
    else uncertainties.push("Posted salary range crosses the minimum preference");
  } else uncertainties.push("Salary is unknown or not a comparable annual USD minimum");
  if (skillMatches.length) { score += 10; reasons.push(`Approved skill mentioned: ${skillMatches.slice(0, 3).join(", ")}`); }
  else uncertainties.push(prefs.approvedSkills.length ? "No approved skills found in description" : "No skills approved in your profile yet");
  if (/\b(senior|staff|principal|director|lead)\b/.test(title)) uncertainties.push("Seniority may exceed early career preference");
  if (/\b(clearance|citizenship|years of experience|year experience)\b/.test(description)) uncertainties.push("Posting requirements need human review");
  const belowSalary = job.salaryMax !== null && job.salaryCurrency === "USD" && job.salaryMax < prefs.minimumSalary;
  const eligibility = belowSalary ? "excluded" : !roleMatches.length || !locationMatches.length || uncertainties.some(reason => reason.includes("human review") || reason.includes("Seniority")) ? "review" : "eligible";
  return { eligibility, fitScore: score, reasons, uncertainties };
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function str(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function object(value: unknown): Record<string, unknown> { return record(value); }
function validUrl(value: unknown): string | null {
  try { const url = new URL(str(value)); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}
function date(value: unknown): number | null { const time = Date.parse(str(value)); return Number.isFinite(time) ? time : null; }
function plain(value: string) { return value.replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot|#39);/g, " ").replace(/\s+/g, " ").trim().slice(0, 20000); }
function salary(value: unknown) { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; }
function metadata(value: unknown) { const json = JSON.stringify(value); return json.length <= 10000 ? json : JSON.stringify({ truncated: true, preview: json.slice(0, 9500) }); }

export function normalizePosting(source: CareerSource, input: unknown): CareerJob | null {
  const row = record(input);
  const title = str(row.title) || str(row.text);
  const employer = source.employer;
  const externalId = row.id === undefined || row.id === null ? null : String(row.id);
  let location = "Unknown"; let description = ""; let sourceUrl: string | null = null;
  let applyUrl: string | null = null; let postedAt: number | null = null; let workplaceType: string | null = null;
  let salaryMin: number | null = null; let salaryMax: number | null = null; let salaryCurrency: string | null = null;
  if (source.provider === "greenhouse") {
    location = str(object(row.location).name) || location;
    description = plain(str(row.content)); sourceUrl = validUrl(row.absolute_url);
    applyUrl = sourceUrl; postedAt = date(row.updated_at);
  } else if (source.provider === "lever") {
    location = str(object(row.categories).location) || location;
    description = plain(str(row.descriptionPlain) || str(row.description));
    sourceUrl = validUrl(row.hostedUrl); applyUrl = validUrl(row.applyUrl);
    postedAt = typeof row.createdAt === "number" ? row.createdAt : null;
    workplaceType = str(row.workplaceType) || null;
    const range = object(row.salaryRange);
    if (str(range.interval).toLowerCase().includes("year") && str(range.currency).toUpperCase() === "USD") {
      salaryMin = salary(range.min); salaryMax = salary(range.max); salaryCurrency = "USD";
    }
  } else {
    location = str(row.location) || location;
    description = plain(str(row.descriptionPlain) || str(row.descriptionHtml));
    sourceUrl = validUrl(row.jobUrl); applyUrl = validUrl(row.applyUrl);
    postedAt = date(row.publishedAt); workplaceType = str(row.workplaceType) || (row.isRemote === true ? "Remote" : null);
    const compensation = object(row.compensation);
    const components = Array.isArray(compensation.summaryComponents) ? compensation.summaryComponents : [];
    const annual = components.map(object).find(c => c.compensationType === "Salary" && c.currencyCode === "USD" && str(c.interval).includes("YEAR"));
    if (annual) { salaryMin = salary(annual.minValue); salaryMax = salary(annual.maxValue); salaryCurrency = "USD"; }
  }
  if (!title || !sourceUrl) return null;
  const identity = externalId ? `${source.provider}:${source.boardToken}:${externalId}` : `${normalizeWords(employer)}:${normalizeWords(title)}:${normalizeWords(location)}:${sourceUrl.split("?")[0]}`;
  return { sourceId: source.id, dedupeKey: identity, provider: source.provider, externalId, employer, title,
    location, workplaceType, salaryMin, salaryMax, salaryCurrency, description, sourceUrl, applyUrl,
    postedAt, metadataJson: metadata(row) };
}

export function validatePreferences(value: unknown): CareerPreferences {
  const row = record(value);
  function strings(key: string, max = 20) {
    const items = row[key];
    if (!Array.isArray(items) || items.length > max || items.some(item => typeof item !== "string" || item.trim().length > 100)) throw new Error(`Invalid ${key}`);
    return [...new Set(items.map(item => (item as string).trim()).filter(Boolean))];
  }
  const minimumSalary = Number(row.minimumSalary);
  if (!Number.isInteger(minimumSalary) || minimumSalary < 0 || minimumSalary > 1000000) throw new Error("Invalid minimumSalary");
  return { targetRoles: strings("targetRoles"), locations: strings("locations"), excludedEmployers: strings("excludedEmployers"), approvedSkills: strings("approvedSkills", 50), minimumSalary };
}
