"use client";
import { useEffect, useState } from "react";

type PilotState = { status: string; policyVersion: number; verifiedSiteCount: number; liveAdapterAvailable: boolean; autonomousSubmissionsEnabled: boolean; applications: { id: string; employer: string; title: string; status: string; confirmationId: string | null }[] };

export function CareerPilot() {
  const [data, setData] = useState<PilotState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    <h3 id="career-pilot-heading">Auto-apply pilot</h3>
    <p>Automatic submissions are off. A public posting does not grant application API access. Atlas needs a permitted employer flow, verified form requirements, approved answers, and your standing policy before this can start.</p>
    {error && <div className="career-error" role="alert">{error}</div>}
    {!data ? <p>Loading pilot status…</p> : <>
      <p><strong>State:</strong> {data.status} · <strong>Verified submission sites:</strong> {data.verifiedSiteCount} · <strong>Live adapter:</strong> {data.liveAdapterAvailable ? "available" : "unavailable"}</p>
      <div className="career-pilot-actions"><button className="secondary" disabled={busy || data.status !== "active"} onClick={() => void stop("pause")}>Pause agent</button><button className="secondary" disabled={busy || data.status === "disabled"} onClick={() => void stop("disable")}>Disable auto-apply</button></div>
      <h4>Application record</h4>
      {data.applications.length ? <ul className="career-audit">{data.applications.map(item => <li key={item.id}>{item.employer} · {item.title} · {item.status}{item.confirmationId ? ` · Confirmation ${item.confirmationId}` : ""}</li>)}</ul> : <p>No application attempts. Preparation and dry-run previews are listed above.</p>}
    </>}
  </section>;
}
