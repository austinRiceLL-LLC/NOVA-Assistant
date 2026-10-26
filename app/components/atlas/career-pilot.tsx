"use client";
import { useEffect, useState } from "react";

type PilotState = { status: string; policyVersion: number; verifiedSiteCount: number; liveAdapterAvailable: boolean; autonomousSubmissionsEnabled: boolean; applications: { id: string; employer: string; title: string; applyUrl: string | null; status: string; startedAt: number; updatedAt: number; confirmationId: string | null }[]; events: { id: string; employer: string; title: string; status: string; reason: string; createdAt: number }[] };
const label = (status: string) => ({ submitted_confirmed: "Applied · confirmed", submitted_unverified: "Submission needs verification", needs_review: "Needs review", reserved: "Pending attempt" } as Record<string,string>)[status] ?? status.replaceAll("_", " ");

export function CareerPilot() {
  const [data, setData] = useState<PilotState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() { const response = await fetch("/api/career/pilot", { cache: "no-store" }); const body = await response.json() as PilotState & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Pilot status unavailable"); setData(body); }
  useEffect(() => { let active = true; fetch("/api/career/pilot", { cache: "no-store" }).then(async response => { const body = await response.json() as PilotState & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Pilot status unavailable"); if (active) setData(body); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Pilot status unavailable"); }); return () => { active = false; }; }, []);
  async function stop(action: "pause" | "disable") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/career/pilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const body = await response.json() as PilotState & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not update pilot");
      setData(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update pilot"); }
    finally { setBusy(false); }
  }
  return <section className="career-panel" aria-labelledby="career-pilot-heading">
    <div className="section-heading"><h2 id="career-pilot-heading">Applications</h2><button className="secondary" type="button" onClick={() => void refresh().catch(cause => setError(cause instanceof Error ? cause.message : "Pilot status unavailable"))}>Refresh</button></div>
    <p>Automatic submissions are off. A public posting does not grant application API access. Atlas needs a permitted employer flow, verified form requirements, approved answers, and your standing policy before this can start.</p>
    {error && <div className="career-error" role="alert">{error}</div>}
    {!data ? <p>Loading pilot status…</p> : <>
      <p><strong>State:</strong> {data.status} · <strong>Verified submission sites:</strong> {data.verifiedSiteCount} · <strong>Live adapter:</strong> {data.liveAdapterAvailable ? "available" : "unavailable"}</p>
      <div className="career-pilot-actions"><button className="secondary" disabled={busy || data.status !== "active"} onClick={() => void stop("pause")}>Pause agent</button><button className="secondary" disabled={busy || data.status === "disabled"} onClick={() => void stop("disable")}>Disable auto-apply</button></div>
      <h3>Application record</h3>
      {data.applications.length ? <ul className="career-application-list">{data.applications.map(item => <li key={item.id}><div><strong>{item.employer} · {item.title}</strong><p>{label(item.status)} · Last updated {new Date(item.updatedAt).toLocaleString()}</p>{item.confirmationId && <p>Employer confirmation: {item.confirmationId}</p>}</div>{item.applyUrl && <a href={item.applyUrl} target="_blank" rel="noopener noreferrer">Employer page ↗</a>}</li>)}</ul> : <p>No application attempts have been recorded. Review drafts and discovery history in the other Career tabs.</p>}
      <h3>Application activity</h3>
      {data.events.length ? <ul className="career-audit">{data.events.map(item => <li key={item.id}><span><strong>{item.employer} · {item.title}</strong><br />{label(item.status)} · {item.reason}</span><time>{new Date(item.createdAt).toLocaleString()}</time></li>)}</ul> : <p>No submission activity yet.</p>}
    </>}
  </section>;
}
