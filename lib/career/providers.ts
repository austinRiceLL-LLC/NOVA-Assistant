import { normalizePosting, type CareerJob, type CareerSource } from "./core.ts";

export function feedUrl(source: CareerSource) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(source.boardToken)) throw new Error("Invalid board token");
  const token = encodeURIComponent(source.boardToken);
  if (source.provider === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
  if (source.provider === "lever") return `https://api.lever.co/v0/postings/${token}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`;
}

export async function fetchPostings(source: CareerSource, fetcher: typeof fetch = fetch): Promise<CareerJob[]> {
  const response = await fetcher(feedUrl(source), { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${source.provider} returned HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error("Job board response is too large");
  const parsed: unknown = JSON.parse(body);
  const items = source.provider === "lever" ? parsed : (parsed && typeof parsed === "object" && "jobs" in parsed ? parsed.jobs : null);
  if (!Array.isArray(items)) throw new Error("Unexpected job board response");
  return items.slice(0, 500).filter(item => source.provider !== "ashby" || !(item && typeof item === "object" && "isListed" in item && item.isListed === false))
    .map(item => normalizePosting(source, item)).filter((job): job is CareerJob => job !== null);
}
