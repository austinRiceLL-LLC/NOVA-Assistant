import type { CareerSource } from "./core";

// Public employer boards observed on their ATS-hosted careers pages in October 2026.
// These are discovery suggestions, not evidence of a currently open role.
export const suggestedCareerSources: ReadonlyArray<Pick<CareerSource, "provider" | "boardToken" | "employer"> & { url: string; focus: string }> = [
  { provider: "ashby", boardToken: "aslan", employer: "Aslan", url: "https://jobs.ashbyhq.com/aslan", focus: "National security AI" },
  { provider: "ashby", boardToken: "ditto", employer: "Ditto", url: "https://jobs.ashbyhq.com/ditto", focus: "Edge AI and developer tools" },
  { provider: "ashby", boardToken: "hackerone", employer: "HackerOne", url: "https://jobs.ashbyhq.com/hackerone", focus: "AI security" },
  { provider: "ashby", boardToken: "ravenna", employer: "Ravenna", url: "https://jobs.ashbyhq.com/ravenna", focus: "Applied AI products" },
  { provider: "ashby", boardToken: "webai", employer: "webAI", url: "https://jobs.ashbyhq.com/webai", focus: "Distributed AI systems" },
];
