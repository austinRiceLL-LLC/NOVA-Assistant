"use client";
import { useEffect, useState } from "react";
import { Dialog } from "./dialog";
import type { DraftPolicy } from "@/lib/career/materials";

type Fact = { id: string; claim: string; sourceLabel: string; approvedAt: number };
type QueueItem = { jobId: string; employer: string; title: string; eligibility: string; status: string; artifactId: string | null; artifactVersion: number | null; blockers: string[] };
type Event = { id: string; jobId: string; action: string; artifactId: string | null; createdAt: number };
type State = { facts: Fact[]; baseResume: { id: string; version: number; content: string; approvedAt: number } | null; policy: DraftPolicy; queue: QueueItem[]; events: Event[]; applicationsEnabled: false; policyCanActivate: false };
type Preview = { job?: { id: string; title: string; employer: string }; artifact?: { id: string; version: number; content: string; checksum: string; factIds: string[] }; content?: string; version?: number; checksum?: string; factIds?: string[]; blockers: string[]; externalSubmission: false; screeningAnswers?: []; formStatus?: "not_opened"; action?: string };
const split = (text: string) => text.split(/\n|,/).map(item => item.trim()).filter(Boolean);

export function CareerPhase2() {
  const [data, setData] = useState<State | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const [resumeText, setResumeText] = useState(""); const [resumeApproved, setResumeApproved] = useState(false);
  const [claim, setClaim] = useState(""); const [sourceLabel, setSourceLabel] = useState(""); const [factApproved, setFactApproved] = useState(false);
  const [policy, setPolicy] = useState<DraftPolicy | null>(null); const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => { let cancelled = false; fetch("/api/career/materials",{cache:"no-store"}).then(async response => { const body = await response.json() as State & {error?:string}; if (!response.ok) throw new Error(body.error ?? "Materials unavailable"); if (!cancelled) { setData(body); setResumeText(body.baseResume?.content ?? ""); setPolicy(body.policy); } }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Materials unavailable"); }); return () => { cancelled = true; }; }, []);
  async function act(action: string, payload: Record<string,unknown> = {}) {
    setBusy(action); setError("");
    try {
      const response = await fetch("/api/career/materials",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
      const body = await response.json() as {error?:string;state?:State;result?:Preview};
      if (!response.ok || !body.state) throw new Error(body.error ?? "Request failed");
      setData(body.state); setPolicy(body.state.policy);
      if (action === "approveFact") { setClaim(""); setSourceLabel(""); setFactApproved(false); }
      if (action === "approveResume") setResumeApproved(false);
      if (body.result) setPreview(body.result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed"); }
    finally { setBusy(""); }
  }
  function downloadPreview() {
    const content = preview?.artifact?.content ?? preview?.content; if (!content) return;
    const blob = new Blob([content],{type:"text/plain;charset=utf-8"}); const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `atlas-resume-draft-v${preview?.artifact?.version ?? preview?.version ?? 1}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="career-phase2">
    <div className="career-phase2-heading"><p className="eyebrow">Materials and review</p><h2>Prepare before you apply</h2><p>Atlas uses only the resume and claims you approve here. Drafts stay in your workspace; no application data is sent to employers.</p></div>
    {error && <div className="career-error" role="alert">{error}</div>}
    {!data ? error ? <div className="empty-state"><h2>Materials could not load.</h2><button className="secondary" onClick={() => window.location.reload()}>Retry</button></div> : <div className="workspace-skeleton" aria-label="Loading materials"><i /><i /></div> : <>
      <section className="career-panel"><h3>Approved base resume</h3><p>{data.baseResume ? `Current version ${data.baseResume.version}, approved ${new Date(data.baseResume.approvedAt).toLocaleDateString()}.` : "No approved resume yet. Paste your own plain-text resume to start."}</p>
        <form className="career-material-form" onSubmit={event => { event.preventDefault(); void act("approveResume",{resume:{content:resumeText,approved:resumeApproved}}); }}><label>Resume text<textarea required minLength={50} maxLength={30000} rows={10} value={resumeText} onChange={event => setResumeText(event.target.value)} placeholder="Paste your existing resume as plain text" /></label><label className="career-check"><input type="checkbox" checked={resumeApproved} onChange={event => setResumeApproved(event.target.checked)} />I reviewed this resume and approve its claims for drafts.</label><button className="secondary" disabled={!!busy || !resumeApproved}>{busy === "approveResume" ? "Saving…" : "Save approved version"}</button></form>
      </section>
      <section className="career-panel"><h3>Verified career facts</h3><p>Add exact claims with a source you can check. Atlas copies them verbatim when they match a posting.</p>
        <form className="career-material-form" onSubmit={event => { event.preventDefault(); void act("approveFact",{fact:{claim,sourceLabel,approved:factApproved}}); }}><label>Claim<input required maxLength={600} value={claim} onChange={event => setClaim(event.target.value)} placeholder="Built a retrieval system using Python and BM25" /></label><label>Source or evidence label<input required maxLength={160} value={sourceLabel} onChange={event => setSourceLabel(event.target.value)} placeholder="Resume project section, portfolio, transcript…" /></label><label className="career-check"><input type="checkbox" checked={factApproved} onChange={event => setFactApproved(event.target.checked)} />I verify this claim is accurate.</label><button className="secondary" disabled={!!busy || !factApproved}>Add approved fact</button></form>
        <div className="career-facts">{data.facts.map(fact => <div key={fact.id}><p>{fact.claim}<small>Source: {fact.sourceLabel}</small></p><button className="text-button" disabled={!!busy} onClick={() => void act("revokeFact",{id:fact.id})}>Revoke</button></div>)}{!data.facts.length && <p>No approved facts yet.</p>}</div>
      </section>
      <section className="career-panel"><h3>Application policy draft</h3><p>Save proposed limits for a future pilot. This draft cannot activate automatic applications.</p>
        {policy && <form className="career-policy-form" onSubmit={event => { event.preventDefault(); void act("savePolicyDraft",{policy}); }}><label>Allowed employers<textarea value={policy.allowedEmployers.join(", ")} onChange={event => setPolicy({...policy,allowedEmployers:split(event.target.value)})} /></label><label>Locations<textarea value={policy.locations.join(", ")} onChange={event => setPolicy({...policy,locations:split(event.target.value)})} /></label><label>Minimum annual salary, USD<input type="number" min="0" max="1000000" value={policy.minimumSalary} onChange={event => setPolicy({...policy,minimumSalary:Number(event.target.value)})} /></label><label>Proposed daily cap<input type="number" min="0" max="10" value={policy.dailyCap} onChange={event => setPolicy({...policy,dailyCap:Number(event.target.value)})} /></label><button className="secondary" disabled={!!busy}>Save draft policy</button><strong>Draft only · auto-apply off</strong></form>}
      </section>
      <section className="career-panel"><h3>Review queue</h3><p>Prepare a versioned resume draft for a discovered role, then inspect the dry-run preview and blockers.</p>
        <div className="career-queue">{data.queue.map(item => <article key={item.jobId}><div><h4>{item.title}</h4><p>{item.employer} · {item.eligibility === "review" ? "Needs eligibility review" : "Eligible for review"} · {item.artifactVersion ? `Draft v${item.artifactVersion}` : "No draft"}</p><ul>{item.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></div><div><button className="secondary" disabled={!!busy || !data.baseResume} onClick={() => void act("prepare",{jobId:item.jobId})}>{busy === "prepare" ? "Preparing…" : "Prepare draft"}</button><button className="text-button" disabled={!!busy || !item.artifactId} onClick={() => void act("preview",{jobId:item.jobId})}>Dry-run preview</button></div></article>)}{!data.queue.length && <div className="empty-state"><h2>No roles in the review queue.</h2><p>Discover roles first. Excluded employers and clearly sub-target salary ranges stay out of this queue.</p></div>}</div>
      </section>
      <section className="career-panel"><h3>Dry-run audit</h3><p>These events record local preparation and previews only.</p><ul className="career-audit">{data.events.map(item => <li key={item.id}><span>{item.action.replaceAll("_"," ")}</span><time>{new Date(item.createdAt).toLocaleString()}</time></li>)}{!data.events.length && <li>No dry-run activity yet.</li>}</ul></section>
    </>}
    {preview && <Dialog title={preview.job ? `Dry-run preview: ${preview.job.title}` : `Resume draft v${preview.version}`} onClose={() => setPreview(null)} className="career-preview-dialog"><p>Employer form: not opened. Screening answers: none prepared. No application data was transmitted.</p>{preview.blockers.length > 0 && <><h3>Review before any future application</h3><ul>{preview.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></>}<h3>Versioned resume text</h3><pre>{preview.artifact?.content ?? preview.content}</pre><footer><button className="secondary" onClick={downloadPreview}>Download text draft</button><button className="primary" onClick={() => setPreview(null)}>Close</button></footer></Dialog>}
  </div>;
}
