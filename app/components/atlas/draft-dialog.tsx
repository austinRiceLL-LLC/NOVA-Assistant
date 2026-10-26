"use client";
import { useState } from "react";
import { Dialog } from "./dialog";
import { Icon } from "./icon";
import { api } from "./use-workspace";
import type { NovaActionProposal } from "@/lib/nova-ai/types";
export type DraftData = { recipient: string; subject: string; body: string; sourceId: string };
export function DraftDialog({ initial, accountId, onClose, onDone }: { initial: DraftData; accountId?: string; onClose: () => void; onDone: (message: string) => void }) {
  const [draft, setDraft] = useState(initial);
  const [proposal, setProposal] = useState<NovaActionProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  function update(key: keyof DraftData, value: string) { setDraft(current => ({ ...current, [key]: value })); setProposal(null); }
  async function review() {
    if (!accountId) return;
    setBusy(true); setError("");
    try { setProposal(await api<NovaActionProposal>("/api/nova/actions/propose", { intent: "SEND_REPLY", accountId, targetId: draft.sourceId || "compose", summary: `Send “${draft.subject}” to ${draft.recipient}`, arguments: { recipient_email: draft.recipient, subject: draft.subject, body: draft.body } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not prepare your email."); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!proposal || busy) return;
    setBusy(true); setError("");
    try { const result = await api<{ status: string; message: string; receiptId: string }>("/api/nova/actions/execute", { proposal, confirmedProposalId: proposal.id }); const text = result.status === "simulated" ? "Simulation complete. No email was sent." : result.message; setReceipt(text); setProposal(null); onDone(text); }
    catch (e) { setError(e instanceof Error ? e.message : "Sending failed. Your draft is still here."); setProposal(null); } finally { setBusy(false); }
  }
  return <Dialog title={receipt ? "Email result" : "Draft email"} onClose={() => { if (!busy) onClose(); }} className="draft-dialog">{receipt ? <div className="draft-success" role="status"><Icon name="check" size={32} /><h3>{receipt}</h3><button className="primary" onClick={onClose}>Done</button></div> : <form onSubmit={e => { e.preventDefault(); void review(); }}>
    <p className="dialog-intro">Make it yours. Atlas sends only after you review and confirm.</p>
    <label>To<input type="email" required value={draft.recipient} onChange={e => update("recipient", e.target.value)} placeholder="name@example.com" disabled={busy} /></label>
    <label>Subject<input required value={draft.subject} onChange={e => update("subject", e.target.value)} disabled={busy} /></label>
    <label>Message<textarea required rows={9} value={draft.body} onChange={e => update("body", e.target.value)} disabled={busy} /></label>
    {error && <p role="alert" className="error-text">{error}</p>}
    {!accountId && <p>Connect Gmail to send this email. You can still copy your draft.</p>}
    {proposal && <aside className="confirmation-preview"><h3>Ready to send?</h3><p><strong>To:</strong> {String(proposal.arguments.recipient_email)}</p><p><strong>Subject:</strong> {String(proposal.arguments.subject)}</p><p className="confirmation-body">{String(proposal.arguments.body)}</p><small>Changing any field resets this confirmation.</small></aside>}
    <footer><button type="button" className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(draft.body); setError("Draft copied."); } catch { setError("Clipboard unavailable. Select and copy the message text."); } }}>Copy draft</button>{proposal ? <button type="button" className="primary" onClick={() => void confirm()} disabled={busy}>{busy ? "Sending…" : "Confirm send"}<Icon name="arrow" size={16} /></button> : <button className="primary" disabled={!accountId || busy}>{busy ? "Preparing…" : "Review before sending"}<Icon name="arrow" size={16} /></button>}</footer>
  </form>}</Dialog>;
}
