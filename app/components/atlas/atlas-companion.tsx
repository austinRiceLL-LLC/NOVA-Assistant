"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AtlasMark, AtlasStatus } from "./atlas-mark";
import { AppLogo } from "./app-logo";
import { Icon } from "./icon";
import { buildBriefing, relativeTime, sourceIntelligence, type ChatTurn, type Connection, type Source } from "@/lib/atlas/workspace";
import { parseSourceTitle } from "@/lib/nova-ai/source-title";

export type AtlasSurface = "edge" | "brief" | "workspace";

export function AtlasCompanion({ surface, onSurface, sources, connections, turns, busy, status, onAsk, onOpen, onDraft, onApps }: {
  surface: AtlasSurface; onSurface(value: AtlasSurface): void; sources: Source[]; connections: Connection[]; turns: ChatTurn[]; busy: boolean; status: string;
  onAsk(text: string, sourceId?: string): void; onOpen(source: Source): void; onDraft(source: Source): void; onApps(): void;
}) {
  const briefing = useMemo(() => buildBriefing(sources), [sources]);
  const [provider, setProvider] = useState("all");
  const [query, setQuery] = useState("");
  const [ask, setAsk] = useState("");
  const [active, setActive] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const askRef = useRef<HTMLInputElement>(null);
  const feed = (briefing.attention.length ? briefing.attention : briefing.ranked).slice(0, 8);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sources.filter(item => (provider === "all" || item.provider === provider) && (!normalized || `${item.title} ${item.summary} ${item.content}`.toLowerCase().includes(normalized))).slice(0, 12);
  }, [sources, provider, query]);
  const connectedProviders = [...new Set(connections.filter(item => item.status === "active").map(item => item.provider))];
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null; const typing = target?.matches("input,textarea,[contenteditable=true]");
      if (event.altKey && event.key.toLowerCase() === "a") { event.preventDefault(); onSurface(surface === "brief" ? "edge" : "brief"); }
      if (surface !== "brief") return;
      if (event.key === "Escape") { event.preventDefault(); onSurface("edge"); }
      if (!typing && event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "l") { event.preventDefault(); askRef.current?.focus(); }
      if (!typing && (event.key === "ArrowDown" || event.key === "ArrowUp")) { event.preventDefault(); setActive(value => Math.max(0, Math.min((query ? results.length : feed.length) - 1, value + (event.key === "ArrowDown" ? 1 : -1)))); }
      if (!typing && event.key === "Enter") { const item = query ? results[active] : feed[active]?.source; if (item) onOpen(item); }
      if (!typing && event.key.toLowerCase() === "r") { const item = query ? results[active] : feed[active]?.source; if (item && sourceIntelligence(item).requiresResponse) onDraft(item); }
    }
    document.addEventListener("keydown", keydown); return () => document.removeEventListener("keydown", keydown);
  }, [surface, active, query, results, feed, onSurface, onOpen, onDraft]);
  if (surface === "workspace") return <button className="workspace-minimize" onClick={() => onSurface("edge")} title="Minimize to Atlas Edge"><AtlasMark size={22} /><span>Minimize</span></button>;
  if (surface === "edge") return <><div className="native-drag-handle" title="Drag Atlas" /><button className={`atlas-edge ${briefing.attention.length ? "has-attention" : ""}`} onClick={() => onSurface("brief")} aria-label={`Open Atlas Brief. ${briefing.attention.length} ${briefing.attention.length === 1 ? "thing needs" : "things need"} attention.`} title={`Atlas · ${briefing.attention.length ? `${briefing.attention.length} need attention` : "You're caught up"}`}><AtlasMark size={34} state={busy ? "thinking" : briefing.attention.length ? "working" : "idle"} />{briefing.attention.length > 0 && <b>{Math.min(briefing.attention.length, 9)}</b>}<span>Atlas</span></button></>;

  const providerName = provider === "all" ? "everything" : connections.find(item => item.provider === provider)?.label ?? provider;
  return <><button className="brief-scrim" aria-label="Collapse Atlas Brief" onClick={() => onSurface("edge")} /><aside className="atlas-brief" aria-label="Atlas Brief"><div className="native-drag-handle" title="Drag Atlas" />
    <header><div className="brief-brand"><AtlasMark size={34} state={busy ? "thinking" : "idle"} /><div><strong>Atlas</strong><span>{briefing.attention.length ? `${briefing.attention.length} ${briefing.attention.length === 1 ? "thing needs" : "things need"} your attention` : "You're caught up"}</span></div></div><div><button className="icon-button" onClick={onApps} aria-label="Apps"><Icon name="apps" size={17} /></button><button className="icon-button" onClick={() => onSurface("edge")} aria-label="Collapse"><Icon name="close" size={17} /></button></div></header>
    <div className="brief-tools"><button className={provider === "all" ? "active" : ""} onClick={() => { setProvider("all"); setQuery(""); setActive(0); }} title="Daily Brief"><AtlasMark size={20} /></button>{connectedProviders.slice(0, 7).map(item => <button key={item} className={provider === item ? "active" : ""} onClick={() => { setProvider(item); setQuery(""); setActive(0); requestAnimationFrame(() => searchRef.current?.focus()); }} title={`Search ${item}`}><AppLogo provider={item} size={21} /></button>)}<button onClick={onApps} title="Add an app"><Icon name="plus" size={19} /></button></div>
    <label className="brief-search"><Icon name="search" size={16} /><input ref={searchRef} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder={provider === "all" ? "Search everything…" : `Search ${providerName}…`} /></label>
    <div className="brief-content" data-provider={provider}>
      {query || provider !== "all" ? <section><p className="brief-kicker">{provider === "all" ? "All connected sources" : providerName}</p><h2>{query ? `Results for “${query}”` : `Recent in ${providerName}`}</h2>{results.length ? results.map((item, index) => <button key={item.id} className={`brief-result ${active === index ? "active" : ""}`} onClick={() => onOpen(item)}><AppLogo provider={item.provider} size={20} /><span><strong>{parseSourceTitle(item.title).subject}</strong><small>{item.summary}</small><time>{relativeTime(item.occurredAt)}</time></span><Icon name="arrow" size={14} /></button>) : <div className="brief-empty"><p>No matching saved items.</p><small>Atlas searches synchronized data from connected apps.</small></div>}</section>
      : <section><p className="brief-kicker">Today</p><h2>{briefing.attention.length ? "Here’s what matters right now." : "Nothing looks urgent right now."}</h2>{feed.length ? feed.map(({ source, intelligence }, index) => <article key={source.id} className={`brief-item ${active === index ? "active" : ""}`}><button className="brief-item-main" onClick={() => onOpen(source)}><AppLogo provider={source.provider} size={21} /><span><small>{source.accountLabel} · {relativeTime(source.occurredAt)}</small><strong>{parseSourceTitle(source.title).subject}</strong><p>{intelligence.summary}</p></span></button><footer><span>{intelligence.requiresResponse ? "Needs reply" : !intelligence.isAutomated && intelligence.priority === "high" ? "Worth reviewing" : "Update"}</span>{intelligence.requiresResponse ? <button onClick={() => onDraft(source)}>Draft</button> : <button onClick={() => onAsk("Summarize this and tell me what matters", source.id)}>Summarize</button>}</footer></article>) : <div className="brief-empty"><AtlasMark size={38} /><p>You’re caught up.</p><small>Nothing looks urgent right now.</small></div>}</section>}
      {turns.length > 0 && <section className="brief-conversation"><p className="brief-kicker">Conversation</p>{turns.slice(-4).map(turn => <div key={turn.id} data-role={turn.role}><strong>{turn.role === "assistant" ? "Atlas" : "You"}</strong><p>{turn.text || status}</p></div>)}</section>}
    </div>
    <form className="brief-ask" onSubmit={event => { event.preventDefault(); if (!ask.trim() || busy) return; onAsk(ask.trim()); setAsk(""); }}><AtlasStatus state={busy ? "thinking" : "idle"}>{busy ? status || "Thinking" : "Ask Atlas"}</AtlasStatus><div><input ref={askRef} value={ask} onChange={event => setAsk(event.target.value)} placeholder="Ask Atlas…" aria-label="Ask Atlas" /><button disabled={!ask.trim() || busy} aria-label="Send"><Icon name="arrow" size={17} /></button></div><small>Ctrl/⌘ + Shift + L · Alt + A toggles Brief</small></form>
    <button className="brief-workspace" onClick={() => onSurface("workspace")}>Open full Atlas <Icon name="arrow" size={15} /></button>
  </aside></>;
}
