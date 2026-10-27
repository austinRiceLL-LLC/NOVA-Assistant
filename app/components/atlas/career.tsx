"use client";
import { useEffect, useMemo, useState } from "react";
import type { CareerPreferences, CareerSource, Provider } from "@/lib/career/core";
import { CareerPhase2 } from "./career-phase2";
import { CareerPilot } from "./career-pilot";
import { CareerOverview } from "./career-overview";
import { CareerStorage } from "./career-storage";
import { suggestedCareerSources } from "@/lib/career/source-catalog";

type Job = { id: string; employer: string; title: string; location: string; workplaceType: string | null; salaryMin: number | null; salaryMax: number | null; salaryCurrency: string | null; description: string; sourceUrl: string; applyUrl: string | null; provider: string; discoveredAt: number; availability: string; evaluation: { eligibility: string; fitScore: number; reasons: string[]; uncertainties: string[] } };
type Run = { id: string; status: string; sourceCount: number; processedSourceCount: number; currentSource: string | null; fetchedCount: number; savedCount: number; errors: string[]; startedAt: number; completedAt: number | null };
type State = { preferences: CareerPreferences; sources: CareerSource[]; jobs: Job[]; runs: Run[]; schedulerEnabled: false; applicationsEnabled: false };
type Tab = "overview" | "jobs" | "review" | "resumes" | "details" | "activity" | "applications" | "settings";
const tabs: { id: Tab; label: string }[] = [{ id: "jobs", label: "Discover" }, { id: "review", label: "Review" }, { id: "applications", label: "Applications" }, { id: "resumes", label: "Resumes" }, { id: "details", label: "Application info" }, { id: "activity", label: "Activity" }, { id: "settings", label: "Preferences" }, { id: "overview", label: "Overview" }];
const knownLogos: Record<string, string> = { aslan: "/company-logos/aslan.png", ditto: "/company-logos/ditto.svg", hackerone: "/company-logos/hackerone.png", ravenna: "/company-logos/ravenna.png", webai: "/company-logos/webai.png" };
function companyLogo(job: Job) {
  try { const board = new URL(job.sourceUrl).pathname.split("/").filter(Boolean)[0]?.toLowerCase(); if (board && knownLogos[board]) return knownLogos[board]; } catch { /* A saved posting may have a malformed legacy URL. */ }
  return knownLogos[job.employer.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null;
}
const split = (value: string) => value.split(/\n|,/).map(part => part.trim()).filter(Boolean);
const list = (items: string[]) => items.join(", ");

export function Career() {
  const [data, setData] = useState<State | null>(null); const [error, setError] = useState("");
  const [busy, setBusy] = useState(""); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("discoverable"); const [sort, setSort] = useState("fit");
  const [editing, setEditing] = useState(false); const [prefs, setPrefs] = useState<CareerPreferences | null>(null);
  const [provider, setProvider] = useState<Provider>("greenhouse"); const [boardToken, setBoardToken] = useState(""); const [employer, setEmployer] = useState("");
  const [tab, setTab] = useState<Tab>("jobs");
  const [observedAt, setObservedAt] = useState(0);
  useEffect(() => { let cancelled = false; fetch("/api/career", { cache: "no-store" }).then(async response => { const body = await response.json() as State & {error?: string}; if (!response.ok) throw new Error(body.error ?? "Career is unavailable"); if (!cancelled) { setData(body); setPrefs(body.preferences); setObservedAt(Date.now()); } }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Career is unavailable"); }); return () => { cancelled = true; }; }, []);
  useEffect(() => { if (tab !== "activity") return; let cancelled = false; const timer = window.setInterval(() => { void fetch("/api/career", { cache: "no-store" }).then(async response => { if (!response.ok) return; const state = await response.json() as State; if (!cancelled) { setData(state); setObservedAt(Date.now()); } }).catch(() => { /* Keep the last visible run and try again next interval. */ }); }, 5000); return () => { cancelled = true; window.clearInterval(timer); }; }, [tab]);
  async function act(action: string, payload: Record<string, unknown> = {}) { setBusy(action); setError(""); try { const response = await fetch("/api/career", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) }); const body = await response.json() as State & { error?: string; state?: State }; if (!response.ok) throw new Error(body.error ?? "Request failed"); const state = body.state ?? body; setData(state); setPrefs(state.preferences); if (action === "preferences") setEditing(false); if (action === "addSource") { setBoardToken(""); setEmployer(""); } } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed"); } finally { setBusy(""); } }
  const jobs = useMemo(() => (data?.jobs ?? []).filter(job => (filter === "all" || (filter === "discoverable" ? job.evaluation.eligibility !== "excluded" && job.evaluation.reasons.some(reason => reason.startsWith("Role matches ") || reason === "Adjacent AI engineering title") : job.evaluation.eligibility === filter)) && `${job.employer} ${job.title} ${job.location}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => sort === "newest" ? b.discoveredAt - a.discoveredAt : sort === "employer" ? a.employer.localeCompare(b.employer) : b.evaluation.fitScore - a.evaluation.fitScore), [data, filter, query, sort]);
  const latest = data?.runs[0];
  const suggestedRemaining = suggestedCareerSources.filter(suggestion => !data?.sources.some(source => source.provider === suggestion.provider && source.boardToken === suggestion.boardToken));
  const staleRun = latest?.status === "running" && observedAt - latest.startedAt > 10 * 60_000;
  function tabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) { const index = tabs.findIndex(item => item.id === tab); const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1; if (next < 0) return; event.preventDefault(); setTab(tabs[next].id); window.requestAnimationFrame(() => document.getElementById(`career-tab-${tabs[next].id}`)?.focus()); }
  return <section className="standard-page career-page">
    <div className="career-hero"><div><p className="eyebrow">ATLAS / CAREER INTELLIGENCE</p><h1>Find your next move.</h1><p>Focused opportunities from employer job boards, ranked for your search.</p></div><div className="career-hero-actions"><button className="secondary" type="button" onClick={() => setTab("settings")}>Search preferences</button><button className="primary" disabled={!!busy || !data?.sources.length} onClick={() => void act("discover")}>{busy === "discover" ? "Discovering…" : "↗ Run discovery"}</button></div></div>
    {error && <div className="career-error" role="alert">{error}</div>}
    {!data ? error ? <div className="empty-state"><h2>Career could not load.</h2><button className="secondary" onClick={() => window.location.reload()}>Retry</button></div> : <div className="workspace-skeleton" aria-label="Loading Career"><i /><i /><i /></div> : <>
      <div className="career-summary"><span><strong>{data.jobs.length}</strong> opportunities</span><span><strong>{data.sources.length}</strong> boards monitored</span><span className="career-run-state"><i />{latest?.status === "complete" ? "Discovery up to date" : latest?.status ?? "Ready to discover"}</span></div>
      <div className="career-tabs" role="tablist" aria-label="Career views" tabIndex={0} onKeyDown={tabKeyDown}>{tabs.map(item => <button key={item.id} type="button" role="tab" id={`career-tab-${item.id}`} aria-controls={`career-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
      <div role="tabpanel" id={`career-panel-${tab}`} aria-labelledby={`career-tab-${tab}`} className="career-tab-panel">
      {tab === "overview" && <CareerOverview />}
      {tab === "resumes" && <CareerStorage view="resumes" />}
      {tab === "details" && <CareerStorage view="details" />}
      {tab === "settings" && <><section className="career-panel" aria-labelledby="career-preferences"><div className="section-heading"><h2 id="career-preferences">Your preferences</h2><button className="secondary" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit"}</button></div>
        {editing && prefs ? <form className="career-form" onSubmit={event => { event.preventDefault(); void act("preferences", { preferences: prefs }); }}>
          <label>Target roles<textarea value={list(prefs.targetRoles)} onChange={event => setPrefs({ ...prefs, targetRoles: split(event.target.value) })} /></label>
          <label>Locations<textarea value={list(prefs.locations)} onChange={event => setPrefs({ ...prefs, locations: split(event.target.value) })} /></label>
          <label>Excluded employers<textarea value={list(prefs.excludedEmployers)} onChange={event => setPrefs({ ...prefs, excludedEmployers: split(event.target.value) })} /></label>
          <label>Approved skills <small>Add only skills you can verify.</small><textarea value={list(prefs.approvedSkills)} onChange={event => setPrefs({ ...prefs, approvedSkills: split(event.target.value) })} /></label>
          <label>Minimum annual salary, USD<input type="number" min="0" max="1000000" value={prefs.minimumSalary} onChange={event => setPrefs({ ...prefs, minimumSalary: Number(event.target.value) })} /></label>
          <button className="primary" disabled={!!busy}>{busy === "preferences" ? "Saving…" : "Save preferences"}</button></form>
          : <div className="career-preference-grid"><p><b>Roles</b>{list(data.preferences.targetRoles) || "Any"}</p><p><b>Locations</b>{list(data.preferences.locations) || "Any"}</p><p><b>Excluded</b>{list(data.preferences.excludedEmployers) || "None"}</p><p><b>Salary</b>${data.preferences.minimumSalary.toLocaleString("en-US")} if posted</p><p><b>Approved skills</b>{list(data.preferences.approvedSkills) || "None yet"}</p></div>}
      </section>
      <section className="career-panel" aria-labelledby="career-sources"><h2 id="career-sources">Public job boards</h2><p>Add a company’s Greenhouse, Lever, or Ashby board name from its careers URL.</p>
        <p>Employer boards checked for your DC and early-career search: <a href="https://jobs.lever.co/palantir" target="_blank" rel="noopener noreferrer">Palantir</a> and <a href="https://www.anduril.com/open-roles" target="_blank" rel="noopener noreferrer">Anduril</a>. These are discovery sources; application submission access has not been granted.</p>
        <div className="career-pilot-actions"><button className="secondary" disabled={!!busy || data.sources.some(source => source.provider === "lever" && source.boardToken === "palantir")} onClick={() => void act("addSource", { source: { provider: "lever", boardToken: "palantir", employer: "Palantir" } })}>Add Palantir board</button><button className="secondary" disabled={!!busy || data.sources.some(source => source.provider === "greenhouse" && source.boardToken === "andurilindustries")} onClick={() => void act("addSource", { source: { provider: "greenhouse", boardToken: "andurilindustries", employer: "Anduril" } })}>Add Anduril board</button></div>
        <div className="career-panel"><h3>Find beyond the obvious boards</h3><p>Add five public employer boards spanning AI security, edge systems, and applied AI. Atlas ranks their postings against your saved criteria; a board may have no matching opening today. Discovery checks at most 10 boards per run.</p><ul>{suggestedCareerSources.map(source => <li key={source.boardToken}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.employer}</a> · {source.focus}</li>)}</ul><button className="secondary" type="button" disabled={!!busy || !suggestedRemaining.length || data.sources.length >= 10} onClick={() => void act("addSuggestedSources")}>{suggestedRemaining.length ? "Add suggested boards" : "Suggested boards added"}</button></div>
        <form className="career-source-form" onSubmit={event => { event.preventDefault(); void act("addSource", { source: { provider, boardToken, employer } }); }}><label>Provider<select value={provider} onChange={event => setProvider(event.target.value as Provider)}><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option><option value="ashby">Ashby</option></select></label><label>Board name<input required pattern="[A-Za-z0-9_-]+" value={boardToken} onChange={event => setBoardToken(event.target.value)} placeholder="company-board" /></label><label>Employer<input required value={employer} onChange={event => setEmployer(event.target.value)} placeholder="Company name" /></label><button className="secondary" disabled={!!busy}>Add board</button></form>
        <div className="career-board-list">{data.sources.map(source => <div key={source.id}><span><b>{source.employer}</b> · {source.provider} / {source.boardToken}</span><button className="text-button" disabled={!!busy} onClick={() => void act("removeSource", { id: source.id })}>Remove</button></div>)}{!data.sources.length && <p>No boards yet. Add one to start discovery.</p>}</div>
      </section><CareerPhase2 view="settings" /></>}
      {tab === "activity" && <><section className="career-panel"><h2>What Atlas is doing</h2><p>Discovery runs only when started from this page. This view refreshes every five seconds while open.</p><p><strong>Auto-apply:</strong> off · <strong>Scheduled search:</strong> off</p>{latest?.status === "running" && !staleRun ? <p role="status">Checking {latest.currentSource ?? "job boards"} · {latest.processedSourceCount} of {latest.sourceCount} boards finished · {latest.fetchedCount} roles fetched</p> : <p role="status">{staleRun ? "The last discovery run stopped reporting progress. Check its history before starting another run." : "No discovery is running."}</p>}</section><section className="career-panel"><h3>Discovery history</h3>{data.runs.length ? <ul className="career-run-history">{data.runs.map(run => <li key={run.id}><strong>{run.status}</strong><span>{new Date(run.startedAt).toLocaleString()} · {run.processedSourceCount}/{run.sourceCount} boards · {run.fetchedCount} fetched · {run.savedCount} new</span>{run.errors.map((message, index) => <p key={index}>{message}</p>)}</li>)}</ul> : <p>No discovery runs yet.</p>}</section><CareerPhase2 view="activity" /></>}
      {tab === "applications" && <CareerPilot />}
      {tab === "jobs" && <><section className="career-results" aria-labelledby="career-results"><div className="section-heading"><div><p className="career-kicker">OPPORTUNITY FEED</p><h2 id="career-results">Discovered roles <span>{jobs.length}</span></h2></div><p className="career-results-note">Curated from your selected company boards</p></div><div className="career-filters"><input aria-label="Search roles" placeholder="Search role, company, or location" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Eligibility filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="discoverable">Target + adjacent</option><option value="all">All roles</option><option value="eligible">Eligible</option><option value="review">Needs review</option><option value="excluded">Excluded</option></select><select aria-label="Sort roles" value={sort} onChange={event => setSort(event.target.value)}><option value="fit">Best fit</option><option value="newest">Newest</option><option value="employer">Company</option></select></div>
        {!data.jobs.length ? <div className="empty-state"><h2>No roles discovered yet.</h2><p>Add a public job board and run discovery. Roles will appear here with reasons and uncertainties.</p></div> : !jobs.length ? <div className="empty-state"><h2>No roles match these filters.</h2></div> : <CareerTable jobs={jobs} />}
      </section></>}
      {tab === "review" && <CareerPhase2 view="review" />}
      </div>
    </>}
  </section>;
}

function CareerTable({ jobs }: { jobs: Job[] }) {
  return <div className="career-job-list">{jobs.map(job => {
    const logo = companyLogo(job);
    const board = job.provider.charAt(0).toUpperCase() + job.provider.slice(1);
    const salary = job.salaryMin !== null && job.salaryCurrency === "USD" ? `From $${job.salaryMin.toLocaleString("en-US")}` : "Salary not listed";
    return <article className="career-result-card" key={job.id}>
      <div className="career-result-main">
        <div className="career-result-identity">
          {logo ? <span className="career-company-logo" role="img" aria-label={`${job.employer} logo`} style={{ backgroundImage: `url("${logo}")` }} /> : <span className="career-company-logo career-company-monogram" aria-hidden="true">{job.employer.slice(0, 2).toUpperCase()}</span>}
          <div><p className="career-company-name">{job.employer}</p><h3>{job.title}</h3><div className="career-result-meta"><span>{job.location}</span>{job.workplaceType && !job.location.toLowerCase().includes(job.workplaceType.toLowerCase()) && <span>{job.workplaceType}</span>}<span>{salary}</span></div></div>
        </div>
        <div className="career-result-score"><strong>{job.evaluation.fitScore}</strong><span>FIT SCORE</span></div>
      </div>
      <div className="career-result-foot"><div className="career-result-provenance"><span className={`career-result-status status-${job.evaluation.eligibility}`}>{job.evaluation.eligibility === "review" ? "Needs review" : job.evaluation.eligibility}</span><span>Found on <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">{board} ↗</a></span><span>{new Date(job.discoveredAt).toLocaleDateString()}</span></div><div className="career-result-actions"><a className="career-result-open" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">View posting ↗</a></div></div>
      <details className="career-result-details"><summary>Why this role <span>＋</span></summary><div className="career-result-detail"><h4>Match signals</h4><ul>{job.evaluation.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>{job.evaluation.uncertainties.length > 0 && <><h4>Check before applying</h4><ul>{job.evaluation.uncertainties.map(reason => <li key={reason}>{reason}</li>)}</ul></>}<p>{job.description || "No description provided by this board."}</p></div></details>
    </article>;
  })}</div>;
}
