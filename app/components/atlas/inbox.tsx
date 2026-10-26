import { useMemo, useState } from "react";
import { sourceIntelligence, rankInboxSources, relativeTime, safeSourceUrl, type Source } from "@/lib/atlas/workspace";
import { AtlasMark } from "./atlas-mark";
import { AppLogo } from "./app-logo";
import { Icon } from "./icon";
import { AtlasComposer } from "./composer";
import { parseSourceTitle } from "@/lib/nova-ai/source-title";

export function SourceRow({ source, selected, onOpen, ranking }: { source: Source; selected?: boolean; onOpen: () => void; ranking?: { rank: number; score: number; reason: string } }) {
  const intelligence = sourceIntelligence(source);
  const parts = parseSourceTitle(source.title, source.accountLabel);
  return <button className={`message-row${selected ? " selected" : ""}`} onClick={onOpen} aria-pressed={selected}>
    <div className="message-avatar">{parts.sender.split(/\s+/).map(s => s[0]).slice(0, 2).join("")}<AppLogo provider={source.provider} size={16} /></div>
    <div className="message-copy"><div className="message-row-top"><strong>{parts.sender}</strong><time dateTime={new Date(source.occurredAt).toISOString()}>{relativeTime(source.occurredAt)}</time></div><h3>{parts.subject}</h3><p>{source.summary}</p><div className="message-signals">{ranking && <span className="importance-score"><b>#{ranking.rank}</b>{ranking.score} · {ranking.reason}</span>}{intelligence.requiresResponse && <span className="priority-label">May need a reply</span>}</div></div>
  </button>;
}
export function Inbox({ sources, selectedId, onSelect, onAsk, onDraft, onTrash, onRemove, busy }: { sources: Source[]; selectedId: string | null; onSelect: (id: string | null) => void; onAsk: (text: string, id?: string) => void; onDraft: (source: Source) => void; onTrash: (source: Source) => void; onRemove: (source: Source) => void; busy: boolean }) {
  const [filter, setFilter] = useState("priority");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const messages = useMemo(() => sources.filter(s => ["email", "message"].includes(s.sourceType)).sort((a, b) => b.occurredAt - a.occurredAt), [sources]);
  const ranking = useMemo(() => rankInboxSources(sources), [sources]);
  const filtered = useMemo(() => messages.filter(s => {
    const intelligence = sourceIntelligence(s);
    return (!query || `${s.title} ${s.content}`.toLowerCase().includes(query.toLowerCase())) && (filter === "all" || filter === "priority" || (filter === "reply" ? intelligence.requiresResponse : !intelligence.requiresResponse));
  }), [messages, query, filter]);
  const selected = messages.find(s => s.id === selectedId);
  const analysis = selected ? sourceIntelligence(selected) : null;
  return <div className={`inbox-layout${selected ? " has-selection" : ""}`}>
    <section className="inbox-list"><div className="inbox-heading"><p className="eyebrow">A little clarity</p><h1>Inbox</h1><p>Everything in context.</p></div>
      <label className="inbox-search"><Icon name="search" size={17} /><input aria-label="Search messages" placeholder="Search messages" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="filter-tabs" role="group" aria-label="Message filters">{[["priority", "Priority"], ["all", "All"], ["reply", "Needs reply"], ["updates", "Updates"]].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <div className="message-list">{filter === "priority" && !query ? <><section className="priority-pane"><header><div><p>Most important</p><small>Ranked by requests, deadlines, sender, recency, and risk.</small></div><span>{ranking.important.length}</span></header>{ranking.important.length ? ranking.important.map((item, index) => <SourceRow key={item.source.id} source={item.source} selected={item.source.id === selectedId} ranking={{ rank: index + 1, score: item.intelligence.priorityScore, reason: item.intelligence.explanation.split(" · ")[0] }} onOpen={() => { onSelect(item.source.id); setExpanded(false); }} />) : <div className="priority-caught-up"><AtlasMark size={28} /><span><strong>No high-priority messages.</strong><small>Everything is still available below.</small></span></div>}</section><section className="remaining-messages"><header><p>Everything else</p><span>{ranking.remaining.length}</span></header>{ranking.remaining.map(item => <SourceRow key={item.source.id} source={item.source} selected={item.source.id === selectedId} onOpen={() => { onSelect(item.source.id); setExpanded(false); }} />)}</section></> : filtered.map((s, index) => { const group = new Date(s.occurredAt).toDateString() === new Date().toDateString() ? "Today" : "Earlier"; const prev = filtered[index - 1]; const previousGroup = prev ? new Date(prev.occurredAt).toDateString() === new Date().toDateString() ? "Today" : "Earlier" : ""; return <div key={s.id}>{group !== previousGroup && <p className="message-group">{group}</p>}<SourceRow source={s} selected={s.id === selectedId} onOpen={() => { onSelect(s.id); setExpanded(false); }} /></div>; })}
      {!filtered.length && <div className="empty-state"><Icon name="inbox" size={30} /><h2>{query ? "No matches" : "A quiet inbox"}</h2><p>{query ? "Try a name, subject, or phrase." : "Synced messages will appear here. Try refreshing your connected apps."}</p></div>}</div>
    </section>
    <section className="message-detail" aria-label="Selected message">{selected && analysis ? <div className="message-detail-content" key={selected.id}>
      <button className="text-button mobile-back" onClick={() => onSelect(null)}><Icon name="back" size={16} />Back to inbox</button>
      <div className="detail-source"><AppLogo provider={selected.provider} size={20} /><span>{selected.accountLabel}</span><time>{new Date(selected.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div>
      <h2>{parseSourceTitle(selected.title).subject}</h2><p className="message-sender">From {parseSourceTitle(selected.title, selected.accountLabel).sender}</p>
      <div className="message-body">{expanded || selected.content.length <= 2000 ? selected.content : `${selected.content.slice(0, 2000)}…`}</div>
      {selected.content.length > 2000 && <button className="text-button" onClick={() => setExpanded(v => !v)}>{expanded ? "Show less" : "Show full message"}</button>}
      <aside className="atlas-insight"><div><AtlasMark size={27} /><span>Atlas insight</span><small>Based on message signals</small></div><p>{analysis.requiresResponse ? "This looks like it may need a reply." : analysis.isAutomated ? "This looks like an automated update. A reply probably isn’t needed." : "No urgent reply signals detected."}</p><p className="insight-summary">{selected.summary}</p><details><summary>Why this recommendation?</summary><p>{analysis.explanation}. {analysis.requiresResponse ? "The message contains a question or a request for a response. Check the full conversation before acting." : "This is a suggestion, not a confirmed thread status."}</p></details></aside>
      <div className="detail-actions"><button className="primary" onClick={() => onDraft(selected)}>Draft a reply<Icon name="arrow" size={16} /></button>{safeSourceUrl(selected.canonicalUrl) && <a className="secondary" href={safeSourceUrl(selected.canonicalUrl)} target="_blank" rel="noreferrer">Open original<Icon name="external" size={15} /></a>}<details className="more-actions"><summary>More</summary><div>{selected.provider === "gmail" && <button onClick={() => onTrash(selected)}>Move to Gmail Trash</button>}<button onClick={() => onRemove(selected)}>Remove from Atlas only</button></div></details></div>
      <AtlasComposer compact context={selected.title} busy={busy} onSend={text => onAsk(text, selected.id)} />
    </div> : <div className="empty-state detail-empty"><AtlasMark size={64} /><h2>The message. The meaning. The next step.</h2><p>Choose a conversation to read it with Atlas alongside.</p></div>}</section>
  </div>;
}
