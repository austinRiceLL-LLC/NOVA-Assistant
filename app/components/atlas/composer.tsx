"use client";
import { useState, type FormEvent } from "react";
import { AtlasMark } from "./atlas-mark";
import { Icon } from "./icon";
export function AtlasComposer({ onSend, busy, disabled, context, compact = false, onStop }: { onSend: (text: string) => void; busy?: boolean; disabled?: boolean; context?: string; compact?: boolean; onStop?: () => void }) {
  const [value, setValue] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (!value.trim() || busy || disabled) return; onSend(value.trim()); setValue(""); }
  return <form className={`atlas-composer${compact ? " compact" : ""}`} onSubmit={submit}>
    {context && <div className="composer-context"><Icon name="inbox" size={14} /><span>{context}</span></div>}
    <div className="composer-input"><AtlasMark size={28} state={busy ? "thinking" : "idle"} />
      <textarea aria-label={context ? "Ask Atlas about this message" : "Ask Atlas"} placeholder={context ? "Ask Atlas about this message…" : "Ask Atlas anything about your workspace…"} value={value} onChange={e => setValue(e.target.value)} rows={compact ? 1 : 2} maxLength={2000} disabled={disabled}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
      {busy && onStop ? <button type="button" className="composer-send" aria-label="Stop response" onClick={onStop}><Icon name="close" size={18} /></button> : <button className="composer-send" aria-label="Send to Atlas" disabled={!value.trim() || busy || disabled}><Icon name="send" size={18} /></button>}
    </div>
    {!compact && <div className="composer-foot"><span>Grounded in your saved workspace</span><span>Enter to ask <kbd>↵</kbd></span></div>}
  </form>;
}
