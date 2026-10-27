export const careerNetworks = [
  { id: "indeed", name: "Indeed", url: "https://www.indeed.com/jobs", method: "Saved listings and alerts" },
  { id: "ziprecruiter", name: "ZipRecruiter", url: "https://www.ziprecruiter.com/jobs", method: "Saved listings and alerts" },
  { id: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/jobs/", method: "Saved listings and alerts" },
  { id: "handshake", name: "Handshake", url: "https://app.joinhandshake.com/stu/jobs", method: "Saved listings and alerts" },
] as const;

export type CareerNetwork = (typeof careerNetworks)[number]["id"];
export type NetworkListingInput = { url: string; title: string; employer: string; location: string; notes?: string };
export type ValidNetworkListing = NetworkListingInput & { network: CareerNetwork; url: string };
export type NetworkAlertLink = { url: string; network: CareerNetwork; emailTitle: string; occurredAt: number };

function cleanUrl(raw: string): URL | null {
  if (raw.length > 2048) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    url.hash = "";
    return url;
  } catch { return null; }
}

/** Only direct listing URLs are accepted. No network page is fetched here. */
export function normalizeNetworkJobUrl(raw: string): { network: CareerNetwork; url: string } | null {
  const parsed = cleanUrl(raw);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;
  if (["indeed.com", "www.indeed.com", "m.indeed.com"].includes(host)) {
    if (!["/viewjob", "/rc/clk", "/jobs"].includes(path)) return null;
    const id = parsed.searchParams.get("jk");
    if (!id || !/^[a-zA-Z0-9]{8,32}$/.test(id)) return null;
    return { network: "indeed", url: `https://www.indeed.com/viewjob?jk=${id}` };
  }
  if (["ziprecruiter.com", "www.ziprecruiter.com"].includes(host)) {
    if (!/^\/(?:job|jobs)\/[a-zA-Z0-9][a-zA-Z0-9/_-]{3,500}$/i.test(path)) return null;
    return { network: "ziprecruiter", url: `https://www.ziprecruiter.com${path.replace(/\/$/, "")}` };
  }
  if (["linkedin.com", "www.linkedin.com"].includes(host)) {
    const id = /^\/(?:comm\/)?jobs\/view\/(\d{6,20})(?:\/|$)/.exec(path)?.[1];
    return id ? { network: "linkedin", url: `https://www.linkedin.com/jobs/view/${id}/` } : null;
  }
  if (host === "app.joinhandshake.com") {
    const id = /^\/(?:stu\/)?jobs\/(\d{4,20})(?:\/|$)/.exec(path)?.[1];
    return id ? { network: "handshake", url: `https://app.joinhandshake.com/stu/jobs/${id}` } : null;
  }
  return null;
}

export function validateNetworkListing(input: unknown): ValidNetworkListing {
  const row = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const url = typeof row.url === "string" ? normalizeNetworkJobUrl(row.url) : null;
  if (!url) throw new Error("Enter a direct Indeed, ZipRecruiter, LinkedIn, or Handshake job link.");
  function field(name: "title" | "employer" | "location", max: number) {
    const value = typeof row[name] === "string" ? row[name].trim() : "";
    if (value.length < 2 || value.length > max) throw new Error(`Enter a ${name} between 2 and ${max} characters.`);
    return value;
  }
  const notes = typeof row.notes === "string" ? row.notes.trim() : "";
  if (notes.length > 2000) throw new Error("Notes must be 2,000 characters or less.");
  return { network: url.network, url: url.url, title: field("title", 180), employer: field("employer", 120), location: field("location", 120), notes };
}

export function extractNetworkAlertLinks(messages: Array<{ title: string; content: string; occurredAt: number }>, limit = 25): NetworkAlertLink[] {
  const links: NetworkAlertLink[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    for (const match of `${message.title}\n${message.content}`.matchAll(/https:\/\/[^\s<>"']+/g)) {
      const normalized = normalizeNetworkJobUrl(match[0].replace(/[),.;\]]+$/, ""));
      if (!normalized || seen.has(normalized.url)) continue;
      seen.add(normalized.url);
      links.push({ ...normalized, emailTitle: message.title.slice(0, 180), occurredAt: message.occurredAt });
      if (links.length >= limit) return links;
    }
  }
  return links;
}
