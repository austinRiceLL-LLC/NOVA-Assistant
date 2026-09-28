import { useEffect, useRef } from "react";
import type { ChatTurn } from "@/lib/atlas/workspace";
import { AtlasMark, AtlasStatus } from "./atlas-mark";
import { AppLogo } from "./app-logo";
import { AtlasComposer } from "./composer";
import { Icon } from "./icon";
export function Chat({ turns, busy, status, onSend, onOpen, onNew, onStop, context }: { turns: ChatTurn[]; busy: boolean; status: string; onSend: (text: string) => void; onOpen: (id: string) => void; onNew: () => void; onStop: () => void; context?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => { const el = scrollRef.current; if (el && follow.current) el.scrollTop = el.scrollHeight; }, [turns, busy]);
  return <div className="chat-workspace"><header className="chat-heading"><div><p className="eyebrow">A clearer way forward</p><h1>Ask Atlas</h1></div><button className="secondary" onClick={onNew} disabled={busy}><Icon name="plus" size={16} />New conversation</button></header>
    <div className="chat-scroll" ref={scrollRef} onScroll={e => { const el = e.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
      {!turns.length && <div className="chat-welcome"><AtlasMark size={64} /><h2>Let’s make sense of your day.</h2><p>Ask about your messages, find what matters, or work through a reply.</p><div className="suggestion-row">{["What needs my attention?", "Find interview messages", "Summarize my inbox"].map(text => <button key={text} onClick={() => onSend(text)}>{text}<Icon name="arrow" size={14} /></button>)}</div></div>}
      {turns.map(turn => <article className={`chat-turn ${turn.role}`} key={turn.id}><div className="turn-label">{turn.role === "assistant" && <AtlasMark size={22} />}<span>{turn.role === "assistant" ? "Atlas" : "You"}</span></div><p className="turn-text">{turn.text}</p>{turn.references?.length ? <div className="chat-sources">{turn.references.map(ref => <button key={ref.id} className="chat-source" onClick={() => onOpen(ref.id)}><AppLogo provider={ref.source} size={18} /><div><strong>{ref.title}</strong><p>{ref.summary}</p>{ref.requiresResponse && <small>May need a reply</small>}</div><Icon name="arrow" size={16} /></button>)}</div> : null}</article>)}
      {busy && <div className="thinking-row"><AtlasStatus state="thinking">{status || "Reviewing your workspace…"}</AtlasStatus></div>}
    </div>
    <div className="chat-composer-wrap"><AtlasComposer onSend={onSend} busy={busy} onStop={onStop} context={context} /><p className="assistant-disclosure">Atlas uses saved sources and message signals. Review drafts and recommendations before acting.</p></div>
  </div>;
}
